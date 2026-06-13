export default function handler(request, response) {
  if (request.method !== "GET") {
    response.writeHead(405).end("Method Not Allowed");
    return;
  }
  response.writeHead(200, { "Content-Type": "application/json" });
  response.end(JSON.stringify({
    ok: true,
    aiConfigured: Boolean(process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY),
    provider: "gemini"
  }));
}
