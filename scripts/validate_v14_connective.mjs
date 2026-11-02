#!/usr/bin/env node
/* V14 validation CLI: node scripts/validate_v14_connective.mjs [--coverage PATH] [--json]
 * Never promotes geometry solely because a structure has textual references. */
import {readFileSync,existsSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {resolve,dirname} from 'node:path';
import vm from 'node:vm';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const argv=process.argv.slice(2);
const resolveFile=path=>resolve(root,path);
const knowledgePath='atlas/assets/v14-connective-knowledge.json';
const data=JSON.parse(readFileSync(resolveFile(knowledgePath),'utf8'));
const coverageArg=argv.indexOf('--coverage');
if(coverageArg>=0&&!argv[coverageArg+1])throw Error('--coverage requires a file path');
const coveragePath=coverageArg>=0?argv[coverageArg+1]:null;
const coverage=coveragePath?JSON.parse(readFileSync(resolveFile(coveragePath),'utf8')):null;
const runtime={window:{},URL};
vm.runInNewContext(readFileSync(resolveFile('assets/atlas/connective-intelligence.js'),'utf8'),runtime);
const engine=runtime.window.BodyConnectiveIntelligence;
const errors=engine.validateKnowledge(data,coverage);
const report=engine.create(data,coverage,{allowInvalid:true}).getCoverageReport();
if(argv.includes('--json'))console.log(JSON.stringify({ok:errors.length===0,report,errors},null,2));
else{
 console.log('BODY / LIVE V14 anatomical intelligence validation');
 console.log('Structures: '+report.total+'/26; region counts: '+Object.entries(report.byRegion).map(([k,v])=>k+'='+v.records).join(', '));
 console.log('Graph edges: '+data.relationships.length+'; cited sources: '+Object.keys(data.sources).length+'; unverified geometry: '+report.unverifiedGeometry);
 if(coveragePath)console.log('Canonical coverage cross-check: '+coveragePath);
 for(const item of errors)console.error('FAIL ['+item.code+'] '+item.path+': '+item.message);
 console.log(errors.length?'FAIL '+errors.length+' scientific/data integrity errors':'PASS - structural, citation-metadata and anatomical consistency checks');
}
if(errors.length)process.exitCode=1;
