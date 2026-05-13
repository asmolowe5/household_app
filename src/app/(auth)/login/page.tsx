"use client";

import { useEffect, useState } from "react";

const PIN_LENGTH = 8;

export default function LoginPage() {
  const [pin, setPin] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (pin.length === PIN_LENGTH && !loading) {
      void submitPin(pin);
    }
  }, [pin, loading]);

  function handleDigit(digit: string) {
    setError("");
    setPin((current) =>
      current.length >= PIN_LENGTH ? current : current + digit,
    );
  }

  function handleBackspace() {
    setError("");
    setPin((current) => current.slice(0, -1));
  }

  async function submitPin(code: string) {
    setLoading(true);

    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pin: code }),
      });

      if (response.ok) {
        window.location.href = "/dashboard";
        return;
      }

      if (response.status === 429) {
        setError("Too many attempts. Try again in 10 minutes.");
      } else {
        setError(response.status === 401 ? "Incorrect PIN" : "Login failed");
      }
    } catch {
      setError("Login failed");
    } finally {
      setPin("");
      setLoading(false);
    }
  }

  const digits = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "", "0"];

  return (
    <main className="w-full max-w-xs rounded-lg border border-border-default bg-bg-secondary px-6 py-8 shadow-lg">
      <div className="mb-8 text-center">
        <h1 className="text-lg font-semibold tracking-tight text-text-primary">
          Household Portal
        </h1>
        <p className="mt-1 text-sm text-text-tertiary">Enter your PIN</p>
      </div>

      <div className="mb-6 flex justify-center gap-3">
        {Array.from({ length: PIN_LENGTH }, (_, index) => (
          <div
            key={index}
            className={`h-3 w-3 rounded-full transition-colors ${
              index < pin.length ? "bg-accent" : "bg-bg-tertiary"
            }`}
          />
        ))}
      </div>

      {error && (
        <p className="mb-4 text-center text-xs text-status-red">{error}</p>
      )}

      <div className="grid grid-cols-3 gap-3">
        {digits.map((digit, index) => {
          if (digit === "") return <div key={index} />;

          return (
            <button
              key={digit}
              onClick={() => handleDigit(digit)}
              disabled={loading || pin.length >= PIN_LENGTH}
              className="flex h-14 items-center justify-center rounded-xl text-lg font-medium text-text-primary transition-colors hover:bg-bg-tertiary active:bg-bg-elevated disabled:opacity-30"
            >
              {digit}
            </button>
          );
        })}

        <button
          onClick={handleBackspace}
          disabled={loading || pin.length === 0}
          className="col-start-3 flex h-14 items-center justify-center rounded-xl text-sm font-medium text-text-secondary transition-colors hover:bg-bg-tertiary disabled:opacity-30"
        >
          Back
        </button>
      </div>
    </main>
  );
}
