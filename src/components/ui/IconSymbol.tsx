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

/**
 * Comprehensive mapping from Google Material Symbol / Material Icon snake_case names
 * to vectorized Lucide React SVG components.
 * This guarantees zero FOUT (Flash of Unstyled Text), zero missing ligature leaks
 * (e.g. "dashboard", "schedule" showing as plain text in Brave browser or offline),
 * and instant, crisp SVG rendering across all client browsers and platforms.
 */
const MATERIAL_TO_LUCIDE_MAP: Record<string, string> = {
  // Navigation & Core HRMS Modules
  dashboard: "LayoutDashboard",
  badge: "IdCard",
  folder_shared: "FolderGit2",
  approval_delegation: "FileCheck2",
  event_available: "CalendarCheck2",
  schedule: "Clock",
  calendar_month: "CalendarDays",
  account_balance_wallet: "Wallet",
  credit_card: "CreditCard",
  receipt_long: "Receipt",
  person_search: "UserSearch",
  trending_up: "TrendingUp",
  monitoring: "Activity",
  devices: "Laptop",
  analytics: "BarChart3",
  verified_user: "ShieldCheck",
  smartphone: "Smartphone",
  tune: "Sliders",
  corporate_fare: "Building2",
  admin_panel_settings: "ShieldAlert",
  hub: "Network",

  // Core Actions & Concepts
  home: "Home",
  people: "Users",
  person: "User",
  group: "Users",
  person_add: "UserPlus",
  person_remove: "UserMinus",
  settings: "Settings",
  search: "Search",
  notifications: "Bell",
  notifications_active: "BellRing",
  add: "Plus",
  edit: "Edit",
  edit_note: "FileEdit",
  delete: "Trash2",
  delete_outline: "Trash2",
  check: "Check",
  check_circle: "CheckCircle2",
  close: "X",
  cancel: "XCircle",
  help: "HelpCircle",
  help_outline: "HelpCircle",
  info: "Info",
  info_outline: "Info",
  warning: "AlertTriangle",
  warning_amber: "AlertTriangle",
  error: "AlertCircle",
  error_outline: "AlertCircle",
  mail: "Mail",
  phone: "Phone",
  download: "Download",
  upload: "Upload",
  file_download: "Download",
  file_upload: "Upload",
  visibility: "Eye",
  visibility_off: "EyeOff",
  lock: "Lock",
  lock_open: "Unlock",
  refresh: "RefreshCw",
  sync: "RefreshCw",
  filter_list: "Filter",
  filter_alt: "Filter",
  sort: "ArrowUpDown",
  more_vert: "MoreVertical",
  more_horiz: "MoreHorizontal",
  chevron_left: "ChevronLeft",
  chevron_right: "ChevronRight",
  arrow_back: "ArrowLeft",
  arrow_forward: "ArrowRight",
  arrow_upward: "ArrowUp",
  arrow_downward: "ArrowDown",
  logout: "LogOut",
  login: "LogIn",
  payments: "DollarSign",
  paid: "DollarSign",
  attach_money: "DollarSign",
  work: "Briefcase",
  work_outline: "Briefcase",
  assignment: "ClipboardList",
  assignment_turned_in: "ClipboardCheck",
  task: "CheckSquare",
  task_alt: "CheckCheck",
  shield: "Shield",
  security: "Shield",
  fingerprint: "Fingerprint",
  location_on: "MapPin",
  place: "MapPin",
  map: "Map",
  timer: "Timer",
  hourglass_empty: "Hourglass",
  hourglass_bottom: "Hourglass",
  history: "History",
  description: "FileText",
  article: "FileText",
  folder: "Folder",
  folder_open: "FolderOpen",
  attach_file: "Paperclip",
  cloud_upload: "UploadCloud",
  cloud_download: "DownloadCloud",
  print: "Printer",
  share: "Share2",
  send: "Send",
  thumb_up: "ThumbsUp",
  thumb_down: "ThumbsDown",
  star: "Star",
  star_border: "Star",
  favorite: "Heart",
  chat: "MessageSquare",
  forum: "MessagesSquare",
  menu: "Menu",
  apps: "Grid",
  school: "GraduationCap",
  domain: "Building",
  business: "Building2",
  apartment: "Building",
  store: "Store",
  category: "LayoutGrid",
  list: "List",
  view_list: "List",
  view_module: "Grid",
  pie_chart: "PieChart",
  bar_chart: "BarChart",
  show_chart: "LineChart",
  table_chart: "Table",
  inventory: "Boxes",
  inventory_2: "Boxes",
  assessment: "BarChart2",
  calculate: "Calculator",
  gavel: "Gavel",
  balance: "Scale",
  id_card: "IdCard",
  qr_code: "QrCode",
  qr_code_scanner: "Scan",
  swap_horiz: "ArrowLeftRight",
  swap_vert: "ArrowUpDown",
  commute: "Car",
  flight: "Plane",
  hotel: "Hotel",
  medical_services: "Stethoscope",
  health_and_safety: "HeartPulse",
  event: "Calendar",
  today: "Calendar",
  date_range: "CalendarRange",
  pending_actions: "ClockAlert",
  rule: "CheckCheck",
};

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
  // 1. First priority: Check Lucide SVG mapping (Handles both "material" and "lucide" sources reliably)
  if (source === "material" || source === "lucide") {
    const lucideName =
      MATERIAL_TO_LUCIDE_MAP[name] ||
      (name in LucideIcons ? name : undefined);

    if (lucideName) {
      const LucideComp = (LucideIcons as unknown as Record<string, React.ElementType>)[lucideName];
      if (LucideComp) {
        return (
          <LucideComp
            size={size}
            color={color}
            className={`inline-block shrink-0 ${className}`}
            fill={filled ? "currentColor" : "none"}
            {...props}
          />
        );
      }
    }
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

  // 5. Direct Lucide fallback by name
  const DirectLucide = (LucideIcons as unknown as Record<string, React.ElementType>)[name];
  if (DirectLucide) {
    return (
      <DirectLucide
        size={size}
        color={color}
        className={`inline-block shrink-0 ${className}`}
        fill={filled ? "currentColor" : "none"}
        {...props}
      />
    );
  }

  // 6. Final fallback: Material Symbols webfont span
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
};
