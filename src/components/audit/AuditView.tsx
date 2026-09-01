import React, { useState } from "react";
import { useApp } from "../../lib/context/AppContext";
import { exportToCSV } from "../../lib/utils/export-helpers";
import { IconSymbol } from "../ui/IconSymbol";
import { History, Shield, Search, Filter, User, Clock, Lock, Download, Sparkles } from "lucide-react";
import { Button } from "../ui/button";
import { Badge } from "../ui/badge";

export const AuditView: React.FC = () => {
  const { auditLogs, language, t } = useApp();
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedEntity, setSelectedEntity] = useState<string>("all");

  const filteredLogs = auditLogs.filter((log) => {
    const matchesSearch =
      log.actorName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      log.action.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (log.changesSummary || "").toLowerCase().includes(searchTerm.toLowerCase());
    const matchesEntity = selectedEntity === "all" || log.entityType === selectedEntity;
    return matchesSearch && matchesEntity;
  });

  const handleExportAudit = () => {
    const data = filteredLogs.map((log) => ({
      المستخدم: log.actorName,
      "الدور الوظيفي": log.actorRole,
      الإجراء: log.action,
      "نوع الكيان": log.entityType,
      "اسم الكيان": log.entityName,
      "تفاصيل التغيير": log.changesSummary,
      "عنوان IP": log.ipAddress || "192.168.1.1",
      "التاريخ والوقت": log.timestamp,
    }));
    exportToCSV(`Audit_Trail_${new Date().toISOString().split("T")[0]}`, data);
  };

  return (
    <div className="space-y-6">
      {/* Header (Google M3 Style) */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b border-border/70 pb-5">
        <div>
          <h1 className="text-xl font-black text-foreground flex items-center gap-2.5">
            <IconSymbol name="verified_user" source="material" filled size={24} className="text-primary" />
            {t.system.auditLog} والأمان المؤسسي (M14)
          </h1>
          <p className="text-xs text-muted-foreground font-medium mt-1">
            سجل تدقيق غير قابل للتعديل (Append-Only Log) يوثق كافة التعديلات الحساسة والاعتمادات
          </p>
        </div>
        <div className="flex gap-2.5">
          <Button
            onClick={handleExportAudit}
            variant="outline"
            size="sm"
            className="rounded-full font-bold text-xs gap-1.5 border-border/80 hover:bg-secondary h-10 px-4 shadow-xs"
          >
            <Download className="h-4 w-4 text-primary" />
            تصدير سجل التدقيق (CSV)
          </Button>
        </div>
      </div>

      {/* Filters Bar */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute right-3.5 top-3 h-4 w-4 text-muted-foreground" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="بحث بالفاعل، الإجراء، أو تفاصيل التغيير..."
            className="w-full h-10 rounded-2xl border border-border/80 bg-card pr-10 pl-3 text-xs focus:outline-none focus:ring-2 focus:ring-primary/40 font-medium"
          />
        </div>
        <select
          value={selectedEntity}
          onChange={(e) => setSelectedEntity(e.target.value)}
          className="h-10 rounded-2xl border border-border/80 bg-card px-4 text-xs font-bold text-primary focus:outline-none focus:ring-2 focus:ring-primary/40"
        >
          <option value="all">كافة الكيانات والعمليات</option>
          <option value="employee">الموظفين (Employees)</option>
          <option value="leave_request">الإجازات (Leaves)</option>
          <option value="payroll_run">مسيرات الرواتب (Payroll)</option>
          <option value="expense_claim">المصروفات (Expenses)</option>
        </select>
      </div>

      {/* Audit Logs Table */}
      <div className="rounded-3xl border border-border/80 bg-card overflow-hidden shadow-xs p-5 space-y-3">
        <div className="overflow-x-auto rounded-2xl border border-border/60">
          <table className="w-full text-xs">
            <thead className="border-b border-border/60 bg-muted/40 font-bold text-muted-foreground">
              <tr>
                <th className="py-3 px-4 text-start">{t.system.actor}</th>
                <th className="py-3 px-4 text-start">{t.system.action}</th>
                <th className="py-3 px-4 text-start">{t.system.entity}</th>
                <th className="py-3 px-4 text-start">{t.system.changes}</th>
                <th className="py-3 px-4 text-start">عنوان IP</th>
                <th className="py-3 px-4 text-start">الوقت والتاريخ</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/60">
              {filteredLogs.map((log) => (
                <tr key={log.id} className="hover:bg-muted/20 transition-colors">
                  <td className="py-3 px-4">
                    <span className="font-black text-foreground block">{log.actorName}</span>
                    <span className="block text-[10px] text-muted-foreground font-mono font-semibold">
                      {log.actorRole}
                    </span>
                  </td>
                  <td className="py-3 px-4 font-black text-primary">{log.action}</td>
                  <td className="py-3 px-4 font-mono font-bold text-foreground">
                    {log.entityType} ({log.entityName})
                  </td>
                  <td className="py-3 px-4 text-muted-foreground max-w-xs truncate font-medium">
                    {log.changesSummary}
                  </td>
                  <td className="py-3 px-4 font-mono text-muted-foreground">
                    {log.ipAddress || "192.168.1.1"}
                  </td>
                  <td className="py-3 px-4 font-mono text-muted-foreground">
                    {new Date(log.timestamp).toLocaleString(language === "ar" ? "ar-SA" : "en-US")}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
