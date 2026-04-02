import { Sparkles } from "lucide-react";

interface AiInsightBarProps {
  insight: string | null;
}

export function AiInsightBar({ insight }: AiInsightBarProps) {
  if (!insight) return null;

  return (
    <div className="flex items-center gap-2 px-3 py-2 rounded-md bg-accent-muted text-sm text-text-secondary mb-6">
      <Sparkles size={14} className="text-accent shrink-0" />
      <span>{insight}</span>
    </div>
  );
}
