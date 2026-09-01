import "@fontsource/cairo/arabic-400.css";
import "@fontsource/cairo/arabic-500.css";
import "@fontsource/cairo/arabic-600.css";
import "@fontsource/cairo/arabic-700.css";
import "@fontsource/cairo/latin-400.css";
import "@fontsource/cairo/latin-500.css";
import "@fontsource/cairo/latin-600.css";
import "@fontsource/cairo/latin-700.css";
import "@fontsource/roboto/latin-400.css";
import "@fontsource/roboto/latin-500.css";
import "@fontsource/roboto/latin-700.css";

import { CssBaseline, ThemeProvider, createTheme } from "@mui/material";
import type { ReactNode } from "react";

const materialTheme = createTheme({
  direction: "rtl",
  palette: {
    mode: "light",
    primary: {
      main: "#365F91",
      light: "#D6E4F7",
      dark: "#173A63",
      contrastText: "#FFFFFF",
    },
    secondary: {
      main: "#52677D",
      light: "#D7E3F0",
      dark: "#27394B",
    },
    success: { main: "#217A4A" },
    warning: { main: "#9A6700" },
    error: { main: "#BA1A1A" },
    background: {
      default: "#F7F9FC",
      paper: "#FFFFFF",
    },
    text: {
      primary: "#18212B",
      secondary: "#52606D",
    },
    divider: "#DDE3EA",
  },
  shape: { borderRadius: 14 },
  typography: {
    fontFamily: '"Cairo", "Roboto", system-ui, sans-serif',
    h1: { fontWeight: 700, letterSpacing: "-0.02em" },
    h2: { fontWeight: 700, letterSpacing: "-0.015em" },
    h3: { fontWeight: 700 },
    h4: { fontWeight: 700 },
    h5: { fontWeight: 700 },
    h6: { fontWeight: 700 },
    button: { fontWeight: 700, textTransform: "none" },
  },
  components: {
    MuiButton: {
      defaultProps: { disableElevation: true },
      styleOverrides: {
        root: {
          minHeight: 40,
          borderRadius: 20,
          paddingInline: 20,
        },
      },
    },
    MuiCard: {
      styleOverrides: {
        root: {
          border: "1px solid #E1E7EE",
          boxShadow: "0 1px 2px rgba(24, 33, 43, 0.05)",
        },
      },
    },
    MuiPaper: {
      styleOverrides: {
        rounded: { borderRadius: 20 },
      },
    },
    MuiTextField: {
      defaultProps: { variant: "outlined" },
    },
    MuiOutlinedInput: {
      styleOverrides: {
        root: { borderRadius: 14 },
      },
    },
    MuiDialog: {
      styleOverrides: {
        paper: { borderRadius: 24 },
      },
    },
    MuiTooltip: {
      defaultProps: { arrow: true },
    },
  },
});

export function MaterialDesignProvider({ children }: { children: ReactNode }) {
  return (
    <ThemeProvider theme={materialTheme}>
      <CssBaseline />
      {children}
    </ThemeProvider>
  );
}
