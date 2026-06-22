import { useAuthStore } from "@/stores/authStore";

interface GoogleCredentialResponse {
  credential: string;
}

interface GoogleIdPayload {
  sub: string;
  email?: string;
  name?: string;
  picture?: string;
}

function decodeIdPayload(token: string): GoogleIdPayload {
  return JSON.parse(atob(token.split(".")[1] ?? "")) as GoogleIdPayload;
}

function waitForGoogleIdentity(): Promise<void> {
  if (window.google?.accounts?.id) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const started = Date.now();
    const timer = window.setInterval(() => {
      if (window.google?.accounts?.id) {
        clearInterval(timer);
        resolve();
        return;
      }
      if (Date.now() - started > 10_000) {
        clearInterval(timer);
        reject(new Error("Google 登入元件載入逾時"));
      }
    }, 100);
  });
}

export async function mountGoogleSignInButton(container: HTMLElement): Promise<void> {
  const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;
  if (!clientId) throw new Error("VITE_GOOGLE_CLIENT_ID 未設定");

  await waitForGoogleIdentity();
  const authStore = useAuthStore();

  window.google!.accounts.id.initialize({
    client_id: clientId,
    callback: async (response: GoogleCredentialResponse) => {
      const payload = decodeIdPayload(response.credential);
      await authStore.signInWithCredential(response.credential, {
        id: payload.sub,
        email: payload.email,
        name: payload.name,
        picture: payload.picture,
      });
    },
  });

  container.replaceChildren();
  window.google!.accounts.id.renderButton(container, {
    type: "standard",
    theme: "outline",
    size: "large",
    shape: "pill",
    text: "signin_with",
    width: 280,
  });
}
