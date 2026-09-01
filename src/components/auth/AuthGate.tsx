import { Box, CircularProgress, Stack, Typography } from "@mui/material";
import { Navigate } from "@tanstack/react-router";
import type { ReactNode } from "react";

import { useAuth } from "../../lib/auth/AuthContext";

export function AuthGate({ children }: { children: ReactNode }) {
  const { session, isDemo, isLoading } = useAuth();

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

  if (!session && !isDemo) return <Navigate to="/login" replace />;

  return children;
}
