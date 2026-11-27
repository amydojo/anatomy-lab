"""VECTOR 005 / AFTERBURN — editable Blender hard-surface blockout.
Run: blender -b -t 4 --python build_vector.py -- --out vector-output
Coordinate convention in authoring: x lateral, y vertical, z forward,
in atlas millidisplay units. Blender axes (x,-z,y). GLB is atlas Y-up.
This is a first volumetric interpretation, not creative approval.
"""
import bpy, math, sys, os, json
from mathutils import Vector
from math import pi, sin, cos
args=sys.argv[sys.argv.index('--')+1:] if '--' in sys.argv else []
out=args[args.index('--out')+1] if '--out' in args else 'vector-output'
os.makedirs(out,exist_ok=True)
bpy.ops.object.select_all(action='SELECT'); bpy.ops.object.delete(use_global=False)
scene=bpy.context.scene
scene.unit_settings.system='NONE'
def xyz(p): return (p[0],-p[2],p[1])
def material(name,c,metal,rough,em=0):
    m=bpy.data.materials.new(name);m.diffuse_color=(*c,1);m.use_nodes=True
    p=m.node_tree.nodes.get('Principled BSDF');p.inputs['Base Color'].default_value=(*c,1)
    p.inputs['Metallic'].default_value=metal;p.inputs['Roughness'].default_value=rough
    p.inputs['Emission Color'].default_value=(*c,1);p.inputs['Emission Strength'].default_value=em
    return m
blue=material('Midnight petrol',(.012,.065,.145),.82,.24)
orange=material('Velocity orange',(.95,.17,.012),.42,.25)
pink=material('Electric orchid',(.88,.014,.25),.5,.22)
silver=material('Surgical silver',(.57,.60,.65),.95,.23)
dark=material('Carbon obsidian',(.022,.026,.034),.08,.78)
frame=material('Black titanium',(.055,.063,.08),.82,.32)
amber=material('Thermal amber',(1,.27,.025),.15,.28,2.0)
ivory=material('Motorsport ivory',(.86,.80,.68),.15,.42)
groups={}
for name in ['front','rear','joint','front_pod','rear_pod']:
    c=bpy.data.collections.new(name);scene.collection.children.link(c);groups[name]=c
def mesh(name,g,verts,faces,mat,sub=0,bevel=0,smooth=True):
    data=bpy.data.meshes.new(name);data.from_pydata([xyz(v) for v in verts],[],faces);data.update()
    o=bpy.data.objects.new('__marrow_'+g+'_'+name,data);groups[g].objects.link(o);o.data.materials.append(mat)
    for p in data.polygons:p.use_smooth=smooth
    if sub:
        m=o.modifiers.new('Editable sculptural subdivision','SUBSURF');m.levels=sub;m.render_levels=sub
    if bevel:
        m=o.modifiers.new('Precision edge radius','BEVEL');m.width=bevel;m.segments=3
        m=o.modifiers.new('Weighted surface normals','WEIGHTED_NORMAL')
    # Editable per-object UVs, baked only when a texture actually exists.
    uv=data.uv_layers.new(name='UVMap')
    for p in data.polygons:
        for j in p.loop_indices:
            v=verts[data.loops[j].vertex_index];uv.data[j].uv=(v[0]/24+.5,(v[2]+38)/76)
    o['assembly']=g;return o
def loft(name,g,rows,mat,sub=2):
    # z, lateral center, half width, keel, shoulder, crown. Sculpted cross section
    # with a raised center, deep chine, undercut flank, not a flat extrusion.
    vs=[];fs=[]
    for z,c,w,keel,shoulder,crown in rows:
        vs += [(c+w*x,y,z) for x,y in [(-.58,keel),(.58,keel),(1,shoulder-.55),(.92,shoulder),(.49,crown),(0,crown+.28),(-.49,crown),(-.92,shoulder),(-1,shoulder-.55)]]
    n=9
    for k in range(len(rows)-1):
        for j in range(n):a=k*n+j;b=k*n+(j+1)%n;fs.append((a,b,b+n,a+n))
    fs += [tuple(reversed(range(n))),tuple(range(len(vs)-n,len(vs)))]
    return mesh(name,g,vs,fs,mat,sub)
