"""UNFURL: thickened regional ribbon and permanent aperture experiment. No independent patch transport.
Actual compact upper-prong strip and actual protected front upper-rail region.
Exact native control surface is fallback, never mislabeled evaluated parity.
Open regional boundaries are intentional. No full accessory or folding claim.
"""
import bpy,sys,math,json,hashlib,itertools,collections,bisect
import numpy as np
from pathlib import Path
from mathutils import Vector,Matrix,Quaternion
from mathutils.bvhtree import BVHTree
args=sys.argv[sys.argv.index('--')+1:]
def arg(k):return Path(args[args.index('--'+k)+1]).resolve()
out=arg('out');out.mkdir(parents=True,exist_ok=True)
src=arg('source');compact=arg('compact')
def sha(p):return hashlib.sha256(p.read_bytes()).hexdigest()
expected='1758f93d990ce18a2b962653457912a3dcf87d7b4431f0291b8b4fd0a20c66e9'
assert sha(src)==expected
def arc(points):
    d=[0.]
    for a,b in zip(points,points[1:]):d.append(d[-1]+(a-b).length)
    return [x/d[-1] for x in d]
def cross(a,b):return a[0]*b[1]-a[1]*b[0]
def sub(a,b):return (a[0]-b[0],a[1]-b[1])
def orient(a,b,c):return cross(sub(b,a),sub(c,a))
def signed(poly):return sum(cross(a,b) for a,b in zip(poly,poly[1:]+poly[:1]))/2
def triangle(uv,xyz):
    if orient(*uv)<0:uv=[uv[0],uv[2],uv[1]];xyz=[xyz[0],xyz[2],xyz[1]]
    return {'uv':uv,'p':xyz}
def interp(q,p):
    a,b,c=q['uv'];d=orient(a,b,c);assert d>1e-14
    v=orient(a,p,c)/d;w=orient(a,b,p)/d
    return q['p'][0]*(1-v-w)+q['p'][1]*v+q['p'][2]*w
def chart(o,start,end,first,last,stride,offset=0):
    d=o.data;M=o.matrix_world
    ids={offset+i*stride+j:(i,j) for i in range(start,end+1) for j in range(first,last+1)}
    centers=[sum((M@d.vertices[offset+i*stride+j].co for j in range(first,last+1)),Vector())/(last-first+1) for i in range(start,end+1)]
    u=arc(centers);uv={i:(u[row-start],(col-first)/(last-first)) for i,(row,col) in ids.items()}
    d.calc_loop_triangles();rows=[];faces=set()
    for t in d.loop_triangles:
        if all(i in uv for i in t.vertices) and len(d.polygons[t.polygon_index].vertices)==4 and all(i in uv for i in d.polygons[t.polygon_index].vertices):
            faces.add(t.polygon_index);rows.append(triangle([uv[i] for i in t.vertices],[M@d.vertices[i].co for i in t.vertices]))
    assert len(faces)==(end-start)*(last-first),(o.name,len(faces))
    assert abs(sum(signed(q['uv']) for q in rows)-1)<1e-7
    return rows,uv,faces
bpy.ops.wm.open_mainfile(filepath=str(compact));bpy.context.view_layer.update()
body=next(o for o in bpy.context.scene.objects if o.type=='MESH' and o.get('couture_role')=='body')
assert len(body.data.vertices)==2888 and not body.modifiers
A,_,_=chart(body,0,120,3,6,8)
# Transform mm to illustrative authoring units, preserving compact geometry.
R=Matrix.Rotation(-math.pi/2,3,'Z')*.1
bpy.ops.wm.open_mainfile(filepath=str(src));s=bpy.context.scene;bpy.context.view_layer.update()
frame=bpy.data.objects['TENSION_continuous_frame']
assert frame.get('assembly')=='front' and len(frame.data.vertices)>=3636
# Interior of one actual upper rail. Deliberately exclude nose bridge,
# outer sidewall and mating boundaries. No claim about complete frame.
Bcontrol,uv,faces=chart(frame,21,98,1,7,9,2*909)

# Independent solid-like study: uses actual control charts as design guides,
# not exact native evaluated surface parity. Local aperture exists from start.
def sampler(rows):
    def fn(u,v):
        p=(u,v)
        for q in rows:
            if all(orient(x,y,p)>=-1e-10 for x,y in zip(q['uv'],q['uv'][1:]+q['uv'][:1])):return interp(q,p)
        raise ValueError(p)
    return fn
