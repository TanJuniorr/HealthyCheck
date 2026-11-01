-- Retain every existing article and image. Replacement uploads always use a new
-- object name; references are removed only by an explicit successful article save.
CREATE FUNCTION private.article_image_unreferenced(object_path text)
RETURNS boolean LANGUAGE sql STABLE SECURITY INVOKER SET search_path='' AS $$
 SELECT private.is_article_admin()
  AND NOT EXISTS(SELECT 1 FROM public.articles a WHERE a.cover_image_path=object_path)
  AND NOT EXISTS(SELECT 1 FROM public.article_translations t
   WHERE strpos(t.content,'](article-image:'||object_path||')')>0)
$$;
REVOKE ALL ON FUNCTION private.article_image_unreferenced(text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION private.article_image_unreferenced(text) TO authenticated;

-- Restrictive policies also protect against any other permissive Storage policy.
-- Covers and inline images in all statuses (including drafts) must remain intact.
CREATE POLICY article_images_keep_referenced_delete ON storage.objects
 AS RESTRICTIVE FOR DELETE TO authenticated
 USING(bucket_id<>'article-images' OR private.article_image_unreferenced(name));
CREATE POLICY article_images_keep_referenced_update ON storage.objects
 AS RESTRICTIVE FOR UPDATE TO authenticated
 USING(bucket_id<>'article-images' OR private.article_image_unreferenced(name))
 WITH CHECK(bucket_id<>'article-images' OR private.article_image_unreferenced(name));
