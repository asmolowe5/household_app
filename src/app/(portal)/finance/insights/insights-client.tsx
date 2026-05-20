"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  Brain,
  Sparkles,
  Calendar,
  ChevronRight,
  X,
  FileText,
  Clock,
  Loader2,
} from "lucide-react";
import { formatDate } from "@/shared/lib/utils";

interface InsightRecord {
  id: string;
  title: string;
  content: string;
  createdAt: Date;
}

interface InsightsHistoryClientProps {
  history: InsightRecord[];
}

export function InsightsHistoryClient({ history }: InsightsHistoryClientProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  // Dialog State
  const [selectedInsight, setSelectedInsight] = useState<InsightRecord | null>(null);
  const [generating, setGenerating] = useState(false);
  const [generationStep, setGenerationStep] = useState<string>("");
  const [error, setError] = useState<string | null>(null);

  // Parse custom markdown helper
  function renderTextWithBold(text: string) {
    const parts = text.split(/\*\*(.*?)\*\*/g);
    return parts.map((part, index) => {
      if (index % 2 === 1) {
        return (
          <strong key={index} className="font-bold text-text-primary">
            {part}
          </strong>
        );
      }
      return part;
    });
  }

  function parseMarkdown(md: string) {
    const lines = md.split("\n");
    return lines.map((line, i) => {
      const text = line.trim();
      if (!text) return <div key={i} className="h-2" />;

      if (text.startsWith("###")) {
        return (
          <h4 key={i} className="text-xs font-bold uppercase tracking-wider text-accent mt-5 mb-2">
            {renderTextWithBold(text.replace("###", "").trim())}
          </h4>
        );
      }
      if (text.startsWith("##")) {
        return (
          <h3 key={i} className="text-sm font-semibold text-text-primary mt-6 mb-3 border-b border-border-subtle/50 pb-1">
            {renderTextWithBold(text.replace("##", "").trim())}
          </h3>
        );
      }
      if (text.startsWith("#")) {
        return (
          <h2 key={i} className="text-base font-bold text-text-primary mt-8 mb-4">
            {renderTextWithBold(text.replace("#", "").trim())}
          </h2>
        );
      }

      if (text.startsWith("-") || text.startsWith("*")) {
        return (
          <li key={i} className="ml-4 list-disc text-xs text-text-secondary leading-relaxed mb-1.5 pl-1">
            {renderTextWithBold(text.substring(1).trim())}
          </li>
        );
      }

      return (
        <p key={i} className="text-xs text-text-secondary leading-relaxed mb-3">
          {renderTextWithBold(text)}
        </p>
      );
    });
  }

  // Handle generation pipeline
  async function handleGenerate() {
    setGenerating(true);
    setError(null);
    setSelectedInsight(null);

    const steps = [
      "Gathering account balances...",
      "Analyzing Plaid categories...",
      "Summarizing last 30 days of transactions...",
      "Invoking Gemini AI analytics...",
      "Formatting insights report...",
      "Saving results to database...",
    ];

    let currentStep = 0;
    setGenerationStep(steps[0]);

    // Animate steps for smooth UI feel
    const stepInterval = setInterval(() => {
      if (currentStep < steps.length - 2) {
        currentStep++;
        setGenerationStep(steps[currentStep]);
      }
    }, 1200);

    try {
      const res = await fetch("/api/finance/insights/generate", {
        method: "POST",
      });

      clearInterval(stepInterval);

      if (!res.ok) {
        const body = await res.json();
        throw new Error(body.error ?? "Failed to generate insights");
      }

      setGenerationStep("Finalizing analysis...");
      const data = await res.json();
      
      // Select the new insight immediately to show in pop-up
      setSelectedInsight({
        ...data.insight,
        createdAt: new Date(data.insight.createdAt),
      });

      startTransition(() => {
        router.refresh();
      });
    } catch (err) {
      clearInterval(stepInterval);
      setError(err instanceof Error ? err.message : "An unexpected error occurred");
    } finally {
      setGenerating(false);
      setGenerationStep("");
    }
  }

  return (
    <div className="space-y-6">
      {/* Header section with generation button */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between rounded-2xl border border-border-default bg-bg-secondary p-5">
        <div className="space-y-1">
          <h2 className="text-sm font-semibold text-text-primary flex items-center gap-2">
            <Brain size={18} className="text-accent" />
            AI Wealth Insights
          </h2>
          <p className="text-[11px] text-text-tertiary">
            Analyze your household spending, budgets, and net worth patterns using Gemini.
          </p>
        </div>
        <button
          onClick={handleGenerate}
          disabled={generating}
          className="flex items-center justify-center gap-2 rounded-xl bg-accent px-4 py-2.5 text-xs font-semibold text-white shadow-sm transition-all hover:bg-accent-hover hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50 disabled:pointer-events-none"
        >
          {generating ? (
            <>
              <Loader2 className="animate-spin" size={14} />
              Analyzing...
            </>
          ) : (
            <>
              <Sparkles size={14} />
              Run Full AI Analysis
            </>
          )}
        </button>
      </div>

      {error && (
        <div className="rounded-xl border border-status-red/20 bg-status-red/5 p-4 text-xs text-status-red flex items-center gap-2">
          <span>⚠️</span>
          <p>{error}</p>
        </div>
      )}

      {/* History List */}
      <div className="rounded-2xl border border-border-default bg-bg-secondary p-4 sm:p-6">
        <h3 className="text-xs font-semibold text-text-primary mb-4 flex items-center gap-1.5">
          <Clock size={14} className="text-text-secondary" />
          Insight History
        </h3>

        {history.length === 0 ? (
          <div className="py-12 text-center">
            <FileText className="mx-auto text-text-tertiary/40 mb-3" size={32} />
            <p className="text-xs font-medium text-text-secondary">No financial insights generated yet</p>
            <p className="text-[10px] text-text-tertiary mt-1">
              Click the button above to run your first automated report.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-border-subtle/50">
            {history.map((record) => {
              const formattedDate = formatDate(record.createdAt);
              // Simple preview extract (remove markdown tags for preview text)
              const previewText = record.content
                .replace(/[#*_-]/g, "")
                .substring(0, 140)
                .trim() + "...";

              return (
                <button
                  key={record.id}
                  onClick={() => setSelectedInsight(record)}
                  className="w-full text-left py-4 flex items-start justify-between group hover:bg-bg-tertiary/20 px-2 rounded-xl transition-colors duration-150"
                >
                  <div className="space-y-1 pr-4 min-w-0">
                    <div className="flex items-center gap-2">
                      <Calendar size={12} className="text-text-tertiary" />
                      <span className="text-[10px] text-text-tertiary">{formattedDate}</span>
                    </div>
                    <h4 className="text-xs font-bold text-text-primary group-hover:text-accent transition-colors truncate">
                      {record.title}
                    </h4>
                    <p className="text-[11px] text-text-secondary truncate max-w-xl">
                      {previewText}
                    </p>
                  </div>
                  <ChevronRight
                    size={16}
                    className="text-text-tertiary group-hover:text-accent group-hover:translate-x-0.5 transition-all self-center shrink-0"
                  />
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Progress Popup for generating */}
      {generating && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="w-full max-w-sm rounded-2xl border border-border-default bg-bg-secondary p-6 shadow-2xl text-center space-y-4">
            <Loader2 className="animate-spin text-accent mx-auto" size={36} />
            <div className="space-y-1">
              <h3 className="text-sm font-semibold text-text-primary">Generating AI Analysis</h3>
              <p className="text-[10px] text-accent animate-pulse font-medium">
                {generationStep}
              </p>
            </div>
            <p className="text-[10px] text-text-tertiary">
              This process queries Plaid databases, computes month-over-month spends, and generates custom recommendations using Gemini.
            </p>
          </div>
        </div>
      )}

      {/* Detailed Overlay Dialog */}
      {selectedInsight && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 backdrop-blur-xs p-4 overflow-y-auto">
          <div className="my-8 w-full max-w-2xl rounded-2xl border border-border-default bg-bg-secondary shadow-2xl flex flex-col max-h-[85vh]">
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-border-subtle px-5 py-4 shrink-0">
              <div className="space-y-0.5">
                <h3 className="text-xs font-bold text-text-primary flex items-center gap-1.5">
                  <Sparkles size={14} className="text-accent animate-pulse" />
                  {selectedInsight.title}
                </h3>
                <p className="text-[10px] text-text-tertiary flex items-center gap-1">
                  <Calendar size={10} />
                  Generated on {formatDate(selectedInsight.createdAt)}
                </p>
              </div>
              <button
                onClick={() => setSelectedInsight(null)}
                className="rounded-lg p-1.5 text-text-tertiary transition-colors hover:bg-bg-tertiary hover:text-text-primary"
              >
                <X size={16} />
              </button>
            </div>

            {/* Modal Scrollable Content */}
            <div className="px-6 py-5 overflow-y-auto flex-1 custom-scrollbar">
              <div className="prose prose-invert max-w-none">
                {parseMarkdown(selectedInsight.content)}
              </div>
            </div>

            {/* Modal Footer */}
            <div className="border-t border-border-subtle px-5 py-3 flex justify-end shrink-0">
              <button
                onClick={() => setSelectedInsight(null)}
                className="rounded-xl border border-border-default bg-bg-tertiary px-4 py-2 text-xs font-semibold text-text-primary transition-colors hover:bg-bg-tertiary/75"
              >
                Close Report
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
