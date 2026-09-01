import {
  Alert,
  Avatar,
  Box,
  Button,
  CircularProgress,
  Divider,
  Paper,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import { ShieldCheck } from "lucide-react";
import { useState, type FormEvent, type ReactNode } from "react";

import { useAuth } from "../../lib/auth/AuthContext";

export function AuthGate({ children }: { children: ReactNode }) {
  const { session, isDemo, isLoading, signIn, enterDemo } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const demoEnabled = import.meta.env.VITE_ENABLE_DEMO_MODE === "true";

  if (isLoading) {
    return (
      <Box
        sx={{
          minHeight: "100vh",
          display: "grid",
          placeItems: "center",
          bgcolor: "background.default",
        }}
      >
        <Stack alignItems="center" spacing={2}>
          <CircularProgress size={34} />
          <Typography color="text.secondary">جارٍ تجهيز بيئة العمل الآمنة…</Typography>
        </Stack>
      </Box>
    );
  }

  if (session || isDemo) return children;

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
        p: 2,
        bgcolor: "#EEF3F9",
        backgroundImage:
          "radial-gradient(circle at 10% 15%, rgba(54,95,145,.16), transparent 34%), radial-gradient(circle at 90% 85%, rgba(82,103,125,.12), transparent 30%)",
      }}
    >
      <Paper
        elevation={0}
        sx={{
          width: "100%",
          maxWidth: 460,
          p: { xs: 3, sm: 5 },
          border: "1px solid",
          borderColor: "divider",
        }}
      >
        <Stack alignItems="center" spacing={1.25} mb={4}>
          <Avatar sx={{ width: 56, height: 56, bgcolor: "primary.main" }}>
            <ShieldCheck size={28} />
          </Avatar>
          <Typography variant="h5">نظام الموارد البشرية المؤسسي</Typography>
          <Typography variant="body2" color="text.secondary" textAlign="center">
            تسجيل دخول آمن للوصول إلى مساحة العمل حسب الصلاحيات المعتمدة
          </Typography>
        </Stack>

        <Box component="form" onSubmit={handleSubmit}>
          <Stack spacing={2.25}>
            {error && <Alert severity="error">{error}</Alert>}
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
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              required
              fullWidth
            />
            <Button type="submit" variant="contained" size="large" disabled={isSubmitting}>
              {isSubmitting ? "جارٍ التحقق…" : "تسجيل الدخول"}
            </Button>
          </Stack>
        </Box>

        {demoEnabled && (
          <>
            <Divider sx={{ my: 3 }}>للمراجعة فقط</Divider>
            <Button variant="outlined" fullWidth onClick={enterDemo}>
              فتح النسخة التجريبية ببيانات غير حقيقية
            </Button>
          </>
        )}
      </Paper>
    </Box>
  );
}
