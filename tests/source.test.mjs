import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync,existsSync} from 'node:fs';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
test('All original public routes remain navigable',()=>{
 for(const path of ['index.html','hip/index.html','knee/index.html','shoulder/index.html','hip/dissection/index.html','references/index.html'])assert.ok(existsSync(new URL('../'+path,import.meta.url)),path);
});
test('All three labs load shared V3 runtime and retained anatomical SVGs',()=>{
 for(const region of ['hip','knee','shoulder']){const s=read(region+'/index.html');assert.match(s,/\/assets\/v3\.js/);assert.match(s,/\/assets\/v3-data\.js/);assert.match(s,/\/assets\/v3\.css/);assert.match(s,/<svg/i);}
});
test('New scripts parse and model includes 12 substantive experiments',()=>{
 for(const path of ['assets/v3-data.js','assets/v3.js','assets/v3-home.js'])assert.doesNotThrow(()=>new Function(read(path)),path);
 const code=read('assets/v3-data.js');const context={window:{}};import('node:vm').then(()=>{}); // intentionally avoid evaluating HTML
 for(const name of ['k-patella','k-menisci','k-quads','k-ligaments','s-mobility','s-cuff','s-scapula','s-rotation','h-motor','h-balance','h-hidden','h-nerve'])assert.ok(code.includes('id:"'+name+'"'),name);
});
test('The atlas and refs remain accessible and use supported routes',()=>{
 const home=read('index.html'),refs=read('references/index.html');for(const path of ['/hip/','/knee/','/shoulder/'])assert.ok(home.includes(path));assert.ok(refs.includes('OpenStax'));
});
