-- Editorial roles are server-owned. No user metadata or client email is trusted.
CREATE SCHEMA IF NOT EXISTS private;
REVOKE ALL ON SCHEMA private FROM PUBLIC;
GRANT USAGE ON SCHEMA private TO anon,authenticated;
CREATE TABLE public.user_roles(
 user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
 role text NOT NULL DEFAULT 'user' CHECK(role IN ('user','admin')),
 created_at timestamptz NOT NULL DEFAULT now());
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.user_roles FROM anon,authenticated;
GRANT SELECT ON public.user_roles TO anon,authenticated;
CREATE POLICY roles_read_self ON public.user_roles FOR SELECT TO anon,authenticated USING(user_id=(SELECT auth.uid()));
CREATE FUNCTION private.is_article_admin() RETURNS boolean LANGUAGE sql STABLE SECURITY INVOKER SET search_path='' AS $$
 SELECT auth.uid() IS NOT NULL AND EXISTS(SELECT 1 FROM public.user_roles WHERE user_id=(SELECT auth.uid()) AND role='admin')
$$;
REVOKE ALL ON FUNCTION private.is_article_admin() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION private.is_article_admin() TO anon,authenticated;
CREATE TABLE private.article_admin_invites(
 email text PRIMARY KEY CHECK(email=lower(email)),
 claimed_user_id uuid UNIQUE REFERENCES auth.users(id) ON DELETE RESTRICT,
 created_at timestamptz NOT NULL DEFAULT now());
ALTER TABLE private.article_admin_invites ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON private.article_admin_invites FROM PUBLIC,anon,authenticated;
INSERT INTO private.article_admin_invites(email) VALUES('phapsutan@gmail.com') ON CONFLICT DO NOTHING;
INSERT INTO public.user_roles(user_id) SELECT id FROM auth.users ON CONFLICT DO NOTHING;
-- Bind the invitation once to the exact confirmed Auth UUID. Reusing an email
-- after deletion/change cannot claim an already-consumed invitation.
WITH confirmed AS (SELECT u.id,i.email FROM auth.users u JOIN private.article_admin_invites i ON lower(u.email)=i.email
 WHERE u.email_confirmed_at IS NOT NULL AND i.claimed_user_id IS NULL), claimed AS (
 UPDATE private.article_admin_invites i SET claimed_user_id=c.id FROM confirmed c WHERE i.email=c.email RETURNING i.claimed_user_id)
INSERT INTO public.user_roles(user_id,role) SELECT claimed_user_id,'admin' FROM claimed ON CONFLICT(user_id) DO UPDATE SET role='admin';
CREATE FUNCTION private.assign_article_role() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE claimed uuid;
BEGIN
 INSERT INTO public.user_roles(user_id) VALUES(NEW.id) ON CONFLICT DO NOTHING;
 IF NEW.email_confirmed_at IS NOT NULL THEN
  UPDATE private.article_admin_invites SET claimed_user_id=NEW.id
   WHERE email=lower(NEW.email) AND claimed_user_id IS NULL RETURNING claimed_user_id INTO claimed;
  IF claimed IS NOT NULL THEN UPDATE public.user_roles SET role='admin' WHERE user_id=claimed; END IF;
 END IF;
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION private.assign_article_role() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER assign_article_role AFTER INSERT OR UPDATE OF email,email_confirmed_at ON auth.users FOR EACH ROW EXECUTE FUNCTION private.assign_article_role();

