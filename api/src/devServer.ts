import { createServer } from "node:http";
import { config as loadEnv } from "dotenv";
import { resolve } from "node:path";
import type { APIGatewayProxyEventV2 } from "aws-lambda";
import { handler as assessHandler } from "./handlers/assess.js";
import { handler as dataHandler } from "./handlers/data.js";
import { handler as healthHandler } from "./handlers/health.js";
import { handler as ttsHandler } from "./handlers/tts.js";

loadEnv({ path: resolve(import.meta.dirname, "../../.env") });

function toEvent(
  method: string,
  path: string,
  body: string,
  headers: Record<string, string> = {},
): APIGatewayProxyEventV2 {
  return {
    version: "2.0",
    routeKey: `${method} ${path}`,
    rawPath: path,
    rawQueryString: "",
    headers: { "content-type": "application/json", ...headers },
    requestContext: {
      accountId: "local",
      apiId: "local",
      domainName: "localhost",
      domainPrefix: "localhost",
      http: {
        method,
        path,
        protocol: "HTTP/1.1",
        sourceIp: "127.0.0.1",
        userAgent: "dev",
      },
      requestId: "local",
      routeKey: `${method} ${path}`,
      stage: "$default",
      time: new Date().toISOString(),
      timeEpoch: Date.now(),
    },
    isBase64Encoded: false,
    body,
  };
}

async function readBody(req: import("node:http").IncomingMessage): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) chunks.push(chunk as Buffer);
  return Buffer.concat(chunks).toString("utf8");
}

function writeLambdaResponse(
  res: import("node:http").ServerResponse,
  result: { statusCode?: number; headers?: Record<string, string>; body?: string },
) {
  res.statusCode = result.statusCode ?? 200;
  for (const [key, value] of Object.entries(result.headers ?? {})) {
    res.setHeader(key, value);
  }
  res.end(result.body ?? "");
}

const routes: Record<string, (event: APIGatewayProxyEventV2) => Promise<unknown>> = {
  "GET /api/health": healthHandler,
  "POST /api/tts": ttsHandler,
  "POST /api/assess": assessHandler,
  "GET /api/sync": dataHandler,
  "POST /api/sync/merge": dataHandler,
  "GET /api/tags": dataHandler,
  "POST /api/tags": dataHandler,
  "GET /api/vocab": dataHandler,
  "POST /api/vocab": dataHandler,
  "POST /api/vocab/batch": dataHandler,
};

const port = Number(process.env.API_PORT ?? 3001);

createServer(async (req, res) => {
  const url = new URL(req.url ?? "/", `http://localhost:${port}`);
  const method = req.method ?? "GET";
  const key = `${method} ${url.pathname}`;

  if (method === "OPTIONS") {
    res.writeHead(204, {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
      "Access-Control-Allow-Methods": "GET,POST,PATCH,DELETE,OPTIONS",
    });
    res.end();
    return;
  }

  const dynamicHandler =
    /^\/api\/tags\/[^/]+$/.test(url.pathname) ||
    /^\/api\/vocab\/[^/]+$/.test(url.pathname) ||
    /^\/api\/vocab\/[^/]+\/practice$/.test(url.pathname)
      ? dataHandler
      : null;

  const handler = routes[key] ?? dynamicHandler;
  if (!handler) {
    res.writeHead(404, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: "Not found" }));
    return;
  }

  try {
    const body = ["POST", "PATCH", "PUT"].includes(method) ? await readBody(req) : undefined;
    const authHeader = req.headers.authorization ?? req.headers.Authorization;
    const headers: Record<string, string> = { "content-type": "application/json" };
    if (typeof authHeader === "string") headers.authorization = authHeader;
    const result = await handler(toEvent(method, url.pathname, body ?? "", headers));
    writeLambdaResponse(res, result as { statusCode?: number; headers?: Record<string, string>; body?: string });
  } catch (error) {
    res.writeHead(500, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: error instanceof Error ? error.message : "Server error" }));
  }
}).listen(port, () => {
  console.log(`EchoPhrase API listening on http://localhost:${port}`);
});
