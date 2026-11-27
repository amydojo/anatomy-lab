"""VECTOR 005 / INCARNATION 002 — SCULPT.
Editable, reference-landmarked hard-surface master ONLY. No runtime export,
decimation, livery, physics changes or edits to FIRST LIGHT.
Authoring coordinates x lateral, y height, z nose-forward; Blender (x,-z,y).
"""
import bpy, math, os, sys, json, bmesh
from mathutils import Vector
from math import pi,sin,cos
args=sys.argv[sys.argv.index('--')+1:]
out=os.path.abspath(args[args.index('--out')+1]);os.makedirs(out,exist_ok=True)
bpy.ops.wm.read_factory_settings(use_empty=True)
scene=bpy.context.scene
def xyz(p):return (p[0],-p[2],p[1])
def clay(name,tone,rough):
    m=bpy.data.materials.new(name);m.diffuse_color=(tone,tone,tone,1);m.use_nodes=True
    p=m.node_tree.nodes.get('Principled BSDF');p.inputs['Base Color'].default_value=(tone,tone,tone,1);p.inputs['Roughness'].default_value=rough
    return m
shell=clay('Neutral clay / bodywork',.46,.34)
inset=clay('Neutral clay / recessed standing zone',.32,.52)
mechanical=clay('Neutral clay / mechanical interior',.38,.40)
groups={}
for g in ['front','rear','joint','front_pod','rear_pod','construction_guides']:
    c=bpy.data.collections.new(g);scene.collection.children.link(c);groups[g]=c
groups['construction_guides'].hide_render=True
def mesh(name,g,verts,faces,mat,crease_edges=(),sub=0,bevel=0):
    d=bpy.data.meshes.new(name);d.from_pydata([xyz(v) for v in verts],[],faces);d.update()
    o=bpy.data.objects.new(name,d);groups[g].objects.link(o);o.data.materials.append(mat);o['assembly']=g
    bm=bmesh.new();bm.from_mesh(d);bmesh.ops.recalc_face_normals(bm,faces=list(bm.faces));bm.to_mesh(d);bm.free()
    if crease_edges:
        attr=d.attributes.new('crease_edge','FLOAT','EDGE');weights={tuple(sorted((a,b))):w for a,b,w in crease_edges}
        for e in d.edges:attr.data[e.index].value=weights.get(tuple(sorted(e.vertices)),0)
    for p in d.polygons:p.use_smooth=True
    if sub:
        m=o.modifiers.new('Tensioned control cage','SUBSURF');m.levels=sub;m.render_levels=sub;m.use_creases=True
    if bevel:
        m=o.modifiers.new('Machined edge break','BEVEL');m.width=bevel;m.segments=3;m.limit_method='ANGLE'
        n=o.modifiers.new('Weighted hard surface normals','WEIGHTED_NORMAL')
    return o
def section_cage(name,g,rows,mat,crease,sub=2):
    # Explicit profiles with nonuniform rail weights. Selective longitudinal
    # creases create character lines, shoulder breaks and thin leading edges.
    n=len(rows[0]);vs=[v for row in rows for v in row];fs=[];ce=[]
    for i in range(len(rows)-1):
        for j in range(n):
            a=i*n+j;b=i*n+(j+1)%n;fs.append((a,b,b+n,a+n))
            if j in crease:ce.append((a,a+n,crease[j]))
    fs.extend([tuple(reversed(range(n))),tuple(range(len(vs)-n,len(vs)))])
    for i in [0,len(rows)-1]:
        for j in range(n):ce.append((i*n+j,i*n+(j+1)%n,.8))
    return mesh(name,g,vs,fs,mat,ce,sub)
def guide(name,pts):
    # Editable Bezier construction rail, derived from authored landmarks.
    c=bpy.data.curves.new(name,'CURVE');c.dimensions='3D';s=c.splines.new('BEZIER');s.bezier_points.add(len(pts)-1)
    for p,v in zip(s.bezier_points,pts):p.co=xyz(v);p.handle_left_type=p.handle_right_type='AUTO'
    o=bpy.data.objects.new(name,c);groups['construction_guides'].objects.link(o);o.hide_set(True)
    return o
