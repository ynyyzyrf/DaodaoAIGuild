/** 管理后台登录态：复用前台登录态（docs/3.2.md §3）。
 *
 * 管理员在前台登录后即拥有后台权限（后端 require_admin 校验 is_admin），
 * 无需再次登录。本模块仅做类型包装，底层存储与前台完全一致。
 */
import {
  clearToken,
  getCurrentUser,
  getToken,
  notifyAuthChanged,
  setToken,
} from "./auth";

export function getAdminToken(): string | null {
  return getToken();
}

export function setAdminSession(token: string, user: unknown) {
  setToken(token);
  localStorage.setItem("user", JSON.stringify(user));
  notifyAuthChanged();
}

/** 退出后台：仅清登录态（回到前台登录页），不影响内容。 */
export function clearAdminSession() {
  clearToken();
  notifyAuthChanged();
}

export function getAdminUser<T>(): T | null {
  return getCurrentUser() as T | null;
}
