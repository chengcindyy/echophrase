import type { APIGatewayProxyEventV2, APIGatewayProxyResultV2 } from "aws-lambda";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type",
  "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
};

export function jsonResponse(statusCode: number, body: unknown): APIGatewayProxyResultV2 {
  return {
    statusCode,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  };
}

export function errorResponse(statusCode: number, message: string): APIGatewayProxyResultV2 {
  return jsonResponse(statusCode, { error: message });
}

export function parseJsonBody<T>(event: APIGatewayProxyEventV2): T {
  if (!event.body) throw new Error("Missing request body");
  return JSON.parse(event.body) as T;
}

export function handleOptions(): APIGatewayProxyResultV2 {
  return {
    statusCode: 204,
    headers: corsHeaders,
  };
}

export function getAzureConfig() {
  const key = process.env.AZURE_SPEECH_KEY;
  const region = process.env.AZURE_SPEECH_REGION ?? "eastus";
  if (!key) throw new Error("AZURE_SPEECH_KEY is not configured");
  return { key, region };
}
