import test from "node:test";
import assert from "node:assert/strict";
import { once } from "node:events";
import { createAppServer } from "../server.js";

async function withServer(run) {
  const server = createAppServer({ apiKey: "" }).listen(0, "127.0.0.1");
  await once(server, "listening");
  const { port } = server.address();
  try {
    await run(`http://127.0.0.1:${port}`);
  } finally {
    server.close();
    await once(server, "close");
  }
}

test("health endpoint reports AI configuration without exposing secrets", async () => {
  await withServer(async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/health`);
    const body = await response.json();
    assert.equal(response.status, 200);
    assert.deepEqual(body, { ok: true, aiConfigured: false, provider: "gemini" });
    assert.match(response.headers.get("content-security-policy"), /default-src 'self'/);
  });
});

test("wellness endpoint returns local support when AI is not configured", async () => {
  await withServer(async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/wellness`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: "I feel exhausted and behind", mood: 2 })
    });
    const body = await response.json();
    assert.equal(response.status, 200);
    assert.equal(body.source, "local");
    assert.equal(typeof body.copingStrategy, "string");
  });
});

test("wellness endpoint rejects unsupported content types", async () => {
  await withServer(async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/wellness`, {
      method: "POST",
      body: "not-json"
    });
    assert.equal(response.status, 415);
  });
});
