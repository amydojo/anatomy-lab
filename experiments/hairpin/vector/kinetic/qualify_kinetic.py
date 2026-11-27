"""KINETIC and HAIRPIN feasibility: evaluated triangle overlap over replay
and hypothetical compact hinge paths. No changes to approved master.
Sampled BVH surfaces only; never continuous solid collision certification.
"""
import bpy,sys,os,json,math,itertools,hashlib
from mathutils import Vector,Matrix
from mathutils.bvhtree import BVHTree
args=sys.argv[sys.argv.index('--')+1:]
def arg(k):return os.path.abspath(args[args.index('--'+k)+1])
src=arg('source');assert hashlib.sha256(open(src,'rb').read()).hexdigest()=='1758f93d990ce18a2b962653457912a3dcf87d7b4431f0291b8b4fd0a20c66e9'
bpy.ops.wm.open_mainfile(filepath=src);bpy.context.view_layer.update();deps=bpy.context.evaluated_depsgraph_get()
parts=[]
for o in bpy.context.scene.objects:
    if o.type!='MESH':continue
    ev=o.evaluated_get(deps);m=ev.to_mesh();m.calc_loop_triangles()
    v=[ev.matrix_world@p.co for p in m.vertices]
    parts.append({'name':o.name,'g':o['assembly'],'role':o['role'],'v':[Vector((p.x,p.z,-p.y)) for p in v],'f':[tuple(t.vertices) for t in m.loop_triangles]});ev.to_mesh_clear()
assert len(parts)==25
# Same named interfaces as unchanged CONTINUITY gate. No new exemption.
def intended(a,b):
    names={a['role'],b['role']};groups={a['g'],b['g']}
    if groups=={'front'} and names in [{'continuous frame','support web'},{'support web','standing insert'},{'continuous frame','pod saddle'},{'continuous frame','bearing sleeve'}]:return True
    if groups=={'front','front_pod'} and names=={'pod saddle','propulsion housing'}:return True
    if groups=={'front','joint'} and names=={'bearing sleeve','gimbal collar'}:return True
    if groups=={'rear'} and names in [{'rear continuous frame','rear support web'},{'rear support web','rear standing insert'},{'rear continuous frame','rear pod saddle'},{'rear continuous frame','rear bearing sleeve'}]:return True
    if groups=={'rear','rear_pod'} and names=={'rear pod saddle','propulsion housing'}:return True
    if groups=={'rear','joint'} and names=={'rear bearing sleeve','gimbal collar'}:return True
    return False
def bounds(v):return [[min(p[k] for p in v) for k in range(3)],[max(p[k] for p in v) for k in range(3)]]
def disjoint(a,b):return any(a[1][k]<b[0][k] or b[1][k]<a[0][k] for k in range(3))
def inspect(v,pairs,all_hits=False):
    bs=[bounds(q) for q in v];trees={}
    hits=[]
    for i,j in pairs:
        if disjoint(bs[i],bs[j]):continue
        for k in (i,j):
            if k not in trees:trees[k]=BVHTree.FromPolygons(v[k],parts[k]['f'],all_triangles=True)
        h=trees[i].overlap(trees[j])
        if h:hits.append({'a':parts[i]['name'],'b':parts[j]['name'],'trianglePairs':len(h),'historicalMating':intended(parts[i],parts[j])})
    return hits,bs
pairs=[(i,j) for i,j in itertools.combinations(range(len(parts)),2) if not intended(parts[i],parts[j])]
# Actual 120 Hz replay transforms are sampled at 12 Hz, plus all frame
# endpoints and peak compression, not falsely described as continuous.
replay=json.load(open(arg('replay')));rows=replay['frames'];peak=max(replay['all'],key=lambda q:q['pose']['vehicle']['compression']);rows=sorted(rows+[peak],key=lambda q:q['t'])
results=[]
for row in rows:
    p=row['pose'];v=[]
    for part in parts:
        q=p[{'front':'front','rear':'rear','front_pod':'frontPod','rear_pod':'rearPod'}.get(part['g'],'vehicle')] if part['g']!='joint' else p
        r=q['r'];R=Matrix((r[:3],r[3:6],r[6:9])).transposed();t=Vector(q['t'])*1000
        v.append([R@x+t for x in part['v']])
    hits,bs=inspect(v,pairs)
    gap=min(b[0][2] for a,b in zip(parts,bs) if a['g'].startswith('front'))-max(b[1][2] for a,b in zip(parts,bs) if a['g'].startswith('rear'))
    ext=[max(max(abs(b[0][k]),abs(b[1][k])) for b in bs) for k in range(3)]
    low=min(b[0][1] for b in bs)
    results.append({'t':row['t'],'phase':p['vehicle']['phase'],'hits':hits,'gap':gap,'extent':ext,'minimumY':low,'pass':not hits and gap>0 and low>-11 and all(x<=y for x,y in zip(ext,[12.1,9,38]))})
# Existing articulation rotates around z and translates in xy only:
# longitudinal envelope is mathematically invariant. A true fold needs
# a new hinge DOF. Two hypothetical rigid paths, no new mechanism claimed.
cross=[(i,j) for i,j in itertools.combinations(range(len(parts)),2) if (parts[i]['g'].startswith('rear'))!=(parts[j]['g'].startswith('rear'))]
fold={}
for axis in ('X','Y'):
    steps=[]
    for angle in range(0,181,5):
        R=Matrix.Rotation(math.radians(angle),3,axis)
        v=[[R@x for x in p['v']] if p['g'].startswith('rear') else p['v'] for p in parts]
        hits,bs=inspect(v,cross)
        extent=[max(b[1][k] for b in bs)-min(b[0][k] for b in bs) for k in range(3)]
        steps.append({'degrees':angle,'extentXYZ':extent,'intersections':hits,'newUnclassified':[h for h in hits if not h['historicalMating']]})
    fold[axis]={'samples':steps,'firstUnclassifiedAngle':next((s['degrees'] for s in steps if s['newUnclassified']),None),'finalExtent':steps[-1]['extentXYZ']}
report={'motionSamples':len(results),'motionPass':all(x['pass'] for x in results),'motion':results,'compactStudy':fold,'existingFoldDOF':False,'limitations':'Existing longitudinal twist cannot shorten z; hypothetical rotations around central origin are not existing joints, latch or attachment solutions. Collision-free samples would not establish feasibility. No containment or continuous swept collision proof. Fixed attachments mechanically rechecked by unchanged separate gate.'}
json.dump(report,open(arg('out'),'w'),indent=2);print('KINETIC_CLEARANCE',json.dumps({'motionPass':report['motionPass'],'samples':len(results),'fold':{k:{'firstUnclassifiedAngle':v['firstUnclassifiedAngle'],'finalExtent':v['finalExtent']} for k,v in fold.items()}}),flush=True)
if not report['motionPass']:raise RuntimeError('Kinetic sampled envelope gate remains open')
