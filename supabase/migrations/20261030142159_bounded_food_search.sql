-- Safe both for the current schema and a new nutrition schema. Existing IDs,
-- constraints, owner policies and data are not recreated or rewritten.
CREATE TABLE IF NOT EXISTS public.foods(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),name text NOT NULL,
 calories_per_100g numeric(8,2) NOT NULL CHECK(calories_per_100g>=0),
 protein_per_100g numeric(8,2) NOT NULL CHECK(protein_per_100g>=0),
 carbs_per_100g numeric(8,2) NOT NULL CHECK(carbs_per_100g>=0),
 fat_per_100g numeric(8,2) NOT NULL CHECK(fat_per_100g>=0),
 category text,serving_size text,catalog_metadata jsonb,calories numeric,protein_g numeric,carbs_g numeric,fat_g numeric,
 created_at timestamptz NOT NULL DEFAULT now());
ALTER TABLE public.foods ADD COLUMN IF NOT EXISTS catalog_metadata jsonb;
CREATE UNIQUE INDEX IF NOT EXISTS foods_catalog_source_id_unique ON public.foods((catalog_metadata->>'source_id')) WHERE catalog_metadata->>'source_id' IS NOT NULL;
ALTER TABLE public.foods ENABLE ROW LEVEL SECURITY;
GRANT SELECT ON public.foods TO anon,authenticated;
DO $$ BEGIN
 IF NOT EXISTS(SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='foods' AND cmd IN ('SELECT','ALL')) THEN
  CREATE POLICY foods_catalogue_read ON public.foods FOR SELECT TO anon,authenticated USING(true);
 END IF;
END $$;
-- Immutable Unicode normalization matches the app's NFC/NFD word rules.
CREATE OR REPLACE FUNCTION public.food_fold(value text) RETURNS text
LANGUAGE sql IMMUTABLE PARALLEL SAFE SET search_path='' AS $$
 SELECT replace(regexp_replace(normalize(lower(coalesce(value,'')),NFD),U&'[\0300-\036F]','','g'),'đ','d')
$$;
CREATE OR REPLACE FUNCTION public.food_words(value text) RETURNS text[]
LANGUAGE sql IMMUTABLE PARALLEL SAFE SET search_path='' AS $$
 SELECT array_remove(regexp_split_to_array(trim(regexp_replace(normalize(lower(coalesce(value,'')),NFC),'[^[:alnum:]]+',' ','g')),'\s+'),'')
$$;
CREATE OR REPLACE FUNCTION public.food_names(name text,metadata jsonb) RETURNS text[]
LANGUAGE sql IMMUTABLE PARALLEL SAFE SET search_path='' AS $$
 SELECT array_remove(ARRAY[name,metadata->>'name_vi',metadata->>'name_en'] ||
  ARRAY(SELECT jsonb_array_elements_text(CASE WHEN jsonb_typeof(metadata->'aliases')='array' THEN metadata->'aliases' ELSE '[]'::jsonb END)),NULL)
$$;
CREATE OR REPLACE FUNCTION public.food_document(name text,metadata jsonb) RETURNS tsvector
LANGUAGE sql IMMUTABLE PARALLEL SAFE SET search_path='' AS $$
 SELECT to_tsvector('simple'::regconfig,public.food_fold(array_to_string(public.food_names(name,metadata),' ')))
$$;
ALTER TABLE public.foods ADD COLUMN IF NOT EXISTS search_document tsvector
 GENERATED ALWAYS AS (public.food_document(name,catalog_metadata)) STORED;
CREATE INDEX IF NOT EXISTS foods_search_document_gin ON public.foods USING gin(search_document);
CREATE INDEX IF NOT EXISTS foods_catalog_group ON public.foods ((coalesce(catalog_metadata->>'group',category)));

-- Pure word ranking: full name, phrase start, complete phrase, ordered words, final-word prefix.
CREATE OR REPLACE FUNCTION public.food_name_rank(label text,query_words text[],folded boolean) RETURNS integer
LANGUAGE plpgsql IMMUTABLE PARALLEL SAFE SET search_path='' AS $$
DECLARE words text[]:=public.food_words(label);n integer:=cardinality(query_words);m integer:=cardinality(words);
 i integer;j integer;k integer;phase integer;wanted text;actual text;ok boolean;prefix_ok boolean;