CREATE TABLE public.article_categories(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),slug text NOT NULL UNIQUE CHECK(slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' AND length(slug)<=100),
 name_vi text NOT NULL CHECK(length(trim(name_vi)) BETWEEN 1 AND 120),name_en text NOT NULL CHECK(length(trim(name_en)) BETWEEN 1 AND 120),
 description_vi text NOT NULL DEFAULT '' CHECK(length(description_vi)<=1000),description_en text NOT NULL DEFAULT '' CHECK(length(description_en)<=1000),
 icon text NOT NULL DEFAULT 'book-outline' CHECK(length(icon)<=60),sort_order integer NOT NULL DEFAULT 0,
 is_active boolean NOT NULL DEFAULT true,created_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE public.articles(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),slug text NOT NULL UNIQUE CHECK(slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' AND length(slug)<=160),
 category_id uuid NOT NULL REFERENCES public.article_categories(id) ON DELETE RESTRICT,
 author_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,cover_image_path text,
 status text NOT NULL DEFAULT 'draft' CHECK(status IN ('draft','published','archived')),
 is_featured boolean NOT NULL DEFAULT false,published_at timestamptz,
 created_at timestamptz NOT NULL DEFAULT now(),updated_at timestamptz NOT NULL DEFAULT now(),
 CHECK(status<>'published' OR published_at IS NOT NULL),
 CHECK(cover_image_path IS NULL OR cover_image_path ~ ('^[0-9a-f-]{36}/'||id::text||'/[0-9a-f-]{36}\.(jpg|png|webp)$')));
CREATE INDEX articles_category_id_idx ON public.articles(category_id);
CREATE INDEX articles_author_id_idx ON public.articles(author_id);
CREATE INDEX articles_published_idx ON public.articles(published_at DESC,id) WHERE status='published';
CREATE INDEX articles_updated_idx ON public.articles(updated_at DESC,id);
CREATE FUNCTION private.article_fold(value text) RETURNS text LANGUAGE sql IMMUTABLE PARALLEL SAFE SET search_path='' AS $$
 SELECT replace(regexp_replace(normalize(lower(coalesce(value,'')),NFD),U&'[\0300-\036F]','','g'),'đ','d')
$$;
CREATE FUNCTION private.article_references_valid(refs jsonb) RETURNS boolean LANGUAGE sql IMMUTABLE SET search_path='' AS $$
 SELECT jsonb_typeof(refs)='array' AND jsonb_array_length(refs)<=20 AND NOT EXISTS(
  SELECT 1 FROM jsonb_array_elements(CASE WHEN jsonb_typeof(refs)='array' THEN refs ELSE '[]'::jsonb END) r
  WHERE jsonb_typeof(r)<>'object' OR coalesce(length(trim(r->>'name')),0) NOT BETWEEN 1 AND 240
   OR coalesce(r->>'url','') !~ '^https://[^[:space:]]+$' OR length(r->>'url')>2048)
$$;
CREATE TABLE public.article_translations(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),article_id uuid NOT NULL REFERENCES public.articles(id) ON DELETE CASCADE,
 language text NOT NULL CHECK(language IN ('vi','en')),title text NOT NULL DEFAULT '' CHECK(length(title)<=240),
 summary text NOT NULL DEFAULT '' CHECK(length(summary)<=1200),content text NOT NULL DEFAULT '' CHECK(length(content)<=100000),
 reading_time_minutes integer NOT NULL DEFAULT 1 CHECK(reading_time_minutes BETWEEN 1 AND 120),
 source_name text NOT NULL DEFAULT '' CHECK(length(source_name)<=240),source_url text NOT NULL DEFAULT '' CHECK(source_url='' OR (source_url ~ '^https://[^[:space:]]+$' AND length(source_url)<=2048)),
 reference_links jsonb NOT NULL DEFAULT '[]'::jsonb CHECK(private.article_references_valid(reference_links)),
 updated_at timestamptz NOT NULL DEFAULT now(),UNIQUE(article_id,language),
 search_document tsvector GENERATED ALWAYS AS (to_tsvector('simple'::regconfig,private.article_fold(title||' '||summary))) STORED);
CREATE INDEX article_translations_search_gin ON public.article_translations USING gin(search_document);
CREATE TABLE public.article_bookmarks(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
 article_id uuid NOT NULL REFERENCES public.articles(id) ON DELETE CASCADE,created_at timestamptz NOT NULL DEFAULT now(),UNIQUE(user_id,article_id));
CREATE INDEX article_bookmarks_article_idx ON public.article_bookmarks(article_id);
CREATE INDEX article_bookmarks_owner_date_idx ON public.article_bookmarks(user_id,created_at DESC);
CREATE TABLE public.article_read_history(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
 article_id uuid NOT NULL REFERENCES public.articles(id) ON DELETE CASCADE,last_read_at timestamptz NOT NULL DEFAULT now(),
 read_count integer NOT NULL DEFAULT 1 CHECK(read_count>0),UNIQUE(user_id,article_id));
