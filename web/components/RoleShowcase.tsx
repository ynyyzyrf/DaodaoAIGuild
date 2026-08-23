"use client";

import type { EquipmentOut, UserProfileOut } from "@/lib/types";
import LobsterKnight3D from "@/components/3d/LobsterKnight3D";
import LobsterAvatar from "@/components/LobsterAvatar";

/**
 * RoleShowcase —— 左侧 3D 龙虾骑士展示台
 *
 * DOM 结构与 z-index 分层（防 DOM 元素误盖在 Three.js canvas 上）:
 *   .role-showcase    (z-0, bg-white, overflow-hidden)  容器卡片
 *     .three-container (z-0, gradient bg)              3D 展示区
 *       LobsterKnight3D (z-10)                        canvas 容器
 *       .role-badges    (z-20)                        左上 Lv + 称号
 *       .interaction-hint (z-20)                      左下拖拽提示
 *
 * 关键不变量:
 * - 3D 区域内任何 DOM 元素都不得全宽 / 不得进入中段垂直区
 * - 3D 区域里只有 1 个 canvas（由 LobsterKnight3D useEffect 创建/清理）
 * - glFailed/loadFailed 都是 false（GL 正常、模型加载成功）
 */

interface RoleShowcaseProps {
  equipment: Record<string, EquipmentOut | null>;
  user: UserProfileOut;
}

export default function RoleShowcase({ equipment, user }: RoleShowcaseProps) {
  const level = user.level;
  const title = user.current_title;

  return (
    <div
      data-role-showcase
      className="role-showcase relative z-0 flex w-full flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-[0_1px_3px_rgba(16,24,40,0.04)]"
    >
      {/* 3D 展示区:占满主区,固定高度 */}
      <div
        data-three-container
        className="three-container relative z-0 w-full"
        style={{
          height: "clamp(520px, 70vh, 720px)",
          background:
            "radial-gradient(ellipse 80% 60% at 50% 65%, rgba(197,87,60,0.06) 0%, transparent 60%), #F7F5F1",
        }}
      >
        <LobsterKnight3D
          className="absolute inset-0 z-10"
          fallback={<LobsterAvatar equipment={equipment} size={280} />}
        />

        {/* 左上:Lv + 称号 */}
        <div
          data-role-badges
          className="role-badges pointer-events-none absolute left-4 top-4 z-20 flex flex-col gap-1.5"
        >
          <span className="inline-flex items-center gap-1.5 rounded-full bg-white/90 px-3 py-1 text-xs font-semibold text-slate-800 ring-1 ring-slate-200 backdrop-blur">
            <span aria-hidden>🦞</span>
            Lv{level} 小龙虾
          </span>
          {title && (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-brand-50/95 px-3 py-1 text-xs font-semibold text-brand-700 ring-1 ring-inset ring-brand-200 backdrop-blur">
              {title.icon} {title.name}
            </span>
          )}
        </div>

        {/* 左下:拖拽提示(贴边,不挡模型) */}
        <div
          data-interaction-hint
          className="interaction-hint pointer-events-none absolute bottom-3 left-4 z-20 rounded-full bg-white/80 px-2.5 py-0.5 text-[10px] font-medium text-slate-500 ring-1 ring-slate-200 backdrop-blur"
        >
          拖拽旋转 · 滚轮缩放
        </div>
      </div>
    </div>
  );
}
