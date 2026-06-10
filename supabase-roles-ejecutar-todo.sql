-- =============================================================================
-- PEGAR TODO ESTE ARCHIVO EN SUPABASE: SQL Editor → New query → Pegar → Run
-- =============================================================================
-- Configura la tabla usuarios con roles: admin, usuario, oficina, pendiente
-- Sirve para instalación nueva o para actualizar una base que ya tenés.
-- =============================================================================

-- Extensión para UUID y funciones
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Tabla usuarios (si no existe). Si ya existe, no la borra.
CREATE TABLE IF NOT EXISTS usuarios (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  username TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  rol TEXT NOT NULL DEFAULT 'usuario' CHECK (rol IN ('admin', 'usuario', 'oficina', 'pendiente')),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Índice para login
CREATE INDEX IF NOT EXISTS idx_usuarios_username ON usuarios(username);

-- Permitir roles admin/usuario/oficina/pendiente (si la tabla ya existía)
ALTER TABLE usuarios DROP CONSTRAINT IF EXISTS usuarios_rol_check;
ALTER TABLE usuarios ADD CONSTRAINT usuarios_rol_check CHECK (rol IN ('admin', 'usuario', 'oficina', 'pendiente'));

-- Usuario admin por defecto (contraseña: admin123)
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

-- Seguridad (RLS)
ALTER TABLE usuarios ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all for anon" ON usuarios;
CREATE POLICY "Allow all for anon" ON usuarios FOR ALL USING (true) WITH CHECK (true);

-- =============================================================================
-- FIN. Después de ejecutar, ya podés usar los roles admin, usuario, oficina y pendiente.
-- =============================================================================
