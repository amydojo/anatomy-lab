"""COUTURE 001: editable millimetre-scale industrial design studies.
Run Blender background with -- --out <directory>. No riding asset edits.
"""
import bpy, math, json, sys, os, hashlib, itertools
from mathutils import Vector, Matrix
from mathutils.bvhtree import BVHTree
from pathlib import Path
out=Path(sys.argv[sys.argv.index('--out')+1]).resolve()
out.mkdir(parents=True,exist_ok=True)
P={'silver':'D5D0C8','petrol':'103C59','orchid':'F52BAA','carbon':'181C23','orange':'FF6900','amber':'FFAD49'}
def lin(x): return x/12.92 if x<=.04045 else ((x+.055)/1.055)**2.4
def mat(key,metal=.85,rough=.25):
    m=bpy.data.materials.new(key);m.use_nodes=True
    p=m.node_tree.nodes.get('Principled BSDF')
    p.inputs['Base Color'].default_value=tuple(lin(int(P[key][i:i+2],16)/255) for i in (0,2,4))+(1,)
    p.inputs['Metallic'].default_value=metal;p.inputs['Roughness'].default_value=rough
    return m
def ribbon(name,sections,m,bevel=.18):
    # Cross section is a flattened octagon, not a circular rail.
    # sections = x,y,z,half-width,half-thickness,twist radians
    profile=[(-.75,-1),(.75,-1),(1,-.45),(1,.45),(.75,1),(-.75,1),(-1,.45),(-1,-.45)]
    v=[];f=[]
    for x,y,z,w,h,a in sections:
        for u,t in profile:
            q=u*w;s=t*h
            v.append((x,y+q*math.cos(a)-s*math.sin(a),z+q*math.sin(a)+s*math.cos(a)))
    f.append(tuple(range(7,-1,-1)))
    for i in range(len(sections)-1):
        for j in range(8):f.append((8*i+j,8*i+(j+1)%8,8*(i+1)+(j+1)%8,8*(i+1)+j))
    f.append(tuple(range(8*(len(sections)-1),8*len(sections))))
    d=bpy.data.meshes.new(name);d.from_pydata(v,[],f);d.update()
    o=bpy.data.objects.new(name,d);bpy.context.collection.objects.link(o);d.materials.append(m)
    mod=o.modifiers.new('Edge break — unqualified','BEVEL');mod.width=bevel;mod.segments=3
    mod=o.modifiers.new('Planar reflection normals','WEIGHTED_NORMAL')
    return o
def tube(name,fn,m,n=45,bevel=.18):
    return ribbon(name,[fn(i/(n-1)) for i in range(n)],m,bevel)
def make(code):
    bpy.ops.wm.read_factory_settings(use_empty=True)
    s=bpy.context.scene;s.unit_settings.system='METRIC';s.unit_settings.scale_length=.001
    m={k:mat(k,.78 if k=='petrol' else .9 if k=='silver' else .3,.19 if k=='silver' else .28) for k in P}
    parts=[];clasp=None
    if code=='C01':
        # Long asymmetric tapered stick with a nested raised blade and deliberate seam.
        parts.append(tube('LANCET — structural spine',lambda t:(-65+130*t,1.5*math.sin(math.pi*t),0,.8+4.8*math.sin(math.pi*t)**.8,.65+1.25*math.sin(math.pi*t),.22*math.sin(2*math.pi*t)),m['petrol']))
        parts.append(tube('LANCET — folded silver blade',lambda t:(-55+103*t,-1.2+1.6*math.sin(math.pi*t),3.1,.65+2.9*math.sin(math.pi*t),.45+.4*math.sin(math.pi*t),-.2*math.sin(math.pi*t)),m['silver']))
        parts.append(ribbon('Orchid activation insert',[(-52,0,4.4,1,.35,0),(-46,0,4.4,1.4,.35,0)],m['orchid']))
    elif code=='C02':
        # Two divergent, curved prongs from one elevated crown. Separate interlocking visual ribbons.
        for sign in (-1,1):
            parts.append(tube('SERPENT — '+str(sign)+' prong',lambda t,sign=sign:(-47+105*t,sign*(3.8+10*math.sin(math.pi*t*.75)),2.5*math.sin(math.pi*t),.8+3.0*math.sin(math.pi*t)**.7,.7+.75*math.sin(math.pi*t),sign*.65*math.sin(2*math.pi*t)),m['silver' if sign==1 else 'petrol']))
        parts.append(tube('SERPENT — raised crown ribbon',lambda t:(-57+45*t,3*math.sin(2*math.pi*t),5.4+2*math.sin(math.pi*t),1.2+5*math.sin(math.pi*t),.9,.55*math.sin(2*math.pi*t)),m['silver']))
        parts.append(ribbon('Orchid crown insert',[(-51,0,8.1,1,.35,0),(-45,0,8.1,1,.35,0)],m['orchid']))
    else:
        parts.append(tube('SWITCH — architectural shell',lambda t:(-46+92*t,0,3.5+2.3*math.sin(math.pi*t),3.8+7.4*math.sin(math.pi*t)**.65,1.25,.18*math.sin(2*math.pi*t)),m['petrol']))
        for sign in (-1,1):
            parts.append(tube('SWITCH — silver edge '+str(sign),lambda t,sign=sign:(-44+88*t,sign*(3+7.5*math.sin(math.pi*t)),5.4+2.1*math.sin(math.pi*t),1.0+1.2*math.sin(math.pi*t),.6,sign*.25),m['silver']))
        clasp=tube('SWITCH — proposed deployant leaf',lambda t:(-40+80*t,0,-2.7-1.7*math.sin(math.pi*t),1.8+1.3*math.sin(math.pi*t),.7,0),m['silver'])
        parts.append(clasp)
        parts.append(ribbon('Orchid release insert',[(34,0,5.7,1.3,.4,0),(41,0,5.7,1.3,.4,0)],m['orchid']))
    return parts,clasp
