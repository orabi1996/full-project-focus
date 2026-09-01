import React, { useCallback, useMemo, useRef, useState } from "react";
import type { OrgUnit } from "../../types";
import {
  Download,
  Image as ImageIcon,
  Maximize2,
  Minimize2,
  Minus,
  Plus,
  RotateCcw,
  Search,
  Users,
  Building,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { Button } from "../ui/button";
import { Badge } from "../ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "../ui/dialog";

export interface OrgChartNodeData {
  id: string;
  titleAr: string;
  titleEn: string;
  subtitle?: string;
  code?: string;
  kind: "company" | OrgUnit["type"];
  employeeCount?: number;
  openPositions?: number;
  budgetMonthly?: number;
  managerName?: string;
  avatarUrl?: string;
  children: OrgChartNodeData[];
}

interface LaidOutNode extends OrgChartNodeData {
  x: number;
  y: number;
  laidOutChildren: LaidOutNode[];
}

const NODE_W = 240;
const NODE_H = 100;
const H_GAP = 32;
const V_GAP = 70;

const KIND_LABEL: Record<string, string> = {
  company: "المنشأة الرئيسية",
  division: "قطاع تنفيذي",
  department: "إدارة عامة",
  section: "قسم",
  unit: "وحدة",
};

/** Tidy-tree layout: children laid out side by side, parent centered above them. */
function layout(node: OrgChartNodeData, depth: number, cursor: { x: number }): LaidOutNode {
  const y = depth * (NODE_H + V_GAP);
  if (!node.children || !node.children.length) {
    const x = cursor.x;
    cursor.x += NODE_W + H_GAP;
    return { ...node, x, y, laidOutChildren: [] };
  }
  const laidOutChildren = node.children.map((child) => layout(child, depth + 1, cursor));
  const first = laidOutChildren[0]!;
  const last = laidOutChildren[laidOutChildren.length - 1]!;
  const x = (first.x + last.x) / 2;
  return { ...node, x, y, laidOutChildren };
}

function flatten(node: LaidOutNode, acc: LaidOutNode[] = []): LaidOutNode[] {
  acc.push(node);
  node.laidOutChildren.forEach((child) => flatten(child, acc));
  return acc;
}

export const defaultCompanyTree: OrgChartNodeData = {
  id: "comp-root",
  titleAr: "شركة فوكس للحلول التقنية والبرمجيات",
  titleEn: "Focus Tech & Business Solutions Co.",
  subtitle: "م. عبد العزيز الفهد • الرئيس التنفيذي",
  managerName: "م. عبد العزيز الفهد",
  code: "HQ-01",
  kind: "company",
  employeeCount: 120,
  openPositions: 8,
  budgetMonthly: 1250000,
  avatarUrl: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150",
  children: [
    {
      id: "div-tech",
      titleAr: "قطاع هندسة وتطوير البرمجيات",
      titleEn: "Software Engineering & Cloud Division",
      subtitle: "د. طارق المنصور • CTO",
      managerName: "د. طارق المنصور",
      code: "ENG-01",
      kind: "division",
      employeeCount: 48,
      openPositions: 4,
      budgetMonthly: 550000,
      avatarUrl: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150",
      children: [
        {
          id: "dept-fe",
          titleAr: "إدارة الواجهات والمنصات السحابية",
          titleEn: "Frontend & Cloud Platforms Dept.",
          subtitle: "م. ريان القحطاني • مدير الإدارة",
          managerName: "م. ريان القحطاني",
          code: "DEP-101",
          kind: "department",
          employeeCount: 22,
          openPositions: 2,
          budgetMonthly: 260000,
          children: [],
        },
        {
          id: "dept-sec",
          titleAr: "إدارة الأمن السيبراني والعمليات",
          titleEn: "Cybersecurity & DevOps Dept.",
          subtitle: "أ. هيفاء الشهري • CISO",
          managerName: "أ. هيفاء الشهري",
          code: "DEP-102",
          kind: "department",
          employeeCount: 16,
          openPositions: 1,
          budgetMonthly: 210000,
          children: [],
        },
        {
          id: "dept-ai",
          titleAr: "مختبر الذكاء الاصطناعي والبيانات",
          titleEn: "AI & Data Science Lab",
          subtitle: "د. سامي الغامدي • كبير العلماء",
          managerName: "د. سامي الغامدي",
          code: "DEP-103",
          kind: "department",
          employeeCount: 10,
          openPositions: 1,
          budgetMonthly: 180000,
          children: [],
        },
      ],
    },
    {
      id: "div-hr",
      titleAr: "قطاع رأس المال البشري والعمليات",
      titleEn: "Human Capital & Operations Division",
      subtitle: "أ. نورة التميمي • CHRO",
      managerName: "أ. نورة التميمي",
      code: "HR-01",
      kind: "division",
      employeeCount: 36,
      openPositions: 2,
      budgetMonthly: 340000,
      avatarUrl: "https://images.unsplash.com/photo-1580489944761-15a19d654956?w=150",
      children: [
        {
          id: "dept-rec",
          titleAr: "إدارة استقطاب المواهب والتوظيف (ATS)",
          titleEn: "Talent Acquisition Dept.",
          subtitle: "أ. خالد السديري • مدير التوظيف",
          managerName: "أ. خالد السديري",
          code: "DEP-201",
          kind: "department",
          employeeCount: 12,
          openPositions: 1,
          budgetMonthly: 120000,
          children: [],
        },
        {
          id: "dept-pay",
          titleAr: "إدارة مسيرات الرواتب وحماية الأجور (WPS)",
          titleEn: "Payroll & Operations Dept.",
          subtitle: "أ. فيصل الدوسري • مدير الرواتب",
          managerName: "أ. فيصل الدوسري",
          code: "DEP-202",
          kind: "department",
          employeeCount: 14,
          openPositions: 1,
          budgetMonthly: 140000,
          children: [],
        },
        {
          id: "dept-ld",
          titleAr: "إدارة التدريب والتطوير المؤسسي",
          titleEn: "L&D and Org Development",
          subtitle: "أ. سارة الحربي • أخصائي التطوير",
          managerName: "أ. سارة الحربي",
          code: "DEP-203",
          kind: "department",
          employeeCount: 10,
          openPositions: 0,
          budgetMonthly: 80000,
          children: [],
        },
      ],
    },
    {
      id: "div-fin",
      titleAr: "قطاع الشؤون المالية والاستثمار",
      titleEn: "Finance & Investment Division",
      subtitle: "أ. ماجد العتيبي • CFO",
      managerName: "أ. ماجد العتيبي",
      code: "FIN-01",
      kind: "division",
      employeeCount: 24,
      openPositions: 1,
      budgetMonthly: 260000,
      avatarUrl: "https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?w=150",
      children: [
        {
          id: "dept-acc",
          titleAr: "إدارة الحسابات العامة والميزانيات",
          titleEn: "General Accounting Dept.",
          subtitle: "أ. عمر العمودي • كبير المحاسبين",
          managerName: "أ. عمر العمودي",
          code: "DEP-301",
          kind: "department",
          employeeCount: 14,
          openPositions: 1,
          budgetMonthly: 150000,
          children: [],
        },
        {
          id: "dept-proc",
          titleAr: "إدارة المشتريات وسلاسل الإمداد",
          titleEn: "Procurement & Supply Chain",
          subtitle: "أ. ليلى الشمري • مدير المشتريات",
          managerName: "أ. ليلى الشمري",
          code: "DEP-302",
          kind: "department",
          employeeCount: 10,
          openPositions: 0,
          budgetMonthly: 110000,
          children: [],
        },
      ],
    },
    {
      id: "div-sales",
      titleAr: "قطاع النمو وتطوير الأعمال والمبيعات",
      titleEn: "Growth & Business Development",
      subtitle: "م. حسام الصالح • CGO",
      managerName: "م. حسام الصالح",
      code: "SALES-01",
      kind: "division",
      employeeCount: 12,
      openPositions: 1,
      budgetMonthly: 180000,
      avatarUrl: "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=150",
      children: [
        {
          id: "dept-ent",
          titleAr: "إدارة حسابات الشركات الكبرى",
          titleEn: "Enterprise Accounts Dept.",
          subtitle: "أ. ريم الزهراني • مدير المبيعات",
          managerName: "أ. ريم الزهراني",
          code: "DEP-401",
          kind: "department",
          employeeCount: 8,
          openPositions: 1,
          budgetMonthly: 120000,
          children: [],
        },
      ],
    },
  ],
};

interface OrgChartSvgProps {
  root?: OrgChartNodeData;
  language?: "ar" | "en";
  onSelect?: (id: string) => void;
  selectedId?: string | null;
}

export const OrgChartSvg: React.FC<OrgChartSvgProps> = ({
  root = defaultCompanyTree,
  language = "ar",
  onSelect,
  selectedId,
}) => {
  const svgRef = useRef<SVGSVGElement | null>(null);
  const [zoom, setZoom] = useState(0.9);
  const [search, setSearch] = useState("");
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [selectedNode, setSelectedNode] = useState<LaidOutNode | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);

  const visibleRoot = useMemo(() => {
    const prune = (node: OrgChartNodeData): OrgChartNodeData => ({
      ...node,
      children: collapsed.has(node.id) ? [] : (node.children || []).map(prune),
    });
    return prune(root);
  }, [root, collapsed]);

  const { laidOut, nodes, width, height } = useMemo(() => {
    const cursor = { x: 40 };
    const tree = layout(visibleRoot, 0, cursor);
    const all = flatten(tree);
    const maxX = Math.max(...all.map((n) => n.x)) + NODE_W;
    const maxY = Math.max(...all.map((n) => n.y)) + NODE_H;
    return { laidOut: tree, nodes: all, width: maxX + 60, height: maxY + 60 };
  }, [visibleRoot]);

  const matches = useCallback(
    (node: LaidOutNode) => {
      const term = search.trim().toLowerCase();
      if (!term) return false;
      return (
        node.titleAr.toLowerCase().includes(term) ||
        node.titleEn.toLowerCase().includes(term) ||
        (node.code ?? "").toLowerCase().includes(term) ||
        (node.subtitle ?? "").toLowerCase().includes(term) ||
        (node.managerName ?? "").toLowerCase().includes(term)
      );
    },
    [search],
  );

  const edges = useMemo(() => {
    const list: { from: LaidOutNode; to: LaidOutNode }[] = [];
    const walk = (node: LaidOutNode) => {
      node.laidOutChildren.forEach((child) => {
        list.push({ from: node, to: child });
        walk(child);
      });
    };
    walk(laidOut);
    return list;
  }, [laidOut]);

  const toggleCollapse = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const serializeSvg = () => {
    if (!svgRef.current) return null;
    const clone = svgRef.current.cloneNode(true) as SVGSVGElement;
    clone.setAttribute("width", String(width));
    clone.setAttribute("height", String(height));
    clone.setAttribute("viewBox", `0 0 ${width} ${height}`);
    const styles = document.createElement("style");
    styles.textContent = `text{font-family:'Cairo','Plus Jakarta Sans','Roboto',sans-serif}`;
    clone.insertBefore(styles as unknown as Node, clone.firstChild);
    return new XMLSerializer().serializeToString(clone);
  };

  const downloadSvg = () => {
    const source = serializeSvg();
    if (!source) return;
    const blob = new Blob([source], { type: "image/svg+xml;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `Focus_HRMS_OrgChart_${new Date().toISOString().split("T")[0]}.svg`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const downloadPng = () => {
    const source = serializeSvg();
    if (!source) return;
    const img = new Image();
    const url = `data:image/svg+xml;base64,${btoa(unescape(encodeURIComponent(source)))}`;
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = width * 2;
      canvas.height = height * 2;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      ctx.fillStyle = "#F8FAFD";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.scale(2, 2);
      ctx.drawImage(img, 0, 0);
      const link = document.createElement("a");
      link.href = canvas.toDataURL("image/png");
      link.download = `Focus_HRMS_OrgChart_${new Date().toISOString().split("T")[0]}.png`;
      link.click();
    };
    img.src = url;
  };

  return (
    <div
      className={`relative rounded-3xl border border-border/80 bg-card shadow-sm overflow-hidden flex flex-col transition-all duration-300 ${
        isFullscreen ? "fixed inset-4 z-50 shadow-2xl bg-card" : "w-full min-h-[640px]"
      }`}
    >
      {/* Top Controls Toolbar (Google M3 Style) */}
      <div className="flex flex-wrap items-center justify-between gap-3 p-4 md:p-5 border-b border-border/60 bg-muted/20 backdrop-blur-md">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-primary/10 text-primary">
            <Building className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-sm font-black text-foreground flex items-center gap-2">
              شجرة الهيكل التنظيمي التفاعلي المتكامل (SVG Vector Engine)
              <Badge variant="secondary" className="rounded-full text-[10px] font-bold px-2.5">
                M02 Architecture
              </Badge>
            </h2>
            <p className="text-[11px] text-muted-foreground font-medium">
              استعراض التسلسل الإداري للشركات التابعة والقطاعات والإدارات مع الإحصائيات الفورية
            </p>
          </div>
        </div>

        {/* Action Controls & Search */}
        <div className="flex items-center gap-2 flex-wrap">
          {/* Search Box */}
          <div className="relative w-56 sm:w-64">
            <Search className="absolute right-3 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="بحث بالقسم، المدير، المسمى..."
              className="w-full h-9 rounded-full border border-border/80 bg-background pr-9 pl-3 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-primary/40 transition-all shadow-xs"
            />
          </div>

          {/* Zoom Buttons */}
          <div className="flex items-center gap-1 bg-background border border-border/80 rounded-full p-1 shadow-xs">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setZoom((z) => Math.max(0.4, Number((z - 0.15).toFixed(2))))}
              className="h-7 w-7 rounded-full text-muted-foreground hover:text-foreground"
              title="تصغير Zoom Out"
            >
              <Minus className="h-3.5 w-3.5" />
            </Button>
            <span className="text-[10px] font-mono font-bold px-1.5 min-w-9 text-center text-foreground">
              {Math.round(zoom * 100)}%
            </span>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setZoom((z) => Math.min(1.8, Number((z + 0.15).toFixed(2))))}
              className="h-7 w-7 rounded-full text-muted-foreground hover:text-foreground"
              title="تكبير Zoom In"
            >
              <Plus className="h-3.5 w-3.5" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setZoom(0.9)}
              className="h-7 w-7 rounded-full text-muted-foreground hover:text-foreground"
              title="إعادة تعيين"
            >
              <RotateCcw className="h-3.5 w-3.5" />
            </Button>
          </div>

          {/* Export SVG & PNG */}
          <Button
            variant="outline"
            size="sm"
            onClick={downloadSvg}
            className="rounded-full text-xs font-bold gap-1.5 h-9 border-border/80 hover:bg-secondary shadow-xs"
          >
            <Download className="h-3.5 w-3.5 text-primary" />
            SVG
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={downloadPng}
            className="rounded-full text-xs font-bold gap-1.5 h-9 border-border/80 hover:bg-secondary shadow-xs"
          >
            <ImageIcon className="h-3.5 w-3.5 text-emerald-600" />
            PNG
          </Button>

          {/* Fullscreen Button */}
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setIsFullscreen(!isFullscreen)}
            className="h-9 w-9 rounded-full hover:bg-muted text-muted-foreground"
            title={isFullscreen ? "تصغير الشاشة" : "ملء الشاشة Fullscreen"}
          >
            {isFullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
          </Button>
        </div>
      </div>

      {/* SVG Canvas Workspace */}
      <div className="flex-1 overflow-auto p-8 relative flex justify-center items-start bg-[#F8FAFD] dark:bg-[#121316] select-none min-h-[520px]">
        {/* Decorative Grid */}
        <div
          className="absolute inset-0 opacity-[0.03] dark:opacity-[0.05] pointer-events-none"
          style={{
            backgroundImage: `radial-gradient(#0B57D0 1.5px, transparent 1.5px)`,
            backgroundSize: "24px 24px",
          }}
        />

        <div
          style={{
            transform: `scale(${zoom})`,
            transformOrigin: "top center",
            transition: "transform 0.2s cubic-bezier(0.4, 0, 0.2, 1)",
          }}
          className="py-4 px-6 relative"
        >
          <svg
            ref={svgRef}
            id="hrms-org-chart-svg"
            width={width}
            height={height}
            viewBox={`0 0 ${width} ${height}`}
            className="overflow-visible"
          >
            <defs>
              <linearGradient id="primaryGradient" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%" stopColor="#0B57D0" />
                <stop offset="100%" stopColor="#041E49" />
              </linearGradient>
              <linearGradient id="divisionGradient" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%" stopColor="#EBF2FA" />
                <stop offset="100%" stopColor="#D3E3FD" />
              </linearGradient>
              <filter id="cardShadow" x="-10%" y="-10%" width="130%" height="130%">
                <feDropShadow dx="0" dy="4" stdDeviation="6" floodOpacity="0.08" />
              </filter>
            </defs>

            {/* Connecting Orthogonal SVG Lines */}
            <g id="org-chart-edges">
              {edges.map(({ from, to }) => {
                const startX = from.x + NODE_W / 2;
                const startY = from.y + NODE_H;
                const endX = to.x + NODE_W / 2;
                const endY = to.y;
                const midY = (startY + endY) / 2;

                return (
                  <path
                    key={`${from.id}->${to.id}`}
                    d={`M ${startX} ${startY} V ${midY} H ${endX} V ${endY}`}
                    fill="none"
                    stroke="#0B57D0"
                    strokeWidth="2.5"
                    strokeOpacity="0.45"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                );
              })}
            </g>

            {/* SVG Tree Nodes */}
            <g id="org-chart-nodes">
              {nodes.map((node) => {
                const isMatched = matches(node);
                const isSelected = selectedId === node.id || selectedNode?.id === node.id;
                const isParent = node.children && node.children.length > 0;
                const isNodeCollapsed = collapsed.has(node.id);

                return (
                  <g
                    key={node.id}
                    transform={`translate(${node.x}, ${node.y})`}
                    onClick={() => {
                      setSelectedNode(node);
                      onSelect?.(node.id);
                    }}
                    className="cursor-pointer group"
                  >
                    {/* Card Outer Box */}
                    <rect
                      width={NODE_W}
                      height={NODE_H}
                      rx={18}
                      fill={
                        node.kind === "company"
                          ? "url(#primaryGradient)"
                          : node.kind === "division"
                          ? "#FFFFFF"
                          : "#FFFFFF"
                      }
                      stroke={
                        isMatched
                          ? "#F59E0B"
                          : isSelected
                          ? "#0B57D0"
                          : node.kind === "company"
                          ? "#0B57D0"
                          : "#E0E2EC"
                      }
                      strokeWidth={isMatched ? 3 : isSelected ? 2.5 : 1.5}
                      filter="url(#cardShadow)"
                      className="transition-all duration-200"
                    />

                    {/* Top Pill / Badge */}
                    <rect
                      x={14}
                      y={10}
                      width={NODE_W - 28}
                      height={18}
                      rx={9}
                      fill={
                        node.kind === "company"
                          ? "rgba(255,255,255,0.18)"
                          : node.kind === "division"
                          ? "#D3E3FD"
                          : "#F0F4F9"
                      }
                    />
                    <text
                      x={NODE_W / 2}
                      y={22}
                      textAnchor="middle"
                      fill={
                        node.kind === "company"
                          ? "#FFFFFF"
                          : node.kind === "division"
                          ? "#0B57D0"
                          : "#52606D"
                      }
                      fontSize="9"
                      fontWeight="bold"
                    >
                      {KIND_LABEL[node.kind] || "إدارة"} {node.code ? `• ${node.code}` : ""}
                    </text>

                    {/* Node Title */}
                    <text
                      x={NODE_W / 2}
                      y={46}
                      textAnchor="middle"
                      fill={node.kind === "company" ? "#FFFFFF" : "#1A1C1E"}
                      fontSize="11"
                      fontWeight="900"
                    >
                      {node.titleAr.length > 28 ? `${node.titleAr.slice(0, 26)}…` : node.titleAr}
                    </text>

                    {/* Node Subtitle / Manager */}
                    <text
                      x={NODE_W / 2}
                      y={64}
                      textAnchor="middle"
                      fill={node.kind === "company" ? "rgba(255,255,255,0.8)" : "#0B57D0"}
                      fontSize="10"
                      fontWeight="bold"
                    >
                      {node.subtitle ? (node.subtitle.length > 30 ? `${node.subtitle.slice(0, 28)}…` : node.subtitle) : node.titleEn}
                    </text>

                    {/* Headcount Footer */}
                    <text
                      x={NODE_W / 2}
                      y={84}
                      textAnchor="middle"
                      fill={node.kind === "company" ? "rgba(255,255,255,0.7)" : "#73777F"}
                      fontSize="9.5"
                      fontWeight="500"
                    >
                      {node.employeeCount ? `${node.employeeCount} موظف مسجل` : "هيكل معتمد"}
                    </text>

                    {/* Collapse Button Circle Indicator */}
                    {isParent && (
                      <g
                        transform={`translate(${NODE_W / 2}, ${NODE_H})`}
                        onClick={(e) => toggleCollapse(node.id, e as unknown as React.MouseEvent)}
                      >
                        <circle r={10} fill="#0B57D0" stroke="#FFFFFF" strokeWidth={2} />
                        <text
                          y={3.5}
                          textAnchor="middle"
                          fill="#FFFFFF"
                          fontSize="11"
                          fontWeight="bold"
                        >
                          {isNodeCollapsed ? "+" : "−"}
                        </text>
                      </g>
                    )}
                  </g>
                );
              })}
            </g>
          </svg>
        </div>
      </div>

      {/* Node Details Inspection Modal */}
      {selectedNode && (
        <Dialog open={!!selectedNode} onOpenChange={() => setSelectedNode(null)}>
          <DialogContent className="max-w-md rounded-3xl p-6">
            <DialogHeader>
              <div className="flex items-center gap-3.5">
                <div className="h-12 w-12 rounded-2xl bg-primary/10 text-primary flex items-center justify-center font-black text-sm">
                  {selectedNode.code || "HR"}
                </div>
                <div>
                  <Badge variant="secondary" className="rounded-full text-[10px] font-bold px-2.5 mb-1">
                    {KIND_LABEL[selectedNode.kind] || "إدارة مؤسسية"}
                  </Badge>
                  <DialogTitle className="text-base font-black text-foreground">
                    {selectedNode.titleAr}
                  </DialogTitle>
                  <DialogDescription className="text-xs text-muted-foreground font-medium">
                    {selectedNode.titleEn}
                  </DialogDescription>
                </div>
              </div>
            </DialogHeader>

            <div className="space-y-3 pt-4 text-xs">
              <div className="rounded-2xl border border-border/80 bg-muted/20 p-4 space-y-2.5 font-medium">
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground">المدير / المسؤول:</span>
                  <span className="font-bold text-foreground">
                    {selectedNode.managerName || selectedNode.subtitle || "غير محدد"}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground">رمز الكيان الإداري:</span>
                  <span className="font-mono font-bold text-primary">{selectedNode.code || "DEP-01"}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground">إجمالي القوى العاملة:</span>
                  <span className="font-black text-foreground">{selectedNode.employeeCount || 0} موظف</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground">الشواغر الوظيفية المتاحة:</span>
                  <span className="font-bold text-emerald-600">{selectedNode.openPositions || 0} شواغر</span>
                </div>
                {selectedNode.budgetMonthly && (
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground">ميزانية الرواتب التقديرية:</span>
                    <span className="font-mono font-bold text-foreground">
                      {selectedNode.budgetMonthly.toLocaleString()} ر.س / شهرياً
                    </span>
                  </div>
                )}
              </div>

              <div className="flex justify-end pt-2">
                <Button
                  onClick={() => setSelectedNode(null)}
                  className="rounded-full text-xs font-bold bg-primary hover:bg-primary/90 px-5 h-9"
                >
                  إغلاق
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
};
