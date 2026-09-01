import {
  Alert,
  Avatar,
  Box,
  Button,
  Chip,
  CircularProgress,
  Divider,
  IconButton,
  InputAdornment,
  Paper,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import { Navigate } from "@tanstack/react-router";
import {
  BadgeCheck,
  Building2,
  Eye,
  EyeOff,
  LockKeyhole,
  ShieldCheck,
  UsersRound,
} from "lucide-react";
import { useState, type FormEvent } from "react";

import { useAuth } from "../../lib/auth/AuthContext";

const platformFeatures = [
  { icon: ShieldCheck, label: "صلاحيات مؤسسية محكمة" },
  { icon: UsersRound, label: "إدارة متكاملة للموظفين" },
  { icon: BadgeCheck, label: "إجراءات واعتمادات موثقة" },
];

export function LoginPage() {
  const { session, isDemo, isLoading, signIn, enterDemo } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const demoEnabled = import.meta.env.VITE_ENABLE_DEMO_MODE === "true";

  if (isLoading) {
    return (
      <Box
        dir="rtl"
        sx={{
          minHeight: "100vh",
          display: "grid",
          placeItems: "center",
          bgcolor: "#F3F6FA",
        }}
      >
        <Stack alignItems="center" spacing={2}>
          <CircularProgress size={36} thickness={4} />
          <Typography color="text.secondary">جارٍ تجهيز بوابة الدخول الآمنة…</Typography>
        </Stack>
      </Box>
    );
  }

  if (session || isDemo) return <Navigate to="/" replace />;

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setError("");
    setIsSubmitting(true);

    const result = await signIn(email.trim(), password);
    if (result.error) setError(result.error);

    setIsSubmitting(false);
  };

  return (
    <Box
      component="main"
      dir="rtl"
      sx={{
        minHeight: "100vh",
        display: "grid",
        placeItems: "center",
        p: { xs: 2, sm: 3, lg: 5 },
        bgcolor: "#EEF3F8",
        backgroundImage:
          "radial-gradient(circle at 8% 12%, rgba(40, 91, 145, .17), transparent 30%), radial-gradient(circle at 92% 88%, rgba(28, 59, 94, .12), transparent 32%)",
      }}
    >
      <Paper
        elevation={0}
        sx={{
          width: "100%",
          maxWidth: 1040,
          minHeight: { md: 650 },
          display: "grid",
          gridTemplateColumns: { xs: "1fr", md: "0.9fr 1.1fr" },
          overflow: "hidden",
          border: "1px solid",
          borderColor: "rgba(62, 88, 118, .16)",
          borderRadius: { xs: 4, md: 6 },
          boxShadow: "0 28px 80px rgba(28, 55, 85, .13)",
        }}
      >
        <Box
          sx={{
            position: "relative",
            display: { xs: "none", md: "flex" },
            flexDirection: "column",
            justifyContent: "space-between",
            p: 6,
            color: "common.white",
            overflow: "hidden",
            background: "linear-gradient(145deg, #12375F 0%, #205D91 58%, #2F759D 100%)",
            "&::before": {
              content: '""',
              position: "absolute",
              width: 320,
              height: 320,
              borderRadius: "50%",
              top: -150,
              left: -120,
              bgcolor: "rgba(255,255,255,.07)",
            },
            "&::after": {
              content: '""',
              position: "absolute",
              width: 240,
              height: 240,
              borderRadius: "50%",
              bottom: -130,
              right: -80,
              border: "48px solid rgba(255,255,255,.055)",
            },
          }}
        >
          <Stack spacing={2.5} sx={{ position: "relative", zIndex: 1 }}>
            <Avatar
              variant="rounded"
              sx={{
                width: 62,
                height: 62,
                borderRadius: 3.5,
                bgcolor: "rgba(255,255,255,.14)",
                border: "1px solid rgba(255,255,255,.2)",
                backdropFilter: "blur(10px)",
              }}
            >
              <Building2 size={31} />
            </Avatar>
            <Box>
              <Typography variant="h4" fontWeight={800} lineHeight={1.35}>
                Focus HRMS
              </Typography>
              <Typography sx={{ mt: 1, color: "rgba(255,255,255,.78)", lineHeight: 1.9 }}>
                منصة موحّدة لإدارة رأس المال البشري، من أول يوم عمل وحتى نهاية الخدمة.
              </Typography>
            </Box>
          </Stack>

          <Stack spacing={2.25} sx={{ position: "relative", zIndex: 1 }}>
            {platformFeatures.map(({ icon: Icon, label }) => (
              <Stack key={label} direction="row" alignItems="center" spacing={1.5}>
                <Box
                  sx={{
                    width: 40,
                    height: 40,
                    display: "grid",
                    placeItems: "center",
                    flexShrink: 0,
                    borderRadius: 2.5,
                    bgcolor: "rgba(255,255,255,.12)",
                  }}
                >
                  <Icon size={20} />
                </Box>
                <Typography fontWeight={600}>{label}</Typography>
              </Stack>
            ))}
          </Stack>

          <Typography
            variant="caption"
            sx={{ position: "relative", zIndex: 1, color: "rgba(255,255,255,.62)" }}
          >
            بيئة عمل آمنة ومبنية وفق الصلاحيات المعتمدة
          </Typography>
        </Box>

        <Box
          sx={{
            display: "flex",
            alignItems: "center",
            p: { xs: 3, sm: 6, md: 7 },
            bgcolor: "background.paper",
          }}
        >
          <Box sx={{ width: "100%", maxWidth: 420, mx: "auto" }}>
            <Stack spacing={1.25} mb={4}>
              <Avatar
                sx={{
                  display: { xs: "flex", md: "none" },
                  width: 58,
                  height: 58,
                  mb: 1,
                  bgcolor: "primary.main",
                  boxShadow: "0 12px 30px rgba(28, 65, 108, .22)",
                }}
              >
                <Building2 size={28} />
              </Avatar>
              <Chip
                icon={<LockKeyhole size={15} />}
                label="بوابة الموظفين الآمنة"
                size="small"
                sx={{ alignSelf: "flex-start", fontWeight: 600 }}
              />
              <Typography variant="h4" fontWeight={800}>
                مرحبًا بعودتك
              </Typography>
              <Typography color="text.secondary" lineHeight={1.8}>
                أدخل بيانات حسابك الوظيفي للوصول إلى مساحة العمل.
              </Typography>
            </Stack>

            <Box component="form" onSubmit={handleSubmit} noValidate>
              <Stack spacing={2.5}>
                {error && <Alert severity="error">{error}</Alert>}

                <TextField
                  label="البريد الإلكتروني الوظيفي"
                  type="email"
                  autoComplete="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  autoFocus
                  required
                  fullWidth
                />
                <TextField
                  label="كلمة المرور"
                  type={showPassword ? "text" : "password"}
                  autoComplete="current-password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  required
                  fullWidth
                  slotProps={{
                    input: {
                      endAdornment: (
                        <InputAdornment position="end">
                          <IconButton
                            onClick={() => setShowPassword((visible) => !visible)}
                            edge="end"
                            aria-label={showPassword ? "إخفاء كلمة المرور" : "إظهار كلمة المرور"}
                          >
                            {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                          </IconButton>
                        </InputAdornment>
                      ),
                    },
                  }}
                />

                <Button
                  type="submit"
                  variant="contained"
                  size="large"
                  disabled={isSubmitting}
                  sx={{ minHeight: 52, fontWeight: 700 }}
                >
                  {isSubmitting ? "جارٍ التحقق…" : "تسجيل الدخول"}
                </Button>

                <Alert severity="info" icon={false} sx={{ lineHeight: 1.8 }}>
                  للحصول على بيانات الدخول أو استعادتها، تواصل مع مسؤول النظام في منشأتك.
                </Alert>
              </Stack>
            </Box>

            {demoEnabled && (
              <Box sx={{ mt: 3.5 }}>
                <Divider sx={{ mb: 2.5 }}>للمراجعة فقط</Divider>
                <Button variant="outlined" fullWidth onClick={enterDemo}>
                  فتح النسخة التجريبية ببيانات غير حقيقية
                </Button>
              </Box>
            )}

            <Typography
              variant="caption"
              color="text.secondary"
              textAlign="center"
              display="block"
              sx={{ mt: 4 }}
            >
              جميع محاولات الدخول تخضع لسياسات الأمان والتدقيق
            </Typography>
          </Box>
        </Box>
      </Paper>
    </Box>
  );
}
