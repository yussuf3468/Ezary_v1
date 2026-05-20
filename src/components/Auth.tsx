import { useState } from "react";
import { useAuth } from "../contexts/AuthContext";
import { Mail, Lock, ShieldCheck, AlertCircle } from "lucide-react";
import { Button, Input } from "./ui";

export default function Auth() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const { signIn } = useAuth();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    const { error } = await signIn(email, password);
    if (error) setError(error.message);
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-surface-base flex items-center justify-center px-4 py-10 relative overflow-hidden">
      {/* Subtle backdrop accents */}
      <div className="pointer-events-none absolute -top-32 -left-24 w-[520px] h-[520px] rounded-full bg-brand-100/40 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-32 -right-24 w-[480px] h-[480px] rounded-full bg-info-100/30 blur-3xl" />

      <div className="relative w-full max-w-md">
        {/* Brand */}
        <div className="flex items-center justify-center gap-2.5 mb-7">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-brand-500 to-brand-700 flex items-center justify-center shadow-sm">
            <span className="text-white font-semibold text-base tracking-tight">
              E
            </span>
          </div>
          <div className="text-left leading-tight">
            <div className="text-base font-semibold text-ink-900 tracking-tight">
              Ezary
            </div>
            <div className="text-[11px] text-ink-500 -mt-0.5">
              Client Management
            </div>
          </div>
        </div>

        {/* Card */}
        <div className="bg-white rounded-2xl border border-ink-200/70 shadow-lg p-6 sm:p-8">
          <div className="mb-6">
            <h1 className="text-xl font-semibold text-ink-900 tracking-tight">
              Welcome back
            </h1>
            <p className="text-sm text-ink-500 mt-1">
              Sign in to continue to your workspace
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <Input
              label="Email"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              inputSize="lg"
              leadingIcon={<Mail className="w-4 h-4" />}
              placeholder="you@example.com"
            />

            <Input
              label="Password"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={6}
              inputSize="lg"
              leadingIcon={<Lock className="w-4 h-4" />}
              placeholder="••••••••"
            />

            {error && (
              <div className="flex items-start gap-2 px-3 py-2.5 bg-negative-50 border border-negative-100 rounded-lg text-sm text-negative-700">
                <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <Button
              type="submit"
              variant="primary"
              size="lg"
              block
              loading={loading}
            >
              {loading ? "Signing in…" : "Sign in"}
            </Button>
          </form>

          <div className="mt-6 flex items-start gap-2.5 px-3 py-2.5 bg-info-50 border border-info-100 rounded-lg">
            <ShieldCheck className="w-4 h-4 mt-0.5 shrink-0 text-info-600" />
            <div className="text-xs text-ink-700">
              <span className="font-medium text-info-600">Staff access only.</span>{" "}
              Contact your administrator if you need an account.
            </div>
          </div>
        </div>

        <p className="text-center text-xs text-ink-400 mt-6">
          © {new Date().getFullYear()} Ezary. Built by Lenzro.
        </p>
      </div>
    </div>
  );
}
