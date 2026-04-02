"use client";

import { useCallback, useEffect, useState } from "react";
import { usePlaidLink } from "react-plaid-link";
import { Plus } from "lucide-react";
import { cn } from "@/shared/lib/utils";

export function PlaidLinkButton({ onSuccess }: { onSuccess?: () => void }) {
  const [linkToken, setLinkToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const fetchLinkToken = useCallback(async () => {
    setLoading(true);
    const res = await fetch("/api/plaid/create-link-token", { method: "POST" });
    const data = await res.json();
    setLinkToken(data.link_token);
    setLoading(false);
  }, []);

  const { open, ready } = usePlaidLink({
    token: linkToken,
    onSuccess: async (publicToken, metadata) => {
      await fetch("/api/plaid/exchange-token", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          public_token: publicToken,
          institution: metadata.institution,
        }),
      });
      onSuccess?.();
    },
  });

  useEffect(() => {
    if (linkToken && ready) {
      open();
    }
  }, [linkToken, ready, open]);

  return (
    <button
      onClick={fetchLinkToken}
      disabled={loading}
      className={cn(
        "flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors",
        "bg-accent text-white hover:opacity-90 disabled:opacity-50"
      )}
    >
      <Plus size={16} />
      {loading ? "Connecting..." : "Connect Account"}
    </button>
  );
}
