import { clearToken, getToken, notifyAuthChanged } from "./auth";
import type { ApiResponse } from "./types";

/** 业务码：登录态失效（token 过期 / 无效 / 用户被删）。命中后全局清掉登录态。 */
const AUTH_FAILURE_CODES = new Set([41001, 41002]);

export class ApiClientError extends Error {
  code: number;
  status: number;

  constructor(code: number, message: string, status: number) {
    super(message);
    this.code = code;
    this.status = status;
  }
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = getToken();
  const headers: Record<string, string> = {
    ...(options.headers as Record<string, string> | undefined),
  };
  // FormData 由浏览器自动带 boundary，显式设 Content-Type 会破坏它
  const isFormData = options.body instanceof FormData;
  if (options.body !== undefined && !isFormData) headers["Content-Type"] = "application/json";
  if (token) headers["Authorization"] = `Bearer ${token}`;

  const res = await fetch(`/api/v1${path}`, { ...options, headers });

  let body: ApiResponse<T>;
  try {
    body = await res.json();
  } catch {
    throw new ApiClientError(-1, `请求失败（HTTP ${res.status}）`, res.status);
  }

  // 登录态失效：清掉 localStorage + 通知 Nav 刷新 + 跳到登录页
  // 避免「点个人中心提示骑士不存在」类 stale localStorage 假象
  if (AUTH_FAILURE_CODES.has(body.code)) {
    clearToken();
    notifyAuthChanged();
    if (typeof window !== "undefined" && !window.location.pathname.startsWith("/login")) {
      const next = encodeURIComponent(window.location.pathname + window.location.search);
      window.location.assign(`/login?next=${next}`);
    }
  }

  if (body.code !== 0) {
    throw new ApiClientError(body.code, body.message, res.status);
  }
  return body.data;
}

export const api = {
  get: <T>(path: string) => request<T>(path, { method: "GET" }),
  post: <T>(path: string, data?: unknown) =>
    request<T>(path, {
      method: "POST",
      body:
        data === undefined
          ? undefined
          : data instanceof FormData
            ? data
            : JSON.stringify(data),
    }),
  patch: <T>(path: string, data?: unknown) =>
    request<T>(path, {
      method: "PATCH",
      body: data === undefined ? undefined : JSON.stringify(data),
    }),
  del: <T>(path: string, data?: unknown) =>
    request<T>(path, {
      method: "DELETE",
      body: data === undefined ? undefined : JSON.stringify(data),
    }),
};
