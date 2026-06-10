-- Ejecutar en Supabase: SQL Editor → New query → Pegar y Run

-- Tabla productos (expedientes e ítems con stock)
CREATE TABLE IF NOT EXISTS productos (
  id TEXT PRIMARY KEY,
  codigo TEXT,
  nombre TEXT,
  descripcion TEXT,
  numero_serie TEXT,
  stock_actual INTEGER DEFAULT 0,
  unidad TEXT DEFAULT 'unidades',
  marca TEXT
);

-- Si la tabla productos ya existía sin marca, ejecutar:
-- ALTER TABLE productos ADD COLUMN IF NOT EXISTS marca TEXT;

-- Tabla movimientos (entradas y salidas)
CREATE TABLE IF NOT EXISTS movimientos (
  id TEXT PRIMARY KEY,
  tipo TEXT NOT NULL CHECK (tipo IN ('entrada', 'salida')),
  producto_id TEXT REFERENCES productos(id) ON DELETE SET NULL,
  cantidad INTEGER NOT NULL,
  fecha TIMESTAMPTZ NOT NULL DEFAULT now(),
  numero_serie TEXT,
  nombre TEXT,
  marca TEXT,
  concepto TEXT,
  destino TEXT,
  usuario TEXT
);

-- Si la tabla movimientos ya existía, agregamos la columna para el historial
ALTER TABLE movimientos ADD COLUMN IF NOT EXISTS usuario TEXT;

-- Tabla dependencias (destinos para salidas, con código y divisiones)
CREATE TABLE IF NOT EXISTS dependencias (
  id TEXT PRIMARY KEY,
  nombre TEXT,
  codigo TEXT DEFAULT '',
  parent_id TEXT REFERENCES dependencias(id) ON DELETE CASCADE,
  numero TEXT
);

-- Tabla txt_dependencias (EXCLUSIVA de la pestaña TXT)
-- Misma estructura que dependencias, pero separada para no mezclar datos.
CREATE TABLE IF NOT EXISTS txt_dependencias (
  id TEXT PRIMARY KEY,
  nombre TEXT,
  codigo TEXT DEFAULT '',
  parent_id TEXT REFERENCES txt_dependencias(id) ON DELETE CASCADE,
  numero TEXT
);

-- Si dependencias ya existía solo con (id, nombre), ejecutar esta migración:
-- ALTER TABLE dependencias ADD COLUMN IF NOT EXISTS codigo TEXT DEFAULT '';
-- ALTER TABLE dependencias ADD COLUMN IF NOT EXISTS parent_id TEXT REFERENCES dependencias(id) ON DELETE CASCADE;
-- ALTER TABLE dependencias ADD COLUMN IF NOT EXISTS numero TEXT;

-- Índices para consultas frecuentes
CREATE INDEX IF NOT EXISTS idx_movimientos_tipo ON movimientos(tipo);
CREATE INDEX IF NOT EXISTS idx_movimientos_producto_id ON movimientos(producto_id);
CREATE INDEX IF NOT EXISTS idx_movimientos_fecha ON movimientos(fecha);

-- Permitir acceso con la clave anon (RLS opcional: para app de escritorio podemos permitir todo)
ALTER TABLE productos ENABLE ROW LEVEL SECURITY;
ALTER TABLE movimientos ENABLE ROW LEVEL SECURITY;
ALTER TABLE dependencias ENABLE ROW LEVEL SECURITY;
ALTER TABLE txt_dependencias ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all for anon" ON productos FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for anon" ON movimientos FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for anon" ON dependencias FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for anon" ON txt_dependencias FOR ALL USING (true) WITH CHECK (true);
