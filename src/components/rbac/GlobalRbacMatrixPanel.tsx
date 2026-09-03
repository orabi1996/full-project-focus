import React, { useState, useMemo } from "react";
import { useApp } from "../../lib/context/AppContext";
import {
  Table,
  Search,
  Download,
  Printer,
  Shield,
  Eye,
  CheckCircle2,
  XCircle,
  Sliders,
  Filter,
} from "lucide-react";
import { Button } from "../ui/button";
import { Badge } from "../ui/badge";
import { toast } from "sonner";
import {
  ALL_SYSTEM_SCREENS,
  type ScreenActionPermissions,
  type ScreenModuleConfig,
} from "../../lib/auth/rbac-definitions";

export const GlobalRbacMatrixPanel: React.FC = () => {
  const { permissionGroups } = useApp();
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("all");

  const filteredScreens = useMemo(() => {
    return ALL_SYSTEM_SCREENS.filter((screen) => {
      const matchCategory =
        selectedCategory === "all" || screen.category === selectedCategory;
      const matchSearch =
        !searchTerm.trim() ||
        screen.nameAr.toLowerCase().includes(searchTerm.toLowerCase()) ||
        screen.code.toLowerCase().includes(searchTerm.toLowerCase());
      return matchCategory && matchSearch;
    });
  }, [selectedCategory, searchTerm]);

  const categories = [
    { id: "all", label: `كافة الشاشات (${ALL_SYSTEM_SCREENS.length})` },
    { id: "core", label: "الرئيسية والهيكل" },
    { id: "operations", label: "الوقت والعمليات" },
    { id: "finance", label: "الرواتب والمالية" },
    { id: "talent", label: "المواهب والنمو" },
    { id: "governance", label: "الأمان والامتثال" },
    { id: "self_service", label: "الخدمة الذاتية" },
  ];

  const getCellStatus = (
    perms?: ScreenActionPermissions,
  ): { label: string; variant: "full" | "readonly" | "custom" | "none" } => {
    if (!perms || !perms.view) {
      return { label: "محظور", variant: "none" };
    }
    if (perms.view && perms.create && perms.edit && perms.delete && perms.approveExport) {
      return { label: "كاملة", variant: "full" };
    }
    if (perms.view && !perms.create && !perms.edit && !perms.delete && !perms.approveExport) {
      return { label: "قراءة فقط", variant: "readonly" };
    }
    return { label: "مخصصة", variant: "custom" };
  };

  const handleExportCsv = () => {
    const headers = ["كود الشاشة", "اسم الشاشة", ...permissionGroups.map((g) => g.nameAr)];
    const rows = ALL_SYSTEM_SCREENS.map((s) => {
      const row = [s.code, s.nameAr];
      permissionGroups.forEach((g) => {
        const perms = g.screens?.[s.id];
        const status = getCellStatus(perms);
        row.push(status.label);
      });
      return row.join(",");
    });

    const csvContent = "data:text/csv;charset=utf-8,\uFEFF" + [headers.join(","), ...rows].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `rbac_matrix_export_${new Date().toISOString().split("T")[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success("تم تصدير مصفوفة الصلاحيات الشاملة بنجاح بصيغة CSV!");
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="space-y-4">
      {/* Header Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-card p-4 rounded-3xl border border-border/80 shadow-xs">
        <div>
          <h3 className="font-black text-sm text-foreground flex items-center gap-2">
            <Shield className="h-4 w-4 text-primary" />
            المصفوفة المقارنة الشاملة (All Groups vs 20 Screens)
          </h3>
          <p className="text-xs text-muted-foreground font-medium mt-0.5">
            استعراض تنفيذي موحد لمستويات الوصول المقررة لجميع المجموعات على مستوى كافة شاشات المنظومة
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleExportCsv}
            className="rounded-full text-xs font-bold gap-1.5 h-8 px-3 border-border/80"
          >
            <Download className="h-3.5 w-3.5 text-primary" />
            تصدير CSV
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handlePrint}
            className="rounded-full text-xs font-bold gap-1.5 h-8 px-3 border-border/80"
          >
            <Printer className="h-3.5 w-3.5 text-primary" />
            طباعة
          </Button>
        </div>
      </div>

      {/* Search & Categories */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute right-3 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="البحث في الشاشات..."
            className="w-full h-8 rounded-2xl border border-border/80 bg-card pr-9 pl-3 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-primary/40 shadow-2xs"
          />
        </div>

        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 custom-scrollbar">
          {categories.map((cat) => (
            <button
              key={cat.id}
              type="button"
              onClick={() => setSelectedCategory(cat.id)}
              className={`text-[11px] font-bold rounded-full px-3 py-1 transition-all whitespace-nowrap ${
                selectedCategory === cat.id
                  ? "bg-primary text-primary-foreground shadow-xs"
                  : "bg-muted/40 hover:bg-muted text-muted-foreground"
              }`}
            >
              {cat.label}
            </button>
          ))}
        </div>
      </div>

      {/* Matrix Table */}
      <div className="rounded-3xl border border-border/80 bg-card shadow-xs overflow-hidden">
        <div className="overflow-x-auto max-h-[640px] custom-scrollbar">
          <table className="w-full text-right border-collapse text-xs">
            <thead className="sticky top-0 bg-muted/90 backdrop-blur-md z-10 border-b border-border/80">
              <tr className="text-muted-foreground font-black text-[11px]">
                <th className="p-3.5 min-w-[200px]">الشاشة والوحدة</th>
                {permissionGroups.map((g) => (
                  <th key={g.id} className="p-3 text-center min-w-[140px]">
                    <div className="flex flex-col items-center gap-0.5">
                      <span className="font-black text-foreground truncate max-w-[130px]">
                        {g.nameAr}
                      </span>
                      <span className="text-[9px] font-mono text-muted-foreground">
                        {g.memberUserIds?.length || 0} مستخدم
                      </span>
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-border/60">
              {filteredScreens.map((screen) => (
                <tr key={screen.id} className="hover:bg-muted/20 transition-colors">
                  <td className="p-3">
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="font-mono text-[9px] font-bold px-1.5 py-0 h-4">
                        {screen.code}
                      </Badge>
                      <span className="font-bold text-xs text-foreground">{screen.nameAr}</span>
                    </div>
                  </td>

                  {permissionGroups.map((g) => {
                    const perms = g.screens?.[screen.id];
                    const status = getCellStatus(perms);
                    return (
                      <td key={g.id} className="p-2.5 text-center">
                        {status.variant === "full" && (
                          <Badge className="bg-emerald-600 text-white font-bold text-[10px] rounded-full px-2 py-0.5 shadow-2xs">
                            ✓ كاملة
                          </Badge>
                        )}
                        {status.variant === "readonly" && (
                          <Badge className="bg-sky-500/15 text-sky-700 border-sky-500/30 font-bold text-[10px] rounded-full px-2 py-0.5">
                            قراءة فقط
                          </Badge>
                        )}
                        {status.variant === "custom" && (
                          <Badge className="bg-amber-500/15 text-amber-700 border-amber-500/30 font-bold text-[10px] rounded-full px-2 py-0.5">
                            مخصصة
                          </Badge>
                        )}
                        {status.variant === "none" && (
                          <span className="text-muted-foreground/40 text-xs font-bold">—</span>
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
