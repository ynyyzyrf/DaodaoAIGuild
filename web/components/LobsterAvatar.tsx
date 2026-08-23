"use client";

import type { EquipmentOut } from "@/lib/types";

/**
 * 龍蝦騎士 3D 風 Avatar：SVG 分层拼装（docs/2.0.md §10、UI-STYLE.md）。
 *
 * 绘制顺序（后→前）：背景盘 → cape → base → 龍蝦本体 → armor → helmet → hand → weapon。
 * 未解锁任何装备 = 一只干净的默认小龍蝦（Lv1 形象）。
 */

type SlotMap = Record<string, EquipmentOut | null>;

interface LobsterAvatarProps {
  /** 按槽位 slot → 已穿戴装备（无装备传 null）。 */
  equipment: SlotMap;
  size?: number;
  className?: string;
}

/** 稀有度 → 装备主色 / 描边色（common slate、rare amber、epic brand、legendary 金）。 */
const RARITY_COLORS: Record<string, { fill: string; stroke: string; label: string }> = {
  common: { fill: "#B8682C", stroke: "#8F4E1F", label: "普通" },
  rare: { fill: "#B8891E", stroke: "#8A6A12", label: "稀有" },
  epic: { fill: "#C5573C", stroke: "#8E3826", label: "史诗" },
  legendary: { fill: "#E8B93E", stroke: "#9A7411", label: "传说" },
};

function SlotBadge({ slot }: { slot: string }) {
  const meta: Record<string, { icon: string; name: string }> = {
    helmet: { icon: "⛑️", name: "頭盔" },
    weapon: { icon: "⚔️", name: "武器" },
    cape: { icon: "🧣", name: "披風" },
    armor: { icon: "🛡️", name: "護甲" },
    hand: { icon: "🦀", name: "護腕" },
    base: { icon: "💎", name: "底座" },
  };
  const m = meta[slot] ?? { icon: "✨", name: slot };
  return (
    <span title={m.name} className="text-slate-500">
      {m.icon}
    </span>
  );
}