def ribbon(name,g,rows,mat,sub=2):
    # arbitrary 3-D centerline, width and thickness; each section can sweep in
    # all three dimensions. Open channels exist between structural ribbons.
    vs=[];fs=[]
    for x,y,z,w,h in rows:
        vs += [(x-w,y,z),(x-w*.7,y+h*.5,z),(x+w*.7,y+h*.5,z),(x+w,y,z),(x+w*.66,y-h*.5,z),(x-w*.66,y-h*.5,z)]
    n=6
    for k in range(len(rows)-1):
        for j in range(n):a=k*n+j;b=k*n+(j+1)%n;fs.append((a,b,b+n,a+n))
    fs += [tuple(reversed(range(n))),tuple(range(len(vs)-n,len(vs)))]
    return mesh(name,g,vs,fs,mat,sub)
def ring(name,g,center,axis,profile,mat,n=64):
    # Profile is a closed radial cross-section, not a filled cylinder.
    vs=[];fs=[]
    for rad,depth in profile:
        for k in range(n):
            t=k*2*pi/n; a,b=rad*cos(t),rad*sin(t)
            local=(depth,a,b) if axis=='x' else (a,depth,b)
            vs.append(tuple(center[j]+local[j] for j in range(3)))
    for k in range(len(profile)):
        for j in range(n):
            a=k*n+j;b=k*n+(j+1)%n;c=((k+1)%len(profile))*n
            fs.append((a,b,c+(j+1)%n,c+j))
    return mesh(name,g,vs,fs,mat,0,0)
def segments(name,g,center,axis,r0,r1,depth,n,mat):
    vs=[];fs=[]
    for k in range(n):
        a=(k+.12)*2*pi/n;b=(k+.87)*2*pi/n;o=len(vs)
        for h in [depth,depth+.38]:
            for r,t in [(r0,a),(r1,a),(r1,b),(r0,b)]:
                p=(h,r*cos(t),r*sin(t)) if axis=='x' else (r*cos(t),h,r*sin(t))
                vs.append(tuple(center[j]+p[j] for j in range(3)))
        fs.extend(tuple(o+j for j in f) for f in [(0,3,2,1),(4,5,6,7),(0,1,5,4),(1,2,6,5),(2,3,7,6),(3,0,4,7)])
    return mesh(name,g,vs,fs,mat,0,.045)
# Hero: elongated front spear with narrow tip, broad sculpted shoulders and deep
# channels running rearward into the wheel arch. Separate suspended tread.
loft('spear_monocoque','front',[(37,0,.12,-.15,-.03,.18),(35,0,1.8,-.45,.15,.55),(30,-.25,5.2,-1.7,.6,1.9),(23,-.6,8.0,-2.9,1.2,2.9),(15,-.3,9.5,-2.8,1.4,3.5),(8,0,7.5,-1.8,.65,2.35),(5.2,0,4.2,-1.0,.35,1.25)],blue)
ribbon('orange_sweep','front',[(.1,.25,36,.13,.18),(2.7,1.25,30,1.1,.7),(5.6,2.15,23,1.85,1.05),(7.4,2.15,15,1.15,.9),(5.7,1.2,8,.55,.45)],orange)
ribbon('orchid_nose_chine','front',[(-.2,.12,36.6,.10,.12),(-2.5,.5,31,.55,.35),(-5.5,.95,23,.62,.4),(-7.8,.35,13,.32,.28),(-5.7,-.45,7,.12,.15)],pink)
# Swept, open sided spars wrap around the central mechanism without becoming
# two padded perimeter rings.
for s in [-1,1]:
    ribbon('swept_spar_'+str(s),'front',[(s*4.5,.0,28,.35,.45),(s*7.0,-1.4,22,.68,.85),(s*9.5,-.15,13,.8,1.3),(s*8.4,1.9,7,.72,1.2),(s*5.1,2.1,3.8,.5,.65)],silver)
    ribbon('lower_chine_'+str(s),'front',[(s*2,-1,31,.25,.45),(s*6,-2.65,23,.7,.65),(s*8.8,-2.2,15,.8,.8),(s*7.1,-.9,7,.4,.6)],frame)
