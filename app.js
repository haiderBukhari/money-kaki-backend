import Anthropic from "@anthropic-ai/sdk";

// If using a .env file, load it
import dotenv from "dotenv";
dotenv.config();

const anthropic = new Anthropic(); // Uses process.env.ANTHROPIC_API_KEY

async function askClaude() {
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
            text: "Why is the ocean salty?"
          }
        ]
      }
    ]
  });

  console.log(msg);
}

askClaude();
