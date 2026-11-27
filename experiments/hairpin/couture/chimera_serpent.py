"""METAMORPHOSIS: one connected, closed U-ribbon mesh; separate exploratory clasp.
Coordinates mm. Historical masters and riding source are never modified."""
import bpy,bmesh,math,sys,json,hashlib,itertools
from pathlib import Path
from mathutils import Vector,Matrix
from mathutils.bvhtree import BVHTree
args=sys.argv[sys.argv.index('--')+1:]
def arg(k,default=None):return args[args.index('--'+k)+1] if '--'+k in args else default
out=Path(arg('out')).resolve();out.mkdir(parents=True,exist_ok=True)
mode=arg('mode','build')
def sha(p):return hashlib.sha256(Path(p).read_bytes()).hexdigest()
def linear(x):return x/12.92 if x<=.04045 else ((x+.055)/1.055)**2.4
def mat(name,h,metal=.88,rough=.23):
    m=bpy.data.materials.new(name);m.use_nodes=True;p=m.node_tree.nodes.get('Principled BSDF')
    p.inputs['Base Color'].default_value=tuple(linear(int(h[i:i+2],16)/255) for i in (0,2,4))+(1,)
    p.inputs['Metallic'].default_value=metal;p.inputs['Roughness'].default_value=rough
    return m
def mesh(name,v,f,mats,indices=None,smooth=False,sharp=()):
    d=bpy.data.meshes.new(name);d.from_pydata(v,[],f);d.update()
    for m in mats:d.materials.append(m)
    if indices:
        for p,i in zip(d.polygons,indices):p.material_index=i
    bm=bmesh.new();bm.from_mesh(d);bmesh.ops.recalc_face_normals(bm,faces=list(bm.faces));bm.to_mesh(d);bm.free()
    for p in d.polygons:p.use_smooth=smooth and len(p.vertices)==4
    sharp=set(tuple(sorted(e)) for e in sharp)
    for e in d.edges:e.use_edge_sharp=tuple(sorted(e.vertices)) in sharp
    if hasattr(d,'use_auto_smooth'):d.use_auto_smooth=True;d.auto_smooth_angle=math.pi
    o=bpy.data.objects.new(name,d);bpy.context.collection.objects.link(o);return o
def bez(a,b,c,d,t):
    a,b,c,d=map(Vector,(a,b,c,d));u=1-t
    return u**3*a+3*u*u*t*b+3*u*t*t*c+t**3*d
# Single centerline runs tip to crown to opposite tip. G1 tangents at segment joints.
curves=[
 ((55,-15,0),(27,-24,1),(-20,-14,2),(-44,-9,3)),
 ((-44,-9,3),(-66,-4.4167,3.9167),(-61,7,7.8),(-43,13,5.5)),
 ((-43,13,5.5),(-25,19,3.2),(20,13,.7),(49,8,-.6))]
def centerline():
    arr=[]
    for j,seg in enumerate(curves):
        for i in range(121):
            if j and i==0:continue
            arr.append(bez(*seg,i/120))
    return arr
def ribbon(name,path,params,mats,paint):
    # Each facet has smooth longitudinal normals; longitudinal edges split
    # adjacent transverse planes. No per-station hard edge or weighted-normal modifier.
    v=[];f=[];mi=[];sharp=[]
    profile=[(-.74,-1),(.74,-1),(1,-.38),(1,.38),(.74,1),(-.74,1),(-1,.38),(-1,-.38)]
    n=len(path)
    for i,p in enumerate(path):
        tangent=(path[min(i+1,n-1)]-path[max(i-1,0)]).normalized()
        lat=Vector((0,0,1)).cross(tangent).normalized();up=tangent.cross(lat).normalized()
        w,h,a=params(i/(n-1));L=lat*math.cos(a)+up*math.sin(a);U=up*math.cos(a)-lat*math.sin(a)
        v.extend([p+L*(x*w)+U*(z*h) for x,z in profile])
    f.append(tuple(range(7,-1,-1)));mi.append(0)
    for i in range(n-1):
        for j in range(8):
            f.append((8*i+j,8*i+(j+1)%8,8*(i+1)+(j+1)%8,8*(i+1)+j))
            mi.append(paint((i+.5)/(n-1),j))
            sharp.append((8*i+j,8*(i+1)+j))
    f.append(tuple(range(8*(n-1),8*n)));mi.append(0)
    return mesh(name,v,f,mats,mi,True,sharp)
