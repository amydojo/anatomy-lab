#!/usr/bin/env python3
"""Acquire exact indexed source derivatives, never resample/reposition individual anatomy."""
import hashlib,json,struct,math,re,urllib.request,urllib.error,csv
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
DIR=ROOT/'assets/atlas/morphology/acquired'
LOCK=json.loads((ROOT/'assets/atlas/morphology/source-lock.json').read_text())
DIR.mkdir(parents=True,exist_ok=True)
for old in DIR.glob('*.bin'):old.unlink()
def sha(b):return hashlib.sha256(b).hexdigest()
def gitsha(b):return hashlib.sha1(b'blob '+str(len(b)).encode()+b'\0'+b).hexdigest()
def fetch(repo,rev,path,expect=None,digest=None,size=None):
 url=f'https://raw.githubusercontent.com/{repo}/{rev}/{path}'
 with urllib.request.urlopen(urllib.request.Request(url,headers={'User-Agent':'BODY-LIVE-MORPHOLOGY/1'}),timeout=120) as f:b=f.read(30*1024*1024)
 if (expect and gitsha(b)!=expect) or (digest and sha(b)!=digest) or (size is not None and len(b)!=size):raise ValueError('source integrity '+path)
 return b
def read_bp(name):
 x=LOCK['files'][name];return fetch(LOCK['repo'],LOCK['revision'],'public/models/'+name,x['gitBlob'],x['sha256'],x['bytes'])
# Names define conservative regional membership; no fabricated depth, attachment or laterality.
PATTERNS={
 'head-neck':r'cranial|skull|cranium|frontal bone|occipital|parietal|temporal bone|sphenoid|ethmoid|maxilla|mandible|zygomatic|nasal|lacrimal|palatine|vomer|concha|hyoid|cervical vertebra|^atlas$|^axis$|sternocleidomastoid|platysma|scalen|splenius|longus capitis|longus colli|rectus capitis|obliquus capitis|mylohyoid|geniohyoid|digastric|stylohyoid|omohyoid|sternohyoid|sternothyroid|thyrohyoid|masseter|temporalis|pterygoid|orbicularis|buccinator|frontalis|zygomaticus|rectus (muscle|of eye)|inferior rectus|superior rectus|medial rectus|lateral rectus|inferior oblique|superior oblique|eyeball|lens of eye|cornea|sclera|retina|optic nerve|brain|cerebr|cerebell|pons|medulla oblongata|trachea|larynx|thyroid cartilage|cricoid|arytenoid|auricle|external ear|carotid|jugular|intervertebral disc',
 'thorax-shoulder':r'\brib\b|sternum|manubrium|xiphoid|thoracic vertebra|costal cartilage|intercostal|pectoralis|serratus|diaphragm|latissimus|trapezius|rhomboid|levator scapula|scapula|clavicle|deltoid|supraspinatus|infraspinatus|teres major|teres minor|subscapularis|glenoid|acromioclavicular|glenohumeral|lung|bronch|heart|aorta|vena cava|thoracic duct',
 'arms-hands':r'humerus|radius|ulna|scaphoid|lunate|triquetr|pisiform|trapezium|trapezoid|capitate|hamate|metacarpal|phal(anx|anges)|biceps brachii|triceps brachii|brachialis|brachioradialis|pronator|supinator|flexor carpi|extensor carpi|flexor digitorum|extensor digitorum|palmaris|pollicis|indicis|digiti minimi|lumbrical|interosse|anconeus|radial collateral ligament|ulnar collateral ligament|annular ligament|carpal|brachial artery|radial artery|ulnar artery|median nerve|ulnar nerve|radial nerve'
}
def region(p):
 name=p['name'].lower()
 if re.search(r'extensor digitorum longus|flexor digitorum (longus|brevis)|abdominal aorta|^descending aorta$|cerebral aqueduct',name):return None
 if 'retinaculum' in name and 'wrist' in name:return 'arms-hands'
 if 'levator palpebrae' in name or 'intervertebral disk of axis' in name or 'tentorium cerebelli' in name:return 'head-neck'
 if re.search(r'\b(foot|toe|hallucis|pedis|tibial|fibular|femoral|plantar)\b',name):return None
 # ambiguous phalanges/interossei/lumbricals require hand-specific context.
 if re.search(r'phal(anx|anges)|interosse|lumbrical',name) and not re.search(r'hand|finger|thumb|palmar|dorsal interosse|manual',name):return None
 return next((k for k,v in PATTERNS.items() if re.search(v,name,re.I)),None)
