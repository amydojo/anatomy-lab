import test from 'node:test';
import assert from 'node:assert/strict';
import {existsSync,readFileSync,readdirSync,statSync} from 'node:fs';
import {join} from 'node:path';
import {routes} from '../nexus/contract.mjs';
import {worldURL} from '../nexus/presence-contract.mjs';
const read=p=>readFileSync(p,'utf8');
function walk(dir){return readdirSync(dir,{withFileTypes:true}).flatMap(e=>e.name.startsWith('.')||['node_modules','test-results','artifacts'].includes(e.name)?[]:e.isDirectory()?walk(join(dir,e.name)):e.name.endsWith('.html')?[join(dir,e.name)]:[]);}
function existsRoute(url){const p=new URL(url,'https://local.invalid').pathname.slice(1)||'index.html';return existsSync(p)&&(statSync(p).isFile()||existsSync(join(p,'index.html')));}
test('root-relative HTML routes and assets exist',()=>{const pages=walk('.');assert.ok(pages.length>=14);for(const p of pages)for(const m of read(p).matchAll(/\b(?:href|src)=["']([^"']+)["']/g)){if(m[1].startsWith('/')&&!m[1].startsWith('//'))assert.ok(existsRoute(m[1].replaceAll('&amp;','&')),p+' → '+m[1]);}});
test('registry preserves unique routes and existing local destinations',()=>{assert.equal(new Set(routes.map(r=>r.id)).size,routes.length);for(const r of routes)if(!r.external)assert.ok(existsRoute(r.href),r.id);assert.match(routes.find(r=>r.id==='explore').href,/presence=1/);assert.doesNotMatch(routes.find(r=>r.id==='axis-continuum').href,/presence=1/);assert.match(worldURL('cinematographer',null),/presence=1.*gravityProfile=cinematographer/);});
test('legacy Atlas label never points to the classic directory; primary entry leads to play',()=>{for(const p of ['hip/index.html','hip/dissection/index.html','knee/index.html','shoulder/index.html']){assert.doesNotMatch(read(p),/<a[^>]*href="\/"[^>]*>Atlas<\/a>/);assert.match(read(p),/href="\/nexus\/"[^>]*>Collections<\/a>/);}assert.match(read('index.html'),/href="\/play\/" class="primary"/);assert.doesNotMatch(read('nexus/index.html'),/Enter anatomy →/);});
