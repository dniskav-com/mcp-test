# notes-mcp — instrucciones para agentes

> Este archivo complementa a `CLAUDE.md` (referencia completa de despliegue
> y Caddy). OpenCode lee AGENTS.md; Claude Code lee CLAUDE.md.

## Resumen operativo

- Servidor MCP de notas: `create_note`, `list_notes`, `get_note`, `delete_note`.
- Dos modos: stdio (`npm start`, Claude Code local) y HTTP (`npm run start:http`,
  Docker en el VPS, puerto host **3001** → contenedor 3000).
- Caddy proxya `mcp-notes.dniskav.com` → host 3001. Health: `/health`.

## Seguridad (2026-09-20 — NO revertir)

- **API key obligatoria**: `.env` define `API_KEY`; toda request a `/mcp` debe
  llevar header `x-api-key` o recibe 401 (`src/http.ts`).
- **JSON malformado → 400**: el parseo del body en `http.ts` tiene try/catch
  (commit `a299149`). Sin él, un body inválido tumba el proceso (unhandled
  rejection). No quitarlo.
- **Firewall**: Docker publica el host 3001 y se salta UFW; la chain
  `DOCKER-USER` de iptables lo bloquea desde internet
  (`ctorigdstport 3001 → DROP`). Solo Caddy (red Docker 172.16.0.0/12)
  llega al puerto. Si se cambia el puerto host, actualizar esa regla.
- **`data/` NO se trackea** (commit `2a11900`): el repo GitHub es público
  y `data/notes.json` contiene notas personales. El archivo vive solo en el
  VPS, montado como volumen Docker (`./data:/app/data`).

## Deploy

- Pipeline GitHub Actions en push a `main`: build → GHCR → deploy al VPS.
- Local en el VPS: `git pull && npm run build && docker-compose up -d --build`.
- Verificar: `curl http://localhost:3001/health` y
  `curl -s -X POST https://mcp-notes.dniskav.com/mcp -H "x-api-key: $KEY" ...`
  debe responder del SDK (no 401).

## Registro de cambios de seguridad

- `b67a640` — API key authentication en HTTP server
- `a299149` — fix: JSON malformado responde 400 en vez de tumbar el proceso
- `2a11900` — dejar de trackear `data/notes.json` (repo público)
