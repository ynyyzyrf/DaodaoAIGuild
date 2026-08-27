/**
 * 人類瀏覽器 WebSocket 基址（docs/3.3.md v0.1 Phase B）。
 *
 * dev（localhost）：前端 3000、後端 8000，直連後端 WS。
 * 生產：同域走 nginx WSS（nginx 已配置 Upgrade proxy）。
 * 可用 NEXT_PUBLIC_WS_BASE 覆寫。
 */

export function wsUrl(path: string): string {
  const configured = process.env.NEXT_PUBLIC_WS_BASE;
  if (configured) return `${configured}${path}`;
  if (typeof window !== "undefined") {
    const hostname = window.location.hostname;
    if (hostname === "localhost" || hostname === "127.0.0.1") {
      return `ws://localhost:8000${path}`;
    }
    const proto = window.location.protocol === "https:" ? "wss" : "ws";
    return `${proto}://${window.location.host}${path}`;
  }
  return `ws://localhost:8000${path}`;
}

/** 人類訂閱房間的 WS URL。 */
export const roomsWsUrl = () => wsUrl("/api/v1/ws/rooms");
