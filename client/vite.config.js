import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function readServerEnvValue(key) {
  try {
    const envPath = path.resolve(__dirname, "..", "server", ".env");
    const envText = fs.readFileSync(envPath, "utf8");
    const envLine = envText
      .split(/\r?\n/)
      .find((line) => line.trim().startsWith(`${key}=`));

    if (!envLine) {
      return "";
    }

    return envLine.slice(envLine.indexOf("=") + 1).trim();
  } catch (_error) {
    return "";
  }
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, __dirname, "");
  const serverPort = readServerEnvValue("PORT") || "4000";
  const serverPublicUrl = readServerEnvValue("PUBLIC_APP_URL");
  const proxyTarget =
    env.VITE_PROXY_TARGET?.trim() ||
    serverPublicUrl ||
    `http://localhost:${serverPort}`;

  return {
    plugins: [react()],
    server: {
      port: Number(env.VITE_PORT || 5173),
      proxy: {
        "/api": {
          target: proxyTarget,
          changeOrigin: true,
        },
      },
    },
  };
});
