import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { createApp } from "../lib/app.js";
import { sampleAudit, stubClient } from "./fixtures.js";

// Starts the real Express app on a random port with a stubbed Claude client.
async function serve(client) {
  const server = createApp({ client, model: "test-model" }).listen(0);
  await new Promise((r) => server.once("listening", r));
  const base = `http://127.0.0.1:${server.address().port}`;
  const audit = (body) =>
    fetch(`${base}/api/audit`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: typeof body === "string" ? body : JSON.stringify(body),
    }).then(async (res) => ({ status: res.status, body: await res.json() }));
  return { server, base, audit };
}

const input = { name: "Duolingo", description: "A language-learning app with streaks, XP, leagues and hearts." };

let originalError;
before(() => {
  // The server logs malformed model output; keep test output clean.
  originalError = console.error;
  console.error = () => {};
});
after(() => {
  console.error = originalError;
});

test("returns a validated audit and sends a structured-output request", async () => {
  const client = stubClient(JSON.stringify(sampleAudit));
  const { server, audit } = await serve(client);
  try {
    const { status, body } = await audit(input);
    assert.equal(status, 200);
    assert.equal(body.drives.length, 8);
    assert.equal(body.hat.lean, "black");
    assert.equal(body.mechanics.length, 3);
    assert.ok(body.computed.black > body.computed.white);

    const params = client.calls[0];
    assert.equal(params.model, "test-model");
    assert.equal(params.output_config.format.type, "json_schema");
    assert.match(params.messages[0].content, /<product_name>Duolingo<\/product_name>/);
  } finally {
    server.close();
  }
});

test("reports unparseable JSON as malformed output", async () => {
  const { server, audit } = await serve(stubClient('{"drives": [{"id": 1'));
  try {
    const { status, body } = await audit(input);
    assert.equal(status, 502);
    assert.equal(body.error.code, "malformed_output");
    assert.match(body.error.message, /wasn't valid JSON/);
  } finally {
    server.close();
  }
});

test("reports schema violations with details and returns no partial data", async () => {
  const bad = structuredClone(sampleAudit);
  bad.drives[0].score = 14;
  bad.mechanics = bad.mechanics.slice(0, 2);
  const { server, audit } = await serve(stubClient(JSON.stringify(bad)));
  try {
    const { status, body } = await audit(input);
    assert.equal(status, 502);
    assert.equal(body.error.code, "malformed_output");
    assert.equal(body.drives, undefined);
    assert.ok(body.error.details.some((d) => d.includes("drives[0].score")));
    assert.ok(body.error.details.some((d) => d.includes("exactly 3 entries")));
  } finally {
    server.close();
  }
});

test("handles refusals and truncated answers", async () => {
  for (const [overrides, code] of [
    [{ stop_reason: "refusal", stop_details: { explanation: "Declined." } }, "model_refused"],
    [{ stop_reason: "max_tokens" }, "truncated"],
  ]) {
    const { server, audit } = await serve(stubClient("", overrides));
    try {
      const { status, body } = await audit(input);
      assert.equal(status, 502);
      assert.equal(body.error.code, code);
    } finally {
      server.close();
    }
  }
});

test("uses only the text after a fallback block", async () => {
  const client = stubClient("", {
    content: [
      { type: "text", text: '{"partial":' },
      { type: "fallback", from: { model: "a" }, to: { model: "b" } },
      { type: "text", text: JSON.stringify(sampleAudit) },
    ],
  });
  const { server, audit } = await serve(client);
  try {
    const { status } = await audit(input);
    assert.equal(status, 200);
  } finally {
    server.close();
  }
});

test("rejects bad input without calling the model", async () => {
  const client = stubClient(JSON.stringify(sampleAudit));
  const { server, audit } = await serve(client);
  try {
    for (const body of [{}, { name: "X", description: "too short" }, { name: "X", description: "y".repeat(2001) }, "{not json"]) {
      const res = await audit(body);
      assert.equal(res.status, 400);
      assert.equal(res.body.error.code, "invalid_input");
    }
    assert.equal(client.calls.length, 0);
  } finally {
    server.close();
  }
});
