/**
 * ImageGenerationService
 *
 * Multi-provider gateway for generating photorealistic event concept renders.
 * Supports Google Imagen (via Vertex AI REST) and OpenRouter (Flux / SDXL).
 *
 * Falls back gracefully when no API keys are configured:
 * Returns a placeholder result without throwing errors.
 */

export type VisualCategory =
  | "stage"
  | "mandap"
  | "entrance"
  | "table_decor"
  | "lighting_mood"
  | "floral"
  | "venue_styling";

export type VisualAspectRatio = "16:9" | "4:3" | "1:1" | "9:16";

export interface GenerateConceptVisualInput {
  eventType: string;
  category: VisualCategory;
  themeDescription: string;
  colorPalette?: string[];
  guestCount?: number;
  venueStyle?: string;
  aspectRatio?: VisualAspectRatio;
  workflowId: string;
}

export interface GenerateConceptVisualResult {
  success: boolean;
  imageUrl?: string;        // CDN or hosted URL
  imageBase64?: string;     // Raw base64 PNG/WebP
  promptUsed: string;
  modelUsed: string;
  widthPx: number;
  heightPx: number;
  category: VisualCategory;
  aspectRatio: VisualAspectRatio;
  error?: string;
}

export class ImageGenerationService {
  /**
   * Synthesizes a domain-tailored, photorealistic visual prompt for event design.
   */
  public buildPrompt(input: GenerateConceptVisualInput): string {
    const paletteStr = input.colorPalette && input.colorPalette.length > 0
      ? `color palette featuring ${input.colorPalette.join(", ")}`
      : "luxurious harmonious color palette";
    const venueStr = input.venueStyle ? `in a grand ${input.venueStyle} setting` : "in a high-end luxury event venue";

    switch (input.category) {
      case "mandap":
        return `Ultra-realistic 8K photorealistic Indian wedding mandap ceremony stage, ${input.themeDescription}, ${paletteStr}, ${venueStr}, handcrafted marigold and jasmine garlands, glowing brass diyas and lanterns, regal silk drapes, elevated floral canopy, symmetrical architectural composition, high-end editorial event photography, dramatic warm illumination, no people, 8k resolution`;

      case "stage":
        return `Cinematic 8K concert and keynote event stage production design, ${input.themeDescription}, ${paletteStr}, ${venueStr}, professional aluminum box truss grid, moving-head beam and profile fixtures, atmospheric stage haze, ultra-wide high-definition curved LED backdrop, pristine stage riser platform, architectural lighting design, ultra-detailed photorealistic render`;

      case "table_decor":
        return `Top-down angle high-end luxury Indian banquet table scape, ${input.themeDescription}, ${paletteStr}, opulent floral centerpieces with roses, orchids, and candles, gold-rimmed fine china, crystal glassware, embroidered linen, warm candlelight ambiance, luxury wedding reception styling, 8K photorealistic editorial photography`;

      case "entrance":
        return `Monumental luxury event entrance arch and foyer passage, ${input.themeDescription}, ${paletteStr}, cascading floral installations, golden metallic geometric lattices, illuminated pathway with plush red carpet, ambient architectural uplighting, grand perspective view, 8K ultra-detailed photorealistic render`;

      case "lighting_mood":
        return `Professional concert lighting design visualizer, ${input.themeDescription}, ${paletteStr}, synchronized sharp aerial beam fans, saturated wash fixtures illuminating the stage, dynamic haze volumetric lighting cones, high-contrast theatrical lighting setup, 8K event production visual`;

      case "floral":
        return `Exquisite luxury Indian event floral installation, ${input.themeDescription}, ${paletteStr}, dense botanical arrangements with marigolds, premium Dutch roses, cascading orchids, and jasmine strings, structural botanical artistry, soft studio lighting, 8K macro and wide event floristry photography`;

      case "venue_styling":
      default:
        return `Luxury ${input.eventType} venue interior styling and spatial design, ${input.themeDescription}, ${paletteStr}, ${venueStr}, bespoke furniture layout, dramatic ceiling installations with crystal chandeliers, elegant drapery, 8K photorealistic architectural interior photograph`;
    }
  }