def tissue(p):
 n=p['name'].lower();s=p.get('system','').lower()
 if re.search(r'intervertebral dis[ck]|tentorium cerebelli',n):return 'connective'
 if re.search(r'\b(subscapularis|levator scapulae)\b',n):return 'muscle'
 if 'cartilage' in n:return 'cartilage'
 if 'tendon' in n:return 'tendon'
 if 'ligament' in n:return 'ligament'
 if re.search(r'fascia|aponeurosis|retinaculum',n):return 'connective'
 if re.search(r'\bskin\b',n):return 'skin'
 if re.search(r'artery|arterial|aorta',n):return 'artery'
 if re.search(r'\bvein\b|venous|vena cava|jugular vein',n):return 'vein'
 if 'nerve' in n:return 'nerve'
 if re.search(r'brain|cerebr|cerebell|pons|medulla oblongata|eyeball|lens of eye|cornea|sclera|retina|lung|bronch|heart|trachea|larynx|auricle|external ear|thoracic duct',n):return 'organ'
 if s in ('muscular','muscle'):return 'muscle'
 if s in ('skeletal','bone') and not re.search(r'joint|disc|muscle|head of|part of',n):return 'bone'
 if 'intervertebral disc' in n:return 'connective'
 return None
def exact(raw,p):
 v,i=int(p['vertexCount']),int(p['indexCount']);vo,io=int(p['positions']),int(p['indices'])
 if v<3 or i<3 or i%3 or min(vo,io)<0 or vo+12*v>len(raw) or io+4*i>len(raw):raise ValueError('invalid offset '+p['name'])
 pos=raw[vo:vo+12*v];idx=raw[io:io+4*i];pts=list(struct.iter_unpack('<fff',pos))
 if not all(math.isfinite(x) for q in pts for x in q) or any(x[0]>=v for x in struct.iter_unpack('<I',idx)):raise ValueError('invalid mesh '+p['name'])
 return pos,idx,[[min(q[k] for q in pts) for k in range(3)],[max(q[k] for q in pts) for k in range(3)]]
