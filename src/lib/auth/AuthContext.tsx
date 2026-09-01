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

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [role, setRole] = useState<AuthRole>("employee");
  const [isLoading, setIsLoading] = useState(true);
  const [isDemo, setIsDemo] = useState(false);

  const loadRole = useCallback(async (userId: string) => {
    const { data, error } = await supabase.from("user_roles").select("role").eq("user_id", userId);

    if (!error) setRole(resolvePrimaryRole((data ?? []).map((assignment) => assignment.role)));
  }, []);

  useEffect(() => {
    let mounted = true;

    supabase.auth
      .getSession()
      .then(({ data }) => {
        if (!mounted) return;
        setSession(data.session);
        if (data.session?.user.id) void loadRole(data.session.user.id);
      })
      .catch(() => {
        if (mounted) setSession(null);
      })
      .finally(() => {
        if (mounted) setIsLoading(false);
      });

    const { data: listener } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
      setIsDemo(false);
      if (nextSession?.user.id) void loadRole(nextSession.user.id);
      else setRole("employee");
      setIsLoading(false);
    });

    return () => {
      mounted = false;
      listener.subscription.unsubscribe();
    };
  }, [loadRole]);

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
      enterDemo: () => setIsDemo(true),
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
