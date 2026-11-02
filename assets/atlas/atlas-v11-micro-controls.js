/* V11 source-derived microanatomy camera controls.
 * No new anatomy; only focuses source verified existing 3D triangles.
 */
(function(){'use strict';
 const atlas=window.__BODY_ATLAS__;
 const panel=document.getElementById('osteology-micro-controls');
 if(!atlas||!panel)return;
 function sync(){
  const s=atlas.getState(),region=s.unified?.region||null,focused=s.renderer?.osteologyFocus||null;
  const on=!!s.osteologyLoaded&&s.view==='detail'&&['skull','hip'].includes(region);
  panel.hidden=!on;
  for(const button of panel.querySelectorAll('[data-bone-focus]')){
   const k=button.dataset.boneFocus;
   button.hidden=!on||(k==='coccyx'?region!=='hip':region!=='skull')||!!focused;
  }
  document.getElementById('bone-focus-return').hidden=!focused;
  panel.dataset.focused=focused||'none';
 }
 panel.querySelectorAll('[data-bone-focus]').forEach(b=>b.addEventListener('click',()=>{
  atlas.focusOsteology(b.dataset.boneFocus);sync();
 }));
 document.getElementById('bone-focus-return').addEventListener('click',()=>{
  atlas.clearOsteologyFocus();sync();
 });
 const status=document.getElementById('scene-status');
 const ob=new MutationObserver(()=>sync());
 ob.observe(document.getElementById('atlas-app'),{attributes:true,attributeFilter:['data-mode']});
 if(status)ob.observe(status,{childList:true,characterData:true,subtree:true});
 window.addEventListener('body:osteology-ready',sync);
 window.addEventListener('popstate',sync);
 window.addEventListener('resize',sync,{passive:true});
 sync();
})();
