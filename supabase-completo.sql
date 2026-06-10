-- =============================================================================
-- SUPABASE - ESQUEMA COMPLETO PARA CONTROL DE STOCK
-- =============================================================================
-- Ejecutar en Supabase: SQL Editor → New query → Pegar todo → Run
-- Sirve para proyecto nuevo (crea tablas) o existente (añade columnas faltantes).
-- =============================================================================

-- Extensión para funciones extra (ej. gen_random_uuid)
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- -----------------------------------------------------------------------------
-- 1. TABLA USUARIOS (login)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS usuarios (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  username TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  rol TEXT NOT NULL DEFAULT 'usuario' CHECK (rol IN ('admin', 'usuario', 'oficina')),
  created_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_usuarios_username ON usuarios(username);
ALTER TABLE usuarios ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all for anon" ON usuarios;
CREATE POLICY "Allow all for anon" ON usuarios FOR ALL USING (true) WITH CHECK (true);

-- -----------------------------------------------------------------------------
-- 2. TABLA PRODUCTOS (expedientes e ítems con stock)
-- -----------------------------------------------------------------------------
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
ALTER TABLE productos ADD COLUMN IF NOT EXISTS codigo TEXT;
ALTER TABLE productos ADD COLUMN IF NOT EXISTS nombre TEXT;
ALTER TABLE productos ADD COLUMN IF NOT EXISTS descripcion TEXT;
ALTER TABLE productos ADD COLUMN IF NOT EXISTS numero_serie TEXT;
ALTER TABLE productos ADD COLUMN IF NOT EXISTS stock_actual INTEGER DEFAULT 0;
ALTER TABLE productos ADD COLUMN IF NOT EXISTS unidad TEXT DEFAULT 'unidades';
ALTER TABLE productos ADD COLUMN IF NOT EXISTS marca TEXT;
ALTER TABLE productos ADD COLUMN IF NOT EXISTS solicitado_por TEXT;
ALTER TABLE productos ADD COLUMN IF NOT EXISTS anio TEXT;
ALTER TABLE productos ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all for anon" ON productos;
CREATE POLICY "Allow all for anon" ON productos FOR ALL USING (true) WITH CHECK (true);

-- -----------------------------------------------------------------------------
-- 3. TABLA MOVIMIENTOS (entradas y salidas)
-- -----------------------------------------------------------------------------
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
ALTER TABLE movimientos ADD COLUMN IF NOT EXISTS numero_serie TEXT;
ALTER TABLE movimientos ADD COLUMN IF NOT EXISTS nombre TEXT;
ALTER TABLE movimientos ADD COLUMN IF NOT EXISTS marca TEXT;
ALTER TABLE movimientos ADD COLUMN IF NOT EXISTS concepto TEXT;
ALTER TABLE movimientos ADD COLUMN IF NOT EXISTS destino TEXT;
ALTER TABLE movimientos ADD COLUMN IF NOT EXISTS usuario TEXT;
CREATE INDEX IF NOT EXISTS idx_movimientos_tipo ON movimientos(tipo);
CREATE INDEX IF NOT EXISTS idx_movimientos_producto_id ON movimientos(producto_id);
CREATE INDEX IF NOT EXISTS idx_movimientos_fecha ON movimientos(fecha);
ALTER TABLE movimientos ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all for anon" ON movimientos;
CREATE POLICY "Allow all for anon" ON movimientos FOR ALL USING (true) WITH CHECK (true);

-- -----------------------------------------------------------------------------
-- 4. TABLA DEPENDENCIAS (destinos con código y divisiones)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS dependencias (
  id TEXT PRIMARY KEY,
  nombre TEXT,
  codigo TEXT DEFAULT '',
  parent_id TEXT,
  numero TEXT
);
-- Añadir columnas por si la tabla ya existía solo con (id, nombre)
ALTER TABLE dependencias ADD COLUMN IF NOT EXISTS codigo TEXT DEFAULT '';
ALTER TABLE dependencias ADD COLUMN IF NOT EXISTS parent_id TEXT;
ALTER TABLE dependencias ADD COLUMN IF NOT EXISTS numero TEXT;
ALTER TABLE dependencias ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all for anon" ON dependencias;
CREATE POLICY "Allow all for anon" ON dependencias FOR ALL USING (true) WITH CHECK (true);

-- -----------------------------------------------------------------------------
-- 5. TABLA GUARDIA_PROVISION (enlace dependencia ↔ producto con fecha)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS guardia_provision (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  dependencia_id TEXT NOT NULL REFERENCES dependencias(id) ON DELETE CASCADE,
  producto_id TEXT NOT NULL REFERENCES productos(id) ON DELETE CASCADE,
  fecha_asignacion TIMESTAMPTZ NOT NULL DEFAULT now(),
  cantidad INTEGER DEFAULT 1,
  concepto TEXT,
  usuario TEXT
);
CREATE INDEX IF NOT EXISTS idx_guardia_provision_dependencia ON guardia_provision(dependencia_id);
CREATE INDEX IF NOT EXISTS idx_guardia_provision_producto ON guardia_provision(producto_id);
CREATE INDEX IF NOT EXISTS idx_guardia_provision_fecha ON guardia_provision(fecha_asignacion);
ALTER TABLE guardia_provision ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all for anon" ON guardia_provision;
CREATE POLICY "Allow all for anon" ON guardia_provision FOR ALL USING (true) WITH CHECK (true);

-- -----------------------------------------------------------------------------
-- PENDIENTES OFICINA (productos enviados a oficina, entrega pendiente)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS pendientes_oficina (
  movimiento_id TEXT PRIMARY KEY,
  cantidad INTEGER NOT NULL DEFAULT 0 CHECK (cantidad >= 0)
);
ALTER TABLE pendientes_oficina ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all for anon" ON pendientes_oficina;
CREATE POLICY "Allow all for anon" ON pendientes_oficina FOR ALL USING (true) WITH CHECK (true);

-- -----------------------------------------------------------------------------
-- 5b. INVENTARIO DE DEPÓSITO (independiente del inventario principal)
-- -----------------------------------------------------------------------------
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

-- -----------------------------------------------------------------------------
-- 6. TABLA MATAFUEGOS (registro de matafuegos disponibles y para recarga)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS matafuegos (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  marca TEXT,
  numero_serie TEXT NOT NULL,
  caracteristicas TEXT,
  fecha_vencimiento DATE,
  estado TEXT NOT NULL DEFAULT 'disponible' CHECK (estado IN ('disponible', 'recarga')),
  created_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_matafuegos_estado ON matafuegos(estado);
ALTER TABLE matafuegos ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all for anon" ON matafuegos;
CREATE POLICY "Allow all for anon" ON matafuegos FOR ALL USING (true) WITH CHECK (true);

-- -----------------------------------------------------------------------------
-- 7. USUARIO ADMIN POR DEFECTO (opcional)
-- Contraseña: admin123
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS actas (
  id text PRIMARY KEY,
  fecha timestamptz NOT NULL DEFAULT now(),
  dependencia_id text,
  dep_label text NOT NULL DEFAULT '',
  product_label text NOT NULL DEFAULT '',
  expediente text NOT NULL DEFAULT '',
  cantidad integer NOT NULL DEFAULT 1,
  seriales text,
  concepto text,
  provision_id text
);
CREATE INDEX IF NOT EXISTS idx_actas_fecha ON actas (fecha DESC);
ALTER TABLE actas ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all for anon" ON actas;
CREATE POLICY "Allow all for anon" ON actas FOR ALL USING (true) WITH CHECK (true);

CREATE TABLE IF NOT EXISTS actas_adjuntos (
  acta_id text PRIMARY KEY REFERENCES actas(id) ON DELETE CASCADE,
  file_path text NOT NULL,
  original_name text NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE actas_adjuntos ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all for anon" ON actas_adjuntos;
CREATE POLICY "Allow all for anon" ON actas_adjuntos FOR ALL USING (true) WITH CHECK (true);

INSERT INTO storage.buckets (id, name, public)
VALUES ('actas-adjuntos', 'actas-adjuntos', false)
ON CONFLICT (id) DO NOTHING;
DROP POLICY IF EXISTS "Actas adjuntos storage read" ON storage.objects;
CREATE POLICY "Actas adjuntos storage read" ON storage.objects
FOR SELECT TO anon, authenticated USING (bucket_id = 'actas-adjuntos');
DROP POLICY IF EXISTS "Actas adjuntos storage write" ON storage.objects;
CREATE POLICY "Actas adjuntos storage write" ON storage.objects
FOR INSERT TO anon, authenticated WITH CHECK (bucket_id = 'actas-adjuntos');
DROP POLICY IF EXISTS "Actas adjuntos storage update" ON storage.objects;
CREATE POLICY "Actas adjuntos storage update" ON storage.objects
FOR UPDATE TO anon, authenticated USING (bucket_id = 'actas-adjuntos') WITH CHECK (bucket_id = 'actas-adjuntos');
DROP POLICY IF EXISTS "Actas adjuntos storage delete" ON storage.objects;
CREATE POLICY "Actas adjuntos storage delete" ON storage.objects
FOR DELETE TO anon, authenticated USING (bucket_id = 'actas-adjuntos');

INSERT INTO usuarios (id, username, password_hash, rol)
VALUES (
  'admin-1',
  'admin',
  '240be518fabd2724ddb6f04eeb1da5967448d7e831c08c8fa822809f74c720a9',
  'admin'
)
ON CONFLICT (username) DO UPDATE SET
  password_hash = EXCLUDED.password_hash,
  rol = EXCLUDED.rol;

-- =============================================================================
-- FIN - Esquema listo para Control de Stock
-- =============================================================================
