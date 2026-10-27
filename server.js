import Anthropic from "@anthropic-ai/sdk";
import { createApp } from "./lib/app.js";
import { DEFAULT_MODEL } from "./lib/audit.js";

try {
  process.loadEnvFile(".env");
} catch {
  // No .env file: fall back to variables already in the environment.
}

if (!process.env.ANTHROPIC_API_KEY) {
  console.error("ANTHROPIC_API_KEY is not set. Copy .env.example to .env and paste your key in.");
  process.exit(1);
}

const model = process.env.ANTHROPIC_MODEL || DEFAULT_MODEL;
const port = Number(process.env.PORT) || 3000;
const app = createApp({ client: new Anthropic(), model });

app.listen(port, () => {
  console.log(`Octalysis audit running at http://localhost:${port} (model: ${model})`);
});
