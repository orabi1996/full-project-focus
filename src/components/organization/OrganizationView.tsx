import React, { useState } from 'react';
import { useApp } from '../../lib/context/AppContext';
import {
  Building2,
  MapPin,
  Users,
  Plus,
  Network,
  ShieldCheck,
  CheckCircle2,
  ChevronRight,
  ChevronDown,
  Layers,
  Map,
  Compass,
} from 'lucide-react';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs';

export const OrganizationView: React.FC = () => {
  const { company, subsidiaries, orgUnits, workLocations, language, t } = useApp();
  const [activeTab, setActiveTab] = useState('structure');

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-b pb-4">
        <div>
          <h1 className="text-xl font-bold text-foreground flex items-center gap-2">
            <Building2 className="h-5 w-5 text-primary" />
            {t.org.companyProfile} والهيكل التنظيمي
          </h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            إدارة المنشأة، الشركات الفرعية، الأقسام، والمواقع الجغرافية المزودة بالسياج الجغرافي (Geofencing)
          </p>
        </div>
        <div className="flex gap-2">
          <Button size="sm" className="font-bold text-xs gap-1.5 bg-primary">
            <Plus className="h-4 w-4" />
            {t.org.addDepartment}
          </Button>
        </div>
      </div>

      {/* Tabs Menu */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-4 max-w-xl">
          <TabsTrigger value="structure" className="text-xs font-bold">
            {t.org.departments} ({orgUnits.length})
          </TabsTrigger>
          <TabsTrigger value="subsidiaries" className="text-xs font-bold">
            {t.org.subsidiaries} ({subsidiaries.length})
          </TabsTrigger>
          <TabsTrigger value="locations" className="text-xs font-bold">
            {t.org.locations} ({workLocations.length})
          </TabsTrigger>
          <TabsTrigger value="orgchart" className="text-xs font-bold">
            {t.org.orgChart}
          </TabsTrigger>
        </TabsList>

        {/* Tab 1: Organization Units / Departments */}
        <TabsContent value="structure" className="space-y-4 pt-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {orgUnits.map(unit => (
              <div
                key={unit.id}
                className="rounded-xl border bg-card p-4 shadow-sm space-y-3 hover:border-primary/40 transition-colors"
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary font-bold text-xs">
                      {unit.code.substring(0, 3)}
                    </div>
                    <div>
                      <h3 className="font-bold text-xs text-foreground">
                        {language === 'ar' ? unit.nameAr : unit.nameEn}
                      </h3>
                      <span className="text-[10px] text-muted-foreground uppercase">{unit.code}</span>
                    </div>
                  </div>
                  <Badge variant="outline" className="text-[10px] bg-emerald-500/10 text-emerald-700 border-emerald-200">
                    نشط
                  </Badge>
                </div>

                <div className="border-t pt-2 space-y-1.5 text-xs text-muted-foreground">
                  <div className="flex justify-between items-center">
                    <span>{t.org.manager}:</span>
                    <span className="font-semibold text-foreground">{unit.managerName || 'غير معين'}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span>{t.org.employeeCount}:</span>
                    <span className="font-semibold text-foreground">{unit.employeeCount} موظف</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </TabsContent>

        {/* Tab 2: Subsidiaries */}
        <TabsContent value="subsidiaries" className="space-y-4 pt-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {subsidiaries.map(sub => (
              <div key={sub.id} className="rounded-xl border bg-card p-5 shadow-sm space-y-3">
                <div className="flex items-center justify-between">
                  <Badge variant="secondary" className="text-xs font-mono font-bold">
                    {sub.code}
                  </Badge>
                  <Badge variant="outline" className="text-[10px] bg-emerald-500/10 text-emerald-600 border-emerald-200">
                    شركة فرعية معتمدة
                  </Badge>
                </div>
                <h3 className="text-sm font-black text-foreground">
                  {language === 'ar' ? sub.nameAr : sub.nameEn}
                </h3>
                <div className="text-xs text-muted-foreground space-y-1">
                  <p>الرقم التجاري: {sub.crNumber}</p>
                  <p>المدير العام: {sub.managerName}</p>
                  <p className="font-bold text-primary">{sub.employeeCount} موظف مسجل</p>
                </div>
              </div>
            ))}
          </div>
        </TabsContent>

        {/* Tab 3: Geofenced Work Locations */}
        <TabsContent value="locations" className="space-y-4 pt-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {workLocations.map(loc => (
              <div key={loc.id} className="rounded-xl border bg-card p-4 shadow-sm space-y-3">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2">
                    <MapPin className="h-4 w-4 text-emerald-600 shrink-0" />
                    <h3 className="font-bold text-xs text-foreground">
                      {language === 'ar' ? loc.nameAr : loc.nameEn}
                    </h3>
                  </div>
                  <Badge variant="outline" className="text-[10px]">
                    {loc.code}
                  </Badge>
                </div>

                <p className="text-xs text-muted-foreground">{loc.address}</p>

                <div className="rounded-lg border bg-muted/40 p-2.5 text-[11px] space-y-1 font-mono">
                  <div className="flex justify-between text-muted-foreground">
                    <span>{t.org.coordinates}:</span>
                    <span className="font-bold text-foreground">
                      {loc.latitude.toFixed(4)}, {loc.longitude.toFixed(4)}
                    </span>
                  </div>
                  <div className="flex justify-between text-muted-foreground">
                    <span>{t.org.radius}:</span>
                    <span className="font-bold text-emerald-600">{loc.radiusMeters} م (دقة GPS)</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </TabsContent>

        {/* Tab 4: Interactive Org Chart */}
        <TabsContent value="orgchart" className="pt-4">
          <div className="rounded-xl border bg-card p-6 shadow-sm flex flex-col items-center space-y-6">
            {/* Top Node: Company HQ */}
            <div className="rounded-xl border-2 border-primary bg-primary/10 p-4 text-center max-w-sm w-full shadow-md">
              <span className="text-[10px] font-bold text-primary uppercase">مجلس الإدارة والمنشأة الرئيسية</span>
              <h3 className="text-sm font-black text-foreground mt-0.5">{company.legalNameAr}</h3>
              <p className="text-[11px] text-muted-foreground mt-1">الرئيس التنفيذي: م. عبد العزيز الفهد</p>
            </div>

            {/* Tree Branch */}
            <div className="w-0.5 h-6 bg-border" />

            {/* Level 2: Divisions */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 w-full">
              {orgUnits.slice(0, 3).map(unit => (
                <div key={unit.id} className="rounded-xl border bg-muted/30 p-3.5 text-center shadow-sm space-y-1">
                  <Badge variant="outline" className="text-[10px] mb-1">
                    {unit.type === 'division' ? 'قطاع تنفيذي' : 'إدارة عامة'}
                  </Badge>
                  <h4 className="font-bold text-xs text-foreground">
                    {language === 'ar' ? unit.nameAr : unit.nameEn}
                  </h4>
                  <p className="text-[11px] text-primary font-medium">{unit.managerName}</p>
                  <p className="text-[10px] text-muted-foreground">{unit.employeeCount} موظف</p>
                </div>
              ))}
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
};
