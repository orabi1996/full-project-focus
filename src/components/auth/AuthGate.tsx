import React, { type ReactNode } from "react";
import { Navigate } from "@tanstack/react-router";
import { useAuth } from "../../lib/auth/AuthContext";
import { Loader2 } from "lucide-react";
import { MfaVerificationGate } from "./MfaVerificationGate";

export function AuthGate({ children }: { children: ReactNode }) {
  const { session, isDemo, isLoading, needsMfa } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen grid place-items-center bg-background text-foreground" dir="rtl">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-9 w-9 animate-spin text-primary" />
          <p className="text-xs font-bold text-muted-foreground">جارٍ تجهيز بيئة العمل الآمنة…</p>
        </div>
      </div>
    );
  }

  if (!session && !isDemo) return <Navigate to="/login" replace />;

  // Enforce AAL2: Block protected application access until MFA challenge succeeds
  if (needsMfa) {
    return <MfaVerificationGate />;
  }

  return <>{children}</>;
}
