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
  if (typeof window === "undefined") return 4;
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved && (saved === "1" || saved === "2" || saved === "3" || saved === "4")) {
      return Number(saved) as BrandLogoId;
    }
  } catch {
    // fallback if localStorage not accessible
  }
  return 4; // Recommended default: Human Capital Synergy
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
export const BrandLogoSwitcher: React.FC<{ compact?: boolean; className?: string }> = ({
  compact = false,
  className = "",
}) => {
  const { activeId, setBrandLogo, options } = useActiveBrandLogo();

  return (
    <div
      className={`inline-flex items-center gap-1.5 p-1.5 rounded-2xl bg-white/10 dark:bg-card/80 backdrop-blur-md border border-white/20 dark:border-border/80 shadow-lg ${className}`}
      dir="rtl"
    >
      <span className="text-[11px] font-bold text-white/90 dark:text-muted-foreground px-2 hidden sm:inline-block">
        تصميم الهوية:
      </span>
      <div className="flex items-center gap-1">
        {options.map((opt) => {
          const isSelected = activeId === opt.id;
          return (
            <button
              key={opt.id}
              type="button"
              onClick={() => setBrandLogo(opt.id)}
              className={`relative px-2.5 py-1 rounded-xl text-xs font-bold transition-all duration-200 flex items-center gap-1.5 cursor-pointer select-none ${
                isSelected
                  ? "bg-gradient-to-r from-[#004BCE] to-[#00B5FF] text-white shadow-md shadow-blue-500/30 ring-1 ring-white/40"
                  : "text-white/70 dark:text-muted-foreground hover:text-white dark:hover:text-foreground hover:bg-white/15 dark:hover:bg-muted"
              }`}
              title={`${opt.titleAr} - ${opt.subtitleAr}`}
            >
              <span>{compact ? `نموذج ${opt.id}` : opt.titleAr}</span>
              {opt.recommended && !compact && (
                <span className="text-[9px] px-1.5 py-0.2 rounded-full bg-emerald-500/30 text-emerald-300 font-mono">
                  موصى به
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
};
