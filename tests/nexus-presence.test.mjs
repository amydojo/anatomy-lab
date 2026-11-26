import test from 'node:test';
import assert from 'node:assert/strict';
import {manifest,space,validateSession,worldURL,discover} from '../nexus/presence-contract.mjs';
const session={version:1,manifest,space,region:2,camera:{yaw:.2,pitch:.1,zoom:2,frameSpan:3,target:{x:0,y:1,z:0}},selection:'source-a',isolation:'source-a'};
test('world entry defaults to bounded cervical source, resumes only matching manifest',()=>{assert.match(worldURL('explorer',null),/axisRegion=2/);assert.match(worldURL('cinematographer',{...session,region:3}),/axisRegion=3.*gravityProfile=cinematographer.*presenceResume=1/);assert.equal(validateSession({...session,space:'bodyparts3d'}),null);assert.equal(validateSession({...session,manifest:'other'}),null);assert.equal(validateSession({...session,camera:{...session.camera,zoom:99}}),null);});
test('discovery deduplicates real source identity and ignores incompatible sources',()=>{const h={manifest,id:'source-a',name:'C1',region:'neck'};const a=discover([],h,1);assert.equal(a.length,1);assert.equal(discover(a,h,2).length,1);assert.equal(discover(a,{...h,manifest:'other'}).length,1);assert.equal(discover(a,{...h,region:'other'}).length,1);});
