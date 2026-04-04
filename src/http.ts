/**
 * SERVIDOR HTTP — src/http.ts
 *
 * Punto de entrada para el modo HTTP/desplegado en VPS.
 *
 * ¿Por qué Hono para /health y el SDK directamente para /mcp?
 *   El SDK de MCP espera objetos IncomingMessage/ServerResponse de Node.js
 *   nativo. En lugar de hacer un bridge complicado, usamos el servidor HTTP
 *   nativo de Node y delegamos solo la ruta /health a Hono para mostrar
 *   cómo se integran. En producción real, Hono se usaría para rutas propias
 *   (autenticación, métricas, etc.) y el SDK para /mcp.
 *
 * Diferencia con index.ts (stdio):
 *   - index.ts  → stdin/stdout (Claude Code local)
 *   - http.ts   → HTTP (VPS, Docker, acceso remoto)
 */

import http from "http";
import { Hono } from "hono";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { registerNoteTools } from "./tools/notes.js";

// ─────────────────────────────────────────────
// CONFIGURACIÓN
// ─────────────────────────────────────────────

const PORT = process.env.PORT ? parseInt(process.env.PORT) : 3000;

// ─────────────────────────────────────────────
// HONO — rutas propias (health, futuras APIs)
// ─────────────────────────────────────────────

/**
 * Hono gestiona las rutas que no son MCP.
 * Aquí es donde añadiríamos autenticación, métricas, etc.
 * en el futuro sin tocar la lógica del protocolo MCP.
 */
const hono = new Hono();

hono.get("/health", (c) =>
  c.json({ status: "ok", server: "notes-mcp", version: "1.0.0" })
);

// ─────────────────────────────────────────────
// SERVIDOR HTTP NATIVO — necesario para el SDK MCP
// ─────────────────────────────────────────────

const server = http.createServer(async (req, res) => {
  const url = req.url ?? "/";

  // Las llamadas MCP van a /mcp — las gestiona el SDK directamente
  if (url === "/mcp" && req.method === "POST") {
    // Leemos el body del request manualmente
    const chunks: Buffer[] = [];
    for await (const chunk of req) chunks.push(chunk);
    const body = JSON.parse(Buffer.concat(chunks).toString());

    // Instancia fresca por cada request (patrón stateless)
    const mcpServer = new McpServer({ name: "notes-mcp", version: "1.0.0" });
    registerNoteTools(mcpServer);

    const transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: undefined, // stateless — sin sesiones
    });

    // Limpiamos recursos cuando el cliente desconecta
    res.on("close", () => {
      transport.close();
      mcpServer.close();
    });

    await mcpServer.connect(transport);
    await transport.handleRequest(req, res, body);
    return;
  }

  // El resto de rutas las gestiona Hono
  // Convertimos IncomingMessage → Request estándar web para Hono
  const honoRes = await hono.fetch(
    new Request(`http://localhost${url}`, { method: req.method }),
  );

  res.writeHead(honoRes.status, Object.fromEntries(honoRes.headers));
  res.end(await honoRes.text());
});

// ─────────────────────────────────────────────
// ARRANQUE
// ─────────────────────────────────────────────

server.listen(PORT, () => {
  console.error(`[notes-mcp] Servidor HTTP escuchando en puerto ${PORT}`);
  console.error(`[notes-mcp] Endpoint MCP:    http://localhost:${PORT}/mcp`);
  console.error(`[notes-mcp] Health check:    http://localhost:${PORT}/health`);
});
