/* BODY / LIVE V8.2 · Region-specific illustrative motion contracts.
 * Sourced geometry is immutable. These bounded demonstration transforms are
 * NOT measured biomechanics or clinical normal ranges. In particular,
 * connective tissue, cartilage, muscles and nerves are not physics-simulated.
 */
(function(){'use strict';
const clamp=(v,a,b)=>Math.max(a,Math.min(b,Number(v)||0));
const rad=Math.PI/180;
const I=()=>new Float32Array([1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1]);
const transform=(m,p)=>[m[0]*p[0]+m[4]*p[1]+m[8]*p[2]+m[12],
 m[1]*p[0]+m[5]*p[1]+m[9]*p[2]+m[13],m[2]*p[0]+m[6]*p[1]+m[10]*p[2]+m[14]];
const mean=vs=>vs.length?[0,1,2].map(i=>vs.reduce((n,p)=>n+p[i],0)/vs.length):[0,0,0];
const averagePart=p=>mean(p?.vertices||[]);
const rot=(axis,pivot,degrees)=>{
 const a=degrees*rad,c=Math.cos(a),s=Math.sin(a),m=I();
 if(axis==='x'){m[5]=c;m[6]=s;m[9]=-s;m[10]=c;}
 else if(axis==='y'){m[0]=c;m[2]=-s;m[8]=s;m[10]=c;}
 else if(axis==='z'){m[0]=c;m[1]=s;m[4]=-s;m[5]=c;}
 else throw Error('Unsupported illustrative rotation axis '+axis);
 const d=transform(m,pivot);for(let j=0;j<3;j++)m[12+j]=pivot[j]-d[j];
 return m;
};
const shift=v=>{const m=I();m[12]=v[0];m[13]=v[1];m[14]=v[2];return m;};
const multiply=(a,b)=>{const c=new Float32Array(16);for(let col=0;col<4;col++)
 for(let row=0;row<4;row++)for(let k=0;k<4;k++)c[col*4+row]+=a[k*4+row]*b[col*4+k];return c;};
const MOTIONS=Object.freeze({
 skull:[{id:'jaw-open',label:'Mandible · opening',max:24,unit:'°',note:'Estimated condylar hinge, without disc mechanics'},
        {id:'jaw-glide',label:'Mandible · translation',max:12,unit:'mm',note:'Schematic anterior glide, no validated TMJ contacts'}],
 neck:[{id:'neck-flex',label:'Cervical · flexion',max:24,unit:'°',note:'Distributed vertebral rotation, not measured segmental mobility'},
       {id:'neck-rotate',label:'Cervical · rotation',max:32,unit:'°',note:'Greater upper-cervical participation, no ligament limits'}],
 thorax:[{id:'breath-in',label:'Thorax · inspiration',max:100,unit:'%',note:'Exaggerated small rib and diaphragm excursions, not measured breathing'},
         {id:'rib-tilt',label:'Rib cage · tilt',max:12,unit:'°',note:'Illustrative costovertebral excursion, not a clinical chest-wall model'}],
 elbow:[{id:'elbow-flex',label:'Elbow · flexion',max:125,unit:'°',note:'Humeroulnar approximation; no cartilage, olecranon or capsule contact'},
        {id:'forearm-turn',label:'Forearm · rotation',max:65,unit:'°',note:'Radius motion around forearm axis; radioulnar joints not coupled accurately'}],
 wrist:[{id:'wrist-flex',label:'Wrist · flexion',max:65,unit:'°',note:'Heuristic carpal and metacarpal coupling, not measured kinematics'},
        {id:'wrist-deviate',label:'Wrist · radial deviation',max:22,unit:'°',note:'No measured scaphoid-lunate or intercarpal constraints'}],
 ankle:[{id:'ankle-dorsi',label:'Ankle · dorsiflexion',max:28,unit:'°',note:'Foot motion around an estimated talocrural pivot, without validated contacts'},
        {id:'subtalar-invert',label:'Hindfoot · inversion',max:24,unit:'°',note:'Subtalar and midfoot approximation without ligament/tendon mechanics'}],
 hip:[{id:'hip-flex',label:'Hip · flexion',max:65,unit:'°',note:'Previously established inferred attachment-guided teaching hinge'},
      {id:'hip-abduct',label:'Hip · abduction',max:38,unit:'°',note:'Femoral rotation about an estimated hip center, no capsule simulation'},
      {id:'hip-rotate',label:'Hip · axial rotation',max:35,unit:'°',note:'Illustrative femoral axial rotation, no capsular limits'}],
 knee:[{id:'knee-flex',label:'Knee · flexion',max:105,unit:'°',note:'Previously established teaching hinge and inferred muscle weights'},
       {id:'knee-rotate',label:'Knee · tibial rotation',max:18,unit:'°',note:'No coupled screw-home mechanics or soft-tissue constraint'}],
 shoulder:[{id:'shoulder-abduct',label:'Shoulder · abduction',max:110,unit:'°',note:'Existing connected shoulder-girdle teaching model, not measured mechanics'},
           {id:'shoulder-flex',label:'Shoulder · flexion',max:95,unit:'°',note:'Simple humeral flexion with resting scapula, not full rhythm'},
           {id:'shoulder-rotate',label:'Shoulder · rotation',max:50,unit:'°',note:'Estimated GH axial rotation with fixed scapula; no ligament constraints'}]
});
const config=region=>MOTIONS[region]||[];
const selected=(region,id)=>config(region).find(m=>m.id===id)||config(region)[0]||null;
const proximal=(part,high=true)=>{
 const ps=part?.vertices||[];
 if(!ps.length)throw Error('Missing source proximal geometry');
 const bound=high?Math.max(...ps.map(p=>p[1])):Math.min(...ps.map(p=>p[1]));
 const points=ps.filter(p=>Math.abs(p[1]-bound)<.16);
 return mean(points.length>=5?points:ps);
};
function pose(region,parts,value,mode){
 const spec=selected(region,mode);
 if(!spec)throw Error('No supported motion for '+region);
 const t=clamp(value,0,spec.max),u=t/spec.max;
 const matrices=Object.fromEntries(Object.keys(parts).map(id=>[id,I()]));
 const set=(id,m)=>{if(Object.hasOwn(matrices,id))matrices[id]=m;};
 const each=(fn)=>{for(const id of Object.keys(parts))fn(id,parts[id]);};
 let pivot=null;
 if(region==='skull'){
  const jaw=parts.mandible;
  if(!jaw)throw Error('Verified mandible mesh required');
  const high=proximal(jaw,true),temporal=[parts['left-temporal-bone'],parts['right-temporal-bone']].filter(Boolean);
  const base=temporal.length?mean(temporal.map(averagePart)):high;
  pivot=[high[0],(high[1]+base[1])/2,high[2]];
  set('mandible',spec.id==='jaw-glide'?shift([0,-.015*u,.055*u]):rot('x',pivot,-t));
 } else if(region==='neck'){
  // Articulate C7 -> C3 -> C2 -> C1 as a cumulative chain. The source
  // meshes do not contain discs, so pivots are estimated between adjacent
  // source-body centroids and contact gaps must not be interpreted clinically.
  pivot=averagePart(parts['seventh-cervical-vertebra']);
  const chain=['seventh-cervical-vertebra','sixth-cervical-vertebra',
   'fifth-cervical-vertebra','fourth-cervical-vertebra',
   'third-cervical-vertebra','axis','atlas'];
  const factors=spec.id==='neck-rotate'?[0,.03,.04,.05,.06,.09,.73]:
   [0,.13,.17,.18,.19,.18,.15];
  let cumulative=I();
  for(let i=1;i<chain.length;i++){
   const id=chain[i],lower=chain[i-1];
   if(!parts[id]||!parts[lower])throw Error('Incomplete source cervical chain');
   const c=averagePart(parts[id]),d=averagePart(parts[lower]);
   const joint=mean([c,d]);
   cumulative=multiply(cumulative,rot(spec.id==='neck-rotate'?'y':'x',joint,t*factors[i]));
   set(id,cumulative);
  }
  set('hyoid-bone',matrices['fourth-cervical-vertebra']);
 } else if(region==='thorax'){
  pivot=averagePart(parts['body-of-sternum']);
  each((id,p)=>{
   if(/rib$/.test(id)){
    const m=/-(\w+)-rib$/.exec(id);
    const index=m?['first','second','third','fourth','fifth','sixth','seventh','eighth','ninth','tenth','eleventh','twelfth'].indexOf(m[1]):5;
    const taper=Math.max(.18,1-Math.abs(index-5)/8);
    const c=averagePart(p),sgn=id.startsWith('left-')?-1:1;
    const hinge=[c[0]*.14,c[1],c[2]-.08];
    const a=(spec.id==='rib-tilt'?t:8*u)*taper;
    set(id,rot(spec.id==='rib-tilt'?'x':'z',hinge,spec.id==='rib-tilt'?a:a*sgn));
   } else if(['manubrium','body-of-sternum','xiphoid-process'].includes(id)){
    set(id,shift([0,.022*u,.055*u]));
   }
  });
  // The diaphragm is a real pinned muscle surface, not manufactured mesh.
  // This small downward excursion is an explicit educational approximation.
  matrices.diaphragm=spec.id==='breath-in'?shift([0,-.11*u,0]):I();
 } else if(region==='elbow'){
  pivot=mean([proximal(parts['right-radius']),proximal(parts['right-ulna'])]);
  if(spec.id==='elbow-flex'){
   for(const id of ['right-radius','right-ulna'])set(id,rot('x',pivot,t));
  }else set('right-radius',rot('y',averagePart(parts['right-ulna']),-t));
 } else if(region==='wrist'){
  pivot=mean([proximal(parts['right-radius'],false),proximal(parts['right-ulna'],false)]);
  each((id,p)=>{
   if(id==='right-radius'||id==='right-ulna')return;
   const isMetacarpal=/metacarpal-bone$/.test(id),weight=isMetacarpal?1:.68;
   set(id,rot(spec.id==='wrist-deviate'?'z':'x',pivot,(spec.id==='wrist-flex'?-1:1)*t*weight));
  });
 } else if(region==='ankle'){
  pivot=mean([proximal(parts['right-tibia'],false),proximal(parts['right-fibula'],false),proximal(parts['right-talus'])]);
  each((id,p)=>{
   if(id==='right-tibia'||id==='right-fibula')return;
   const weight=id==='right-talus'?.45:id==='right-calcaneus'?.75:1;
   set(id,rot(spec.id==='subtalar-invert'?'z':'x',pivot,(spec.id==='ankle-dorsi'?-1:1)*t*weight));
  });
 } else if(region==='hip'||region==='knee'||region==='shoulder'){
  if(region==='hip'){
   pivot=proximal(parts.femur);
   set('femur',rot(spec.id==='hip-abduct'?'z':'y',pivot,(spec.id==='hip-abduct'?-1:1)*t));
  }else if(region==='knee'){
   pivot=proximal(parts.tibia);
   for(const id of ['tibia','fibula','patella'])set(id,rot('y',pivot,t*(id==='patella'?.35:1)));
  }else {
   pivot=proximal(parts.humerus);
   set('humerus',rot(spec.id==='shoulder-flex'?'x':'y',pivot,spec.id==='shoulder-flex'?-t:t));
  }
 }
 return {region,degrees:t,mode:spec.id,pivot,matrices,validated:false,
   method:'source-geometry-bounded-teaching-transform',disclaimer:spec.note};
}
const deformPoint=(p,a,b,w)=>{const t=clamp(w,0,1),x=transform(a,p),y=transform(b,p);
 return x.map((v,i)=>v*(1-t)+y[i]*t);};
window.BodyRegionalMotion=Object.freeze({config,selected,pose,identity:I,transform,deformPoint,multiply,rotate:rot,translation:shift});
})();