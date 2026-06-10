-- Crear tabla ACTAS en Supabase
-- Ejecutá este script en: Supabase Dashboard → SQL Editor → New query → Pegar y Run

CREATE TABLE IF NOT EXISTS public.actas (
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

-- Índice para listar por fecha (más recientes primero)
CREATE INDEX IF NOT EXISTS idx_actas_fecha ON public.actas (fecha DESC);

-- Permitir que la API de Supabase acceda a la tabla (RLS)
ALTER TABLE public.actas ENABLE ROW LEVEL SECURITY;

-- Política: permitir leer e insertar/actualizar para usuarios autenticados o anon
-- Ajustá según tu configuración de seguridad (anon key vs service role)
CREATE POLICY "Permitir todo en actas para anon"
  ON public.actas
  FOR ALL
  TO anon
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Permitir todo en actas para authenticated"
  ON public.actas
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- -----------------------------------------------------------------------------
-- ADJUNTOS DE ACTAS (compartidos entre todas las PC)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.actas_adjuntos (
  acta_id text PRIMARY KEY REFERENCES public.actas(id) ON DELETE CASCADE,
  file_path text NOT NULL,
  original_name text NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.actas_adjuntos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Permitir todo en actas_adjuntos para anon" ON public.actas_adjuntos;
CREATE POLICY "Permitir todo en actas_adjuntos para anon"
  ON public.actas_adjuntos
  FOR ALL
  TO anon
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS "Permitir todo en actas_adjuntos para authenticated" ON public.actas_adjuntos;
CREATE POLICY "Permitir todo en actas_adjuntos para authenticated"
  ON public.actas_adjuntos
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Bucket de Storage para archivos adjuntos de actas
INSERT INTO storage.buckets (id, name, public)
VALUES ('actas-adjuntos', 'actas-adjuntos', false)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "Actas adjuntos storage read" ON storage.objects;
CREATE POLICY "Actas adjuntos storage read"
  ON storage.objects FOR SELECT TO anon, authenticated
  USING (bucket_id = 'actas-adjuntos');

DROP POLICY IF EXISTS "Actas adjuntos storage write" ON storage.objects;
CREATE POLICY "Actas adjuntos storage write"
  ON storage.objects FOR INSERT TO anon, authenticated
  WITH CHECK (bucket_id = 'actas-adjuntos');

DROP POLICY IF EXISTS "Actas adjuntos storage update" ON storage.objects;
CREATE POLICY "Actas adjuntos storage update"
  ON storage.objects FOR UPDATE TO anon, authenticated
  USING (bucket_id = 'actas-adjuntos')
  WITH CHECK (bucket_id = 'actas-adjuntos');

DROP POLICY IF EXISTS "Actas adjuntos storage delete" ON storage.objects;
CREATE POLICY "Actas adjuntos storage delete"
  ON storage.objects FOR DELETE TO anon, authenticated
  USING (bucket_id = 'actas-adjuntos');
