import { OpenAI } from "openai"
import env from "../config/env"
import { logger } from "../utils/logger"

export class OpenAIService {
  private client: OpenAI

  constructor() {
    this.client = new OpenAI({
      apiKey: env.OPENAI_API_KEY,
    })
  }

  /**
   * Generate AI reply based on review rating
   * For ratings 4-5: Positive, grateful response
   * For ratings 1-3: Empathetic, apologetic, offer resolution
   */
  async generateReply(reviewText: string, rating: number, outletName: string): Promise<string | null> {
    try {
      if (!env.OPENAI_API_KEY) {
        logger.warn("OpenAI API key not configured")
        return null
      }

      let systemPrompt = `You are a professional customer service representative for ${outletName}. `

      if (rating >= 4) {
        systemPrompt += `The customer left a positive review (${rating} stars). Respond with sincere gratitude and appreciation. Be warm, personal, and encouraging. Invite them to return. Keep it under 100 words.`
      } else {
        systemPrompt += `The customer left a critical review (${rating} stars). Respond with genuine empathy and professionalism. Acknowledge their concerns, apologize sincerely, and offer to resolve the issue privately via email or phone. Do NOT be defensive. Do NOT make excuses. Keep it under 120 words.`
      }

      const modelToUse = env.OPENAI_OUTPUT_MODEL || env.OPENAI_MODEL || "gpt-4o-mini"

      const response = await this.client.chat.completions.create({
        model: modelToUse,
        messages: [
          {
            role: "system",
            content: systemPrompt,
          },
          {
            role: "user",
            content: `Review (${rating} stars): ${reviewText}`,
          },
        ],
        max_tokens: env.OPENAI_MAX_TOKENS || 200,
        temperature: env.OPENAI_TEMPERATURE || 0.7,
      })

      const reply = response.choices[0]?.message?.content

      if (!reply) {
        logger.warn("OpenAI returned empty response")
        return null
      }

      logger.info("AI reply generated", {
        rating,
        outletName,
        length: reply.length,
      })

      return reply.trim()
    } catch (error) {
      logger.error("Failed to generate AI reply", error)
      return null
    }
  }

  /**
   * Generate multiple reply templates for critical reviews
   * Used for giving admins options for manual replies
   */
  async generateTemplates(reviewText: string, rating: number, outletName: string): Promise<string[] | null> {
    try {
      if (!env.OPENAI_API_KEY) {
        logger.warn("OpenAI API key not configured")
        return null
      }

      const modelToUse = env.OPENAI_OUTPUT_MODEL || env.OPENAI_MODEL || "gpt-4o-mini"

      const response = await this.client.chat.completions.create({
        model: modelToUse,
        messages: [
          {
            role: "system",
            content: `You are an expert customer service writer. Generate 3 different professional, empathetic replies for a ${rating}-star review at ${outletName}. Each should be unique in tone (formal, warm, concise) but all professional. Format as:

Template 1: [reply]

Template 2: [reply]

Template 3: [reply]`,
          },
          {
            role: "user",
            content: `Critical Review (${rating} stars): ${reviewText}`,
          },
        ],
        max_tokens: (env.OPENAI_MAX_TOKENS || 200) * 3,
        temperature: 0.8,
      })

      const content = response.choices[0]?.message?.content

      if (!content) {
        logger.warn("OpenAI returned empty response")
        return null
      }

      const templates = content
        .split("\n\n")
        .filter((line) => line.trim().startsWith("Template"))
        .map((line) => line.replace(/Template\s\d+:\s*/i, "").trim())

      logger.info("Reply templates generated", {
        outletName,
        count: templates.length,
      })

      return templates
    } catch (error) {
      logger.error("Failed to generate reply templates", error)
      return null
    }
  }

  /**
   * Analyze sentiment of a review
   */
  async analyzeSentiment(reviewText: string): Promise<"positive" | "neutral" | "negative" | null> {
    try {
      if (!env.OPENAI_API_KEY) {
        return null
      }

      const response = await this.client.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content:
              "Analyze the sentiment of this review. Respond with only one word: positive, neutral, or negative.",
          },
          {
            role: "user",
            content: reviewText,
          },
        ],
        max_tokens: 10,
        temperature: 0,
      })

      const sentiment = response.choices[0]?.message?.content?.trim().toLowerCase()

      if (sentiment === "positive" || sentiment === "neutral" || sentiment === "negative") {
        return sentiment
      }

      return null
    } catch (error) {
      logger.error("Failed to analyze sentiment", error)
      return null
    }
  }
}

export const openaiService = new OpenAIService()
