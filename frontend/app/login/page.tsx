"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/supabase/AuthProvider";
import { ALLOWED_EMAIL_DOMAIN } from "@/lib/supabase/client";

const FEATURES = [
  { icon: "\u{1F4F9}", label: "Real-time Detection" },
  { icon: "\u{1F9E0}", label: "AI Powered" },
  { icon: "\u20B9", label: "Cost Estimation" },
  { icon: "\u{1F4CA}", label: "Detailed Reports" },
];

type Mode = "sign-in" | "sign-up";

export default function LoginPage() {
  const { status, signInWithGoogle, signInWithEmail, signUpWithEmail, errorMessage } =
    useAuth();
  const router = useRouter();

  const [mode, setMode] = useState<Mode>("sign-in");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [confirmationSent, setConfirmationSent] = useState(false);

  useEffect(() => {
    if (status === "authorized") {
      router.replace("/");
    }
  }, [status, router]);

  if (status === "loading") {
    return <div className="login-loading">Checking your session…</div>;
  }

  const switchMode = (next: Mode) => {
    setMode(next);
    setFormError(null);
    setConfirmationSent(false);
    setPassword("");
    setConfirmPassword("");
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setFormError(null);
    setConfirmationSent(false);

    if (!email || !password) {
      setFormError("Please enter your email and password.");
      return;
    }

    if (mode === "sign-up") {
      if (password.length < 6) {
        setFormError("Password must be at least 6 characters.");
        return;
      }
      if (password !== confirmPassword) {
        setFormError("Passwords do not match.");
        return;
      }
    }

    setSubmitting(true);
    try {
      if (mode === "sign-in") {
        const { error } = await signInWithEmail(email, password);
        if (error) setFormError(error);
      } else {
        const { error, needsEmailConfirmation } = await signUpWithEmail(
          email,
          password
        );
        if (error) {
          setFormError(error);
        } else if (needsEmailConfirmation) {
          setConfirmationSent(true);
        }
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="login-shell">
      <section className="login-hero">
        <div className="brand">
          <div className="brand-logo">{"\u{1F6E1}\uFE0F"}</div>
          <div>
            <h1>
              RoadGuard <span>AI</span>
            </h1>
            <p>Pothole Detection System</p>
          </div>
        </div>

        <h2>
          Smarter Roads,
          <span>Safer Journeys</span>
        </h2>
        <p>
          AI-powered pothole detection and road condition monitoring for
          better infrastructure management.
        </p>

        <div className="login-features">
          {FEATURES.map((feature) => (
            <div className="login-feature" key={feature.label}>
              <div className="login-feature-icon">{feature.icon}</div>
              <span>{feature.label}</span>
            </div>
          ))}
        </div>
      </section>

      <section className="login-panel">
        <div className="login-card">
          <h1>{mode === "sign-in" ? "Welcome Back" : "Create Account"}</h1>
          <p>
            {mode === "sign-in"
              ? "Sign in to your RoadGuard AI account"
              : "Register a new RoadGuard AI account"}
          </p>

          <div className="login-tabs">
            <button
              type="button"
              className={mode === "sign-in" ? "login-tab active" : "login-tab"}
              onClick={() => switchMode("sign-in")}
            >
              Sign In
            </button>
            <button
              type="button"
              className={mode === "sign-up" ? "login-tab active" : "login-tab"}
              onClick={() => switchMode("sign-up")}
            >
              Register
            </button>
          </div>

          {confirmationSent ? (
            <div className="login-success">
              We&apos;ve sent a confirmation link to <strong>{email}</strong>.
              Please verify your email, then sign in.
            </div>
          ) : (
            <form className="login-form" onSubmit={handleSubmit}>
              <label className="login-field">
                <span>Email</span>
                <input
                  type="email"
                  autoComplete="email"
                  placeholder={`you@${ALLOWED_EMAIL_DOMAIN}`}
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </label>

              <label className="login-field">
                <span>Password</span>
                <input
                  type="password"
                  autoComplete={
                    mode === "sign-in" ? "current-password" : "new-password"
                  }
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
              </label>

              {mode === "sign-up" && (
                <label className="login-field">
                  <span>Confirm Password</span>
                  <input
                    type="password"
                    autoComplete="new-password"
                    placeholder="••••••••"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    required
                  />
                </label>
              )}

              <button className="primary-btn" type="submit" disabled={submitting}>
                {submitting
                  ? "Please wait…"
                  : mode === "sign-in"
                    ? "Sign In"
                    : "Create Account"}
              </button>
            </form>
          )}

          <div className="login-divider">
            <span>or</span>
          </div>

          <button className="google-btn" onClick={signInWithGoogle}>
            <GoogleIcon />
            Continue with Google
          </button>

          <p className="login-domain-note">
            Access is limited to @{ALLOWED_EMAIL_DOMAIN} accounts.
          </p>

          {!confirmationSent &&
            (formError || status === "unauthorized-domain" || errorMessage) && (
              <div className="login-error">
                {formError ||
                  errorMessage ||
                  `You are not eligible to access RoadGuard AI. Please use your @${ALLOWED_EMAIL_DOMAIN} account.`}
              </div>
            )}
        </div>
      </section>
    </div>
  );
}

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true">
      <path
        fill="#FFC107"
        d="M43.6 20.5H42V20H24v8h11.3C33.7 32.6 29.3 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.9 1.2 8 3.1l5.7-5.7C34.6 6.1 29.6 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.7-.4-3.5z"
      />
      <path
        fill="#FF3D00"
        d="M6.3 14.7l6.6 4.8C14.6 15.9 18.9 13 24 13c3.1 0 5.9 1.2 8 3.1l5.7-5.7C34.6 6.1 29.6 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"
      />
      <path
        fill="#4CAF50"
        d="M24 44c5.5 0 10.4-2.1 14.1-5.5l-6.5-5.5C29.6 34.9 27 36 24 36c-5.3 0-9.7-3.4-11.3-8.1l-6.5 5C9.6 39.6 16.2 44 24 44z"
      />
      <path
        fill="#1976D2"
        d="M43.6 20.5H42V20H24v8h11.3c-.8 2.3-2.3 4.3-4.2 5.7l6.5 5.5C40.9 36.6 44 31.1 44 24c0-1.3-.1-2.7-.4-3.5z"
      />
    </svg>
  );
}
