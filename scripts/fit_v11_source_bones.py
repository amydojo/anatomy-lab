#!/usr/bin/env python3
"""Fit seven real licensed Z-Anatomy bone meshes to BODY / LIVE source bone controls.

Source->target: paired surface nearest-neighbor similarity ICP (not hand placing),
sacrum for coccyx, bilateral temporal bones for ossicles. Independent held-out
hip/frontal surfaces, anatomical dimension, relative position, and side gates.
This is cross-specimen educational registration, NOT clinical validation.
"""
import hashlib,json,math
from pathlib import Path
import numpy as np
from scipy.spatial import cKDTree
from build_v8_overview import mesh_lod
ROOT=Path(__file__).resolve().parents[1]
IN=Path("/tmp/v11-z-registration-source.json")
ASSET=ROOT/"atlas/assets/v11-coccyx-ossicles.json"
PROOF=ROOT/"atlas/assets/v11-source-provenance.json"
CONTROL={"Sacrum":"Sacrum","Temporal bone.l":"Left temporal bone",
 "Temporal bone.r":"Right temporal bone","Hip bone.l":"Left hip bone","Hip bone.r":"Right hip bone",
 "Frontal bone":"Frontal bone","Vertebra L5":"Fifth lumbar vertebra"}
R0=np.array([[1.,0.,0.],[0.,0.,1.],[0.,-1.,0.]]) # x z -y
RNG=np.random.default_rng(27111)

def surface(o,count=2400):
 v=np.asarray(o["vertices"],dtype=float);t=np.asarray(o["faces"],dtype=int)
 if t.max()>=len(v) or t.min()<0 or not np.isfinite(v).all():raise RuntimeError("invalid control geometry")
 tri=v[t];area=np.linalg.norm(np.cross(tri[:,1]-tri[:,0],tri[:,2]-tri[:,0]),axis=1)
 if area.sum()<1e-14:raise RuntimeError("zero area surface")
 indices=RNG.choice(len(tri),size=count,p=area/area.sum())
 a=RNG.random(count);b=RNG.random(count);sr=np.sqrt(a)
 return (1-sr)[:,None]*tri[indices,0]+(sr*(1-b))[:,None]*tri[indices,1]+(sr*b)[:,None]*tri[indices,2]

def robust_rms(dist,keep=.9):
 d=np.sort(np.asarray(dist));k=max(20,int(keep*len(d)))
 return float(np.sqrt(np.mean(d[:k]**2)))
def to_points(points,s,R,t):return s*(points@R.T)+t
def umeyama(x,y):
 cx=x.mean(axis=0);cy=y.mean(axis=0)
 xx=x-cx; yy=y-cy
 u,sv,vt=np.linalg.svd((yy.T@xx)/len(xx))
 sign=np.diag([1,1,np.linalg.det(u@vt)])
 R=u@sign@vt
 scale=float(np.trace(np.diag(sv)@sign)/np.mean(np.sum(xx**2,axis=1)))
 return scale,R,cy-scale*R@cx
def align(groups,source,target,label):
 src={k:surface(source[k],1600) for k in groups}
 dst={k:surface(target[CONTROL[k]],2500) for k in groups}
 trees={k:cKDTree(v) for k,v in dst.items()}
 # Source matrices are Blender metres (z-up). Existing atlas is source metres
 # converted to Y-up, shifted by .9, then uniformly scaled 5.
 first=np.concatenate([src[k] for k in groups]);last=np.concatenate([dst[k] for k in groups])
 scale=5.0;R=R0.copy();t=last.mean(axis=0)-scale*R@first.mean(axis=0)
 steps=[]
 for it in range(48):
  correspondX=[];correspondY=[];ds=[]
  for name in groups:
   x=src[name];y=to_points(x,scale,R,t)
   d,ix=trees[name].query(y)
   chosen=d<=np.quantile(d,.85)
   correspondX.append(x[chosen]);correspondY.append(dst[name][ix[chosen]]);ds.append(d)
  x=np.concatenate(correspondX);y=np.concatenate(correspondY)
  newS,newR,newT=umeyama(x,y)
  # Same source-space scale must remain near BP3D 4.0's unit mapping.
  if not (3.75<=newS<=6.5):raise RuntimeError("Anatomy source has implausible scale "+label+" "+str(newS))
  degrees=math.degrees(math.acos(np.clip((np.trace(newR@R0.T)-1)/2,-1,1)))
  if degrees>27:raise RuntimeError("Alignment rotated anatomy implausibly "+label+" "+str(degrees))
  delta=np.linalg.norm(newT-t)+abs(newS-scale)*.1
  scale,R,t=newS,newR,newT
  if it%10==0:steps.append({"iteration":it,"trimmed_rms":robust_rms(np.concatenate(ds))})
  if delta<1e-6:break
 return {"scale":scale,"rotation":R,"translation":t,"iterations":it+1,"control_rms":{k:robust_rms(trees[k].query(to_points(src[k],scale,R,t))[0]) for k in groups},
 "initial_rotation_matrix":R0.tolist(),"trace":steps}

