"use client";

import dynamic from "next/dynamic";
import { type ReactNode } from "react";

const PortalShell = dynamic(
  () =>
    import("@/shared/components/portal-shell").then((m) => m.PortalShell),
  { ssr: false }
);

export function PortalShellClient({ children }: { children: ReactNode }) {
  return <PortalShell>{children}</PortalShell>;
}
