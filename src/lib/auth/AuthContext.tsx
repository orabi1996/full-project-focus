import type { Factor, Session, User } from "@supabase/supabase-js";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";

import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "../../integrations/supabase/client";
import { isDemoModeEnabled } from "../config/runtime-config";
import { resolvePrimaryRole, type AuthRole } from "./roles";
import { toAuthErrorMessage } from "./auth-errors";
import { clearSensitiveQueryCache } from "../query/query-client";

export type { AuthRole } from "./roles";

interface AuthContextValue {
  session: Session | null;
  user: User | null;
  role: AuthRole;
  isLoading: boolean;
  isDemo: boolean;
  isRecoveryMode: boolean;
  sessionExpired: boolean;
  aal: "aal1" | "aal2";
  nextLevel: "aal1" | "aal2";
  needsMfa: boolean;
  mfaFactors: Factor[];
  signIn: (email: string, password: string) => Promise<{ error?: string }>;
  sendOtp: (email: string) => Promise<{ error?: string }>;
  verifyOtp: (email: string, token: string) => Promise<{ error?: string }>;
  verifyMfaLogin: (code: string) => Promise<{ error?: string }>;
  refreshMfaState: () => Promise<void>;
  requestPasswordReset: (email: string) => Promise<{ error?: string }>;
  updatePassword: (newPassword: string) => Promise<{ error?: string }>;
  dismissSessionExpired: () => void;
  signOut: () => Promise<void>;
  enterDemo: () => void;
  leaveDemo: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

const demoModeEnabled = isDemoModeEnabled(
  import.meta.env["VITE_ENABLE_DEMO_MODE"],
  import.meta.env.PROD,
);

const DEMO_SESSION_KEY = "hrms_demo_session";

function hasPersistedDemoSession() {
  if (typeof window === "undefined" || import.meta.env.PROD || !demoModeEnabled) return false;

  try {
    return window.sessionStorage.getItem(DEMO_SESSION_KEY) === "active";
  } catch {
    return false;
  }
}

function persistDemoSession(active: boolean) {
  if (typeof window === "undefined") return;

  try {
    if (active && !import.meta.env.PROD && demoModeEnabled) {
      window.sessionStorage.setItem(DEMO_SESSION_KEY, "active");
    } else {
      window.sessionStorage.removeItem(DEMO_SESSION_KEY);
    }
  } catch {
    // Demo persistence is a convenience only; authentication must keep working without storage.
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const [session, setSession] = useState<Session | null>(null);
  const [role, setRole] = useState<AuthRole>("employee");
  const [isLoading, setIsLoading] = useState(true);
  const [isDemo, setIsDemo] = useState(false);
  const [isRecoveryMode, setIsRecoveryMode] = useState(false);
  const [sessionExpired, setSessionExpired] = useState(false);
  const [aal, setAal] = useState<"aal1" | "aal2">("aal1");
  const [nextLevel, setNextLevel] = useState<"aal1" | "aal2">("aal1");
  const [mfaFactors, setMfaFactors] = useState<Factor[]>([]);

  const hadActiveSession = useRef(false);
  const isExplicitSignOut = useRef(false);
  const previousUserId = useRef<string | null>(null);

  const loadRole = useCallback(async (userId: string) => {
    try {
      const { data, error } = await supabase.from("user_roles").select("role").eq("user_id", userId);
      if (!error) {
        setRole(resolvePrimaryRole((data ?? []).map((assignment) => assignment.role)));
      }
    } catch {
      setRole("employee");
    }
  }, []);

  const refreshMfaState = useCallback(async () => {
    try {
      const [{ data: aalData }, { data: factorsData }] = await Promise.all([
        supabase.auth.mfa.getAuthenticatorAssuranceLevel(),
        supabase.auth.mfa.listFactors(),
      ]);

      if (aalData) {
        setAal((aalData.currentLevel ?? "aal1") as "aal1" | "aal2");
        setNextLevel((aalData.nextLevel ?? "aal1") as "aal1" | "aal2");
      }
      if (factorsData) {
        setMfaFactors(factorsData.all ?? []);
      }
    } catch {
      // Non-blocking
    }
  }, []);

  const needsMfa = Boolean(session && aal === "aal1" && nextLevel === "aal2");

  useEffect(() => {
    let mounted = true;

    const persistedDemoSession = hasPersistedDemoSession();
    setIsDemo(persistedDemoSession);
    if (persistedDemoSession) setIsLoading(false);

    // Detect recovery tokens in URL on initial mount
    if (typeof window !== "undefined") {
      const hash = window.location.hash || "";
      const search = window.location.search || "";
      if (
        hash.includes("type=recovery") ||
        search.includes("recovery=true") ||
        hash.includes("access_token") && hash.includes("recovery")
      ) {
        setIsRecoveryMode(true);
      }
    }

    supabase.auth
      .getSession()
      .then(({ data }) => {
        if (!mounted) return;
        const currentUserId = data.session?.user?.id ?? null;
        previousUserId.current = currentUserId;
        setSession(data.session);
        if (currentUserId) {
          persistDemoSession(false);
          setIsDemo(false);
          hadActiveSession.current = true;
          void loadRole(currentUserId);
          void refreshMfaState();
        } else {
          setIsDemo(hasPersistedDemoSession());
        }
      })
      .catch(() => {
        if (!mounted) return;
        previousUserId.current = null;
        setSession(null);
        setIsDemo(hasPersistedDemoSession());
      })
      .finally(() => {
        if (mounted) setIsLoading(false);
      });

    const { data: listener } = supabase.auth.onAuthStateChange((event, nextSession) => {
      if (!mounted) return;

      const nextUserId = nextSession?.user?.id ?? null;

      if (event === "PASSWORD_RECOVERY") {
        setIsRecoveryMode(true);
      }

      if (event === "TOKEN_REFRESHED") {
        setSession(nextSession);
        if (nextUserId) {
          previousUserId.current = nextUserId;
          void loadRole(nextUserId);
          void refreshMfaState();
        }
      } else if (event === "SIGNED_OUT") {
        const preserveDemo = !hadActiveSession.current && hasPersistedDemoSession();
        clearSensitiveQueryCache(queryClient);
        // Detect unexpected session expiration
        if (hadActiveSession.current && !isExplicitSignOut.current) {
          setSessionExpired(true);
        }
        hadActiveSession.current = false;
        isExplicitSignOut.current = false;
        previousUserId.current = null;
        setSession(null);
        setIsDemo(preserveDemo);
        setAal("aal1");
        setNextLevel("aal1");
        setMfaFactors([]);
        setRole("employee");
      } else {
        // Clear previous user's cached HR data if authenticated identity changes without full reload
        if (previousUserId.current && nextUserId && previousUserId.current !== nextUserId) {
          clearSensitiveQueryCache(queryClient);
        }
        previousUserId.current = nextUserId;
        setSession(nextSession);
        if (nextUserId) {
          persistDemoSession(false);
          setIsDemo(false);
          hadActiveSession.current = true;
          void loadRole(nextUserId);
          void refreshMfaState();
        } else {
          setIsDemo(hasPersistedDemoSession());
          setRole("employee");
          setAal("aal1");
          setNextLevel("aal1");
          setMfaFactors([]);
        }
      }

      setIsLoading(false);
    });

    return () => {
      mounted = false;
      listener.subscription.unsubscribe();
    };
  }, [loadRole, refreshMfaState, queryClient]);

  // Production-grade password login with real error classification
  const signIn = useCallback(
    async (email: string, password: string) => {
      try {
        const { data, error } = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password,
        });

        if (error) {
          return { error: toAuthErrorMessage(error) };
        }

        if (data.session) {
          persistDemoSession(false);
          setSession(data.session);
          setIsDemo(false);
          hadActiveSession.current = true;
          if (data.session.user.id) void loadRole(data.session.user.id);
          await refreshMfaState();
        }

        return {};
      } catch (err) {
        return { error: toAuthErrorMessage(err) };
      }
    },
    [loadRole, refreshMfaState],
  );

