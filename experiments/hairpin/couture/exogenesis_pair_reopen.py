"""Reopen actual paired endpoint, audit forward/reverse clipped native witnesses.
This is a static endpoint, not an authorized motion or native sidewall claim."""
import bpy,sys,json,hashlib,collections
from pathlib import Path
import numpy as np
from shapely.geometry import Polygon
from shapely.ops import unary_union
from mathutils import Vector
from mathutils.bvhtree import BVHTree
sys.path.insert(0,str(Path(__file__).parent))
from exogenesis_native_pair import run,lift,area3
from morphogenesis_measure import map_chart,witnesses,EPS
args=sys.argv[sys.argv.index('--')+1:]
def arg(k):return Path(args[args.index('--'+k)+1]).resolve()
out=arg('out');out.mkdir(parents=True,exist_ok=True);base=arg('baseline');atlas=arg('atlas')
q=np.load(base/'conditioned-correspondence.npz');a=np.load(atlas/'native-atlas.npz');r=run(base/'conditioned-correspondence.npz',atlas,out);assert r['numericalEndpointPass']
p=np.load(out/'native-pair.npz');X=p['vertices'];F=p['faces'];skin=p['skinFaces'];xy=p['xy'];n=len(xy);nf=len(skin)
lowerIDs=np.array(next(x['nativeTriangleIDs'] for x in json.loads((atlas/'native-atlas.json').read_text())['regions'] if x['name']=='block_2_interior_negative_skin'))
A=q['targetRef'];B=a['vertices'][a['faces'][lowerIDs]]
domain=unary_union([Polygon(t[:,:2]) for t in A]).intersection(unary_union([Polygon(t[:,:2]) for t in B]))
bpy.ops.wm.read_factory_settings(use_empty=True);s=bpy.context.scene;d=bpy.data.meshes.new('Exact clipped native paired skins');d.from_pydata(X.tolist(),[],F.tolist());d.update();o=bpy.data.objects.new('EXOGENESIS native pair — constructed cut walls',d);s.collection.objects.link(o)
def mat(name,col):
    m=bpy.data.materials.new(name);m.diffuse_color=(*col,1);m.use_nodes=True;bs=m.node_tree.nodes.get('Principled BSDF');bs.inputs['Base Color'].default_value=(*col,1);bs.inputs['Metallic'].default_value=.9;bs.inputs['Roughness'].default_value=.25;return m
