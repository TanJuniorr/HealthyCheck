-- Supabase projects can grant ALL to API roles through default privileges.
-- RLS does not protect TRUNCATE: reset the new editorial tables to an explicit
-- allowlist, including on existing projects with these broader defaults.
REVOKE ALL ON public.user_roles,public.article_categories,public.articles,
 public.article_translations,public.article_bookmarks,public.article_read_history,
 public.article_category_preferences FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.user_roles TO anon,authenticated;
GRANT SELECT ON public.article_categories,public.articles,public.article_translations TO anon,authenticated;
GRANT INSERT,UPDATE,DELETE ON public.article_categories,public.articles,public.article_translations TO authenticated;
GRANT SELECT,INSERT,DELETE ON public.article_bookmarks,public.article_category_preferences TO authenticated;
GRANT SELECT ON public.article_read_history TO authenticated;
