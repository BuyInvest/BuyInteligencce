
CREATE TABLE public.library_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  parent_id uuid REFERENCES public.library_categories(id) ON DELETE CASCADE,
  slug text NOT NULL UNIQUE,
  name text NOT NULL,
  icon text,
  sort_order int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.library_categories TO authenticated;
GRANT ALL ON public.library_categories TO service_role;
ALTER TABLE public.library_categories ENABLE ROW LEVEL SECURITY;
CREATE POLICY "lc read" ON public.library_categories FOR SELECT TO authenticated USING (true);
CREATE POLICY "lc admin ins" ON public.library_categories FOR INSERT TO authenticated WITH CHECK (private.has_role(auth.uid(), 'admin'::public.app_role));
CREATE POLICY "lc admin upd" ON public.library_categories FOR UPDATE TO authenticated USING (private.has_role(auth.uid(), 'admin'::public.app_role));
CREATE POLICY "lc admin del" ON public.library_categories FOR DELETE TO authenticated USING (private.has_role(auth.uid(), 'admin'::public.app_role));

CREATE TABLE public.library_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  category_id uuid REFERENCES public.library_categories(id) ON DELETE SET NULL,
  slug text NOT NULL UNIQUE,
  title text NOT NULL,
  summary text,
  content text NOT NULL DEFAULT '',
  tags text[] NOT NULL DEFAULT '{}',
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','published','archived')),
  version int NOT NULL DEFAULT 1,
  author_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  search_vector tsvector,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE OR REPLACE FUNCTION public.library_documents_tsv_update() RETURNS trigger
LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  NEW.search_vector :=
    setweight(to_tsvector('portuguese', coalesce(NEW.title,'')), 'A') ||
    setweight(to_tsvector('portuguese', coalesce(NEW.summary,'')), 'B') ||
    setweight(to_tsvector('portuguese', array_to_string(NEW.tags,' ')), 'B') ||
    setweight(to_tsvector('portuguese', coalesce(NEW.content,'')), 'C');
  RETURN NEW;
END $$;

CREATE TRIGGER library_documents_tsv
  BEFORE INSERT OR UPDATE ON public.library_documents
  FOR EACH ROW EXECUTE FUNCTION public.library_documents_tsv_update();

