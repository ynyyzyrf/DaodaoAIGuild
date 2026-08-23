export function getToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("token");
}

export function setToken(token: string) {
  localStorage.setItem("token", token);
}

export function clearToken() {
  localStorage.removeItem("token");
  localStorage.removeItem("user");
}

const AUTH_CHANGE_EVENT = "daodao:auth-change";

/** 登录/登出后通知常驻组件（如 Nav）刷新登录态。 */
export function notifyAuthChanged() {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event(AUTH_CHANGE_EVENT));
}

/** 订阅登录态变更，返回取消订阅函数。 */
export function subscribeAuth(cb: () => void): () => void {
  if (typeof window === "undefined") return () => {};
  window.addEventListener(AUTH_CHANGE_EVENT, cb);
  return () => window.removeEventListener(AUTH_CHANGE_EVENT, cb);
}

export interface CurrentUser {
  id: number;
  username: string;
  display_name: string;
  level?: number;
  reputation?: number;
  avatar_url?: string;
  bio?: string;
  [key: string]: unknown;
}

export function getCurrentUser(): CurrentUser | null {
  if (typeof window === "undefined") return null;
  const raw = localStorage.getItem("user");
  if (!raw) return null;
  try {
    return JSON.parse(raw) as CurrentUser;
  } catch {
    return null;
  }
}

export function isLoggedIn(): boolean {
  return getToken() !== null;
}
