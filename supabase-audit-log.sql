-- Tabla de auditoría: registra todas las acciones del sistema
CREATE TABLE IF NOT EXISTS audit_log (
  id TEXT PRIMARY KEY,
  fecha TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  usuario TEXT NOT NULL DEFAULT 'sistema',
  accion TEXT NOT NULL,
  modulo TEXT NOT NULL,
  detalle TEXT,
  entidad_id TEXT
);

CREATE INDEX IF NOT EXISTS idx_audit_log_fecha ON audit_log (fecha DESC);
CREATE INDEX IF NOT EXISTS idx_audit_log_usuario ON audit_log (usuario);
CREATE INDEX IF NOT EXISTS idx_audit_log_modulo ON audit_log (modulo);
CREATE INDEX IF NOT EXISTS idx_audit_log_accion ON audit_log (accion);

-- Permitir acceso desde el cliente anon (ajustar según políticas)
ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "audit_log_select" ON audit_log FOR SELECT USING (true);
CREATE POLICY "audit_log_insert" ON audit_log FOR INSERT WITH CHECK (true);
