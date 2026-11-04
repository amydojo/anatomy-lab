#!/usr/bin/env node
/* Usage:
 * node scripts/register_connective_source.mjs --source /path/original-mesh.json \
 * --provenance /path/source-and-landmarks.json --out /path/registered-candidate.json [--original /path/upstream-original-file]
 *
 * Source file MUST be original unaltered JSON vertex/face data and its SHA-256
 * MUST match metadata. Never calls a registered candidate "verified".
 */
import fs from 'node:fs';
import path from 'node:path';
import {registerMesh,evaluateVerification} from './geometry/registration.mjs';
const argv=process.argv.slice(2);
const get=k=>{const at=argv.indexOf(k);return at<0?null:argv[at+1]};
const source=get('--source'),evidence=get('--provenance'),out=get('--out'),original=get('--original');
if(!source||!evidence||!out||[source,evidence,out].some(x=>x.startsWith('--'))){
 console.error('Usage: node scripts/register_connective_source.mjs --source mesh.json --provenance evidence.json --out candidate.json');
 process.exit(2);
}
if(path.resolve(out)===path.resolve(source)||path.resolve(out)===path.resolve(evidence))throw Error('Do not overwrite original source or evidence');
const raw=fs.readFileSync(source),data=JSON.parse(raw.toString('utf8'));
const provenance=JSON.parse(fs.readFileSync(evidence,'utf8'));
const originalBytes=original?fs.readFileSync(original):undefined;
const candidate=registerMesh({mesh:data,provenance,rawBytes:raw,originalBytes});
const trusted=JSON.parse(fs.readFileSync(new URL('../atlas/assets/v14-knee-geometry-evidence.json',import.meta.url),'utf8'));
const verdict=evaluateVerification(candidate,{expectedLaterality:trusted.expected_laterality,
 knownBoneReferenceIds:(trusted.source_reference?.bone_references||[]).map(x=>x.id),qualifiedReviewers:[]});
if(verdict.eligible)throw Error('Candidate unexpectedly eligible for verification without review');
fs.mkdirSync(path.dirname(path.resolve(out)),{recursive:true});
fs.writeFileSync(out,JSON.stringify(candidate,null,2)+'\n','utf8');
console.log(JSON.stringify({status:candidate.status,source_asset:candidate.source.asset_id,
 fit_rms_mm:candidate.registration.fit_rms_mm,holdout_rms_mm:candidate.registration.holdout_rms_mm,
 output:path.resolve(out),geometry_verified:false,attachments_validated:false,
 pending_software_gates:verdict.errors,
 pending:['anatomist review','attachment verification','crossing and clearance','five view QA']},null,2));
