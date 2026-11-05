/* Reusable, conservative registration mathematics for anatomical mesh candidates.
 * SOFTWARE CHECKS HERE NEVER CREATE A VERIFIED STATUS. They only decide whether a candidate is eligible to be
 * put in front of a qualified anatomist; promotion to verified is a deliberate human edit that the coverage
 * validator re-checks against retained evidence (see scripts/validate_connective_coverage.cjs).
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
/* Explicit tolerance policy. These are PROVISIONAL ENGINEERING SCREENING values chosen to reject gross
 * errors (mirroring, wrong bone, wrong units). They are NOT clinically validated accuracy thresholds and
 * passing them is never evidence that tissue is anatomically correct. Changing them is a reviewed change. */
export const REGISTRATION_POLICY=Object.freeze({
 version:'body-live/registration-policy-v1',
 status:'provisional-engineering-screen',clinically_validated:false,
 min_fit_landmarks:4,                 // 3 points cannot detect a mirrored (left/right) solution
 min_holdout_landmarks:2,
 min_fit_volume_mm3:100,              // fit landmarks must span a volume (non-coplanar) so chirality is determined
 min_holdout_separation_mm:5,         // a held-out landmark must be a different place from every fit landmark and each other
 max_fit_rms_mm:2,max_holdout_rms_mm:5,
 matrix_tolerance:1e-6,residual_recompute_tolerance_mm:1e-3
});
const HEX64=/^[a-f0-9]{64}$/i;
const canonical=v=>Array.isArray(v)?'['+v.map(canonical).join(',')+']':v&&typeof v==='object'?'{'+Object.keys(v).sort().map(k=>JSON.stringify(k)+':'+canonical(v[k])).join(',')+'}':JSON.stringify(v);
export const meshSha256=mesh=>sha256(Buffer.from(JSON.stringify({vertices:mesh.vertices,faces:mesh.faces})));
export const candidateDigest=record=>sha256(Buffer.from(canonical({source:record.source,registration:record.registration,mesh_sha256:record.mesh_sha256})));
const maxTetraVolumeMm3=pts=>{
 let best=0;const mm=pts.map(p=>scale(p,1000));
 for(let i=0;i<mm.length;i++)for(let j=i+1;j<mm.length;j++)for(let k=j+1;k<mm.length;k++)for(let l=k+1;l<mm.length;l++)
  best=Math.max(best,Math.abs(dot(sub(mm[j],mm[i]),cross(sub(mm[k],mm[i]),sub(mm[l],mm[i]))))/6);
 return best;
};
/* Row-major 4x4 [R|t;0 0 0 1] must be finite, orthonormal and proper (det +1): rigid, no scale, shear or mirror. */
export function validateRigidMatrix(m,policy=REGISTRATION_POLICY){
 const errors=[],tol=policy.matrix_tolerance;
 if(!Array.isArray(m)||m.length!==16||!m.every(Number.isFinite))return ['Transform must be 16 finite numbers'];
 if(Math.abs(m[12])>tol||Math.abs(m[13])>tol||Math.abs(m[14])>tol||Math.abs(m[15]-1)>tol)errors.push('Transform bottom row must be 0 0 0 1');
 const R=[[m[0],m[1],m[2]],[m[4],m[5],m[6]],[m[8],m[9],m[10]]];
 for(let i=0;i<3;i++)for(let j=0;j<3;j++)if(Math.abs(dot(R[i],R[j])-(i===j?1:0))>tol){errors.push('Transform rotation is not orthonormal (scale, shear or non-rigid)');i=3;break;}
 const det=dot(R[0],cross(R[1],R[2]));
 if(Math.abs(det-1)>tol)errors.push('Transform determinant '+det.toFixed(6)+' is not +1 (reflection or scaling)');
 return errors;
}
const applyMatrix=(m,p)=>[0,1,2].map(i=>m[4*i]*p[0]+m[4*i+1]*p[1]+m[4*i+2]*p[2]+m[4*i+3]);
const rmsMm=list=>Math.sqrt(list.reduce((n,x)=>n+x*x,0)/list.length);
const residualsMm=(m,list)=>list.map(l=>1000*norm(sub(applyMatrix(m,l.source_m),l.target_m)));
/* Structural + numerical checks of retained landmark evidence. Never trusts reported RMS fields. */
function checkLandmarkEvidence(ev,matrix,policy,errors){
 const fit=ev?.fit,hold=ev?.holdout,ok=l=>Array.isArray(l)&&l.every(x=>typeof x?.id==='string'&&x.id&&vector(x.source_m)&&vector(x.target_m));
 if(!ok(fit)||!ok(hold)){errors.push('Retained landmark coordinates missing; registration cannot be recomputed');return null;}
 if(fit.length<policy.min_fit_landmarks)errors.push('At least '+policy.min_fit_landmarks+' fit landmarks required');
 if(hold.length<policy.min_holdout_landmarks)errors.push('At least '+policy.min_holdout_landmarks+' independent holdout landmarks required');
 const all=[...fit,...hold];
 if(new Set(all.map(x=>x.id)).size!==all.length)errors.push('Landmark IDs overlap or repeat between fit and holdout');
 if(fit.length>=4&&(maxTetraVolumeMm3(fit.map(x=>x.source_m))<policy.min_fit_volume_mm3||maxTetraVolumeMm3(fit.map(x=>x.target_m))<policy.min_fit_volume_mm3))
  errors.push('Fit landmarks are (near-)coplanar; mirrored solutions cannot be excluded');
 const minSep=policy.min_holdout_separation_mm/1000;
 const tooClose=(a,b)=>norm(sub(a.source_m,b.source_m))<minSep||norm(sub(a.target_m,b.target_m))<minSep;
 for(const h of hold){
  if(fit.some(f=>tooClose(h,f)))errors.push('Holdout landmark '+h.id+' duplicates or sits on a fit landmark (not independent)');
 }
 for(let i=0;i<hold.length;i++)for(let j=i+1;j<hold.length;j++)if(tooClose(hold[i],hold[j]))errors.push('Holdout landmarks '+hold[i].id+' and '+hold[j].id+' are not distinct');
 if(!matrix)return null;
 const fitRms=rmsMm(residualsMm(matrix,fit)),holdRms=rmsMm(residualsMm(matrix,hold));
 if(!(fitRms<=policy.max_fit_rms_mm))errors.push('Recomputed fit RMS '+fitRms.toFixed(3)+' mm exceeds screening policy '+policy.max_fit_rms_mm+' mm');
 if(!(holdRms<=policy.max_holdout_rms_mm))errors.push('Recomputed holdout RMS '+holdRms.toFixed(3)+' mm exceeds screening policy '+policy.max_holdout_rms_mm+' mm');
 return {fitRms,holdRms};
}
export function registerMesh({mesh,provenance,rawBytes,originalBytes,policy=REGISTRATION_POLICY}){
 assertMesh(mesh);
 const p=provenance;
 const required=['source_uri','source_asset_id','license','license_url','attribution','original_sha256','source_coordinate_system','source_units','laterality','target_laterality','target_frame','target_units','landmarks'];
 if(!p||required.some(k=>!p[k]))throw Error('Missing source identity, license, coordinates or landmark provenance');
 if(!/^https:\/\//.test(p.source_uri)||!/^https:\/\//.test(p.license_url)||!p.attribution.trim())throw Error('Non-auditable license/source URI or attribution');
 if(!HEX64.test(p.original_sha256))throw Error('Missing original SHA-256');
 // The original upstream file and the converted/working mesh are different artifacts with different hashes.
 const converted=!!p.conversion;
 if(converted&&!HEX64.test(p.converted_mesh_sha256||''))throw Error('Converted mesh SHA-256 required when the source was converted');
 const meshHash=(converted?p.converted_mesh_sha256:p.original_sha256).toLowerCase();
 if(!rawBytes||sha256(rawBytes)!==meshHash)throw Error('Working mesh bytes SHA-256 mismatch');
 let originalVerified=false;
 if(converted){
  if(originalBytes){if(sha256(originalBytes)!==p.original_sha256.toLowerCase())throw Error('Original source bytes SHA-256 mismatch');originalVerified=true;}
 }else originalVerified=true;
 if(!['right','left','midline'].includes(p.laterality)||!['right','left','midline'].includes(p.target_laterality))throw Error('Source laterality unresolved');
 if(p.laterality!==p.target_laterality)throw Error('Laterality mismatch between source ('+p.laterality+') and target ('+p.target_laterality+'); mirrored data is not accepted');
 if(!['mm','m'].includes(p.source_units)||!['mm','m','scene'].includes(p.target_units))throw Error('Unsupported or unresolved units');
 if(p.target_units==='scene'&&!(Number.isFinite(p.target_metres_per_unit)&&p.target_metres_per_unit>0))throw Error('Scene scale to metres required');
 const fromMetres=p.source_units==='mm'?.001:1,toMetres=p.target_units==='mm'?.001:p.target_units==='m'?1:p.target_metres_per_unit;
 const l=p.landmarks;
 if(!Array.isArray(l.fit)||l.fit.length<policy.min_fit_landmarks||!Array.isArray(l.holdout)||l.holdout.length<policy.min_holdout_landmarks)
  throw Error('Require at least '+policy.min_fit_landmarks+' non-coplanar fit and '+policy.min_holdout_landmarks+' independently held-out landmarks');
 const both=[...l.fit,...l.holdout];
 if(new Set(both.map(x=>x.id)).size!==both.length)throw Error('Landmark fit/holdout overlap');
 const toPair=x=>({id:x.id,source:scale(x.source,fromMetres),target:scale(x.target,toMetres)});
 const fitted=fitRigidPairs(l.fit.map(toPair));
 const holdout=l.holdout.map(toPair).map(x=>({id:x.id,error_mm:1000*norm(sub(fitted.transform(x.source),x.target))}));
 const holdout_rms_mm=Math.sqrt(holdout.reduce((v,x)=>v+x.error_mm**2,0)/holdout.length);
 if(!Number.isFinite(holdout_rms_mm))throw Error('Nonfinite holdout error');
 const evidence={fit:l.fit.map(toPair).map(x=>({id:x.id,source_m:x.source,target_m:x.target})),holdout:l.holdout.map(toPair).map(x=>({id:x.id,source_m:x.source,target_m:x.target}))};
 const R=fitted.rotation,t=fitted.translation;
 const matrix_metres=[R[0][0],R[0][1],R[0][2],t[0],R[1][0],R[1][1],R[1][2],t[1],R[2][0],R[2][1],R[2][2],t[2],0,0,0,1];
 const policyErrors=[];
 const re=checkLandmarkEvidence(evidence,matrix_metres,policy,policyErrors);
 if(policyErrors.length)throw Error('Registration rejected by policy: '+policyErrors.join('; '));
 const vertices=mesh.vertices.map(v=>scale(fitted.transform(scale(v,fromMetres)),1/toMetres));
 const out={
  schema:'body-live/registered-connective-candidate-v1',
  status:'source-registered-unreviewed',
  geometry_verified:false,attachment_coordinates_validated:false,kinematics_validated:false,
  source:{uri:p.source_uri,asset_id:p.source_asset_id,license:p.license,license_url:p.license_url,attribution:p.attribution,
   original_sha256:p.original_sha256,original_bytes_verified:originalVerified,converted_mesh_sha256:meshHash,conversion:p.conversion||null,
   laterality:p.laterality,coordinate_system:p.source_coordinate_system,units:p.source_units},
  registration:{method:'rigid Horn quaternion; fit landmarks + independent holdouts',target_frame:p.target_frame,target_units:p.target_units,target_laterality:p.target_laterality,
   target_metres_per_unit:toMetres,transform_matrix_metres:matrix_metres,policy_version:policy.version,
   fit_landmark_ids:l.fit.map(x=>x.id),holdout_landmark_ids:l.holdout.map(x=>x.id),landmark_evidence:evidence,
   fit_rms_mm:re.fitRms,holdout_rms_mm:re.holdRms,fit_residuals:fitted.residuals,holdout_residuals:holdout,
   bone_reference_ids:p.bone_reference_ids||[],registered_by_qualified_anatomist:false},
  limitations:['Rigid point-landmark correspondence is not evidence of correct tissue segmentation or biological attachment.',
   'No independently reviewed morphology, ACL/PCL crossing, bone clearance or motion simulation.',
   'Tolerances are provisional engineering screens, not clinically validated accuracy thresholds.',
   'This candidate must pass qualified anatomical review and geometric QA before being rendered as validated.'],
  mesh:{vertices,faces:mesh.faces}
 };
 out.mesh_sha256=meshSha256(out.mesh);
 return out;
}
/* Software eligibility only. verified is ALWAYS false: this function can make a candidate eligible for
 * human promotion, never verified. Review metadata alone is inert: the reviewer must be on the supplied
 * roster, the review must be bound to this exact candidate digest, and the review document bytes must hash
 * to the stated review_record_sha256. Nothing here is a clinical or anatomical validation. */
export function evaluateVerification(record,context={}){
 const errors=[];const fail=x=>errors.push(x);
 const policy=context.policy||REGISTRATION_POLICY;
 if(!record||record.schema!=='body-live/registered-connective-candidate-v1')fail('Invalid registration schema');
 const s=record?.source,r=record?.registration,v=record?.review;
 if(!s?.asset_id||!/^https:\/\//.test(s.uri||'')||!/^https:\/\//.test(s.license_url||'')||!s.license||!s.attribution||!HEX64.test(s.original_sha256||''))fail('Missing attributable hashed original source');
 if(s&&s.original_bytes_verified!==true)fail('Original source file hash was not verified against the original bytes');
 if(s&&!HEX64.test(s.converted_mesh_sha256||''))fail('Converted mesh hash missing');
 if(!['left','right','midline'].includes(s?.laterality)||!s?.coordinate_system||!['mm','m'].includes(s?.units))fail('Missing source laterality and coordinates');
 if(!['left','right'].includes(context.expectedLaterality))fail('Expected laterality not supplied by trusted evidence');
 else if(s?.laterality!==context.expectedLaterality)fail('Source laterality '+s?.laterality+' does not match expected '+context.expectedLaterality);
 if(r&&r.target_laterality!==s?.laterality)fail('Target laterality does not match source laterality');
 if(!r||!r.target_frame||!r.target_units||!Array.isArray(r.fit_landmark_ids)||!Array.isArray(r.holdout_landmark_ids))fail('Incomplete quantitative anatomical registration');
 const matrixErrors=validateRigidMatrix(r?.transform_matrix_metres,policy);matrixErrors.forEach(fail);
 const ev=r?.landmark_evidence;
 const recomputed=checkLandmarkEvidence(ev,matrixErrors.length?null:r.transform_matrix_metres,policy,errors);
 if(ev&&(JSON.stringify(ev.fit?.map(x=>x.id))!==JSON.stringify(r.fit_landmark_ids)||JSON.stringify(ev.holdout?.map(x=>x.id))!==JSON.stringify(r.holdout_landmark_ids)))fail('Landmark ID lists do not match retained landmark evidence');
 if(recomputed){
  const tol=policy.residual_recompute_tolerance_mm;
  if(!Number.isFinite(r.fit_rms_mm)||Math.abs(r.fit_rms_mm-recomputed.fitRms)>tol)fail('Reported fit RMS does not match RMS recomputed from landmark evidence');
  if(!Number.isFinite(r.holdout_rms_mm)||Math.abs(r.holdout_rms_mm-recomputed.holdRms)>tol)fail('Reported holdout RMS does not match RMS recomputed from landmark evidence');
 }
 const known=context.knownBoneReferenceIds;
 if(!Array.isArray(r?.bone_reference_ids)||!r.bone_reference_ids.length||!Array.isArray(known)||!r.bone_reference_ids.every(id=>known.includes(id)))fail('Bone reference IDs are missing or not in the trusted evidence set');
 if(!record?.mesh||!Array.isArray(record.mesh.vertices)||!HEX64.test(record.mesh_sha256||'')||meshSha256(record.mesh)!==record.mesh_sha256)fail('Registered mesh is missing or does not match mesh_sha256');
 // Review: metadata is inert unless it is tied to a rostered human, this exact candidate and a hashed review document.
 const roster=Array.isArray(context.qualifiedReviewers)?context.qualifiedReviewers:[];
 if(!v||v.anatomist_approved!==true||!v.reviewer_name||!v.reviewer_id||!/^\d{4}-\d{2}-\d{2}$/.test(v.review_date||'')||!/^https:\/\//.test(v.review_record_uri||'')||!v.geometry_and_attachments_reviewed||!v.orientation_and_clearance_reviewed||!v.review_protocol_id)fail('Missing independent qualified anatomical review');
 else{
  if(!roster.some(x=>x.id===v.reviewer_id&&x.name===v.reviewer_name&&x.qualified===true))fail('Reviewer is not on the qualified-reviewer roster');
  if(!HEX64.test(v.review_record_sha256||'')||!context.reviewRecordBytes||sha256(context.reviewRecordBytes)!==v.review_record_sha256.toLowerCase())fail('Review record bytes do not match review_record_sha256');
  if(v.reviewed_candidate_sha256!==candidateDigest(record))fail('Review is not bound to this exact registration candidate');
 }
 if(record?.attachment_coordinates_validated===true)fail('Attachment validation has no evidence gate implemented');
 if(record?.kinematics_validated===true)fail('No motion simulation evidence gate implemented');
 return {eligible:errors.length===0,verified:false,status:errors.length===0?'eligible-for-human-promotion':'unverified',errors,policy:policy.version};
}