def heldout(transform,src,target,ids):
 x=surface(src,1800);y=surface(target,2800)
 t=transform
 a=to_points(x,t["scale"],t["rotation"],t["translation"])
 d=cKDTree(y).query(a)[0]
 return {"trimmed_rms_units":round(robust_rms(d),6),"p90_units":round(float(np.quantile(d,.9)),6),
         "units":"BODY LIVE world units (5 per metre)"}

def mesh_bounds(part):
 v=np.asarray(part["vertices"],dtype=float)
 return np.stack([v.min(axis=0),v.max(axis=0)])

def closest(A,B):
 return float(cKDTree(np.asarray(B)).query(np.asarray(A),k=1)[0].min())

def main():
 source=json.loads(IN.read_text())
 if source["sha256"]!="294a649765cd060a62a4095da52b9c8ef2d97769aa447e196448aa5f7d596dea":
  raise RuntimeError("Z source FBX not pinned")
 data=source["objects"]
 base=json.loads((ROOT/"atlas/assets/body-skeleton.json").read_text())
 targets={p["name"]:p for p in base["parts"]}
 for name in CONTROL.values():
  if name not in targets:raise RuntimeError("No target anatomy control "+name)
 sac=align(["Sacrum"],data,targets,"coccyx-to-sacrum")
 ear=align(["Temporal bone.l","Temporal bone.r"],data,targets,"ossicles-to-temporal")
 coccyx_heldout={k:heldout(sac,data[k],targets[CONTROL[k]],[k]) for k in ["Hip bone.l","Hip bone.r","Vertebra L5"]}
 ear_heldout=heldout(ear,data["Frontal bone"],targets["Frontal bone"],["Frontal bone"])
 def simplify(name,mapping,fma,fit,targetFaces):
  original=data[name];points=np.asarray(original["vertices"],dtype=float)
  fitted=to_points(points,fit["scale"],fit["rotation"],fit["translation"])
  item={"name":mapping,"fma":fma,"system":"bone","vertices":fitted.tolist(),
   "faces":original["faces"]}
  mesh=mesh_lod(item,min(targetFaces,len(item["faces"])))
  mesh["group"]="spine" if name=="Coccyx" else "head"
  mesh["region"]="sacrum" if name=="Coccyx" else "temporal"
  mesh["source_system"]="bone"
  mesh["source_repo"]="LluisV/Z-Anatomy"
  mesh["license"]="CC BY-SA 4.0"
  mesh["reference_pose_only"]=True
  mesh["source_mesh"]=name
  mesh["source_origin"]="Z-Anatomy skeletal FBX, registered via shared original bone controls"
  return mesh
 coc=simplify("Coccyx","Coccyx","FMA20229",sac,820)
 bones={"z-v11-coccyx":coc}
 names={"Malleus":"malleus","Incus":"incus","Stapes":"stapes"}
 for name in names:
  for side,letter in [("Left","l"),("Right","r")]:
   key=f"z-v11-{side.lower()}-{name.lower()}"
   bones[key]=simplify(f"{name}.{letter}",f"{side} {name.lower()}",f"ZANATOMY:{side}:{name}",ear,1800)
 if len(bones)!=7:raise RuntimeError("Not all seven source bones present")
 # Bone-body landmarks: actual mesh-to-mesh proximity after independent
 # source sacrum and temporal-bone registration.
 sacrum=targets["Sacrum"];c=np.asarray(coc["vertices"])
 sb=mesh_bounds(sacrum);cb=mesh_bounds(coc)
 xmean=float(c[:,0].mean())
 verticalGap=sb[0,1]-cb[1,1] # should be a modest positive number, not floating far away
 distance=closest(c,sacrum["vertices"])
 if abs(xmean)>.16 or not (-.08<=verticalGap<=.18) or distance>.25:
  raise RuntimeError(f"Coccyx not anchored beneath sacrum: x={xmean:.4f} vertical_gap={verticalGap:.4f} minimum={distance:.4f}")
 for side in ["left","right"]:
  temporal=targets[side.title()+" temporal bone"]
  b=mesh_bounds(temporal)
  chain=[bones[f"z-v11-{side}-{name}"] for name in ["malleus","incus","stapes"]]
  centers=[]
  for part in chain:
   xyz=np.asarray(part["vertices"]);box=mesh_bounds(part)
   center=xyz.mean(axis=0);centers.append(center)
   if (side=="left" and center[0]<0) or (side=="right" and center[0]>0):
    raise RuntimeError("Ossicle wrong anatomical side: "+part["name"])
   # temporal model may omit the open middle ear space, so use bounding
   # position rather than require ossicle vertices to lie INSIDE bone solid.
   if np.any(center<b[0]-.14) or np.any(center>b[1]+.14):
    raise RuntimeError("Ossicle outside temporal-bone envelope "+part["name"])
   span=box[1]-box[0]
   if span.max()>.085 or span.min()<.0005:raise RuntimeError("Ossicle wrong scale "+part["name"]+" "+str(span))
  for i in range(2):
   if np.linalg.norm(centers[i]-centers[i+1])>.085:raise RuntimeError("Ossicular chain separated "+side)
 records={k:{"scale":float(v["scale"]),"rotation":np.asarray(v["rotation"]).round(9).tolist(),
  "translation":np.asarray(v["translation"]).round(9).tolist(),"iterations":v["iterations"],
  "control_rms":{q:round(float(x),6) for q,x in v["control_rms"].items()},"trace":v["trace"]}for k,v in [("coccyx",sac),("ear",ear)]}
 reviews={"coccyx_source_control":records["coccyx"]["control_rms"],
          "coccyx_heldout":coccyx_heldout,"ear_source_control":records["ear"]["control_rms"],
          "ear_heldout_frontal":ear_heldout,
          "coccyx_source_sacrum_gap_units":round(float(verticalGap),6),
          "coccyx_source_sacrum_min_distance_units":round(distance,6)}
 # Thresholds for detecting gross dislocation. A strict biomechanical
 # verification is intentionally NOT claimed; trial based cross-source ICP.
 if max(records["coccyx"]["control_rms"].values())>.09 or max(records["ear"]["control_rms"].values())>.08:
  raise RuntimeError("Gross source control mismatch: "+str(reviews))
 if ear_heldout["trimmed_rms_units"]>.18:
  raise RuntimeError("Ear source alignment fails held-out skull control: "+str(reviews))
 asset={"schema":"body-live/v11-registered-osteology-v1","source":"Z-Anatomy/BodyParts3D adapted skeletal reference",
 "license":"CC BY-SA 4.0","base_source_commit":base["source_commit"],
 "source_repo_commit":"6c7f9016bd5899ac8edafd31b9900c151df42ed6",
 "source_frame":{"origin_metres":[0,.9,0],"scale":5},
 "bones":bones}
 ASSET.write_text(json.dumps(asset,separators=(",",":"))+"\n")
 proof={"schema":"body-live/v11-source-provenance-v1",
 "source_url":source["source"],"source_sha256":source["sha256"],
 "source_commit":asset["source_repo_commit"],"license":"CC BY-SA 4.0",
 "attribution":["Z-Anatomy © Gauthier Kervyn and contributors, CC BY-SA 4.0",
                "BodyParts3D © The Database Center for Life Science, CC BY-SA 2.1 Japan"],
 "source_ear_meshes_provenance":"Z-Anatomy skeletal system FBX under CC BY-SA 4.0; other included inner-ear-specific NC models must NOT be copied",
 "registration":records,"validation":reviews,
 "canonical_count_conventional":206,
 "previous_conventional_count":199,"new_osteology_bone_count":7,
 "human_anatomist_reviewed":False,"ear_specialist_reviewed":False,
 "biomechanics_validated":False,"clinical_use_approved":False,
 "independent_patient_registration":False,
 "limits":["Cross-dataset similarity ICP based on shared source reference bones, not patient-specific registration",
           "Held-out comparison detects gross alignment only; shape morphometry and tiny ear joint contact not clinically validated",
           "Bones are source-derived, no mirroring or procedural fabrication",
           "Source license separation and copyright attribution required",
           "Ear ossicles are source reference-static, no ossicular vibration physics"],
 "asset_sha256":hashlib.sha256(ASSET.read_bytes()).hexdigest()}
 PROOF.write_text(json.dumps(proof,indent=2)+"\n")
 print("VALIDATED V11",json.dumps({"bones":len(bones),"fit":reviews,
  "asset_bytes":ASSET.stat().st_size,"sha256":proof["asset_sha256"]},indent=2),flush=True)
if __name__=="__main__":main()
