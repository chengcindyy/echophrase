function resolveApiBase(): string {
  // Production always uses same-origin /api/* (CloudFront → API Gateway).
  if (import.meta.env.PROD) return "";
  const configured = import.meta.env.VITE_API_BASE_URL?.replace(/\/$/, "") ?? "";
  return configured || "";
}

const API_BASE = resolveApiBase();

function apiUrl(path: string): string {
  if (API_BASE) return `${API_BASE}${path}`;
  return path;
}

export function apiEndpoint(path: string): string {
  return apiUrl(path);
}

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

async function parseJson<T>(res: Response): Promise<T> {
  if (!res.ok) {
    let message = res.statusText;
    try {
      const body = (await res.json()) as { error?: string };
      if (body.error) message = body.error;
    } catch {
      // ignore
    }
    throw new ApiError(message, res.status);
  }
  return res.json() as Promise<T>;
}

export async function healthCheck(): Promise<{ ok: boolean }> {
  const res = await fetch(apiUrl("/api/health"));
  return parseJson(res);
}

export async function fetchTts(params: {
  text: string;
  voice?: string;
  rate?: number;
}): Promise<{ audioBase64: string; contentType: string }> {
  const res = await fetch(apiUrl("/api/tts"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(params),
  });
  return parseJson(res);
}

export async function assessPronunciation(params: {
  text: string;
  audioBase64: string;
  contentType: string;
}): Promise<import("@/types").AssessResult> {
  const res = await fetch(apiUrl("/api/assess"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(params),
  });
  return parseJson(res);
}

export { playBase64Audio, playObjectUrl } from "@/lib/audioPlayback";