# z, inner edge, outer edge, deck seam height, crown ridge height,
# outer blade edge height, underside chine height.
# These are individual design landmarks, NOT scaled copies of a section.
FRONT=[(38,.04,.17,-.02,.04,-.02,-.11),(37.5,.08,.61,.08,.16,.01,-.25),(34,.22,3.1,.50,.94,.20,-.75),(30,1.15,5.8,1.25,2.1,.38,-1.8),(26,3.2,8.2,2.35,3.3,.35,-3.5),(20,5.3,10.2,3.15,4.0,.18,-4.8),(14,5.65,10.35,3.2,4.45,.65,-4.4),(9,4.7,9.6,2.95,4.9,1.05,-3.05),(5,3.55,8.1,2.45,5.65,1.8,-1.9),(2.5,3.2,6.15,1.5,4.9,1.45,-.85),(2.1,3.2,5.9,1.45,4.65,1.4,-.8)]
REAR=[(-2.1,3.15,5.95,1.45,4.65,1.4,-.8),(-2.6,3.15,6.4,1.55,4.85,1.6,-.85),(-6,3.7,8.1,2.4,5.1,1.8,-2.1),(-11,4.9,9.3,3.0,4.2,1.2,-3.5),(-18,5.6,10.1,3.4,4.25,.65,-4.75),(-24,5.4,10.15,3.7,4.7,1.05,-4.5),(-29,3.65,9.0,4.2,5.15,2.2,-3.1),(-33,1.8,7.0,4.75,5.65,3.4,-1.2),(-35.2,.85,5.0,4.9,5.55,3.8,.2),(-35.6,.7,4.7,4.85,5.4,3.75,.35)]
def flank(g,stations,side):
    rows=[];ridge=[];blade=[]
    for z,a,b,t,h,e,k in stations:
        w=b-a
        # Swept wide upper facet, crisp ridge, sharp outer chine, deep
        # concave undercut into the lower pod aperture. No attached thin rail.
        profile=[(a,t),(a+.08*w,t+.08),(a+.43*w,h),(a+.52*w,h-.08),(b-.06*w,e+.12),(b,e),(b-.22*w,k+.2),(a+.25*w,k),(a+.04*w,t-.65)]
        row=[(side*x,y,z) for x,y in profile]
        if side<0:row.reverse()
        rows.append(row);ridge.append((side*(a+.43*w),h,z));blade.append((side*b,e,z))
    weights={0:.72,2:.74,4:.75,5:.95,6:.68,7:.58,8:.70}
    if side<0:weights={8-k:v for k,v in weights.items()}
    section_cage(g+'_integral_chine_'+('L' if side<0 else 'R'),g,rows,shell,weights)
    guide(g+'_ridge_'+str(side),ridge);guide(g+'_blade_'+str(side),blade)
for g,stations in [('front',FRONT),('rear',REAR)]:
    for side in [-1,1]:flank(g,stations,side)
def bridge(name,g,rows,mat,sub=2):
    # Each cross section is a separately authored upper plane / chamfer /
    # lower keel with a thin knife edge. No uniformly inflated crown.
    profiles=[]
    for z,w,t,b in rows:
        ch=min(.32,w*.25,(t-b)*.35)
        profiles.append([(-w+ch,t,z),(w-ch,t,z),(w,t-ch,z),(w*.82,b+ch,z),(w*.63,b,z),(-w*.63,b,z),(-w*.82,b+ch,z),(-w,t-ch,z)])
    return section_cage(name,g,profiles,mat,{0:.78,1:.86,2:.84,3:.62,4:.75,5:.62,6:.84,7:.86},sub)
# Long, narrow solid blade with planar upper face, flowing into open side
# sections. Stop before the footwell so the central opening is real.
bridge('front_scalpel_keel','front',[(38,.12,.04,-.10),(37.5,.53,.13,-.25),(34,2.85,.72,-.80),(30,5.25,1.55,-1.65),(26,5.8,2.5,-1.9),(24.5,4.0,2.65,-1.3)],shell)
# Angular embedded standing zones follow the seam height of the bodywork.
# Lower webs support them while preserving the side undercuts.
bridge('front_footwell','front',[(28,1.8,2.0,1.5),(26,3.9,2.62,2.0),(22,5.05,3.35,2.6),(16,5.35,3.38,2.6),(11,4.6,3.15,2.45),(8.7,3.2,2.9,2.35)],inset,1)
bridge('rear_footwell','rear',[(-9,2.8,2.8,2.2),(-12,4.4,3.22,2.5),(-18,5.35,3.63,2.85),(-24,5.1,3.92,3.15),(-28,4.15,4.24,3.4),(-30.5,2.5,4.52,3.7)],inset,1)
bridge('rear_diffuser_bridge','rear',[(-29,4.0,3.7,1.0),(-32.5,6.0,4.45,.8),(-35.2,4.9,4.6,2.6),(-35.6,4.5,4.55,2.8)],shell)
# Substantial swept rear wing: two roots rise into a broad transverse
# aerofoil. This is a spanwise section cage, not a thin outline or hoop.
tail=[]
for x,zlead,ztrail,top,base in [(-7.2,-28.8,-33.5,4.5,2.4),(-6.8,-27.8,-34.2,5.0,3.0),(-5,-24.8,-34.0,7.0,5.8),(-2.5,-23.8,-33.4,8.0,7.1),(0,-23.5,-33.0,8.25,7.4),(2.5,-23.8,-33.4,8.0,7.1),(5,-24.8,-34.0,7.0,5.8),(6.8,-27.8,-34.2,5.0,3.0),(7.2,-28.8,-33.5,4.5,2.4)]:
    span=zlead-ztrail
    tail.append([(x,top-.2,zlead),(x,top,zlead-.2*span),(x,top-.22,ztrail+.12*span),(x,top-.52,ztrail),(x,base,ztrail+.12*span),(x,base+.22,zlead-.18*span),(x,top-.4,zlead)])
