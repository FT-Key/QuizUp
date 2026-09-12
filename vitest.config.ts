import { defineConfig } from "vitest/config";
import path from "node:path";

// NOTA (US-01): `environmentMatchGlobs` fue eliminado en Vitest 3+ (se instaló Vitest 5).
// La alternativa vigente es `test.projects`: un proyecto "unit" en entorno node
// (core/adapters/lib) y un proyecto "ui" en jsdom (hooks/components). Si un archivo
// suelto necesita otro entorno puntual, se puede usar el docblock
// `// @vitest-environment jsdom` en la primera línea del propio test.
export default defineConfig({
  // US-13: el tsconfig raíz usa "jsx": "preserve" (Next). Oxc compila los .tsx de
  // los tests (hooks/componentes). Reemplaza al tsconfig anidado
  // components/tsconfig.json (eliminado).
  oxc: { jsx: { runtime: "automatic" } },
  test: {
    projects: [
      {
        test: {
          name: "unit",
          environment: "node",
          include: [
            "core/**/*.test.ts",
            "adapters/**/*.test.ts",
            "infra/**/*.test.ts",
            "lib/**/*.test.ts",
            "tests/**/*.test.ts",
          ],
        },
      },
      {
        test: {
          name: "ui",
          environment: "jsdom",
          include: [
            "hooks/**/*.test.ts",
            "hooks/**/*.test.tsx",
            "components/**/*.test.ts",
            "components/**/*.test.tsx",
            // US-14: tests de caracterización de páginas del App Router
            // (game/admin) que renderizan componentes cliente en jsdom.
            "app/**/*.test.tsx",
          ],
        },
      },
    ],
  },
  resolve: { alias: { "@": path.resolve(__dirname, ".") } },
});
