import Anthropic from "@anthropic-ai/sdk";
import dotenv from "dotenv";
dotenv.config();

const anthropic = new Anthropic(); // Uses process.env.ANTHROPIC_API_KEY

/**
 * Sends a prompt to Anthropic Claude and returns the JSON response.
 * @param {string} prompt - The user's prompt to send to Claude.
 * @returns {Promise<object>} - The JSON response from Claude.
 */
export async function askClaude(prompt) {
  const msg = await anthropic.messages.create({
    model: "claude-opus-4-20250514",
    max_tokens: 1000,
    temperature: 1,
    system: "Respond only with short poems.",
    messages: [
      {
        role: "user",
        content: [
          {
            type: "text",
            text: prompt
          }
        ]
      }
    ]
  });

  console.log(msg)
  return msg;
}
