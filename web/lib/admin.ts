/** 管理后台 API 客户端（docs/3.2.md §9）。
 *
 * 独立 fetch：使用 admin_token，401/403 由调用方处理（不触发前台 login 跳转）。
 */
import { clearAdminSession, getAdminToken } from "./admin-auth";

export class AdminApiError extends Error {
  code: number;
  status: number;

  constructor(code: number, message: string, status: number) {
    super(message);
    this.code = code;
    this.status = status;
  }
}

async function adminRequest<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = getAdminToken();
  const headers: Record<string, string> = {
    ...(options.headers as Record<string, string> | undefined),
  };
  if (options.body !== undefined) headers["Content-Type"] = "application/json";
  if (token) headers["Authorization"] = `Bearer ${token}`;

  const res = await fetch(`/api/v1/admin${path}`, { ...options, headers });

  let body: { code: number; message: string; data: T };
  try {
    body = await res.json();
  } catch {
    throw new AdminApiError(-1, `请求失败（HTTP ${res.status}）`, res.status);
  }

  // 登录态失效（401 / token 过期）：清登录态并跳回后台登录页
  if (res.status === 401 || body.code === 41001 || body.code === 41002) {
    if (typeof window !== "undefined" && !window.location.pathname.startsWith("/admin/login")) {
      clearAdminSession();
      window.location.assign("/admin/login");
    }
    throw new AdminApiError(body.code, body.message, res.status);
  }

  if (body.code !== 0) {
    throw new AdminApiError(body.code, body.message, res.status);
  }
  return body.data;
}

export const adminApi = {
  get: <T>(path: string) => adminRequest<T>(path, { method: "GET" }),
  post: <T>(path: string, data?: unknown) =>
    adminRequest<T>(path, { method: "POST", body: data === undefined ? undefined : JSON.stringify(data) }),
  patch: <T>(path: string, data?: unknown) =>
    adminRequest<T>(path, { method: "PATCH", body: data === undefined ? undefined : JSON.stringify(data) }),
  del: <T>(path: string) => adminRequest<T>(path, { method: "DELETE" }),
};
