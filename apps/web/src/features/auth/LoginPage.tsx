import { type ClipboardEvent, type FormEvent, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";

import { useAuth } from "./AuthContext";
import { useDocumentTitle } from "../../lib/use-document-title";
import { buildGoogleAuthUrl } from "./google-oauth-url";

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
    <div className="lg" id="lgGate">
      <section className="lg-side">
        <div className="lg-brand">
          <span className="lg-mark">B</span>
          <span><b>Backline</b><em>CLIENT REVIEW, IN ONE PLACE</em></span>
        </div>

        <div className="lg-form">
          <div id="lg-in">
            <h1>{t('auth.login.title' as TranslationKeys)}</h1>

            <a href={buildGoogleAuthUrl()} className="lg-google" data-lg-google="1">
              <svg width="17" height="17" viewBox="0 0 48 48" aria-hidden="true"><path fill="#4285F4" d="M45.1 24.5c0-1.6-.1-3.2-.4-4.7H24v8.9h11.8c-.5 2.7-2 5.1-4.4 6.7v5.5h7.1c4.2-3.8 6.6-9.5 6.6-16.4z"/><path fill="#34A853" d="M24 46c5.9 0 10.9-2 14.5-5.3l-7.1-5.5c-2 1.3-4.5 2.1-7.4 2.1-5.7 0-10.5-3.8-12.2-9H4.5v5.7C8.1 41.2 15.5 46 24 46z"/><path fill="#FBBC05" d="M11.8 28.3c-.4-1.3-.7-2.7-.7-4.3s.3-2.9.7-4.3v-5.7H4.5C2.9 17.2 2 20.5 2 24s.9 6.8 2.5 10l7.3-5.7z"/><path fill="#EA4335" d="M24 10.7c3.2 0 6.1 1.1 8.4 3.3l6.3-6.3C34.9 4.1 29.9 2 24 2 15.5 2 8.1 6.8 4.5 13.9l7.3 5.7c1.7-5.2 6.5-8.9 12.2-8.9z"/></svg>
              {t('auth.login.google' as TranslationKeys)}
            </a>
            <div className="lg-or">OR USE YOUR EMAIL</div>

            {step === "email" && (
              <form className="lg-formel" onSubmit={handleRequestOtp}>
                <div className="lg-f" id="lgf-inMail">
                  <div className="lg-lbl"><label htmlFor="lgInMail">{t('auth.login.email' as TranslationKeys)}</label></div>
                  <span className="lg-inp">
                    <input
                      id="lgInMail"
                      type="email"
                      required
                      autoComplete="email"
                      aria-describedby={error ? errorId : undefined}
                      aria-invalid={error ? true : undefined}
                      value={email}
                      onChange={(event) => setEmail(event.target.value)}
                      placeholder="you@studio.com"
                      spellCheck="false"
                    />
                  </span>
                </div>
                {error && (
                  <p id={errorId} role="alert" className="lg-err">
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="9"/><path d="M12 8v5M12 16h.01"/></svg>
                    <span>{error}</span>
                  </p>
                )}
                <button type="submit" className="lg-go" disabled={isSubmitting}>
                  {isSubmitting ? <span className="lg-spin"></span> : null}
                  {t('auth.login.submit' as TranslationKeys)}
                </button>
              </form>
            )}

            {step === "code" && (
              <form className="lg-formel" onSubmit={handleVerifyOtp}>
                <p className="lg-lede">{t('auth.login.magicLinkSent' as TranslationKeys)}</p>
                <div className="lg-f" id="lgf-inCode">
                  <div className="lg-lbl"><label htmlFor="lgInCode">Code</label></div>
                  <span className="lg-inp">
                    <input
                      id="lgInCode"
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
                      placeholder="000000"
                      style={{ letterSpacing: '0.18em' }}
                    />
                  </span>
                  <p className="lg-err" style={{ color: 'var(--ink-4)', marginTop: '4px' }} role="status" aria-live="polite">
                    {expiresIn > 0
                      ? `Code expires in ${formatCountdown(expiresIn)}`
                      : "This code has expired - request a new one."}
                  </p>
                </div>
                {error && (
                  <p id={errorId} role="alert" className="lg-err">
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="9"/><path d="M12 8v5M12 16h.01"/></svg>
                    <span>{error}</span>
                  </p>
                )}
                <button type="submit" className="lg-go" disabled={isSubmitting || expiresIn <= 0}>
                  {isSubmitting ? <span className="lg-spin"></span> : null}
                  Verify and sign in
                </button>
                <div className="lg-swap">
                  <button
                    type="button"
                    onClick={handleResendOtp}
                    disabled={resendCooldown > 0 || isSubmitting}
                    style={{ opacity: (resendCooldown > 0 || isSubmitting) ? 0.5 : 1, cursor: (resendCooldown > 0 || isSubmitting) ? 'not-allowed' : 'pointer' }}
                  >
                    {resendCooldown > 0 ? `Resend code (${resendCooldown}s)` : "Resend code"}
                  </button>
                  <span style={{ margin: '0 8px' }}>|</span>
                  <button
                    type="button"
                    onClick={() => setStep("email")}
                  >
                    Use a different email
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
        
        <div className="lg-foot">
          <span className="c">&copy; {new Date().getFullYear()} Backline</span>
          <a href="#">Privacy</a>
          <a href="#">Terms</a>
          <a href="#">Support</a>
        </div>
      </section>

      <section className="lg-stage" aria-hidden="true">
        <div className="lg-pitch">
          <h2>Your client points at the thing. You get a ticket.</h2>
          <p>Comments land on the page itself, pinned to the element they are about, with the
            browser and screen size already captured.</p>

          <div className="lg-demo">
            <div className="lg-demo-bar"><i /><i /><i /><span>www.sarvam.ai/pricing</span></div>
            <div className="lg-page">
              <div className="lg-sel" />
              <span className="lg-ln h" />
              <span className="lg-ln h2" />
              <span className="lg-ln" style={{ width: '88%', marginTop: '16px' }} />
              <span className="lg-ln" style={{ width: '74%' }} />
              <span className="lg-ln" style={{ width: '52%' }} />
              <span className="lg-cta" />
              <span className="lg-pin" style={{ background: 'var(--mint)', top: '26px', left: '60%' }}>1</span>
              <span className="lg-pin" style={{ background: 'var(--amber)', top: '118px', left: '14%' }}>2</span>
              <span className="lg-pin" style={{ background: '#5B7FA6', color: '#fff', top: '162px', left: '76%' }}>3</span>
              <div className="lg-note">
                <div className="lg-note-top"><span className="lg-note-av">RK</span><b>Ravi Kulkarni</b><em>18m</em></div>
                <p>The toggle still says annual after I switch to monthly.</p>
                <div><span className="lg-chip on"><span className="d" />In progress</span><span className="lg-chip">Bug</span></div>
              </div>
            </div>
          </div>

          <div className="lg-facts">
            <div className="lg-fact"><b>No account</b><span>FOR REVIEWERS</span></div>
            <div className="lg-fact"><b>No extension</b><span>TO INSTALL</span></div>
            <div className="lg-fact"><b>Every device</b><span>CAPTURED</span></div>
          </div>
        </div>
      </section>
    </div>
  );
}
