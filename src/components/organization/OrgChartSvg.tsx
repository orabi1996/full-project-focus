import React, { useState, useRef } from 'react';
import {
  ZoomIn,
  ZoomOut,
  Maximize2,
  Minimize2,
  RotateCcw,
  Search,
  Download,
  Users,
  ChevronDown,
  ChevronUp,
  Building,
  Briefcase,
  ShieldCheck,
  Sparkles,
  Info,
} from 'lucide-react';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '../ui/dialog';

export interface OrgNode {
  id: string;
  nameAr: string;
  nameEn: string;
  titleAr: string;
  titleEn: string;
  managerName: string;
  avatarUrl: string;
  type: 'board' | 'executive' | 'division' | 'department' | 'unit';
  employeeCount: number;
  openPositions: number;
  budgetMonthly: number;
  color: string;
  children?: OrgNode[];
}

export const defaultOrgTree: OrgNode = {
  id: 'root-1',
  nameAr: 'شركة فوكس للتقنية وحلول الأعمال',
  nameEn: 'Focus Tech & Business Solutions Co.',
  titleAr: 'مجلس الإدارة والرئيس التنفيذي (CEO)',
  titleEn: 'Board of Directors & CEO',
  managerName: 'م. عبد العزيز الفهد',
  avatarUrl: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150',
  type: 'board',
  employeeCount: 120,
  openPositions: 8,
  budgetMonthly: 1250000,
  color: '#0B57D0',
  children: [
    {
      id: 'exec-1',
      nameAr: 'قطاع هندسة وتطوير البرمجيات',
      nameEn: 'Software Engineering & Cloud Division',
      titleAr: 'نائب الرئيس التنفيذي للتقنية (CTO)',
      titleEn: 'Chief Technology Officer',
      managerName: 'د. طارق المنصور',
      avatarUrl: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150',
      type: 'division',
      employeeCount: 48,
      openPositions: 4,
      budgetMonthly: 550000,
      color: '#0284C7',
      children: [
        {
          id: 'dept-101',
          nameAr: 'إدارة هندسة الواجهات والمنصات السحابية',
          nameEn: 'Frontend & Cloud Platforms Dept.',
          titleAr: 'مدير هندسة البرمجيات',
          titleEn: 'Lead Software Architect',
          managerName: 'م. ريان القحطاني',
          avatarUrl: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=150',
          type: 'department',
          employeeCount: 22,
          openPositions: 2,
          budgetMonthly: 260000,
          color: '#0369A1',
        },
        {
          id: 'dept-102',
          nameAr: 'إدارة الأمن السيبراني والبنية التحتية',
          nameEn: 'Cybersecurity & DevOps Dept.',
          titleAr: 'رئيس أمن المعلومات (CISO)',
          titleEn: 'Chief Information Security Officer',
          managerName: 'أ. هيفاء الشهري',
          avatarUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150',
          type: 'department',
          employeeCount: 16,
          openPositions: 1,
          budgetMonthly: 210000,
          color: '#0D9488',
        },
        {
          id: 'dept-103',
          nameAr: 'إدارة الذكاء الاصطناعي وعلوم البيانات',
          nameEn: 'AI & Data Science Lab',
          titleAr: 'كبير علماء البيانات',
          titleEn: 'Principal AI Scientist',
          managerName: 'د. سامي الغامدي',
          avatarUrl: 'https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?w=150',
          type: 'department',
          employeeCount: 10,
          openPositions: 1,
          budgetMonthly: 180000,
          color: '#6366F1',
        },
      ],
    },
    {
      id: 'exec-2',
      nameAr: 'قطاع رأس المال البشري والعمليات',
      nameEn: 'Human Capital & Corporate Operations',
      titleAr: 'رئيس الموارد البشرية والامتثال (CHRO)',
      titleEn: 'Chief Human Resources Officer',
      managerName: 'أ. نورة التميمي',
      avatarUrl: 'https://images.unsplash.com/photo-1580489944761-15a19d654956?w=150',
      type: 'division',
      employeeCount: 36,
      openPositions: 2,
      budgetMonthly: 340000,
      color: '#10B981',
      children: [
        {
          id: 'dept-201',
          nameAr: 'إدارة استقطاب المواهب والتوظيف (ATS)',
          nameEn: 'Talent Acquisition & Sourcing',
          titleAr: 'مدير التوظيف واستقطاب الكفاءات',
          titleEn: 'Head of Recruitment',
          managerName: 'أ. خالد السديري',
          avatarUrl: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150',
          type: 'department',
          employeeCount: 12,
          openPositions: 1,
          budgetMonthly: 120000,
          color: '#059669',
        },
        {
          id: 'dept-202',
          nameAr: 'إدارة العمليات والرواتب وحماية الأجور (WPS)',
          nameEn: 'Payroll & Workforce Operations',
          titleAr: 'مدير الرواتب والمزايا المؤسسية',
          titleEn: 'Compensation & Benefits Lead',
          managerName: 'أ. فيصل الدوسري',
          avatarUrl: 'https://images.unsplash.com/photo-1522075469751-3a6694fb2f61?w=150',
          type: 'department',
          employeeCount: 14,
          openPositions: 1,
          budgetMonthly: 140000,
          color: '#16A34A',
        },
        {
          id: 'dept-203',
          nameAr: 'إدارة تطوير وتدريب الكوادر',
          nameEn: 'Learning & Organizational Development',
          titleAr: 'أخصائي التطوير المؤسسي',
          titleEn: 'Organizational Development Lead',
          managerName: 'أ. سارة الحربي',
          avatarUrl: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=150',
          type: 'department',
          employeeCount: 10,
          openPositions: 0,
          budgetMonthly: 80000,
          color: '#84CC16',
        },
      ],
    },
    {
      id: 'exec-3',
      nameAr: 'قطاع الشؤون المالية والاستثمار',
      nameEn: 'Finance & Corporate Strategy',
      titleAr: 'المدير المالي التنفيذي (CFO)',
      titleEn: 'Chief Financial Officer',
      managerName: 'أ. ماجد العتيبي',
      avatarUrl: 'https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?w=150',
      type: 'division',
      employeeCount: 24,
      openPositions: 1,
      budgetMonthly: 260000,
      color: '#8B5CF6',
      children: [
        {
          id: 'dept-301',
          nameAr: 'إدارة الحسابات العامة وموازنة الرواتب',
          nameEn: 'General Accounting & Budgets',
          titleAr: 'رئيس قسم المحاسبة المالية',
          titleEn: 'Chief Accountant',
          managerName: 'أ. عمر العمودي',
          avatarUrl: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150',
          type: 'department',
          employeeCount: 14,
          openPositions: 1,
          budgetMonthly: 150000,
          color: '#7C3AED',
        },
        {
          id: 'dept-302',
          nameAr: 'إدارة المشتريات وسلاسل الإمداد',
          nameEn: 'Procurement & Vendor Relations',
          titleAr: 'مدير العقود والمشتريات',
          titleEn: 'Procurement Manager',
          managerName: 'أ. ليلى الشمري',
          avatarUrl: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=150',
          type: 'department',
          employeeCount: 10,
          openPositions: 0,
          budgetMonthly: 110000,
          color: '#9333EA',
        },
      ],
    },
    {
      id: 'exec-4',
      nameAr: 'قطاع النمو وتطوير الأعمال والمبيعات',
      nameEn: 'Growth & Business Development',
      titleAr: 'رئيس النمو التجاري (CGO)',
      titleEn: 'Chief Growth Officer',
      managerName: 'م. حسام الصالح',
      avatarUrl: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=150',
      type: 'division',
      employeeCount: 12,
      openPositions: 1,
      budgetMonthly: 180000,
      color: '#EC4899',
      children: [
        {
          id: 'dept-401',
          nameAr: 'إدارة علاقات كبار العملاء والمؤسسات',
          nameEn: 'Enterprise Accounts & Key Clients',
          titleAr: 'مدير مبيعات الشركات الكبرى',
          titleEn: 'Enterprise Sales Lead',
          managerName: 'أ. ريم الزهراني',
          avatarUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150',
          type: 'department',
          employeeCount: 8,
          openPositions: 1,
          budgetMonthly: 120000,
          color: '#DB2777',
        },
      ],
    },
  ],
};

