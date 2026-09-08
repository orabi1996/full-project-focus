import React from "react";

interface AppLogoProps {
  variant?: "full" | "mark" | "horizontal";
  className?: string;
  height?: number | string;
  showTagline?: boolean;
}

/**
 * Classera Pulse Official Vector Icon Mark
 * Two dynamic interlocking arcs (Royal Blue & Electric Cyan)
 */
export const ClasseraPulseMark: React.FC<{ className?: string; size?: number }> = ({
  className = "h-9 w-9",
  size = 36,
}) => {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-label="Classera Pulse Icon"
    >
      {/* Left Deep Royal Blue Arc */}
      <path
        d="M 50 12 C 29.01 12 12 29.01 12 50 C 12 70.99 29.01 88 50 88 C 43.5 83 38 74 38 64 C 38 52.95 44.5 43.5 53 38 C 47 38 41 35 36 29 C 40 18 45 13 50 12 Z"
        fill="#004BCE"
      />
      {/* Dynamic interlocking flow */}
      <path
        d="M 52 14 C 31 14 14 31 14 52 C 14 73 31 90 52 90 C 42 82 34 68 34 52 C 34 36 42 22 52 14 Z"
        fill="#004BCE"
      />
      {/* Right Bright Cyan Arc */}
      <path
        d="M 48 86 C 69 86 86 69 86 48 C 86 27 69 10 48 10 C 58 18 66 32 66 48 C 66 64 58 78 48 86 Z"
        fill="#00B5FF"
      />
      {/* Interlocking Cyan Accent Tip */}
      <circle cx="50" cy="50" r="14" fill="white" className="dark:fill-slate-900" />
      <path
        d="M 48 10 C 69 10 86 27 86 48 C 86 69 69 86 48 86 C 56 78 62 64 62 48 C 62 32 56 18 48 10 Z"
        fill="#00B5FF"
      />
      <path
        d="M 52 90 C 31 90 14 73 14 52 C 14 31 31 14 52 14 C 44 22 38 36 38 52 C 38 68 44 82 52 90 Z"
        fill="#004BCE"
      />
    </svg>
  );
};

export const AppLogo: React.FC<AppLogoProps> = ({
  variant = "full",
  className = "",
  height = 40,
  showTagline = true,
}) => {
  if (variant === "mark") {
    return (
      <div className={`relative flex items-center justify-center shrink-0 ${className}`}>
        <div className="relative h-11 w-11 rounded-2xl bg-white p-1 shadow-md shadow-primary/15 border border-primary/20 flex items-center justify-center overflow-hidden">
          <img
            src="/classera-pulse-logo.png"
            alt="Classera Pulse Icon"
            className="h-full w-full object-cover object-left"
            style={{ transform: "scale(2.2) translateX(16%)" }}
          />
        </div>
      </div>
    );
  }

  return (
    <div className={`flex items-center gap-2.5 ${className}`}>
      <img
        src="/classera-pulse-logo.png"
        alt="Classera Pulse - Human Capital Management"
        className="h-10 w-auto max-w-[210px] object-contain transition-all hover:opacity-95"
        style={{ height }}
      />
    </div>
  );
};
