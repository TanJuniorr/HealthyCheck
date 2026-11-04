-- Names and selection metadata only. The legacy boiled egg has rounded macros
-- (12.60/1.10/10.60 versus USDA 12.58/1.12/10.61), so it is NOT merged/deleted.
-- Every old ID, nutrient value, meal FK, quantity and timestamp stays untouched.
DO $normalization$
DECLARE
 before_nutrition jsonb;
 after_nutrition jsonb;
 verified_egg public.foods%ROWTYPE;
BEGIN
 LOCK TABLE public.foods IN SHARE ROW EXCLUSIVE MODE;
 SELECT jsonb_agg(jsonb_build_array(id,calories_per_100g,protein_per_100g,carbs_per_100g,fat_per_100g,calories,protein_g,carbs_g,fat_g) ORDER BY id)
 INTO before_nutrition FROM public.foods;

 SELECT * INTO verified_egg FROM public.foods WHERE catalog_metadata->>'source_id'='usda-sr:173424';
 IF NOT FOUND OR verified_egg.calories_per_100g IS DISTINCT FROM 155 OR verified_egg.protein_per_100g IS DISTINCT FROM 12.58
  OR verified_egg.carbs_per_100g IS DISTINCT FROM 1.12 OR verified_egg.fat_per_100g IS DISTINCT FROM 10.61
  OR verified_egg.catalog_metadata->>'name_en' IS DISTINCT FROM 'Egg, whole, cooked, hard-boiled'
  OR (verified_egg.catalog_metadata->>'unit_weight_g')::numeric IS DISTINCT FROM 50
  OR verified_egg.catalog_metadata->>'portion_source_id' IS DISTINCT FROM '92500' THEN
  RAISE EXCEPTION 'Expected verified USDA hard-boiled egg/edible portion is unavailable';
 END IF;

 WITH labels(source_id,name_vi,aliases) AS (VALUES
  ('usda-sr:173424','Trứng gà luộc','["Trứng gà luộc chín (phần ăn được)","Trứng gà luộc (phần ăn được)"]'::jsonb),
  ('usda-sr:171287','Trứng gà sống','["Trứng gà tươi sống (phần ăn được)"]'::jsonb),
  ('usda-sr:172189','Trứng vịt sống','["Trứng vịt tươi sống"]'::jsonb)
 )
 UPDATE public.foods f SET name=labels.name_vi,
  catalog_metadata=f.catalog_metadata || jsonb_build_object('name_vi',labels.name_vi,'edible_portion',true,'aliases',
   (SELECT jsonb_agg(alias ORDER BY alias) FROM (
    SELECT jsonb_array_elements_text(COALESCE(f.catalog_metadata->'aliases','[]'::jsonb)) AS alias
    UNION SELECT jsonb_array_elements_text(labels.aliases)
   ) names))
 FROM labels WHERE f.catalog_metadata->>'source_id'=labels.source_id;

 -- Retire the reviewed ambiguous legacy choice, while keeping it readable/editable in history.
 UPDATE public.foods SET catalog_metadata=COALESCE(catalog_metadata,'{}'::jsonb) ||
  jsonb_build_object('base_unit','g','selectable',false,'selection_source_id','usda-sr:173424')
 WHERE name IN ('Trứng gà luộc','Trứng gà luộc (phần ăn được)','Trứng gà luộc chín (phần ăn được)')
  AND catalog_metadata->>'source_id' IS NULL AND id<>verified_egg.id;

 SELECT jsonb_agg(jsonb_build_array(id,calories_per_100g,protein_per_100g,carbs_per_100g,fat_per_100g,calories,protein_g,carbs_g,fat_g) ORDER BY id)
 INTO after_nutrition FROM public.foods;
 IF before_nutrition IS DISTINCT FROM after_nutrition THEN
  RAISE EXCEPTION 'Food IDs/count/nutrient values changed; normalization rolled back';
 END IF;
END $normalization$;
