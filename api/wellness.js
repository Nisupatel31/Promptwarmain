import { generateWellnessResponse } from "../ai-service.js";

export default async function handler(request, response) {
  if (request.method !== "POST") {
    response.writeHead(405).end("Method Not Allowed");
    return;
  }

  const contentType = request.headers["content-type"] || "";
  if (!contentType.startsWith("application/json")) {
    response.writeHead(415, { "Content-Type": "application/json" }).end(
      JSON.stringify({ error: "Content-Type must be application/json." })
    );
    return;
  }

  try {
    let payload = request.body;
    if (typeof payload === "string") {
      payload = JSON.parse(payload);
    }
    const result = await generateWellnessResponse(payload);
    response.writeHead(200, { "Content-Type": "application/json" });
    response.end(JSON.stringify(result));
  } catch (error) {
    console.error("Vercel API Wellness failed:", error.message);
    response.writeHead(error instanceof SyntaxError ? 400 : 502, { "Content-Type": "application/json" });
    response.end(JSON.stringify({
      error: error instanceof SyntaxError
        ? "Invalid JSON request."
        : "Support is temporarily unavailable. Your journal remains on this device."
    }));
  }
}
