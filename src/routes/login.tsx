import { createFileRoute } from "@tanstack/react-router";

import { LoginPage } from "../components/auth/LoginPage";

export const Route = createFileRoute("/login")({
  head: () => ({
    meta: [{ title: "تسجيل الدخول | كاسيرا بلس Classera Pulse HCM" }],
  }),
  component: LoginPage,
});
