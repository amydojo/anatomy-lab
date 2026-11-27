"""Comparison board: composed exclusively from actual matched rendered images."""
from PIL import Image,ImageDraw,ImageFont
from pathlib import Path
import json,sys
root=Path(sys.argv[1]);out=Path(sys.argv[2]);out.mkdir(parents=True,exist_ok=True)
codes=[('C01','LANCET'),('C02','SERPENT'),('C03','SWITCH')]
canvas=Image.new('RGB',(1800,1600),'#e5e3df');d=ImageDraw.Draw(canvas)
font='/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf'
def ft(n):return ImageFont.truetype(font,n)
d.text((44,30),'HAIRPIN / COUTURE 001.1',font=ft(42),fill='#181c23')
d.text((45,87),'FIRST REVEAL    /    MATCHED CAMERA & LIGHTING    /    UNQUALIFIED WEARABLE STUDIES',font=ft(22),fill='#464a50')
for i,(code,name) in enumerate(codes):
    x=44+i*576
    e=json.loads((root/('audit-'+code)/(code+'-reopen.json')).read_text())
    d.text((x,143),code+' / '+name,font=ft(29),fill='#181c23')
    dims=' × '.join(f'{v:.1f}' for v in e['bounds_mm'])
    d.text((x,182),dims+' mm · evaluated bounds',font=ft(18),fill='#464a50')
    for j,label in enumerate(('hero','top','side','detail')):
        im=Image.open(root/('render-'+code)/(code+'-'+label+'.png')).convert('RGB')
        im.thumbnail((550,308),Image.Resampling.LANCZOS)
        y=220+j*323
        canvas.paste(im,(x+(550-im.width)//2,y))
        d.text((x,y+289),label.upper(),font=ft(17),fill='#181c23')
    d.text((x,1518),'Surface overlaps: '+str(len(e['surface_intersections']))+' component pairs',font=ft(17),fill='#181c23')
d.text((44,1565),'No attachment, fit, comfort or mechanical qualification is implied. Detail views are enlarged.',font=ft(18),fill='#464a50')
canvas.save(out/'FIRST-REVEAL-comparison.png')
