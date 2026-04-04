/**
 * CAPA DE PERSISTENCIA — storage/json.ts
 *
 * Este módulo es responsable de leer y escribir las notas en un archivo JSON.
 * Lo separamos del resto de la lógica para que en el futuro sea fácil
 * cambiar el storage (por ejemplo, migrar a SQLite o una API) sin tocar nada más.
 *
 * Patrón: Repository / Data Access Layer
 */

import fs from "fs";
import path from "path";

// ─────────────────────────────────────────────
// TIPOS
// ─────────────────────────────────────────────

/**
 * Estructura de una nota.
 * Todos los campos son obligatorios.
 */
export interface Note {
  /** Identificador único, generado automáticamente (timestamp en ms) */
  id: string;
  /** Título corto de la nota */
  title: string;
  /** Contenido completo de la nota */
  content: string;
  /** Fecha de creación en formato ISO 8601, ej: "2024-01-15T10:30:00.000Z" */
  createdAt: string;
}

// ─────────────────────────────────────────────
// CONFIGURACIÓN
// ─────────────────────────────────────────────

/**
 * Ruta absoluta al archivo JSON donde se guardan las notas.
 * __dirname apunta al directorio de este archivo (src/storage/)
 * Subimos dos niveles para llegar a la raíz del proyecto y entrar a data/
 */
const DATA_FILE = path.join(__dirname, "../../data/notes.json");

// ─────────────────────────────────────────────
// FUNCIONES INTERNAS (solo para este módulo)
// ─────────────────────────────────────────────

/**
 * Lee todas las notas del archivo JSON.
 * Si el archivo no existe o está vacío, devuelve un array vacío.
 */
function readAll(): Note[] {
  // Si el archivo no existe todavía, lo creamos vacío
  if (!fs.existsSync(DATA_FILE)) {
    fs.writeFileSync(DATA_FILE, "[]", "utf-8");
    return [];
  }

  const raw = fs.readFileSync(DATA_FILE, "utf-8");

  // Si el archivo está vacío o solo tiene espacios, devolvemos array vacío
  if (!raw.trim()) return [];

  // JSON.parse convierte el texto JSON en un array de objetos JavaScript
  return JSON.parse(raw) as Note[];
}

/**
 * Escribe el array completo de notas en el archivo JSON.
 * El segundo argumento de JSON.stringify (null, 2) formatea el JSON
 * con indentación de 2 espacios para que sea legible si lo abres.
 */
function writeAll(notes: Note[]): void {
  fs.writeFileSync(DATA_FILE, JSON.stringify(notes, null, 2), "utf-8");
}

// ─────────────────────────────────────────────
// API PÚBLICA
// ─────────────────────────────────────────────

/**
 * Devuelve todas las notas guardadas.
 */
export function getAllNotes(): Note[] {
  return readAll();
}

/**
 * Busca una nota por su ID.
 * Devuelve undefined si no se encuentra.
 */
export function getNoteById(id: string): Note | undefined {
  return readAll().find((note) => note.id === id);
}

/**
 * Crea una nueva nota y la guarda en el archivo.
 * Genera el ID y la fecha automáticamente.
 *
 * @returns La nota recién creada (con id y createdAt ya asignados)
 */
export function createNote(title: string, content: string): Note {
  const notes = readAll();

  const newNote: Note = {
    // Usamos Date.now() como ID: es un número único basado en el tiempo actual (ms desde 1970)
    id: Date.now().toString(),
    title,
    content,
    createdAt: new Date().toISOString(),
  };

  notes.push(newNote);
  writeAll(notes);

  return newNote;
}

/**
 * Elimina una nota por su ID.
 *
 * @returns true si se encontró y borró, false si no existía
 */
export function deleteNote(id: string): boolean {
  const notes = readAll();

  // filter devuelve un nuevo array SIN la nota que queremos borrar
  const filtered = notes.filter((note) => note.id !== id);

  // Si la longitud es igual, significa que no encontramos ninguna nota con ese ID
  if (filtered.length === notes.length) return false;

  writeAll(filtered);
  return true;
}