  // Real Supabase OTP generation (sent to registered employee work email)
  const sendOtp = useCallback(async (email: string) => {
    try {
      const { error } = await supabase.auth.signInWithOtp({
        email: email.trim(),
        options: {
          shouldCreateUser: false,
        },
      });

      if (error) {
        return { error: toAuthErrorMessage(error) };
      }

      return {};
    } catch (err) {
      return { error: toAuthErrorMessage(err) };
    }
  }, []);

  // Real Supabase OTP verification (establishes real session, NEVER enters demo)
  const verifyOtp = useCallback(
    async (email: string, token: string) => {
      try {
        const { data, error } = await supabase.auth.verifyOtp({
          email: email.trim(),
          token: token.trim(),
          type: "email",
        });

        if (error) {
          return { error: toAuthErrorMessage(error) };
        }

        if (!data.session) {
          return { error: "تعذر إنشاء الجلسة الموثقة. يرجى طلب رمز جديد." };
        }

        setSession(data.session);
        persistDemoSession(false);
        setIsDemo(false);
        hadActiveSession.current = true;
        if (data.session.user.id) void loadRole(data.session.user.id);
        await refreshMfaState();

        return {};
      } catch (err) {
        return { error: toAuthErrorMessage(err) };
      }
    },
    [loadRole, refreshMfaState],
  );

