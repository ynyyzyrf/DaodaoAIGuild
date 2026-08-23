/** 相对时间文案：3 分鐘前 / 1 小時前 / 昨天 / 3 天前；超过 7 天给具体日期（2026-08-01）。 */
export function timeAgo(iso: string): string {
  // 后端 DB 存 naive UTC，返回无时区标识的 ISO；补 Z 强制按 UTC 解析，避免浏览器本地时区偏移。
  const normalized = /(?:Z|[+-]\d{2}:?\d{2})$/.test(iso) ? iso : `${iso}Z`;
  const then = new Date(normalized).getTime();
  if (Number.isNaN(then)) return "";

  const diffMs = Date.now() - then;
  const minute = 60_000;
  const hour = 60 * minute;
  const day = 24 * hour;

  if (diffMs < minute) return "剛剛";
  if (diffMs < hour) return `${Math.floor(diffMs / minute)} 分鐘前`;
  if (diffMs < day) return `${Math.floor(diffMs / hour)} 小時前`;
  if (diffMs < 2 * day) return "昨天";
  if (diffMs < 7 * day) return `${Math.floor(diffMs / day)} 天前`;

  const d = new Date(normalized);
  const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(d.getUTCDate()).padStart(2, "0");
  return `${d.getUTCFullYear()}-${mm}-${dd}`;
}