def annulus(name,x,y,z,outer,inner,width,m,root=0):
    v=[];f=[];n=64
    for yy in (y-width/2,y+width/2):
        for rad in (outer,inner):
            v.extend([(x+rad*math.cos(2*math.pi*i/n),yy,z+rad*math.sin(2*math.pi*i/n)+(root*max(0,math.sin(2*math.pi*i/n))**2 if rad==outer else 0)) for i in range(n)])
    for i in range(n):
        j=(i+1)%n
        f.extend([(i,j,n+j,n+i),(2*n+i,3*n+i,3*n+j,2*n+j),(i,2*n+i,2*n+j,j),(n+i,n+j,3*n+j,3*n+i)])
    return mesh(name,v,f,[m],smooth=True,sharp=[(k*n+i,k*n+(i+1)%n) for k in range(4) for i in range(n)])
def configure(s,samples=64):
    s.render.engine='CYCLES';s.cycles.device='CPU';s.cycles.samples=samples;s.cycles.use_denoising=False
    for l in s.view_layers:l.cycles.use_denoising=False
    s.render.threads_mode='FIXED';s.render.threads=4;s.render.resolution_x=1100;s.render.resolution_y=760;s.render.resolution_percentage=100;s.render.image_settings.file_format='PNG'
def studio():
    s=bpy.context.scene;s.world=bpy.data.worlds.new('Neutral fashion studio');s.world.use_nodes=True
    s.world.node_tree.nodes.get('Background').inputs[0].default_value=(.15,.15,.15,1)
    for name,loc,power,size,sy in [('Key',(-30,-75,105),85000,95,28),('Strip',(45,65,70),70000,85,15),('Rim',(0,-10,-80),30000,65,22)]:
        d=bpy.data.lights.new(name,'AREA');d.energy=power;d.shape='RECTANGLE';d.size=size;d.size_y=sy
        o=bpy.data.objects.new(name,d);s.collection.objects.link(o);o.location=loc;o.rotation_euler=(-o.location).to_track_quat('-Z','Y').to_euler()
    d=bpy.data.cameras.new('Inspection');o=bpy.data.objects.new('Inspection',d);s.collection.objects.link(o);s.camera=o;d.type='ORTHO';d.clip_end=2500
    configure(s);return s
def render(s,label,loc,target=(0,0,0),scale=145):
    c=s.camera;c.location=loc;c.rotation_euler=(Vector(target)-c.location).to_track_quat('-Z','Y').to_euler();c.data.ortho_scale=scale
    s.render.filepath=str(out/(label+'.png'));bpy.ops.render.render(write_still=True)
    assert Path(s.render.filepath).stat().st_size>1000
