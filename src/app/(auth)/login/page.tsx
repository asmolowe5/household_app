"use client";

import { useEffect, useState } from "react";
import { Landmark } from "lucide-react";

export default function LoginPage() {
  const [pin, setPin] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (pin.length === 4 && !loading) {
      void submitPin(pin);
    }
  }, [pin, loading]);

  function handleDigit(digit: string) {
    setError("");
    setPin((prev) => (prev.length >= 4 ? prev : prev + digit));
  }

  async function submitPin(code: string) {
    setLoading(true);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pin: code }),
      });

      if (res.ok) {
        window.location.assign("/dashboard");
        return;
      }

      setError(res.status === 401 ? "Incorrect PIN" : "Login failed");
    } catch {
      setError("Login failed");
    } finally {
      setPin("");
      setLoading(false);
    }
  }

  const handleBackspace = () => {
    setError("");
    setPin((prev) => prev.slice(0, -1));
  };

  const digits = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "", "0", "←"];

  return (
    <div className="w-full max-w-xs px-6">
      <div className="mb-10 flex flex-col items-center">
        <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-accent-muted">
          <Landmark size={20} className="text-accent" strokeWidth={2.4} />
        </div>
        <h1 className="text-lg font-semibold tracking-tight text-text-primary">
          Smolowe Portal
        </h1>
        <p className="mt-1 text-sm text-text-tertiary">Enter your PIN</p>
      </div>

      <div className="mb-8 flex justify-center gap-3">
        {[0, 1, 2, 3].map((i) => (
          <div
            key={i}
            className={`h-3 w-3 rounded-full transition-colors ${
              i < pin.length ? "bg-accent" : "bg-bg-tertiary"
            }`}
          />
        ))}
      </div>

      {error && (
        <p className="mb-4 text-center text-xs text-status-red">{error}</p>
      )}

      <div className="grid grid-cols-3 gap-3">
        {digits.map((d, i) => {
          if (d === "") return <div key={i} />;
          if (d === "←") {
            return (
              <button
                key={i}
                onClick={handleBackspace}
                disabled={loading || pin.length === 0}
                className="flex h-14 items-center justify-center rounded-xl text-lg text-text-secondary transition-colors hover:bg-bg-tertiary disabled:opacity-30"
              >
                ←
              </button>
            );
          }
          return (
            <button
              key={i}
              onClick={() => handleDigit(d)}
              disabled={loading || pin.length >= 4}
              className="flex h-14 items-center justify-center rounded-xl text-lg font-medium text-text-primary transition-colors hover:bg-bg-tertiary active:bg-bg-elevated disabled:opacity-30"
            >
              {d}
            </button>
          );
        })}
      </div>
    </div>
  );
}
