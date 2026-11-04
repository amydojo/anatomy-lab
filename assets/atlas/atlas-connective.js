/* BODY / LIVE V14 — explicitly illustrative connective geometry and evidence-aware regional browser.
 * Geometry below is authored for education, NOT imported source anatomy or verified insertion coordinates.
 */
(function(){'use strict';
const SOURCE='https://openstax.org/books/anatomy-and-physiology-2e/pages/9-6-anatomy-of-selected-synovial-joints';
const CLINICAL='https://www.ncbi.nlm.nih.gov/books/NBK500017/';
const KNEE=[
 ['quadriceps-tendon','Quadriceps tendon','tendon','Quadriceps femoris to superior pole of patella','Transmits quadriceps force into the patella during knee extension',SOURCE],
 ['patellar-ligament','Patellar ligament (patellar tendon)','ligament','Patellar apex to tibial tuberosity','Completes the quadriceps extensor mechanism between patella and tibia',SOURCE],
 ['medial-collateral-ligament','Medial collateral ligament (MCL)','ligament','Medial femoral epicondyle to medial tibia; associated with capsule and medial meniscus','Resists valgus opening and contributes to rotational stability',SOURCE],
 ['lateral-collateral-ligament','Lateral collateral ligament (LCL)','ligament','Lateral femoral epicondyle to fibular head; separate from lateral meniscus','Resists varus opening and stabilizes the lateral knee',SOURCE],
 ['anterior-cruciate-ligament','Anterior cruciate ligament (ACL)','ligament','Anterior tibial intercondylar area to posteromedial wall of lateral femoral condyle','Restrains anterior translation of the tibia and contributes to rotational control',CLINICAL],
 ['posterior-cruciate-ligament','Posterior cruciate ligament (PCL)','ligament','Posterior tibial intercondylar area to anterolateral wall of medial femoral condyle','Restrains posterior tibial translation, especially during flexion',CLINICAL],
 ['medial-meniscus','Medial meniscus','fibrocartilage','Medial tibial plateau, between the medial femoral condyle and tibia','Distributes contact loads; its less mobile margin is associated with MCL and capsule',SOURCE],
 ['lateral-meniscus','Lateral meniscus','fibrocartilage','Lateral tibial plateau, between the lateral femoral condyle and tibia','Distributes load and accommodates femorotibial motion',SOURCE]
];
const record=Object.freeze(Object.fromEntries(KNEE.map(([id,name,tissue,attachments,role,source])=>[id,Object.freeze({id,name,tissue,attachments,role,source,license:'Original BODY / LIVE illustrative geometry; NOT a source-derived mesh',verification:'Illustrative — landmark estimates only; insertion coordinates, registration error, topology and morphology NOT independently verified',limitations:'Stylized conceptual surface in a source-bone coordinate frame. Do not infer specimen-specific attachments, clearance, rupture, force, or biomechanics.'})])));
const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
const avg=(pts,j)=>pts.reduce((v,p)=>v+p[j],0)/Math.max(1,pts.length);
function bounds(vertices){
 const lo=[Infinity,Infinity,Infinity],hi=[-Infinity,-Infinity,-Infinity];
 for(const p of vertices)for(let j=0;j<3;j++){lo[j]=Math.min(lo[j],p[j]);hi[j]=Math.max(hi[j],p[j]);}
 return {lo,hi,c:lo.map((v,i)=>(v+hi[i])/2),width:hi[0]-lo[0],height:hi[1]-lo[1]};
}
function tube(a,b,r1,r2,offset=[0,0,0]){
 const vertices=[],faces=[],segments=16,rings=12;
 const v=[b[0]-a[0],b[1]-a[1],b[2]-a[2]],vl=Math.hypot(...v)||1;const axis=v.map(n=>n/vl);
 const other=Math.abs(axis[1])<.85?[0,1,0]:[1,0,0];
 const cross=(u,w)=>[u[1]*w[2]-u[2]*w[1],u[2]*w[0]-u[0]*w[2],u[0]*w[1]-u[1]*w[0]];
 const norm=p=>{const m=Math.hypot(...p)||1;return p.map(n=>n/m);};
 const n=norm(cross(axis,other)),m=norm(cross(axis,n));
 for(let i=0;i<=rings;i++){
  const t=i/rings,fade=Math.sin(Math.PI*t)*.10+1,rt=(r1*(1-t)+r2*t)*fade;
  for(let j=0;j<segments;j++){
   const phi=2*Math.PI*j/segments;
   vertices.push(a.map((x,k)=>x+t*v[k]+offset[k]*Math.sin(Math.PI*t)+rt*(n[k]*Math.cos(phi)+m[k]*Math.sin(phi))));
  }
 }
 for(let i=0;i<rings;i++)for(let j=0;j<segments;j++){const a=i*segments+j,b=i*segments+(j+1)%segments,c=(i+1)*segments+j,d=(i+1)*segments+(j+1)%segments;faces.push([a,c,b],[b,c,d]);}
 return {vertices,faces};
}
function meniscus(cx,y,cz,rx,rz,opening){
 const vertices=[],faces=[],steps=48;
 // Curved, tapered C-shaped teaching representation; no assertion of a real meniscal contour.
 for(let i=0;i<=steps;i++){
  const t=i/steps,theta=opening+(.25+t*(Math.PI*2-.50));
  const taper=Math.pow(Math.sin(Math.PI*t),.65);
  for(const radial of [.56,1])for(const sign of [-1,1]){
   const f=radial,depth=(.025+.020*f)*taper;
   vertices.push([cx+Math.cos(theta)*rx*f,y+sign*depth,cz+Math.sin(theta)*rz*f]);
  }
 }
 for(let i=0;i<steps;i++)for(let j=0;j<4;j++){const a=4*i+j,b=4*(i+1)+j;
  if(j===0)faces.push([a,b,a+1],[a+1,b,b+1]);
  else if(j===2)faces.push([a,a+1,b],[a+1,b+1,b]);
 }
 for(let i=0;i<steps;i++){let a=i*4,b=(i+1)*4;faces.push([a,b,a+2],[a+2,b,b+2]);faces.push([a+1,a+3,b+1],[a+3,b+3,b+1]);}
 return {vertices,faces};
}
function buildKnee(parts){
 const find=(id)=>{const p=parts[id];if(!p?.vertices?.length)throw Error('V14 needs the registered '+id+' source bone');return bounds(p.vertices);};
 const fem=find('femur'),tib=find('tibia'),fib=find('fibula'),pat=find('patella');
 const lat=Math.sign(fib.c[0]-tib.c[0])||1,med=-lat;
 const anterior=Math.sign(pat.c[2]-(fem.c[2]+tib.c[2])/2)||1;
 const size=clamp(fem.width*.25,.09,.27);
 const joint=(fem.lo[1]+tib.hi[1])/2;
 const x=tib.c[0],z=tib.c[2],front=anterior,sep=size*.83;
 const yUpper=joint+size*.55,yLower=joint-size*.65;
 const ox=t=>x+t*size,oz=t=>z+t*size*front;
 const r=size*.12;
 const meshes={};
 meshes['quadriceps-tendon']=tube([pat.c[0],pat.hi[1]-size*.08,pat.c[2]],[pat.c[0],pat.hi[1]+size*1.6,pat.c[2]-front*size*.18],r*1.5,r*2.1);
 meshes['patellar-ligament']=tube([pat.c[0],pat.lo[1]+size*.13,pat.c[2]],[tib.c[0],tib.hi[1]-size*.85,oz(1.25)],r*1.3,r*1.8);
 meshes['medial-collateral-ligament']=tube([ox(med*1.55),yUpper,oz(.02)],[ox(med*1.45),yLower,oz(.17)],r*.9,r*1.35);
 meshes['lateral-collateral-ligament']=tube([ox(lat*1.54),yUpper,oz(-.12)],[fib.c[0],Math.min(fib.hi[1]-size*.18, yLower),fib.c[2]],r*.7,r*.7);
 meshes['anterior-cruciate-ligament']=tube([ox(med*.1),joint-size*.21,oz(.34)],[ox(lat*.68),joint+size*.72,oz(-.46)],r*.68,r*.67,[0,0,front*size*.08]);
 meshes['posterior-cruciate-ligament']=tube([ox(lat*.12),joint-size*.28,oz(-.45)],[ox(med*.7),joint+size*.88,oz(.23)],r*.9,r*.70,[0,0,-front*size*.08]);
 meshes['medial-meniscus']=meniscus(ox(med*.82),tib.hi[1]-size*.12,oz(.02),size*.63,size*.69,med>0?0:Math.PI);
 meshes['lateral-meniscus']=meniscus(ox(lat*.83),tib.hi[1]-size*.10,oz(.02),size*.59,size*.62,lat>0?0:Math.PI);
 // Output in the actual V13 world coordinate system; no unmeasured millimetre error claim.
 for(const [id,mesh] of Object.entries(meshes)){
  if(mesh.vertices.some(p=>p.some(v=>!Number.isFinite(v)))||mesh.faces.length<50)throw Error('Illustrative mesh construction failed: '+id);
  mesh.id=id;mesh.name=record[id].name;mesh.system=record[id].tissue;mesh.illustrative=true;
 }
 return meshes;
}
function mount({model,render,U}){
 const stage=document.getElementById('atlas-stage');if(!stage)return null;
 const button=document.createElement('button');button.id='connective-toggle';button.type='button';button.textContent='Connective anatomy';button.hidden=true;stage.append(button);
 const panel=document.createElement('section');panel.id='connective-workbench';panel.hidden=true;panel.setAttribute('aria-label','Connective anatomy explorer');
 panel.innerHTML='<header><strong>CONNECTIVE / ATLAS</strong><button type="button" data-close aria-label="Close connective anatomy">×</button></header><p class="connective-evidence"></p><div class="connective-tissues" role="group" aria-label="Tissue visibility"></div><div class="connective-items"></div><div class="connective-report" aria-live="polite"></div>';
 stage.append(panel);
 const css=document.createElement('style');css.textContent=`
 #connective-toggle{position:absolute;right:15px;bottom:78px;z-index:32;border:1px solid #8d7669;background:#251f1a;color:#f0e4d9;border-radius:22px;padding:10px 16px;font:600 12px system-ui;letter-spacing:.04em;cursor:pointer}
 #connective-toggle[hidden],#connective-workbench[hidden]{display:none!important}
 #connective-workbench{position:absolute;right:15px;top:55px;z-index:35;width:min(340px,calc(100% - 28px));max-height:min(70vh,580px);overflow:auto;background:rgba(27,24,22,.96);border:1px solid #735f51;border-radius:15px;padding:15px;box-shadow:0 14px 44px #08060488;color:#f2e8dc;font:13px system-ui}
 #connective-workbench header{display:flex;justify-content:space-between;align-items:center;font-size:11px;letter-spacing:.15em}
 #connective-workbench button{color:inherit;cursor:pointer}
 #connective-workbench [data-close]{border:0;background:transparent;font-size:23px}
 #connective-workbench .connective-evidence{font-size:11px;color:#cab9a8;line-height:1.5}
 #connective-workbench .connective-tissues{display:flex;flex-wrap:wrap;gap:5px;margin:14px 0}
 #connective-workbench .connective-tissues button{font-size:11px;background:transparent;border:1px solid #6b594e;border-radius:8px;padding:7px}
 #connective-workbench button[aria-pressed="true"]{background:#ddbd97!important;color:#1c1714!important}
 #connective-workbench .connective-items{display:grid;grid-template-columns:1fr 1fr;gap:6px}
 #connective-workbench .connective-items button{text-align:left;background:#3a302a;border:1px solid #5b4a42;padding:9px;border-radius:7px;font-size:11px}
 #connective-workbench .connective-items button:disabled{opacity:.53;cursor:not-allowed}
 #connective-workbench .connective-report{border-top:1px solid #6b594e;margin-top:12px;padding-top:10px;font-size:11px;line-height:1.55}
 #connective-workbench .connective-report strong{display:block;font-size:14px;margin-bottom:5px}
 #connective-workbench .connective-report a{color:#e9c49b}
 @media(max-width:700px){#connective-toggle{bottom:100px;right:10px}#connective-workbench{bottom:100px;top:auto;right:10px;max-height:58vh}}
 `;document.head.append(css);
 let active=false,current=null,visible={bones:true,muscles:false,ligament:true,tendon:true,fibrocartilage:true},selected=null;
 const note=panel.querySelector('.connective-evidence'),tissues=panel.querySelector('.connective-tissues'),items=panel.querySelector('.connective-items'),report=panel.querySelector('.connective-report');
 const names={bones:'Bones',muscles:'Muscles',ligament:'Ligaments',tendon:'Tendons',fibrocartilage:'Fibrocartilage'};
 const syncState=()=>{if(document.getElementById('atlas-app')?.dataset.connectiveStudio==='true')return;model.setConnectiveState({enabled:active&&current==='knee',visible,isolated:selected});render();};
 function inspect(id){
  const p=record[id];if(!p)return;
  selected=id;
  const details=[['Type',p.tissue],['Attachments / relationships',p.attachments],['Function',p.role],['Geometry status',p.verification],['License',p.license],['Limitations',p.limitations]];
  report.replaceChildren();
  const h=document.createElement('strong');h.textContent=p.name;report.append(h);
  for(const [key,value] of details){const el=document.createElement('p');el.textContent=key+': '+value;report.append(el);}
  const a=document.createElement('a');a.href=p.source;a.target='_blank';a.rel='noopener noreferrer';a.textContent='Anatomical reference ↗';report.append(a);
  items.querySelectorAll('button').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.id===id)));
 }
 function open(region){
  current=region;button.hidden=!['knee','shoulder','hip','ankle','wrist','neck','thorax'].includes(region);
  const spine=region==='neck'||region==='thorax';if(spine)region='spine';
  if(!button.hidden&&model.hasDetail(current)&&current==='knee'){
   try{model.loadConnectiveIllustrations('knee');}catch(e){note.textContent='Connective geometry unavailable: '+e.message;active=false;}
  }
  if(!active){panel.hidden=true;button.setAttribute('aria-pressed','false');}
  else if(!button.hidden){panel.hidden=false;button.setAttribute('aria-pressed','true');}
  items.replaceChildren();tissues.replaceChildren();selected=null;
  const available=current==='knee'&&model.hasDetail('knee');
  note.textContent=available?'Eight EDUCATIONAL ILLUSTRATIONS, not source-derived anatomy. Base bones are BodyParts3D 4.0 (CC BY 4.0). No validated ligament insertion coordinates or meniscal geometry.':'Connective structures for this region are documented in the inventory but no registered source meshes are available. Nothing will be fabricated or labeled verified.';
  if(available){
   for(const [key,name] of Object.entries(names)){const el=document.createElement('button');el.type='button';el.textContent=name;el.setAttribute('aria-pressed',String(visible[key]));el.onclick=()=>{visible[key]=!visible[key];el.setAttribute('aria-pressed',String(visible[key]));syncState();};tissues.append(el);}
   for(const p of Object.values(record)){const el=document.createElement('button');el.dataset.id=p.id;el.type='button';el.textContent=p.name;el.onclick=()=>{if(!active)active=true;U.selectById(p.id);inspect(p.id);syncState();};items.append(el);}
   report.textContent='Choose a structure to isolate, highlight and inspect. Tap a visible surface to select it directly. Use the tissue filters to compare contexts.';
  }else{
   report.textContent='Evidence gate: requires licensed geometry, shared-frame transformation, registration error and attachment review before this region can be represented as complete.';
  }
  syncState();
 }
 button.onclick=()=>{active=!active;panel.hidden=!active;button.setAttribute('aria-pressed',String(active));if(active)open(current);else syncState();};
 panel.querySelector('[data-close]').onclick=()=>{active=false;panel.hidden=true;button.setAttribute('aria-pressed','false');syncState();};
 window.addEventListener('body:region-ready',ev=>open(ev.detail.region));
 window.addEventListener('body:structure-selected',ev=>{if(record[ev.detail?.id]&&current==='knee'){inspect(ev.detail.id);syncState();}});
 window.addEventListener('body:region-exited',()=>{active=false;open(null);});
 // Studio owns connective state while open. Return the legacy workbench to a known inactive state on
 // both edges so its toggle, panel and renderer flag can never disagree after Studio exit or reentry.
 const resetLegacy=()=>{active=false;selected=null;visible={bones:true,muscles:false,ligament:true,tendon:true,fibrocartilage:true};panel.hidden=true;button.setAttribute('aria-pressed','false');};
 window.addEventListener('body:connective-studio-open',resetLegacy);
 window.addEventListener('body:connective-studio-closed',()=>{resetLegacy();open(current);});
 return Object.freeze({open,inspect});
}
window.BodyConnectiveMode=Object.freeze({buildKnee,mount,info:id=>record[id]||null,records:()=>Object.values(record)});
})();
