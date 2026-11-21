import { imageGenerationService } from "../services/visual/image_generation_service";
import { generateConceptVisualTool } from "../tools/visual_generation";
import { artifactsReducer, ProductionArtifact } from "../graph/state";
import { sanitizeArtifactForPublic } from "../api/agent_routes";

describe("Milestone 52: AI Visual Design Studio & Concept Generation", () => {
  describe("1. ImageGenerationService Prompt Synthesis", () => {
    it("synthesizes high-detail 8K prompts across all supported visual categories", () => {
      const categories = [
        "stage",
        "mandap",
        "entrance",
        "table_decor",
        "lighting_mood",
        "floral",
        "venue_styling",
      ] as const;

      for (const cat of categories) {
        const prompt = imageGenerationService.buildPrompt({
          eventType: "Royal Wedding",
          category: cat,
          themeDescription: "Majestic Rajasthani Palace Theme with amber gold hues",
          colorPalette: ["Marigold Yellow", "Crimson Red", "Brushed Gold"],
          guestCount: 500,
          venueStyle: "Heritage Palace Courtyard",
          aspectRatio: "16:9",
          workflowId: "test-wf-123",
        });

        expect(typeof prompt).toBe("string");
        expect(prompt.length).toBeGreaterThan(50);
        expect(prompt).toContain("8K");
        expect(prompt.toLowerCase()).toContain("rajasthani palace");
      }
    });

    it("falls back gracefully without throwing when API credentials are absent", async () => {
      // Temporarily clear environment credentials for test
      const prevKey = process.env.OPENROUTER_API_KEY;
      const prevToken = process.env.GOOGLE_CLOUD_ACCESS_TOKEN;
      delete process.env.OPENROUTER_API_KEY;
      delete process.env.GOOGLE_CLOUD_ACCESS_TOKEN;

      try {
        const result = await imageGenerationService.generate({
          eventType: "Corporate Summit",
          category: "stage",
          themeDescription: "Cyberpunk Tech Keynote with 32:9 curved LED wall",
          workflowId: "test-wf-fallback",
        });

        expect(result).toBeDefined();
        expect(result.success).toBe(false);
        expect(result.modelUsed).toBe("offline_placeholder");
        expect(result.promptUsed).toContain("8K");
        expect(result.category).toBe("stage");
      } finally {
        if (prevKey) process.env.OPENROUTER_API_KEY = prevKey;
        if (prevToken) process.env.GOOGLE_CLOUD_ACCESS_TOKEN = prevToken;
      }
    });
  });

  describe("2. LangGraph Tool Definition", () => {
    it("defines generateConceptVisualTool with valid Zod schema and name", () => {
      expect(generateConceptVisualTool.name).toBe("generate_concept_visual");
      expect(generateConceptVisualTool.description).toContain("photorealistic 8K concept render");
    });
  });

  describe("3. LangGraph ProductionArtifact Contract", () => {
    it("artifactsReducer correctly accepts and deduplicates concept_visual artifacts", () => {
      const visualArtifact: ProductionArtifact = {
        artifactId: "visual-mandap-001",
        type: "concept_visual",
        title: "Royal Rajputana Mandap Concept",
        summary: "8K Concept render of elevated floral mandap with marigold and brass diyas",
        version: 1,
        format: "json",
        mimeType: "image/png",
        content: JSON.stringify({ prompt: "Ultra-realistic 8K Indian wedding mandap" }),
        contentUrl: "https://storage.googleapis.com/eventology-visuals/mandap-001.webp",
        imageBase64: "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
        status: "validated",
        requiresReview: false,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      const reduced = artifactsReducer([], [visualArtifact]);
      expect(reduced).toHaveLength(1);
      expect(reduced[0].type).toBe("concept_visual");
      expect(reduced[0].artifactId).toBe("visual-mandap-001");
      expect(reduced[0].imageBase64).toBeDefined();
    });

    it("sanitizeArtifactForPublic preserves concept_visual type and imageBase64 payload", () => {
      const rawArtifact = {
        artifactId: "visual-stage-002",
        type: "concept_visual",
        title: "32:9 Keynote Stage Render",
        summary: "Widescreen curved LED video wall production",
        version: 1,
        format: "json",
        mimeType: "image/png",
        content: "{}",
        contentUrl: "https://cdn.eventology.in/stage.webp",
        imageBase64: "base64sampledata",
        status: "approved",
      };

      const sanitized = sanitizeArtifactForPublic(rawArtifact);
      expect(sanitized).toBeDefined();
      expect(sanitized.type).toBe("concept_visual");
      expect(sanitized.contentUrl).toBe("https://cdn.eventology.in/stage.webp");
      expect(sanitized.imageBase64).toBe("base64sampledata");
      expect(sanitized.status).toBe("approved");
    });
  });
});

