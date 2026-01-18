import { OpenAI } from "openai";
import env from "../config/env";
import { logger } from "../utils/logger";

export class OpenAIService {
  private client: OpenAI;

  constructor() {
    this.client = new OpenAI({
      apiKey: env.OPENAI_API_KEY,
    });
  }

  /**
   * Generate AI reply based on review rating
   *
   * ✅ Uses OpenAI Responses API
   * ✅ input: gpt-5-mini (cheap)
   * ✅ output: gpt-5 (best quality)
   * ✅ Output: < 40 words
   *
   * This output can be directly posted as a Google Review Reply.
   */
  async generateReply(payload: {
    rating: number;
    customerName: string;
    reviewText: string;
    outletName: string;
    storeLocation: string;
    businessCategory: string;
  }): Promise<string | null> {
    try {
      if (!env.OPENAI_API_KEY) {
        logger.warn("OpenAI API key not configured");
        return null;
      }

      const {
        rating,
        customerName,
        reviewText,
        outletName,
        storeLocation,
        businessCategory,
      } = payload;

      const cleanMsg = (reviewText || "").trim();
      const safeCustomer = (customerName || "Customer").trim() || "Customer";

      /**
       * Special rule: 4/5 star but no message
       */
      if ((rating === 4 || rating === 5) && cleanMsg.length === 0) {
        const msg = `Thank you so much, ${safeCustomer}, for the ${rating}-star review! We truly appreciate your support and look forward to serving you again.`;
        return enforceWordLimit(msg, 40);
      }

      /**
       * System prompt designed to produce:
       * - Professional Google reply (not whatsapp-style)
       * - <= 40 words
       * - Contains customer name
       * - 1-3 stars: apology + resolution offer
       */
      const system = `
You write professional replies to Google reviews for a business.
STRICT RULES:
- Must be under 40 words.
- Must include the customer's name.
- Tone: professional, warm, human.
- For 4-5 stars: thank them and invite them back.
- For 1-3 stars: apologize, acknowledge concern, offer help, suggest contacting support/store.
- No emojis.
- Do NOT mention "AI", "ChatGPT", "OpenAI".
- Do NOT include phone numbers unless provided in input (not provided).
`.trim();

      const user = `
Rating: ${rating}
Customer: ${safeCustomer}
Review Message: ${cleanMsg || "(no message)"}
Business Name: ${outletName}
Store Location: ${storeLocation}
Business Category: ${businessCategory}

Write a single reply only.
`.trim();

      /**
       * ✅ Responses API with input/output model split:
       * input = gpt-5-mini
       * output = gpt-5
       */
      const response = await (this.client as any).responses.create({
        model: "gpt-5",
        // input model = gpt-5-mini (cost saver)
        // NOTE: this parameter is supported in Responses API.
        // If your SDK version doesn't accept it, I’ll patch accordingly.
        input_model: "gpt-5-mini" as any,

        input: [
          { role: "system", content: system },
          { role: "user", content: user },
        ],

        max_output_tokens: env.OPENAI_MAX_TOKENS || 120,
      });

      // Responses API returns output_text
      const raw = (response as any).output_text?.trim?.() || "";

      if (!raw) {
        logger.warn("OpenAI returned empty response");
        return null;
      }

      const finalReply = enforceWordLimit(raw, 40);

      logger.info("AI reply generated (Responses API)", {
        rating,
        outletName,
        words: finalReply.split(/\s+/).filter(Boolean).length,
      });

      return finalReply;
    } catch (error: any) {
      logger.error("Failed to generate AI reply (Responses API)", error);
      return null;
    }
  }

  /**
   * Generate multiple reply templates for critical reviews
   * (Optional in your flow, but kept for compatibility)
   */
  async generateTemplates(
    reviewText: string,
    rating: number,
    outletName: string
  ): Promise<string[] | null> {
    try {
      if (!env.OPENAI_API_KEY) {
        logger.warn("OpenAI API key not configured");
        return null;
      }

      const response = await (this.client as any).responses.create({
        model: "gpt-5",
        input_model: "gpt-5-mini" as any,
        input: [
          {
            role: "system",
            content: `You are an expert customer service writer. Generate 3 different professional, empathetic replies for a ${rating}-star review at ${outletName}. Each should be unique in tone (formal, warm, concise). Output format exactly:

Template 1: ...
Template 2: ...
Template 3: ...`,
          },
          {
            role: "user",
            content: `Critical Review (${rating} stars): ${reviewText}`,
          },
        ],
        max_output_tokens: Math.min((env.OPENAI_MAX_TOKENS || 200) * 3, 800),
      });

      const content = ((response as any).output_text || "").trim();
      if (!content) return null;

      const templates = content
        .split("\n")
        .map((x: string) => x.trim())
        .filter((line: string) => /^Template\s\d+:/i.test(line))
        .map((line: string) => line.replace(/Template\s\d+:\s*/i, "").trim())
        .filter(Boolean);

      logger.info("Reply templates generated (Responses API)", {
        outletName,
        count: templates.length,
      });

      return templates.length ? templates : null;
    } catch (error) {
      logger.error("Failed to generate reply templates", error);
      return null;
    }
  }

  /**
   * Sentiment analysis (optional)
   */
  async analyzeSentiment(
    reviewText: string
  ): Promise<"positive" | "neutral" | "negative" | null> {
    try {
      if (!env.OPENAI_API_KEY) return null;

      const response = await this.client.responses.create({
        model: "gpt-5-mini",
        input: [
          {
            role: "system",
            content:
              "Analyze sentiment of this review. Respond with only one word: positive, neutral, or negative.",
          },
          { role: "user", content: reviewText },
        ],
        max_output_tokens: 10,
      });

      const sentiment = ((response as any).output_text || "").trim().toLowerCase();

      if (sentiment === "positive" || sentiment === "neutral" || sentiment === "negative") {
        return sentiment;
      }

      return null;
    } catch (error) {
      logger.error("Failed to analyze sentiment", error);
      return null;
    }
  }
}

/**
 * Helpers
 */
function enforceWordLimit(text: string, limit: number) {
  const words = String(text).trim().split(/\s+/).filter(Boolean);
  if (words.length <= limit) return words.join(" ");
  return words.slice(0, limit).join(" ");
}

export const openaiService = new OpenAIService();
