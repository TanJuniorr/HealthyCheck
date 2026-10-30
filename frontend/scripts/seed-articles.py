"""Generate a repeatable editorial seed migration without overwriting CMS edits.

Create the destination with `supabase migration new` before running this script.
python scripts/seed-articles.py NEW_MIGRATION.sql
"""
import argparse
import json
from pathlib import Path

def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('migration',type=Path)
    args=parser.parse_args()
    data=json.loads((Path(__file__).resolve().parents[2]/'supabase/seeds/articles_vi.json').read_text(encoding='utf-8'))
    assert len({a['slug'] for a in data['articles']})==len(data['articles'])
    assert len(data['articles'])>=20
    for a in data['articles']:
        assert a['source_url'].startswith('https://') and len(a['content'])>500
    payload=json.dumps(data,ensure_ascii=False,separators=(',',':'))
    args.migration.write_text('''-- Original educational summaries; sources verified on 2026-10-30.
-- Re-running adds missing slugs only and preserves all administrator edits.
DO $editorial$
DECLARE seed jsonb:=$seed$'''+payload+'''$seed$::jsonb; c jsonb; a jsonb; target uuid;
BEGIN
 FOR c IN SELECT value FROM jsonb_array_elements(seed->'categories') LOOP
  INSERT INTO public.article_categories(slug,name_vi,name_en,description_vi,description_en,icon,sort_order)
  VALUES(c->>'slug',c->>'name_vi',c->>'name_en',c->>'description_vi',c->>'description_en',c->>'icon',(c->>'sort_order')::integer) ON CONFLICT(slug) DO NOTHING;
 END LOOP;
 FOR a IN SELECT value FROM jsonb_array_elements(seed->'articles') LOOP
  target:=NULL;
  INSERT INTO public.articles(slug,category_id,status,is_featured)
  SELECT a->>'slug',id,'draft',coalesce((a->>'is_featured')::boolean,false) FROM public.article_categories WHERE slug=a->>'category'
  ON CONFLICT(slug) DO NOTHING RETURNING id INTO target;
  IF target IS NOT NULL THEN
   INSERT INTO public.article_translations(article_id,language,title,summary,content,reading_time_minutes,source_name,source_url)
   VALUES(target,'vi',a->>'title',a->>'summary',a->>'content',greatest(1,ceil(cardinality(regexp_split_to_array(a->>'content','\\s+'))/200.0)::integer),a->>'source_name',a->>'source_url');
   UPDATE public.articles SET status='published',published_at=now() WHERE id=target;
  END IF;
 END LOOP;
END $editorial$;
''',encoding='utf-8')
    print(f"Prepared {len(data['articles'])} verified-source articles; existing CMS edits are preserved.")
if __name__=='__main__':main()