  /**
   * Call OpenRouter image generation API (Flux 1.1 Pro or SDXL).
   */
  private async generateViaOpenRouter(
    prompt: string,
    aspectRatio: VisualAspectRatio
  ): Promise<GenerateConceptVisualResult> {
    const apiKey = (process.env.OPENROUTER_API_KEY || "").trim();
    if (!apiKey) {
      throw new Error("OPENROUTER_API_KEY is not configured");
    }

    const size =
      aspectRatio === "1:1"
        ? "1024x1024"
        : aspectRatio === "9:16"
        ? "768x1344"
        : "1344x768";
    const [w, h] = size.split("x").map(Number);

    const res = await fetch("https://openrouter.ai/api/v1/images/generations", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "HTTP-Referer": process.env.EVENTOLOGY_WEB_URL || "https://eventology.in",
        "X-Title": "Eventology AI Visual Studio",
      },
      body: JSON.stringify({
        model: process.env.OPENROUTER_IMAGE_MODEL || "black-forest-labs/flux-1.1-pro",
        prompt,
        n: 1,
        size,
      }),
    });

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`OpenRouter image API returned ${res.status}: ${errText}`);
    }

    const data = (await res.json()) as any;
    const imageUrl = data?.data?.[0]?.url;
    if (!imageUrl) {
      throw new Error("OpenRouter image API returned empty image array");
    }

    return {
      success: true,
      imageUrl,
      promptUsed: prompt,
      modelUsed: process.env.OPENROUTER_IMAGE_MODEL || "black-forest-labs/flux-1.1-pro",
      widthPx: w,
      heightPx: h,
      category: "stage",
      aspectRatio,
    };
  }

  /**
   * Call Google Cloud Vertex AI Imagen 3 API.
   */
  private async generateViaImagen(
    prompt: string,
    aspectRatio: VisualAspectRatio
  ): Promise<GenerateConceptVisualResult> {
    const token = (process.env.GOOGLE_CLOUD_ACCESS_TOKEN || "").trim();
    const projectId = (process.env.GCP_PROJECT_ID || "").trim();
    if (!token || !projectId) {
      throw new Error("GOOGLE_CLOUD_ACCESS_TOKEN or GCP_PROJECT_ID is not configured");
    }

    const location = process.env.GCP_LOCATION || "us-central1";
    const model = process.env.IMAGEN_MODEL || "imagen-3.0-fast-generate-001";
    const url = `https://${location}-aiplatform.googleapis.com/v1/projects/${projectId}/locations/${location}/publishers/google/models/${model}:predict`;

    const res = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        instances: [{ prompt }],
        parameters: {
          sampleCount: 1,
          aspectRatio: aspectRatio === "1:1" ? "1:1" : "16:9",
          outputMimeType: "image/png",
        },
      }),
    });

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`Google Imagen API returned ${res.status}: ${errText}`);
    }

    const data = (await res.json()) as any;
    const base64 = data?.predictions?.[0]?.bytesBase64Encoded;
    if (!base64) {
      throw new Error("Google Imagen API returned empty prediction payload");
    }

    return {
      success: true,
      imageBase64: base64,
      promptUsed: prompt,
      modelUsed: model,
      widthPx: aspectRatio === "1:1" ? 1024 : 1792,
      heightPx: aspectRatio === "1:1" ? 1024 : 1008,
      category: "stage",
      aspectRatio,
    };
  }

  /**
   * Generates concept render via available providers, falling back gracefully.
   */
  public async generate(input: GenerateConceptVisualInput): Promise<GenerateConceptVisualResult> {
    const prompt = this.buildPrompt(input);
    const ratio = input.aspectRatio || "16:9";

    // 1. Try OpenRouter if configured
    if ((process.env.OPENROUTER_API_KEY || "").trim()) {
      try {
        const res = await this.generateViaOpenRouter(prompt, ratio);
        return { ...res, category: input.category, aspectRatio: ratio };
      } catch (err: any) {
        console.warn("[ImageGenerationService] OpenRouter image generation failed, trying fallback:", err.message);
      }
    }

    // 2. Try Google Vertex Imagen 3 if configured
    if ((process.env.GOOGLE_CLOUD_ACCESS_TOKEN || "").trim() && (process.env.GCP_PROJECT_ID || "").trim()) {
      try {
        const res = await this.generateViaImagen(prompt, ratio);
        return { ...res, category: input.category, aspectRatio: ratio };
      } catch (err: any) {
        console.warn("[ImageGenerationService] Google Imagen generation failed:", err.message);
      }
    }

    // 3. Graceful offline/placeholder fallback
    const [w, h] = ratio === "1:1" ? [1024, 1024] : [1344, 768];
    return {
      success: false,
      promptUsed: prompt,
      modelUsed: "offline_placeholder",
      widthPx: w,
      heightPx: h,
      category: input.category,
      aspectRatio: ratio,
      error: "No external generative image API credentials configured. Prompt generated successfully.",
    };
  }
}

export const imageGenerationService = new ImageGenerationService();
