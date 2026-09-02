import React from "react";
import * as LucideIcons from "lucide-react";
import * as PhosphorIcons from "@phosphor-icons/react";

export type IconSource = "material" | "lucide" | "phosphor" | "fa" | "flaticon" | "icons8";

export interface IconSymbolProps extends React.HTMLAttributes<HTMLElement> {
  name: string;
  source?: IconSource;
  size?: number | string;
  className?: string;
  color?: string;
  weight?: "thin" | "light" | "regular" | "bold" | "fill" | "duotone";
  filled?: boolean;
}

export const IconSymbol: React.FC<IconSymbolProps> = ({
  name,
  source = "material",
  size = 20,
  className = "",
  color,
  weight = "regular",
  filled = false,
  ...props
}) => {
  // 1. Google Material Symbols (Rounded & Outlined)
  if (source === "material") {
    return (
      <span
        className={`material-symbols-rounded ${filled ? "filled" : ""} ${className}`}
        style={{
          fontSize: typeof size === "number" ? `${size}px` : size,
          color,
          lineHeight: 1,
          verticalAlign: "middle",
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
        }}
        {...props}
      >
        {name}
      </span>
    );
  }

  // 2. Phosphor Icons
  if (source === "phosphor") {
    const Component = (PhosphorIcons as unknown as Record<string, React.ElementType>)[name];
    if (Component) {
      return (
        <Component
          size={size}
          color={color}
          weight={weight}
          className={`inline-block shrink-0 ${className}`}
          {...props}
        />
      );
    }
    return <span className={className}>{name}</span>;
  }

  // 3. Font Awesome 6
  if (source === "fa") {
    const faClass = name.startsWith("fa-") ? `fa-solid ${name}` : name;
    return (
      <i
        className={`${faClass} ${className}`}
        style={{
          fontSize: typeof size === "number" ? `${size}px` : size,
          color,
        }}
        {...props}
      />
    );
  }

  // 4. Icons8 / Flaticon Colored 3D & Flat Vector Badges
  if (source === "flaticon" || source === "icons8") {
    const badgeColorMap: Record<string, string> = {
      users: "flaticon-badge-blue",
      payroll: "flaticon-badge-purple",
      attendance: "flaticon-badge-emerald",
      leaves: "flaticon-badge-amber",
      organization: "flaticon-badge-blue",
      shield: "flaticon-badge-emerald",
      settings: "flaticon-badge-blue",
    };
    const badgeClass = badgeColorMap[name.toLowerCase()] || "flaticon-badge-blue";

    return (
      <span
        className={`inline-flex items-center justify-center rounded-2xl p-2 shadow-sm ${badgeClass} ${className}`}
        style={{
          width: typeof size === "number" ? `${size + 14}px` : size,
          height: typeof size === "number" ? `${size + 14}px` : size,
        }}
        {...props}
      >
        <span
          className="material-symbols-rounded filled"
          style={{ fontSize: typeof size === "number" ? `${size}px` : size }}
        >
          {name}
        </span>
      </span>
    );
  }

  // 5. Default / Fallback: Lucide Icons
  const LucideComp = (LucideIcons as unknown as Record<string, React.ElementType>)[name];
  if (LucideComp) {
    return (
      <LucideComp
        size={size}
        color={color}
        className={`inline-block shrink-0 ${className}`}
        {...props}
      />
    );
  }

  // Final fallback to Material symbol name
  return (
    <span
      className={`material-symbols-rounded ${className}`}
      style={{ fontSize: typeof size === "number" ? `${size}px` : size, color }}
      {...props}
    >
      {name}
    </span>
  );
};
