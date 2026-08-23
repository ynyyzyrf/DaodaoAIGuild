import { api } from "./client";
import type {
  AnswerOut,
  FeedItemOut,
  LeaderboardOut,
  MeOut,
  Paginated,
  QuestionOut,
  TagOut,
  ToggleResponse,
  TutorialCreatePayload,
  TutorialDetailOut,
  TutorialOut,
  UploadOut,
  UserProfileOut,
} from "./types";

export type LeaderboardMetric = "reputation" | "tutorial" | "rescue";

export function getApiBase(): string {
  if (typeof window === "undefined") {
    // 服务端（SSR）：直连后端内部地址
    return `${process.env.API_INTERNAL_URL || "http://api:8000"}/api/v1`;
  }
  // 客户端：同源，由 Nginx 反向代理
  return "/api/v1";
}

export interface QuestionCreatePayload {
  title: string;
  description?: string;
  scenario?: string;
  tools?: string[];
  error_info?: string;
  tags?: string[];
  is_anonymous?: boolean;
  attachments?: string[];
}

// —— 问题 ——

export function listQuestions(params: { page?: number; page_size?: number; tag?: string } = {}) {
  const qs = new URLSearchParams();
  if (params.page) qs.set("page", String(params.page));
  if (params.page_size) qs.set("page_size", String(params.page_size));
  if (params.tag) qs.set("tag", params.tag);
  const suffix = qs.toString() ? `?${qs.toString()}` : "";
  return api.get<Paginated<QuestionOut>>(`/questions${suffix}`);
}

export function getQuestion(id: number) {
  return api.get<QuestionOut>(`/questions/${id}`);
}

export function createQuestion(payload: QuestionCreatePayload) {
  return api.post<QuestionOut>("/questions", payload);
}

export function createAnswer(questionId: number, content: string) {
  return api.post<AnswerOut>(`/questions/${questionId}/answers`, { content });
}

export function acceptAnswer(questionId: number, answerId: number) {
  return api.post<{ status: string }>(`/questions/${questionId}/accept`, { answer_id: answerId });
}

// —— 互动 ——

export function voteQuestion(id: number) {
  return api.post<ToggleResponse>(`/questions/${id}/vote`);
}

export function favoriteQuestion(id: number) {
  return api.post<ToggleResponse>(`/questions/${id}/favorite`);
}

export function voteAnswer(id: number) {
  return api.post<ToggleResponse>(`/answers/${id}/vote`);
}

export function favoriteAnswer(id: number) {
  return api.post<ToggleResponse>(`/answers/${id}/favorite`);
}

// —— 标签 ——

export function listTags() {
  return api.get<TagOut[]>("/tags");
}

// —— 教程（龍蝦学院）——

export function listCategories() {
  return api.get<string[]>("/tutorials/categories");
}

export function listTutorials(params: { page?: number; page_size?: number; category?: string } = {}) {
  const qs = new URLSearchParams();
  if (params.page) qs.set("page", String(params.page));
  if (params.page_size) qs.set("page_size", String(params.page_size));
  if (params.category) qs.set("category", params.category);
  const suffix = qs.toString() ? `?${qs.toString()}` : "";
  return api.get<Paginated<TutorialOut>>(`/tutorials${suffix}`);
}

export function getTutorial(slug: string) {
  return api.get<TutorialDetailOut>(`/tutorials/${slug}`);
}

export function createTutorial(payload: TutorialCreatePayload) {
  return api.post<TutorialDetailOut>("/tutorials", payload);
}

export function likeTutorial(id: number) {
  return api.post<ToggleResponse>(`/tutorials/${id}/like`);
}

// —— 上传 ——

export function uploadFile(file: File) {
  const form = new FormData();
  form.append("file", file);
  return api.post<UploadOut>("/uploads", form);
}

// —— 用户 / 排行榜 / 遊戲化 ——

export function getUserProfile(id: number) {
  return api.get<UserProfileOut>(`/users/${id}`);
}

export function getMyProfile() {
  return api.get<MeOut>("/users/me");
}

export function setCurrentTitle(titleCode: string) {
  return api.post<MeOut>("/users/me/title", { title_code: titleCode });
}

export function equipItem(equipmentCode: string) {
  return api.post<MeOut>(`/users/me/equipment/${equipmentCode}/equip`);
}

export function unequipItem(equipmentCode: string) {
  return api.post<MeOut>(`/users/me/equipment/${equipmentCode}/unequip`);
}

export function getUserQuestions(id: number) {
  return api.get<QuestionOut[]>(`/users/${id}/questions`);
}

export function getUserTutorials(id: number) {
  return api.get<TutorialOut[]>(`/users/${id}/tutorials`);
}

export function getLeaderboardByMetric(metric: LeaderboardMetric, limit = 8) {
  return api.get<LeaderboardOut[]>(`/users/leaderboard?metric=${metric}&limit=${limit}`);
}

// —— 首页 feed ——

export function getActivityFeed(limit = 6) {
  return api.get<FeedItemOut[]>(`/home/feed?limit=${limit}`);
}
