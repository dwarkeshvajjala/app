import { Button } from "@backline/ui";
import { type ClipboardEvent, type FormEvent, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";

import { useAuth } from "./AuthContext";
import { useDocumentTitle } from "../../lib/use-document-title";
import { buildGoogleAuthUrl } from "./google-oauth-url";

import emailIcon from "../../assets/icons/email-1-svgrepo-com.svg";
import googleLogo from "../../assets/icons/google-icon-logo-svgrepo-com.svg";
import type { TranslationKeys } from "../../lib/i18n";

// M-05/UX-AUD-019: matches the backend's actual OTP contract (13-Authentication.md
// §13.2 - 10-minute expiry) so the countdown never promises a code is valid for longer
// than the server will actually honor it.
const RESEND_COOLDOWN_SECONDS = 30;
const OTP_EXPIRY_SECONDS = 10 * 60;

export function LoginPage() {
  const { t } = useTranslation();
  const { requestOtp, verifyOtp } = useAuth();
  useDocumentTitle(t('auth.login.title' as TranslationKeys));
  const navigate = useNavigate();
  const [step, setStep] = useState<"email" | "code">("email");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);
  const [expiresIn, setExpiresIn] = useState(OTP_EXPIRY_SECONDS);
  const codeInputRef = useRef<HTMLInputElement>(null);
  const errorId = "login-form-error";

  // Resend cooldown + expiry countdown - both reset whenever a fresh code is sent
  // (initial request or resend), and stop entirely once we leave the code step.
  useEffect(() => {
    if (step !== "code") return;
    const interval = window.setInterval(() => {
      setResendCooldown((v) => (v > 0 ? v - 1 : 0));
      setExpiresIn((v) => (v > 0 ? v - 1 : 0));
    }, 1000);
    return () => window.clearInterval(interval);
  }, [step]);

  useEffect(() => {
    if (step === "code") {
      codeInputRef.current?.focus();
    }
  }, [step]);

  async function sendOtp() {
    setError(null);
    setIsSubmitting(true);
    try {
      await requestOtp(email);
      setStep("code");
      setCode("");
      setResendCooldown(RESEND_COOLDOWN_SECONDS);
      setExpiresIn(OTP_EXPIRY_SECONDS);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleRequestOtp(event: FormEvent) {
    event.preventDefault();
    await sendOtp();
  }

  async function handleResendOtp() {
    if (resendCooldown > 0 || isSubmitting) return;
    await sendOtp();
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

  function handleCodePaste(event: ClipboardEvent<HTMLInputElement>) {
    const digits = event.clipboardData.getData("text").replace(/\D/g, "").slice(0, 6);
    if (digits.length > 0) {
      event.preventDefault();
      setCode(digits);
    }
  }

  function formatCountdown(totalSeconds: number): string {
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes}:${seconds.toString().padStart(2, "0")}`;
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-sm flex-col justify-center gap-6 px-6">
      <h1 className="text-2xl font-semibold">{t('auth.login.title' as TranslationKeys)}</h1>

      <a
        href={buildGoogleAuthUrl()}
        className="hover:bg-bg-canvas inline-flex items-center justify-center gap-2 rounded-md border border-black/10 px-4 py-2 text-sm font-medium dark:border-white/10"
      >
        <img src={googleLogo} alt="" className="h-5 w-5" />
        {t('auth.login.google' as TranslationKeys)}
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
              {t('auth.login.email' as TranslationKeys)}
            </div>
            <input
              type="email"
              required
              autoComplete="email"
              aria-describedby={error ? errorId : undefined}
              aria-invalid={error ? true : undefined}
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              className="rounded-md border border-black/10 px-3 py-2 dark:border-white/10 dark:bg-transparent"
            />
          </label>
          {error && (
            <p id={errorId} role="alert" className="text-recovery-orphaned text-sm">
              {error}
            </p>
          )}
          <Button type="submit" disabled={isSubmitting}>
            {t('auth.login.submit' as TranslationKeys)}
          </Button>
        </form>
      )}

      {step === "code" && (
        <form className="flex flex-col gap-3" onSubmit={handleVerifyOtp}>
          <p className="text-text-muted text-sm">{t('auth.login.magicLinkSent' as TranslationKeys)}</p>
          <label className="flex flex-col gap-1 text-sm">
            Code
            <input
              ref={codeInputRef}
              type="text"
              inputMode="numeric"
              pattern="[0-9]{6}"
              maxLength={6}
              autoComplete="one-time-code"
              required
              aria-describedby={error ? errorId : undefined}
              aria-invalid={error ? true : undefined}
              value={code}
              onChange={(event) => setCode(event.target.value.replace(/\D/g, "").slice(0, 6))}
              onPaste={handleCodePaste}
              className="rounded-md border border-black/10 px-3 py-2 tracking-widest dark:border-white/10 dark:bg-transparent"
            />
          </label>
          <p className="text-text-muted text-xs" role="status" aria-live="polite">
            {expiresIn > 0
              ? `Code expires in ${formatCountdown(expiresIn)}`
              : "This code has expired - request a new one."}
          </p>
          {error && (
            <p id={errorId} role="alert" className="text-recovery-orphaned text-sm">
              {error}
            </p>
          )}
          <Button type="submit" disabled={isSubmitting || expiresIn <= 0}>
            Verify and sign in
          </Button>
          <button
            type="button"
            className="text-text-muted text-left text-xs underline disabled:cursor-not-allowed disabled:opacity-50"
            onClick={handleResendOtp}
            disabled={resendCooldown > 0 || isSubmitting}
          >
            {resendCooldown > 0 ? `Resend code (${resendCooldown}s)` : "Resend code"}
          </button>
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
