import React, { useState } from 'react';
import { useApp } from '../../lib/context/AppContext';
import { exportToCSV } from '../../lib/utils/export-helpers';
import {
  History,
  Shield,
  Search,
  Filter,
  User,
  Clock,
  Lock,
  Download,
} from 'lucide-react';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';

export const AuditView: React.FC = () => {
  const { auditLogs, language, t } = useApp();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedEntity, setSelectedEntity] = useState<string>('all');

  const filteredLogs = auditLogs.filter(log => {
    const matchesSearch =
      log.actorName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      log.action.toLowerCase().includes(searchTerm.toLowerCase()) ||
      log.changesSummary.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesEntity = selectedEntity === 'all' || log.entityType === selectedEntity;
    return matchesSearch && matchesEntity;
  });

  const handleExportAudit = () => {
    const data = filteredLogs.map(log => ({
      'المستخدم': log.actorName,
      'الدور الوظيفي': log.actorRole,
      'الإجراء': log.action,
      'نوع الكيان': log.entityType,
      'اسم الكيان': log.entityName,
      'تفاصيل التغيير': log.changesSummary,
      'عنوان IP': log.ipAddress || '192.168.1.1',
      'التاريخ والوقت': log.timestamp,
    }));
    exportToCSV(`Audit_Trail_${new Date().toISOString().split('T')[0]}`, data);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-b pb-4">
        <div>
          <h1 className="text-xl font-bold text-foreground flex items-center gap-2">
            <History className="h-5 w-5 text-primary" />
            {t.system.auditLog} والأمان المؤسسي (M19)
          </h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            سجل تدقيق غير قابل للتعديل (Append-Only Log) يوثق كافة التعديلات الحساسة والاعتمادات
          </p>
        </div>
        <div className="flex gap-2">
          <Button onClick={handleExportAudit} variant="outline" size="sm" className="font-bold text-xs gap-1.5">
            <Download className="h-4 w-4" />
            تصدير سجل التدقيق (CSV)
          </Button>
        </div>
      </div>

      {/* Filters Bar */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute right-3 top-2.5 h-4 w-4 text-muted-foreground" />
          <input
            type="text"
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            placeholder="بحث بالفاعل، الإجراء، أو تفاصيل التغيير..."
            className="w-full h-9 rounded-lg border bg-card pr-9 pl-3 text-xs"
          />
        </div>
        <select
          value={selectedEntity}
          onChange={e => setSelectedEntity(e.target.value)}
          className="h-9 rounded-lg border bg-card px-3 text-xs font-semibold"
        >
          <option value="all">كافة الكيانات والعمليات</option>
          <option value="employee">الموظفين (Employees)</option>
          <option value="leave_request">الإجازات (Leaves)</option>
          <option value="payroll_run">مسيرات الرواتب (Payroll)</option>
          <option value="expense_claim">المصروفات (Expenses)</option>
        </select>
      </div>

      {/* Audit Logs Table */}
      <div className="rounded-xl border bg-card overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="border-b bg-muted/40 font-bold text-muted-foreground">
              <tr>
                <th className="py-3 px-4 text-start">{t.system.actor}</th>
                <th className="py-3 px-4 text-start">{t.system.action}</th>
                <th className="py-3 px-4 text-start">{t.system.entity}</th>
                <th className="py-3 px-4 text-start">{t.system.changes}</th>
                <th className="py-3 px-4 text-start">عنوان IP</th>
                <th className="py-3 px-4 text-start">الوقت والتاريخ</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filteredLogs.map(log => (
                <tr key={log.id} className="hover:bg-muted/20">
                  <td className="py-3 px-4">
                    <span className="font-bold text-foreground">{log.actorName}</span>
                    <span className="block text-[10px] text-muted-foreground font-mono">{log.actorRole}</span>
                  </td>
                  <td className="py-3 px-4 font-bold text-primary">{log.action}</td>
                  <td className="py-3 px-4 font-mono font-medium">{log.entityType} ({log.entityName})</td>
                  <td className="py-3 px-4 text-muted-foreground max-w-xs truncate">{log.changesSummary}</td>
                  <td className="py-3 px-4 font-mono text-muted-foreground">{log.ipAddress || '192.168.1.1'}</td>
                  <td className="py-3 px-4 font-mono text-muted-foreground">
                    {new Date(log.timestamp).toLocaleString(language === 'ar' ? 'ar-SA' : 'en-US')}
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