sa,sb=sampler(A),sampler(Bcontrol)
I,J=80,20
i0,i1,j0,j1=29,55,8,12
domain=[(i,j) for i in range(I+1) for j in range(J+1) if not (i0<i<i1 and j0<j<j1)]
idx={q:k for k,q in enumerate(domain)};M=len(domain)
# Use full compact region as geometric guide except localized aperture;
# narrow slit remains open, so no coincident zero-width topology event.
def warp(x,a,b,c,d):
    return float(np.interp(x,[0,a,b,1],[0,c,d,1]))
def smooth(x):x=max(0,min(1,x));return x*x*(3-2*x)
def phase(t,a,b):return smooth((t-a)/(b-a))
rootA=sa(1,.5);rootB=sb(1,.5)
C=Matrix.Translation(rootB-R@rootA)@R.to_4x4()
# Precompute actual chart samples on a regular dense grid, then interpolate
# bilinearly for the localized aperture warp. This is intentionally approximate.
U,V=161,41
AA=np.array([[tuple(C@sa(i/(U-1),j/(V-1))) for j in range(V)] for i in range(U)])
BB=np.array([[tuple(sb(i/(U-1),j/(V-1))) for j in range(V)] for i in range(U)])
def sample(grid,u,v):
    u=max(0,min(1,u))*(U-1);v=max(0,min(1,v))*(V-1);i=min(U-2,int(u));j=min(V-2,int(v));x=u-i;y=v-j
    return (1-x)*(1-y)*grid[i,j]+x*(1-y)*grid[i+1,j]+x*y*grid[i+1,j+1]+(1-x)*y*grid[i,j+1]
top=[]
for i in range(I):
    for j in range(J):
        if i0<=i<i1 and j0<=j<j1:continue
        q=[idx[i,j],idx[i+1,j],idx[i+1,j+1],idx[i,j+1]]
        top.append(tuple(q))
edges=collections.defaultdict(list)
for f in top:
    for a,b in zip(f,f[1:]+f[:1]):edges[tuple(sorted((a,b)))].append((a,b))
border=[v[0] for v in edges.values() if len(v)==1]
outer=[e for e in border if all(domain[i][0] in (0,I) for i in e) or all(domain[i][1] in (0,J) for i in e)]
inner=[e for e in border if e not in outer]
faces=top+[tuple(M+i for i in reversed(f)) for f in top]+[(b,a,M+a,M+b) for a,b in border]
def calc(t):
    f=phase(t,.12,.92);opening=phase(t,.36,.78);p=[];normal=[];th=[]
    # Two explicit boundaries with progressively widening aperture.
    # Move both walls locally, never hide or delete surface patches.
    for i,j in domain:
        u=i/I;v=j/J
        x=warp(u,i0/I,i1/I,.49-.018-.12*opening,.49+.018+.12*opening)
        y=warp(v,j0/J,j1/J,.5-.018-.13*opening,.5+.018+.13*opening)
        g=phase(t,.10+.14*(1-x),.86+.06*(1-x))
        damp=.022*math.sin(math.pi*max(0,min(1,(t-.77)/.22)))*math.exp(-2.5*max(0,(t-.77)/.22))
        def surface(a,b):
            w=(1-g)*sample(AA,a,b)+g*sample(BB,a,b)
            w+=np.array([1.55,0,1.1])*math.sin(math.pi*g)*math.sin(math.pi*a)
            w[2]+=(b-.5)*1.35*math.sin(math.pi*g)*math.sin(math.pi*a)
            w+=damp*(sample(BB,a,b)-sample(AA,a,b))
            return w
        w=surface(x,y);du=surface(min(1,x+.0005),y)-surface(max(0,x-.0005),y);dv=surface(x,min(1,y+.0005))-surface(x,max(0,y-.0005));n=np.cross(du,dv);n/=max(np.linalg.norm(n),1e-12)
        p.append(w);normal.append(n);th.append(.10+.18*f)
    p=np.array(p);normal=np.array(normal);th=np.array(th)
    return np.concatenate([p,p-normal*th[:,None]]),th
# Persistent UV/materials and closed genus-one shell.
for o in list(s.objects):
    if o.type in ('MESH','CAMERA','LIGHT'):bpy.data.objects.remove(o,do_unlink=True)
