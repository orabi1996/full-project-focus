import React, { useState, useEffect } from "react";

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
    titleAr: "رأس المال البشري",
    titleEn: "Human Capital Synergy",
    subtitleAr: "شعار ثلاثي يجسد فريق العمل وتكامل رأس المال البشري (موصى به)",
    path: "/brand-options/logo-option-4-hcm-team.png",
    recommended: true,
  },
  {
    id: 2,
    titleAr: "قوس C الديناميكي",
    titleEn: "Dynamic C Arc",
    subtitleAr: "أيقونة انسيابية حديثة تعبر عن الحركة والابتكار",
    path: "/brand-options/logo-option-2-dynamic-c.png",
  },
  {
    id: 3,
    titleAr: "مونوغرام CP",
    titleEn: "CP Monogram",
    subtitleAr: "مونوغرام دائري متناسق يدمج حرفي C و P معاً",
    path: "/brand-options/logo-option-3-cp-monogram.png",
  },
  {
    id: 1,
    titleAr: "حرف P النابض",
    titleEn: "Typographic Pulse",
    subtitleAr: "شعار نصي أفقي مميز مع دمج حرف P النابض وخط السيان",
    path: "/brand-options/logo-option-1-pulse-p.png",
  },
];

const STORAGE_KEY = "classera_active_logo_id";
const EVENT_KEY = "classera-brand-logo-change";

export function getActiveBrandLogoId(): BrandLogoId {
  return 4; // Standardized Official Single Logo: Human Capital Synergy
}

export function getActiveBrandLogoPath(): string {
  const id = getActiveBrandLogoId();
  const found = BRAND_LOGO_OPTIONS.find((o) => o.id === id);
  return found?.path || "/classera-pulse-logo.png";
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
  optionId,
}) => {
  const { activeId, activeConfig } = useActiveBrandLogo();
  const effectiveId = optionId || activeId;
  const config = BRAND_LOGO_OPTIONS.find((o) => o.id === effectiveId) || activeConfig;

  if (variant === "mark") {
    // Compact circular or rounded mark for collapsed sidebar & mobile avatars
    return (
      <div className={`relative flex items-center justify-center shrink-0 ${className}`}>
        <div className="relative h-11 w-11 rounded-2xl bg-white p-1.5 shadow-md shadow-primary/10 border border-border/80 flex items-center justify-center overflow-hidden transition-transform duration-200 hover:scale-105">
          <img
            src={config.path}
            alt={config.titleEn}
            className="h-full w-full object-contain"
            style={
              effectiveId === 3
                ? { transform: "scale(1.9) translateY(-14%)" }
                : effectiveId === 1
                  ? { transform: "scale(2.2) translateX(-18%)" }
                  : { transform: "scale(2.3) translateX(18%)" }
            }
          />
        </div>
      </div>
    );
  }

  return (
    <div className={`flex items-center gap-2.5 ${className}`}>
      <img
        src={config.path}
        alt="Classera Pulse - Human Capital Management"
        className="h-10 w-auto max-w-[220px] object-contain transition-all duration-300 hover:opacity-95"
        style={{ height }}
      />
    </div>
  );
};

/**
 * Interactive Brand Logo Switcher Component
 * Enables live switching between all 4 Classera Pulse designs
 */
export const BrandLogoSwitcher: React.FC<{ compact?: boolean; className?: string }> = () => null;
