export function formatSolutionCoinPrice(value?: string | null) {
  const raw = value
    ?.trim()
    .replace(/[¥￥]/g, "")
    .replace(/\bRMB\b/gi, "")
    .replace(/人民幣|人民币/g, "")
    .replace(/\s+/g, " ")
    .trim();
  if (!raw) return "面議";
  if (["面議", "面议", "待溝通", "待沟通"].includes(raw)) return raw;
  if (/coin/i.test(raw)) return raw;
  if (raw.endsWith("起")) return `${raw.slice(0, -1).trim()} coin 起`;
  return `${raw} coin`;
}
