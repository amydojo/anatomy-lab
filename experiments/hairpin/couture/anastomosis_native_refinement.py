"""Native D1 endpoint readback and exact D2 structural connections.
No motion acceptance on failed refined geometry."""
import bpy,sys,json,hashlib,collections
from pathlib import Path
import numpy as np
from scipy.sparse import coo_matrix
from scipy.sparse.csgraph import connected_components
from mathutils.bvhtree import BVHTree
sys.path.insert(0,str(Path(__file__).parent))
from anastomosis_refine import run,normal
from morphogenesis_measure import map_chart,witnesses,EPS
args=sys.argv[sys.argv.index('--')+1:]
def arg(k):return Path(args[args.index('--'+k)+1]).resolve()
out=arg('out');out.mkdir(parents=True,exist_ok=True);base=arg('baseline');bridge=arg('bridge');atlas=arg('atlas');source=arg('source')
expected='1758f93d990ce18a2b962653457912a3dcf87d7b4431f0291b8b4fd0a20c66e9';sha=lambda p:hashlib.sha256(p.read_bytes()).hexdigest();assert sha(source)==expected
z=dict(np.load(atlas/'native-atlas.npz'));a=json.loads((atlas/'native-atlas.json').read_text());q=dict(np.load(base/'conditioned-correspondence.npz'));b=dict(np.load(bridge/'bridge-correspondence.npz'))
# Re-open protected evaluated native master and verify exact triangle IDs.
bpy.ops.wm.open_mainfile(filepath=str(source));bpy.context.view_layer.update();o=bpy.data.objects['TENSION_continuous_frame'];dg=bpy.context.evaluated_depsgraph_get();e=o.evaluated_get(dg);me=e.to_mesh();me.calc_loop_triangles();P=np.array([tuple(e.matrix_world@v.co) for v in me.vertices]);F=np.array([tuple(t.vertices) for t in me.loop_triangles]);e.to_mesh_clear();assert np.array_equal(P,z['vertices']) and np.array_equal(F,z['faces'])
R=z['regionID'];E=z['edgeVertices'];A=z['edgeFaceIDs'];UV=z['nativeLoopUV'];names={x['id']:x['name'] for x in a['regions']};n=len(F);lens=np.linalg.norm(P[E[:,1]]-P[E[:,0]],axis=1)
upper=next(k for k,v in names.items() if v=='block_2_interior_positive_skin');lower=next(k for k,v in names.items() if v=='block_2_interior_negative_skin');other=np.array([k for k,v in names.items() if v.startswith('block_2_') and k not in (upper,lower)]);mask=np.isin(R,other);ids=np.flatnonzero(mask);idx=np.full(n,-1);idx[ids]=np.arange(len(ids));x,y=A.T;valid=mask[x]&mask[y];xx,yy=idx[x[valid]],idx[y[valid]];M=coo_matrix((np.ones(2*len(xx)),(np.r_[xx,yy],np.r_[yy,xx])),shape=(len(ids),len(ids))).tocsr();cc,labels=connected_components(M,directed=False);patches=[];N=normal(P,F);N/=np.linalg.norm(N,axis=1)[:,None]
for k in range(cc):
    I=ids[labels==k];hit=np.isin(x,I)^np.isin(y,I);otherFace=np.where(np.isin(x,I),y,x);up=np.flatnonzero(hit&(R[otherFace]==upper));lo=np.flatnonzero(hit&(R[otherFace]==lower));eids=np.r_[up,lo];vals=[]
    for ed in eids:
        i,j=A[ed];v,w=E[ed];vals.extend(float(np.linalg.norm(UV[i,np.where(F[i]==p)[0][0]]-UV[j,np.where(F[j]==p)[0][0]])) for p in (v,w))
    patches.append({'component':k,'faces':len(I),'upperInterfaceEdges':len(up),'lowerInterfaceEdges':len(lo),'upperInterfaceLength':float(lens[up].sum()),'lowerInterfaceLength':float(lens[lo].sum()),'nativeFaceIDs':I.tolist(),'upperInterfaceEdgeIDs':up.tolist(),'lowerInterfaceEdgeIDs':lo.tolist(),'maxSharedEdgeUVJump':max(vals,default=0),'nonzeroUVWitnesses':sum(v>1e-8 for v in vals),'interfaceDihedralP95':float(np.percentile(np.degrees(np.arccos(np.clip(np.sum(N[A[eids,0]]*N[A[eids,1]],axis=1),-1,1))),95)) if len(eids) else None})
