import express from "express";
import { fileURLToPath } from "node:url";
import { runAudit, AuditError, LIMITS } from "./audit.js";
import { DRIVES } from "./drives.js";

const publicDir = fileURLToPath(new URL("../public", import.meta.url));

// `client` is an Anthropic client (or a stand-in with the same
// `beta.messages.create` method, which is how the tests and demo work).
export function createApp({ client, model }) {
  const app = express();
  app.use(express.json({ limit: "16kb" }));
  app.use(express.static(publicDir));

  app.get("/api/config", (req, res) => {
    res.json({ drives: DRIVES, limits: LIMITS });
  });

  app.post("/api/audit", async (req, res, next) => {
    try {
      res.json(await runAudit(client, model, req.body));
    } catch (err) {
      next(err);
    }
  });

  // Express 5 forwards rejected promises here too.
  app.use((err, req, res, next) => {
    if (err instanceof AuditError) {
      return res.status(err.status).json({ error: { code: err.code, message: err.message, details: err.details } });
    }
    if (err.type === "entity.parse.failed" || err.type === "entity.too.large") {
      return res.status(400).json({ error: { code: "invalid_input", message: "The request body was not valid JSON or was too large." } });
    }
    console.error(err);
    res.status(500).json({ error: { code: "internal", message: "Something went wrong on the server." } });
  });

  return app;
}