def build():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    s=bpy.context.scene;s.unit_settings.system='METRIC';s.unit_settings.scale_length=.001
    silver=mat('Surgical silver','D5D0C8',.93,.19);petrol=mat('Midnight petrol','103C59',.79,.23);orchid=mat('Orchid inlaid seam','F52BAA',.55,.25)
    path=centerline()
    def params(t):
        envelope=math.sin(math.pi*t)**.65
        return (.60+2.8*envelope+2.8*math.exp(-((t-.415)/.075)**2)+.95*math.exp(-((t-.78)/.12)**2),.43+.62*envelope,.28*math.sin(2*math.pi*t)+.64*math.exp(-((t-.49)/.095)**2)-.25*math.exp(-((t-.78)/.12)**2))
    def paint(t,j):
        # Integral face-level inlay follows a curved character line; no separate floating button.
        if (.405+.009*(j-3))<t<(.456+.009*(j-3)) and j in (2,3,4):return 2
        return 1 if (t<.40 and j in (2,3,4,5,6)) or (t>=.40 and j in (0,1,7)) else 0
    body=ribbon('SERPENT_003 continuous crown and prongs',path,params,[silver,petrol,orchid],paint)
    body['design_role']='single integrated U-ribbon with inlaid material stripe';body['couture_role']='body'
    # Exploratory clevis: modeled bores and pin; crown interface is NOT certified.
    x,z=-54.0,-5.3
    for y in (-3.2,3.2):
        ear=annulus('Fixed clevis ear '+str(y),x,y,z,2.7,1.15,1.6,petrol,root=9.0);ear['couture_role']='fixed_ear_positive' if y>0 else 'fixed_ear_negative'
    # One continuous shouldered axle, with geometric axial stops beyond the ears.
    vv=[];ff=[];N=64;profile=[(-4.85,1.55),(-4.2,1.55),(-4.2,1.0),(4.2,1.0),(4.2,1.55),(4.85,1.55)]
    for y,r in profile:
        vv.extend([(x+r*math.cos(2*math.pi*i/N),y,z+r*math.sin(2*math.pi*i/N)) for i in range(N)])
    for k in range(len(profile)-1):
        for i in range(N):ff.append((k*N+i,k*N+(i+1)%N,(k+1)*N+(i+1)%N,(k+1)*N+i))
    ff.extend([tuple(range(N-1,-1,-1)),tuple(range((len(profile)-1)*N,len(profile)*N))])
    pin=mesh('Exploratory shouldered axle',vv,ff,[silver],smooth=True);pin['couture_role']='axle'
    ring=annulus('Moving knuckle with bore',x,0,z,2.4,1.15,3.2,silver)
    leafpath=[Vector((x+1.3+35*t,0,z-.6-1.4*math.sin(math.pi*t))) for t in [i/120 for i in range(121)]]
    leaf=ribbon('Concealed release leaf',leafpath,lambda t:(1.0+1.6*math.sin(math.pi*t),.62,0),[silver,petrol],lambda t,j:0)
    # Model a connected moving leaf using union; reject if operator fails, not if visual overlaps exist.
    bpy.context.view_layer.objects.active=leaf
    mod=leaf.modifiers.new('Knuckle-to-leaf solid union','BOOLEAN');mod.operation='UNION';mod.solver='EXACT';mod.object=ring
    bpy.ops.object.modifier_apply(modifier=mod.name);bpy.data.objects.remove(ring,do_unlink=True)
    leaf['couture_role']='moving_leaf'
    pivot=bpy.data.objects.new('Release axis — proposed',None);pivot['couture_role']='release_axis';s.collection.objects.link(pivot);pivot.location=(x,0,z)
    bpy.context.view_layer.update();mw=leaf.matrix_world.copy();leaf.parent=pivot;leaf.matrix_world=mw
    s=studio();bpy.context.view_layer.update()
    bpy.ops.wm.save_as_mainfile(filepath=str(out/'SERPENT-003-closed.blend'))
    pivot.rotation_euler.y=math.radians(52);bpy.context.view_layer.update()
    bpy.ops.wm.save_as_mainfile(filepath=str(out/'SERPENT-003-open.blend'))
def topology(o):
    dg=bpy.context.evaluated_depsgraph_get();ev=o.evaluated_get(dg);me=ev.to_mesh();me.calc_loop_triangles()
    v=[ev.matrix_world@q.co for q in me.vertices];f=[tuple(t.vertices) for t in me.loop_triangles]
    bm=bmesh.new();bm.from_mesh(me);seen=set();components=0
    for q in bm.verts:
        if q in seen:continue
        components+=1;todo=[q];seen.add(q)
        while todo:
            for e in todo.pop().link_edges:
                a,b=e.verts
                for a in (a,b):
                    if a not in seen:seen.add(a);todo.append(a)
    stat={'connected_components':components,'nonmanifold_edges':sum(not e.is_manifold for e in bm.edges),'vertices':len(v),'triangles':len(f)}
    bm.free();ev.to_mesh_clear();return stat,v,f
def semantic_id(o):
    # Legacy masters: use semantic role, parent relation and geometry, not revision display name.
    if o.get('couture_role'):return o['couture_role']
    if o.get('design_role','').startswith('single integrated'):return 'body'
    if o.type=='MESH' and o.parent and o.parent.type=='EMPTY':return 'moving_leaf'
    if o.type=='EMPTY' and any(c.type=='MESH' for c in o.children):return 'release_axis'
    if o.type=='MESH':
        ys=[(o.matrix_world@v.co).y for v in o.data.vertices]
        if min(ys)<-4.5 and max(ys)>4.5:return 'axle'
        if min(ys)>1.5:return 'fixed_ear_positive'
        if max(ys)<-1.5:return 'fixed_ear_negative'
    return None
