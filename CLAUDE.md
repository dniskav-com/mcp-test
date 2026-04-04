# Notes MCP Server

Servidor MCP de notas personales. Expone 4 tools a Claude: `create_note`, `list_notes`, `get_note`, `delete_note`.

## Dos modos de ejecución

| Modo | Comando | Cuándo usarlo |
|------|---------|---------------|
| **stdio** | `npm start` | Claude Code local (Mac) |
| **HTTP** | `npm run start:http` | VPS / Docker / acceso remoto |

## Estructura

```
src/
  index.ts        → entrada stdio (Claude Code local)
  http.ts         → entrada HTTP (VPS/Docker)
  tools/notes.ts  → las 4 tools MCP
  storage/json.ts → lectura/escritura de notas en JSON
data/
  notes.json      → aquí se guardan las notas (persistente)
```

## Comandos frecuentes

```bash
npm run build          # compila TypeScript → dist/
npm start              # arranca en modo stdio
npm run start:http     # arranca en modo HTTP (puerto 3000)
docker compose up -d   # arranca en Docker (producción)
docker compose logs -f # ver logs en tiempo real
docker compose restart # reiniciar tras un cambio
```

## Despliegue en este VPS

El servidor corre como contenedor Docker en el puerto 3000.
Caddy hace de reverse proxy con HTTPS automático.

### Arrancar por primera vez

```bash
git pull
npm run build
docker compose up -d --build
```

### Actualizar tras cambios en el código

```bash
git pull
npm run build
docker compose up -d --build
```

### Ver estado

```bash
docker compose ps
curl http://localhost:3000/health
```

## Caddy config

Añadir a `/etc/caddy/Caddyfile`:

```caddy
mcp.dniskav.com {
    reverse_proxy localhost:3001
}

# Nota: el puerto 3000 está reservado para dniskav.com (web)
# El MCP usa el 3001 en el host, mapeado al 3000 interno del contenedor
```

Reiniciar Caddy tras el cambio:
```bash
systemctl reload caddy
```

## Pipeline de deploy (GitHub Actions)

El pipeline se ejecuta automáticamente en cada push a `main`.
Construye la imagen Docker, la publica en GHCR, y despliega en el VPS.

**Secrets necesarios en GitHub** (Settings → Secrets → Actions):

| Secret | Valor |
|--------|-------|
| `VPS_HOST` | IP del VPS Hetzner |
| `VPS_USER` | usuario SSH (ej: `daniel`) |
| `VPS_SSH_KEY` | contenido de `~/.ssh/id_rsa` (clave privada) |
| `VPS_PATH` | ruta al repo en el VPS (ej: `/home/daniel/notes-mcp`) |

**Primera vez en el VPS** (solo una vez):
```bash
git clone https://github.com/dniskav/mcp-test.git notes-mcp
cd notes-mcp
# A partir de aquí el pipeline se encarga de todo
```

## Conectar Claude Code (en este VPS) al MCP

```bash
claude mcp add notes-http http://localhost:3000/mcp --scope user
```

Esto conecta Claude Code del VPS directamente al servidor HTTP local,
sin pasar por internet.

## Conectar Claude desde fuera (Mac, móvil)

Una vez desplegado con Caddy, registrar en el Mac:

```bash
claude mcp add notes-remote https://mcp.dniskav.com/mcp --transport http --scope user
```

## Notas importantes

- Las notas se guardan en `data/notes.json` — está montado como volumen Docker, persiste entre reinicios y actualizaciones del contenedor.
- El servidor corre en modo **stateless**: cada llamada MCP es independiente, no hay sesiones.
- `console.error` se usa para logs (no `console.log`) porque en modo stdio el stdout está reservado para el protocolo MCP.
