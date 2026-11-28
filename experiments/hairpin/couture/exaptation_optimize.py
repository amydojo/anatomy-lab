"""EXAPTATION deterministic coordinate descent from the recorded MORPHOSIS chart.
Only chart coordinates move. Original physical points, boundary and owners remain fixed."""
import numpy as np,shapely as sh,json,sys
from pathlib import Path
from shapely.strtree import STRtree
root=Path(sys.argv[1]);out=Path(sys.argv[2]);out.mkdir(exist_ok=True,parents=True)
q=np.load(root/'genesis/conditioned-correspondence.npz');b=np.load(root/'bridge/bridge-correspondence.npz');z=np.load(root/'atlas/native-atlas.npz');j=json.load(open(root/'atlas/native-atlas.json'));F=q['faces'];U=q['idealTarget'][F][:,:,:2];ids=z['faces'][np.array(next(x['nativeTriangleIDs'] for x in j['regions'] if x['name']=='block_2_interior_negative_skin'))];native=z['vertices'];chart=native[:,:2].copy()
mov=np.array([4154,4161,4171,4172,4179,4192,4193,4197,4200,4203,4204,4208,4220,4221,4226,4235,4236,4241,4253,4258,4299,4304,4305,4330,4336,4343,4349,4356,4357,4383,4384,4391,4402,4403,4406,4409,4410,4416,4425,4430,4431,4432,4433,4438,4522,4523,4530,11761,11764,11778,11779,11828,11829,11845,11870,11874,11890,11922,12002,12018,12020,12047,12051,12066,12095,12097,12108,12110,12131,12144]);rng=np.random.default_rng(210);d=rng.normal(size=(len(mov),2));chart[mov]+=d/np.linalg.norm(d,axis=1)[:,None]*.002
edges,cnt=np.unique(np.sort(np.concatenate([ids[:,[0,1]],ids[:,[1,2]],ids[:,[2,0]]]),1),axis=0,return_counts=True);bd=set(np.unique(edges[cnt==1]));pa=sh.polygons(U);tree=STRtree(pa);ar=lambda X:np.linalg.norm(np.cross(X[:,1]-X[:,0],X[:,2]-X[:,0]),axis=1)/2
ua=sh.area(pa);rat=np.minimum.reduce([ar(q['idealCompact'][F])/ua,ar(b['idealFrozen'][F])/ua,ar(q['idealTarget'][F])/ua]);la=ar(native[ids]);cross=lambda X:(X[:,1,0]-X[:,0,0])*(X[:,2,1]-X[:,0,1])-(X[:,1,1]-X[:,0,1])*(X[:,2,0]-X[:,0,0]);inc={v:np.flatnonzero((ids==v).any(1)) for v in np.unique(ids)}
# These 18 variables are the interior vertices of the ten lower owner
# triangles implicated in the actual MORPHOSIS failed endpoint report.
owners=[44,97,157,410,411,425,534,546,730,1038];vars=sorted(set(ids[owners].ravel())-bd);assert len(vars)==18
initial=chart.copy()
def score(own):
 T=chart[ids[own]];a=cross(T);orig=cross(native[ids[own]][:,:,:2])
 if np.any(a*orig<=0) or np.any(abs(a)<abs(cross(initial[ids[own]]))*.5):return (1e9,1e9)
 pb=sh.polygons(T);i,k=tree.query(pb,predicate='intersects');inter=sh.intersection(pb[i],pa[k]);areas=sh.area(inter);m=areas>0;areas=areas[m];i=i[m];k=k[m];inter=inter[m];num=np.maximum(1,sh.get_num_coordinates(inter)-3);budget=areas*np.minimum(rat[k],la[own[i]]/sh.area(pb)[i])/num;bad=budget<3e-10;return (int(bad.sum()),float(np.maximum(0,np.log(3e-10/np.maximum(budget,1e-300))).sum()))
allown=np.arange(len(ids));history=[{'step':0,'score':score(allown)}]
dirs=np.array([[1,0],[-1,0],[0,1],[0,-1],[1,1],[-1,1],[1,-1],[-1,-1]],float);dirs/=np.linalg.norm(dirs,axis=1)[:,None]
for step in [.001,.0005,.002,.00025]:
 changes=0
 for v in vars:
  own=inc[v];orig=chart[v].copy();best=score(own);pos=orig.copy()
  for di in dirs:
   cand=orig+di*step
   if np.linalg.norm(cand-native[v,:2])>.006:continue
   chart[v]=cand;s=score(own)
   if s<best:best=s;pos=cand.copy()
  chart[v]=pos;changes+=int(not np.array_equal(pos,orig))
 history.append({'step':step,'changes':changes,'score':score(allown)})
assert np.array_equal(chart[list(bd)],native[list(bd),:2]);np.save(out/'optimized-chart.npy',chart);(out/'optimization.json').write_text(json.dumps({'history':history,'optimizedVariables':list(map(int,vars)),'fixedBoundaryVertices':len(bd),'maxDisplacement':float(np.linalg.norm(chart-native[:,:2],axis=1).max()),'scope':'Deterministic local proxy optimization; full overlay and endpoint gates separate.'},indent=2))
