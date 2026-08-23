"use client";

import type { EquipmentOut, Rarity } from "@/lib/types";

const SLOT_META: Record<string, { icon: string; name: string }> = {
  helmet: { icon: "⛑️", name: "頭盔" },
  weapon: { icon: "⚔️", name: "武器" },
  cape: { icon: "🧣", name: "披風" },
  armor: { icon: "🛡️", name: "護甲" },
  hand: { icon: "🦀", name: "護腕" },
  base: { icon: "💎", name: "底座" },
};

const RARITY_META: Record<Rarity, { label: string; badge: string }> = {
  common: { label: "普通", badge: "bg-slate-100 text-slate-600" },
  rare: { label: "稀有", badge: "bg-amber-50 text-amber-700 ring-1 ring-inset ring-amber-200" },
  epic: { label: "史诗", badge: "bg-red-50 text-red-700 ring-1 ring-inset ring-red-200" },
  legendary: {
    label: "传说",
    badge: "bg-gradient-to-br from-amber-50 to-amber-100 text-amber-700 ring-1 ring-inset ring-amber-300",
  },
};

interface EquipmentPanelProps {
  equipment: EquipmentOut[];
  /** 本人可穿戴/卸下；他人只读。 */
  isOwner: boolean;
  /** 切换穿戴状态（乐观更新由父级处理）。 */
  onToggle: (code: string) => void;
}

/** 装备收藏面板（docs/2.0.md §11）：每件展示槽位/名称/稀有度/解锁态，本人可穿戴。 */
export default function EquipmentPanel({ equipment, isOwner, onToggle }: EquipmentPanelProps) {
  return (
    <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
      {equipment.map((e) => {
        const slot = SLOT_META[e.slot] ?? { icon: "✨", name: e.slot };
        const meta = RARITY_META[e.rarity];
        return (
          <li
            key={e.code}
            className={`card flex flex-col gap-2 p-4 ${
              e.is_equipped ? "ring-2 ring-inset ring-brand-400" : ""
            }`}
          >
            <div className="flex items-center justify-between gap-2">
              <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-slate-800">
                <span aria-hidden>{slot.icon}</span>
                {e.name}
              </span>
              <span className={`badge ${meta.badge}`}>{meta.label}</span>
            </div>

            <div className="text-xs text-slate-400">
              {slot.name}槽 · {e.unlocked ? "已解鎖" : "未解鎖"}
            </div>

            {e.unlocked ? (
              <div className="mt-auto flex items-center justify-between pt-1">
                {isOwner ? (
                  <button
                    type="button"
                    onClick={() => onToggle(e.code)}
                    className={`btn btn-sm ${
                      e.is_equipped ? "btn-secondary" : "btn-primary"
                    }`}
                  >
                    {e.is_equipped ? "卸下" : "穿戴"}
                  </button>
                ) : (
                  <span className={`badge ${e.is_equipped ? "badge-red" : "badge-gray"}`}>
                    {e.is_equipped ? "🦞 已穿戴" : "未穿戴"}
                  </span>
                )}
              </div>
            ) : (
              <p className="mt-auto text-[11px] leading-snug text-slate-400">{e.description}</p>
            )}
          </li>
        );
      })}
    </ul>
  );
}
