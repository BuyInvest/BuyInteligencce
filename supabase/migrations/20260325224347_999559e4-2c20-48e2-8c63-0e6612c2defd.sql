
-- TABELA: portos (Ranking nacional)
CREATE TABLE public.portos (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  nome TEXT NOT NULL,
  uf TEXT NOT NULL,
  regiao TEXT NOT NULL,
  tipo TEXT NOT NULL CHECK (tipo IN ('Público', 'TUP', 'Misto')),
  movimentacao_ton_2025 NUMERIC NOT NULL,
  movimentacao_ton_2024 NUMERIC NOT NULL,
  crescimento_yoy NUMERIC NOT NULL,
  teu_anual INTEGER,
  teu_crescimento NUMERIC,
  perfil_carga TEXT[] NOT NULL DEFAULT '{}',
  principais_mercadorias TEXT[] NOT NULL DEFAULT '{}',
  potencial_retro TEXT NOT NULL CHECK (potencial_retro IN ('Alto', 'Médio', 'Baixo')),
  destaque TEXT,
  hinterland TEXT,
  latitude NUMERIC,
  longitude NUMERIC,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- TABELA: portos_sc (Detalhamento Santa Catarina)
CREATE TABLE public.portos_sc (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  nome TEXT NOT NULL,
  movimentacao_ton_2024 NUMERIC NOT NULL,
  movimentacao_ton_2025 NUMERIC NOT NULL,
  crescimento_2024 NUMERIC NOT NULL,
  crescimento_2025 NUMERIC NOT NULL,
  teu_2025 INTEGER,
  especialidade TEXT NOT NULL,
  destaque TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- TABELA: commodities
CREATE TABLE public.commodities (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  nome TEXT NOT NULL,
  toneladas_2025 NUMERIC NOT NULL,
  crescimento NUMERIC NOT NULL,
  tipo TEXT NOT NULL CHECK (tipo IN ('Exportação', 'Importação', 'Ambos')),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- TABELA: serie_historica
CREATE TABLE public.serie_historica (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  ano INTEGER NOT NULL UNIQUE,
  total NUMERIC NOT NULL,
  conteineres NUMERIC NOT NULL,
  teu NUMERIC NOT NULL,
  cabotagem NUMERIC NOT NULL,
  longo_curso NUMERIC NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- TABELA: kpis_nacionais
CREATE TABLE public.kpis_nacionais (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  chave TEXT NOT NULL UNIQUE,
  valor NUMERIC NOT NULL,
  unidade TEXT NOT NULL,
  crescimento NUMERIC,
  fonte TEXT,
  ano_referencia INTEGER NOT NULL DEFAULT 2025,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- TABELA: perfil_carga
CREATE TABLE public.perfil_carga (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tipo TEXT NOT NULL,
  toneladas_2025 NUMERIC NOT NULL,
  participacao NUMERIC NOT NULL,
  crescimento NUMERIC NOT NULL,
  color TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- TABELA: movimentacao_regional
CREATE TABLE public.movimentacao_regional (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  regiao TEXT NOT NULL,
  toneladas NUMERIC NOT NULL,
  participacao NUMERIC NOT NULL,
  crescimento NUMERIC NOT NULL,
  color TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- TABELA: container_ranking
CREATE TABLE public.container_ranking (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  terminal TEXT NOT NULL,
  uf TEXT NOT NULL,
  teu INTEGER NOT NULL,
  crescimento NUMERIC NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- TABELA: redex
CREATE TABLE public.redex (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  nome TEXT NOT NULL,
  cidade TEXT NOT NULL,
  uf TEXT NOT NULL,
  regiao_fiscal TEXT NOT NULL,
  tipo TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- RLS: Dados públicos, leitura aberta
ALTER TABLE public.portos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.portos_sc ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.commodities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.serie_historica ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.kpis_nacionais ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.perfil_carga ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.movimentacao_regional ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.container_ranking ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.redex ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Portos são visíveis publicamente" ON public.portos FOR SELECT USING (true);
CREATE POLICY "Portos SC são visíveis publicamente" ON public.portos_sc FOR SELECT USING (true);
CREATE POLICY "Commodities são visíveis publicamente" ON public.commodities FOR SELECT USING (true);
CREATE POLICY "Série histórica é visível publicamente" ON public.serie_historica FOR SELECT USING (true);
CREATE POLICY "KPIs são visíveis publicamente" ON public.kpis_nacionais FOR SELECT USING (true);
CREATE POLICY "Perfil carga é visível publicamente" ON public.perfil_carga FOR SELECT USING (true);
CREATE POLICY "Movimentação regional é visível publicamente" ON public.movimentacao_regional FOR SELECT USING (true);
CREATE POLICY "Container ranking é visível publicamente" ON public.container_ranking FOR SELECT USING (true);
CREATE POLICY "REDEX são visíveis publicamente" ON public.redex FOR SELECT USING (true);

-- Trigger para updated_at
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER update_portos_updated_at BEFORE UPDATE ON public.portos FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_portos_sc_updated_at BEFORE UPDATE ON public.portos_sc FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_commodities_updated_at BEFORE UPDATE ON public.commodities FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_serie_historica_updated_at BEFORE UPDATE ON public.serie_historica FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_kpis_nacionais_updated_at BEFORE UPDATE ON public.kpis_nacionais FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_perfil_carga_updated_at BEFORE UPDATE ON public.perfil_carga FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_movimentacao_regional_updated_at BEFORE UPDATE ON public.movimentacao_regional FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_container_ranking_updated_at BEFORE UPDATE ON public.container_ranking FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_redex_updated_at BEFORE UPDATE ON public.redex FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
