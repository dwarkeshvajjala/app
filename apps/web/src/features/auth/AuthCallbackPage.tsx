import { useEffect, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";

import { useAuth } from "./AuthContext";

export function AuthCallbackPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { loginWithGoogleCode } = useAuth();
  const [error, setError] = useState<string | null>(null);
  const attempted = useRef(false);

  useEffect(() => {
    if (attempted.current) return;
    attempted.current = true;

    const code = searchParams.get("code");
    if (!code) {
      setError("Missing authorization code.");
      return;
    }

    loginWithGoogleCode(code)
      .then(() => navigate("/", { replace: true }))
      .catch((err: unknown) => {
        setError(err instanceof Error ? err.message : "Google sign-in failed.");
      });
  }, [searchParams, loginWithGoogleCode, navigate]);

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4 px-6 text-center">
      {error ? (
        <>
          <p className="text-recovery-orphaned">{error}</p>
          <a href="/login" className="text-sm underline">
            Back to sign in
          </a>
        </>
      ) : (
        <p className="text-text-muted">Signing you in...</p>
      )}
    </main>
  );
}
