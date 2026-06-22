import { OAuth2Client } from "google-auth-library";

let oauthClient: OAuth2Client | null = null;

function getOAuthClient(): OAuth2Client {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  if (!clientId) throw new Error("GOOGLE_CLIENT_ID is not configured");
  if (!oauthClient) oauthClient = new OAuth2Client(clientId);
  return oauthClient;
}

export interface AuthUser {
  id: string;
  email?: string;
  name?: string;
  picture?: string;
}

export async function verifyGoogleIdToken(idToken: string): Promise<AuthUser> {
  const ticket = await getOAuthClient().verifyIdToken({
    idToken,
    audience: process.env.GOOGLE_CLIENT_ID,
  });
  const payload = ticket.getPayload();
  if (!payload?.sub) throw new Error("Invalid Google token");
  return {
    id: payload.sub,
    email: payload.email,
    name: payload.name,
    picture: payload.picture,
  };
}

export function getBearerToken(authorizationHeader?: string): string | null {
  if (!authorizationHeader) return null;
  const match = /^Bearer\s+(.+)$/i.exec(authorizationHeader.trim());
  return match?.[1]?.trim() || null;
}