for l in s.view_layers:l.material_override=None;l.cycles.use_denoising=False
p,th=calc(0);d=bpy.data.meshes.new('UNFURL persistent thick aperture');d.from_pydata(p.tolist(),[],faces);d.update()
obj=bpy.data.objects.new('UNFURL — thickened aperture study',d);s.collection.objects.link(obj)
uv=d.uv_layers.new(name='PersistentMarking')
for l in d.loops:
    i,j=domain[l.vertex_index%M];uv.data[l.index].uv=(i/I,j/J)
for p in d.polygons:p.use_smooth=p.index<2*len(top)
def material(name,color,metal,rough):
    m=bpy.data.materials.new(name);m.use_nodes=True;n=m.node_tree.nodes.get('Principled BSDF');n.inputs['Base Color'].default_value=(*color,1);n.inputs['Metallic'].default_value=metal;n.inputs['Roughness'].default_value=rough;return m
mode=args[args.index('--mode')+1]
metal=material('Silver with integral UV signature',(.62,.59,.53),.92,.23);clay=material('Inspection clay',(.4,.4,.4),0,.5);edge=material('Petrol edge',(.012,.045,.08),.8,.25)
if mode=='clay':d.materials.append(clay)
else:
    d.materials.append(metal);d.materials.append(edge)
    for p in d.polygons:
        if p.index>=2*len(top):p.material_index=1
    n=metal.node_tree.nodes;l=metal.node_tree.links;bs=n.get('Principled BSDF')
    tex=n.new('ShaderNodeUVMap');tex.uv_map='PersistentMarking';sep=n.new('ShaderNodeSeparateXYZ');l.new(tex.outputs[0],sep.inputs[0])
    ramp=n.new('ShaderNodeValToRGB');ramp.color_ramp.interpolation='LINEAR'
    colors=[(0,(.012,.045,.08,1)),(.15,(.012,.045,.08,1)),(.16,(.62,.59,.53,1)),(.66,(.62,.59,.53,1)),(.67,(.8,.015,.25,1)),(.70,(.8,.015,.25,1)),(.71,(.62,.59,.53,1)),(1,(.62,.59,.53,1))]
    for k,(x,col) in enumerate(colors):
        e=ramp.color_ramp.elements[k] if k<2 else ramp.color_ramp.elements.new(x);e.position=x;e.color=col
    l.new(sep.outputs['Y'],ramp.inputs[0]);l.new(ramp.outputs[0],bs.inputs['Base Color'])
# Topological audit independent of display. Edge orientation across shared
# sidewalls must be opposite, as must every shared skin edge.
counts=collections.Counter(tuple(sorted((a,b))) for f in faces for a,b in zip(f,f[1:]+f[:1]))
directions=collections.Counter((a,b) for f in faces for a,b in zip(f,f[1:]+f[:1]))
adj=collections.defaultdict(set)
for a,b in counts:adj[a].add(b);adj[b].add(a)
unseen=set(range(2*M));cc=0
while unseen:
    cc+=1;todo=[unseen.pop()]
    while todo:
        for j in adj[todo.pop()]:
            if j in unseen:unseen.remove(j);todo.append(j)
topology={'components':cc,'boundaryEdges':sum(n==1 for n in counts.values()),'nonmanifoldEdges':sum(n!=2 for n in counts.values()),'orientationEdgeDefects':sum(directions[a,b]!=directions[b,a] for a,b in counts),'euler':2*M-len(counts)+len(faces),'outerSidewallQuads':len(outer),'apertureSidewallQuads':len(inner)}
assert cc==1 and topology['nonmanifoldEdges']==0 and topology['orientationEdgeDefects']==0 and topology['euler']==0,topology
tri=[(f[0],f[k],f[k+1]) for f in faces for k in range(1,len(f)-1)]
F=np.array(tri);mats=[p.material_index for p in d.polygons]
def inspect(p,th,t):
    q=p[F];area=np.linalg.norm(np.cross(q[:,1]-q[:,0],q[:,2]-q[:,0]),axis=1)/2
    volume=float(np.sum(np.einsum('ij,ij->i',q[:,0],np.cross(q[:,1],q[:,2])))/6)
    tree=BVHTree.FromPolygons(p.tolist(),tri,all_triangles=True)
    hits=[(i,j) for i,j in tree.overlap(tree) if i<j and not set(tri[i]).intersection(tri[j])]
    widths=[float(np.linalg.norm(p[idx[i,j0]]-p[idx[i,j1]])) for i in range(i0,i1+1)]
    actual=np.linalg.norm(p[:M]-p[M:],axis=1)
    return {'t':t,'minThickness':float(actual.min()),'maxThickness':float(actual.max()),'thicknessError':float(np.max(np.abs(actual-th))),'apertureMinCrossDistance':min(widths),'apertureMaxCrossDistance':max(widths),'surfaceArea':float(area.sum()),'signedVolume':volume,'degenerateTriangles':int(np.sum(area<1e-10)),'nonadjacentOverlapCandidates':len(hits),'overlapExamples':hits[:20],'materialAssignmentStable':mats==[p.material_index for p in d.polygons]}