loft('suspended_tread','front',[(29,0,1.4,1.8,2.2,2.5),(25,-.35,4.2,2.4,2.9,3.1),(19,-.4,6.0,3.1,3.5,3.75),(12,-.2,5.6,3.1,3.6,3.85),(8.5,0,3.1,2.25,2.75,3.0)],dark)
# Rear has shorter proportions, upturned tail and distinct orange sail.
loft('rear_diffuser','rear',[(-5.2,0,4.0,-1.1,.35,1.3),(-10,.2,6.4,-2.0,1,2.2),(-18,.4,8.7,-3,1.25,3.3),(-25,0,8.8,-2.8,1.65,3.5),(-32,-.2,5.7,-1.6,2.1,3.7),(-35.5,0,2.4,-.4,2.75,3.2)],blue)
loft('rear_tread','rear',[(-10,0,2.4,2.3,2.6,2.8),(-15,.4,5.2,2.7,3.25,3.45),(-22,.35,6.1,3.15,3.65,3.9),(-28,0,4.7,3.4,3.8,4.05),(-30,0,1.8,3.5,3.9,4.1)],dark)
for s in [-1,1]:
    ribbon('tail_spar_'+str(s),'rear',[(s*4.1,.4,-6,s*.0+.45,.6),(s*7.4,-.8,-12,.65,1.1),(s*9.2,-.25,-22,.8,1.2),(s*7.0,1.4,-30,.7,1),(s*4.2,3.0,-34,.55,.65),(s*3.5,5.5,-32,.48,.55),(s*5.0,6.1,-26.5,.38,.45)],silver)
ribbon('orange_tail_sail','rear',[(-5.4,.2,-8,.65,.45),(-7.5,.6,-16,1.3,.8),(-8.0,1.2,-23,1.3,1),(-5.2,3.0,-33,1.1,.85),(-3.7,5.5,-32,1.1,.8),(-1.7,6.5,-28,1.5,.6),(2.3,6.4,-25.5,.85,.3)],orange)
ribbon('orchid_tail_arch','rear',[(5.4,.1,-8,.55,.35),(7.5,.6,-17,.7,.5),(7.5,1.6,-25,.6,.5),(4.7,3.8,-33,.5,.5),(2.8,6.0,-31,.6,.45),(-.5,6.75,-26,.8,.35)],pink)
# Central transverse gimbal with real concentric open rings. Compact fixed
# core; front/rear spars overlap its ends only, requiring clearance review.
ring('gyro_outer','joint',(0,0,0),'x',[(5.8,-3.0),(6.7,-2.6),(6.9,2.6),(6.2,3.0),(5.6,2.7),(5.6,-2.7)],frame)
for s in [-1,1]:
    ring('gyro_collar_'+str(s),'joint',(0,0,0),'x',[(4.9,s*3.0),(6.1,s*3.0),(6.1,s*3.8),(5.0,s*4.1),(4.6,s*3.7)],silver)
    segments('gyro_thermal_'+str(s),'joint',(0,0,0),'x',5.0,5.8,s*3.84,24,amber)
    ring('gyro_inner_'+str(s),'joint',(0,0,0),'x',[(2.3,s*3.8),(4.5,s*3.8),(4.9,s*4.5),(2.3,s*4.5)],frame)
# Recessed underbody propulsion, independently gimballed via existing IDs.
for g,z,r in [('front_pod',20,6.8),('rear_pod',-23,6.4)]:
    ring('housing',g,(0,-3,z),'y',[(r*.60,-3.3),(r,-2.6),(r+.35,-1.2),(r*.95,.35),(r*.66,1.2),(r*.57,-3.1)],frame)
    ring('machined_lip',g,(0,-3,z),'y',[(r*.65,-3.0),(r*.94,-3.0),(r*.98,-2.4),(r*.86,-2.0),(r*.65,-2.5)],silver)
    segments('thermal_array',g,(0,-3,z),'y',r*.40,r*.83,-3.28,24,amber)
    ring('hub',g,(0,-3,z),'y',[(.6,-3.35),(r*.32,-3.35),(r*.39,-2.7),(r*.30,-1.8),(.6,-1.8)],frame)
