import { ThemeToggle } from "@/shared/components/theme-toggle";

export function Header() {
  return (
    <header className="h-14 border-b border-border bg-bg-secondary flex items-center justify-end px-6">
      <ThemeToggle />
    </header>
  );
}
