import React, { useState } from 'react';
import { useApp } from '../../lib/context/AppContext';
import type { RequestCategory, ServiceRequest } from '../../types';
import {
  GitPullRequest,
  CheckCircle2,
  XCircle,
  RotateCcw,
  Clock,
  Plus,
  Filter,
  User,
  ArrowRight,
  Shield,
  Layers,
  ChevronRight,
} from 'lucide-react';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '../ui/dialog';

export const WorkflowView: React.FC = () => {
  const {
    requests,
    approvalChains,
    currentUser,
    currentRole,
    approveRequest,
    rejectRequest,
    returnRequest,
    language,
    t,
  } = useApp();

  const [activeTab, setActiveTab] = useState('inbox');
  const [selectedRequest, setSelectedRequest] = useState<ServiceRequest | null>(null);
  const [decisionNote, setDecisionNote] = useState('');

  const pendingInbox = requests.filter(r => r.status === 'pending_approval');
  const myRequests = requests.filter(r => r.requesterId === currentUser.id);

  const handleApprove = (id: string) => {
    approveRequest(id, decisionNote || 'تمت الموافقة');
    setSelectedRequest(null);
    setDecisionNote('');
  };

  const handleReject = (id: string) => {
    rejectRequest(id, decisionNote || 'تم الرفض');
    setSelectedRequest(null);
    setDecisionNote('');
  };

  const handleReturn = (id: string) => {
    returnRequest(id, decisionNote || 'يرجى مراجعة وتصحيح المرفقات');
    setSelectedRequest(null);
    setDecisionNote('');
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-b pb-4">
        <div>
          <h1 className="text-xl font-bold text-foreground flex items-center gap-2">
            <GitPullRequest className="h-5 w-5 text-primary" />
            {t.workflow.inbox} ومحرك الاعتمادات المركزي
          </h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            إدارة مسارات وسلاسل الموافقات متعددة المراحل، اتخاذ القرارات ومتابعة المخطط الزمني
          </p>
        </div>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid grid-cols-3 max-w-md">
          <TabsTrigger value="inbox" className="text-xs font-bold gap-1.5">
            {t.workflow.inbox}
            {pendingInbox.length > 0 && (
              <Badge variant="destructive" className="h-4 px-1 text-[10px]">
                {pendingInbox.length}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="my_requests" className="text-xs font-bold">
            {t.workflow.myRequests} ({myRequests.length})
          </TabsTrigger>
          <TabsTrigger value="chains" className="text-xs font-bold">
            {t.workflow.chains} ({approvalChains.length})
          </TabsTrigger>
        </TabsList>

        {/* Tab 1: Inbox */}
        <TabsContent value="inbox" className="space-y-3 pt-4">
          {pendingInbox.length === 0 ? (
            <div className="rounded-xl border bg-card p-12 text-center text-xs text-muted-foreground">
              <CheckCircle2 className="mx-auto h-10 w-10 text-emerald-500 mb-2" />
              صندوق اعتماداتك نظيف تماماً! لا توجد طلبات معلقة تتطلب موافقتك.
            </div>
          ) : (
            pendingInbox.map(req => (
              <div
                key={req.id}
                className="rounded-xl border bg-card p-4 shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-4 hover:border-primary/40 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <img
                    src={req.requesterAvatar || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150'}
                    alt={req.requesterName}
                    className="h-11 w-11 rounded-full border object-cover shadow-xs"
                  />
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-sm text-foreground">{req.requesterName}</span>
                      <Badge variant="secondary" className="text-[10px]">
                        {req.type === 'leave' ? 'طلب إجازة' : req.type === 'expense_claim' ? 'مطالبة مصروفات' : 'سلفة مالية'}
                      </Badge>
                      <span className="text-[10px] font-mono text-muted-foreground">{req.referenceNo}</span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      {req.payload.leaveTypeNameAr || req.payload.categoryNameAr || req.payload.reason}
                      {req.payload.totalDays ? ` • ${req.payload.totalDays} أيام` : ''}
                      {req.payload.amount ? ` • ${req.payload.amount} ${t.currency}` : ''}
                    </p>
                    <div className="flex items-center gap-2 mt-1.5 text-[10px] text-muted-foreground">
                      <span>المرحلة {req.currentStepIndex} من {req.totalSteps}</span>
                      <span>•</span>
                      <span>بانتظار: {req.currentApproverRole}</span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 self-end md:self-center">
                  <Button
                    size="sm"
                    onClick={() => setSelectedRequest(req)}
                    variant="outline"
                    className="h-8 text-xs font-bold gap-1"
                  >
                    عرض التفاصيل
                  </Button>
                  <Button
                    size="sm"
                    onClick={() => handleApprove(req.id)}
                    className="h-8 text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white gap-1"
                  >
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    {t.approve}
                  </Button>
                  <Button
                    size="sm"
                    onClick={() => handleReject(req.id)}
                    variant="destructive"
                    className="h-8 text-xs font-bold gap-1"
                  >
                    <XCircle className="h-3.5 w-3.5" />
                    {t.reject}
                  </Button>
                </div>
              </div>
            ))
          )}
        </TabsContent>

        {/* Tab 2: My Requests */}
        <TabsContent value="my_requests" className="space-y-3 pt-4">
          <div className="rounded-xl border bg-card overflow-hidden shadow-sm">
            <table className="w-full text-xs">
              <thead className="border-b bg-muted/40 font-bold text-muted-foreground">
                <tr>
                  <th className="py-3 px-4 text-start">الرقم المرجعي</th>
                  <th className="py-3 px-4 text-start">نوع الطلب</th>
                  <th className="py-3 px-4 text-start">التفاصيل</th>
                  <th className="py-3 px-4 text-start">تاريخ التقديم</th>
                  <th className="py-3 px-4 text-start">الحالة</th>
                  <th className="py-3 px-4 text-center">المسار الزمني</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {myRequests.map(req => (
                  <tr key={req.id} className="hover:bg-muted/20">
                    <td className="py-3 px-4 font-mono font-bold">{req.referenceNo}</td>
                    <td className="py-3 px-4 font-semibold">
                      {req.type === 'leave' ? 'إجازة' : req.type === 'expense_claim' ? 'مصروفات' : 'سلفة'}
                    </td>
                    <td className="py-3 px-4 text-muted-foreground">
                      {req.payload.leaveTypeNameAr || req.payload.categoryNameAr || req.payload.reason}
                    </td>
                    <td className="py-3 px-4 text-muted-foreground">
                      {new Date(req.submittedAt).toLocaleDateString(language === 'ar' ? 'ar-SA' : 'en-US')}
                    </td>
                    <td className="py-3 px-4">
                      <Badge
                        variant="outline"
                        className={`text-[10px] ${
                          req.status === 'approved'
                            ? 'bg-emerald-500/10 text-emerald-700 border-emerald-200'
                            : req.status === 'pending_approval'
                            ? 'bg-amber-500/10 text-amber-700 border-amber-200'
                            : 'bg-destructive/10 text-destructive border-destructive/20'
                        }`}
                      >
                        {req.status === 'approved' ? 'معتمد بالكامل' : req.status === 'pending_approval' ? 'قيد المراجعة' : 'مرفوض'}
                      </Badge>
                    </td>
                    <td className="py-3 px-4 text-center">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setSelectedRequest(req)}
                        className="h-7 text-xs font-bold text-primary"
                      >
                        عرض الخط الزمني
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </TabsContent>

        {/* Tab 3: Approval Chains Designer */}
        <TabsContent value="chains" className="space-y-4 pt-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {approvalChains.map(chain => (
              <div key={chain.id} className="rounded-xl border bg-card p-5 shadow-sm space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="font-bold text-xs text-foreground">
                    {language === 'ar' ? chain.nameAr : chain.nameEn}
                  </h3>
                  <Badge variant="outline" className="text-[10px] bg-emerald-50 text-emerald-700">
                    افتراضي
                  </Badge>
                </div>
                <div className="space-y-2 pt-2 border-t text-xs">
                  {chain.steps.map((step, idx) => (
                    <div key={idx} className="flex items-center gap-2">
                      <span className="flex h-5 w-5 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-primary-foreground">
                        {step.sequence}
                      </span>
                      <span className="font-medium text-foreground">{step.stepNameAr}</span>
                      <span className="text-[10px] text-muted-foreground mr-auto">({step.resolverType})</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </TabsContent>
      </Tabs>

      {/* Request Details & Timeline Modal */}
      {selectedRequest && (
        <Dialog open={!!selectedRequest} onOpenChange={() => setSelectedRequest(null)}>
          <DialogContent className="max-w-xl">
            <DialogHeader>
              <DialogTitle className="text-base font-bold flex items-center gap-2">
                <GitPullRequest className="h-5 w-5 text-primary" />
                تفاصيل الطلب والمسار الزمني ({selectedRequest.referenceNo})
              </DialogTitle>
              <DialogDescription className="text-xs">
                مقدم من: {selectedRequest.requesterName} • {selectedRequest.departmentName}
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 text-xs py-2">
              {/* Payload Data Card */}
              <div className="rounded-lg border bg-muted/20 p-3 space-y-1.5">
                <span className="font-bold text-foreground">بيانات الطلب:</span>
                <p className="text-muted-foreground">
                  {selectedRequest.payload.leaveTypeNameAr || selectedRequest.payload.categoryNameAr || selectedRequest.payload.reason}
                </p>
                {selectedRequest.payload.startDate && (
                  <p className="text-muted-foreground">
                    الفترة: من {selectedRequest.payload.startDate} إلى {selectedRequest.payload.endDate} ({selectedRequest.payload.totalDays} أيام)
                  </p>
                )}
                {selectedRequest.payload.amount && (
                  <p className="text-muted-foreground font-bold text-primary">
                    المبلغ المطلوب: {selectedRequest.payload.amount} {t.currency}
                  </p>
                )}
              </div>

              {/* Approval Timeline */}
              <div className="space-y-2">
                <span className="font-bold text-foreground">المسار الزمني والموافقات:</span>
                <div className="space-y-2 border-r-2 border-primary/30 pr-3 mr-1">
                  {selectedRequest.timeline.map((evt, idx) => (
                    <div key={idx} className="relative text-xs space-y-0.5">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-foreground">{evt.actorName} ({evt.actorRole})</span>
                        <Badge variant="outline" className="text-[9px]">
                          {evt.action === 'submitted' ? 'تقديم' : evt.action === 'approved' ? 'موافقة' : 'رفض'}
                        </Badge>
                      </div>
                      <p className="text-muted-foreground">{evt.note || 'تمت المعالجة'}</p>
                      <span className="text-[10px] text-muted-foreground/80 font-mono">
                        {new Date(evt.timestamp).toLocaleString(language === 'ar' ? 'ar-SA' : 'en-US')}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Action Note Box */}
              {selectedRequest.status === 'pending_approval' && (
                <div className="space-y-1 pt-2 border-t">
                  <label className="font-bold">ملاحظات القرار (اختياري):</label>
                  <input
                    type="text"
                    value={decisionNote}
                    onChange={e => setDecisionNote(e.target.value)}
                    placeholder="اكتب ملاحظاتك للموظف..."
                    className="w-full h-8 rounded border px-2.5 text-xs"
                  />
                </div>
              )}
            </div>

            {selectedRequest.status === 'pending_approval' && (
              <DialogFooter className="flex justify-between items-center w-full mt-2">
                <Button
                  size="sm"
                  onClick={() => handleReturn(selectedRequest.id)}
                  variant="outline"
                  className="text-xs gap-1"
                >
                  <RotateCcw className="h-3 w-3" />
                  {t.returnForCorrection}
                </Button>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    onClick={() => handleReject(selectedRequest.id)}
                    variant="destructive"
                    className="text-xs"
                  >
                    {t.reject}
                  </Button>
                  <Button
                    size="sm"
                    onClick={() => handleApprove(selectedRequest.id)}
                    className="text-xs bg-emerald-600 hover:bg-emerald-700 text-white font-bold"
                  >
                    {t.approve}
                  </Button>
                </div>
              </DialogFooter>
            )}
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
};