def semantic_object(role):
    found=[o for o in bpy.context.scene.objects if semantic_id(o)==role]
    assert len(found)==1,(role,[o.name for o in found])
    return found[0]
def audit():
    bpy.context.view_layer.update();items=[];allv=[]
    for o in bpy.context.scene.objects:
        if o.type!='MESH':continue
        st,v,f=topology(o);allv+=v;items.append((o,st,v,BVHTree.FromPolygons(v,f,all_triangles=True)))
    pairs=[]
    for (a,_,av,at),(b,_,bv,bt) in itertools.combinations(items,2):
        hits=len(at.overlap(bt));dist=min([bt.find_nearest(p)[3] for p in av]+[at.find_nearest(p)[3] for p in bv])
        pairs.append({'a':a.name,'b':b.name,'roleA':semantic_id(a),'roleB':semantic_id(b),'surfaceTrianglePairs':hits,'sampledVertexSurfaceMm':dist})
    body=next(st for o,st,v,t in items if semantic_id(o)=='body')
    assert body['connected_components']==1 and body['nonmanifold_edges']==0
    leaf=next(st for o,st,v,t in items if semantic_id(o)=='moving_leaf')
    return {'bounds_mm':[max(v[i] for v in allv)-min(v[i] for v in allv) for i in range(3)],'parts':{o.name:st for o,st,v,t in items},'pairs':pairs,'leafUnionQualified':leaf['connected_components']==1 and leaf['nonmanifold_edges']==0,'mechanicalQualification':False}
def sphere(name,loc,scale,m):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=64,ring_count=32,location=loc);o=bpy.context.object;o.name=name;o.scale=scale;o.data.materials.append(m)
    for p in o.data.polygons:p.use_smooth=True
    return o
def worn(s):
    # Anatomically suggestive stylized, non-scan reference. Product retains mm scale.
    R=Matrix.Translation(Vector((0,121,23)))@Matrix.Rotation(-math.pi/2,4,'X')
    for o in list(s.objects):
        if o.type in ('MESH','EMPTY') and not o.parent:o.matrix_world=R@o.matrix_world
    skin=mat('Reference clay skin','B8A295',0,.7);hair=mat('Reference dark hair','302722',0,.5)
    sphere('Stylized cranium',(0,0,0),(76,91,102),skin)
    sphere('Jaw',(0,-17,-47),(61,68,57),skin)
    sphere('Neck',(0,9,-111),(34,37,51),skin)
    sphere('Nose',(0,-89,-8),(11,19,23),skin)
    for sign in (-1,1):sphere('Ear',(sign*74,0,-17),(11,19,27),skin)
    # Partial hair cap with deliberately visible hairline and a bun.
    v=[];f=[];N=80;K=24
    for i in range(K+1):
        for j in range(N):
            a=2*math.pi*j/N;b=(i/K)*(1.65+.43*math.sin(a))
            v.append((79*math.sin(b)*math.cos(a),94*math.sin(b)*math.sin(a),5+101*math.cos(b)))
    for i in range(K):
        for j in range(N):
            k=(j+1)%N;f.append((i*N+j,i*N+k,(i+1)*N+k,(i+1)*N+j))
    mesh('Reference hair cap',v,f,[hair],smooth=True)
    sphere('Gathered hair bun',(0,85,15),(48,36,40),hair)
    # Surface grooves communicate hair direction, not individual strands.
    for i in range(12):
        a=2*math.pi*i/12;cu=bpy.data.curves.new('Bun flow','CURVE');cu.dimensions='3D';cu.bevel_depth=.48;cu.bevel_resolution=2
        sp=cu.splines.new('POLY');sp.points.add(48)
        for j,p in enumerate(sp.points):
            t=.15+2.82*j/48;p.co=(48.3*math.sin(t)*math.cos(a),85+36.3*math.cos(t),15+40.3*math.sin(t)*math.sin(a),1)
        o=bpy.data.objects.new('Bun flow',cu);s.collection.objects.link(o);cu.materials.append(hair)
    for o in s.objects:
        if o.type=='LIGHT':o.location*=2.8;o.data.energy*=6;o.data.size*=2
    render(s,'worn-back',(120,360,125),(0,35,-5),275)
    render(s,'worn-profile',(350,160,80),(0,20,-5),275)
