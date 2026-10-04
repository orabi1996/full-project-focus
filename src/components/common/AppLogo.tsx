import React, { useState, useEffect } from "react";
import madarxLogo from "../../assets/madarx-logo.png";
import madarxMark from "../../assets/madarx-mark.png";

export type BrandLogoId = 1 | 2 | 3 | 4;

export interface BrandLogoConfig {
  id: BrandLogoId;
  titleAr: string;
  titleEn: string;
  subtitleAr: string;
  path: string;
  recommended?: boolean;
}

export const BRAND_LOGO_OPTIONS: BrandLogoConfig[] = [
  {
    id: 4,
    titleAr: "شعار مدار إكس الرسمي المعتمد",
    titleEn: "MadarX Official Enterprise Identity",
    subtitleAr: "الهوية الرسمية المعتمدة لمنظومة العمل المتكاملة وإدارة رأس المال البشري",
    path: "/madarx-logo.png",
    recommended: true,
  },
  {
    id: 1,
    titleAr: "رمز مدار إكس التقني",
    titleEn: "MadarX Cybernetic Mark",
    subtitleAr: "الأيقونة الرمزية المربعة لإدارة القوى العاملة",
    path: "/madarx-mark.png",
  },
];

const STORAGE_KEY = "madarx_active_logo_id";
const EVENT_KEY = "madarx-brand-logo-change";

export function getActiveBrandLogoId(): BrandLogoId {
  return 4; // Standardized Official Single Logo
}

export function getActiveBrandLogoPath(): string {
  return "/madarx-logo.png";
}

export function getActiveBrandMarkPath(): string {
  return "/madarx-mark.png";
}

export function setActiveBrandLogoId(id: BrandLogoId) {
  if (typeof window !== "undefined") {
    try {
      localStorage.setItem(STORAGE_KEY, String(id));
      window.dispatchEvent(new CustomEvent(EVENT_KEY, { detail: id }));
    } catch {
      // ignore storage error
    }
  }
}

export function useActiveBrandLogo() {
  const [activeId, setActiveId] = useState<BrandLogoId>(getActiveBrandLogoId);

  useEffect(() => {
    const handleCustom = (e: Event) => {
      const customEvent = e as CustomEvent<BrandLogoId>;
      if (customEvent.detail) {
        setActiveId(customEvent.detail);
      } else {
        setActiveId(getActiveBrandLogoId());
      }
    };

    const handleStorage = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY && e.newValue) {
        setActiveId(Number(e.newValue) as BrandLogoId);
      }
    };

    window.addEventListener(EVENT_KEY, handleCustom);
    window.addEventListener("storage", handleStorage);
    return () => {
      window.removeEventListener(EVENT_KEY, handleCustom);
      window.removeEventListener("storage", handleStorage);
    };
  }, []);

  const activeConfig =
    BRAND_LOGO_OPTIONS.find((o) => o.id === activeId) || BRAND_LOGO_OPTIONS[0];

  return {
    activeId,
    activeConfig,
    setBrandLogo: setActiveBrandLogoId,
    options: BRAND_LOGO_OPTIONS,
  };
}

interface AppLogoProps {
  variant?: "full" | "mark" | "horizontal";
  className?: string;
  height?: number | string;
  optionId?: BrandLogoId;
  showTagline?: boolean;
}

export const AppLogo: React.FC<AppLogoProps> = ({
  variant = "full",
  className = "",
  height = 40,
}) => {
  if (variant === "mark") {
    // Compact circular or rounded mark for collapsed sidebar & mobile avatars
    return (
      <div className={`relative flex items-center justify-center shrink-0 ${className}`}>
        <div className="relative h-11 w-11 rounded-2xl bg-white p-1.5 shadow-md shadow-primary/10 border border-border/80 flex items-center justify-center overflow-hidden transition-transform duration-200 hover:scale-105">
          <img
            src={madarxMark || "/madarx-mark.png"}
            alt="MadarX Mark"
            className="h-full w-full object-contain"
            onError={(e) => {
              (e.currentTarget as HTMLImageElement).src = "/madarx-mark.png";
            }}
          />
        </div>
      </div>
    );
  }

  return (
    <div className={`flex items-center gap-2.5 ${className}`}>
      <img
        src={madarxLogo || "/madarx-logo.png"}
        alt="MadarX - Enterprise Workforce Platform (منظومة العمل المتكاملة)"
        className="w-auto max-w-[260px] object-contain transition-all duration-300 hover:opacity-95"
        style={{ height }}
        onError={(e) => {
          (e.currentTarget as HTMLImageElement).src = "/madarx-logo.png";
        }}
      />
    </div>
  );
};

/**
 * Interactive Brand Logo Switcher Component
 */
export const BrandLogoSwitcher: React.FC<{ compact?: boolean; className?: string }> = () => null;
