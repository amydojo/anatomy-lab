"""TENSION: actual evaluated surface contacts and unchanged-pose clearance.
All interface hits are retained, including expected mating hits.
Distances are sampled vertex-to-triangle upper bounds, not exact solid gaps.
"""
import bpy,sys,os,json,math,itertools
from mathutils import Vector
from mathutils.bvhtree import BVHTree
args=sys.argv[sys.argv.index('--')+1:]
def arg(k):return args[args.index('--'+k)+1]
bpy.ops.wm.open_mainfile(filepath=os.path.abspath(arg('master')))
# Evaluate hidden frozen rear too, for cross-assembly clearance.
for o in bpy.context.scene.objects:
    if o.type=='MESH':o.hide_set(False)
bpy.context.view_layer.update();deps=bpy.context.evaluated_depsgraph_get();parts=[]
for o in bpy.context.scene.objects:
    if o.type!='MESH':continue
    ev=o.evaluated_get(deps);m=ev.to_mesh();m.calc_loop_triangles()
    v=[o.matrix_world@p.co for p in m.vertices];parts.append({'name':o.name,'g':o['assembly'],'role':o['role'],'v':[(p.x,p.z,-p.y) for p in v],'f':[tuple(t.vertices) for t in m.loop_triangles]});ev.to_mesh_clear()
def transform(p,t,d,c):
    g=p['g'];a=t if g.startswith('front') else -t if g.startswith('rear') else 0;dy=-c if g!='joint' else 0;dx=0
    if g.endswith('_pod'):
        off=-.6*d+.65*c;dx=math.sin(a)*off;dy+=math.cos(a)*off;a*=.35
    co,si=math.cos(a),math.sin(a)
    return [(co*x+si*y+dx,-si*x+co*y+dy,z) for x,y,z in p['v']]
def bounds(v):return [[min(p[k] for p in v) for k in range(3)],[max(p[k] for p in v) for k in range(3)]]
def disjoint(a,b):return any(a[1][k]<b[0][k] or b[1][k]<a[0][k] for k in range(3))
def intended(a,b):
    names={a['role'],b['role']};groups={a['g'],b['g']}
    if groups=={'front'} and names in [{'continuous frame','support web'},{'support web','standing insert'},{'continuous frame','pod saddle'},{'continuous frame','bearing sleeve'}]:return 'candidate fixed mating'
    if groups=={'front','front_pod'} and names=={'pod saddle','propulsion housing'}:return 'candidate moving pod mating'
    if groups=={'front','joint'} and names=={'bearing sleeve','gimbal collar'}:return 'candidate moving bearing mating'
    return 'unclassified'
pairs=[(i,j) for i,j in itertools.combinations(range(len(parts)),2) if parts[i]['g']=='front' or parts[j]['g']=='front']
poses=[(0,0,0)]+[(t,d,c) for t in [-.14,0,.14] for d in [0,1] for c in [0,1.6] if (t,d,c)!=(0,0,0)]
findings={};contacts=[];maxabs=[0,0,0];low=0;gap=1e9
for step,(t,d,c) in enumerate(poses):
    v=[transform(p,t,d,c) for p in parts];bs=[bounds(x) for x in v];trees=[BVHTree.FromPolygons([Vector(q) for q in vv],p['f'],all_triangles=True) for p,vv in zip(parts,v)]
    front=[b for p,b in zip(parts,bs) if p['g'].startswith('front')];rear=[b for p,b in zip(parts,bs) if p['g'].startswith('rear')]
    gap=min(gap,min(b[0][2] for b in front)-max(b[1][2] for b in rear))
    for b in front:
        for k in range(3):maxabs[k]=max(maxabs[k],abs(b[0][k]),abs(b[1][k]))
        low=min(low,b[0][1])
    for i,j in pairs:
        a,b=parts[i],parts[j];role=intended(a,b);overlap=[] if disjoint(bs[i],bs[j]) else trees[i].overlap(trees[j])
        if overlap:
            key=a['name']+' / '+b['name'];f=findings.setdefault(key,{'a':a['name'],'b':b['name'],'classification':role,'poses':[]});f['poses'].append({'pose':[t,d,c],'trianglePairs':len(overlap)})
        if role!='unclassified' and (step==0 or role.startswith('candidate moving')):
            # Every vertex in both directions; sampled surface gap upper bound.
            def nearest(src,dst):
                ds=[]
                for q in v[src]:
                    hit=trees[dst].find_nearest(Vector(q))
                    if hit[0] is not None:ds.append(hit[3])
                return min(ds,default=1e9)
            distance=0 if overlap else min(nearest(i,j),nearest(j,i))
            contacts.append({'a':a['name'],'b':b['name'],'pose':[t,d,c],'classification':role,'surfaceDistanceUpperBound':distance,'trianglePairs':len(overlap)})
# Fixed frame must touch both supports, both saddles and both sleeves; each
# support must contact tread. Moving components may have deliberate clearance.
required=[]
for p in parts:
    if p['g']!='front' or p['role'] not in ('support web','pod saddle','bearing sleeve'):continue
    for target in ['TENSION_continuous_frame']+(['TENSION_tread'] if p['role']=='support web' else []):
        hits=[x for x in contacts if set([x['a'],x['b']])=={p['name'],target} and x['pose']==[0,0,0]]
        required.append({'a':p['name'],'b':target,'pass':bool(hits and hits[0]['surfaceDistanceUpperBound']<=.08),'evidence':hits[0] if hits else None})
bad=[x for x in findings.values() if x['classification']=='unclassified']
report={'poses':len(poses),'frontAnimatedMax':maxabs,'frontMinY':low,'frontRearAxialGap':gap,'dimensionalPass':all(x<=l for x,l in zip(maxabs,[12.1,9,38])),'contactPlanePass':low>-11,'requiredFixedContacts':required,'interfaces':contacts,'allIntersections':list(findings.values()),'unclassifiedCount':len(bad),'limitations':'Sampled poses and BVH surface hits, not containment/continuous collision, stress or certified bearing fit. Moving interface distances are diagnostic only. Original rear unchanged.'}
json.dump(report,open(arg('out'),'w'),indent=2)
print('TENSION_GEOMETRY',json.dumps({k:v for k,v in report.items() if k not in ['interfaces','allIntersections']}))
if bad or not all(x['pass'] for x in required) or not report['dimensionalPass'] or not report['contactPlanePass'] or gap<=0:raise RuntimeError('TENSION mechanical gate remains open')
