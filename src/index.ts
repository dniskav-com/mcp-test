/**
 * PUNTO DE ENTRADA — index.ts
 *
 * Este es el archivo principal del servidor MCP. Es lo primero que se ejecuta
 * cuando Claude (u otro cliente MCP) arranca nuestro servidor.
 *
 * ¿Qué es MCP?
 * Model Context Protocol es un protocolo estándar creado por Anthropic que
 * permite conectar modelos de lenguaje (como Claude) con herramientas externas.
 * El modelo envía mensajes JSON al servidor, y el servidor responde con resultados.
 *
 * ¿Cómo funciona la comunicación?
 * Usamos el transporte "stdio" (standard input/output): Claude escribe en stdin
 * de nuestro proceso y nosotros respondemos por stdout. Es simple y funciona
 * sin necesidad de levantar un servidor HTTP.
 *
 * Flujo:
 *   Claude → (stdin) → Nuestro servidor → ejecuta la tool → (stdout) → Claude
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { registerNoteTools } from "./tools/notes.js";

// ─────────────────────────────────────────────
// 1. CREAR EL SERVIDOR
// ─────────────────────────────────────────────

/**
 * McpServer es la clase principal del SDK.
 * Le damos un nombre y una versión — esto se envía al cliente durante
 * el "handshake" inicial para que sepa con qué servidor está hablando.
 */
const server = new McpServer({
  name: "notes-mcp",
  version: "1.0.0",
});

// ─────────────────────────────────────────────
// 2. REGISTRAR HERRAMIENTAS
// ─────────────────────────────────────────────

/**
 * Aquí conectamos las tools definidas en tools/notes.ts con el servidor.
 * Separamos el registro en su propio módulo para mantener index.ts limpio.
 * Cuando agreguemos más herramientas (búsqueda, tags, etc.), solo habrá que
 * añadir una línea aquí.
 */
registerNoteTools(server);

// ─────────────────────────────────────────────
// 3. ARRANCAR EL SERVIDOR
// ─────────────────────────────────────────────

/**
 * Función principal — la marcamos como async porque conectar el transporte
 * es una operación asíncrona.
 *
 * Por convención en Node.js, envolvemos el código de arranque en una función
 * async para poder usar await y manejar errores con try/catch.
 */
async function main() {
  // StdioServerTransport conecta el servidor con stdin/stdout del proceso
  const transport = new StdioServerTransport();

  // connect() hace el handshake inicial con el cliente y empieza a escuchar mensajes
  await server.connect(transport);

  // IMPORTANTE: No usamos console.log aquí porque stdout está reservado
  // para la comunicación MCP. Usamos stderr para logs de diagnóstico.
  console.error("[notes-mcp] Servidor arrancado y escuchando...");
}

// Ejecutamos main() y si hay algún error lo mostramos y salimos con código 1
// (código 1 = error, código 0 = éxito — convención Unix)
main().catch((error) => {
  console.error("[notes-mcp] Error fatal al arrancar:", error);
  process.exit(1);
});
