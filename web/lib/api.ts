import { api } from "./client";
import type {
  AnswerOut,
  CompanyCreatePayload,
  CompanyJoinRequestOut,
  CompanyJoinRequestWithUserOut,
  CompanyMyStateOut,
  CompanyOut,
  ChatMessageOut,
  DemandOrderCreatePayload,
  DemandOrderOut,
  EnterpriseSolutionCreatePayload,
  EnterpriseSolutionOut,
  FdeProjectRecordOut,
  FeedItemOut,
  LeaderboardOut,
  MeOut,
  OrderDeliveryOut,
  PmDesktopProductOut,
  OrderQuoteCreatePayload,
  OrderQuoteOut,
  Paginated,
  QuestionOut,
  TagOut,
  ToggleResponse,
  TutorialCreatePayload,
  TutorialDetailOut,
  TutorialOut,
  UploadOut,
  UserProfileOut,
  RequirementDraft,
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

// —— 咨詢公司 / 人與組織 ——

export function listCompanies(params: { page?: number; page_size?: number } = {}) {
  const qs = new URLSearchParams();
  if (params.page) qs.set("page", String(params.page));
  if (params.page_size) qs.set("page_size", String(params.page_size));
  const suffix = qs.toString() ? `?${qs.toString()}` : "";
  return api.get<Paginated<CompanyOut>>(`/companies${suffix}`);
}

export function getCompany(id: number) {
  return api.get<CompanyOut>(`/companies/${id}`);
}

export function createCompany(payload: CompanyCreatePayload) {
  return api.post<CompanyOut>("/companies", payload);
}

export function submitCompany(id: number) {
  return api.post<CompanyOut>(`/companies/${id}/submit`);
}

export function createCompanyJoinRequest(companyId: number) {
  return api.post<CompanyJoinRequestOut>(`/companies/${companyId}/join-requests`);
}

export function getMyCompanyState() {
  return api.get<CompanyMyStateOut>("/companies/me/state");
}

export function listCompanyJoinRequests(companyId: number, status = "pending") {
  const qs = status ? `?status=${encodeURIComponent(status)}` : "";
  return api.get<CompanyJoinRequestWithUserOut[]>(`/companies/${companyId}/join-requests${qs}`);
}

export function approveCompanyJoinRequest(companyId: number, requestId: number) {
  return api.post<{ id: number; company_id: number; user_id: number; status: string }>(
    `/companies/${companyId}/join-requests/${requestId}/approve`,
  );
}

export function rejectCompanyJoinRequest(companyId: number, requestId: number) {
  return api.post<CompanyJoinRequestOut>(`/companies/${companyId}/join-requests/${requestId}/reject`);
}

export function releaseCompanyLobsterKnight(companyId: number, userId: number) {
  return api.post<{ id: number; company_id: number; user_id: number; status: string; company_role: string }>(
    `/companies/${companyId}/members/${userId}/release`,
  );
}

export function listSolutions(params: { page?: number; page_size?: number; q?: string; category?: string; industry?: string; scenario?: string; sort?: "recommended" | "cases" } = {}) {
  const qs = new URLSearchParams();
  if (params.page) qs.set("page", String(params.page));
  if (params.page_size) qs.set("page_size", String(params.page_size));
  if (params.q) qs.set("q", params.q);
  if (params.category) qs.set("category", params.category);
  if (params.industry) qs.set("industry", params.industry);
  if (params.scenario) qs.set("scenario", params.scenario);
  if (params.sort) qs.set("sort", params.sort);
  const suffix = qs.toString() ? `?${qs.toString()}` : "";
  return api.get<Paginated<EnterpriseSolutionOut>>(`/solutions${suffix}`);
}

export function listHomeSolutions(limit = 3) {
  return api.get<EnterpriseSolutionOut[]>(`/solutions/home?limit=${limit}`);
}

export function getSolution(solutionId: number) {
  return api.get<EnterpriseSolutionOut>(`/solutions/${solutionId}`);
}

export function sendChatMessage(
  query: string,
  conversationId?: string | null,
  options: { intentConfirmed?: boolean; requirement?: RequirementDraft } = {},
) {
  return api.post<ChatMessageOut>("/chat/messages", {
    query,
    conversation_id: conversationId || undefined,
    intent_confirmed: options.intentConfirmed ?? false,
    requirement: options.requirement,
  });
}

export function listCompanySolutions(companyId: number, params: { page?: number; page_size?: number } = {}) {
  const qs = new URLSearchParams();
  if (params.page) qs.set("page", String(params.page));
  if (params.page_size) qs.set("page_size", String(params.page_size));
  const suffix = qs.toString() ? `?${qs.toString()}` : "";
  return api.get<Paginated<EnterpriseSolutionOut>>(`/companies/${companyId}/solutions${suffix}`);
}

export function createCompanySolution(companyId: number, payload: EnterpriseSolutionCreatePayload) {
  return api.post<EnterpriseSolutionOut>(`/companies/${companyId}/solutions`, payload);
}

export function submitCompanySolution(companyId: number, solutionId: number) {
  return api.post<EnterpriseSolutionOut>(`/companies/${companyId}/solutions/${solutionId}/submit`);
}

// —— 需求訂單 / 機會池 ——

export function createOrder(payload: DemandOrderCreatePayload) {
  return api.post<DemandOrderOut>("/orders", payload);
}

export function listPmDesktopProducts() {
  return api.get<Paginated<PmDesktopProductOut>>("/pmdesktop/products");
}

export function submitOrder(id: number) {
  return api.post<DemandOrderOut>(`/orders/${id}/submit`);
}

export function listMyOrders(params: { page?: number; page_size?: number } = {}) {
  const qs = new URLSearchParams();
  if (params.page) qs.set("page", String(params.page));
  if (params.page_size) qs.set("page_size", String(params.page_size));
  const suffix = qs.toString() ? `?${qs.toString()}` : "";
  return api.get<Paginated<DemandOrderOut>>(`/orders/me${suffix}`);
}

export function getOrder(id: number) {
  return api.get<DemandOrderOut>(`/orders/${id}`);
}

export function listOpportunities(params: { page?: number; page_size?: number } = {}) {
  const qs = new URLSearchParams();
  if (params.page) qs.set("page", String(params.page));
  if (params.page_size) qs.set("page_size", String(params.page_size));
  const suffix = qs.toString() ? `?${qs.toString()}` : "";
  return api.get<Paginated<DemandOrderOut>>(`/opportunities${suffix}`);
}

export function createOrderClaim(orderId: number, companyId: number, claimNote: string) {
  return api.post<DemandOrderOut>(`/orders/${orderId}/claims`, { company_id: companyId, claim_note: claimNote });
}

export function assignOrderFde(companyId: number, orderId: number, fdeUserId: number) {
  return api.post<DemandOrderOut>(`/companies/${companyId}/orders/${orderId}/assign-fde`, { fde_user_id: fdeUserId });
}

export function listCompanyOrders(companyId: number, params: { page?: number; page_size?: number; status?: string } = {}) {
  const qs = new URLSearchParams();
  if (params.page) qs.set("page", String(params.page));
  if (params.page_size) qs.set("page_size", String(params.page_size));
  if (params.status) qs.set("status", params.status);
  const suffix = qs.toString() ? `?${qs.toString()}` : "";
  return api.get<Paginated<DemandOrderOut>>(`/companies/${companyId}/orders${suffix}`);
}

export function createOrderQuote(companyId: number, orderId: number, payload: OrderQuoteCreatePayload) {
  return api.post<OrderQuoteOut>(`/companies/${companyId}/orders/${orderId}/quotes`, payload);
}

export function confirmOrderQuote(orderId: number) {
  return api.post<DemandOrderOut>(`/orders/${orderId}/confirm-quote`);
}

export function submitOrderDelivery(companyId: number, orderId: number, summary: string, deliverableUrls: string) {
  return api.post<OrderDeliveryOut>(`/companies/${companyId}/orders/${orderId}/deliveries`, {
    summary,
    deliverable_urls: deliverableUrls,
  });
}

export function acceptOrderDelivery(orderId: number, acceptanceNote: string) {
  return api.post<DemandOrderOut>(`/orders/${orderId}/accept-delivery`, { acceptance_note: acceptanceNote });
}

export function updateOrderWorkStatus(orderId: number, status: "following" | "completed") {
  return api.post<DemandOrderOut>(`/orders/${orderId}/work-status`, { status });
}

export function createOrderReview(
  orderId: number,
  payload: { target_type: "company" | "fde" | "delivery"; target_id: number; score: number; content?: string; is_public?: boolean },
) {
  return api.post<DemandOrderOut>(`/orders/${orderId}/reviews`, payload);
}

export function listUserProjectRecords(userId: number) {
  return api.get<FdeProjectRecordOut[]>(`/users/${userId}/project-records`);
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