CREATE INDEX library_documents_search_idx ON public.library_documents USING GIN (search_vector);
CREATE INDEX library_documents_category_idx ON public.library_documents (category_id);
CREATE INDEX library_documents_tags_idx ON public.library_documents USING GIN (tags);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.library_documents TO authenticated;
GRANT ALL ON public.library_documents TO service_role;
ALTER TABLE public.library_documents ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ld read" ON public.library_documents FOR SELECT TO authenticated USING (true);
CREATE POLICY "ld admin ins" ON public.library_documents FOR INSERT TO authenticated WITH CHECK (private.has_role(auth.uid(), 'admin'::public.app_role));
CREATE POLICY "ld admin upd" ON public.library_documents FOR UPDATE TO authenticated USING (private.has_role(auth.uid(), 'admin'::public.app_role));
CREATE POLICY "ld admin del" ON public.library_documents FOR DELETE TO authenticated USING (private.has_role(auth.uid(), 'admin'::public.app_role));
CREATE TRIGGER library_documents_updated_at BEFORE UPDATE ON public.library_documents FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.library_document_relations (
  document_id uuid NOT NULL REFERENCES public.library_documents(id) ON DELETE CASCADE,
  related_document_id uuid NOT NULL REFERENCES public.library_documents(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (document_id, related_document_id),
  CHECK (document_id <> related_document_id)
);
GRANT SELECT, INSERT, DELETE ON public.library_document_relations TO authenticated;
GRANT ALL ON public.library_document_relations TO service_role;
ALTER TABLE public.library_document_relations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "lr read" ON public.library_document_relations FOR SELECT TO authenticated USING (true);
CREATE POLICY "lr admin ins" ON public.library_document_relations FOR INSERT TO authenticated WITH CHECK (private.has_role(auth.uid(), 'admin'::public.app_role));
CREATE POLICY "lr admin del" ON public.library_document_relations FOR DELETE TO authenticated USING (private.has_role(auth.uid(), 'admin'::public.app_role));

CREATE OR REPLACE FUNCTION public.search_library(p_query text)
RETURNS TABLE (id uuid, slug text, title text, summary text, tags text[], category_id uuid, rank real, updated_at timestamptz)
LANGUAGE sql STABLE SECURITY INVOKER SET search_path = public
AS $$
  SELECT d.id, d.slug, d.title, d.summary, d.tags, d.category_id,
         ts_rank(d.search_vector, websearch_to_tsquery('portuguese', p_query))::real,
         d.updated_at
  FROM public.library_documents d
  WHERE p_query IS NOT NULL AND length(trim(p_query)) > 0
    AND d.search_vector @@ websearch_to_tsquery('portuguese', p_query)
  ORDER BY 7 DESC, d.updated_at DESC LIMIT 50;
$$;
GRANT EXECUTE ON FUNCTION public.search_library(text) TO authenticated;

INSERT INTO public.library_categories (slug, name, icon, sort_order) VALUES
  ('institucional','Institucional','Building2',1),
  ('comercial','Comercial','Briefcase',2),
  ('mercado','Mercado','TrendingUp',3),
  ('engenharia','Engenharia','HardHat',4),
  ('juridico','Jurídico','Scale',5),
  ('financeiro','Financeiro','DollarSign',6),
  ('administracao','Administração','Settings',7),
  ('academia','Academia','GraduationCap',8),
  ('estudos','Estudos','BookOpen',9),
  ('faq','FAQ','HelpCircle',10);

DO $$
DECLARE r record; sub_name text; ord int;
DECLARE subs jsonb := jsonb_build_object(
  'institucional', jsonb_build_array('Constituição Buy Invest','Manual Institucional','Missão','Visão','Valores','Cultura','Posicionamento','Sobre a Empresa','Governança'),
  'comercial', jsonb_build_array('Playbook SDR','Playbook Broker','CRM','Pipeline','Scripts','Negociação','Visitas','Objeções','Propostas'),
  'mercado', jsonb_build_array('Real Estate','Mercado Brasileiro','Mercado Internacional','Vacância','Cap Rate','Indicadores','Regiões','Portos','Rodovias','Aeroportos','Empresas','Fundos','Investidores'),
  'engenharia', jsonb_build_array('Galpões','Classe AAA','BTS','Turn Key','Piso Industrial','Docas','Sprinklers','ESFR','Energia','Construção','Memorial'),
  'juridico', jsonb_build_array('Contratos','Locação','Compra e Venda','SPE','Holding','LGPD','Due Diligence','Garantias'),
  'financeiro', jsonb_build_array('Cap Rate','NOI','ROI','TIR','VPL','Fluxo de Caixa','Viabilidade','Valuation'),
  'administracao', jsonb_build_array('SOPs','Processos','Checklist','Fluxos','Pós-locação','Pós-venda'),
  'academia', jsonb_build_array('Cursos','Treinamentos','Vídeos','Quizzes','Materiais'),
  'estudos', jsonb_build_array('Mercado','Logística','Industrial','Cases','Relatórios'),
  'faq', jsonb_build_array('Perguntas Frequentes')
);
BEGIN
  FOR r IN SELECT id, slug FROM public.library_categories WHERE parent_id IS NULL LOOP
    ord := 0;
    FOR sub_name IN SELECT jsonb_array_elements_text(subs -> r.slug) LOOP
      ord := ord + 1;
      INSERT INTO public.library_categories (parent_id, slug, name, sort_order)
      VALUES (
        r.id,
        r.slug || '-' || regexp_replace(
          translate(lower(sub_name),
            'áàâãäéèêëíìîïóòôõöúùûüçñ',
            'aaaaaeeeeiiiiooooouuuucn'),
          '[^a-z0-9]+', '-', 'g'),
        sub_name, ord
      );
    END LOOP;
  END LOOP;
END $$;
