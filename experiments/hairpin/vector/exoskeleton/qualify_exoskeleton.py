"""Measured evaluated surface intersections and sampled articulation envelope.
This is a triangle-BVH test, not structural FEA or continuous collision proof.
Explicit intended interfaces are reported separately, never removed from raw data.
"""
import bpy,sys,os,json,itertools,math
from mathutils import Vector
from mathutils.bvhtree import BVHTree
args=sys.argv[sys.argv.index('--')+1:]
master=os.path.abspath(args[args.index('--master')+1]);out=os.path.abspath(args[args.index('--out')+1])
bpy.ops.wm.open_mainfile(filepath=master)
deps=bpy.context.evaluated_depsgraph_get();parts=[]
for o in bpy.context.scene.objects:
    if o.type!='MESH':continue
    ev=o.evaluated_get(deps);m=ev.to_mesh();m.calc_loop_triangles()
    vs=[]
    for v in m.vertices:
        p=o.matrix_world@v.co;vs.append((p.x,p.z,-p.y))
    parts.append({'name':o.name,'group':o['assembly'],'role':o['role'],'verts':vs,'triangles':[tuple(t.vertices) for t in m.loop_triangles]})
    ev.to_mesh_clear()
def transform(p,twist,deploy,compression):
    g=p['group'];a=twist if g.startswith('front') else -twist if g.startswith('rear') else 0
    dy=-compression if g!='joint' else 0
    dx=0
    if g.endswith('_pod'):
        offset=-.6*deploy+compression*.65
        dx=math.sin(a)*offset;dy+=math.cos(a)*offset;a*=.35
    c,s=math.cos(a),math.sin(a)
    return [(c*x+s*y+dx,-s*x+c*y+dy,z) for x,y,z in p['verts']]
def interface(a,b):
    # Specific functional contact categories; any detected pair still appears
    # with count and sampled pose in the report. A category does not certify fit.
    ar,br=a['role'],b['role'];roles={ar,br};ga,gb=a['group'],b['group']
    same=ga==gb
    if same and (roles in [{'primary spar','nose bridge'},{'primary spar','tail wing'},{'primary spar','support web'},{'support web','standing insert'},{'lower load path','pod mount'},{'primary spar','bearing fork'},{'lower load path','bearing fork'}]):return 'candidate structural mating'
    if same and roles in [{'gimbal','gimbal collar'},{'propulsion housing','radial elements'},{'propulsion hub','radial elements'}]:return 'candidate mechanical mating'
    if 'bearing fork' in roles and 'gimbal collar' in roles:return 'candidate articulated bearing interface'
    if 'pod mount' in roles and 'propulsion housing' in roles and ga.split('_')[0]==gb.split('_')[0]:return 'candidate moving propulsion mount'
    return 'unintended/unclassified'
def bounds(v):return ([min(p[k] for p in v) for k in range(3)],[max(p[k] for p in v) for k in range(3)])
def disjoint(a,b):return any(a[1][k]<b[0][k] or b[1][k]<a[0][k] for k in range(3))
# The exact transform equations mirror BodyMarrowBoard.motion's pose helper.
# Compression tested up to 1.6 authoring units (runtime .0016), not a claim
# that every Cartesian combination is reached by the live state machine.
poses=[(0,0,0)]+[(t,d,c) for t in [-.14,0,.14] for d in [0,1] for c in [0,1.6] if (t,d,c)!=(0,0,0)]
findings={};maxabs=[0,0,0];low=0;static=None;min_cross_gap=1e9
for step,(t,d,c) in enumerate(poses):
    v=[transform(p,t,d,c) for p in parts];bs=[bounds(x) for x in v]
    if step==0:static=([min(b[0][k] for b in bs) for k in range(3)],[max(b[1][k] for b in bs) for k in range(3)])
    for b in bs:
        for k in range(3):maxabs[k]=max(maxabs[k],abs(b[0][k]),abs(b[1][k]))
        low=min(low,b[0][1])
    front=[b for p,b in zip(parts,bs) if p['group'].startswith('front')];rear=[b for p,b in zip(parts,bs) if p['group'].startswith('rear')]
    min_cross_gap=min(min_cross_gap,min(b[0][2] for b in front)-max(b[1][2] for b in rear))
    trees=[BVHTree.FromPolygons([Vector(q) for q in vv],p['triangles'],all_triangles=True,epsilon=0) for p,vv in zip(parts,v)]
    for i,j in itertools.combinations(range(len(parts)),2):
        if disjoint(bs[i],bs[j]):continue
        overlaps=trees[i].overlap(trees[j])
        if not overlaps:continue
        a,b=parts[i],parts[j];key=a['name']+' / '+b['name']
        f=findings.setdefault(key,{'a':a['name'],'b':b['name'],'groups':[a['group'],b['group']],'classification':interface(a,b),'poses':[],'maxTrianglePairs':0})
        f['poses'].append({'twist':t,'deploy':d,'compression':c,'trianglePairs':len(overlaps)})
        f['maxTrianglePairs']=max(f['maxTrianglePairs'],len(overlaps))
# Through-openings: vertical rays through actual evaluated triangles.
# Inspect known channels on each side of the suspended inserts, as well
# as the open nose. Counts are geometric line-of-sight, not projected art.
v=[p['verts'] for p in parts]
trees=[BVHTree.FromPolygons([Vector(q) for q in vv],p['triangles'],all_triangles=True) for p,vv in zip(parts,v)]
def open_ray(x,z):return all(tree.ray_cast(Vector((x,20,z)),Vector((0,-1,0)),40)[0] is None for tree in trees)
channels=[]
for label,z0,z1,x0,x1 in [('nose',29,35,-2,2),('front_side',10,25,4.9,10.5),('rear_side',-28,-10,4.9,10.5)]:
    hits=total=0
    for i in range(25):
        for j in range(15):
            z=z0+(z1-z0)*i/24;x=x0+(x1-x0)*j/14;total+=1;hits+=open_ray(x,z)
    channels.append({'region':label,'clearRays':hits,'totalRays':total})
unclassified=[x for x in findings.values() if x['classification']=='unintended/unclassified']
report={'staticBounds':static,'maxAnimatedAbs':maxabs,'minimumY':low,'limits':[12.1,9,38],'dimensionalPass':all(v<=lim for v,lim in zip(maxabs,[12.1,9,38])),'contactPlanePass':low>-11,'minFrontRearAxialGap':min_cross_gap,'poseCount':len(poses),'intersections':list(findings.values()),'unclassifiedPairs':len(unclassified),'channels':channels,'limitations':'BVH surface triangle intersections at sampled poses; containment, exact joint fit, stress and continuous swept collision not certified. Candidate mating categories require physical/visual fit review.'}
json.dump(report,open(out,'w'),indent=2)
print('EXO_GEOMETRY',json.dumps({k:v for k,v in report.items() if k!='intersections'}))
print('EXO_INTERSECTIONS',json.dumps([{k:v for k,v in f.items() if k!='poses'} for f in findings.values()]))
# Preserve gates as failed if necessary. Report written before raising.
if not report['dimensionalPass'] or not report['contactPlanePass'] or min_cross_gap<=0 or unclassified:
    raise RuntimeError('EXOSKELETON assembly qualification remains open; inspect report')
