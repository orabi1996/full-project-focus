import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    exclude: ["e2e/**", "node_modules/**", ".output/**"],
    coverage: {
      provider: "v8",
      reporter: ["text", "html", "lcov", "json-summary"],
      reportsDirectory: "coverage",
      include: [
        "src/lib/auth/permissions.ts",
        "src/lib/auth/roles.ts",
        "src/lib/config/runtime-config.ts",
        "src/lib/data/reliable-mutation.ts",
        "src/lib/utils/payroll-calculator.ts",
        "src/lib/utils/eosb-calculator.ts",
        "src/lib/utils/export-helpers.ts",
        "src/components/organization/organization-utils.ts",
      ],
      thresholds: {
        statements: 85,
        branches: 75,
        functions: 85,
        lines: 85,
      },
    },
  },
});
