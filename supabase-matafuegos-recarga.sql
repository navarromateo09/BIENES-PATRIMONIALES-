-- Agregar columnas para matafuegos en recarga (fecha de ingreso, dependencia)
-- Ejecutar en Supabase: SQL Editor → New query → Pegar → Run

ALTER TABLE matafuegos ADD COLUMN IF NOT EXISTS fecha_ingreso DATE;
ALTER TABLE matafuegos ADD COLUMN IF NOT EXISTS dependencia_id TEXT;
