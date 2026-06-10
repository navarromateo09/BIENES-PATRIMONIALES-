-- Tabla para TXT finalizados (historial "Realizados" en la pestaña TXT)
-- Ejecutar en Supabase: SQL Editor → New query → Pegar → Run

CREATE TABLE IF NOT EXISTS public.txt_realizados (
  id TEXT PRIMARY KEY,
  nombre TEXT DEFAULT '',
  registros_json JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_txt_realizados_updated_at
  ON public.txt_realizados (updated_at DESC);

ALTER TABLE public.txt_realizados ENABLE ROW LEVEL SECURITY;

GRANT ALL ON TABLE public.txt_realizados TO anon, authenticated, service_role;

DROP POLICY IF EXISTS "Allow all for anon" ON public.txt_realizados;
DROP POLICY IF EXISTS "txt_realizados_anon_all" ON public.txt_realizados;
DROP POLICY IF EXISTS "txt_realizados_authenticated_all" ON public.txt_realizados;

CREATE POLICY "txt_realizados_anon_all" ON public.txt_realizados
  FOR ALL TO anon USING (true) WITH CHECK (true);

CREATE POLICY "txt_realizados_authenticated_all" ON public.txt_realizados
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

COMMENT ON TABLE public.txt_realizados IS
  'TXT exportados al pulsar Finalizado (registros en JSON).';