# Directional four-point velocity insignia (not a flower). One integrated
# surface graphic, provisional placement; full wordmark is editable SVG.
def emblem(g,z,y):
    v=[(0,y,z+5),(.72,y,z+.8),(4.4,y,z+.18),(.62,y,z-.63),(0,y,z-5),(-.55,y,z-.6),(-3.6,y,z-.1),(-.52,y,z+.55)]
    mesh('velocity_emblem',g,v,[tuple(range(8))],pink,0,0,False)
emblem('rear',-21,4.24)
# Marking source uses filled angular outlines rather than system typography.
glyph={'M':[[0,1],[0,0],[.24,0],[.5,.38],[.76,0],[1,0],[1,1],[.76,1],[.76,.38],[.5,.78],[.24,.38],[.24,1]],'A':[[0,1],[.28,0],[.72,0],[1,1],[.74,1],[.64,.65],[.36,.65],[.26,1]],'P':[[0,1],[0,0],[.8,0],[1,.18],[1,.56],[.8,.72],[.25,.72],[.25,1]],'O':[[.16,0],[.84,0],[1,.16],[1,.84],[.84,1],[.16,1],[0,.84],[0,.16]],'D':[[0,0],[.73,0],[1,.26],[1,.74],[.73,1],[0,1]],'F':[[0,0],[1,0],[1,.24],[.26,.24],[.26,.43],[.8,.43],[.8,.67],[.26,.67],[.26,1],[0,1]],'U':[[0,0],[.25,0],[.25,.76],[.75,.76],[.75,0],[1,0],[1,.84],[.84,1],[.16,1],[0,.84]]}
holes={'A':[[.43,.39],[.57,.39],[.61,.52],[.39,.52]],'P':[[.25,.24],[.73,.24],[.73,.48],[.25,.48]],'O':[[.25,.24],[.75,.24],[.75,.76],[.25,.76]],'D':[[.25,.24],[.61,.24],[.75,.37],[.75,.63],[.61,.76],[.25,.76]]}
svg=['<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1050 100">']
for i,ch in enumerate('MAPO DOFU'):
    if ch==' ':continue
    def path(poly):return 'M'+' L'.join(f'{i*112+x*100+(1-y)*18:.2f},{y*100:.2f}' for x,y in poly)+'Z'
    svg.append('<path fill="#e8ddc9" fill-rule="evenodd" d="'+path(glyph[ch])+(' '+path(holes[ch]) if ch in holes else '')+'"/>')
svg.append('</svg>')
open(os.path.join(out,'mapo-dofu-wordmark.svg'),'w').write(''.join(svg))
# Import the exact editable vector outline as geometry; location is a
# provisional flat side applique, not a baked texture.
try:
    bpy.ops.import_curve.svg(filepath=os.path.join(os.path.abspath(out),'mapo-dofu-wordmark.svg'))
    imported=list(bpy.context.selected_objects)
    # SVG import may not select objects; identify curves created by importer.
    imported=[o for o in scene.objects if o.type=='CURVE']
    if imported:
        bpy.ops.object.select_all(action='DESELECT')
        for o in imported:o.select_set(True)
        bpy.context.view_layer.objects.active=imported[0];bpy.ops.object.convert(target='MESH');bpy.ops.object.join()
        o=bpy.context.object; bpy.ops.object.transform_apply(location=True,rotation=True,scale=True)
        vs=[v.co.copy() for v in o.data.vertices];lo=[min(v[k] for v in vs) for k in range(2)];hi=[max(v[k] for v in vs) for k in range(2)]
        for v in o.data.vertices:
            u=(v.co.x-lo[0])/max(1e-9,hi[0]-lo[0]);q=(v.co.y-lo[1])/max(1e-9,hi[1]-lo[1])
            # Front left side rail: lengthwise wordmark, subtle angled surface.
            v.co=xyz((-7.3+.5*q, .3+q*1.55, 26-u*14))
        o.name='__marrow_front_wordmark';o.data.materials.clear();o.data.materials.append(ivory)
        for c in list(o.users_collection):c.objects.unlink(o)
        groups['front'].objects.link(o)
except Exception as e:
    print('VECTOR_WORDMARK_IMPORT_UNVERIFIED',str(e))
