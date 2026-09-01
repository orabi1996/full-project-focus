import React, { createContext, useContext, useEffect, type ReactNode } from "react";

interface MaterialDesignContextType {
  themeVersion: "m3";
}

const MaterialDesignContext = createContext<MaterialDesignContextType>({
  themeVersion: "m3",
});

export function useMaterialTheme() {
  return useContext(MaterialDesignContext);
}

export function MaterialDesignProvider({ children }: { children: ReactNode }) {
  useEffect(() => {
    document.documentElement.setAttribute("data-theme", "material-3");
    document.documentElement.style.setProperty("--font-sans", "'Cairo', 'Plus Jakarta Sans', 'Roboto', system-ui, sans-serif");
  }, []);

  return (
    <MaterialDesignContext.Provider value={{ themeVersion: "m3" }}>
      <div className="material-3-root min-h-screen bg-background text-foreground antialiased selection:bg-secondary selection:text-secondary-foreground">
        {children}
      </div>
    </MaterialDesignContext.Provider>
  );
}
