"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
} from "react";
import type { Session, User } from "@supabase/supabase-js";
import { ALLOWED_EMAIL_DOMAIN, getSupabaseClient, isAuthorizedEmail } from "./client";

type AuthStatus =
  | "loading"
  | "signed-out"
  | "unauthorized-domain"
  | "authorized";

interface AuthContextValue {
  status: AuthStatus;
  user: User | null;
  session: Session | null;
  signInWithGoogle: () => Promise<void>;
  signInWithEmail: (email: string, password: string) => Promise<{ error: string | null }>;
  signUpWithEmail: (
    email: string,
    password: string
  ) => Promise<{ error: string | null; needsEmailConfirmation: boolean }>;
  signOut: () => Promise<void>;
  errorMessage: string | null;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [status, setStatus] = useState<AuthStatus>("loading");
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const evaluateSession = useCallback(async (nextSession: Session | null) => {
    if (!nextSession || !nextSession.user) {
      setSession(null);
      setUser(null);
      setStatus("signed-out");
      return;
    }

    const authorized = isAuthorizedEmail(nextSession.user.email);

    if (!authorized) {
      // Client-side enforcement: reject and sign the session out immediately.
      // This is a UX-level check only — the real trusted-layer restriction
      // must be enforced in Supabase itself (see supabase/sql/restrict_email_domain.sql).
      setErrorMessage(
        "You are not eligible to access RoadGuard AI. Please use your @miet.ac.in Google account."
      );
      const supabase = getSupabaseClient();
      await supabase.auth.signOut();
      setSession(null);
      setUser(null);
      setStatus("unauthorized-domain");
      return;
    }

    setErrorMessage(null);
    setSession(nextSession);
    setUser(nextSession.user);
    setStatus("authorized");
  }, []);

  useEffect(() => {
    const supabase = getSupabaseClient();

    supabase.auth.getSession().then(({ data }) => {
      evaluateSession(data.session);
    });

    const { data: listener } = supabase.auth.onAuthStateChange(
      (_event, nextSession) => {
        evaluateSession(nextSession);
      }
    );

    return () => {
      listener.subscription.unsubscribe();
    };
  }, [evaluateSession]);

  const signInWithGoogle = useCallback(async () => {
    setErrorMessage(null);
    const supabase = getSupabaseClient();
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo:
          typeof window !== "undefined" ? window.location.origin : undefined,
      },
    });
    if (error) {
      setErrorMessage(error.message);
    }
  }, []);

  const signInWithEmail = useCallback(
    async (email: string, password: string) => {
      setErrorMessage(null);
      const supabase = getSupabaseClient();
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        setErrorMessage(error.message);
        return { error: error.message };
      }

      // If the account exists but the email domain isn't allowed,
      // evaluateSession (triggered by onAuthStateChange) will sign it back
      // out and set status to "unauthorized-domain".
      await evaluateSession(data.session);
      return { error: null };
    },
    [evaluateSession]
  );

  const signUpWithEmail = useCallback(async (email: string, password: string) => {
    setErrorMessage(null);
    const supabase = getSupabaseClient();

    if (!isAuthorizedEmail(email)) {
      const message = `Only @${ALLOWED_EMAIL_DOMAIN} email addresses may register for RoadGuard AI.`;
      setErrorMessage(message);
      return { error: message, needsEmailConfirmation: false };
    }

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo:
          typeof window !== "undefined" ? window.location.origin : undefined,
      },
    });

    if (error) {
      setErrorMessage(error.message);
      return { error: error.message, needsEmailConfirmation: false };
    }

    // Supabase returns a session immediately only when email confirmation is
    // disabled in the dashboard. Otherwise data.session is null and the user
    // must click the confirmation link before they can sign in.
    if (data.session) {
      await evaluateSession(data.session);
      return { error: null, needsEmailConfirmation: false };
    }

    return { error: null, needsEmailConfirmation: true };
  }, [evaluateSession]);

  const signOut = useCallback(async () => {
    const supabase = getSupabaseClient();
    await supabase.auth.signOut();
    setSession(null);
    setUser(null);
    setStatus("signed-out");
  }, []);

  return (
    <AuthContext.Provider
      value={{
        status,
        user,
        session,
        signInWithGoogle,
        signInWithEmail,
        signUpWithEmail,
        signOut,
        errorMessage,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within an AuthProvider");
  return ctx;
}