if mode=='build':build()
else:
    source=Path(arg('source')).resolve();bpy.ops.wm.open_mainfile(filepath=str(source));s=bpy.context.scene;configure(s)
    if mode=='audit':
        report=audit();report['sourceSha256']=sha(source);(out/'audit.json').write_text(json.dumps(report,indent=2))
    elif mode=='render':
        render(s,'metal-hero',(30,-80,130));render(s,'metal-top',(0,0,150));render(s,'metal-side',(0,-150,0));render(s,'metal-crown',(-90,-40,100),(-43,3,3),47)
        render(s,'mechanism-underside',(-40,-55,-115),(-45,0,0),48)
        clay=mat('Inspection clay','A7A7A7',0,.5)
        for l in s.view_layers:l.material_override=clay
        render(s,'clay-hero',(30,-80,130));render(s,'clay-crown',(-90,-40,100),(-43,3,3),47)
        zebra=bpy.data.materials.new('Normal-field zebra — not physical reflection');zebra.use_nodes=True;n=zebra.node_tree.nodes;n.clear();link=zebra.node_tree.links
        geo=n.new('ShaderNodeNewGeometry');dot=n.new('ShaderNodeVectorMath');dot.operation='DOT_PRODUCT';dot.inputs[1].default_value=(.49,.59,.64);link.new(geo.outputs['Normal'],dot.inputs[0])
        mult=n.new('ShaderNodeMath');mult.operation='MULTIPLY';mult.inputs[1].default_value=55;link.new(dot.outputs['Value'],mult.inputs[0])
        sine=n.new('ShaderNodeMath');sine.operation='SINE';link.new(mult.outputs[0],sine.inputs[0])
        ramp=n.new('ShaderNodeMath');ramp.operation='GREATER_THAN';ramp.inputs[1].default_value=0;link.new(sine.outputs[0],ramp.inputs[0])
        em=n.new('ShaderNodeEmission');link.new(ramp.outputs[0],em.inputs[0]);o=n.new('ShaderNodeOutputMaterial');link.new(em.outputs[0],o.inputs['Surface'])
        for l in s.view_layers:l.material_override=zebra
        render(s,'zebra-hero',(30,-80,130));render(s,'zebra-crown',(-90,-40,100),(-43,3,3),47)
        for l in s.view_layers:l.material_override=None
        worn(s)
    elif mode=='sweep':
        p=semantic_object('release_axis');samples=[]
        for deg in range(0,53,2):
            p.rotation_euler.y=math.radians(deg);bpy.context.view_layer.update()
            a=audit();hits=[x for x in a['pairs'] if x['surfaceTrianglePairs']]
            intended=[x for x in hits if ('body' in (x['roleA'],x['roleB']) and any(str(q).startswith('fixed_ear') for q in (x['roleA'],x['roleB'])))]
            # Classification is proposed by named fixed mating interface only, not spatially validated.
            samples.append({'degrees':deg,'leafMatrix':[list(row) for row in semantic_object('moving_leaf').matrix_world],'allOverlaps':hits,'proposedFixedRootMates':intended,'unclassified':[x for x in hits if x not in intended],'leafUnionQualified':a['leafUnionQualified']})
        result={'samples':samples,'shaftRadiusMm':1,'boreRadiusMm':1.15,'headRadiusMm':1.55,'earOuterYmm':4.0,'headInnerYmm':4.2,'nominalRadialClearanceMm':.15,'nominalAxialGapMm':.2,'retentionQualified':False,'limitations':'Sampled surface overlap, no swept-solid, contact force, axial extraction or assembly proof. Fixed-root contacts proposed but not locally qualified.'}
        (out/'sweep.json').write_text(json.dumps(result,indent=2))
    elif mode=='open-render':render(s,'open-mechanism',(-45,-80,-110),(-37,0,-5),80)
    elif mode=='preflight':
        configure(s,8);s.render.resolution_x=320;s.render.resolution_y=224;render(s,'preflight',(30,-80,130))
    else:raise ValueError(mode)
