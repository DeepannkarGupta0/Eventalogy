import { tool } from "@langchain/core/tools";
import { z } from "zod";
import {
  imageGenerationService,
  VisualCategory,
  VisualAspectRatio,
} from "../services/visual/image_generation_service";

export const generateConceptVisualTool = tool(
  async ({
    eventType,
    category,
    themeDescription,
    colorPalette,
    guestCount,
    venueStyle,
    aspectRatio,
    workflowId,
  }) => {
    const result = await imageGenerationService.generate({
      eventType,
      category: category as VisualCategory,
      themeDescription,
      colorPalette: colorPalette ?? [],
      guestCount,
      venueStyle,
      aspectRatio: (aspectRatio ?? "16:9") as VisualAspectRatio,
      workflowId,
    });
    return JSON.stringify(result);
  },
  {
    name: "generate_concept_visual",
    description:
      "Generates an ultra-detailed, photorealistic 8K concept render for an event design element (stage production, royal mandap, banquet table decor, grand entrance arch, lighting visualizer, or floral styling). Returns an image URL or base64 PNG with metadata.",
    schema: z.object({
      eventType: z.string().describe("Type of event e.g. Wedding, Sangeet, Corporate Summit, Music Festival"),
      category: z
        .enum(["stage", "mandap", "entrance", "table_decor", "lighting_mood", "floral", "venue_styling"])
        .describe("Visual design category to render"),
      themeDescription: z
        .string()
        .describe("Detailed description of the aesthetic theme, materials, architectural styling, and ambiance"),
      colorPalette: z
        .array(z.string())
        .optional()
        .describe("Primary colors for the decor (e.g. ['Emerald Green', 'Brushed Gold', 'Warm White'])"),
      guestCount: z.number().optional().describe("Expected guest count influencing scale"),
      venueStyle: z.string().optional().describe("Venue style setting (e.g. Palace Courtyard, Five-Star Ballroom, Open Lawn)"),
      aspectRatio: z.enum(["16:9", "4:3", "1:1", "9:16"]).optional().default("16:9"),
      workflowId: z.string().describe("Current workflow ID for tracking and artifact provenance"),
    }),
  }
);

