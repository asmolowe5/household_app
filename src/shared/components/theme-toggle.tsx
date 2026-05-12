"use client";

import { Moon, Sun } from "lucide-react";
import { useTheme } from "@/shared/hooks/use-theme";

export function ThemeToggle() {
  const { theme, toggleTheme } = useTheme();

  return (
    <button
      onClick={toggleTheme}
      className="flex h-10 w-10 items-center justify-center rounded-xl border border-border-subtle text-text-tertiary transition-all duration-200 hover:bg-bg-tertiary hover:text-text-primary"
      aria-label={`Switch to ${theme === "dark" ? "light" : "dark"} mode`}
    >
      {theme === "dark" ? <Sun size={18} /> : <Moon size={18} />}
    </button>
  );
}
