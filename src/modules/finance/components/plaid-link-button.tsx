"use client";

import { useState, useCallback, useEffect } from "react";
import { usePlaidLink } from "react-plaid-link";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";

interface PlaidLinkButtonProps {
  variant?: "primary" | "secondary";
}

export function PlaidLinkButton({ variant = "primary" }: PlaidLinkButtonProps) {
  const [linkToken, setLinkToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  async function fetchLinkToken() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/plaid/create-link-token", { method: "POST" });
      const data = await res.json();
      if (data.link_token) {
        setLinkToken(data.link_token);
      } else {
        setError("Could not connect to Plaid");
      }
    } catch {
      setError("Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  const onSuccess = useCallback(
    async (publicToken: string, metadata: { institution?: { name?: string; institution_id?: string } | null }) => {
      setLoading(true);
      try {
        await fetch("/api/plaid/exchange-token", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            public_token: publicToken,
            institution: metadata.institution,
          }),
        });
        router.refresh();
      } catch {
        setError("Failed to connect account");
      } finally {
        setLoading(false);
      }
    },
    [router],
  );

  const { open, ready } = usePlaidLink({
    token: linkToken,
    onSuccess,
  });

  useEffect(() => {
    if (linkToken && ready) {
      open();
    }
  }, [linkToken, open, ready]);

  if (variant === "secondary") {
    return (
      <button
        onClick={fetchLinkToken}
        disabled={loading}
        className="flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-medium text-accent transition-colors hover:bg-accent-muted disabled:opacity-50"
      >
        <Plus size={14} />
        {loading ? "Connecting..." : "Add Account"}
      </button>
    );
  }

  return (
    <div className="text-center">
      <button
        onClick={fetchLinkToken}
        disabled={loading}
        className="rounded-xl bg-gradient-to-r from-accent to-accent-strong px-6 py-3 text-sm font-semibold text-slate-950 transition-opacity hover:opacity-90 disabled:opacity-50"
      >
        {loading ? "Connecting..." : "Connect Your Bank"}
      </button>
      {error && <p className="mt-2 text-xs text-status-red">{error}</p>}
    </div>
  );
}
