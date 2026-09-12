import type { Session, User } from "@supabase/supabase-js";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

import { supabase } from "../../integrations/supabase/client";
import { isDemoModeEnabled } from "../config/runtime-config";
import { resolvePrimaryRole, type AuthRole } from "./roles";

export type { AuthRole } from "./roles";

interface AuthContextValue {
  session: Session | null;
  user: User | null;
  role: AuthRole;
  isLoading: boolean;
  isDemo: boolean;
  signIn: (email: string, password: string) => Promise<{ error?: string }>;
  signOut: () => Promise<void>;
  enterDemo: () => void;
  leaveDemo: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

const demoModeEnabled = isDemoModeEnabled(
  import.meta.env["VITE_ENABLE_DEMO_MODE"],
  import.meta.env.PROD,
);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [roleAssignment, setRoleAssignment] = useState<{ userId: string; role: AuthRole } | null>(
    null,
  );
  const role =
    roleAssignment?.userId === session?.user.id ? (roleAssignment?.role ?? "employee") : "employee";
  const [isLoading, setIsLoading] = useState(true);
  const [isDemo, setIsDemo] = useState(false);

  useEffect(() => {
    let active = true;
    const userId = session?.user.id;
    setRoleAssignment(null);
    if (userId) {
      void (async () => {
        try {
          const { data, error } = await supabase
            .from("user_roles")
            .select("role")
            .eq("user_id", userId);
          if (active && !error)
            setRoleAssignment({
              userId,
              role: resolvePrimaryRole((data ?? []).map((assignment) => assignment.role)),
            });
        } catch {
          // Keep the least-privileged role when the role lookup fails.
        }
      })();
    }
    return () => {
      active = false;
    };
  }, [session?.user.id]);

  useEffect(() => {
    let mounted = true;
    let authEventReceived = false;

    supabase.auth
      .getSession()
      .then(({ data }) => {
        if (!mounted || authEventReceived) return;
        setSession(data.session);
      })
      .catch(() => {
        if (mounted && !authEventReceived) setSession(null);
      })
      .finally(() => {
        if (mounted) setIsLoading(false);
      });

    const { data: listener } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      if (!mounted) return;
      authEventReceived = true;
      setSession(nextSession);
      setIsDemo(false);
      setIsLoading(false);
    });

    return () => {
      mounted = false;
      listener.subscription.unsubscribe();
    };
  }, []);

  const signIn = useCallback(async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return error ? { error: "تعذر تسجيل الدخول. راجع البريد وكلمة المرور." } : {};
  }, []);

  const signOut = useCallback(async () => {
    setIsDemo(false);
    await supabase.auth.signOut();
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      session,
      user: session?.user ?? null,
      role,
      isLoading,
      isDemo,
      signIn,
      signOut,
      enterDemo: () => {
        if (demoModeEnabled) setIsDemo(true);
      },
      leaveDemo: () => setIsDemo(false),
    }),
    [session, role, isLoading, isDemo, signIn, signOut],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used within AuthProvider");
  return context;
}
