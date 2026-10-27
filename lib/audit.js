import Anthropic from "@anthropic-ai/sdk";
import { SYSTEM_PROMPT, AUDIT_SCHEMA, buildUserMessage } from "./prompt.js";
import { validateAudit } from "./validate.js";
import { computeLeanings } from "./drives.js";

export const DEFAULT_MODEL = "claude-sonnet-5-5";

export const LIMITS = { name: 100, description: 2000, minDescription: 20 };

// An error that is safe to show the user. `status` is the HTTP status the
// server responds with; `details` is an optional list of specifics.
export class AuditError extends Error {
  constructor(code, message, { status = 502, details } = {}) {
    super(message);
    this.code = code;
    this.status = status;
    this.details = details;
  }
}

export function checkInput(body) {
  const name = typeof body?.name === "string" ? body.name.trim() : "";
  const description = typeof body?.description === "string" ? body.description.trim() : "";
  const problems = [];
  if (!name) problems.push("Product name is required.");
  else if (name.length > LIMITS.name) problems.push(`Product name must be at most ${LIMITS.name} characters.`);
  if (description.length < LIMITS.minDescription) {
    problems.push(`Description must be at least ${LIMITS.minDescription} characters.`);
  } else if (description.length > LIMITS.description) {
    problems.push(`Description must be at most ${LIMITS.description} characters.`);
  }
  if (problems.length) {
    throw new AuditError("invalid_input", "Please fix the form and try again.", { status: 400, details: problems });
  }
  return { name, description };
}

// The JSON answer is the text after the last `fallback` block: if a model
// declined mid-response and a fallback model took over, earlier text is
// the declined model's partial output and must be ignored.
function answerText(content) {
  const lastFallback = content.findLastIndex((b) => b.type === "fallback");
  return content
    .slice(lastFallback + 1)
    .filter((b) => b.type === "text")
    .map((b) => b.text)
    .join("");
}

export async function runAudit(client, model, input) {
  const { name, description } = checkInput(input);

  let response;
  try {
    response = await client.beta.messages.create({
      model,
      max_tokens: 16000,
      system: SYSTEM_PROMPT,
      messages: [{ role: "user", content: buildUserMessage({ name, description }) }],
      output_config: {
        effort: "medium",
        format: { type: "json_schema", schema: AUDIT_SCHEMA },
      },
      // If a safety classifier declines, let the API retry on Anthropic's
      // recommended fallback model instead of failing outright.
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
    });
  } catch (err) {
    throw toAuditError(err);
  }

  if (response.stop_reason === "refusal") {
    throw new AuditError("model_refused", "The model declined to analyse this description. Try rewording it.", {
      details: response.stop_details?.explanation ? [response.stop_details.explanation] : undefined,
    });
  }
  if (response.stop_reason === "max_tokens") {
    throw new AuditError("truncated", "The model's answer was cut off before it finished. Please try again.");
  }

  const text = answerText(response.content);
  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch (err) {
    console.error("Model returned unparseable JSON:", text.slice(0, 2000));
    throw new AuditError("malformed_output", "The model's answer wasn't valid JSON, so nothing is shown.", {
      details: [err.message],
    });
  }

  const result = validateAudit(parsed);
  if (!result.ok) {
    console.error("Model output failed validation:", result.errors, text.slice(0, 2000));
    throw new AuditError(
      "malformed_output",
      "The model's answer didn't match the expected format, so nothing is shown.",
      { details: result.errors },
    );
  }

  const audit = result.value;
  const scores = Object.fromEntries(audit.drives.map((d) => [d.id, d.score]));
  return {
    product: { name, description },
    model: response.model,
    ...audit,
    computed: computeLeanings(scores),
  };
}

function toAuditError(err) {
  if (err instanceof Anthropic.AuthenticationError) {
    return new AuditError("upstream_auth", "The server's Anthropic API key was rejected. Check ANTHROPIC_API_KEY in .env.", { status: 500 });
  }
  if (err instanceof Anthropic.RateLimitError) {
    return new AuditError("rate_limited", "The Claude API is rate-limiting requests. Wait a moment and try again.", { status: 429 });
  }
  if (err instanceof Anthropic.BadRequestError || err instanceof Anthropic.NotFoundError) {
    console.error("Claude API rejected the request:", err.message);
    return new AuditError("upstream_rejected", "The Claude API rejected the request. Check ANTHROPIC_MODEL and the server log.", { status: 500 });
  }
  if (err instanceof Anthropic.APIError) {
    console.error("Claude API error:", err.status, err.message);
    return new AuditError("upstream_error", "The Claude API is unavailable right now. Please try again shortly.");
  }
  throw err;
}
