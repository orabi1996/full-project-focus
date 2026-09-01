import React, { useCallback, useMemo, useRef, useState } from "react";
import type { OrgUnit } from "../../types";
import {
  Download,
  Image as ImageIcon,
  Maximize2,
  Minus,
  Plus,
  RotateCcw,
  Search,
} from "lucide-react";
import { Button } from "../ui/button";
import { Badge } from "../ui/badge";

export interface OrgChartNodeData {
  id: string;
  titleAr: string;
  titleEn: string;
  subtitle?: string;
  code?: string;
  kind: "company" | OrgUnit["type"];
  employeeCount?: number;
  children: OrgChartNodeData[];
}

interface LaidOutNode extends OrgChartNodeData {
  x: number;
  y: number;
  laidOutChildren: LaidOutNode[];
}

const NODE_W = 210;
const NODE_H = 84;
const H_GAP = 28;
const V_GAP = 62;

const KIND_LABEL: Record<string, string> = {
  company: "المنشأة الرئيسية",
  division: "قطاع تنفيذي",
  department: "إدارة عامة",
  section: "قسم",
  unit: "وحدة",
};

const KIND_COLOR: Record<string, { fill: string; stroke: string; text: string }> = {
  company: { fill: "hsl(var(--primary))", stroke: "hsl(var(--primary))", text: "#ffffff" },
  division: { fill: "hsl(var(--primary) / 0.12)", stroke: "hsl(var(--primary) / 0.55)", text: "hsl(var(--foreground))" },
  department: { fill: "hsl(var(--card))", stroke: "hsl(var(--border))", text: "hsl(var(--foreground))" },
  section: { fill: "hsl(var(--muted) / 0.6)", stroke: "hsl(var(--border))", text: "hsl(var(--foreground))" },
  unit: { fill: "hsl(var(--muted) / 0.4)", stroke: "hsl(var(--border))", text: "hsl(var(--foreground))" },
};

