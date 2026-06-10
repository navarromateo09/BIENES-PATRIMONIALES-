-- =============================================================================
-- TABLA: Guardia - Provision (enlace dependencia ↔ producto con fecha)
-- =============================================================================
-- Ejecutar en Supabase: SQL Editor → New query → Pegar y Run
-- Registra qué producto se asignó/proveyó a qué dependencia y cuándo.
-- =============================================================================

CREATE TABLE IF NOT EXISTS guardia_provision (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  dependencia_id TEXT NOT NULL REFERENCES dependencias(id) ON DELETE CASCADE,
  producto_id TEXT NOT NULL REFERENCES productos(id) ON DELETE CASCADE,
  movimiento_id TEXT,
  fecha_asignacion TIMESTAMPTZ NOT NULL DEFAULT now(),
  cantidad INTEGER DEFAULT 1,
  concepto TEXT,
  usuario TEXT
);

-- Si la tabla ya existía sin movimiento_id, ejecuta:
-- ALTER TABLE guardia_provision ADD COLUMN IF NOT EXISTS movimiento_id TEXT;

CREATE INDEX IF NOT EXISTS idx_guardia_provision_dependencia ON guardia_provision(dependencia_id);
CREATE INDEX IF NOT EXISTS idx_guardia_provision_producto ON guardia_provision(producto_id);
CREATE INDEX IF NOT EXISTS idx_guardia_provision_fecha ON guardia_provision(fecha_asignacion);

ALTER TABLE guardia_provision ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all for anon" ON guardia_provision;
CREATE POLICY "Allow all for anon" ON guardia_provision FOR ALL USING (true) WITH CHECK (true);

-- Si la tabla existía sin usuario, agregamos la columna.
ALTER TABLE guardia_provision ADD COLUMN IF NOT EXISTS usuario TEXT;

-- =============================================================================
-- FIN
-- =============================================================================