export const OrgChartSvg: React.FC = () => {
  const [zoom, setZoom] = useState(1);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedNode, setSelectedNode] = useState<OrgNode | null>(null);
  const [collapsedNodes, setCollapsedNodes] = useState<Record<string, boolean>>({});
  const [isFullscreen, setIsFullscreen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const toggleCollapse = (nodeId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setCollapsedNodes(prev => ({ ...prev, [nodeId]: !prev[nodeId] }));
  };

  const handleZoomIn = () => setZoom(prev => Math.min(1.8, Number((prev + 0.15).toFixed(2))));
  const handleZoomOut = () => setZoom(prev => Math.max(0.4, Number((prev - 0.15).toFixed(2))));
  const handleResetZoom = () => setZoom(1);

  const toggleFullscreen = () => {
    setIsFullscreen(!isFullscreen);
  };

  const handleExportSvg = () => {
    const svgElement = document.getElementById('hrms-org-chart-svg');
    if (!svgElement) return;
    const svgData = new XMLSerializer().serializeToString(svgElement);
    const blob = new Blob([svgData], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `Focus_HRMS_Org_Chart_${new Date().toISOString().split('T')[0]}.svg`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const isMatched = (node: OrgNode): boolean => {
    if (!searchTerm) return false;
    const term = searchTerm.toLowerCase();
    return (
      node.nameAr.toLowerCase().includes(term) ||
      node.nameEn.toLowerCase().includes(term) ||
      node.managerName.toLowerCase().includes(term) ||
      node.titleAr.toLowerCase().includes(term)
    );
  };

  return (
    <div
      ref={containerRef}
      className={`relative rounded-3xl border border-border/80 bg-card shadow-sm overflow-hidden flex flex-col transition-all duration-300 ${
        isFullscreen ? 'fixed inset-4 z-50 shadow-2xl bg-card' : 'w-full min-h-[640px]'
      }`}
    >
      {/* Top Toolbar (Google M3 Style) */}
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
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              placeholder="بحث بالقسم، المدير، المسمى..."
              className="w-full h-9 rounded-full border border-border/80 bg-background pr-9 pl-3 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-primary/40 transition-all shadow-xs"
            />
          </div>

          {/* Zoom Buttons */}
          <div className="flex items-center gap-1 bg-background border border-border/80 rounded-full p-1 shadow-xs">
            <Button
              variant="ghost"
              size="icon"
              onClick={handleZoomOut}
              className="h-7 w-7 rounded-full text-muted-foreground hover:text-foreground"
              title="تصغير Zoom Out"
            >
              <ZoomOut className="h-3.5 w-3.5" />
            </Button>
            <span className="text-[10px] font-mono font-bold px-1.5 min-w-9 text-center text-foreground">
              {Math.round(zoom * 100)}%
            </span>
            <Button
              variant="ghost"
              size="icon"
              onClick={handleZoomIn}
              className="h-7 w-7 rounded-full text-muted-foreground hover:text-foreground"
              title="تكبير Zoom In"
            >
              <ZoomIn className="h-3.5 w-3.5" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={handleResetZoom}
              className="h-7 w-7 rounded-full text-muted-foreground hover:text-foreground"
              title="إعادة تعيين 100%"
            >
              <RotateCcw className="h-3.5 w-3.5" />
            </Button>
          </div>

          {/* Export Vector SVG */}
          <Button
            variant="outline"
            size="sm"
            onClick={handleExportSvg}
            className="rounded-full text-xs font-bold gap-1.5 h-9 border-border/80 hover:bg-secondary shadow-xs"
          >
            <Download className="h-3.5 w-3.5 text-primary" />
            تصدير SVG
          </Button>

          {/* Fullscreen Button */}
          <Button
            variant="ghost"
            size="icon"
            onClick={toggleFullscreen}
            className="h-9 w-9 rounded-full hover:bg-muted text-muted-foreground"
            title={isFullscreen ? 'تصغير الشاشة' : 'ملء الشاشة Fullscreen'}
          >
            {isFullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
          </Button>
        </div>
      </div>

      {/* SVG Canvas Workspace */}
      <div className="flex-1 overflow-auto p-8 relative flex justify-center items-start bg-[#F8FAFD] dark:bg-[#121316] select-none min-h-[520px]">
        {/* Decorative Grid Pattern */}
        <div
          className="absolute inset-0 opacity-[0.03] dark:opacity-[0.05] pointer-events-none"
          style={{
            backgroundImage: `radial-gradient(#0B57D0 1.5px, transparent 1.5px)`,
            backgroundSize: '24px 24px',
          }}
        />

        {/* Scalable Container */}
        <div
          style={{
            transform: `scale(${zoom})`,
            transformOrigin: 'top center',
            transition: 'transform 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
          }}
          className="py-4 px-6 flex flex-col items-center"
        >
          {/* Level 1: Root Node (Company HQ / CEO) */}
          <div className="flex flex-col items-center">
            <div
              onClick={() => setSelectedNode(defaultOrgTree)}
              className={`group relative rounded-3xl border-2 p-5 bg-card text-card-foreground shadow-lg hover:shadow-2xl transition-all duration-200 cursor-pointer w-96 text-center ${
                isMatched(defaultOrgTree)
                  ? 'ring-4 ring-amber-400 border-amber-500 scale-105'
                  : 'border-primary/80 hover:border-primary'
              }`}
            >
              <div className="flex items-center gap-4">
                <img
                  src={defaultOrgTree.avatarUrl}
                  alt={defaultOrgTree.managerName}
                  className="h-14 w-14 rounded-2xl border-2 border-primary object-cover shadow-md"
                />
                <div className="text-start flex-1 truncate">
                  <Badge className="text-[10px] font-bold bg-primary text-primary-foreground rounded-full px-2.5 mb-1">
                    مجلس الإدارة • الرئاسة التنفيذية
                  </Badge>
                  <h3 className="text-sm font-black text-foreground truncate">{defaultOrgTree.nameAr}</h3>
                  <p className="text-xs font-bold text-primary truncate mt-0.5">{defaultOrgTree.managerName}</p>
                  <p className="text-[10px] text-muted-foreground truncate">{defaultOrgTree.titleAr}</p>
                </div>
              </div>

              {/* Node Stats Pill */}
              <div className="mt-4 pt-3 border-t border-border/60 flex items-center justify-between text-[11px] text-muted-foreground font-medium">
                <span className="flex items-center gap-1">
                  <Users className="h-3.5 w-3.5 text-primary" />
                  <strong>{defaultOrgTree.employeeCount}</strong> موظف
                </span>
                <Badge variant="outline" className="text-[10px] font-mono text-emerald-600 bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200">
                  {defaultOrgTree.openPositions} شواغر متاحة
                </Badge>
              </div>

              {/* Collapse/Expand Toggle Button */}
              {defaultOrgTree.children && (
                <button
                  onClick={e => toggleCollapse(defaultOrgTree.id, e)}
                  className="absolute -bottom-3.5 left-1/2 -translate-x-1/2 h-7 w-7 rounded-full bg-primary text-primary-foreground flex items-center justify-center shadow-md hover:scale-110 transition-transform"
                >
                  {collapsedNodes[defaultOrgTree.id] ? (
                    <ChevronDown className="h-4 w-4" />
                  ) : (
                    <ChevronUp className="h-4 w-4" />
                  )}
                </button>
              )}
            </div>

            {/* Level 1 Connecting SVG Vector Line */}
            {!collapsedNodes[defaultOrgTree.id] && defaultOrgTree.children && (
              <>
                <svg
                  id="hrms-org-chart-svg"
                  className="w-full h-12 overflow-visible"
                  style={{ width: '1000px', height: '48px' }}
                >
                  <line x1="500" y1="0" x2="500" y2="24" stroke="#0B57D0" strokeWidth="2.5" />
                  <line x1="125" y1="24" x2="875" y2="24" stroke="#0B57D0" strokeWidth="2.5" />
                  <line x1="125" y1="24" x2="125" y2="48" stroke="#0B57D0" strokeWidth="2.5" />
                  <line x1="375" y1="24" x2="375" y2="48" stroke="#0B57D0" strokeWidth="2.5" />
                  <line x1="625" y1="24" x2="625" y2="48" stroke="#0B57D0" strokeWidth="2.5" />
                  <line x1="875" y1="24" x2="875" y2="48" stroke="#0B57D0" strokeWidth="2.5" />
                </svg>

                {/* Level 2: Executive Divisions Grid */}
                <div className="grid grid-cols-4 gap-6 w-[1000px]">
                  {defaultOrgTree.children.map(division => {
                    const isDivMatched = isMatched(division);
                    const isDivCollapsed = collapsedNodes[division.id];

                    return (
                      <div key={division.id} className="flex flex-col items-center">
                        {/* Division Card */}
                        <div
                          onClick={() => setSelectedNode(division)}
                          className={`group relative rounded-2xl border p-4 bg-card text-card-foreground shadow-md hover:shadow-xl transition-all duration-200 cursor-pointer w-full text-start ${
                            isDivMatched
                              ? 'ring-3 ring-amber-400 border-amber-500 scale-105'
                              : 'border-border hover:border-primary/60'
                          }`}
                        >
                          <div className="flex items-start gap-3">
                            <img
                              src={division.avatarUrl}
                              alt={division.managerName}
                              className="h-10 w-10 rounded-xl border border-border object-cover shrink-0 shadow-xs"
                            />
                            <div className="truncate flex-1">
                              <span
                                className="text-[10px] font-bold px-2 py-0.5 rounded-full inline-block mb-1"
                                style={{ backgroundColor: `${division.color}15`, color: division.color }}
                              >
                                قطاع تنفيذي
                              </span>
                              <h4 className="text-xs font-black text-foreground truncate">{division.nameAr}</h4>
                              <p className="text-[11px] font-bold text-primary truncate mt-0.5">{division.managerName}</p>
                              <p className="text-[10px] text-muted-foreground truncate">{division.titleAr}</p>
                            </div>
                          </div>

                          <div className="mt-3 pt-2.5 border-t border-border/60 flex items-center justify-between text-[10px] text-muted-foreground">
                            <span>{division.employeeCount} موظف</span>
                            <span className="font-mono font-bold text-foreground">
                              {(division.budgetMonthly / 1000).toFixed(0)}K ر.س/شهر
                            </span>
                          </div>

                          {/* Collapse Button */}
                          {division.children && (
                            <button
                              onClick={e => toggleCollapse(division.id, e)}
                              className="absolute -bottom-3 left-1/2 -translate-x-1/2 h-6 w-6 rounded-full bg-secondary text-secondary-foreground border border-border flex items-center justify-center shadow-xs hover:scale-110 transition-transform"
                            >
                              {isDivCollapsed ? (
                                <ChevronDown className="h-3.5 w-3.5" />
                              ) : (
                                <ChevronUp className="h-3.5 w-3.5" />
                              )}
                            </button>
                          )}
                        </div>

                        {/* Level 3: Connecting SVG lines & Departments */}
                        {!isDivCollapsed && division.children && (
                          <div className="flex flex-col items-center w-full mt-3">
                            {/* Vertical Line */}
                            <div className="w-0.5 h-4 bg-primary/40" />

                            <div className="space-y-2.5 w-full">
                              {division.children.map(dept => {
                                const isDeptMatched = isMatched(dept);

                                return (
                                  <div
                                    key={dept.id}
                                    onClick={() => setSelectedNode(dept)}
                                    className={`rounded-xl border p-3 bg-muted/30 text-start shadow-2xs hover:bg-card hover:shadow-md transition-all cursor-pointer ${
                                      isDeptMatched
                                        ? 'ring-2 ring-amber-400 border-amber-500 scale-102 bg-card'
                                        : 'border-border/80 hover:border-primary/50'
                                    }`}
                                  >
                                    <div className="flex items-center gap-2.5">
                                      <img
                                        src={dept.avatarUrl}
                                        alt={dept.managerName}
                                        className="h-8 w-8 rounded-lg border object-cover shrink-0"
                                      />
                                      <div className="truncate flex-1">
                                        <h5 className="text-[11px] font-bold text-foreground truncate">{dept.nameAr}</h5>
                                        <p className="text-[10px] text-muted-foreground truncate">{dept.managerName}</p>
                                      </div>
                                      <Badge variant="outline" className="text-[9px] font-bold shrink-0">
                                        {dept.employeeCount}
                                      </Badge>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Node Details Inspection Modal */}
      {selectedNode && (
        <Dialog open={!!selectedNode} onOpenChange={() => setSelectedNode(null)}>
          <DialogContent className="max-w-md rounded-3xl p-6">
            <DialogHeader>
              <div className="flex items-center gap-3.5">
                <img
                  src={selectedNode.avatarUrl}
                  alt={selectedNode.managerName}
                  className="h-14 w-14 rounded-2xl border-2 border-primary object-cover shadow-sm"
                />
                <div>
                  <Badge variant="secondary" className="rounded-full text-[10px] font-bold px-2.5 mb-1">
                    {selectedNode.type === 'board'
                      ? 'الكيان الأعلى'
                      : selectedNode.type === 'division'
                      ? 'قطاع تنفيذي رئيسي'
                      : 'إدارة تخصصية'}
                  </Badge>
                  <DialogTitle className="text-base font-black text-foreground">
                    {selectedNode.nameAr}
                  </DialogTitle>
                  <DialogDescription className="text-xs text-muted-foreground font-medium">
                    {selectedNode.nameEn}
                  </DialogDescription>
                </div>
              </div>
            </DialogHeader>

            <div className="space-y-3 pt-4 text-xs">
              <div className="rounded-2xl border border-border/80 bg-muted/20 p-4 space-y-2.5 font-medium">
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground">المدير المسؤول:</span>
                  <span className="font-bold text-foreground">{selectedNode.managerName}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground">المسمى الوظيفي:</span>
                  <span className="font-semibold text-primary">{selectedNode.titleAr}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground">إجمالي القوى العاملة:</span>
                  <span className="font-black text-foreground">{selectedNode.employeeCount} موظف</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground">الشواغر الوظيفية المتاحة:</span>
                  <span className="font-bold text-emerald-600">{selectedNode.openPositions} وظائف شاغرة</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground">ميزانية الرواتب الشهرية:</span>
                  <span className="font-mono font-bold text-foreground">
                    {selectedNode.budgetMonthly.toLocaleString()} ر.س
                  </span>
                </div>
              </div>

              <div className="flex justify-end pt-2">
                <Button
                  onClick={() => setSelectedNode(null)}
                  className="rounded-full text-xs font-bold bg-primary hover:bg-primary/90 px-5"
                >
                  إغلاق التفاصيل
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
};
