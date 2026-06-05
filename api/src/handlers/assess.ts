import type { APIGatewayProxyEventV2, APIGatewayProxyResultV2 } from "aws-lambda";
import { assessPronunciation } from "../lib/azureSpeech.js";
import {
  errorResponse,
  getAzureConfig,
  handleOptions,
  jsonResponse,
  parseJsonBody,
} from "../lib/response.js";

interface AssessRequest {
  text?: string;
  audioBase64?: string;
  contentType?: string;
}

export async function handler(event: APIGatewayProxyEventV2): Promise<APIGatewayProxyResultV2> {
  if (event.requestContext.http.method === "OPTIONS") return handleOptions();

  try {
    const body = parseJsonBody<AssessRequest>(event);
    if (!body.text?.trim()) return errorResponse(400, "text is required");
    if (!body.audioBase64) return errorResponse(400, "audioBase64 is required");

    const { key, region } = getAzureConfig();
    const audio = Buffer.from(body.audioBase64, "base64");
    const result = await assessPronunciation({
      key,
      region,
      text: body.text.trim(),
      audio,
      contentType: body.contentType ?? "audio/webm",
    });

    return jsonResponse(200, result);
  } catch (error) {
    const message = sanitizeAssessError(error);
    return errorResponse(500, message);
  }
}

function sanitizeAssessError(error: unknown): string {
  const message = error instanceof Error ? error.message : "評分失敗，請再試一次";
  if (message.includes("ffmpeg") || message.includes("Invalid data") || message.includes("EBML")) {
    return "錄音格式無法處理，請再試一次";
  }
  if (message.length > 160) return "評分失敗，請再試一次";
  return message;
}
