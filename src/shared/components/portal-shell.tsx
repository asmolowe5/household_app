"use client";

import { type ReactNode } from "react";
import { Sidebar } from "@/shared/components/sidebar";
import { Header } from "@/shared/components/header";
import { MobileTabBar } from "@/shared/components/mobile-tab-bar";
import { useIsMobile } from "@/shared/hooks/use-media-query";
import { useSidebar } from "@/shared/hooks/use-sidebar";

export function PortalShell({ children }: { children: ReactNode }) {
  const isMobile = useIsMobile();
  const { isCollapsed, toggle, width } = useSidebar();

  return (
    <div className="flex min-h-screen">
      {!isMobile && <Sidebar isCollapsed={isCollapsed} onToggle={toggle} />}
      <div
        className="flex-1 flex flex-col min-h-screen transition-all duration-200"
        style={{ marginLeft: isMobile ? 0 : width }}
      >
        <Header />
        <main className="flex-1 p-4 md:p-6 pb-20 md:pb-6">{children}</main>
      </div>
      {isMobile && <MobileTabBar />}
    </div>
  );
}
