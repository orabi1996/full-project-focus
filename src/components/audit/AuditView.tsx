import React from 'react';
import { useApp } from '../../lib/context/AppContext';
import {
  History,
  Shield,
  Search,
  Filter,
  User,
  Clock,
  Lock,
} from 'lucide-react';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';

export const AuditView: React.FC = () => {
  const { auditLogs, language, t } = useApp();

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-b pb-4">
        <div>
          <h1 className="text-xl font-bold text-foreground flex items-center gap-2">
            <History className="h-5 w-5 text-primary" />
            {t.system.auditLog} والأمان المؤسسي
          </h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            سجل تدقيق غير قابل للتعديل (Append-Only Log) يوثق كافة التعديلات الحساسة والاعتمادات
          </p>
        </div>
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
              {auditLogs.map(log => (
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
