import React, { useState } from 'react';
import { useApp } from '../../lib/context/AppContext';
import {
  Package,
  FileText,
  Laptop,
  CheckCircle2,
  AlertCircle,
  Download,
  Plus,
  Shield,
  Upload,
} from 'lucide-react';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs';

export const AssetsView: React.FC = () => {
  const { assets, companyDocs, acknowledgeDocument, language, t } = useApp();
  const [activeTab, setActiveTab] = useState('assets');

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-b pb-4">
        <div>
          <h1 className="text-xl font-bold text-foreground flex items-center gap-2">
            <Package className="h-5 w-5 text-primary" />
            {t.assets.catalog} ومستندات المنشأة
          </h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            إدارة عهد الموظفين والأجهزة، تتبع إخلاء الطرف، واللوائح الداخلية وإقرارات الموظفين
          </p>
        </div>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid grid-cols-2 max-w-xs">
          <TabsTrigger value="assets" className="text-xs font-bold">
            {t.assets.catalog} ({assets.length})
          </TabsTrigger>
          <TabsTrigger value="docs" className="text-xs font-bold">
            {t.assets.companyDocs} ({companyDocs.length})
          </TabsTrigger>
        </TabsList>

        {/* Tab 1: Hardware Assets */}
        <TabsContent value="assets" className="space-y-4 pt-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {assets.map(ast => (
              <div key={ast.id} className="rounded-xl border bg-card p-4 shadow-sm space-y-3">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2">
                    <Laptop className="h-4 w-4 text-primary" />
                    <div>
                      <h3 className="font-bold text-xs text-foreground">{ast.nameAr}</h3>
                      <span className="text-[10px] font-mono text-muted-foreground">{ast.assetTag}</span>
                    </div>
                  </div>
                  <Badge
                    variant="outline"
                    className={`text-[10px] ${
                      ast.status === 'assigned'
                        ? 'bg-emerald-500/10 text-emerald-700 border-emerald-200'
                        : 'bg-blue-500/10 text-blue-700 border-blue-200'
                    }`}
                  >
                    {ast.status === 'assigned' ? 'مسند لموظف' : 'متاح في المستودع'}
                  </Badge>
                </div>

                <div className="rounded-lg border bg-muted/20 p-2.5 text-xs space-y-1 text-muted-foreground font-mono">
                  <div className="flex justify-between">
                    <span>الرقم التسلسلي:</span>
                    <span className="font-bold text-foreground">{ast.serialNumber}</span>
                  </div>
                  {ast.assignedToEmployeeName && (
                    <div className="flex justify-between">
                      <span>المستلم:</span>
                      <span className="font-bold text-foreground">{ast.assignedToEmployeeName}</span>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </TabsContent>

        {/* Tab 2: Company Documents */}
        <TabsContent value="docs" className="space-y-4 pt-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {companyDocs.map(doc => (
              <div key={doc.id} className="rounded-xl border bg-card p-4 shadow-sm space-y-3">
                <div className="flex items-start justify-between">
                  <FileText className="h-5 w-5 text-primary" />
                  <Badge variant="outline" className="text-[10px]">
                    {doc.version}
                  </Badge>
                </div>

                <h3 className="font-bold text-xs text-foreground">{doc.titleAr}</h3>
                <p className="text-[11px] text-muted-foreground">
                  إقرار بالاطلاع: {doc.acknowledgedCount} موظف أكد القراءة
                </p>

                <div className="border-t pt-2 flex items-center justify-between">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => alert(`جاري تنزيل ملف ${doc.titleAr}`)}
                    className="h-7 text-xs font-bold gap-1 text-primary"
                  >
                    <Download className="h-3 w-3" />
                    تنزيل الملف
                  </Button>
                  <Button
                    size="sm"
                    onClick={() => {
                      acknowledgeDocument(doc.id);
                      alert('تم تسجيل إقرارك بالاطلاع على اللائحة بنجاح');
                    }}
                    className="h-7 text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white"
                  >
                    تأكيد القراءة
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
};