CREATE INDEX article_history_article_idx ON public.article_read_history(article_id);
CREATE INDEX article_history_owner_date_idx ON public.article_read_history(user_id,last_read_at DESC);
CREATE TABLE public.article_category_preferences(
 user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,category_id uuid NOT NULL REFERENCES public.article_categories(id) ON DELETE CASCADE,
 created_at timestamptz NOT NULL DEFAULT now(),PRIMARY KEY(user_id,category_id));
CREATE INDEX article_preferences_category_idx ON public.article_category_preferences(category_id);

ALTER TABLE public.article_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.articles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.article_translations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.article_bookmarks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.article_read_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.article_category_preferences ENABLE ROW LEVEL SECURITY;
GRANT SELECT ON public.article_categories,public.articles,public.article_translations TO anon,authenticated;
GRANT INSERT,UPDATE,DELETE ON public.article_categories,public.articles,public.article_translations TO authenticated;
GRANT SELECT,INSERT,DELETE ON public.article_bookmarks,public.article_category_preferences TO authenticated;
GRANT SELECT ON public.article_read_history TO authenticated;
-- Supabase may have schema-wide default grants. Explicitly remove unneeded writes.
REVOKE INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER ON public.article_read_history FROM anon,authenticated;
REVOKE UPDATE ON public.article_bookmarks,public.article_category_preferences FROM anon,authenticated;
REVOKE INSERT,UPDATE,DELETE ON public.article_categories,public.articles,public.article_translations,public.article_bookmarks,public.article_category_preferences FROM anon;
CREATE POLICY categories_read ON public.article_categories FOR SELECT TO anon,authenticated USING(is_active OR (SELECT private.is_article_admin()));
CREATE POLICY categories_admin_insert ON public.article_categories FOR INSERT TO authenticated WITH CHECK((SELECT private.is_article_admin()));
CREATE POLICY categories_admin_update ON public.article_categories FOR UPDATE TO authenticated USING((SELECT private.is_article_admin())) WITH CHECK((SELECT private.is_article_admin()));
CREATE POLICY categories_admin_delete ON public.article_categories FOR DELETE TO authenticated USING((SELECT private.is_article_admin()));
CREATE POLICY articles_read ON public.articles FOR SELECT TO anon,authenticated USING((status='published' AND published_at<=now() AND EXISTS(SELECT 1 FROM public.article_categories c WHERE c.id=category_id AND c.is_active)) OR (SELECT private.is_article_admin()));
CREATE POLICY articles_admin_insert ON public.articles FOR INSERT TO authenticated WITH CHECK((SELECT private.is_article_admin()) AND author_id=(SELECT auth.uid()));
CREATE POLICY articles_admin_update ON public.articles FOR UPDATE TO authenticated USING((SELECT private.is_article_admin())) WITH CHECK((SELECT private.is_article_admin()));
CREATE POLICY articles_admin_delete ON public.articles FOR DELETE TO authenticated USING((SELECT private.is_article_admin()));
CREATE POLICY translations_read ON public.article_translations FOR SELECT TO anon,authenticated USING(EXISTS(SELECT 1 FROM public.articles a WHERE a.id=article_id));
CREATE POLICY translations_admin_insert ON public.article_translations FOR INSERT TO authenticated WITH CHECK((SELECT private.is_article_admin()));
CREATE POLICY translations_admin_update ON public.article_translations FOR UPDATE TO authenticated USING((SELECT private.is_article_admin())) WITH CHECK((SELECT private.is_article_admin()));
CREATE POLICY translations_admin_delete ON public.article_translations FOR DELETE TO authenticated USING((SELECT private.is_article_admin()));
CREATE POLICY bookmarks_read_self ON public.article_bookmarks FOR SELECT TO authenticated USING(user_id=(SELECT auth.uid()));
CREATE POLICY bookmarks_insert_self ON public.article_bookmarks FOR INSERT TO authenticated WITH CHECK(user_id=(SELECT auth.uid()) AND EXISTS(SELECT 1 FROM public.articles a WHERE a.id=article_id AND a.status='published' AND a.published_at<=now()));
CREATE POLICY bookmarks_delete_self ON public.article_bookmarks FOR DELETE TO authenticated USING(user_id=(SELECT auth.uid()));
CREATE POLICY history_read_self ON public.article_read_history FOR SELECT TO authenticated USING(user_id=(SELECT auth.uid()));
CREATE POLICY preferences_read_self ON public.article_category_preferences FOR SELECT TO authenticated USING(user_id=(SELECT auth.uid()));
CREATE POLICY preferences_insert_self ON public.article_category_preferences FOR INSERT TO authenticated WITH CHECK(user_id=(SELECT auth.uid()) AND EXISTS(SELECT 1 FROM public.article_categories c WHERE c.id=category_id AND c.is_active));
CREATE POLICY preferences_delete_self ON public.article_category_preferences FOR DELETE TO authenticated USING(user_id=(SELECT auth.uid()));