for m in (mat('Native upper',(.62,.59,.53)),mat('Native lower',(.02,.06,.11)),mat('Constructed cut walls',(.62,.15,.30))):d.materials.append(m)
for poly in d.polygons:poly.material_index=0 if poly.index<nf else 1 if poly.index<2*nf else 2;poly.use_smooth=poly.index<2*nf
# UV coordinates are explicitly a diagnostic projection, not original
# native artwork parity; exact native source loop UVs remain in atlas.
uv=d.uv_layers.new(name='PairedProjectionDiagnostic')
lo=xy.min(0);scale=np.ptp(xy,axis=0)
for l in d.loops:uv.data[l.index].uv=(xy[l.vertex_index%n]-lo)/scale
file=out/'EXOGENESIS-native-paired-endpoint.blend';bpy.ops.wm.save_as_mainfile(filepath=str(file));bpy.ops.wm.open_mainfile(filepath=str(file));o=next(o for o in bpy.context.scene.objects if o.type=='MESH');d=o.data
Y=np.array([tuple(v.co) for v in d.vertices],dtype=np.float64);assert np.array_equal(Y,X) and np.array_equal(np.array([tuple(v.vertices) for v in d.polygons]),F)
r['actualReopenedMaxError']=float(np.max(abs(Y-X)))
sets=[set(f) for f in F];tree=BVHTree.FromPolygons(Y.tolist(),F.tolist(),all_triangles=True);hits=[(i,j) for i,j in tree.overlap(tree) if i<j and not sets[i].intersection(sets[j])]
r['rawBVHOverlapCandidates']=len(hits);r['rawBVHPairs']=hits[:200]
r['reopenedAreaFloorFailures']=int(np.sum(area3(Y[F])<1e-10))
r['nativeFileSha256']=hashlib.sha256(file.read_bytes()).hexdigest()
res={}
for label,R,owner,skinXYZ in [('upper',A,p['upperRefOwner'],Y[:n]),('lower',B,p['lowerRefOwner'],Y[n:])]:
    # Forward witness bound uses valid barycentric points on each actual
    # native reference triangle; correspondence XY retained at float64.
    t=xy[skin];P=np.concatenate([t.reshape(-1,2),witnesses(t)]);own=np.r_[np.repeat(owner,3),np.repeat(owner,4)];v=np.concatenate([skinXYZ[skin].reshape(-1,3),witnesses(skinXYZ[skin])])
    ref=np.array([lift(x,R[i])[0] for x,i in zip(P,own)]);forward=np.linalg.norm(v-ref,axis=1)
    # Reverse clipped reference boundaries, edge midpoints and centroid
    # witnesses. Per-reference projected area coverage already gated.
    Q=[];Z=[]
    for i,tr in enumerate(R):
        poly=Polygon(tr[:,:2]).intersection(domain)
        polys=[poly] if poly.geom_type=='Polygon' else [x for x in getattr(poly,'geoms',[]) if x.geom_type=='Polygon']
        for c in polys:
            if c.area<=0:continue
            u=np.array(c.exterior.coords[:-1]);w=np.concatenate([u,(u+np.roll(u,-1,axis=0))/2,np.array([[c.representative_point().x,c.representative_point().y]])])
            Q.extend(w);Z.extend(lift(x,tr)[0] for x in w)
    rev,_,chartErr=map_chart(np.array(Q),xy[skin],skinXYZ[skin]);dist=np.linalg.norm(rev-np.array(Z),axis=1)
    res[label]={'forwardChecks':len(forward),'forwardMax':float(forward.max()),'reverseChecks':len(dist),'reverseMax':float(dist.max()),'maxReverseChartError':float(chartErr.max())}
r['bidirectionalNativeClippedSurface']=res
r['actualStaticEndpointPass']=bool(r['numericalEndpointPass'] and r['actualReopenedMaxError']==0 and not r['reopenedAreaFloorFailures'] and not hits and all(max(v['forwardMax'],v['reverseMax'])<EPS for v in res.values()))
(out/'native-pair-report.json').write_text(json.dumps(r,indent=2))
# Render even if diagnostic failed; failure remains labeled.
s=bpy.context.scene;s.world=bpy.data.worlds.new('Pair inspection');s.world.use_nodes=True;s.world.node_tree.nodes['Background'].inputs[0].default_value=(.22,.22,.22,1)
center=Vector(tuple((Y.min(0)+Y.max(0))/2))
for name,loc,power in [('Key',(20,-25,55),65000),('Strip',(-30,15,35),50000)]:
    l=bpy.data.lights.new(name,'AREA');l.energy=power;l.shape='RECTANGLE';l.size=45;l.size_y=9;ob=bpy.data.objects.new(name,l);s.collection.objects.link(ob);ob.location=loc;ob.rotation_euler=(center-ob.location).to_track_quat('-Z','Y').to_euler()
cd=bpy.data.cameras.new('Pair camera');cam=bpy.data.objects.new('Pair camera',cd);s.collection.objects.link(cam);s.camera=cam;cd.type='ORTHO';cd.ortho_scale=38
s.render.engine='CYCLES';s.cycles.device='CPU';s.cycles.samples=32;s.cycles.use_denoising=False
for v in s.view_layers:v.cycles.use_denoising=False
s.render.resolution_x=1000;s.render.resolution_y=564;s.render.resolution_percentage=100;s.render.threads_mode='FIXED';s.render.threads=4;s.render.image_settings.file_format='PNG'
for name,loc in [('upper',(30,-10,100)),('lower',(50,-10,-75)),('edge',(90,-10,20))]:
    cam.location=center+Vector(loc);cam.rotation_euler=(center-cam.location).to_track_quat('-Z','Y').to_euler();s.render.filepath=str(out/f'paired-{name}.png');bpy.ops.render.render(write_still=True)
assert r['actualStaticEndpointPass'],'Static native pair qualification failed; no motion authorized'
