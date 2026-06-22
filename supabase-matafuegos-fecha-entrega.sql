-- Fecha en que se registró la entrega a una dependencia (visible en pestaña Entregados).
-- Ejecutar una vez en Supabase → SQL Editor.

ALTER TABLE matafuegos ADD COLUMN IF NOT EXISTS fecha_entrega DATE;

COMMENT ON COLUMN matafuegos.fecha_entrega IS 'Fecha de entrega a dependencia (estado entregado en la app)';
