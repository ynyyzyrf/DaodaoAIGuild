"use client";

/**
 * Sidebar 收起状态：跨页面共享的轻量持久化。
 *
 * - 存到 localStorage（key 与 docs/UI-STYLE.md §X 约定）
 * - 同 tab 多个 Sidebar 实例通过自定义事件同步
 * - 跨 tab 通过原生 storage 事件同步
 *
 * 比 React Context 更轻：无需在 RootLayout 套 Provider，
 * 每个 Sidebar 实例自己订阅即可。
 */

const STORAGE_KEY = "dao-guild-sidebar-collapsed";
const EVENT_NAME = "dao-guild:sidebar-change";

export function getCollapsed(): boolean {
  if (typeof window === "undefined") return false;
  const raw = localStorage.getItem(STORAGE_KEY);
  if (raw === null) return false;
  try {
    return JSON.parse(raw) === true;
  } catch {
    return false;
  }
}

export function setCollapsed(collapsed: boolean): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(collapsed));
  window.dispatchEvent(new CustomEvent<{ collapsed: boolean }>(EVENT_NAME, { detail: { collapsed } }));
}

export function toggleCollapsed(): boolean {
  const next = !getCollapsed();
  setCollapsed(next);
  return next;
}

export function subscribeCollapsed(cb: (collapsed: boolean) => void): () => void {
  if (typeof window === "undefined") return () => {};
  const onLocal = (e: Event) => {
    const detail = (e as CustomEvent<{ collapsed: boolean }>).detail;
    cb(typeof detail?.collapsed === "boolean" ? detail.collapsed : getCollapsed());
  };
  const onStorage = (e: StorageEvent) => {
    if (e.key === STORAGE_KEY) cb(getCollapsed());
  };
  window.addEventListener(EVENT_NAME, onLocal);
  window.addEventListener("storage", onStorage);
  return () => {
    window.removeEventListener(EVENT_NAME, onLocal);
    window.removeEventListener("storage", onStorage);
  };
}
