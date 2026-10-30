"""Download reviewed, licensed cover images and record content hashes for import.

The CDN produces the 1200 x 675 editorial crop. Original photo pages and credits
are kept in the manifest; the importer refuses changed bytes or existing covers.
"""
import concurrent.futures
import hashlib
import io
import json
from pathlib import Path
import urllib.request
from PIL import Image, ImageDraw

ROOT=Path(__file__).resolve().parents[2]
MANIFEST=ROOT/'supabase/seeds/article-covers.json'
ASSETS=ROOT/'supabase/seeds/article-covers'

def download(cover):
    url=f"https://images.pexels.com/photos/{cover['photo_id']}/pexels-photo-{cover['photo_id']}.jpeg?auto=compress&cs=tinysrgb&w=1200&h=675&fit=crop"
    request=urllib.request.Request(url,headers={'User-Agent':'Mozilla/5.0','Accept':'image/jpeg'})
    with urllib.request.urlopen(request,timeout=60) as response:
        assert response.headers.get_content_type()=='image/jpeg'
        data=response.read(5*1024*1024+1)
    assert data[:3]==b'\xff\xd8\xff' and len(data)<=5*1024*1024
    with Image.open(io.BytesIO(data)) as image:
        assert image.format=='JPEG' and image.size==(1200,675)
        image.verify()
    (ASSETS/(cover['slug']+'.jpg')).write_bytes(data)
    return dict(cover,image_url=url,sha256=hashlib.sha256(data).hexdigest(),bytes=len(data),width=1200,height=675)

def main():
    manifest=json.loads(MANIFEST.read_text(encoding='utf-8'))
    articles=json.loads((ROOT/'supabase/seeds/articles_vi.json').read_text(encoding='utf-8'))['articles']
    assert {c['slug'] for c in manifest['covers']}=={a['slug'] for a in articles}
    assert len({c['photo_id'] for c in manifest['covers']})==len(manifest['covers'])
    ASSETS.mkdir(parents=True,exist_ok=True)
    with concurrent.futures.ThreadPoolExecutor(max_workers=4) as pool:
        manifest['covers']=list(pool.map(download,manifest['covers']))
    MANIFEST.write_text(json.dumps(manifest,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
    # Inspection sheet only; never used as an article image.
    sheet=Image.new('RGB',(1280,5*210),'#f2f6f4');draw=ImageDraw.Draw(sheet)
    for i,cover in enumerate(manifest['covers']):
        with Image.open(ASSETS/(cover['slug']+'.jpg')) as image:
            image.thumbnail((312,176));x=(i%4)*320;y=(i//4)*210
            sheet.paste(image,(x,y));draw.text((x+5,y+180),f"{i+1}. {cover['photo_id']}",fill='#172e29')
    temp=ROOT/'frontend/.expo/article-covers-work';temp.mkdir(parents=True,exist_ok=True)
    sheet.save(temp/'contact-sheet.jpg',quality=90)
    print(f"Verified {len(manifest['covers'])} distinct JPEGs; total {sum(c['bytes'] for c in manifest['covers'])} bytes.")

if __name__=='__main__':main()