# Recalculate mesh normals; keep editable modifiers and control cages in master.
for o in list(scene.objects):
    if o.type!='MESH':continue
    bpy.ops.object.select_all(action='DESELECT');o.select_set(True);bpy.context.view_layer.objects.active=o
    bpy.ops.object.mode_set(mode='EDIT');bpy.ops.mesh.select_all(action='SELECT');bpy.ops.mesh.normals_make_consistent(inside=False);bpy.ops.object.mode_set(mode='OBJECT')
bpy.ops.object.select_all(action='DESELECT')
bpy.ops.wm.save_as_mainfile(filepath=os.path.abspath(os.path.join(out,'VECTOR-005-master.blend')))
# Render master in actual Blender; no generated concept image substituted.
def camera(name,loc,target,ortho=None):
    d=bpy.data.cameras.new(name);o=bpy.data.objects.new(name,d);scene.collection.objects.link(o);o.location=xyz(loc);o.rotation_euler=(Vector(xyz(target))-o.location).to_track_quat('-Z','Y').to_euler()
    if ortho:d.type='ORTHO';d.ortho_scale=ortho
    else:d.lens=55
    return o
def light(name,loc,power,size,color):
    d=bpy.data.lights.new(name,'AREA');d.energy=power;d.shape='DISK';d.size=size;d.color=color;o=bpy.data.objects.new(name,d);scene.collection.objects.link(o);o.location=xyz(loc);o.rotation_euler=(-o.location).to_track_quat('-Z','Y').to_euler()
light('Key softbox',(-38,65,38),65000,48,(.76,.87,1))
light('Warm rim',(45,28,-45),55000,37,(1,.54,.25))
light('Orchid rim',(-30,13,-42),24000,29,(1,.20,.52))
light('Underside fill',(15,-40,25),36000,36,(.65,.75,1))
scene.world.color=(.12,.12,.12)
scene.render.engine='CYCLES';scene.cycles.samples=24;scene.cycles.use_denoising=True
scene.render.resolution_x=900;scene.render.resolution_y=650;scene.render.resolution_percentage=100
scene.render.image_settings.file_format='PNG'
for name,loc,ortho in [('hero',(-82,56,105),None),('top',(0,125,.01),90),('side',(-125,0,0),90),('underside',(0,-125,.01),90),('front',(0,8,125),32),('rear',(0,8,-125),32)]:
    scene.camera=camera(name,loc,(0,0,0),ortho);scene.render.filepath=os.path.abspath(os.path.join(out,name+'.png'));bpy.ops.render.render(write_still=True)
# Runtime derivative: apply sculptural modifiers, decimate geometry per part,
# keep groups/pivot origin exactly at board center. Scale to atlas units.
bpy.ops.object.select_all(action='DESELECT');stats=[]
for o in list(scene.objects):
    if o.type!='MESH':continue
    bpy.context.view_layer.objects.active=o;o.select_set(True)
    for mod in list(o.modifiers):bpy.ops.object.modifier_apply(modifier=mod.name)
    o.data.calc_loop_triangles();master=len(o.data.loop_triangles)
    if master>300:
        m=o.modifiers.new('Runtime derivative','DECIMATE');m.ratio=max(.12,min(1.,300/master));bpy.ops.object.modifier_apply(modifier=m.name)
    for v in o.data.vertices:v.co*=.001
    o.location*=.001;o.data.calc_loop_triangles()
    stats.append({'name':o.name,'masterTriangles':master,'runtimeTriangles':len(o.data.loop_triangles),'vertices':len(o.data.vertices)})
    o.select_set(False)
for o in scene.objects:
    if o.type=='MESH':o.select_set(True)
bpy.ops.export_scene.gltf(filepath=os.path.abspath(os.path.join(out,'VECTOR-005-preview.glb')),export_format='GLB',use_selection=True,export_yup=True,export_apply=True,export_extras=True)
json.dump({'blender':bpy.app.version_string,'parts':stats,'masterTriangles':sum(x['masterTriangles'] for x in stats),'runtimeTriangles':sum(x['runtimeTriangles'] for x in stats),'qualification':'unapproved volumetric candidate; no texture bake or intersection certification'},open(os.path.join(out,'build-report.json'),'w'),indent=2)
print('VECTOR_BUILD_REPORT',json.dumps(stats))
