-- Inventario de DEPÓSITO (independiente del inventario principal)
-- Ejecutar en Supabase: SQL Editor → New query → Pegar y Run

CREATE TABLE IF NOT EXISTS deposito_movimientos (
  id TEXT PRIMARY KEY,
  tipo TEXT NOT NULL CHECK (tipo IN ('entrada', 'salida')),
  expediente TEXT NOT NULL DEFAULT 'DEPOSITO',
  cantidad INTEGER NOT NULL DEFAULT 1,
  fecha TIMESTAMPTZ NOT NULL DEFAULT now(),
  numero_serie TEXT,
  nombre TEXT,
  marca TEXT,
  concepto TEXT,
  entrada_id TEXT REFERENCES deposito_movimientos(id) ON DELETE SET NULL,
  usuario TEXT
);

CREATE INDEX IF NOT EXISTS idx_deposito_mov_tipo ON deposito_movimientos(tipo);
CREATE INDEX IF NOT EXISTS idx_deposito_mov_fecha ON deposito_movimientos(fecha);
CREATE INDEX IF NOT EXISTS idx_deposito_mov_entrada_id ON deposito_movimientos(entrada_id);

ALTER TABLE deposito_movimientos ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all for anon deposito_mov" ON deposito_movimientos;
CREATE POLICY "Allow all for anon deposito_mov" ON deposito_movimientos FOR ALL USING (true) WITH CHECK (true);
