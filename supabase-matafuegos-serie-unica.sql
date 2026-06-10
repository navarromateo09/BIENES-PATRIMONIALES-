-- Índice único en número de serie (matafuegos)
-- Ejecutar en Supabase SQL Editor DESPUÉS de resolver duplicados:
--   node scripts/listar-matafuegos-duplicados.js
-- Si el índice falla por filas repetidas, eliminá o corregí los duplicados y volvé a ejecutar.

-- Vista de control (opcional)
-- SELECT numero_serie, count(*) FROM matafuegos
-- WHERE trim(coalesce(numero_serie, '')) <> ''
-- GROUP BY lower(trim(numero_serie)) HAVING count(*) > 1;

CREATE UNIQUE INDEX IF NOT EXISTS idx_matafuegos_numero_serie_unique
  ON public.matafuegos (numero_serie)
  WHERE char_length(trim(coalesce(numero_serie, ''))) > 0;

COMMENT ON INDEX idx_matafuegos_numero_serie_unique IS
  'Evita altas con el mismo Nº de serie (la app también valida en save-matafuego).';
