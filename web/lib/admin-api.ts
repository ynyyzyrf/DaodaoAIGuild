/** 管理后台 API 类型与接口（docs/3.2.md）。 */
import { adminApi } from "./admin";
import type { Paginated } from "./types";

// ---------- 类型 ----------

export interface AdminUser {
  id: number;
  username: string;
  display_name: string;
  avatar_url: string;
  bio: string;
  level: number;
  reputation: number;
  exp: number;
  is_admin: boolean;
  is_active: boolean;
  is_verified_fde: boolean;
  created_at: string;
  updated_at: string;
}

export interface AdminUserDetail extends AdminUser {
  questions_count: number;
  answers_count: number;
  tutorials_count: number;
  accepted_count: number;
}

export interface AuditLog {
  id: number;
  admin_id: number;
  action: string;
  target_type: string;
  target_id: number | null;
  before_value: Record<string, unknown> | null;
  after_value: Record<string, unknown> | null;
  reason: string;
  ip: string | null;
  created_at: string;
}

export interface SensitiveWord {
  id: number;
  word: string;
  category: string | null;
  action: "warn" | "auto_hide";
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface ModerationItem {
  target_type: "question" | "answer" | "tutorial";
  target_id: number;
  title: string;
  author_id: number;
  author_name: string;
  status: string;
  trigger_reason: string; // report / sensitive / pre_review
  created_at: string;
  view_count: number;
  like_count: number;
  report_count: number;
  matched_words: string[];
}

export interface ModerationDetail {
  target_type: string;
  target_id: number;
  title: string;
  content: string;
  author_id: number;
  author_name: string;
  status: string;
  created_at: string;
  trigger_reason: string;
  reports: { reporter_id: number; reporter_name: string; reason: string; created_at: string }[];
  matched_words: string[];
}

export interface AdminMission {
  id: number;
  title: string;
  status: string;
  difficulty: string;
  reward: string;
  creator_id: number;
  assignee_id: number | null;
  created_at: string;
  updated_at: string;
}

export interface DashboardData {
  pending_tutorials: number;
  today_new_questions: number;
  today_new_answers: number;
  today_new_tutorials: number;
  in_progress_missions: number;
  active_knights_7d: number;
  trend: { date: string; questions: number; answers: number; tutorials: number }[];
  alerts: { zero_answer_questions: number; overdue_missions: number };
}

// ---------- 登录 ----------

export async function adminLogin(username: string, password: string) {
  const data = await adminApi.post<{ access_token: string; user: AdminUser }>("/auth/login", {
    username,
    password,
  });
  return data;
}

// ---------- 仪表板 ----------

export function getDashboard() {
  return adminApi.get<DashboardData>("/dashboard");
}

// ---------- 用户 ----------

export interface UserListParams {
  page?: number;
  page_size?: number;
  level?: number;
  is_active?: boolean;
  q?: string;
  active_days?: number;
}

export function listAdminUsers(params: UserListParams = {}) {
  const qs = new URLSearchParams();
  if (params.page) qs.set("page", String(params.page));
  if (params.page_size) qs.set("page_size", String(params.page_size));
  if (params.level) qs.set("level", String(params.level));
  if (params.is_active !== undefined) qs.set("is_active", String(params.is_active));
  if (params.q) qs.set("q", params.q);
  if (params.active_days) qs.set("active_days", String(params.active_days));
  const suffix = qs.toString() ? `?${qs.toString()}` : "";
  return adminApi.get<Paginated<AdminUser>>(`/users${suffix}`);
}

export function getAdminUser(id: number) {
  return adminApi.get<AdminUserDetail>(`/users/${id}`);
}

export function updateAdminUser(id: number, data: Record<string, unknown>) {
  return adminApi.patch<AdminUser>(`/users/${id}`, data);
}

export function resetAdminUserPassword(id: number) {
  return adminApi.post<{ username: string; new_password: string }>(`/users/${id}/reset-password`);
}

// ---------- 审核 ----------

export interface ModerationParams {
  page?: number;
  page_size?: number;
  target_type?: string;
  status?: string;
}

export function listModeration(params: ModerationParams = {}) {
  const qs = new URLSearchParams();
  if (params.page) qs.set("page", String(params.page));
  if (params.page_size) qs.set("page_size", String(params.page_size));
  if (params.target_type) qs.set("target_type", params.target_type);
  if (params.status) qs.set("status", params.status);
  const suffix = qs.toString() ? `?${qs.toString()}` : "";
  return adminApi.get<Paginated<ModerationItem>>(`/moderation${suffix}`);
}

export function getModerationDetail(targetType: string, targetId: number) {
  return adminApi.get<ModerationDetail>(`/moderation/${targetType}/${targetId}`);
}

export function moderationAction(
  targetType: string,
  targetId: number,
  action: "approve" | "hide" | "delete" | "reject",
  reason: string,
) {
  return adminApi.post<Record<string, unknown>>(`/moderation/${targetType}/${targetId}/${action}`, {
    reason,
  });
}

// ---------- 任务 ----------

export function listAdminMissions(params: { page?: number; status?: string; difficulty?: string } = {}) {
  const qs = new URLSearchParams();
  if (params.page) qs.set("page", String(params.page));
  if (params.status) qs.set("status", params.status);
  if (params.difficulty) qs.set("difficulty", params.difficulty);
  const suffix = qs.toString() ? `?${qs.toString()}` : "";
  return adminApi.get<Paginated<AdminMission>>(`/missions${suffix}`);
}

export function updateAdminMission(id: number, data: Record<string, unknown>) {
  return adminApi.patch<AdminMission>(`/missions/${id}`, data);
}

// ---------- 敏感词 ----------

export function listSensitiveWords(params: { page?: number; is_active?: boolean } = {}) {
  const qs = new URLSearchParams();
  if (params.page) qs.set("page", String(params.page));
  if (params.is_active !== undefined) qs.set("is_active", String(params.is_active));
  const suffix = qs.toString() ? `?${qs.toString()}` : "";
  return adminApi.get<Paginated<SensitiveWord>>(`/sensitive-words${suffix}`);
}

export function createSensitiveWord(data: { word: string; category?: string; action: string }) {
  return adminApi.post<SensitiveWord>("/sensitive-words", data);
}

export function updateSensitiveWord(id: number, data: Record<string, unknown>) {
  return adminApi.patch<SensitiveWord>(`/sensitive-words/${id}`, data);
}

export function deleteSensitiveWord(id: number) {
  return adminApi.del<{ status: string }>(`/sensitive-words/${id}`);
}

export function importSensitiveWords(data: { words: string[]; category?: string; action: string }) {
  return adminApi.post<{ added: number; duplicates: number }>("/sensitive-words/import", data);
}

// ---------- 稽核日志 ----------

export function listAuditLogs(params: { page?: number; page_size?: number; admin_id?: number; target_type?: string } = {}) {
  const qs = new URLSearchParams();
  if (params.page) qs.set("page", String(params.page));
  if (params.page_size) qs.set("page_size", String(params.page_size));
  if (params.admin_id) qs.set("admin_id", String(params.admin_id));
  if (params.target_type) qs.set("target_type", params.target_type);
  const suffix = qs.toString() ? `?${qs.toString()}` : "";
  return adminApi.get<Paginated<AuditLog>>(`/audit-logs${suffix}`);
}
