export interface UserOut {
  id: number;
  username: string;
  display_name: string;
  avatar_url: string;
  bio: string;
  level: number;
  reputation: number;
  is_admin: boolean;
  created_at: string;
}

export type Rarity = "common" | "rare" | "epic" | "legendary";

export interface AchievementOut {
  code: string;
  name: string;
  description: string;
  icon: string;
  rarity: Rarity;
  unlocked: boolean;
  unlocked_at: string | null;
}

export interface TitleOut {
  code: string;
  name: string;
  description: string;
  icon: string;
  rarity: Rarity;
  unlocked: boolean;
  unlocked_at: string | null;
  is_current: boolean;
}

export interface EquipmentOut {
  code: string;
  name: string;
  slot: string;
  rarity: Rarity;
  description: string;
  unlocked: boolean;
  unlocked_at: string | null;
  is_equipped: boolean;
}

export interface RecentUnlockOut {
  kind: "achievement" | "title" | "equipment";
  code: string;
  name: string;
  icon: string;
  rarity: Rarity;
  unlocked_at: string;
}

export interface UserProfileOut extends UserOut {
  questions_count: number;
  answers_count: number;
  tutorials_count: number;
  accepted_count: number;
  completed_orders_count: number;
  exp: number;
  current_title: TitleOut | null;
  achievements: AchievementOut[];
  titles: TitleOut[];
  equipment: EquipmentOut[];
}

export interface MeOut extends UserProfileOut {
  recent_unlocks: RecentUnlockOut[];
}

export interface AttachmentOut {
  id: number;
  kind: string;
  url: string;
  size: number;
  mime_type: string;
  created_at: string;
}

export interface UploadOut {
  url: string;
  kind: string;
  size: number;
  mime_type: string;
}

export interface AnswerOut {
  id: number;
  question_id: number;
  author_id: number;
  content: string;
  is_accepted: boolean;
  created_at: string;
  updated_at: string;
  author: UserOut | null;
  vote_count: number;
}

export interface QuestionOut {
  id: number;
  author_id: number;
  title: string;
  description: string;
  scenario: string;
  tools: string[];
  error_info: string;
  status: string;
  is_anonymous: boolean;
  view_count: number;
  created_at: string;
  updated_at: string;
  author: UserOut | null;
  tags: string[];
  answer_count: number;
  vote_count: number;
  answers: AnswerOut[];
  attachments: AttachmentOut[];
}

export interface TagOut {
  id: number;
  name: string;
  slug: string;
}

export interface Paginated<T> {
  items: T[];
  total: number;
  page: number;
  page_size: number;
}

export interface ApiResponse<T> {
  code: number;
  message: string;
  data: T;
}

export interface ToggleResponse {
  active: boolean;
  count: number;
}

export interface TutorialOut {
  id: number;
  author_id: number;
  title: string;
  slug: string;
  summary: string;
  category: string;
  status: string;
  video_url: string | null;
  video_provider: string | null;
  video_embed_url: string | null;
  video_title: string | null;
  video_thumbnail_url: string | null;
  view_count: number;
  like_count: number;
  created_at: string;
  updated_at: string;
  author: UserOut | null;
}

export interface TutorialDetailOut extends TutorialOut {
  content: string;
}

export interface TutorialCreatePayload {
  title: string;
  summary?: string;
  content: string;
  category: string;
  video_url?: string;
  video_title?: string;
}

export interface CompanyMemberUserOut {
  id: number;
  username: string;
  display_name: string;
  avatar_url: string;
  company_role: "owner" | "admin" | "none" | string;
  fde_status: "none" | "active" | "released" | string;
}

export interface CompanyMembersOut {
  owner: CompanyMemberUserOut | null;
  admins: CompanyMemberUserOut[];
  lobster_knights: CompanyMemberUserOut[];
}

export interface CompanyOut {
  id: number;
  applicant_id: number;
  name: string;
  logo_url: string;
  description: string;
  location: string;
  contact_name: string;
  contact_email: string;
  service_fields: string;
  strengths: string;
  cases: string;
  status: string;
  review_note: string;
  lobster_knight_count: number;
  members: CompanyMembersOut;
  created_at: string;
  updated_at: string;
}

export interface CompanyCreatePayload {
  name: string;
  logo_url?: string;
  description?: string;
  location?: string;
  contact_name?: string;
  contact_email?: string;
  service_fields?: string;
  strengths?: string;
  cases?: string;
}

export interface CompanyJoinRequestOut {
  id: number;
  company_id: number;
  user_id: number;
  status: string;
  requested_at: string;
  processed_at: string | null;
  processed_by: number | null;
}

export interface CompanyJoinRequestUserOut {
  id: number;
  username: string;
  display_name: string;
  avatar_url: string;
}

export interface CompanyJoinRequestWithUserOut extends CompanyJoinRequestOut {
  user: CompanyJoinRequestUserOut;
}

export interface CompanyMyStateOut {
  active_company: CompanyOut | null;
  pending_join_request: CompanyJoinRequestOut | null;
  managed_companies: CompanyOut[];
}

export interface EnterpriseSolutionOut {
  id: number;
  company_id: number;
  company_name: string;
  creator_id: number;
  title: string;
  subtitle: string;
  category: string;
  industry: string;
  scenario: string;
  delivery_cycle: string;
  budget_range: string;
  cover_image_url: string;
  tags: string[];
  case_count: number;
  status: string;
  review_note: string;
  created_at: string;
  updated_at: string;
}

