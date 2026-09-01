import { Button } from "@backline/ui";
import { type FormEvent, useState } from "react";
import { useNavigate } from "react-router-dom";

import { useAuth } from "./AuthContext";
import { buildGoogleAuthUrl } from "./google-oauth-url";

import emailIcon from "../../assets/icons/email-1-svgrepo-com.svg";
import googleLogo from "../../assets/icons/google-icon-logo-svgrepo-com.svg";

export function LoginPage() {
  const { requestOtp, verifyOtp } = useAuth();
  const navigate = useNavigate();
  const [step, setStep] = useState<"email" | "code">("email");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleRequestOtp(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setIsSubmitting(true);
    try {
      await requestOtp(email);
      setStep("code");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleVerifyOtp(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setIsSubmitting(true);
    try {
      await verifyOtp(email, code);
      navigate("/", { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Incorrect code.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-sm flex-col justify-center gap-6 px-6">
      <h1 className="text-2xl font-semibold">Sign in to Backline</h1>

      <a
        href={buildGoogleAuthUrl()}
        className="hover:bg-bg-canvas inline-flex items-center justify-center gap-2 rounded-md border border-black/10 px-4 py-2 text-sm font-medium dark:border-white/10"
      >
        <img src={googleLogo} alt="" className="h-5 w-5" />
        Continue with Google
      </a>

      <div className="text-text-muted flex items-center gap-3 text-xs">
        <div className="h-px flex-1 bg-current opacity-20" />
        or
        <div className="h-px flex-1 bg-current opacity-20" />
      </div>

      {step === "email" && (
        <form className="flex flex-col gap-3" onSubmit={handleRequestOtp}>
          <label className="flex flex-col gap-1 text-sm">
            <div className="flex items-center gap-1.5">
              <img src={emailIcon} alt="" className="h-4 w-4" />
              Email
            </div>
            <input
              type="email"
              required
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              className="rounded-md border border-black/10 px-3 py-2 dark:border-white/10 dark:bg-transparent"
            />
          </label>
          {error && <p className="text-recovery-orphaned text-sm">{error}</p>}
          <Button type="submit" disabled={isSubmitting}>
            Send sign-in code
          </Button>
        </form>
      )}

      {step === "code" && (
        <form className="flex flex-col gap-3" onSubmit={handleVerifyOtp}>
          <p className="text-text-muted text-sm">We sent a 6-digit code to {email}.</p>
          <label className="flex flex-col gap-1 text-sm">
            Code
            <input
              type="text"
              inputMode="numeric"
              pattern="[0-9]{6}"
              required
              value={code}
              onChange={(event) => setCode(event.target.value)}
              className="rounded-md border border-black/10 px-3 py-2 tracking-widest dark:border-white/10 dark:bg-transparent"
            />
          </label>
          {error && <p className="text-recovery-orphaned text-sm">{error}</p>}
          <Button type="submit" disabled={isSubmitting}>
            Verify and sign in
          </Button>
          <button
            type="button"
            className="text-text-muted text-left text-xs underline"
            onClick={() => setStep("email")}
          >
            Use a different email
          </button>
        </form>
      )}
    </main>
  );
}
