-- Supply the nutrition journal on new projects only; leave existing tables and RLS intact.
DO $$ BEGIN
 IF to_regclass('public.meal_records') IS NULL THEN
  CREATE TABLE public.meal_records(
   id uuid PRIMARY KEY DEFAULT gen_random_uuid(),user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
   food_id uuid NOT NULL REFERENCES public.foods(id),meal_type text NOT NULL CHECK(meal_type IN ('breakfast','lunch','dinner','snack')),
   quantity_g numeric NOT NULL CHECK(quantity_g>0),consumed_at timestamptz NOT NULL DEFAULT now(),created_at timestamptz NOT NULL DEFAULT now());
  CREATE INDEX idx_meals_user_time ON public.meal_records(user_id,consumed_at DESC);
  ALTER TABLE public.meal_records ENABLE ROW LEVEL SECURITY;
  GRANT SELECT,INSERT,UPDATE,DELETE ON public.meal_records TO authenticated;
  CREATE POLICY meals_owner_select ON public.meal_records FOR SELECT TO authenticated USING((select auth.uid())=user_id);
  CREATE POLICY meals_owner_insert ON public.meal_records FOR INSERT TO authenticated WITH CHECK((select auth.uid())=user_id);
  CREATE POLICY meals_owner_update ON public.meal_records FOR UPDATE TO authenticated USING((select auth.uid())=user_id) WITH CHECK((select auth.uid())=user_id);
  CREATE POLICY meals_owner_delete ON public.meal_records FOR DELETE TO authenticated USING((select auth.uid())=user_id);
 END IF;
END $$;
-- Explicit legacy translations belong in the catalogue, never in UI code.
-- These labels do not attribute unverified legacy nutrient values to USDA.
WITH labels(name,name_en,group_key) AS (VALUES
 ('Bánh mì','Bread','grains'),('Cá hồi chín','Cooked salmon','meat'),('Cam','Orange','fruits'),('Chuối','Banana','fruits'),
 ('Cơm trắng','Cooked white rice','grains'),('Đậu hũ','Tofu','dairy_legumes'),('Hạnh nhân','Almonds','dairy_legumes'),
 ('Khoai lang luộc','Boiled sweet potato','grains'),('Rau cải luộc','Boiled mustard greens','vegetables'),
 ('Sữa chua không đường','Plain yogurt','dairy_legumes'),('Sữa tươi không đường','Unsweetened milk','dairy_legumes'),
 ('Táo','Apple','fruits'),('Trứng gà luộc','Boiled chicken egg','dairy_legumes'),('Ức gà chín','Cooked chicken breast','meat'),('Yến mạch khô','Dry oats','grains')
) UPDATE public.foods f SET catalog_metadata=coalesce(f.catalog_metadata,'{}'::jsonb)||jsonb_build_object(
 'base_unit','g','name_vi',coalesce(f.catalog_metadata->>'name_vi',f.name),'name_en',coalesce(f.catalog_metadata->>'name_en',labels.name_en),
 'group',coalesce(f.catalog_metadata->>'group',labels.group_key),'data_type',coalesce(f.catalog_metadata->>'data_type','legacy_unverified'))
FROM labels WHERE f.name=labels.name AND f.catalog_metadata->>'source_id' IS NULL;