export interface EnterpriseSolutionCreatePayload {
  title: string;
  subtitle?: string;
  category?: string;
  industry?: string;
  scenario?: string;
  delivery_cycle?: string;
  budget_range?: string;
  cover_image_url?: string;
  tags?: string[];
  case_count?: number;
}

export interface DemandOrderOut {
  id: number;
  creator_id: number;
  enterprise_name: string;
  contact_name: string;
  contact_email: string;
  product_name: string;
  pmdesktop_product_id: string;
  pmdesktop_sync_status: string;
  pmdesktop_requirement_id: string;
  pmdesktop_user_voice_id: string;
  pmdesktop_sync_error: string;
  pmdesktop_synced_at: string | null;
  budget_amount: number;
  budget_note: string;
  expected_delivery_at: string | null;
  title: string;
  description: string;
  business_background: string;
  deliverable_expectation: string;
  attachments: string;
  status: string;
  review_note: string;
  reviewed_by: number | null;
  reviewed_at: string | null;
  claimed_company_id: number | null;
  claimed_company_name: string;
  assigned_fde_user_id: number | null;
  created_at: string;
  updated_at: string;
}

export interface DemandOrderCreatePayload {
  enterprise_name: string;
  contact_name?: string;
  contact_email?: string;
  product_name?: string;
  pmdesktop_product_id?: string;
  budget_amount?: number;
  budget_note?: string;
  expected_delivery_at?: string | null;
  title: string;
  description?: string;
  business_background?: string;
  deliverable_expectation?: string;
  attachments?: string;
}

export interface RequirementDraft {
  enterprise_name: string;
  contact_name: string;
  contact_email: string;
  product_name: string;
  title: string;
  description: string;
  business_background: string;
  deliverable_expectation: string;
  budget_note: string;
  expected_delivery_at: string | null;
}

export interface ChatMessageOut {
  answer: string;
  conversation_id: string | null;
  message_id: string | null;
  action: "open_requirement_form" | null;
  requirement_draft: RequirementDraft | null;
}

export interface PmDesktopProductOut {
  id: string;
  name: string;
  status: string;
}

export interface OrderClaimOut {
  id: number;
  order_id: number;
  company_id: number;
  operator_user_id: number;
  status: string;
  claim_note: string;
  created_at: string;
  updated_at: string;
}

export interface OrderQuoteCreatePayload {
  amount?: number;
  currency?: string;
  start_at?: string | null;
  delivery_at?: string | null;
  scope?: string;
  deliverables?: string;
  exclusions?: string;
  risks?: string;
  enterprise_dependencies?: string;
}

export interface OrderQuoteOut extends OrderQuoteCreatePayload {
  id: number;
  order_id: number;
  company_id: number;
  amount: number;
  currency: string;
  owner_user_id: number;
  status: string;
  created_at: string;
  updated_at: string;
}

export interface OrderDeliveryOut {
  id: number;
  order_id: number;
  company_id: number;
  submitted_by: number;
  summary: string;
  deliverable_urls: string;
  status: string;
  acceptance_note: string;
  accepted_by: number | null;
  accepted_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface FdeProjectRecordOut {
  id: number;
  order_id: number;
  fde_user_id: number;
  company_id: number;
  project_title: string;
  product_name: string;
  role: string;
  skill_tags: string;
  enterprise_score: number | null;
  company_score: number | null;
  is_public_case: boolean;
  completed_at: string | null;
  created_at: string;
}

/** 首页「社區正在發生」单条动态。 */
export interface FeedItemOut {
  kind: "question" | "tutorial" | "rescue";
  id: number;
  slug: string;
  title: string;
  author: UserOut | null;
  created_at: string;
}

/** 騎士排行榜条目：在基础身份上附加本榜项数值与擅長領域标签。 */
export interface LeaderboardOut extends UserOut {
  metric_value: number;
  top_tags: string[];
}

// ── Agent Room v0.1（docs/3.3.md）────────────────────────────────────────

export interface AgentOut {
  id: string; // public id (agt_xxx)
  owner_id: number;
  agent_type: string;
  display_name: string;
  avatar_url: string | null;
  status: "pending" | "online" | "offline" | "revoked";
  visibility: string;
  last_seen_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface RoomOut {
  id: string; // public id (room_xxx)
  name: string;
  description: string;
  owner_id: number;
  privacy: string;
  created_at: string;
  updated_at: string;
}

export interface RoomMemberOut {
  type: "user" | "agent";
  id: string;
  name: string;
  avatar_url: string | null;
  role: string;
  is_online: boolean;
  is_owner: boolean;
}

export interface RoomDetailOut extends RoomOut {
  members: RoomMemberOut[];
  is_member: boolean;
  is_owner: boolean;
}

export interface MessageSenderOut {
  type: "user" | "agent";
  id: string;
  name: string;
  avatar_url: string | null;
}

export interface RoomMessageOut {
  id: string; // public msg_xxx
  room_id: string;
  sender: MessageSenderOut;
  content: string;
  reply_to_message_id: string | null;
  mentioned_agent_ids: number[];
  created_at: string;
}

/** 人類 WSS /api/v1/ws/rooms 推下來的即時事件。 */
export interface WsRoomEvent {
  type: "room.message" | "room.typing" | "room.subscribed" | "error" | "pong";
  room_id?: string;
  message?: RoomMessageOut;
  agent_name?: string;
  status?: boolean;
  code?: string;
  message_text?: string;
}
