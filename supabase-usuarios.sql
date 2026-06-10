-- Ejecutar en Supabase: SQL Editor → New query → Pegar y Run
-- Crea la tabla usuarios y un usuario admin listo para usar.

-- Extensión para hashear la contraseña igual que la app (SHA256 en hex)
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Tabla usuarios
CREATE TABLE IF NOT EXISTS usuarios (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  username TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  rol TEXT NOT NULL DEFAULT 'usuario' CHECK (rol IN ('admin', 'usuario', 'oficina', 'pendiente')),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Índice para login por usuario
CREATE INDEX IF NOT EXISTS idx_usuarios_username ON usuarios(username);

-- Usuario admin por defecto (contraseña: admin123)
-- Hash generado con Node: crypto.createHash('sha256').update('admin123','utf8').digest('hex')
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

-- RLS (si la política ya existe, la borramos y la volvemos a crear)
ALTER TABLE usuarios ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all for anon" ON usuarios;
CREATE POLICY "Allow all for anon" ON usuarios FOR ALL USING (true) WITH CHECK (true);

-- Si la tabla usuarios ya existía con otro check de rol, ejecutar para permitir
-- admin/usuario/oficina/pendiente:
-- ALTER TABLE usuarios DROP CONSTRAINT IF EXISTS usuarios_rol_check;
-- ALTER TABLE usuarios ADD CONSTRAINT usuarios_rol_check CHECK (rol IN ('admin', 'usuario', 'oficina', 'pendiente'));