def evaluated(o):
    dg=bpy.context.evaluated_depsgraph_get();e=o.evaluated_get(dg);mesh=e.to_mesh()
    v=[e.matrix_world@a.co for a in mesh.vertices];f=[tuple(p.vertices) for p in mesh.polygons];e.to_mesh_clear()
    return v,f
def evidence(parts):
    bpy.context.view_layer.update()
    vv=[];trees=[]
    for o in parts:
        v,f=evaluated(o);vv+=v;trees.append(BVHTree.FromPolygons(v,f,all_triangles=False))
    hits=[]
    for i in range(len(parts)):
        for j in range(i):
            n=len(trees[i].overlap(trees[j]))
            if n:hits.append({'pair':[parts[j].name,parts[i].name],'surfaceOverlapPairs':n})
    return {'bounds_mm':[round(max(v[k] for v in vv)-min(v[k] for v in vv),3) for k in range(3)],'surface_intersections':hits,'note':'BVH surface intersections only; no containment, tolerance, structural, scalp or retention certification.'}
def camera(scene,location,target=(0,0,0),scale=155):
    d=bpy.data.cameras.new('Inspection');o=bpy.data.objects.new('Inspection',d);scene.collection.objects.link(o);scene.camera=o;d.type='ORTHO';d.ortho_scale=scale;d.clip_end=1500
    o.location=location;o.rotation_euler=(Vector(target)-o.location).to_track_quat('-Z','Y').to_euler();return o
def studio():
    s=bpy.context.scene
    s.world=bpy.data.worlds.new('Neutral studio');s.world.use_nodes=True;s.world.node_tree.nodes['Background'].inputs[0].default_value=(.18,.18,.18,1)
    for name,loc,power,size in [('Key',(-30,-75,105),85000,90),('Strip',(45,65,70),70000,70),('Rim',(0,-10,-80),30000,65)]:
        d=bpy.data.lights.new(name,'AREA');d.energy=power;d.shape='RECTANGLE';d.size=size;d.size_y=size*.27
        o=bpy.data.objects.new(name,d);s.collection.objects.link(o);o.location=loc;o.rotation_euler=(-o.location).to_track_quat('-Z','Y').to_euler()
    s.render.engine='CYCLES';s.cycles.device='CPU';s.cycles.samples=48;s.cycles.use_denoising=False;s.render.resolution_x=1000;s.render.resolution_y=700;s.render.resolution_percentage=100;s.render.image_settings.file_format='PNG'
    for layer in s.view_layers:layer.cycles.use_denoising=False
    s.render.threads_mode='FIXED';s.render.threads=4
    return s
def render(s,cam,loc,path,scale=155,target=(0,0,0)):
    cam.location=loc;cam.rotation_euler=(Vector(target)-cam.location).to_track_quat('-Z','Y').to_euler();cam.data.ortho_scale=scale;s.render.filepath=str(path);bpy.ops.render.render(write_still=True)

def sha(p):return hashlib.sha256(Path(p).read_bytes()).hexdigest()
def audit(parts):
    bpy.context.view_layer.update()
    items=[]
    for o in parts:
        v,f=evaluated(o)
        items.append((o,v,BVHTree.FromPolygons(v,f,all_triangles=False)))
    pairs=[]
    for (a,av,at),(b,bv,bt) in itertools.combinations(items,2):
        hits=len(at.overlap(bt))
        # Bidirectional vertex-to-surface distances: sampled upper bound, not exact solid clearance.
        dist=min([bt.find_nearest(v)[3] for v in av]+[at.find_nearest(v)[3] for v in bv])
        pairs.append({'a':a.name,'b':b.name,'surfaceOverlapPairs':hits,'sampledVertexSurfaceDistanceMm':round(dist,5),'state':'surface_intersection' if hits else 'no_sampled_surface_intersection','mechanicalConnectionEstablished':False})
    return {**evidence(parts),'pairs':pairs,'objects':[{'name':o.name,'vertices':len(v),'parent':o.parent.name if o.parent else None,'constraints':len(o.constraints)} for o,v,t in items],'limitations':'No hinge pin, fastening, bonding, containment or structural tests. Nonintersection is not proof of separation; distance is sampled, not exact clearance.'}
