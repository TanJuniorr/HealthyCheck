-- Keep article covers and inline images available while any article references them.
-- The admin editor can remove an object after removing every reference from the
-- article rows; a BEFORE trigger protects references across all article states.
CREATE OR REPLACE FUNCTION private.protect_referenced_article_images()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF OLD.bucket_id = 'article-images' AND EXISTS (
    SELECT 1
    FROM public.articles a
    WHERE a.cover_image_path = OLD.name
    UNION ALL
    SELECT 1
    FROM public.article_translations t
    WHERE strpos(t.content, '](article-image:' || OLD.name || ')') > 0
  ) THEN
    -- Silently skip the object mutation so Supabase Storage returns no changed
    -- row; the client maps that result to its existing cms.imageInUse message.
    RETURN NULL;
  END IF;

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION private.protect_referenced_article_images() FROM PUBLIC, anon, authenticated;

CREATE TRIGGER protect_referenced_article_images
BEFORE DELETE OR UPDATE OF name ON storage.objects
FOR EACH ROW
EXECUTE FUNCTION private.protect_referenced_article_images();
