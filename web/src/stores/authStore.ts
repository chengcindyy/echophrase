import { defineStore } from "pinia";
import { computed, ref } from "vue";
import { mergeSyncData, fetchSyncData } from "@/api/sync";
import { setCloudData, clearCloudData } from "@/repositories/cloudCache";
import { bumpRepositoryRevision } from "@/repositories/repositoryRevision";
import { loadLocalTags, loadLocalVocab } from "@/repositories/local/localStorageData";
import type { Tag, VocabItem } from "@/types";

const TOKEN_KEY = "echophrase:auth:token";
const USER_KEY = "echophrase:auth:user";

export interface AuthUser {
  id: string;
  email?: string;
  name?: string;
  picture?: string;
}

function decodeTokenExpiryMs(token: string): number | null {
  try {
    const payload = JSON.parse(atob(token.split(".")[1] ?? "")) as { exp?: number };
    return payload.exp ? payload.exp * 1000 : null;
  } catch {
    return null;
  }
}

function isTokenValid(token: string): boolean {
  const expiry = decodeTokenExpiryMs(token);
  if (!expiry) return false;
  return Date.now() < expiry - 60_000;
}

function persistSession(token: string, user: AuthUser): void {
  sessionStorage.setItem(TOKEN_KEY, token);
  sessionStorage.setItem(USER_KEY, JSON.stringify(user));
}

function clearSessionStorage(): void {
  sessionStorage.removeItem(TOKEN_KEY);
  sessionStorage.removeItem(USER_KEY);
}

function readStoredUser(): AuthUser | null {
  try {
    const raw = sessionStorage.getItem(USER_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as AuthUser;
  } catch {
    return null;
  }
}

export const useAuthStore = defineStore("auth", () => {
  const idToken = ref<string | null>(null);
  const user = ref<AuthUser | null>(null);
  const syncing = ref(false);
  const syncError = ref<string | null>(null);
  const ready = ref(false);

  const isAuthenticated = computed(() => Boolean(idToken.value && user.value));

  async function applyCloudData(tags: Tag[], vocab: VocabItem[]): Promise<void> {
    setCloudData(tags, vocab);
  }

  async function loadCloudData(token: string): Promise<void> {
    const data = await fetchSyncData(token);
    await applyCloudData(data.tags, data.vocab);
  }

  async function mergeLocalIntoCloud(token: string): Promise<void> {
    const localTags = loadLocalTags();
    const localVocab = loadLocalVocab();
    const merged = await mergeSyncData(token, localTags, localVocab);
    await applyCloudData(merged.tags, merged.vocab);
  }

  async function establishSession(token: string, nextUser: AuthUser, mergeLocal: boolean): Promise<void> {
    syncing.value = true;
    syncError.value = null;
    idToken.value = token;
    user.value = nextUser;
    persistSession(token, nextUser);

    try {
      if (mergeLocal) {
        await mergeLocalIntoCloud(token);
      } else {
        await loadCloudData(token);
      }
    } catch (error) {
      idToken.value = null;
      user.value = null;
      clearSessionStorage();
      clearCloudData();
      syncError.value = error instanceof Error ? error.message : "同步失敗";
      throw error;
    } finally {
      syncing.value = false;
      ready.value = true;
      bumpRepositoryRevision();
    }
  }

  async function signInWithCredential(token: string, nextUser: AuthUser): Promise<void> {
    const hasLocalData = loadLocalTags().length > 0 || loadLocalVocab().length > 0;
    const mergeLocal =
      hasLocalData &&
      confirm("偵測到本機詞庫，是否合併上傳到 Google 帳號？\n\n確定 = 合併上傳\n取消 = 只使用雲端資料");
    await establishSession(token, nextUser, mergeLocal);
  }

  function signOut(): void {
    idToken.value = null;
    user.value = null;
    syncError.value = null;
    clearSessionStorage();
    clearCloudData();
    bumpRepositoryRevision();
  }

  async function restoreSession(): Promise<void> {
    const storedToken = sessionStorage.getItem(TOKEN_KEY);
    const storedUser = readStoredUser();
    if (!storedToken || !storedUser || !isTokenValid(storedToken)) {
      clearSessionStorage();
      ready.value = true;
      return;
    }

    try {
      await establishSession(storedToken, storedUser, false);
    } catch {
      signOut();
      ready.value = true;
    }
  }

  function getToken(): string | null {
    if (!idToken.value || !isTokenValid(idToken.value)) return null;
    return idToken.value;
  }

  return {
    idToken,
    user,
    syncing,
    syncError,
    ready,
    isAuthenticated,
    signInWithCredential,
    signOut,
    restoreSession,
    getToken,
  };
});
