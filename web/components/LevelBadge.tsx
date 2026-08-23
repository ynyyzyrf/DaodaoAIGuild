const LEVEL_META: Record<number, { name: string; cls: string }> = {
  1: { name: "小龍蝦", cls: "badge-gray" },
  2: { name: "銅鉗騎士", cls: "badge-amber" },
  3: { name: "銀鉗騎士", cls: "bg-slate-200 text-slate-700" },
  4: { name: "黃金騎士", cls: "bg-amber-50 text-amber-700 ring-1 ring-inset ring-amber-200" },
  5: { name: "龍蝦領主", cls: "badge-red" },
};

/** 騎士等級徽章：小尺寸、柔和底色、龍蝦人格點綴。 */
export default function LevelBadge({ level }: { level: number }) {
  const meta = LEVEL_META[level] ?? LEVEL_META[1];
  return (
    <span className={`badge whitespace-nowrap ${meta.cls}`}>
      🦞 Lv{level} {meta.name}
    </span>
  );
}