CREATE FUNCTION private.article_touch() RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
BEGIN
 IF TG_TABLE_NAME='articles' AND TG_OP='UPDATE' THEN
  IF NEW.author_id IS DISTINCT FROM OLD.author_id AND NOT (NEW.author_id IS NULL AND pg_trigger_depth()>1) THEN RAISE EXCEPTION 'Article author is immutable' USING ERRCODE='22023'; END IF;
  NEW.created_at:=OLD.created_at;
 END IF;
 IF TG_TABLE_NAME='article_translations' THEN
  IF NEW.article_id IS DISTINCT FROM OLD.article_id OR NEW.language IS DISTINCT FROM OLD.language THEN RAISE EXCEPTION 'Translation identity is immutable' USING ERRCODE='22023'; END IF;
 END IF;
 NEW.updated_at:=clock_timestamp();RETURN NEW;
END $$;
CREATE TRIGGER article_touch BEFORE UPDATE ON public.articles FOR EACH ROW EXECUTE FUNCTION private.article_touch();
CREATE TRIGGER article_translation_touch BEFORE UPDATE ON public.article_translations FOR EACH ROW EXECUTE FUNCTION private.article_touch();
-- Deferred validation makes bilingual saves atomic while preventing incomplete
-- published content through direct table writes as well as through the CMS RPC.
CREATE FUNCTION private.validate_article_publication() RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE target uuid; current_article public.articles;
BEGIN
 IF TG_TABLE_NAME='articles' THEN target:=NEW.id; ELSE target:=coalesce(NEW.article_id,OLD.article_id); END IF;
 SELECT * INTO current_article FROM public.articles WHERE id=target;
 IF current_article.status='published' THEN
  IF NOT EXISTS(SELECT 1 FROM public.article_translations t WHERE t.article_id=target AND length(trim(title))>0 AND length(trim(summary))>0 AND length(trim(content))>=100 AND length(trim(source_name))>0 AND source_url ~ '^https://[^[:space:]]+$')
   OR EXISTS(SELECT 1 FROM public.article_translations t WHERE t.article_id=target AND (length(trim(title))=0 OR length(trim(summary))=0 OR length(trim(content))<100 OR length(trim(source_name))=0 OR source_url !~ '^https://[^[:space:]]+$')) THEN
   RAISE EXCEPTION 'Published articles require complete translations and verified source links' USING ERRCODE='23514';
  END IF;
 END IF;
 RETURN NULL;
END $$;
CREATE CONSTRAINT TRIGGER article_publication_guard AFTER INSERT OR UPDATE ON public.articles DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION private.validate_article_publication();
CREATE CONSTRAINT TRIGGER translation_publication_guard AFTER INSERT OR UPDATE OR DELETE ON public.article_translations DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION private.validate_article_publication();