/** Tidy-tree layout: children laid out side by side, parent centered above them. */
function layout(node: OrgChartNodeData, depth: number, cursor: { x: number }): LaidOutNode {
  const y = depth * (NODE_H + V_GAP);
  if (!node.children.length) {
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

function truncate(value: string, max: number) {
  return value.length > max ? `${value.slice(0, max - 1)}…` : value;
}

interface OrgChartSvgProps {
  root: OrgChartNodeData;
  language: "ar" | "en";
  onSelect?: (id: string) => void;
  selectedId?: string | null;
}

export const OrgChartSvg: React.FC<OrgChartSvgProps> = ({
  root,
  language,
  onSelect,
  selectedId,
}) => {
  const svgRef = useRef<SVGSVGElement | null>(null);
  const [zoom, setZoom] = useState(0.85);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [search, setSearch] = useState("");
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const dragRef = useRef<{ x: number; y: number; panX: number; panY: number } | null>(null);

  const visibleRoot = useMemo(() => {
    const prune = (node: OrgChartNodeData): OrgChartNodeData => ({
      ...node,
      children: collapsed.has(node.id) ? [] : node.children.map(prune),
    });
    return prune(root);
  }, [root, collapsed]);

  const { laidOut, nodes, width, height } = useMemo(() => {
    const cursor = { x: 0 };
    const tree = layout(visibleRoot, 0, cursor);
    const all = flatten(tree);
    const maxX = Math.max(...all.map((n) => n.x)) + NODE_W;
    const maxY = Math.max(...all.map((n) => n.y)) + NODE_H;
    return { laidOut: tree, nodes: all, width: maxX + 40, height: maxY + 40 };
  }, [visibleRoot]);

  const matches = useCallback(
    (node: LaidOutNode) => {
      const term = search.trim().toLowerCase();
      if (!term) return false;
      return (
        node.titleAr.toLowerCase().includes(term) ||
        node.titleEn.toLowerCase().includes(term) ||
        (node.code ?? "").toLowerCase().includes(term) ||
        (node.subtitle ?? "").toLowerCase().includes(term)
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

  const toggleCollapse = (id: string) => {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const childCount = useMemo(() => {
    const map = new Map<string, number>();
    const walk = (node: OrgChartNodeData) => {
      map.set(node.id, node.children.length);
      node.children.forEach(walk);
    };
    walk(root);
    return map;
  }, [root]);

  const serializeSvg = () => {
    if (!svgRef.current) return null;
    const clone = svgRef.current.cloneNode(true) as SVGSVGElement;
    clone.setAttribute("width", String(width));
    clone.setAttribute("height", String(height));
    clone.setAttribute("viewBox", `0 0 ${width} ${height}`);
    const inner = clone.querySelector("#org-chart-layer");
    inner?.setAttribute("transform", "translate(20,20)");
    const styles = document.createElement("style");
    styles.textContent = `text{font-family:'IBM Plex Sans Arabic','Segoe UI',sans-serif}`;
    clone.insertBefore(styles as unknown as Node, clone.firstChild);
    const raw = new XMLSerializer().serializeToString(clone);
    // Resolve CSS variables to literal colors for standalone files.
    const computed = getComputedStyle(document.documentElement);
    return raw.replace(/hsl\(var\(([^)]+)\)(\s*\/\s*[\d.]+)?\)/g, (_m, name: string, alpha?: string) => {
      const value = computed.getPropertyValue(name.trim()).trim();
      if (!value) return "#94a3b8";
      return alpha ? `hsl(${value}${alpha})` : `hsl(${value})`;
    });
  };

  const downloadSvg = () => {
    const source = serializeSvg();
    if (!source) return;
    const blob = new Blob([source], { type: "image/svg+xml;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "org-chart.svg";
    link.click();
    URL.revokeObjectURL(url);
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
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.scale(2, 2);
      ctx.drawImage(img, 0, 0);
      const link = document.createElement("a");
      link.href = canvas.toDataURL("image/png");
      link.download = "org-chart.png";
      link.click();
    };
    img.src = url;
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b pb-3">
        <div className="flex items-center gap-2">
          <Search className="h-4 w-4 text-muted-foreground" />
          <input
            type="text"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="بحث في شجرة الهيكل التنظيمي..."
            className="h-8 w-56 rounded-md border bg-background px-2.5 text-xs"
          />
          {search.trim() && (
            <Badge variant="secondary" className="text-[10px]">
              {nodes.filter(matches).length} نتيجة
            </Badge>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          <Button variant="outline" size="icon" className="h-7 w-7" onClick={() => setZoom((z) => Math.max(0.3, +(z - 0.1).toFixed(2)))}>
            <Minus className="h-3.5 w-3.5" />
          </Button>
          <span className="px-1 font-mono text-[10px]">{Math.round(zoom * 100)}%</span>
          <Button variant="outline" size="icon" className="h-7 w-7" onClick={() => setZoom((z) => Math.min(2, +(z + 0.1).toFixed(2)))}>
            <Plus className="h-3.5 w-3.5" />
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="h-7 gap-1 text-[11px]"
            onClick={() => {
              setZoom(0.85);
              setPan({ x: 0, y: 0 });
            }}
          >
            <RotateCcw className="h-3.5 w-3.5" />
            إعادة الضبط
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="h-7 gap-1 text-[11px]"
            onClick={() => {
              setCollapsed(new Set());
              setZoom(Math.min(1, 900 / width));
              setPan({ x: 0, y: 0 });
            }}
          >
            <Maximize2 className="h-3.5 w-3.5" />
            ملاءمة الشاشة
          </Button>
          <Button variant="secondary" size="sm" className="h-7 gap-1 text-[11px]" onClick={downloadSvg}>
            <Download className="h-3.5 w-3.5" />
            SVG
          </Button>
          <Button variant="secondary" size="sm" className="h-7 gap-1 text-[11px]" onClick={downloadPng}>
            <ImageIcon className="h-3.5 w-3.5" />
            PNG
          </Button>
        </div>
      </div>

      <div
        className="relative overflow-hidden rounded-xl border bg-[radial-gradient(circle_at_1px_1px,hsl(var(--border))_1px,transparent_0)] [background-size:22px_22px]"
        style={{ height: 520, cursor: dragRef.current ? "grabbing" : "grab" }}
        onPointerDown={(event) => {
          dragRef.current = { x: event.clientX, y: event.clientY, panX: pan.x, panY: pan.y };
          (event.target as Element).setPointerCapture?.(event.pointerId);
        }}
        onPointerMove={(event) => {
          const drag = dragRef.current;
          if (!drag) return;
          setPan({ x: drag.panX + (event.clientX - drag.x), y: drag.panY + (event.clientY - drag.y) });
        }}
        onPointerUp={() => {
          dragRef.current = null;
        }}
        onPointerLeave={() => {
          dragRef.current = null;
        }}
      >
        <svg ref={svgRef} className="h-full w-full select-none" role="img" aria-label="الهيكل التنظيمي">
          <g
            id="org-chart-layer"
            transform={`translate(${pan.x + 40}, ${pan.y + 30}) scale(${zoom})`}
          >
            {edges.map((edge) => {
              const x1 = edge.from.x + NODE_W / 2;
              const y1 = edge.from.y + NODE_H;
              const x2 = edge.to.x + NODE_W / 2;
              const y2 = edge.to.y;
              const midY = y1 + V_GAP / 2;
              return (
                <path
                  key={`${edge.from.id}-${edge.to.id}`}
                  d={`M ${x1} ${y1} V ${midY} H ${x2} V ${y2}`}
                  fill="none"
                  stroke="hsl(var(--border))"
                  strokeWidth={1.6}
                />
              );
            })}

            {nodes.map((node) => {
              const palette = KIND_COLOR[node.kind] ?? KIND_COLOR["department"]!;
              const isMatch = matches(node);
              const isSelected = selectedId === node.id;
              const kids = childCount.get(node.id) ?? 0;
              const isCollapsed = collapsed.has(node.id);
              return (
                <g
                  key={node.id}
                  transform={`translate(${node.x}, ${node.y})`}
                  onClick={() => onSelect?.(node.id)}
                  style={{ cursor: "pointer" }}
                >
                  <rect
                    width={NODE_W}
                    height={NODE_H}
                    rx={14}
                    fill={palette.fill}
                    stroke={isMatch || isSelected ? "hsl(var(--primary))" : palette.stroke}
                    strokeWidth={isMatch || isSelected ? 2.5 : 1.4}
                  />
                  <text
                    x={NODE_W - 14}
                    y={24}
                    textAnchor="end"
                    fontSize={12.5}
                    fontWeight={700}
                    fill={palette.text}
                    direction="rtl"
                  >
                    {truncate(language === "ar" ? node.titleAr : node.titleEn, 24)}
                  </text>
                  <text
                    x={NODE_W - 14}
                    y={44}
                    textAnchor="end"
                    fontSize={10.5}
                    fill={node.kind === "company" ? "#ffffffcc" : "hsl(var(--muted-foreground))"}
                    direction="rtl"
                  >
                    {truncate(node.subtitle ?? KIND_LABEL[node.kind] ?? "", 30)}
                  </text>
                  <text
                    x={NODE_W - 14}
                    y={66}
                    textAnchor="end"
                    fontSize={10}
                    fill={node.kind === "company" ? "#ffffffcc" : "hsl(var(--muted-foreground))"}
                    direction="rtl"
                  >
                    {node.employeeCount ?? 0} موظف
                  </text>
                  <text
                    x={14}
                    y={66}
                    fontSize={9.5}
                    fontFamily="monospace"
                    fill={node.kind === "company" ? "#ffffffcc" : "hsl(var(--muted-foreground))"}
                  >
                    {node.code ?? ""}
                  </text>
                  <rect
                    x={14}
                    y={14}
                    width={54}
                    height={16}
                    rx={8}
                    fill={node.kind === "company" ? "#ffffff33" : "hsl(var(--primary) / 0.15)"}
                  />
                  <text
                    x={41}
                    y={26}
                    textAnchor="middle"
                    fontSize={8.5}
                    fontWeight={700}
                    fill={node.kind === "company" ? "#ffffff" : "hsl(var(--primary))"}
                    direction="rtl"
                  >
                    {KIND_LABEL[node.kind] ?? ""}
                  </text>

                  {kids > 0 && (
                    <g
                      transform={`translate(${NODE_W / 2 - 10}, ${NODE_H - 10})`}
                      onClick={(event) => {
                        event.stopPropagation();
                        toggleCollapse(node.id);
                      }}
                    >
                      <circle cx={10} cy={10} r={10} fill="hsl(var(--background))" stroke="hsl(var(--border))" />
                      <text x={10} y={14} textAnchor="middle" fontSize={12} fontWeight={700} fill="hsl(var(--primary))">
                        {isCollapsed ? "+" : "−"}
                      </text>
                    </g>
                  )}
                </g>
              );
            })}
          </g>
        </svg>

        <div className="pointer-events-none absolute bottom-2 left-3 rounded-md bg-background/85 px-2 py-1 text-[10px] text-muted-foreground">
          اسحب للتحريك • اضغط على العقدة للتفاصيل • + / − لطي الفروع
        </div>
      </div>
    </div>
  );
};
