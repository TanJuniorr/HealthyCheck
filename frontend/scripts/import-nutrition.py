"""Import the reviewed manifest from the official CC0 USDA SR Legacy archive.

python scripts/import-nutrition.py SOURCE.zip NEW_MIGRATION.sql
Create NEW_MIGRATION.sql with `supabase migration new` first. Existing values are
never overwritten; a source revision that changes nutrients requires review.
"""
import argparse
import csv
from decimal import Decimal
import hashlib
import io
import json
from pathlib import Path
import unicodedata
import zipfile

ARCHIVE_SHA256 = 'b80817294b8850530aaedf2e515c02593b1824f763a0ff356e5c2081643e6fd0'
SOURCE_URL = 'https://fdc.nal.usda.gov/fdc-datasets/FoodData_Central_sr_legacy_food_csv_2018-04.zip'
PORTIONS = {'173944':('93515','fruit','quả cỡ vừa'), '171688':('89193','fruit','quả cỡ vừa'),
 '169097':('84230','fruit','quả theo mẫu USDA'), '169105':('84249','fruit','quả cỡ vừa'),
 '171287':('88374','egg','quả cỡ lớn'), '173424':('92500','egg','quả cỡ lớn'),
 '172189':('90055','egg','quả theo mẫu USDA'), '172191':('90057','egg','quả theo mẫu USDA'),
 '172688':('91108','slice','lát bánh mì'), '172818':('91475','slice','lát bánh mì')}

def fold(value):
    return ''.join(c for c in unicodedata.normalize('NFD',value.lower()) if not '\u0300' <= c <= '\u036f').replace('đ','d')

def build_catalogue(archive, manifest):
    assert hashlib.sha256(archive.read_bytes()).hexdigest() == ARCHIVE_SHA256, 'Unexpected USDA archive revision'
    assert len({f['fdc_id'] for f in manifest}) == len(manifest)
    assert len({fold(f['name_vi']) for f in manifest}) == len(manifest), 'Duplicate natural food names'
    z=zipfile.ZipFile(archive)
    def rows(name):
        entry=next(n for n in z.namelist() if n.endswith('/'+name))
        return csv.DictReader(io.TextIOWrapper(z.open(entry),encoding='utf-8-sig'))
    foods={r['fdc_id']:r for r in rows('food.csv')}
    definitions={r['id']:r for r in rows('nutrient.csv')}
    assert [(definitions[i]['name'],definitions[i]['unit_name']) for i in ['1008','1003','1005','1004']] == [('Energy','KCAL'),('Protein','G'),('Carbohydrate, by difference','G'),('Total lipid (fat)','G')]
    derivations={r['id']:r for r in rows('food_nutrient_derivation.csv')}
    ids={f['fdc_id'] for f in manifest}; nutrients={i:{} for i in ids}
    for row in rows('food_nutrient.csv'):
        if row['fdc_id'] in ids and row['nutrient_id'] in ['1008','1003','1005','1004']:
            assert row['amount'] != '', ('Missing nutrient',row['fdc_id'],row['nutrient_id'])
            nutrients[row['fdc_id']][row['nutrient_id']]=row
    portions={r['fdc_id']:r for r in rows('food_portion.csv') if any(r['id']==p[0] for p in PORTIONS.values())}
    seed=[]
    for item in manifest:
        fid=item['fdc_id'];description=foods[fid]['description'];values=nutrients[fid]
        assert description==item['name_en'], ('Source description changed',fid)
        assert set(values)=={'1008','1003','1005','1004'}, ('Incomplete macros',fid,set(values))
        state=item['preparation_state']
        aliases=sorted(set(item.get('aliases',[])))
        metadata=dict(name_vi=item['name_vi'],name_en=description,aliases=aliases,group=item['group'],
            source='USDA SR Legacy 2018',source_id='usda-sr:'+fid,source_url='https://fdc.nal.usda.gov/food-details/'+fid+'/nutrients',
            source_description=description,source_license='CC0-1.0',source_license_url='https://fdc.nal.usda.gov/api-guide/#licensing',
            data_type='reference_database',preparation_state=state,base_unit='g',edible_portion=True,
            canonical_key='usda-sr:'+fid,selection_key=fold(item['name_vi'])+'|'+state,
            nutrient_derivations={key:{'code':derivations.get(r['derivation_id'],{}).get('code'),
              'description':derivations.get(r['derivation_id'],{}).get('description'),'source_derivation_id':r['derivation_id'] or None}
              for key,r in values.items()})
        if state=='cooked':
            metadata['cooked_weight_basis']=True
            method='boiled' if 'boiled' in description.lower() else 'steamed' if 'steamed' in description.lower() else 'simmered' if 'simmered' in description.lower() else 'braised' if 'braised' in description.lower() else 'roasted' if 'roasted' in description.lower() else 'dry_heat' if 'dry heat' in description.lower() else 'moist_heat' if 'moist heat' in description.lower() else 'cooked'
            metadata['reference_method']=method
        if item['group']=='prepared':metadata['recipe_reference']=True
        if fid in PORTIONS:
            p=portions[fid];pid,kind,vi=PORTIONS[fid]
            assert p['id']==pid and Decimal(p['amount'])>0 and Decimal(p['gram_weight'])>0
            metadata.update(unit_weight_g=float(Decimal(p['gram_weight'])/Decimal(p['amount'])),unit_kind=kind,
                unit_description=p['modifier'],unit_description_vi=vi,portion_source_id=pid)
        macros={}
        for column,nutrient in [('calories','1008'),('protein','1003'),('carbs','1005'),('fat','1004')]:
            amount=Decimal(values[nutrient]['amount'])
            assert amount.is_finite() and amount>=0
            assert amount==amount.quantize(Decimal('.01')), ('Source needs more database precision',fid,column)
            macros[column+'_per_100g']=float(amount)
        seed.append(dict(name=item['name_vi'],category=item['group'],serving_size='100 g',**macros,catalog_metadata=metadata))
    return seed

