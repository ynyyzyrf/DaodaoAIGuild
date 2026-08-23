/**
 * 3.0 生态跳转入口配置（docs/3.0.md）。
 * 所有外部跳转地址的唯一配置源：改这里即生效，无需改动组件。
 * 约定：url 为 "" 的入口不渲染（如暂无地址的入口，先隐藏等填上）。
 */

export interface EcosystemLink {
  /** 显示名 */
  name: string;
  /** 跳转地址；"" 则不显示该入口 */
  url: string;
  /** 轻量图标（emoji，贴合 UI-STYLE 的 10% 趣味人格） */
  icon: string;
}

/** 一鍵導航下拉中的 DaoDao 生态产品入口（docs/3.0.md §2）。 */
export const ECOSYSTEM_LINKS: EcosystemLink[] = [
  { name: "DaoStore", url: "https://daostore.wiltechs.com/", icon: "🛒" },
  { name: "DaoClaw", url: "https://daoclaw.testomenow.com/", icon: "🦞" },
  { name: "SkillHub", url: "https://skillhub.wiltechs.com/", icon: "🧰" },
  { name: "Dify", url: "https://ai-studio.solarifyai.com/apps", icon: "🤖" },
  { name: "GitLab", url: "https://gitlab.sjfood.us", icon: "🦊" },
];

/** 知識庫（docs/3.0.md §3）：直接跳飞书文档，不经过中间列表页。 */
export const KNOWLEDGE_BASE = {
  label: "知識庫",
  url: "https://my.feishu.cn/wiki/Tp8mwAzMQiPDc4kTqYEcpWj3nze?from=from_copylink",
  /** true=新窗口打开，false=当前窗口（可配置） */
  newTab: true,
};

/** 龍蝦社区 / DaoClaw Community（docs/3.0.md §4）：系统内页面（非外链），为 Skill/MCP 预留。 */
export const DAOCLAW_COMMUNITY = {
  label: "龍蝦社区",
  path: "/community",
};