section_cage('rear_swept_airfoil','rear',tail,shell,{0:.93,1:.35,2:.66,3:.92,4:.75,5:.74,6:.93})
guide('tail_leading_edge',[row[0] for row in tail])
# Compact transverse torsion mechanism, mostly enclosed by the rising
# front/rear shoulders. Radial assemblies use machined annular topology.
def ring(name,g,center,axis,profile,mat,n=72):
    vs=[];fs=[]
    for r,d in profile:
        for i in range(n):
            a=i*2*pi/n;p=(d,r*cos(a),r*sin(a)) if axis=='x' else (r*cos(a),d,r*sin(a))
            vs.append(tuple(center[k]+p[k] for k in range(3)))
    for i in range(len(profile)):
        for j in range(n):fs.append((i*n+j,i*n+(j+1)%n,((i+1)%len(profile))*n+(j+1)%n,((i+1)%len(profile))*n+j))
    return mesh(name,g,vs,fs,mat,bevel=.045)
ring('torsion_core','joint',(0,0,0),'x',[(2.3,-2.9),(3.8,-2.9),(4.15,-2.5),(4.15,2.5),(3.8,2.9),(2.3,2.9)],mechanical)
for s in [-1,1]:
    ring('torsion_collar_'+str(s),'joint',(0,0,0),'x',[(1.5,s*2.85),(3.55,s*2.85),(3.65,s*3.15),(3.2,s*3.45),(1.5,s*3.45)],shell)
# Shrouds are integrated into the lower chine volume; only the lower
# annular face protrudes. Actual radial apertures remain visible underneath.
for g,z,r in [('front',20,6.1),('rear',-22,5.9)]:
    ring(g+'_body_aperture',g,(0,-2.6,z),'y',[(r*.72,-2.5),(r*1.18,-2.0),(r*1.29,-.7),(r*1.22,.85),(r*.82,1.0),(r*.70,.1)],shell)
    ring(g+'_magnetic_lens',g+'_pod',(0,-3.2,z),'y',[(r*.35,-2.55),(r*.91,-2.55),(r*.99,-2.1),(r*.96,-1.2),(r*.74,-.4),(r*.36,-.4)],mechanical)
    ring(g+'_radial_hub',g+'_pod',(0,-3.2,z),'y',[(.55,-2.65),(r*.27,-2.65),(r*.32,-2.1),(r*.27,-1.1),(.55,-1.1)],shell)
    # Segmented underside ring; no emissive/livery treatment at this stage.
    vs=[];fs=[]
    for j in range(24):
        a=(j+.12)*2*pi/24;b=(j+.86)*2*pi/24;o=len(vs)
        for h in [-5.83,-5.48]:
            for rr,t in [(r*.39,a),(r*.83,a),(r*.83,b),(r*.39,b)]:vs.append((rr*cos(t),h,z+rr*sin(t)))
        fs.extend(tuple(o+i for i in f) for f in [(0,3,2,1),(4,5,6,7),(0,1,5,4),(1,2,6,5),(2,3,7,6),(3,0,4,7)])
    mesh(g+'_radial_segments',g+'_pod',vs,fs,mechanical,bevel=.035)
# Reference is perspectival, not measured CAD. These are selected design
# proportions in authoring units, explicitly NOT extracted exact dimensions.
landmarks={'noseZ':38,'tailZ':-35.6,'maximumHalfWidth':10.35,'frontStandingZ':[8.7,28],'rearStandingZ':[-30.5,-9],'torsionCenter':[0,0,0],'torsionRadius':4.15,'tailCrownY':8.25,'podCentersZ':[20,-22],'assumptions':'Hero/top/side concept interpreted as normalized proportions; hidden structure and exact dimensions unspecified.'}
scene['reference_sha256']='b63e7e1238e4fdcd38ec6b439d2745991eb4c745b00777008f58f399d6efd555'
scene['stage']='SCULPT / unapproved clay master'
# Store construction rail and component hierarchy, leave all cages editable.
bpy.context.view_layer.update()
deps=bpy.context.evaluated_depsgraph_get();stats=[]
for o in scene.objects:
    if o.type!='MESH':continue
    ev=o.evaluated_get(deps);m=ev.to_mesh();m.calc_loop_triangles()
    bm=bmesh.new();bm.from_mesh(o.data)
    stats.append({'name':o.name,'assembly':o['assembly'],'controlVertices':len(o.data.vertices),'evaluatedTriangles':len(m.loop_triangles),'controlNonManifoldEdges':sum(not e.is_manifold for e in bm.edges)})
    bm.free();ev.to_mesh_clear()
bpy.ops.wm.save_as_mainfile(filepath=os.path.join(out,'VECTOR-005-SCULPT-master.blend'))
report={'blender':bpy.app.version_string,'referenceLandmarks':landmarks,'components':stats,'evaluatedTriangles':sum(p['evaluatedTriangles'] for p in stats),'qualification':'Clay review only; intersections, articulation clearance, retopology and runtime not certified.'}
with open(os.path.join(out,'sculpt-report.json'),'w') as f:json.dump(report,f,indent=2)
print('SCULPT_MASTER',json.dumps(report))
