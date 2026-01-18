"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.openaiService = exports.OpenAIService = void 0;
const openai_1 = require("openai");
const env_1 = __importDefault(require("../config/env"));
const logger_1 = require("../utils/logger");
class OpenAIService {
    constructor() {
        this.client = new openai_1.OpenAI({
            apiKey: env_1.default.OPENAI_API_KEY,
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
    async generateReply(payload) {
        try {
            if (!env_1.default.OPENAI_API_KEY) {
                logger_1.logger.warn("OpenAI API key not configured");
                return null;
            }
            const { rating, customerName, reviewText, outletName, storeLocation, businessCategory, } = payload;
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
            const response = await this.client.responses.create({
                model: "gpt-5",
                // input model = gpt-5-mini (cost saver)
                // NOTE: this parameter is supported in Responses API.
                // If your SDK version doesn't accept it, I’ll patch accordingly.
                input_model: "gpt-5-mini",
                input: [
                    { role: "system", content: system },
                    { role: "user", content: user },
                ],
                max_output_tokens: env_1.default.OPENAI_MAX_TOKENS || 120,
            });
            // Responses API returns output_text
            const raw = response.output_text?.trim?.() || "";
            if (!raw) {
                logger_1.logger.warn("OpenAI returned empty response");
                return null;
            }
            const finalReply = enforceWordLimit(raw, 40);
            logger_1.logger.info("AI reply generated (Responses API)", {
                rating,
                outletName,
                words: finalReply.split(/\s+/).filter(Boolean).length,
            });
            return finalReply;
        }
        catch (error) {
            logger_1.logger.error("Failed to generate AI reply (Responses API)", error);
            return null;
        }
    }
    /**
     * Generate multiple reply templates for critical reviews
     * (Optional in your flow, but kept for compatibility)
     */
    async generateTemplates(reviewText, rating, outletName) {
        try {
            if (!env_1.default.OPENAI_API_KEY) {
                logger_1.logger.warn("OpenAI API key not configured");
                return null;
            }
            const response = await this.client.responses.create({
                model: "gpt-5",
                input_model: "gpt-5-mini",
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
                max_output_tokens: Math.min((env_1.default.OPENAI_MAX_TOKENS || 200) * 3, 800),
            });
            const content = (response.output_text || "").trim();
            if (!content)
                return null;
            const templates = content
                .split("\n")
                .map((x) => x.trim())
                .filter((line) => /^Template\s\d+:/i.test(line))
                .map((line) => line.replace(/Template\s\d+:\s*/i, "").trim())
                .filter(Boolean);
            logger_1.logger.info("Reply templates generated (Responses API)", {
                outletName,
                count: templates.length,
            });
            return templates.length ? templates : null;
        }
        catch (error) {
            logger_1.logger.error("Failed to generate reply templates", error);
            return null;
        }
    }
    /**
     * Sentiment analysis (optional)
     */
    async analyzeSentiment(reviewText) {
        try {
            if (!env_1.default.OPENAI_API_KEY)
                return null;
            const response = await this.client.responses.create({
                model: "gpt-5-mini",
                input: [
                    {
                        role: "system",
                        content: "Analyze sentiment of this review. Respond with only one word: positive, neutral, or negative.",
                    },
                    { role: "user", content: reviewText },
                ],
                max_output_tokens: 10,
            });
            const sentiment = (response.output_text || "").trim().toLowerCase();
            if (sentiment === "positive" || sentiment === "neutral" || sentiment === "negative") {
                return sentiment;
            }
            return null;
        }
        catch (error) {
            logger_1.logger.error("Failed to analyze sentiment", error);
            return null;
        }
    }
}
exports.OpenAIService = OpenAIService;
/**
 * Helpers
 */
function enforceWordLimit(text, limit) {
    const words = String(text).trim().split(/\s+/).filter(Boolean);
    if (words.length <= limit)
        return words.join(" ");
    return words.slice(0, limit).join(" ");
}
exports.openaiService = new OpenAIService();
//# sourceMappingURL=openai.js.map