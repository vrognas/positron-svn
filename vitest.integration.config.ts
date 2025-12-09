import { defineConfig } from "vitest/config";
import path from "path";

// Integration tests config - requires SVN CLI
// Run on CI only via: npm run test:integration
export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    include: ["test/integration/**/*.test.ts"],
    exclude: ["node_modules", "out", "dist"],
    testTimeout: 60000, // Integration tests need more time
    coverage: {
      provider: "v8",
      reporter: ["text", "html", "lcov"],
      include: ["src/**/*.ts"],
      exclude: ["src/**/*.test.ts", "test/**", "out/**", "dist/**"]
    }
  },
  resolve: {
    alias: {
      vscode: path.resolve(__dirname, "test/__mocks__/vscode.ts")
    }
  }
});