s.world=bpy.data.worlds.new('UNFURL studio');s.world.use_nodes=True;s.world.node_tree.nodes['Background'].inputs[0].default_value=(.18,.18,.18,1)
for name,loc,power,size in [('Key',(20,-30,55),70000,50),('Strip',(-30,20,35),50000,40),('Rim',(15,35,-20),35000,35)]:
    l=bpy.data.lights.new(name,'AREA');l.energy=power;l.shape='RECTANGLE';l.size=size;l.size_y=size*.22;o=bpy.data.objects.new(name,l);s.collection.objects.link(o);o.location=loc;o.rotation_euler=(-o.location).to_track_quat('-Z','Y').to_euler()
camd=bpy.data.cameras.new('UNFURL camera');cam=bpy.data.objects.new('UNFURL camera',camd);s.collection.objects.link(cam);s.camera=cam;camd.type='ORTHO';camd.clip_end=1000
s.render.engine='CYCLES';s.cycles.device='CPU';s.cycles.samples=32;s.cycles.use_denoising=False;s.render.resolution_x=768;s.render.resolution_y=432;s.render.resolution_percentage=100;s.render.image_settings.file_format='PNG';s.render.threads_mode='FIXED';s.render.threads=4
report={'sourceSha256':expected,'compactSha256':sha(compact),'topology':topology,'vertices':2*M,'triangles':len(tri),'samples':[],'limitations':['Actual compact and native control rail are guides, not exact evaluated endpoint; this independent thick aperture concept is deliberately not full front geometry.','Persistent nonzero slit expands through a local chart warp: no topology-changing deletion, no exact initially solid strip.','Thickness is a fictional offset and no volume conservation or mechanical folding is claimed.','Nonadjacent BVH overlaps are candidates; no continuous swept-volume guarantee.']}
N=81;preflight='--preflight' in args
if preflight:s.cycles.samples=8;s.render.resolution_x=320;s.render.resolution_y=180
if not preflight:
    obj.shape_key_add(name='Basis')
    for frame in range(0,N,4):
        q,_=calc(frame/(N-1));key=obj.shape_key_add(name=f'UNFURL-{frame:03d}');key.data.foreach_set('co',q.astype(np.float32).ravel())
        for k,val in [(frame-4,0),(frame,1),(frame+4,0)]:
            key.value=val;key.keyframe_insert(data_path='value',frame=k+1)
        key.value=0
    s.frame_start=1;s.frame_end=N;s.render.fps=16;s.frame_set(1)
    bpy.ops.wm.save_as_mainfile(filepath=str(out/'unfurl-aperture.blend'));obj.shape_key_clear()
for i in ([0,40,80] if preflight else range(N)):
    t=i/(N-1);p,th=calc(t);d.vertices.foreach_set('co',p.astype(np.float32).ravel());d.update();bpy.context.view_layer.update()
    if i%4==0 or i==N-1:
        report['samples'].append(inspect(p,th,t));(out/'partial-evidence.json').write_text(json.dumps(report,indent=2))
    center=Vector(tuple((p.min(axis=0)+p.max(axis=0))/2));cam.location=center+Vector((55,-25,95));cam.rotation_euler=(center-cam.location).to_track_quat('-Z','Y').to_euler();camd.ortho_scale=max(12,float(np.max(p.max(axis=0)-p.min(axis=0)))*1.30)
    s.render.filepath=str(out/f'frame-{i:04d}.png');bpy.ops.render.render(write_still=True)
    assert Path(s.render.filepath).stat().st_size>1000
assert sha(src)==expected
report['sampledOpeningPass']=all(not x['degenerateTriangles'] and not x['nonadjacentOverlapCandidates'] and x['minThickness']>0 and x['thicknessError']<1e-5 and x['materialAssignmentStable'] for x in report['samples'])
(out/'evidence.json').write_text(json.dumps(report,indent=2))
print('UNFURL_APERTURE',json.dumps({k:v for k,v in report.items() if k!='samples'}))