def configure(s,samples):
    s.render.engine='CYCLES';s.cycles.device='CPU';s.cycles.samples=samples;s.cycles.use_denoising=False
    for l in s.view_layers:l.cycles.use_denoising=False
    s.render.threads_mode='FIXED';s.render.threads=4
def arg(k,default=None):return sys.argv[sys.argv.index('--'+k)+1] if '--'+k in sys.argv else default
mode=arg('mode','generate');code=arg('candidate')
if mode=='generate':
    for code in ('C01','C02','C03'):
        parts,clasp=make(code);s=studio();cam=camera(s,(35,-80,130))
        bpy.ops.wm.save_as_mainfile(filepath=str(out/(code+'.blend')))
        if clasp:
            base=clasp.matrix_world.copy();pivot=Vector((-40,0,-2.7))
            clasp.matrix_world=Matrix.Translation(pivot)@Matrix.Rotation(math.radians(75),4,'Y')@Matrix.Translation(-pivot)@base
            bpy.context.view_layer.update()
            bpy.ops.wm.save_as_mainfile(filepath=str(out/(code+'-open.blend')))
elif mode in ('reopen','render','preflight'):
    source=Path(arg('source')).resolve()
    bpy.ops.wm.open_mainfile(filepath=str(source))
    s=bpy.context.scene;cam=s.camera
    parts=[o for o in s.objects if o.type=='MESH']
    assert len(parts)=={'C01':3,'C02':4,'C03':5}[code] and cam
    assert abs(s.unit_settings.scale_length-.001)<1e-8
    clasp=next((o for o in parts if 'deployant leaf' in o.name),None)
    configure(s,48)
    if mode=='reopen':
        report={'masterSha256':sha(source),'candidate':code,**audit(parts)}
        if clasp:
            base=clasp.matrix_world.copy();p=Vector((-40,0,-2.7));samples=[]
            for deg in range(0,76,5):
                clasp.matrix_world=Matrix.Translation(p)@Matrix.Rotation(math.radians(deg),4,'Y')@Matrix.Translation(-p)@base
                samples.append({'degrees':deg,**evidence(parts)})
            clasp.matrix_world=base;report['clasp_samples']=samples
        (out/(code+'-reopen.json')).write_text(json.dumps(report,indent=2))
    elif mode=='preflight':
        configure(s,8);s.render.resolution_x=320;s.render.resolution_y=224
        render(s,cam,(30,-80,130),out/'preflight.png')
        assert (out/'preflight.png').stat().st_size>1000
        (out/'preflight.json').write_text(json.dumps({'blender':bpy.app.version_string,'samples':8,'denoising':False,'imageSha256':sha(out/'preflight.png'),'masterSha256':sha(source)},indent=2))
    else:
        report=audit(parts)
        # Fixed matched camera scale and neutral lighting across all three candidates.
        for label,loc in [('hero',(30,-80,130)),('top',(0,0,150)),('side',(0,-150,0)),('reverse',(-45,95,110))]:
            render(s,cam,loc,out/(code+'-'+label+'.png'))
        render(s,cam,(-60,-55,100),out/(code+'-detail.png'),45,(-40 if code!='C03' else 34,0,3))
        if clasp:
            render(s,cam,(30,-85,75),out/(code+'-clasp-closed.png'))
            base=clasp.matrix_world.copy();p=Vector((-40,0,-2.7))
            clasp.matrix_world=Matrix.Translation(p)@Matrix.Rotation(math.radians(75),4,'Y')@Matrix.Translation(-p)@base
            render(s,cam,(30,-85,75),out/(code+'-clasp-open.png'))
            clasp.matrix_world=base
        # A tangent placement on assumed ellipsoid, not hair or validated fit.
        bpy.ops.mesh.primitive_uv_sphere_add(segments=48,ring_count=24,location=(0,0,-100))
        head=bpy.context.object;head.name='REFERENCE ONLY — 160 x 190 x 200 mm ellipsoid';head.scale=(80,95,100)
        m=bpy.data.materials.new('Neutral reference');m.use_nodes=True;m.node_tree.nodes.get('Principled BSDF').inputs['Base Color'].default_value=(.12,.12,.12,1);m.node_tree.nodes.get('Principled BSDF').inputs['Roughness'].default_value=.65;head.data.materials.append(m)
        for poly in head.data.polygons:poly.use_smooth=True
        render(s,cam,(80,-230,190),out/(code+'-head-envelope.png'),270,(0,0,-45))
        report['sourceSha256']=sha(source);report['renderSamples']=48;report['denoising']=False
        (out/(code+'-render-evidence.json')).write_text(json.dumps(report,indent=2))
else:raise ValueError(mode)