packs={};specimens=[];inputs={};inventory=[]
def emit(key,items,raws,revision,license,attribution,frame):
 data=bytearray();parts=[]
 for p,t in items:
  pos,idx,bounds=exact(raws[p.get('chunk',0)],p)
  entry={'id':str(p['conceptId']).lower(),'name':p['name'],'tissue':t,'sourceSystem':p.get('system'),'positions':len(data),'vertexCount':p['vertexCount'],'indexCount':p['indexCount'],'bounds':bounds,'geometrySha256':sha(pos+idx),'sourceChunk':p.get('chunk',0)}
  data.extend(pos);entry['indices']=len(data);data.extend(idx);parts.append(entry)
 if not parts:return
 if len(data)>16*1024*1024:raise ValueError('pack exceeds 16 MiB '+key)
 file=key+'.bin';(DIR/file).write_bytes(data)
 packs[key]={'url':'/assets/atlas/morphology/acquired/'+file,'format':'indexed-bin','sha256':sha(data),'bytes':len(data),'revision':revision,'license':license,'attribution':attribution,'frame':frame,'parts':parts,'counts':{t:sum(p['tissue']==t for p in parts) for t in sorted({p['tissue'] for p in parts})},'triangles':sum(p['indexCount']//3 for p in parts)}
def main():
 raw=read_bp('atlas.json');atlas=json.loads(raw)
 if atlas['version']!='BodyParts3D 4.0':raise ValueError('wrong source')
 inputs['atlas.json']=sha(raw);groups={};seen=set()
 for p in atlas['parts']:
  reg,t=region(p),tissue(p);id=str(p['conceptId']).lower();chosen=bool(reg and t and id not in seen)
  inventory.append({'name':p['name'],'id':id,'system':p.get('system'),'chunk':p.get('chunk'),'vertices':p['vertexCount'],'triangles':p['indexCount']//3,'region':reg,'tissue':t,'selected':chosen})
  if chosen:seen.add(id);groups.setdefault((reg,t),[]).append((p,t))
 chunks={k:read_bp(f'body-{k}.bin') for k in sorted({p['chunk'] for group in groups.values() for p,t in group})}
 inputs.update({f'body-{k}.bin':sha(v) for k,v in chunks.items()})
 # Audit source spatial extent before packing; source metres, Y superior.
 # Bounds are screening heuristics for gross regional selection errors, not registration evidence.
 rejected=[]
 floors={'head-neck':1.10,'thorax-shoulder':0.85,'arms-hands':0.60}
 for (reg,t),items in list(groups.items()):
  keep=[]
  for p,kind in items:
   _,_,bounds=exact(chunks[p['chunk']],p)
   if bounds[0][1]<floors[reg]:
    rejected.append({'id':str(p['conceptId']).lower(),'name':p['name'],'region':reg,'reason':'outside conservative superior-axis regional floor','bounds':bounds})
   else:keep.append((p,kind))
  groups[(reg,t)]=keep
 rejected_ids={x['id'] for x in rejected}
 for row in inventory:
  if row['id'] in rejected_ids:row['selected']=False
 for (reg,t),items in groups.items():emit('bp4-'+reg+'-'+t,items,chunks,LOCK['revision'],'CC BY 4.0','BodyParts3D © Database Center for Life Science','source metres Y-up; display=(source-[0,.9,0])*5')
 for reg in PATTERNS:
  keys=[k for k in packs if k.startswith('bp4-'+reg+'-')]
  if keys:specimens.append({'id':'exact-'+reg,'name':reg.replace('-',' / ').title()+' · BP3D source','region':reg,'space':'bp4-reference','status':'Exact indexed upstream derivative, distinct from VHF','packs':keys})
 failures=[]
 try:
  f=LOCK['facial'];m=fetch(f['repo'],f['revision'],'public/models/facial/atlas.json',f['manifestGitBlob'],f['manifestSha256']);b=fetch(f['repo'],f['revision'],'public/models/facial/facial.bin',f['binaryGitBlob'],f['binarySha256']);j=json.loads(m)
  if len(j['parts'])!=47 or j['bytes']!=len(b) or j['license']!=f['license']:raise ValueError('facial source mismatch')
  emit('bp3-exact-face',[(p,'muscle') for p in j['parts']],{0:b},f['revision'],f['license'],f['attribution'],'upstream BP4-registered metres; experimental similarity; display=(source-[0,.9,0])*5')
  inputs['facial/atlas.json']=sha(m);inputs['facial/facial.bin']=sha(b)
  specimens.append({'id':'exact-facial','name':'Facial expression · 47 exact source derivatives','region':'Face','space':'bp4-upstream-registered-experimental','status':'Upstream similarity registration, separate from VHF; no independent clinical validation','packs':['bp3-exact-face']})
 except urllib.error.HTTPError as e:
  if e.code!=404:raise
  failures.append({'source':'OMFAtlas pinned facial archive','status':'unavailable','httpStatus':404,'url':e.url,'decision':'retain existing hashed reduced facial derivative; no substitution'})
  print('FACIAL ACQUISITION BLOCKED: '+str(e),flush=True)
 if failures:
  head=next((s for s in specimens if s['id']=='exact-head-neck'),None)
  if head:specimens.append({'id':'exact-head-face-extension','name':'Face / neck · experimental expression overlay','region':'Face / neck','space':'bp4-upstream-registered-experimental','status':'BP4 source + separately licensed reduced BP3 facial extension; upstream similarity only; no VHF fusion','packs':head['packs']+['facial']})
 catalog={'schema':'body-live-morphology-1','specimens':specimens,'packs':packs,'inputs':inputs,'unavailable':failures,'regionScreenRejected':rejected,'limits':['Source derivative, not raw segmentation','No independent clinical review or anatomical depth metadata','Region selection conservative name-based subset; full source inventory retained','No cross-source fusion']}
 (DIR/'catalog.json').write_text(json.dumps(catalog,indent=2)+'\n')
 with (DIR/'inventory.csv').open('w',newline='') as f:
  w=csv.DictWriter(f,fieldnames=list(inventory[0]));w.writeheader();w.writerows(inventory)
 print(json.dumps({'unavailable':failures,'regionScreenRejected':rejected,'upstreamInventory':len(inventory),'acquiredPacks':len(packs),'acquiredStructures':sum(len(p['parts']) for p in packs.values()),'triangles':sum(p['triangles'] for p in packs.values()),'bytes':sum(p['bytes'] for p in packs.values()),'specimens':[{**s,'counts':{t:sum(packs[k]['counts'].get(t,0) for k in s['packs'] if k in packs) for t in sorted({t for k in s['packs'] if k in packs for t in packs[k]['counts']})}} for s in specimens]},indent=2))
if __name__=='__main__':main()
