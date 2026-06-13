import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import { extname, join, relative, resolve } from "node:path";
import { generateWellnessResponse } from "./ai-service.js";

const port = Number(process.env.PORT || 4173);
const root = process.cwd();
const rateLimits = new Map();
const contentTypes = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml"
};

function securityHeaders(contentType = "application/json; charset=utf-8") {
  return {
    "Content-Type": contentType,
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff",
    "Referrer-Policy": "no-referrer",
    "Permissions-Policy": "camera=(), microphone=(), geolocation=()",
    "Content-Security-Policy": "default-src 'self'; style-src 'self'; script-src 'self'; img-src 'self' data:; connect-src 'self'; base-uri 'none'; form-action 'self'; frame-ancestors 'none'"
  };
}

function sendJson(response, status, payload) {
  response.writeHead(status, securityHeaders());
  response.end(JSON.stringify(payload));
}

function allowRequest(request) {
  const key = request.socket.remoteAddress || "local";
  const now = Date.now();
  if (rateLimits.size > 1000) {
    for (const [address, record] of rateLimits) {
      if (now - record.startedAt > 60_000) rateLimits.delete(address);
    }
  }
  const record = rateLimits.get(key);
  if (!record || now - record.startedAt > 60_000) {
    rateLimits.set(key, { startedAt: now, count: 1 });
    return true;
  }
  record.count += 1;
  return record.count <= 12;
}

async function readJson(request, maxBytes = 20_000) {
  const chunks = [];
  let size = 0;
  for await (const chunk of request) {
    size += chunk.length;
    if (size > maxBytes) throw new Error("Request is too large.");
    chunks.push(chunk);
  }
  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}

export function createAppServer(options = {}) {
  return createServer(async (request, response) => {
    const pathname = decodeURIComponent(new URL(request.url, "http://localhost").pathname);

    if (pathname === "/api/health" && request.method === "GET") {
      sendJson(response, 200, {
        ok: true,
        aiConfigured: Boolean(options.apiKey ?? process.env.GEMINI_API_KEY ?? process.env.GOOGLE_API_KEY),
        provider: "gemini"
      });
      return;
    }

    if (pathname === "/api/wellness" && request.method === "POST") {
      if (!allowRequest(request)) {
        sendJson(response, 429, { error: "Please wait a moment before sending another message." });
        return;
      }
      if (!String(request.headers["content-type"] || "").startsWith("application/json")) {
        sendJson(response, 415, { error: "Content-Type must be application/json." });
        return;
      }
      try {
        const payload = await readJson(request);
        const result = await generateWellnessResponse(payload, options);
        sendJson(response, 200, result);
      } catch (error) {
        console.error("Wellness request failed:", error.message);
        sendJson(response, error instanceof SyntaxError ? 400 : 502, {
          error: error instanceof SyntaxError
            ? "Invalid JSON request."
            : "Support is temporarily unavailable. Your journal remains on this device."
        });
      }
      return;
    }

    if (pathname.startsWith("/api/")) {
      sendJson(response, 404, { error: "API route not found." });
      return;
    }

    const requested = pathname === "/" ? "index.html" : pathname.slice(1);
    const filePath = resolve(root, requested);
    const relativePath = relative(root, filePath);
    if (relativePath.startsWith("..") || relativePath.includes(`..${process.platform === "win32" ? "\\" : "/"}`)) {
      response.writeHead(403).end("Forbidden");
      return;
    }

    try {
      const fileStat = await stat(filePath);
      const resolvedPath = fileStat.isDirectory() ? join(filePath, "index.html") : filePath;
      const body = await readFile(resolvedPath);
      response.writeHead(200, securityHeaders(contentTypes[extname(resolvedPath)] || "application/octet-stream"));
      response.end(body);
    } catch {
      response.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" }).end("Not found");
    }
  });
}

const invokedPath = process.argv[1]?.replaceAll("\\", "/");
if (invokedPath && import.meta.url === `file:///${invokedPath}`) {
  createAppServer().listen(port, () => {
    console.log(`SteadyMind is running at http://localhost:${port}`);
    console.log(process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY
      ? "Gemini conversational AI is enabled."
      : "Using local fallback: set GEMINI_API_KEY to enable Gemini.");
  });
}
