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
