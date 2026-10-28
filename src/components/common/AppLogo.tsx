import React from "react";
import madarxLogo from "../../assets/madarx-logo.png";
import madarxMark from "../../assets/madarx-mark.png";
import type { BrandLogoId } from "./app-logo.constants";

export type { BrandLogoId, BrandLogoConfig } from "./app-logo.constants";

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

export default AppLogo;
