"""Run the approved one-time Storage import without exposing any server key.

Requires a deployed expiring import job and an ignored local token file.
python scripts/import-article-covers.py FUNCTION_URL TOKEN_FILE OUTPUT_FILE
"""
import argparse
import base64
import concurrent.futures
import hashlib
import json
from pathlib import Path
import urllib.error
import urllib.request

ROOT=Path(__file__).resolve().parents[2]

def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('url');parser.add_argument('token',type=Path);parser.add_argument('output',type=Path)
    args=parser.parse_args()
    assert args.url.startswith('https://')
    token=args.token.read_text(encoding='utf-8').strip()
    manifest=json.loads((ROOT/'supabase/seeds/article-covers.json').read_text(encoding='utf-8'))
    def upload(cover):
        data=(ROOT/'supabase/seeds/article-covers'/(cover['slug']+'.jpg')).read_bytes()
        assert hashlib.sha256(data).hexdigest()==cover['sha256']
        body=json.dumps({'slug':cover['slug'],'image_base64':base64.b64encode(data).decode('ascii')}).encode()
        request=urllib.request.Request(args.url,data=body,method='POST',headers={'Content-Type':'application/json','x-import-token':token})
        try:
            with urllib.request.urlopen(request,timeout=90) as response:return json.load(response)
        except urllib.error.HTTPError as error:
            return dict(slug=cover['slug'],http_status=error.code,error=error.read(1000).decode('utf-8','replace'))
    with concurrent.futures.ThreadPoolExecutor(max_workers=3) as pool:results=list(pool.map(upload,manifest['covers']))
    args.output.write_text(json.dumps(results,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
    for result in results:print(result['slug'],result.get('status',result.get('http_status','failed')))
    if any('error' in result for result in results):raise SystemExit(1)

if __name__=='__main__':main()