conn={'sourceSha256':expected,'nativeTriangleIDsMatched':len(F),'block2NonInteriorFaceCount':len(ids),'components':patches,'bridgesTouchingBothSkins':sum(x['upperInterfaceEdges']>0 and x['lowerInterfaceEdges']>0 for x in patches),'scope':'Exact native indexed connection, not qualified compact sidewall correspondence.'}
(out/'native-connections.json').write_text(json.dumps(conn,indent=2))
# Editable exact subset with original loop UV, original native face IDs.
bpy.ops.wm.read_factory_settings(use_empty=True);used=np.unique(F[ids]);remap=np.full(len(P),-1,int);remap[used]=np.arange(len(used));d=bpy.data.meshes.new('Actual block 2 native connection');d.from_pydata(P[used].tolist(),[],remap[F[ids]].tolist());d.update();o=bpy.data.objects.new('Actual native connection — static',d);bpy.context.collection.objects.link(o);uv=d.uv_layers.new(name='NativeChromaticArtworkUV')
for l in d.loops:uv.data[l.index].uv=UV[ids].reshape(-1,2)[l.index]
attr=d.attributes.new('NativeTriangleID','INT','FACE');attr.data.foreach_set('value',ids.astype(np.int32));file=out/'ANASTOMOSIS-native-connection.blend';bpy.ops.wm.save_as_mainfile(filepath=str(file));bpy.ops.wm.open_mainfile(filepath=str(file));o=next(o for o in bpy.context.scene.objects if o.type=='MESH');assert np.array_equal(np.array([tuple(v.co) for v in o.data.vertices]),P[used]);conn['reopenedNativeConnectionExact']=True;(out/'native-connections.json').write_text(json.dumps(conn,indent=2))
r=run(base/'conditioned-correspondence.npz',bridge/'bridge-correspondence.npz',atlas,out);p=dict(np.load(out/'refinement.npz'));F=p['faces'];oa=p['faceCommonOwner'];ob=p['faceLowerOwner'];stored={}
for label in ('compact','frozen','target','lower'):
    bpy.ops.wm.read_factory_settings(use_empty=True);d=bpy.data.meshes.new(label+' diagnostic');d.from_pydata(p[label].tolist(),[],F.tolist());d.update();o=bpy.data.objects.new(label+' — failed refinement diagnostic',d);bpy.context.collection.objects.link(o)
    uv=d.uv_layers.new(name='CommonMaterialChart')
    for l in d.loops:uv.data[l.index].uv=p['chart'][l.vertex_index]
    file=out/f'ANASTOMOSIS-{label}-diagnostic.blend';bpy.ops.wm.save_as_mainfile(filepath=str(file));bpy.ops.wm.open_mainfile(filepath=str(file));o=next(o for o in bpy.context.scene.objects if o.type=='MESH');Y=np.array([tuple(v.co) for v in o.data.vertices]);assert np.array_equal(np.array([tuple(f.vertices) for f in o.data.polygons]),F);N=normal(Y,F);Ni=normal(p[label],F);ar=np.linalg.norm(N,axis=1)/2
    stored[label]={'readbackMaxErrorAgainstFloat32':float(np.max(abs(Y-p[label].astype(np.float32)))),'belowFloor':int((ar<1e-10).sum()),'opposedOrCollapsed':int((np.sum(N*Ni,axis=1)<=0).sum()),'nativeSha256':sha(file)}
    # Continuous affine cell witness bound against exact ideal surface.
    # Both directions on the same mapped point; reference face coverage
    # already measured separately. Native nearest distance not implied.
    err=np.linalg.norm(np.concatenate([Y,witnesses(Y[F])])-np.concatenate([p[label],witnesses(p[label][F])]),axis=1)
    stored[label]['sameParameterWitnessMax']=float(err.max())
r['reopened']=stored;r['nativeSourceUnchanged']=sha(source)==expected;r['completeEndpointPass']=bool(r['regularEndpointPass'] and all(not v['belowFloor'] and not v['opposedOrCollapsed'] and v['readbackMaxErrorAgainstFloat32']==0 and v['sameParameterWitnessMax']<EPS for v in stored.values()))
# Preserve diagnostic inherited path (no native collision qualification).
traj=dict(np.load(arg('trajectory')/'tension-161.npz'));ids=q['faces'][p['vertexCommonFace']];w=p['weights'];gap=p['target'][:,2]-p['lower'][:,2];na=normal(p['compact'],F);nb=normal(p['target'],F);prev=None;rows=[]
for i,P0 in enumerate(traj['poses']):
    t=i/160;up=np.einsum('ij,ijk->ik',w,P0[ids]).astype(np.float32).astype(float);lo=up.copy();s=t*t*(3-2*t);lo[:,2]-=(1-s)*.1+s*gap;lo=lo.astype(np.float32).astype(float)
    N=normal(up,F);L=normal(lo,F);ar=np.linalg.norm(N,axis=1)/2;la=np.linalg.norm(L,axis=1)/2;f=np.clip((t-.12)/.79,0,1);f=f*f*(3-2*f);rows.append({'frame':i,'upperBelowFloor':int((ar<1e-10).sum()),'lowerBelowFloor':int((la<1e-10).sum()),'upperOpposed':int(np.sum(np.sum(N*((1-f)*na+f*nb),axis=1)<=0)),'projectedNonpositive':int((N[:,2]<=0).sum()+(L[:,2]<=0).sum()),'temporalReversals':0 if prev is None else int((np.sum(N*prev[0],axis=1)<0).sum()+(np.sum(L*prev[1],axis=1)<0).sum()),'verticalGapMin':float((up[:,2]-lo[:,2]).min())});prev=(N,L)
keys=['upperBelowFloor','lowerBelowFloor','upperOpposed','projectedNonpositive','temporalReversals'];r['motionDiagnostic']={'samples':rows,'peak':{k:max(x[k] for x in rows) for k in keys},'passes':sum(not any(x[k] for k in keys) for x in rows)}
(out/'refinement.json').write_text(json.dumps(r,indent=2));assert r['nativeSourceUnchanged'];assert r['completeEndpointPass'],'Strict refined endpoint gate failed; do not authorize motion'
