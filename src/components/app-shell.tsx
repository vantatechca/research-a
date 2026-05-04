"use client";

import { usePathname } from "next/navigation";
import { Sidebar } from "@/components/sidebar";

/**
 * Picks the right outer shell for the current route.
 *
 * - /login          → full-bleed centered page, no sidebar/main margin
 * - everything else → sidebar + main content area
 *
 * Lives as a client component because the root layout is a server component
 * and can't call usePathname.
 */
export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isAuthRoute = pathname === "/login";

  if (isAuthRoute) {
    return <main className="min-h-screen bg-gray-50">{children}</main>;
  }

  return (
    <div className="min-h-full flex">
      <Sidebar />
      <main className="flex-1 ml-64 min-h-screen bg-gray-50">{children}</main>
    </div>
  );
}