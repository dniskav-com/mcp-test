/**
 * HERRAMIENTAS MCP — tools/notes.ts
 *
 * Aquí definimos las 4 "tools" que exponemos al modelo de lenguaje (Claude).
 * Una tool MCP es como una función que Claude puede llamar cuando lo necesite.
 *
 * Cada tool tiene 3 partes:
 *   1. Nombre           → cómo la llama Claude internamente
 *   2. Schema (Zod)     → qué parámetros acepta y de qué tipo
 *   3. Handler          → qué hace cuando Claude la invoca
 *
 * Usamos Zod para validar los inputs. Si Claude manda un parámetro del tipo
 * incorrecto, Zod lanza un error antes de que lleguemos a nuestra lógica.
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import {
  getAllNotes,
  getNoteById,
  createNote,
  deleteNote,
} from "../storage/json.js";

/**
 * Registra todas las tools de notas en el servidor MCP.
 *
 * Recibe el servidor como parámetro para que index.ts
 * sea quien cree y controle el ciclo de vida del servidor.
 */
export function registerNoteTools(server: McpServer): void {
  // ───────────────────────────────────────────
  // TOOL 1: create_note
  // ───────────────────────────────────────────

  server.tool(
    // Nombre de la tool — debe ser único y descriptivo en snake_case
    "create_note",

    // Descripción — Claude lee esto para saber cuándo usar esta tool
    "Crea una nueva nota personal con un título y contenido. Úsala cuando el usuario quiera guardar información, ideas, recordatorios o cualquier texto para más adelante.",

    // Schema con Zod — define los parámetros que acepta esta tool
    {
      title: z.string().min(1).describe("Título corto de la nota"),
      content: z.string().min(1).describe("Contenido completo de la nota"),
    },

    // Handler — función async que se ejecuta cuando Claude llama esta tool
    async ({ title, content }) => {
      const note = createNote(title, content);

      // Las tools deben devolver siempre un objeto { content: [...] }
      // El tipo "text" es el más común — devuelve texto plano
      return {
        content: [
          {
            type: "text",
            text: `Nota creada correctamente.\nID: ${note.id}\nTítulo: "${note.title}"\nFecha: ${note.createdAt}`,
          },
        ],
      };
    }
  );

  // ───────────────────────────────────────────
  // TOOL 2: list_notes
  // ───────────────────────────────────────────

  server.tool(
    "list_notes",
    "Devuelve la lista de todas las notas guardadas. Úsala cuando el usuario quiera ver qué notas tiene o buscar algo.",

    // Esta tool no necesita parámetros — pasamos un objeto vacío
    {},

    async () => {
      const notes = getAllNotes();

      if (notes.length === 0) {
        return {
          content: [{ type: "text", text: "No hay notas guardadas todavía." }],
        };
      }

      // Formateamos las notas como una lista legible
      const list = notes
        .map(
          (note, index) =>
            `${index + 1}. [ID: ${note.id}] "${note.title}" — ${note.createdAt}`
        )
        .join("\n");

      return {
        content: [
          {
            type: "text",
            text: `Tienes ${notes.length} nota(s):\n\n${list}`,
          },
        ],
      };
    }
  );

  // ───────────────────────────────────────────
  // TOOL 3: get_note
  // ───────────────────────────────────────────

  server.tool(
    "get_note",
    "Obtiene el contenido completo de una nota específica a partir de su ID.",

    {
      id: z.string().min(1).describe("ID de la nota que quieres leer"),
    },

    async ({ id }) => {
      const note = getNoteById(id);

      if (!note) {
        return {
          content: [
            {
              type: "text",
              // isError marca esta respuesta como un error para el modelo
              text: `No se encontró ninguna nota con el ID: ${id}`,
            },
          ],
          // isError: true le indica a Claude que algo salió mal
          isError: true,
        };
      }

      return {
        content: [
          {
            type: "text",
            text: `Título: ${note.title}\nFecha: ${note.createdAt}\n\n${note.content}`,
          },
        ],
      };
    }
  );

  // ───────────────────────────────────────────
  // TOOL 4: delete_note
  // ───────────────────────────────────────────

  server.tool(
    "delete_note",
    "Elimina permanentemente una nota por su ID. Esta acción no se puede deshacer.",

    {
      id: z.string().min(1).describe("ID de la nota que quieres eliminar"),
    },

    async ({ id }) => {
      const deleted = deleteNote(id);

      if (!deleted) {
        return {
          content: [
            {
              type: "text",
              text: `No se encontró ninguna nota con el ID: ${id}`,
            },
          ],
          isError: true,
        };
      }

      return {
        content: [
          {
            type: "text",
            text: `Nota con ID ${id} eliminada correctamente.`,
          },
        ],
      };
    }
  );
}
