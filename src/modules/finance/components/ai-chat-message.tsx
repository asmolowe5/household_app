import { cn } from "@/shared/lib/utils";
import { Sparkles, User } from "lucide-react";

interface AiChatMessageProps {
  role: "user" | "model";
  content: string;
}

export function AiChatMessage({ role, content }: AiChatMessageProps) {
  return (
    <div className={cn("flex gap-3 py-3", role === "user" ? "flex-row-reverse" : "")}>
      <div
        className={cn(
          "w-7 h-7 rounded-full flex items-center justify-center shrink-0",
          role === "user" ? "bg-accent-muted" : "bg-bg-tertiary"
        )}
      >
        {role === "user" ? <User size={14} /> : <Sparkles size={14} className="text-accent" />}
      </div>
      <div
        className={cn(
          "rounded-lg px-3 py-2 text-sm max-w-[80%]",
          role === "user"
            ? "bg-accent-muted text-text-primary"
            : "bg-bg-tertiary text-text-primary"
        )}
      >
        {content}
      </div>
    </div>
  );
}
