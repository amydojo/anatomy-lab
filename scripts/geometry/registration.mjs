/* Reusable, conservative registration mathematics for anatomical mesh candidates.
 * A fitted transform is alignment evidence, NEVER anatomical or clinical verification.
 * All transforms are proper rigid rotations (no mirroring, stretching or ICP hallucination).
 */
import crypto from 'node:crypto';
const EPS=1e-10;
export const sha256=bytes=>crypto.createHash('sha256').update(bytes).digest('hex');
const vector=v=>Array.isArray(v)&&v.length===3&&v.every(Number.isFinite);
const sub=(a,b)=>a.map((v,i)=>v-b[i]);
const add=(a,b)=>a.map((v,i)=>v+b[i]);
const scale=(v,s)=>v.map(x=>x*s);
const dot=(a,b)=>a.reduce((x,v,i)=>x+v*b[i],0);
const cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
const norm=v=>Math.hypot(...v);
const centroid=pts=>scale(pts.reduce(add,[0,0,0]),1/pts.length);
export function assertMesh(mesh){
 if(!mesh||!Array.isArray(mesh.vertices)||mesh.vertices.length<4||!mesh.vertices.every(vector))throw Error('Source mesh must have >=4 finite 3D vertices');
 if(!Array.isArray(mesh.faces)||!mesh.faces.length||!mesh.faces.every(f=>Array.isArray(f)&&f.length===3&&f.every(i=>Number.isInteger(i)&&i>=0&&i<mesh.vertices.length)))throw Error('Invalid triangular source topology');
 if(mesh.vertices.some(p=>p.some(x=>Math.abs(x)>1e7)))throw Error('Source coordinate magnitude out of range');
 return true;
}
function nonCollinear(pts){
 for(let i=1;i<pts.length;i++)for(let j=i+1;j<pts.length;j++)
  if(norm(cross(sub(pts[i],pts[0]),sub(pts[j],pts[0])))>EPS)return true;
 return false;
}
function quatRotation(q){
 const [w,x,y,z]=q;
 return [
  [1-2*(y*y+z*z),2*(x*y-z*w),2*(x*z+y*w)],
  [2*(x*y+z*w),1-2*(x*x+z*z),2*(y*z-x*w)],
  [2*(x*z-y*w),2*(y*z+x*w),1-2*(x*x+y*y)]
 ];
}
const rotate=(R,p)=>R.map(row=>dot(row,p));
function bestQuaternion(A){
 const a=A.map(row=>row.slice()),v=Array.from({length:4},(_,i)=>Array.from({length:4},(_,j)=>+(i===j)));
 for(let turn=0;turn<90;turn++){
  let p=0,q=1,max=0;
  for(let i=0;i<4;i++)for(let j=i+1;j<4;j++)if(Math.abs(a[i][j])>max){max=Math.abs(a[i][j]);p=i;q=j;}
  if(max<1e-13)break;
  const angle=.5*Math.atan2(2*a[p][q],a[q][q]-a[p][p]),c=Math.cos(angle),s=Math.sin(angle);
  // Rotation columns: p <- c*p - s*q, q <- s*p + c*q.
  for(let k=0;k<4;k++){const ap=a[k][p],aq=a[k][q];a[k][p]=c*ap-s*aq;a[k][q]=s*ap+c*aq;}
  for(let k=0;k<4;k++){const ap=a[p][k],aq=a[q][k];a[p][k]=c*ap-s*aq;a[q][k]=s*ap+c*aq;}
  for(let k=0;k<4;k++){const vp=v[k][p],vq=v[k][q];v[k][p]=c*vp-s*vq;v[k][q]=s*vp+c*vq;}
 }
 let k=0;for(let i=1;i<4;i++)if(a[i][i]>a[k][k])k=i;
 const q=v.map(row=>row[k]),m=norm(q);return q.map(x=>x/m);
}
export function fitRigidPairs(pairs){
 if(!Array.isArray(pairs)||pairs.length<3)throw Error('At least three matched anatomical landmarks required');
 if(pairs.some(p=>!vector(p.source)||!vector(p.target)||typeof p.id!=='string'||!p.id))throw Error('Landmark pairs require name and finite source/target positions');
 if(new Set(pairs.map(p=>p.id)).size!==pairs.length)throw Error('Duplicate landmark ID');
 const from=pairs.map(p=>p.source),to=pairs.map(p=>p.target);
 if(!nonCollinear(from)||!nonCollinear(to))throw Error('Landmarks are collinear or coincident; rigid alignment indeterminate');
 const cs=centroid(from),ct=centroid(to),h=Array.from({length:3},()=>[0,0,0]);
 for(let i=0;i<pairs.length;i++){const x=sub(from[i],cs),y=sub(to[i],ct);
  for(let j=0;j<3;j++)for(let k=0;k<3;k++)h[j][k]+=x[j]*y[k];
 }
 const [[xx,xy,xz],[yx,yy,yz],[zx,zy,zz]]=h;
 const N=[
  [xx+yy+zz,yz-zy,zx-xz,xy-yx],
  [yz-zy,xx-yy-zz,xy+yx,xz+zx],
  [zx-xz,xy+yx,-xx+yy-zz,yz+zy],
  [xy-yx,xz+zx,yz+zy,-xx-yy+zz]
 ];
 const rotation=quatRotation(bestQuaternion(N)),translation=sub(ct,rotate(rotation,cs));
 const transform=p=>add(rotate(rotation,p),translation);
 const residuals=pairs.map(p=>({id:p.id,error_mm:1000*norm(sub(transform(p.source),p.target))}));
 const rms_mm=Math.sqrt(residuals.reduce((n,p)=>n+p.error_mm**2,0)/residuals.length);
 const determinant=dot(rotation[0],cross(rotation[1],rotation[2]));
 if(!Number.isFinite(rms_mm)||Math.abs(determinant-1)>1e-6)throw Error('Invalid rigid alignment: reflection or nonfinite solution');
 return {rotation,translation,transform,residuals,rms_mm,determinant};
}
export function registerMesh({mesh,provenance,rawBytes}){
 assertMesh(mesh);
 const p=provenance;
 const required=['source_uri','source_asset_id','license','license_url','attribution','original_sha256','source_coordinate_system','source_units','laterality','target_frame','target_units','landmarks'];
 if(!p||required.some(k=>!p[k]))throw Error('Missing source identity, license, coordinates or landmark provenance');
 if(!/^https:\/\//.test(p.source_uri)||!/^https:\/\//.test(p.license_url)||!p.attribution.trim())throw Error('Non-auditable license/source URI or attribution');
 if(!/^[a-f0-9]{64}$/i.test(p.original_sha256))throw Error('Missing original SHA-256');
 if(!rawBytes||sha256(rawBytes)!==p.original_sha256.toLowerCase())throw Error('Original source bytes SHA-256 mismatch');
 if(!['right','left','midline'].includes(p.laterality))throw Error('Source laterality unresolved');
 if(!['mm','m'].includes(p.source_units)||!['mm','m','scene'].includes(p.target_units))throw Error('Unsupported or unresolved units');
 if(p.target_units==='scene'&&!(Number.isFinite(p.target_metres_per_unit)&&p.target_metres_per_unit>0))throw Error('Scene scale to metres required');
 const fromMetres=p.source_units==='mm'?.001:1,toMetres=p.target_units==='mm'?.001:p.target_units==='m'?1:p.target_metres_per_unit;
 const l=p.landmarks;
 if(!Array.isArray(l.fit)||l.fit.length<3||!Array.isArray(l.holdout)||l.holdout.length<2)throw Error('Require three fit and two independently held-out landmarks');
 const both=[...l.fit,...l.holdout];
 if(new Set(both.map(x=>x.id)).size!==both.length)throw Error('Landmark fit/holdout overlap');
 const toPair=x=>({id:x.id,source:scale(x.source,fromMetres),target:scale(x.target,toMetres)});
 const fitted=fitRigidPairs(l.fit.map(toPair));
 const holdout=l.holdout.map(toPair).map(x=>({id:x.id,error_mm:1000*norm(sub(fitted.transform(x.source),x.target))}));
 const holdout_rms_mm=Math.sqrt(holdout.reduce((v,x)=>v+x.error_mm**2,0)/holdout.length);
 if(!Number.isFinite(holdout_rms_mm))throw Error('Nonfinite holdout error');
 const vertices=mesh.vertices.map(v=>scale(fitted.transform(scale(v,fromMetres)),1/toMetres));
 const R=fitted.rotation,t=fitted.translation;
 const matrix_metres=[
  R[0][0],R[0][1],R[0][2],t[0],
  R[1][0],R[1][1],R[1][2],t[1],
  R[2][0],R[2][1],R[2][2],t[2],
  0,0,0,1
 ];
 return {
  schema:'body-live/registered-connective-candidate-v1',
  status:'source-registered-unreviewed',
  geometry_verified:false,attachment_coordinates_validated:false,kinematics_validated:false,
  source:{uri:p.source_uri,asset_id:p.source_asset_id,license:p.license,license_url:p.license_url,attribution:p.attribution,
   original_sha256:p.original_sha256,laterality:p.laterality,coordinate_system:p.source_coordinate_system,units:p.source_units},
  registration:{method:'rigid Horn quaternion; fit landmarks + independent holdouts',target_frame:p.target_frame,target_units:p.target_units,
   target_metres_per_unit:toMetres,transform_matrix_metres:matrix_metres,
   fit_landmark_ids:l.fit.map(x=>x.id),holdout_landmark_ids:l.holdout.map(x=>x.id),
   fit_rms_mm:fitted.rms_mm,holdout_rms_mm,fit_residuals:fitted.residuals,holdout_residuals:holdout,
   bone_reference_ids:p.bone_reference_ids||[],registered_by_qualified_anatomist:false},
  limitations:['Rigid point-landmark correspondence is not evidence of correct tissue segmentation or biological attachment.',
   'No independently reviewed morphology, ACL/PCL crossing, bone clearance or motion simulation.',
   'This candidate must pass qualified anatomical review and geometric QA before being rendered as validated.'],
  mesh:{vertices,faces:mesh.faces}
 };
}
export function evaluateVerification(record){
 const errors=[];const fail=x=>errors.push(x);
 if(!record||record.schema!=='body-live/registered-connective-candidate-v1')fail('Invalid registration schema');
 const s=record?.source,r=record?.registration,v=record?.review;
 if(!s?.asset_id||!/^https:\/\//.test(s.uri||'')||!/^https:\/\//.test(s.license_url||'')||!s.license||!s.attribution||!/^[a-f0-9]{64}$/i.test(s.original_sha256||''))fail('Missing attributable hashed original source');
 if(!['left','right','midline'].includes(s?.laterality)||!s?.coordinate_system||!['mm','m'].includes(s?.units))fail('Missing source laterality and coordinates');
 if(!r||!Array.isArray(r.transform_matrix_metres)||r.transform_matrix_metres.length!==16||!r.transform_matrix_metres.every(Number.isFinite)||!r.target_frame||!r.target_units||!Array.isArray(r.fit_landmark_ids)||r.fit_landmark_ids.length<3||!Array.isArray(r.holdout_landmark_ids)||r.holdout_landmark_ids.length<2||!Number.isFinite(r.fit_rms_mm)||!Number.isFinite(r.holdout_rms_mm)||r.fit_rms_mm<0||r.holdout_rms_mm<0||!r.bone_reference_ids?.length)fail('Incomplete quantitative anatomical registration');
 if(!v||v.anatomist_approved!==true||!v.reviewer_name||!v.review_date||!/^https:\/\//.test(v.review_record_uri||'')||!v.geometry_and_attachments_reviewed||!v.orientation_and_clearance_reviewed||!v.review_protocol_id)fail('Missing independent qualified anatomical review');
 if(record?.attachment_coordinates_validated===true&&!v?.geometry_and_attachments_reviewed)fail('Unsupported attachment assertion');
 if(record?.kinematics_validated===true)fail('No motion simulation evidence gate implemented');
 return {eligible:errors.length===0,errors};
}
