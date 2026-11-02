/* BODY / LIVE V14 Connective Studio domain + renderer integration contract.
 * No guessed geometry; renderer state is reported separately from editorial facts.
 */
(function(root) {
 'use strict';
 const TYPES=['bones','muscles','ligaments','tendons','fibrocartilage'];
 const REGIONS=['knee','shoulder','hip','ankle','wrist','spine'];
 const ref={label:'OpenStax Anatomy & Physiology 2e — Synovial Joints (background reference; passages not audited for these entries)',url:'https://openstax.org/books/anatomy-and-physiology-2e/pages/9-4-synovial-joints',verified:false};
 function entry(id,name,tissueType,location,attachments,significance,relationships) {
  return {id,name,region:'knee',tissueType,location,attachments,significance,relationships,
   source:{...ref},geometryStatus:'unavailable',selectable:false,visible:true};
 }
 const LEGACY_BASE=[
  entry('quadriceps-tendon','Quadriceps tendon','tendons','Anterior knee, superior to the patella','Quadriceps femoris muscle group to patella','Transfers quadriceps force to the kneecap as part of knee extension.',['patellar-ligament']),
  entry('patellar-ligament','Patellar ligament','ligaments','Anterior knee, inferior to the patella','Apex of patella to tibial tuberosity','Transmits the extensor mechanism force toward the tibia. Often called the patellar tendon.',['quadriceps-tendon']),
  entry('mcl','Medial collateral ligament · MCL','ligaments','Medial (inner) aspect of knee','Medial femoral epicondylar region to medial tibia','Helps resist excessive valgus stress at the knee.',['acl','pcl','medial-meniscus']),
  entry('lcl','Lateral collateral ligament · LCL','ligaments','Lateral (outer) aspect of knee','Lateral femoral epicondylar region to fibular head','Helps resist excessive varus stress.',['acl','pcl','lateral-meniscus']),
  entry('acl','Anterior cruciate ligament · ACL','ligaments','Within knee joint, crossing the posterior cruciate ligament','Anterior intercondylar tibial region to medial aspect of lateral femoral condyle','Restrains anterior displacement of tibia relative to femur and contributes to rotational stability.',['pcl','mcl','lcl']),
  entry('pcl','Posterior cruciate ligament · PCL','ligaments','Within knee joint, posterior to the ACL','Posterior intercondylar tibial region to lateral aspect of medial femoral condyle','Restrains posterior displacement of tibia relative to femur.',['acl','mcl','lcl']),
  entry('medial-meniscus','Medial meniscus','fibrocartilage','Between medial femoral condyle and medial tibial plateau','Peripheral attachments to joint capsule and tibial anchoring regions','Distributes load, increases contact congruence and contributes to shock absorption.',['lateral-meniscus','mcl']),
  entry('lateral-meniscus','Lateral meniscus','fibrocartilage','Between lateral femoral condyle and lateral tibial plateau','Meniscal roots on tibia and peripheral capsular relationships','Distributes contact load and accommodates movement between femur and tibia.',['medial-meniscus','lcl'])
 ];
 const LEGACY_GUIDES=[
  {id:'stability',title:'Stability',subtitle:'What keeps the knee from shifting?',description:'The cruciate ligaments control front–back translation; collateral ligaments resist side-to-side stress. These are complementary constraints, not independent hinges.',ids:['acl','pcl','mcl','lcl'],camera:{yaw:.45,pitch:-.08}},
  {id:'movement',title:'Movement',subtitle:'How does the knee straighten?',description:'The quadriceps tendon and patellar ligament form a force-transmission path across the patella. It is an extensor mechanism, not a powered model of contraction.',ids:['quadriceps-tendon','patellar-ligament'],camera:{yaw:.12,pitch:-.10}},
  {id:'cushioning',title:'Joint cushioning',subtitle:'Why do menisci matter?',description:'The two fibrocartilage menisci help distribute forces across the femur–tibia joint. No deformation or pressure simulation is implied.',ids:['medial-meniscus','lateral-meniscus'],camera:{yaw:.46,pitch:-.42}}
 ];
 const BASE=[];
const GUIDES=[
 {id:'stability',title:'Stability',camera:{yaw:.45,pitch:-.08}},
 {id:'movement',title:'Movement',camera:{yaw:.12,pitch:-.10}},
 {id:'load-distribution',title:'Load distribution',camera:{yaw:.46,pitch:-.42}}
];
const clone=x=>JSON.parse(JSON.stringify(x));
 function normalize(record,allowed) {
  if(!record||typeof record.id!=='string'||!record.id||!REGIONS.includes(record.region)||!TYPES.includes(record.tissueType))return null;
  const geometryStatus=['unavailable','illustrative','source-derived','verified'].includes(record.geometryStatus)?record.geometryStatus:'unavailable';
  const selectable=!!record.selectable&&geometryStatus!=='unavailable';
  return {...record,id:record.id,name:String(record.name||record.id),geometryStatus,selectable,visible:allowed[record.tissueType]!==false&&(record.visible!==false),
   relationships:Array.isArray(record.relationships)?record.relationships.filter(x=>typeof x==='string'):[],source:record.source||null};
 }
 function create(options) {
  const opts=options||{};
  const listeners=new Set();
  const visibility=Object.fromEntries(TYPES.map(t=>[t,true]));
  let provider=opts.provider||null;
  let region='knee',selectedId=null,mode='all',isolateId=null,comparison=[],guideId=null,ghost=true,query='';
  const emit=()=>listeners.forEach(fn=>fn(snapshot()));
  function all() {
   let additions=[];
   try { additions=provider&&typeof provider.listStructures==='function'?provider.listStructures():[]; }catch(error){additions=[];}
   const merged=new Map(BASE.map(x=>[x.id,clone(x)]));
   // Provider is authoritative for geometry; editorial facts remain in place unless explicitly supplied.
   for(const x of Array.isArray(additions)?additions:[]) {
    const prior=merged.get(x.id)||{};
    if(!x||typeof x.id!=='string')continue;
    const item=normalize({...prior,...x},visibility);
    if(item)merged.set(item.id,item);
   }
   return [...merged.values()].map(x=>normalize(x,visibility)).filter(Boolean);
  }
  function get(id){return all().find(x=>x.id===id)||null;}
  function snapshot(){return {region,selectedId,mode,isolateId,comparison:[...comparison],guideId,ghost,query,visibility:{...visibility},records:all()};}
  function subscribe(fn){listeners.add(fn);return ()=>listeners.delete(fn);}
  function setProvider(next){provider=next||null;emit();}
  function setRegion(id){if(!REGIONS.includes(id))return false;region=id;selectedId=null;isolateId=null;comparison=[];guideId=null;mode='all';emit();return true;}
  function setTissueVisibility(type,visible){if(!TYPES.includes(type))return false;visibility[type]=!!visible;
   provider?.setTissueVisibility?.(type,!!visible);emit();return true;}
  function setQuery(value){query=String(value||'').slice(0,150);emit();}
  function filtered(){const q=query.toLocaleLowerCase().trim();return all().filter(x=>x.region===region&&(!q||[x.name,x.tissueType,x.location,x.id].join(' ').toLocaleLowerCase().includes(q)));}
  function selectStructure(id){const item=get(id);if(!item||item.region!==region)return false;
   selectedId=id;
   if(item.selectable)provider?.selectStructure?.(id);
   emit();return item;}
  function focusStructure(id){const item=get(id);if(!item||!item.selectable)return false;
   return !!provider?.focusStructure?.(id);
  }
  function isolateStructure(id){const item=get(id);if(!item||!item.selectable)return false;
   selectedId=id;isolateId=id;mode='isolate';comparison=[];provider?.isolateStructure?.(id);emit();return true;}
  function revealContext(){mode='context';isolateId=null;comparison=[];ghost=true;provider?.setContext?.(true);emit();}
  function compareStructures(ids){const valid=[...new Set(ids)].map(get).filter(x=>x&&x.region===region&&x.selectable).map(x=>x.id);
   if(valid.length<2)return false;comparison=valid;isolateId=null;mode='compare';provider?.compareStructures?.(valid);emit();return true;}
  function showAll(){mode='all';isolateId=null;comparison=[];provider?.showAll?.();emit();}
  function setGhost(value){ghost=!!value;provider?.setContext?.(ghost);emit();}
  function chooseGuide(id){const guide=GUIDES.find(x=>x.id===id);if(!guide)return false;
   region='knee';guideId=id;selectedId=null;isolateId=null;comparison=[];mode='all';
   provider?.showAll?.();provider?.setCameraOrientation?.(guide.camera);
   emit();return guide;}
  function resetView(){mode='all';selectedId=null;isolateId=null;comparison=[];guideId=null;ghost=true;query='';for(const type of TYPES)visibility[type]=true;
   provider?.resetView?.();emit();}
  return Object.freeze({subscribe,snapshot,listStructures:all,getStructure:get,filtered,setProvider,setRegion,setTissueVisibility,setQuery,selectStructure,focusStructure,isolateStructure,revealContext,compareStructures,showAll,setGhost,chooseGuide,resetView,types:TYPES,regions:REGIONS,guides:GUIDES});
 }
 root.BodyConnectiveStudio=Object.freeze({create,types:TYPES,regions:REGIONS,guides:GUIDES,seedRecords:BASE});
})(typeof window!=='undefined'?window:globalThis);