CREATE FUNCTION public.save_article(p_id uuid,p_expected_updated_at timestamptz,p_article jsonb,p_translations jsonb) RETURNS jsonb
LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE target uuid; old public.articles; tr jsonb; result public.articles;
BEGIN
 IF NOT private.is_article_admin() THEN RAISE EXCEPTION 'Admin required' USING ERRCODE='42501'; END IF;
 IF jsonb_typeof(p_article)<>'object' OR jsonb_typeof(p_translations)<>'array' OR jsonb_array_length(p_translations)>2
  OR EXISTS(SELECT 1 FROM jsonb_object_keys(p_article) k WHERE k NOT IN ('slug','category_id','cover_image_path','status','is_featured')) THEN RAISE EXCEPTION 'Invalid article payload' USING ERRCODE='22023'; END IF;
 IF p_id IS NULL THEN
  INSERT INTO public.articles(slug,category_id,author_id) VALUES(p_article->>'slug',(p_article->>'category_id')::uuid,auth.uid()) RETURNING id INTO target;
 ELSE
  SELECT * INTO old FROM public.articles WHERE id=p_id FOR UPDATE;
  IF old.id IS NULL THEN RAISE EXCEPTION 'Article not found' USING ERRCODE='P0002'; END IF;
  IF p_expected_updated_at IS NULL OR old.updated_at<>p_expected_updated_at THEN RAISE EXCEPTION 'Article changed; reload before saving' USING ERRCODE='40001'; END IF;
  target:=p_id;
 END IF;
 DELETE FROM public.article_translations WHERE article_id=target;
 FOR tr IN SELECT value FROM jsonb_array_elements(p_translations) LOOP
  IF EXISTS(SELECT 1 FROM jsonb_object_keys(tr) k WHERE k NOT IN ('language','title','summary','content','reading_time_minutes','source_name','source_url','reference_links')) THEN RAISE EXCEPTION 'Invalid translation payload' USING ERRCODE='22023'; END IF;
  INSERT INTO public.article_translations(article_id,language,title,summary,content,reading_time_minutes,source_name,source_url,reference_links)
  VALUES(target,tr->>'language',coalesce(tr->>'title',''),coalesce(tr->>'summary',''),coalesce(tr->>'content',''),coalesce((tr->>'reading_time_minutes')::integer,1),coalesce(tr->>'source_name',''),coalesce(tr->>'source_url',''),coalesce(tr->'reference_links','[]'::jsonb));
 END LOOP;
 UPDATE public.articles SET slug=p_article->>'slug',category_id=(p_article->>'category_id')::uuid,
  cover_image_path=nullif(p_article->>'cover_image_path',''),status=p_article->>'status',is_featured=coalesce((p_article->>'is_featured')::boolean,false),
  published_at=CASE WHEN p_article->>'status'='published' THEN coalesce(published_at,now()) ELSE published_at END WHERE id=target RETURNING * INTO result;
 RETURN to_jsonb(result);
END $$;

CREATE FUNCTION private.record_article_read(p_article_id uuid) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE owner uuid:=auth.uid();
BEGIN
 IF owner IS NULL THEN RAISE EXCEPTION 'Authentication required' USING ERRCODE='42501'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.articles a JOIN public.article_categories c ON c.id=a.category_id WHERE a.id=p_article_id AND a.status='published' AND a.published_at<=now() AND c.is_active) THEN RAISE EXCEPTION 'Article unavailable' USING ERRCODE='P0002'; END IF;
 INSERT INTO public.article_read_history(user_id,article_id) VALUES(owner,p_article_id) ON CONFLICT(user_id,article_id) DO UPDATE
 SET last_read_at=now(),read_count=least(public.article_read_history.read_count,2147483646)+1 WHERE public.article_read_history.last_read_at<now()-interval '10 minutes';
