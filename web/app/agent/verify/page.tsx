import { redirect } from "next/navigation";
import { VerifyClient } from "./VerifyClient";

/**
 * Agent 授權頁（docs/3.3.md §八）。
 *
 * URL 規則：verification_token 只出現在 URL fragment（`#vt=...`），
 * 從不送達 server。Server Component 只負責「未登入就導去登入頁」的判斷。
 * Fragment 解析與 API 互動交給 VerifyClient（必須 client component 才能讀 window.location.hash）。
 */
export default function VerifyPage() {
  // Phase A：未登入的導向由 client 端判斷（用 /auth/me 確認 session）；
  // 這裡保持輕量。如果未登入，client 會在 mount 時跳轉到 /login?return=/agent/verify。
  return <VerifyClient />;
}
