"use client";

interface AvatarUser {
  display_name?: string;
  username?: string;
  avatar_url?: string;
}

interface AvatarProps {
  user: AvatarUser | null;
  /** 匿名騎士：顯示 🦞 龍蝦身份頭像 */
  isAnon?: boolean;
  size?: number;
  className?: string;
}

/** 簡潔圓形頭像：有圖用圖，無圖用首字母；匿名騎士用 🦞 品牌淺底。 */
export default function Avatar({
  user,
  isAnon = false,
  size = 36,
  className = "",
}: AvatarProps) {
  const name = user?.display_name || user?.username || "";
  const initial = (name.trim().charAt(0) || "?").toUpperCase();
  const style = { width: size, height: size };

  if (isAnon) {
    return (
      <span
        title="龍蝦騎士（匿名）"
        style={style}
        className={`inline-flex shrink-0 items-center justify-center rounded-full bg-brand-50 text-lg ring-1 ring-inset ring-brand-200 ${className}`}
      >
        🦞
      </span>
    );
  }

  if (user?.avatar_url) {
    return (
      <span
        style={style}
        className={`inline-flex shrink-0 overflow-hidden rounded-full ring-1 ring-inset ring-slate-200 ${className}`}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={user.avatar_url} alt={name} className="h-full w-full object-cover" />
      </span>
    );
  }

  return (
    <span
      style={style}
      className={`inline-flex shrink-0 items-center justify-center rounded-full bg-slate-100 text-xs font-semibold text-slate-600 ring-1 ring-inset ring-slate-200 ${className}`}
    >
      {initial}
    </span>
  );
}
