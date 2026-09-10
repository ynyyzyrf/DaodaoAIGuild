"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";

import { getCurrentUser, getToken } from "@/lib/auth";

export default function ProtectedEntryLink({
  href,
  children,
  className,
}: {
  href: string;
  children: React.ReactNode;
  className?: string;
}) {
  const router = useRouter();

  function handleClick(e: React.MouseEvent<HTMLAnchorElement>) {
    if (getToken() && getCurrentUser()) return;
    e.preventDefault();
    router.push(`/login?next=${encodeURIComponent(href)}`);
  }

  return (
    <Link href={href} className={className} onClick={handleClick}>
      {children}
    </Link>
  );
}
