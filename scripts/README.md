# Scripts de mantenimiento

Herramientas Node para tareas puntuales sobre la base (Supabase o copia local en `%APPDATA%\control-stock-empresa\`). Requieren `.env` con `SUPABASE_URL` y `SUPABASE_SERVICE_KEY` (o anon key según el script) en la raíz del proyecto, salvo que indiquen lo contrario.

## Matafuegos

| Script | Uso |
|--------|-----|
| `listar-matafuegos-duplicados.js` | `node scripts/listar-matafuegos-duplicados.js` — detecta series repetidas; escribe `reporte-matafuegos-duplicados.txt`. |
| `unificar-dependencia-privada.js` | Unifica registros de dependencia PRIVADA duplicados (ver comentarios en el archivo). |

## Depósito / inventario

| Script | Uso |
|--------|-----|
| `migrar-expediente-deposito.js` | Migra un expediente tipo DEPOSITO al inventario de depósito. |
| `sync-deposito-local-a-supabase.js` | Sincroniza datos locales de depósito hacia Supabase. |

## SQL relacionado (raíz del proyecto)

- `supabase-matafuegos-serie-unica.sql` — índice único en `numero_serie` (ejecutar cuando no haya duplicados).
- `supabase-txt-realizados.sql` — tabla `txt_realizados` para el botón **Finalizado** en TXT (historial Realizados).

## Notas

- Hacé respaldo o probá en copia antes de scripts que modifican datos.
- Tras limpiar duplicados de serie, ejecutá el SQL de índice único en Supabase.
