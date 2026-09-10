"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";

import { api } from "@/lib/client";
import { clearToken, getToken, notifyAuthChanged } from "@/lib/auth";
import type { UserOut } from "@/lib/types";

function buildLoginUrl(next: string) {
  return `/login?next=${encodeURIComponent(next)}`;
}

export default function RequireAuth({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [allowed, setAllowed] = useState(false);

  useEffect(() => {
    const query = typeof window !== "undefined" ? window.location.search.replace(/^\?/, "") : "";
    const next = query ? `${pathname}?${query}` : pathname;
    const token = getToken();

    if (!token) {
      router.replace(buildLoginUrl(next));
      return;
    }

    let cancelled = false;

    async function verifySession() {
      try {
        const user = await api.get<UserOut>("/auth/me");

        if (!cancelled) {
          localStorage.setItem("user", JSON.stringify(user));
          notifyAuthChanged();
          setAllowed(true);
        }
      } catch {
        if (!cancelled) {
          clearToken();
          notifyAuthChanged();
          router.replace(buildLoginUrl(next));
        }
      }
    }

    void verifySession();

    return () => {
      cancelled = true;
    };
  }, [pathname, router]);

  if (!allowed) {
    return (
      <main className="flex min-h-[calc(100vh-76px)] items-center justify-center bg-slate-50 px-4">
        <div className="rounded-lg border border-slate-200 bg-white px-5 py-4 text-sm text-slate-500 shadow-sm">
          正在前往登入頁...
        </div>
      </main>
    );
  }

  return <>{children}</>;
}
