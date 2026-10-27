// Runs the app with a canned model response instead of the Claude API, so
// you can try the UI without an API key. Product names containing
// "malformed" or "badschema" return broken output to show the error states.
import { createApp } from "../lib/app.js";
import { sampleAudit } from "../test/fixtures.js";

const client = {
  beta: {
    messages: {
      async create(params) {
        await new Promise((r) => setTimeout(r, 600));
        const prompt = params.messages[0].content.toLowerCase();
        let text = JSON.stringify(sampleAudit);
        if (prompt.includes("malformed")) text = '{"drives": [{"id": 1, "score": 4';
        if (prompt.includes("badschema")) {
          text = JSON.stringify({ ...sampleAudit, drives: sampleAudit.drives.slice(0, 6).map((d, i) => (i === 0 ? { ...d, score: 14 } : d)) });
        }
        return { model: "demo (canned response)", stop_reason: "end_turn", content: [{ type: "text", text }] };
      },
    },
  },
};

const port = Number(process.env.PORT) || 3000;
createApp({ client, model: "demo" }).listen(port, () => {
  console.log(`Demo mode (no API calls) at http://localhost:${port}`);
});
