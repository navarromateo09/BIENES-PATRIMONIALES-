-- =====================================================
-- Habilitar Supabase Realtime en las tablas del sistema
-- Ejecutar este SQL en el SQL Editor de Supabase
-- =====================================================

-- Agregar las tablas a la publicación de Realtime
-- (Supabase usa una publicación llamada 'supabase_realtime')
ALTER PUBLICATION supabase_realtime ADD TABLE productos;
ALTER PUBLICATION supabase_realtime ADD TABLE movimientos;
ALTER PUBLICATION supabase_realtime ADD TABLE dependencias;
ALTER PUBLICATION supabase_realtime ADD TABLE txt_dependencias;
ALTER PUBLICATION supabase_realtime ADD TABLE guardia_provision;
ALTER PUBLICATION supabase_realtime ADD TABLE actas;
ALTER PUBLICATION supabase_realtime ADD TABLE matafuegos;
ALTER PUBLICATION supabase_realtime ADD TABLE audit_log;
