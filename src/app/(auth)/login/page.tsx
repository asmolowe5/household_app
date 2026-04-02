"use client";

import { useState } from "react";
import { createClient } from "@/shared/lib/supabase/client";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");

    const supabase = createClient();
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      setError(error.message);
      setLoading(false);
    } else {
      router.push("/finance");
      router.refresh();
    }
  }

  return (
    <div className="w-full max-w-sm">
      <h1 className="text-2xl font-semibold text-text-primary mb-8 text-center">
        Smolowe Portal
      </h1>
      <form onSubmit={handleLogin} className="space-y-4">
        <div>
          <label htmlFor="email" className="block text-sm text-text-secondary mb-1.5">
            Email
          </label>
          <input
            id="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full px-3 py-2 rounded-md bg-bg-tertiary border border-border-default text-text-primary text-sm focus:outline-none focus:border-accent"
            required
          />
        </div>
        <div>
          <label htmlFor="password" className="block text-sm text-text-secondary mb-1.5">
            Password
          </label>
          <input
            id="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full px-3 py-2 rounded-md bg-bg-tertiary border border-border-default text-text-primary text-sm focus:outline-none focus:border-accent"
            required
          />
        </div>
        {error && (
          <p className="text-sm text-status-red">{error}</p>
        )}
        <button
          type="submit"
          disabled={loading}
          className="w-full py-2 rounded-md bg-accent text-white text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-50"
        >
          {loading ? "Signing in..." : "Sign in"}
        </button>
      </form>
    </div>
  );
}
