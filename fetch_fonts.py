from pathlib import Path
from urllib.request import Request, urlopen
import re

ROOT=Path(__file__).resolve().parent/'public/assets/fonts'
ROOT.mkdir(parents=True,exist_ok=True)
css_url='https://fonts.googleapis.com/css2?family=Manrope:wght@200..800&family=Source+Sans+3:wght@200..900&display=swap'
request=Request(css_url,headers={'User-Agent':'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36'})
with urlopen(request,timeout=45) as response:css=response.read().decode('utf-8')
faces={}
for block in re.findall(r'@font-face\s*\{(.*?)\}',css,re.S):
    if 'U+0000-00FF' not in block:continue
    family=re.search(r"font-family:\s*['\"]([^'\"]+)",block).group(1)
    font_url=re.search(r'url\((https://fonts\.gstatic\.com/[^)]+)\)',block).group(1)
    faces[family]=font_url
for folder,family,output in [('manrope','Manrope','Manrope'),
                            ('sourcesans3','Source Sans 3','SourceSans3')]:
    base=f'https://raw.githubusercontent.com/google/fonts/main/ofl/{folder}/'
    with urlopen(faces[family],timeout=45) as response:content=response.read()
    assert content[:4]==b'wOF2'
    (ROOT/(output+'.woff2')).write_bytes(content)
    with urlopen(base+'OFL.txt',timeout=30) as response:license_text=response.read()
    (ROOT/(output+'-OFL.txt')).write_bytes(license_text)
    print(output,(ROOT/(output+'.woff2')).stat().st_size,'bytes')