def migration_sql(seed):
    payload=json.dumps(seed,ensure_ascii=False,separators=(',',':'))
    return '''-- Reproducible CC0 USDA reference data; IDs and historical nutrient values are immutable.
DO $catalogue$
DECLARE old_values jsonb;new_values jsonb;
BEGIN
 LOCK TABLE public.foods IN SHARE ROW EXCLUSIVE MODE;
 SELECT jsonb_object_agg(id::text,jsonb_build_array(calories_per_100g,protein_per_100g,carbs_per_100g,fat_per_100g,calories,protein_g,carbs_g,fat_g)) INTO old_values FROM public.foods;
 CREATE TEMP TABLE incoming_foods ON COMMIT DROP AS
 SELECT * FROM jsonb_to_recordset($usda$'''+payload+'''$usda$::jsonb) AS s(name text,category text,serving_size text,calories_per_100g numeric,protein_per_100g numeric,carbs_per_100g numeric,fat_per_100g numeric,catalog_metadata jsonb);
 IF EXISTS (SELECT 1 FROM incoming_foods s JOIN public.foods f ON f.catalog_metadata->>'source_id'=s.catalog_metadata->>'source_id'
  WHERE (f.calories_per_100g,f.protein_per_100g,f.carbs_per_100g,f.fat_per_100g) IS DISTINCT FROM (s.calories_per_100g,s.protein_per_100g,s.carbs_per_100g,s.fat_per_100g)) THEN
  RAISE EXCEPTION 'Nutrient revision needs manual review; history has not been changed';
 END IF;
 INSERT INTO public.foods(name,category,serving_size,calories_per_100g,protein_per_100g,carbs_per_100g,fat_per_100g,catalog_metadata)
 SELECT name,category,serving_size,calories_per_100g,protein_per_100g,carbs_per_100g,fat_per_100g,catalog_metadata FROM incoming_foods
 ON CONFLICT ((catalog_metadata->>'source_id')) WHERE catalog_metadata->>'source_id' IS NOT NULL DO UPDATE
 SET name=excluded.name,category=excluded.category,serving_size=excluded.serving_size,
  catalog_metadata=public.foods.catalog_metadata || excluded.catalog_metadata || jsonb_build_object('aliases',(
   SELECT coalesce(jsonb_agg(alias ORDER BY alias),'[]'::jsonb) FROM (
    SELECT jsonb_array_elements_text(coalesce(public.foods.catalog_metadata->'aliases','[]'::jsonb)) alias
    UNION SELECT jsonb_array_elements_text(excluded.catalog_metadata->'aliases')
    UNION SELECT public.foods.name WHERE public.foods.name<>excluded.name
   ) names));
 -- Legacy alternatives are retired only when their exact reviewed values and names match.
 -- They remain readable through their original IDs; no meal FK or nutrition is rewritten.
 WITH legacy(name,target,kcal,protein,carbs,fat) AS (VALUES
  ('Cá hồi chín','usda-sr:175168',206,22.1,0,12.4),('Cam','usda-sr:169097',47,.9,11.8,.1),
  ('Chuối','usda-sr:173944',89,1.1,22.8,.3),('Cơm trắng','usda-sr:168878',130,2.7,28,.3),
  ('Đậu hũ','usda-sr:172476',76,8,1.9,4.8),('Hạnh nhân','usda-sr:170567',579,21.2,21.6,49.9),
  ('Khoai lang luộc','usda-sr:168484',86,1.6,20.1,.1),('Sữa chua không đường','usda-sr:171284',61,3.5,4.7,3.3),
  ('Sữa tươi không đường','usda-sr:171267',50,3.3,4.8,2),('Táo','usda-sr:171688',52,.3,13.8,.2),
  ('Trứng gà luộc','usda-sr:173424',155,12.6,1.1,10.6),('Ức gà chín','usda-sr:171477',165,31,0,3.6)
 ) UPDATE public.foods f SET catalog_metadata=coalesce(f.catalog_metadata,'{}'::jsonb)||jsonb_build_object('base_unit','g','selectable',false,'selection_source_id',legacy.target,'data_type','legacy_unverified')
 FROM legacy WHERE f.name=legacy.name AND f.catalog_metadata->>'source_id' IS NULL
  AND (f.calories_per_100g,f.protein_per_100g,f.carbs_per_100g,f.fat_per_100g)=(legacy.kcal,legacy.protein,legacy.carbs,legacy.fat)
  AND EXISTS(SELECT 1 FROM public.foods verified WHERE verified.catalog_metadata->>'source_id'=legacy.target);
 SELECT jsonb_object_agg(f.id::text,jsonb_build_array(f.calories_per_100g,f.protein_per_100g,f.carbs_per_100g,f.fat_per_100g,f.calories,f.protein_g,f.carbs_g,f.fat_g)) INTO new_values FROM public.foods f WHERE old_values ? f.id::text;
 IF old_values IS DISTINCT FROM new_values THEN RAISE EXCEPTION 'Historical food IDs/nutrients changed; import rolled back'; END IF;
END $catalogue$;
CREATE UNIQUE INDEX IF NOT EXISTS foods_selection_key_unique ON public.foods((catalog_metadata->>'selection_key'))
 WHERE coalesce(catalog_metadata->>'selectable','true')<>'false' AND catalog_metadata->>'selection_key' IS NOT NULL;
'''

def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('archive',type=Path);parser.add_argument('migration',type=Path)
    args=parser.parse_args();root=Path(__file__).resolve().parents[2]
    manifest=json.loads(Path(__file__).with_name('nutrition-foods.json').read_text(encoding='utf-8-sig'))
    seed=build_catalogue(args.archive,manifest)
    (root/'supabase/seeds').mkdir(parents=True,exist_ok=True)
    (root/'supabase/seeds/nutrition_usda.json').write_text(json.dumps(dict(source_url=SOURCE_URL,license='CC0-1.0',archive_sha256=ARCHIVE_SHA256,foods=seed),ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
    args.migration.write_text(migration_sql(seed),encoding='utf-8')
    print(f'Verified {len(seed)} complete source records; no missing nutrient was replaced with zero.')
if __name__=='__main__':main()