  // Real Supabase MFA TOTP verification during login (promotes session to AAL2, NEVER enters demo)
  const verifyMfaLogin = useCallback(
    async (code: string) => {
      try {
        const cleanCode = code.trim().replace(/\s+/g, "");
        if (cleanCode.length !== 6) {
          return { error: "يرجى إدخال رمز التحقق المكون من 6 أرقام." };
        }

        let factors = mfaFactors;
        if (!factors.length) {
          const { data } = await supabase.auth.mfa.listFactors();
          factors = data?.all ?? [];
          setMfaFactors(factors);
        }

        const verifiedTotp = factors.find(
          (f) => f.factor_type === "totp" && f.status === "verified",
        );

        if (!verifiedTotp) {
          return { error: "لم يتم العثور على تطبيق مصادقة مفعل لهذا الحساب." };
        }

        const { data, error } = await supabase.auth.mfa.challengeAndVerify({
          factorId: verifiedTotp.id,
          code: cleanCode,
        });

        if (error) {
          return { error: toAuthErrorMessage(error) };
        }

        if (data) {
          setAal("aal2");
          setNextLevel("aal2");
          await refreshMfaState();
        }

        return {};
      } catch (err) {
        return { error: toAuthErrorMessage(err) };
      }
    },
    [mfaFactors, refreshMfaState],
  );

  // Real Supabase password reset request
  const requestPasswordReset = useCallback(async (email: string) => {
    try {
      const origin = typeof window !== "undefined" ? window.location.origin : "";
      const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
        redirectTo: `${origin}/login?recovery=true`,
      });

      if (error) {
        return { error: toAuthErrorMessage(error) };
      }

      return {};
    } catch (err) {
      return { error: toAuthErrorMessage(err) };
    }
  }, []);

  // Real Supabase password update for recovery mode
  const updatePassword = useCallback(async (newPassword: string) => {
    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) {
        return { error: toAuthErrorMessage(error) };
      }
      setIsRecoveryMode(false);
      return {};
    } catch (err) {
      return { error: toAuthErrorMessage(err) };
    }
  }, []);

  const dismissSessionExpired = useCallback(() => {
    setSessionExpired(false);
  }, []);

  const signOut = useCallback(async () => {
    isExplicitSignOut.current = true;
    hadActiveSession.current = false;
    previousUserId.current = null;
    persistDemoSession(false);
    setIsDemo(false);
    setAal("aal1");
    setNextLevel("aal1");
    setMfaFactors([]);
    clearSensitiveQueryCache(queryClient);
    await supabase.auth.signOut();
  }, [queryClient]);

  const value = useMemo<AuthContextValue>(
    () => ({
      session,
      user: session?.user ?? null,
      role,
      isLoading,
      isDemo,
      isRecoveryMode,
      sessionExpired,
      aal,
      nextLevel,
      needsMfa,
      mfaFactors,
      signIn,
      sendOtp,
      verifyOtp,
      verifyMfaLogin,
      refreshMfaState,
      requestPasswordReset,
      updatePassword,
      dismissSessionExpired,
      signOut,
      enterDemo: () => {
        // Enforce strict security: Production environments CANNOT enter Demo mode
        if (import.meta.env.PROD || !demoModeEnabled) {
          console.warn("Access to Demo mode is restricted in production environments.");
          return;
        }
        persistDemoSession(true);
        setIsDemo(true);
      },
      leaveDemo: () => {
        persistDemoSession(false);
        setIsDemo(false);
      },
    }),
    [
      session,
      role,
      isLoading,
      isDemo,
      isRecoveryMode,
      sessionExpired,
      aal,
      nextLevel,
      needsMfa,
      mfaFactors,
      signIn,
      sendOtp,
      verifyOtp,
      verifyMfaLogin,
      refreshMfaState,
      requestPasswordReset,
      updatePassword,
      dismissSessionExpired,
      signOut,
    ],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used within AuthProvider");
  return context;
}