BEGIN
 IF n=0 OR m<n THEN RETURN NULL; END IF;
 FOR phase IN 0..1 LOOP
  FOR i IN 1..greatest(m-n+1,0) LOOP
   ok:=true;
   FOR j IN 1..n LOOP
    wanted:=query_words[j];actual:=words[i+j-1];
    IF folded AND wanted=public.food_fold(wanted) THEN actual:=public.food_fold(actual); END IF;
    IF actual<>wanted THEN ok:=false;EXIT; END IF;
   END LOOP;
   IF ok THEN RETURN CASE WHEN i=1 AND m=n THEN 0 WHEN i=1 THEN 1 ELSE 2 END; END IF;
  END LOOP;
  -- Complete ordered words before allowing a prefix on the final word.
  j:=1;
  FOR k IN 1..m LOOP
   wanted:=query_words[j];actual:=words[k];
   IF folded AND wanted=public.food_fold(wanted) THEN actual:=public.food_fold(actual); END IF;
   prefix_ok:=phase=1 AND j=n AND length(wanted)>=CASE WHEN n=1 THEN 3 ELSE 2 END;
   IF actual=wanted OR (prefix_ok AND starts_with(actual,wanted)) THEN j:=j+1; END IF;
   IF j>n THEN RETURN CASE WHEN phase=0 THEN 3 ELSE 4 END; END IF;
  END LOOP;
 END LOOP;
 RETURN NULL;
END $$;

CREATE OR REPLACE FUNCTION public.search_foods(p_query text DEFAULT '',p_category text DEFAULT NULL,p_offset integer DEFAULT 0,p_limit integer DEFAULT 30)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY INVOKER SET search_path='' AS $$
DECLARE q text:=trim(coalesce(p_query,''));tokens text[];fts tsquery;group_key text;result jsonb;
BEGIN
 IF p_limit IS NULL OR p_limit<1 OR p_limit>100 OR p_offset IS NULL OR p_offset<0 OR length(q)>160 THEN
  RAISE EXCEPTION 'Invalid food search pagination' USING ERRCODE='22023';
 END IF;
 tokens:=public.food_words(q);
 IF q<>'' AND cardinality(tokens)=0 THEN RETURN jsonb_build_object('data','[]'::jsonb,'total',0); END IF;
 group_key:=CASE p_category WHEN 'Protein' THEN 'meat' WHEN 'Grains' THEN 'grains' WHEN 'Fruit' THEN 'fruits' WHEN 'Vegetables' THEN 'vegetables' WHEN 'Dairy' THEN 'dairy_legumes' WHEN 'Nuts' THEN 'dairy_legumes' ELSE p_category END;
 IF cardinality(tokens)>0 THEN
  SELECT to_tsquery('simple'::regconfig,string_agg(quote_literal(public.food_fold(word)) ||
   CASE WHEN ord=cardinality(tokens) AND length(word)>=CASE WHEN cardinality(tokens)=1 THEN 3 ELSE 2 END THEN ':*' ELSE '' END,' & ' ORDER BY ord))
  INTO fts FROM unnest(tokens) WITH ORDINALITY AS t(word,ord);
 END IF;
 WITH candidates AS MATERIALIZED (
  SELECT f.*,ranked.exact,ranked.folded FROM public.foods f
  CROSS JOIN LATERAL (SELECT min(public.food_name_rank(label,tokens,false)) AS exact,min(public.food_name_rank(label,tokens,true)) AS folded
   FROM unnest(public.food_names(f.name,f.catalog_metadata)) label) ranked
  WHERE coalesce(f.catalog_metadata->>'selectable','true')<>'false'
   AND (group_key IS NULL OR group_key=coalesce(f.catalog_metadata->>'group',CASE f.category WHEN 'Protein' THEN 'meat' WHEN 'Grains' THEN 'grains' WHEN 'Fruit' THEN 'fruits' WHEN 'Vegetables' THEN 'vegetables' WHEN 'Dairy' THEN 'dairy_legumes' WHEN 'Nuts' THEN 'dairy_legumes' ELSE f.category END))
   AND (fts IS NULL OR f.search_document @@ fts)
 ), matches AS MATERIALIZED (
  SELECT c.*,CASE WHEN q='' THEN 0 ELSE coalesce(exact,10+folded) END AS score FROM candidates c
  WHERE q='' OR (exact IS NOT NULL OR (folded IS NOT NULL AND NOT (
   public.food_fold(q)<>lower(normalize(q,NFC)) AND EXISTS(SELECT 1 FROM candidates x WHERE x.exact IS NOT NULL))))
 ), page AS (
  SELECT to_jsonb(m)-'search_document'-'exact'-'folded'-'score' AS food FROM matches m
  ORDER BY score,coalesce(catalog_metadata->>'name_vi',name),id OFFSET p_offset LIMIT p_limit
 ) SELECT jsonb_build_object('data',coalesce((SELECT jsonb_agg(food) FROM page),'[]'::jsonb),'total',(SELECT count(*) FROM matches)) INTO result;
 RETURN result;
END $$;
REVOKE ALL ON FUNCTION public.search_foods(text,text,integer,integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.search_foods(text,text,integer,integer) TO anon,authenticated;
-- Pure helpers do not elevate privileges; catalogue writes continue to be denied by the existing RLS.
REVOKE ALL ON FUNCTION public.food_fold(text),public.food_words(text),public.food_names(text,jsonb),public.food_document(text,jsonb),public.food_name_rank(text,text[],boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.food_fold(text),public.food_words(text),public.food_names(text,jsonb),public.food_document(text,jsonb),public.food_name_rank(text,text[],boolean) TO anon,authenticated;