END $$;
REVOKE ALL ON FUNCTION private.record_article_read(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION private.record_article_read(uuid) TO authenticated;
CREATE FUNCTION public.record_article_read(p_article_id uuid) RETURNS void LANGUAGE sql SECURITY INVOKER SET search_path='' AS $$SELECT private.record_article_read(p_article_id)$$;

-- Lists return summaries only, after a bounded page is selected. Personalization
-- uses only this caller's explicit interests/bookmarks/reading, never health data.
CREATE FUNCTION public.article_feed(p_language text DEFAULT 'vi',p_query text DEFAULT '',p_category uuid DEFAULT NULL,p_mode text DEFAULT 'latest',p_offset integer DEFAULT 0,p_limit integer DEFAULT 12,p_status text DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY INVOKER SET search_path='' AS $$
DECLARE result jsonb; fts tsquery;
BEGIN
 IF p_language NOT IN ('vi','en') OR length(coalesce(p_query,''))>160 OR p_offset IS NULL OR p_offset<0 OR p_limit IS NULL OR p_limit NOT BETWEEN 1 AND 30 OR p_mode NOT IN ('latest','featured','recommended','bookmarks','history','admin') THEN RAISE EXCEPTION 'Invalid article query' USING ERRCODE='22023'; END IF;
 IF p_mode='admin' AND NOT private.is_article_admin() THEN RAISE EXCEPTION 'Admin required' USING ERRCODE='42501'; END IF;
 IF trim(coalesce(p_query,''))<>'' THEN fts:=plainto_tsquery('simple'::regconfig,private.article_fold(p_query)); END IF;
 WITH matches AS MATERIALIZED (
  SELECT a.id,a.slug,a.cover_image_path,a.status,a.is_featured,a.published_at,a.updated_at,
   tr.language,tr.title,tr.summary,tr.reading_time_minutes,
   jsonb_build_object('id',c.id,'slug',c.slug,'name_vi',c.name_vi,'name_en',c.name_en,'icon',c.icon) AS category,
   EXISTS(SELECT 1 FROM public.article_bookmarks b WHERE b.user_id=(SELECT auth.uid()) AND b.article_id=a.id) AS is_bookmarked,
   h.last_read_at,
   CASE WHEN EXISTS(SELECT 1 FROM public.article_category_preferences p WHERE p.user_id=(SELECT auth.uid()) AND p.category_id=a.category_id) THEN 'interest'
    WHEN EXISTS(SELECT 1 FROM public.article_bookmarks b JOIN public.articles ba ON ba.id=b.article_id WHERE b.user_id=(SELECT auth.uid()) AND ba.category_id=a.category_id) THEN 'saved'
    WHEN EXISTS(SELECT 1 FROM public.article_read_history r JOIN public.articles ra ON ra.id=r.article_id WHERE r.user_id=(SELECT auth.uid()) AND ra.category_id=a.category_id) THEN 'reading' ELSE 'new' END AS reason,
   CASE WHEN fts IS NULL THEN 0 ELSE ts_rank(tr.search_document,fts) END AS relevance
  FROM public.articles a JOIN public.article_categories c ON c.id=a.category_id
  LEFT JOIN public.article_read_history h ON h.article_id=a.id AND h.user_id=(SELECT auth.uid())
  LEFT JOIN LATERAL(SELECT t.* FROM public.article_translations t WHERE t.article_id=a.id ORDER BY (t.language=p_language) DESC,t.language DESC LIMIT 1) tr ON true
  WHERE (p_mode='admin' OR (a.status='published' AND a.published_at<=now() AND c.is_active)) AND (p_category IS NULL OR a.category_id=p_category)
   AND (p_status IS NULL OR a.status=p_status) AND (p_mode<>'featured' OR a.is_featured)
   AND (p_mode<>'bookmarks' OR EXISTS(SELECT 1 FROM public.article_bookmarks b WHERE b.user_id=(SELECT auth.uid()) AND b.article_id=a.id))
   AND (p_mode<>'history' OR h.article_id IS NOT NULL)
   AND (fts IS NULL OR EXISTS(SELECT 1 FROM public.article_translations st WHERE st.article_id=a.id AND st.search_document @@ fts))
 ), page AS (
  SELECT to_jsonb(m)-'relevance' AS item FROM matches m
  ORDER BY CASE WHEN p_mode='recommended' THEN CASE reason WHEN 'interest' THEN 0 WHEN 'saved' THEN 1 WHEN 'reading' THEN 2 ELSE 3 END ELSE 0 END,
   CASE WHEN p_mode='recommended' THEN (last_read_at IS NOT NULL)::integer ELSE 0 END,
   relevance DESC,CASE WHEN p_mode='history' THEN last_read_at WHEN p_mode='admin' THEN updated_at ELSE published_at END DESC,id
  OFFSET p_offset LIMIT p_limit
 ) SELECT jsonb_build_object('data',coalesce((SELECT jsonb_agg(item) FROM page),'[]'::jsonb),'total',(SELECT count(*) FROM matches)) INTO result;
 RETURN result;
END $$;
CREATE FUNCTION public.get_article(p_id uuid,p_language text DEFAULT 'vi') RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY INVOKER SET search_path='' AS $$
DECLARE result jsonb;
BEGIN
 IF p_language NOT IN ('vi','en') THEN RAISE EXCEPTION 'Invalid language' USING ERRCODE='22023'; END IF;
 SELECT to_jsonb(a)||jsonb_build_object('category',to_jsonb(c),'translation',
  (SELECT to_jsonb(t)-'search_document' FROM public.article_translations t WHERE t.article_id=a.id ORDER BY (language=p_language) DESC,language DESC LIMIT 1),
  'is_bookmarked',EXISTS(SELECT 1 FROM public.article_bookmarks b WHERE b.user_id=(SELECT auth.uid()) AND b.article_id=a.id))
 INTO result FROM public.articles a JOIN public.article_categories c ON c.id=a.category_id WHERE a.id=p_id;
 RETURN result;
END $$;
CREATE FUNCTION public.article_admin_stats() RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY INVOKER SET search_path='' AS $$
BEGIN
 IF NOT private.is_article_admin() THEN RAISE EXCEPTION 'Admin required' USING ERRCODE='42501'; END IF;
 RETURN (SELECT jsonb_build_object('total',count(*),'published',count(*) FILTER(WHERE status='published'),'draft',count(*) FILTER(WHERE status='draft'),'archived',count(*) FILTER(WHERE status='archived')) FROM public.articles);
END $$;

-- Only short-lived signed URLs may be created for published, referenced images.
INSERT INTO storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
 VALUES('article-images','article-images',false,5242880,ARRAY['image/jpeg','image/png','image/webp']) ON CONFLICT(id) DO NOTHING;
CREATE FUNCTION private.article_image_readable(object_path text) RETURNS boolean LANGUAGE sql STABLE SECURITY INVOKER SET search_path='' AS $$
 SELECT private.is_article_admin() OR EXISTS(SELECT 1 FROM public.articles a WHERE a.status='published' AND a.published_at<=now() AND
  (a.cover_image_path=object_path OR EXISTS(SELECT 1 FROM public.article_translations t WHERE t.article_id=a.id AND strpos(t.content,'](article-image:'||object_path||')')>0)))
$$;
CREATE POLICY article_images_read ON storage.objects FOR SELECT TO authenticated USING(bucket_id='article-images' AND private.article_image_readable(name));
CREATE POLICY article_images_insert ON storage.objects FOR INSERT TO authenticated WITH CHECK(bucket_id='article-images' AND (SELECT private.is_article_admin())
 AND name ~ ('^'||(SELECT auth.uid())::text||'/[0-9a-f-]{36}/[0-9a-f-]{36}\.(jpg|png|webp)$')
 AND EXISTS(SELECT 1 FROM public.articles a WHERE a.id::text=split_part(name,'/',2)));
CREATE POLICY article_images_update ON storage.objects FOR UPDATE TO authenticated USING(bucket_id='article-images' AND (SELECT private.is_article_admin()) AND split_part(name,'/',1)=(SELECT auth.uid())::text)
 WITH CHECK(bucket_id='article-images' AND (SELECT private.is_article_admin()) AND name ~ ('^'||(SELECT auth.uid())::text||'/[0-9a-f-]{36}/[0-9a-f-]{36}\.(jpg|png|webp)$'));
CREATE POLICY article_images_delete ON storage.objects FOR DELETE TO authenticated USING(bucket_id='article-images' AND (SELECT private.is_article_admin()) AND split_part(name,'/',1)=(SELECT auth.uid())::text);

REVOKE ALL ON FUNCTION private.article_fold(text),private.article_references_valid(jsonb),private.article_image_readable(text),private.article_touch(),private.validate_article_publication() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION private.article_fold(text),private.article_references_valid(jsonb),private.article_image_readable(text) TO anon,authenticated;
REVOKE ALL ON FUNCTION public.article_feed(text,text,uuid,text,integer,integer,text),public.get_article(uuid,text),public.save_article(uuid,timestamptz,jsonb,jsonb),public.record_article_read(uuid),public.article_admin_stats() FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.article_feed(text,text,uuid,text,integer,integer,text),public.get_article(uuid,text),public.save_article(uuid,timestamptz,jsonb,jsonb),public.record_article_read(uuid),public.article_admin_stats() TO authenticated;