export default function LobsterAvatar({ equipment, size = 180, className = "" }: LobsterAvatarProps) {
  const cape = equipment["cape"];
  const base = equipment["base"];
  const armor = equipment["armor"];
  const helmet = equipment["helmet"];
  const hand = equipment["hand"];
  const weapon = equipment["weapon"];

  // 龍蝦本体（品牌砖红系）
  return (
    <svg
      viewBox="0 0 200 200"
      width={size}
      height={size}
      role="img"
      aria-label="龍蝦騎士 Avatar"
      className={`inline-block select-none ${className}`}
    >
      <defs>
        <linearGradient id="lobster-bg" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#FBF0EC" />
          <stop offset="100%" stopColor="#F7DED5" />
        </linearGradient>
        <linearGradient id="lobster-body" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#E07A58" />
          <stop offset="100%" stopColor="#AC4730" />
        </linearGradient>
        <linearGradient id="lobster-seg" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#D15E42" />
          <stop offset="100%" stopColor="#9C3F2A" />
        </linearGradient>
        <linearGradient id="cape-grad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#8E3826" />
          <stop offset="100%" stopColor="#5E2316" />
        </linearGradient>
        <linearGradient id="gold-grad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#F3CE6E" />
          <stop offset="100%" stopColor="#B8891E" />
        </linearGradient>
        <linearGradient id="silver-grad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#E4E8EE" />
          <stop offset="100%" stopColor="#AEB6C2" />
        </linearGradient>
      </defs>

      {/* 背景盘（品牌浅底渐变，非装备） */}
      <circle cx="100" cy="100" r="92" fill="url(#lobster-bg)" stroke="#EFBEB0" strokeWidth="2" />
      <circle cx="100" cy="100" r="78" fill="none" stroke="#FFFFFF" strokeOpacity="0.6" strokeWidth="1.5" />

      {/* ===== 披風（最底层） ===== */}
      {cape && (
        <g>
          <path
            d="M78 58 C58 72, 46 100, 52 130 C60 118, 72 112, 80 116 Z"
            fill="url(#cape-grad)"
            opacity="0.92"
          />
          <path
            d="M122 58 C142 72, 154 100, 148 130 C140 118, 128 112, 120 116 Z"
            fill="url(#cape-grad)"
            opacity="0.92"
          />
        </g>
      )}

      {/* ===== 底座（底部） ===== */}
      {base && (
        <g>
          {/* 金属托 */}
          <ellipse cx="100" cy="172" rx="34" ry="7" fill="#6B7280" />
          <ellipse cx="100" cy="170" rx="34" ry="7" fill="#9CA3AF" />
          {/* 红宝石主面 */}
          <polygon points="100,138 122,158 100,176 78,158" fill="#B91C1C" stroke="#7F1D1D" strokeWidth="1.5" />
          <polygon points="100,138 122,158 100,176" fill="#DC2626" />
          <polygon points="100,138 78,158 100,176" fill="#991B1B" />
          <polygon points="100,152 108,160 100,168 92,160" fill="#FECACA" opacity="0.7" />
        </g>
      )}

      {/* ===== 龍蝦本体 ===== */}

      {/* 尾巴扇 */}
      <g>
        <path d="M82 150 q2 14 -6 20 l0 0 q10 -2 14 -4 q2 8 -4 14 q10 -4 14 -10 q-2 10 -8 12 q12 -4 16 -14 l-2 -18 Z" fill="url(#lobster-seg)" stroke="#8E3826" strokeWidth="1.5" />
        <path d="M118 150 q-2 14 6 20 l0 0 q-10 -2 -14 -4 q-2 8 4 14 q-10 -4 -14 -10 q2 10 8 12 q-12 -4 -16 -14 l2 -18 Z" fill="url(#lobster-seg)" stroke="#8E3826" strokeWidth="1.5" />
        <path d="M100 152 q0 16 -8 24 q8 4 8 0 q0 14 8 0 q8 14 8 0 q0 4 8 0 q-8 -8 -8 -24 Z" fill="url(#lobster-seg)" stroke="#8E3826" strokeWidth="1.5" />
      </g>

      {/* 腹部体节（后→前递减） */}
      <ellipse cx="100" cy="146" rx="30" ry="10" fill="url(#lobster-seg)" stroke="#8E3826" strokeWidth="1.2" />
      <ellipse cx="100" cy="133" rx="33" ry="11" fill="url(#lobster-seg)" stroke="#8E3826" strokeWidth="1.2" />
      <ellipse cx="100" cy="119" rx="36" ry="12" fill="url(#lobster-seg)" stroke="#8E3826" strokeWidth="1.2" />

      {/* 胸甲（carapace） */}
      <path
        d="M70 96 C70 74, 84 62, 100 62 C116 62, 130 74, 130 96 C130 112, 118 122, 100 122 C82 122, 70 112, 70 96 Z"
        fill="url(#lobster-body)"
        stroke="#8E3826"
        strokeWidth="2"
      />
      <path d="M100 62 C88 70, 84 80, 84 94 C84 106, 92 116, 100 120 C108 116, 116 106, 116 94 C116 80, 112 70, 100 62 Z" fill="#F3A582" opacity="0.35" />

      {/* 头（带尖角） */}
      <path
        d="M76 74 C76 56, 86 44, 100 44 C114 44, 124 56, 124 74 C124 84, 114 88, 100 88 C86 88, 76 84, 76 74 Z"
        fill="#C95B3F"
        stroke="#8E3826"
        strokeWidth="2"
      />

      {/* 触须 */}
      <path d="M84 50 C76 36, 66 30, 54 26" stroke="#8E3826" strokeWidth="2" fill="none" strokeLinecap="round" />
      <path d="M116 50 C124 36, 134 30, 146 26" stroke="#8E3826" strokeWidth="2" fill="none" strokeLinecap="round" />

      {/* 眼睛 */}
      <circle cx="90" cy="66" r="6" fill="#FFFFFF" stroke="#702D20" strokeWidth="1.5" />
      <circle cx="90" cy="67" r="3" fill="#1F2937" />
      <circle cx="110" cy="66" r="6" fill="#FFFFFF" stroke="#702D20" strokeWidth="1.5" />
      <circle cx="110" cy="67" r="3" fill="#1F2937" />

      {/* 微笑 */}
      <path d="M94 82 Q100 88 106 82" stroke="#702D20" strokeWidth="2" fill="none" strokeLinecap="round" />

      {/* 步足（每侧 3 只） */}
      <g stroke="#8E3826" strokeWidth="2.2" strokeLinecap="round" fill="none">
        <path d="M70 102 L52 96" />
        <path d="M70 110 L50 108" />
        <path d="M70 118 L52 122" />
        <path d="M130 102 L148 96" />
        <path d="M130 110 L150 108" />
        <path d="M130 118 L148 122" />
      </g>

      {/* 大螯（前举） */}
      <g stroke="#8E3826" strokeWidth="2.5" strokeLinecap="round">
        {/* 左臂 */}
        <path d="M76 108 C64 118, 56 122, 46 116" fill="none" />
        <path d="M46 116 C38 110, 32 102, 36 90" fill="none" />
        <circle cx="38" cy="86" r="12" fill="url(#lobster-body)" stroke="#8E3826" strokeWidth="2.5" />
        {/* 左钳 */}
        <path d="M32 90 Q22 86 20 76 Q32 74 40 78 Z" fill="#D15E42" stroke="#8E3826" strokeWidth="2" />
        <path d="M30 92 Q20 96 22 84 Z" fill="#C5573C" stroke="#8E3826" strokeWidth="2" />

        {/* 右臂 */}
        <path d="M124 108 C136 118, 144 122, 154 116" fill="none" />
        <path d="M154 116 C162 110, 168 102, 164 90" fill="none" />
        <circle cx="162" cy="86" r="12" fill="url(#lobster-body)" stroke="#8E3826" strokeWidth="2.5" />
        {/* 右钳 */}
        <path d="M168 90 Q178 86 180 76 Q168 74 160 78 Z" fill="#D15E42" stroke="#8E3826" strokeWidth="2" />
        <path d="M170 92 Q180 96 178 84 Z" fill="#C5573C" stroke="#8E3826" strokeWidth="2" />
      </g>

      {/* ===== 护甲（胸甲上） ===== */}
      {armor && (
        <g>
          <path
            d="M82 84 C82 72, 90 66, 100 66 C110 66, 118 72, 118 84 C118 98, 110 106, 100 106 C90 106, 82 98, 82 84 Z"
            fill={armor.code === "golden_armor" ? "url(#gold-grad)" : "url(#silver-grad)"}
            stroke={armor.code === "golden_armor" ? "#9A7411" : "#7C8894"}
            strokeWidth="1.8"
          />
          <path d="M88 74 L94 70 L94 100 L88 100 Z" fill="#FFFFFF" opacity="0.35" />
          <circle cx="100" cy="72" r="1.6" fill="#4B5563" />
          <circle cx="100" cy="100" r="1.6" fill="#4B5563" />
          <circle cx="88" cy="88" r="1.6" fill="#4B5563" />
          <circle cx="112" cy="88" r="1.6" fill="#4B5563" />
        </g>
      )}

      {/* ===== 头盔 ===== */}
      {helmet && (
        <g>
          {helmet.code === "lords_crown" ? (
            <>
              <path d="M82 62 L84 44 L96 54 L100 40 L104 54 L116 44 L118 62 Z" fill="url(#gold-grad)" stroke="#9A7411" strokeWidth="1.8" />
              <path d="M86 44 L96 54 L100 40 L104 54 L114 44 L114 50 L86 50 Z" fill="#F9E7B0" opacity="0.6" />
              <circle cx="88" cy="48" r="2.4" fill="#DC2626" />
              <circle cx="100" cy="44" r="2.4" fill="#2563EB" />
              <circle cx="112" cy="48" r="2.4" fill="#16A34A" />
              <rect x="84" y="62" width="32" height="6" rx="3" fill="url(#gold-grad)" stroke="#9A7411" strokeWidth="1.2" />
            </>
          ) : (
            <>
              {/* 救援头盔 */}
              <path d="M82 66 C82 54, 90 48, 100 48 C110 48, 118 54, 118 66 Z" fill="#F3F4F6" stroke="#9CA3AF" strokeWidth="1.8" />
              <path d="M80 66 Q100 62 120 66 Q120 72 100 72 Q80 72 80 66 Z" fill="#EF4444" stroke="#B91C1C" strokeWidth="1.4" />
              <circle cx="100" cy="56" r="4" fill="#FFFFFF" stroke="#D1D5DB" strokeWidth="1" />
              <path d="M98 54 L98 58 L102 58" stroke="#EF4444" strokeWidth="1.6" fill="none" strokeLinecap="round" strokeLinejoin="round" />
            </>
          )}
        </g>
      )}

      {/* ===== 护腕（大螯上） ===== */}
      {hand && (
        <g>
          <rect x="30" y="78" width="16" height="7" rx="3" fill={RARITY_COLORS[hand.rarity].fill} stroke={RARITY_COLORS[hand.rarity].stroke} strokeWidth="1.2" transform="rotate(-18 38 81)" />
          <rect x="30" y="90" width="16" height="7" rx="3" fill={RARITY_COLORS[hand.rarity].fill} stroke={RARITY_COLORS[hand.rarity].stroke} strokeWidth="1.2" transform="rotate(-18 38 93)" />
          <rect x="154" y="78" width="16" height="7" rx="3" fill={RARITY_COLORS[hand.rarity].fill} stroke={RARITY_COLORS[hand.rarity].stroke} strokeWidth="1.2" transform="rotate(18 162 81)" />
          <rect x="154" y="90" width="16" height="7" rx="3" fill={RARITY_COLORS[hand.rarity].fill} stroke={RARITY_COLORS[hand.rarity].stroke} strokeWidth="1.2" transform="rotate(18 162 93)" />
        </g>
      )}

      {/* ===== 武器（卷轴，右螯侧持） ===== */}
      {weapon && (
        <g>
          <rect x="152" y="96" width="34" height="14" rx="7" fill="#F2E3C4" stroke="#B8891E" strokeWidth="1.6" transform="rotate(24 169 103)" />
          <rect x="152" y="100" width="34" height="6" rx="3" fill="#E8D5AC" transform="rotate(24 169 103)" />
          <rect x="150" y="94" width="5" height="18" rx="2.5" fill="#C5573C" stroke="#8E3826" strokeWidth="1" transform="rotate(24 152 103)" />
          <rect x="183" y="92" width="5" height="18" rx="2.5" fill="#C5573C" stroke="#8E3826" strokeWidth="1" transform="rotate(24 185 101)" />
        </g>
      )}
    </svg>
  );
}

export { SlotBadge };
