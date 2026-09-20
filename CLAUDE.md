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

El servidor corre como contenedor Docker: puerto **3001 en el host** → 3000 en el
contenedor. Caddy hace de reverse proxy con HTTPS automático en
`mcp-notes.dniskav.com`.

### Seguridad (2026-09-20)

- **Autenticación**: `API_KEY` en `.env` (no commitear). Toda request a `/mcp`
  debe llevar el header `x-api-key`; sin él responde 401. Al registrar el MCP
  desde fuera hay que incluir el header en la config del cliente.
- **JSON malformado** en `/mcp` responde 400 (no tumba el proceso) — fix en
  `http.ts` (`a299149`). No quitar el try/catch del parseo del body.
- **Firewall**: UFW deniega por defecto, pero Docker publica `3001` y salta las
  reglas de UFW; la chain `DOCKER-USER` de iptables bloquea el 3001 desde
  internet (`ctorigdstport 3001 → DROP`). Solo Caddy (desde la red Docker
  172.16.0.0/12) llega al puerto. Si se cambia el puerto host, actualizar esa
  regla.

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
curl http://localhost:3001/health
```

## Caddy config

Caddy corre como contenedor Docker gestionado con docker-compose en `/root/var/www/dniskav/`:

```
/root/var/www/dniskav/
  Caddyfile         → config de Caddy (dominios y proxies)
  Dockerfile        → imagen con plugin cloudflare-dns
  docker-compose.yml → gestión del contenedor
  .env              → CLOUDFLARE_API_TOKEN (no commitear)
```

El dominio del MCP está definido en el Caddyfile:

```caddy
mcp-notes.dniskav.com {
    reverse_proxy host.docker.internal:3001
}
```

### Gestión de Caddy

```bash
cd /root/var/www/dniskav

# Recargar config tras cambiar el Caddyfile (sin downtime):
docker-compose exec caddy caddy reload --config /etc/caddy/Caddyfile --adapter caddyfile

# Recrear el contenedor (tras cambios en Dockerfile):
docker-compose up -d --build

# Ver logs:
docker-compose logs -f
```

> **Importante:** Si editas el Caddyfile y haces `caddy reload` pero no funciona,
> puede que el bind mount tenga un inode obsoleto (ocurre cuando `git` reemplaza
> el archivo). En ese caso, recrea el contenedor:
> ```bash
> docker-compose up -d --force-recreate
> ```

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
claude mcp add notes-http http://localhost:3001/mcp --scope user
```

Esto conecta Claude Code del VPS directamente al servidor HTTP local,
sin pasar por internet.

## Conectar Claude desde fuera (Mac, móvil)

Una vez desplegado con Caddy, registrar en el Mac:

```bash
claude mcp add notes-remote https://mcp-notes.dniskav.com/mcp --transport http --scope user
```

## Notas importantes

- Las notas se guardan en `data/notes.json` — está montado como volumen Docker, persiste entre reinicios y actualizaciones del contenedor.
- El servidor corre en modo **stateless**: cada llamada MCP es independiente, no hay sesiones.
- `console.error` se usa para logs (no `console.log`) porque en modo stdio el stdout está reservado para el protocolo MCP.
