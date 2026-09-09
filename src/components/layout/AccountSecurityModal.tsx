import React, { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "../ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../ui/tabs";
import { Button } from "../ui/button";
import { Switch } from "../ui/switch";
import { ShieldCheck, KeyRound, Bell, Sliders, Globe } from "lucide-react";
import { toast } from "sonner";
import { useApp } from "../../lib/context/AppContext";
import { useAuth } from "../../lib/auth/AuthContext";
import { AccountSecurityPanel } from "./AccountSecurityPanel";

interface AccountSecurityModalProps {
  isOpen: boolean;
  onClose: () => void;
  userEmail: string;
}

export const AccountSecurityModal: React.FC<AccountSecurityModalProps> = ({
  isOpen,
  onClose,
  userEmail,
}) => {
  const { language, setLanguage } = useApp();
  const { isDemo } = useAuth();

  // Notification preferences state
  const [emailAlerts, setEmailAlerts] = useState(true);
  const [whatsappAlerts, setWhatsappAlerts] = useState(true);
  const [systemPushAlerts, setSystemPushAlerts] = useState(true);

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent
        dir={language === "ar" ? "rtl" : "ltr"}
        className="max-h-[90dvh] max-w-2xl overflow-y-auto rounded-3xl p-6 sm:p-7 shadow-2xl border-border/80"
      >
        <DialogHeader className="text-start space-y-1">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="h-10 w-10 rounded-2xl bg-primary/10 text-primary flex items-center justify-center">
                <ShieldCheck className="h-5 w-5" />
              </div>
              <div>
                <DialogTitle className="text-base font-black">
                  {language === "ar"
                    ? "إعدادات الحساب والأمان الشخصي"
                    : "Account and security settings"}
                </DialogTitle>
                <DialogDescription className="text-xs font-medium text-muted-foreground">
                  {language === "ar" ? "إعدادات الحساب لـ" : "Account settings for"}{" "}
                  <bdi>{userEmail}</bdi>
                </DialogDescription>
              </div>
            </div>
          </div>
        </DialogHeader>

        <Tabs dir={language === "ar" ? "rtl" : "ltr"} defaultValue="security" className="mt-4">
          <TabsList className="grid grid-cols-3 h-11 rounded-2xl bg-muted/50 p-1">
            <TabsTrigger
              value="security"
              className="rounded-xl text-xs font-bold gap-1.5 data-[state=active]:bg-card data-[state=active]:shadow-xs"
            >
              <KeyRound className="h-3.5 w-3.5 text-primary" />
              {language === "ar" ? "الأمان" : "Security"}
            </TabsTrigger>
            <TabsTrigger
              value="notifications"
              className="rounded-xl text-xs font-bold gap-1.5 data-[state=active]:bg-card data-[state=active]:shadow-xs"
            >
              <Bell className="h-3.5 w-3.5 text-primary" />
              {language === "ar" ? "الإشعارات" : "Notifications"}
            </TabsTrigger>
            <TabsTrigger
              value="preferences"
              className="rounded-xl text-xs font-bold gap-1.5 data-[state=active]:bg-card data-[state=active]:shadow-xs"
            >
              <Sliders className="h-3.5 w-3.5 text-primary" />
              {language === "ar" ? "التفضيلات" : "Preferences"}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="security" className="pt-3">
            <AccountSecurityPanel language={language} isDemo={isDemo} />
          </TabsContent>

          {/* TAB 2: Notifications */}
          <TabsContent value="notifications" className="space-y-3 pt-3">
            <div className="rounded-2xl border border-border/70 p-4 bg-muted/20 space-y-3 text-start">
              <h4 className="text-xs font-black">قنوات استلام الإشعارات</h4>

              <div className="flex items-center justify-between py-2 border-b border-border/50">
                <div>
                  <span className="text-xs font-bold block">إشعارات البريد الإلكتروني</span>
                  <span className="text-[10px] text-muted-foreground">
                    استلام طلبات الإجازات ومسيرات الرواتب وتحديثات الوثائق على البريد
                  </span>
                </div>
                <Switch checked={emailAlerts} onCheckedChange={setEmailAlerts} />
              </div>

              <div className="flex items-center justify-between py-2 border-b border-border/50">
                <div>
                  <span className="text-xs font-bold block">إشعارات الواتساب والرسائل النصية</span>
                  <span className="text-[10px] text-muted-foreground">
                    تنبيهات فورية عند إيداع الراتب، والطلبات العاجلة لاعتمادات العمليات
                  </span>
                </div>
                <Switch checked={whatsappAlerts} onCheckedChange={setWhatsappAlerts} />
              </div>

              <div className="flex items-center justify-between py-2">
                <div>
                  <span className="text-xs font-bold block">
                    إشعارات المتصفح الفورية (Push Alerts)
                  </span>
                  <span className="text-[10px] text-muted-foreground">
                    تنبيهات سطح المكتب أثناء العمل على النظام لطلبات الموظفين والموافقات
                  </span>
                </div>
                <Switch checked={systemPushAlerts} onCheckedChange={setSystemPushAlerts} />
              </div>
            </div>

            <Button
              size="sm"
              onClick={() => toast.success("تم حفظ تفضيلات الإشعارات بنجاح!")}
              className="rounded-full text-xs font-bold bg-primary hover:bg-primary/90 text-primary-foreground h-8 px-5"
            >
              حفظ التفضيلات
            </Button>
          </TabsContent>

          {/* TAB 3: Preferences */}
          <TabsContent value="preferences" className="space-y-4 pt-3 text-start">
            <div className="rounded-2xl border border-border/70 p-4 bg-muted/20 space-y-3">
              <h4 className="text-xs font-black">لغة واجهة النظام الإقليمية</h4>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant={language === "ar" ? "default" : "outline"}
                  onClick={() => {
                    setLanguage("ar");
                    toast.success("تم اعتماد اللغة العربية");
                  }}
                  className="rounded-full text-xs font-bold gap-1.5 h-8 px-4"
                >
                  <Globe className="h-3.5 w-3.5" />
                  العربية (المملكة العربية السعودية)
                </Button>
                <Button
                  size="sm"
                  variant={language === "en" ? "default" : "outline"}
                  onClick={() => {
                    setLanguage("en");
                    toast.success("Language switched to English");
                  }}
                  className="rounded-full text-xs font-bold gap-1.5 h-8 px-4"
                >
                  <Globe className="h-3.5 w-3.5" />
                  English (International)
                </Button>
              </div>
            </div>

            <div className="rounded-2xl border border-border/70 p-4 bg-muted/20 space-y-2">
              <h4 className="text-xs font-black">التوقيت المؤسسي المعتمد</h4>
              <p className="text-[11px] text-muted-foreground">
                توقيت مكة المكرمة / الرياض (GMT+3) - مطابق لحسابات مسيرات التأمينات ونظام العمل
                السعودي.
              </p>
            </div>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
};
