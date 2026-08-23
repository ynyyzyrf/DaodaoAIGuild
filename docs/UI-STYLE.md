# DaoDao AI Guild UI 風格指南

> 適用於 FDE 社區 / 龍蝦騎士社區的前端視覺與組件規範。
> 本文件延續 **DaoClaw** 產品語言，定義色彩、排版、組件與「龍蝦騎士」身份的運用邊界。

---

## 1. 設計定位

整體氣質比例：**70% DaoClaw SaaS 風格 · 20% Developer Community 社區感 · 10% Lobster Knight 趣味人格**

| 維度 | 定位 |
|------|------|
| 體感 | 現代 SaaS 後台 + 輕社區感 |
| 視覺 | 乾淨、簡潔、專業、友好 |
| 背景 | 大面積白色與極淺灰，充足留白，避免高密度堆疊 |
| 邊框/圓角 | 細邊框、柔和陰影、中等圓角 |
| 卡通度 | 不做過度卡通、不遊戲化過重 |

**關鍵詞：** Clean、Modern、SaaS、Professional、Friendly、AI、Developer Community、Lightweight、Structured、Lobster Identity

---

## 2. 色彩

### 2.1 色板

| Token | 用途 | 值 |
|-------|------|-----|
| `bg-page` | 頁面背景（極淺灰） | `#F8FAFC`（slate-50） |
| `bg-card` | 卡片背景（純白） | `#FFFFFF` |
| `border` | 卡片/輸入框邊框（淺灰） | `#E2E8F0`（slate-200） |
| `brand-500` | 主品牌色（DaoClaw 暖紅/磚紅） | `#C5573C` |
| `brand-600` | 主色 hover | `#AC4730` |
| `brand-50` | 主色淺底（badge/強調底） | `#FBF0EC` |
| `amber-*` | 輔助色（暖黃，少量點綴） | Tailwind amber |
| `green-*` | 成功狀態（柔和綠） | Tailwind green（50/600/700） |
| `orange-*` | 警告狀態（暖橙） | Tailwind orange（50/600/700） |
| `slate-900` | 主文字（深灰黑） | `#0F172A` |
| `slate-500/600` | 次級文字（中灰） | `#64748B` / `#475569` |

### 2.2 原則

- 主背景白色/極淺灰，卡片純白；卡片之間靠淺灰細邊框 + 極輕陰影分層，不靠大色塊。
- 品牌色（磚紅）只承載**主操作**與**強調**；輔助暖黃只用於少量點綴（如等級、成就角標）。
- 成功綠 / 警告橙僅在狀態語義出現（已解決、待處理），不使用霓虹藍紫。

### 2.3 避免

❌ 賽博朋克 · 藍紫霓虹 · 大面積漸變 · 重 3D · Discord/Reddit 風 · 傳統論壇風 · 過度卡通化 · 過度複雜裝飾

---

## 3. 排版

- 字體：系統字體棧（默認），不引入自定義顯示字體。
- 標題：`slate-900`、`font-bold`；頁面 H1 建議 `text-2xl`（詳情頁可 `text-3xl`）。
- 正文：`text-sm` / `text-base`，顏色 `slate-600/700`。
- 次級：時間、計數、作者等用 `text-xs`/`text-sm` `slate-500`。
- 行高：正文 `leading-relaxed` / `1.7`（Markdown 正文）。
- 留白：列表卡片間 `space-y-3`；區塊間 `mt-8`；頁面 `px-6 py-10`。

---

## 4. 圓角 / 陰影 / 邊框

| 元素 | 圓角 | 陰影 |
|------|------|------|
| 卡片 Card | `rounded-xl`（0.75rem） | `0 1px 2px rgba(16,24,40,.04)`，hover 略加深 |
| 按鈕 / 輸入框 | `rounded-lg`（0.5rem） | 無 / focus ring |
| Badge / 標籤 | `rounded-md`（0.375rem） | 無 |
| 頭像 | 正圓 `rounded-full` | 細 `ring-1 ring-slate-200` |
| 空狀態插圖框 | `rounded-2xl` | 柔和 |

- 邊框統一 `1px solid #E2E8F0`（slate-200）。
- 陰影始終柔和、低對比，避免大面積投影。

---

## 5. 組件規範

### Card
白底、圓角、細灰框、極輕陰影。可選 hover 態（邊框轉品牌淺色、陰影略深）。列表項、表單容器、身份卡、詳情正文均用 Card。

### Button
- **主按鈕**：`brand-500` 底白字，hover `brand-600`。用於核心 CTA（發問、發布、登錄、提交）。
- **次按鈕**：白底灰框、`slate-700` 文字。用於非核心動作（上傳、贊、取消）。
- **Ghost**：無框透明，僅 hover 淺灰底。用於導航/次級鏈接。
- 統一小圓角、`text-sm font-semibold`、icon 與文字 `gap-1.5`。

### Badge
小尺寸、圓角、柔和背景色。語義配色：
- 灰（默認/中性）、品牌紅（龍蝦身份/匿名）、綠（已解決/成功）、橙（警告）、琥珀（等級金/銅）。

### Input / Search
白底、淺灰邊框、簡潔圓角；focus 時品牌色邊框 + 極淡品牌 ring。`placeholder` 用 `slate-400`。

### Icon
輕量**線性圖標**（lucide-react），`strokeWidth` 輕、默認 `size 16-20`。避免厚重與 3D、避免堆疊大量 emoji 當裝飾。

### Avatar
簡潔圓形頭像：
- 有 `avatar_url` → 原圖圓形 + 細灰 ring。
- 無 → 初始字母 + `slate-100` 底。
- **匿名騎士** → `🦞` 置於 `brand-50` 圓底 + 品牌細 ring，作為龍蝦騎士身份點綴。

---

## 6. 龍蝦元素（10% 趣味人格）

龍蝦只作**品牌點綴**，出現於以下場景，不喧賓奪主：

- 空狀態插圖（`🦞` 於品牌淺底圓角框內）
- LevelBadge / 成就角標
- 匿名身份（頭像 + 「🦞 匿名」角標）
- 頭像框 / 登錄品牌標識
- 系統提示

**不要**：把整體做成 RPG / 遊戲論壇 / 卡通社區；不用龍蝦元素堆疊裝飾。

---

## 7. 實現

- 設計 token 注冊於 `web/tailwind.config.ts` 的 `theme.extend.colors.brand`。
- 可複用組件類定義於 `web/app/globals.css` 的 `@layer components`：
  `.card` `.btn-primary` `.btn-secondary` `.btn-ghost` `.btn-sm` `.input` `.label` `.badge-*` `.chip-*`
- 圖標庫：`lucide-react`（線性圖標，tree-shaking）。
- 複用組件：`components/Avatar.tsx`（圓形頭像 + 匿名騎士）、`components/EmptyState.tsx`（龍蝦空狀態）、`components/LevelBadge.tsx`、`components/UploadButton.tsx`、`components/Attachments.tsx`。

### 頁面速查

| 頁面 | 佈局 |
|------|------|
| 首頁 | 英雄區（標語 + 雙 CTA）→ 功能卡片 → 🏆 騎士排行榜 |
| 登錄 | 居中 Card，品牌 🦞 標識 + 表單 |
| 問題列表 | 標題行 + 搜索 + 標籤 chips + 卡片列表 / 空狀態 |
| 問題詳情 | 麵包屑 + 標題 + 元信息 + 正文 + 附件 + 回答卡片 + 回答表單 |
| 發問 / 發教程 | Card 包裹表單 |
| 個人頁 | 身份卡（頭像/名稱/等級徽章/聲望/專長/統計）+ 最近發布 |
