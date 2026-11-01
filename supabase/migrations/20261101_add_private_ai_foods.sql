-- Allow users to add AI-estimated foods to their own catalogue without exposing
-- those entries to other accounts or changing the shared curated catalogue.
ALTER TABLE public.foods
  ADD COLUMN IF NOT EXISTS created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS foods_created_by_idx
  ON public.foods(created_by) WHERE created_by IS NOT NULL;

-- Restrictive policy keeps any older permissive catalogue policies from making
-- personal AI estimates visible to other users or anonymous clients.
DROP POLICY IF EXISTS foods_user_estimate_read_guard ON public.foods;
CREATE POLICY foods_user_estimate_read_guard
  ON public.foods AS RESTRICTIVE
  FOR SELECT TO anon, authenticated
  USING (
    (created_by IS NULL AND catalog_metadata->>'data_type' IS DISTINCT FROM 'user_ai_estimate')
    OR created_by = (SELECT auth.uid())
  );

GRANT INSERT (
  name, calories_per_100g, protein_per_100g, carbs_per_100g, fat_per_100g,
  category, serving_size, calories, protein_g, carbs_g, fat_g, catalog_metadata, created_by
) ON public.foods TO authenticated;

DROP POLICY IF EXISTS foods_user_estimate_insert ON public.foods;
CREATE POLICY foods_user_estimate_insert
  ON public.foods
  FOR INSERT TO authenticated
  WITH CHECK (
    created_by = (SELECT auth.uid())
    AND catalog_metadata->>'data_type' = 'user_ai_estimate'
    AND coalesce(catalog_metadata->>'source', '') = 'ai_food_scan'
    AND coalesce(catalog_metadata->>'selectable', 'false') = 'true'
  );

-- Also constrain inserts when an older permissive INSERT policy is present.
DROP POLICY IF EXISTS foods_user_estimate_insert_guard ON public.foods;
CREATE POLICY foods_user_estimate_insert_guard
  ON public.foods AS RESTRICTIVE
  FOR INSERT TO authenticated
  WITH CHECK (
    created_by = (SELECT auth.uid())
    AND catalog_metadata->>'data_type' = 'user_ai_estimate'
    AND coalesce(catalog_metadata->>'source', '') = 'ai_food_scan'
    AND coalesce(catalog_metadata->>'selectable', 'false') = 'true'
  );
