import React from "react";
import { useApp } from "../../lib/context/AppContext";
import { canAccessModule } from "../../lib/auth/permissions";
import { ShieldAlert, ArrowRight } from "lucide-react";
import { Button } from "../ui/button";
import { useNavigate } from "@tanstack/react-router";

interface RouteGuardProps {
  moduleId: string;
  moduleNameAr: string;
  children: React.ReactNode;
}

export const RouteGuard: React.FC<RouteGuardProps> = ({
  moduleId,
  moduleNameAr,
  children,
}) => {
  const { currentRole } = useApp();
  const navigate = useNavigate();

  if (!canAccessModule(currentRole, moduleId)) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] p-6 text-center">
        <div className="h-16 w-16 rounded-full bg-destructive/10 text-destructive flex items-center justify-center mb-4">
          <ShieldAlert className="h-8 w-8" />
        </div>
        <h2 className="text-xl font-black text-foreground mb-2">
          غير مصرح لك بالوصول إلى {moduleNameAr}
        </h2>
        <p className="text-sm text-muted-foreground max-w-md mb-6 leading-relaxed">
          دورك الحالي ({currentRole}) لا يملك الصلاحيات الكافية لعرض هذه الشاشة وفق مصفوفة الصلاحيات المؤسسية (RBAC).
        </p>
        <Button
          onClick={() => navigate({ to: "/dashboard" })}
          className="rounded-full text-xs font-bold gap-2 cursor-pointer"
        >
          <ArrowRight className="h-4 w-4" />
          العودة للوحة المؤشرات الرئيسية
        </Button>
      </div>
    );
  }

  return <>{children}</>;
};
