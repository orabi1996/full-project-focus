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
  Tab,
  Tabs,
  TextField,
  Typography,
} from "@mui/material";
import { Navigate } from "@tanstack/react-router";
import { Eye, EyeOff, LockKeyhole, ShieldCheck } from "lucide-react";
import { useState, type FormEvent } from "react";

import { useAuth } from "../../lib/auth/AuthContext";

type AuthMode = "login" | "signup";

export function LoginPage() {
  const { session, isDemo, isLoading, signIn, signUp, enterDemo } = useAuth();
  const [mode, setMode] = useState<AuthMode>("login");
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const demoEnabled = import.meta.env.VITE_ENABLE_DEMO_MODE === "true";

  if (isLoading) {
    return (
      <Box sx={{ minHeight: "100vh", display: "grid", placeItems: "center" }}>
        <Stack alignItems="center" spacing={2}>
          <CircularProgress size={34} />
          <Typography color="text.secondary">جارٍ تجهيز بيئة العمل الآمنة…</Typography>
        </Stack>
      </Box>
    );
  }

  if (session || isDemo) return <Navigate to="/" replace />;

  const changeMode = (nextMode: AuthMode) => {
    setMode(nextMode);
    setError("");
    setSuccess("");
    setPassword("");
    setConfirmPassword("");
  };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setError("");
    setSuccess("");

    if (mode === "signup" && password !== confirmPassword) {
      setError("كلمتا المرور غير متطابقتين.");
      return;
    }

    if (password.length < 8) {
      setError("يجب ألا تقل كلمة المرور عن 8 أحرف.");
      return;
    }

    setIsSubmitting(true);

    if (mode === "login") {
      const result = await signIn(email.trim(), password);
      if (result.error) setError(result.error);
    } else {
      const result = await signUp(fullName.trim(), email.trim(), password);
      if (result.error) {
        setError(result.error);
      } else if (result.requiresEmailConfirmation) {
        setSuccess("تم إنشاء الحساب. راجع بريدك الإلكتروني لتأكيد الحساب ثم سجّل الدخول.");
        setMode("login");
        setPassword("");
        setConfirmPassword("");
      }
    }

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
        p: { xs: 2, sm: 3 },
        bgcolor: "#EEF3F9",
        backgroundImage:
          "radial-gradient(circle at 10% 15%, rgba(54,95,145,.18), transparent 34%), radial-gradient(circle at 90% 85%, rgba(82,103,125,.14), transparent 30%)",
      }}
    >
      <Paper
        elevation={0}
        sx={{
          width: "100%",
          maxWidth: 480,
          overflow: "hidden",
          border: "1px solid",
          borderColor: "divider",
          borderRadius: 5,
        }}
      >
        <Box sx={{ p: { xs: 3, sm: 5 }, pb: { xs: 2, sm: 2.5 } }}>
          <Stack alignItems="center" spacing={1.25}>
            <Avatar
              sx={{
                width: 64,
                height: 64,
                bgcolor: "primary.main",
                boxShadow: "0 12px 30px rgba(28, 65, 108, .24)",
              }}
            >
              <ShieldCheck size={32} />
            </Avatar>
            <Chip icon={<LockKeyhole size={15} />} label="بوابة دخول آمنة" size="small" />
            <Typography variant="h5" fontWeight={700} textAlign="center">
              نظام الموارد البشرية المؤسسي
            </Typography>
            <Typography variant="body2" color="text.secondary" textAlign="center">
              الوصول إلى مساحة العمل وفق الدور والصلاحيات المعتمدة
            </Typography>
          </Stack>
        </Box>

        <Tabs
          value={mode}
          onChange={(_, value: AuthMode) => changeMode(value)}
          variant="fullWidth"
          aria-label="خيارات المصادقة"
          sx={{ px: { xs: 2, sm: 4 }, borderBottom: "1px solid", borderColor: "divider" }}
        >
          <Tab value="login" label="تسجيل الدخول" />
          <Tab value="signup" label="إنشاء حساب" />
        </Tabs>

        <Box component="form" onSubmit={handleSubmit} sx={{ p: { xs: 3, sm: 5 }, pt: 3.5 }}>
          <Stack spacing={2.25}>
            {error && <Alert severity="error">{error}</Alert>}
            {success && <Alert severity="success">{success}</Alert>}

            {mode === "signup" && (
              <TextField
                label="الاسم الكامل"
                autoComplete="name"
                value={fullName}
                onChange={(event) => setFullName(event.target.value)}
                required
                fullWidth
              />
            )}

            <TextField
              label="البريد الإلكتروني الوظيفي"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              required
              fullWidth
            />
            <TextField
              label="كلمة المرور"
              type={showPassword ? "text" : "password"}
              autoComplete={mode === "login" ? "current-password" : "new-password"}
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

            {mode === "signup" && (
              <TextField
                label="تأكيد كلمة المرور"
                type={showPassword ? "text" : "password"}
                autoComplete="new-password"
                value={confirmPassword}
                onChange={(event) => setConfirmPassword(event.target.value)}
                required
                fullWidth
              />
            )}

            <Button type="submit" variant="contained" size="large" disabled={isSubmitting}>
              {isSubmitting ? "جارٍ التحقق…" : mode === "login" ? "تسجيل الدخول" : "إنشاء الحساب"}
            </Button>
          </Stack>
        </Box>

        {demoEnabled && (
          <Box sx={{ px: { xs: 3, sm: 5 }, pb: { xs: 3, sm: 5 } }}>
            <Divider sx={{ mb: 2.5 }}>للمراجعة فقط</Divider>
            <Button variant="outlined" fullWidth onClick={enterDemo}>
              فتح النسخة التجريبية ببيانات غير حقيقية
            </Button>
          </Box>
        )}
      </Paper>
    </Box>
  );
}
