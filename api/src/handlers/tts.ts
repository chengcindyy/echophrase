import type { APIGatewayProxyEventV2, APIGatewayProxyResultV2 } from "aws-lambda";
import { synthesizeSpeech } from "../lib/azureSpeech.js";
import {
  errorResponse,
  getAzureConfig,
  handleOptions,
  jsonResponse,
  parseJsonBody,
} from "../lib/response.js";

interface TtsRequest {
  text?: string;
  voice?: string;
  rate?: number;
}

export async function handler(event: APIGatewayProxyEventV2): Promise<APIGatewayProxyResultV2> {
  if (event.requestContext.http.method === "OPTIONS") return handleOptions();

  try {
    const body = parseJsonBody<TtsRequest>(event);
    if (!body.text?.trim()) return errorResponse(400, "text is required");

    const { key, region } = getAzureConfig();
    const result = await synthesizeSpeech({
      key,
      region,
      text: body.text.trim(),
      voice: body.voice ?? "fr-FR-DeniseNeural",
      rate: body.rate ?? 1,
    });

    return jsonResponse(200, result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "TTS failed";
    return errorResponse(500, message);
  }
}
