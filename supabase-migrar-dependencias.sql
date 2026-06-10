-- Migración: agregar columnas codigo, parent_id y numero a dependencias
-- Ejecutar en Supabase: SQL Editor → New query → Pegar y Run
-- Esto corrige el error: Could not find the 'codigo' column of 'dependencias' in the schema cache

ALTER TABLE dependencias ADD COLUMN IF NOT EXISTS codigo TEXT DEFAULT '';
ALTER TABLE dependencias ADD COLUMN IF NOT EXISTS parent_id TEXT REFERENCES dependencias(id) ON DELETE CASCADE;
ALTER TABLE dependencias ADD COLUMN IF NOT EXISTS numero TEXT;
