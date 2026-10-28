import { useState, useEffect } from "react";

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
