CREATE TABLE public.fiis (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL,
  ticker text NOT NULL UNIQUE,
  patrimonio_liquido numeric,
  valor_cota numeric,
  valor_m2_area_propria numeric,
  categoria text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.fiis ENABLE ROW LEVEL SECURITY;

CREATE POLICY "FIIs são visíveis publicamente"
  ON public.fiis FOR SELECT TO public USING (true);

CREATE TRIGGER update_fiis_updated_at
  BEFORE UPDATE ON public.fiis
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();