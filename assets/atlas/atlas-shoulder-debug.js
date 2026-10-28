/* BODY / LIVE V6.8 · Inspectable inferred kinematic anchors.
 * DOM SVG overlay projects source-frame coordinates over the ONE atlas canvas.
 * It never captures pointer input or implies clinically approved landmarks.
 */
(function(){'use strict';
 const NS='http://www.w3.org/2000/svg';
 const $=id=>document.getElementById(id);
 let shown=false;
 function el(tag,attrs,text){
  const node=document.createElementNS(NS,tag);
  for(const [key,value]of Object.entries(attrs||{}))node.setAttribute(key,String(value));
  if(text!==undefined)node.textContent=text;
  return node;
 }
 function toggle(){
  shown=!shown;
  $('shoulder-rig-toggle').setAttribute('aria-pressed',String(shown));
  $('shoulder-rig-toggle').textContent=shown?'Hide rig points':'Show rig points';
  return shown;
 }
 function draw(camera,diag){
  const tools=$('shoulder-rig-tools'),svg=$('shoulder-rig-overlay');
  const active=!!diag;
  tools.hidden=!active;
  $('shoulder-rig-readout').textContent=active&&shown?
   'CL '+diag.degrees.clavicleElevation.toFixed(0)+'° · SCAP '+diag.degrees.scapulaUpward.toFixed(0)+'° · GH '+diag.degrees.relativeGlenohumeral.toFixed(0)+'°':
   'Estimated pivots · unvalidated';
  // SVGElement.hidden is not reliably reflected as an HTML hidden attribute.
  svg.toggleAttribute('hidden',!active||!shown);
  if(!active||!shown){svg.replaceChildren();return;}
  const canvas=$('atlas-canvas');
  const width=canvas.clientWidth,height=canvas.clientHeight;
  if(!(width>0&&height>0))return;
  svg.setAttribute('viewBox',`0 0 ${width} ${height}`);
  const project=p=>window.BodySpatialCore.project(
   {x:p[0],y:p[1],z:p[2]},
   {...camera,width,height}
  );
  const fragment=document.createDocumentFragment();
  const line=(a,b,stroke,dash)=>fragment.appendChild(el('line',{
   x1:a.x,y1:a.y,x2:b.x,y2:b.y,stroke,'stroke-width':1.6,
   'stroke-dasharray':dash||'none','stroke-linecap':'round',opacity:.85
  }));
  for(const [id,color]of [
   ['supraspinatus','#e9ae7c'],['infraspinatus','#d98d77'],
   ['subscapularis','#c5a6e5'],['teresMinor','#d7cea1']
  ]){
   const path=diag.attachments[id];if(!path)continue;
   const a=project(path.origin),b=project(path.insertion);
   line(a,b,color,'5 5');
   fragment.appendChild(el('circle',{cx:a.x,cy:a.y,r:3,stroke:color,fill:'#1e1713','stroke-width':1.6}));
   fragment.appendChild(el('circle',{cx:b.x,cy:b.y,r:3,fill:color}));
  }
  const markers=[
   ['sternoclavicular','SC · approx.','#e6b992'],
   ['acromioclavicular','AC · approx.','#ddc7a4'],
   ['glenohumeral','GH · approx.','#f8e0ba']
  ];
  for(const [id,label,color]of markers){
   const p=project(diag.markers[id]);
   if(!Number.isFinite(p.x)||!Number.isFinite(p.y))continue;
   fragment.appendChild(el('circle',{cx:p.x,cy:p.y,r:7,fill:'#18120c','fill-opacity':.75,stroke:color,'stroke-width':2}));
   fragment.appendChild(el('line',{x1:p.x-11,y1:p.y,x2:p.x+11,y2:p.y,stroke:color,'stroke-width':1.4}));
   fragment.appendChild(el('line',{x1:p.x,y1:p.y-11,x2:p.x,y2:p.y+11,stroke:color,'stroke-width':1.4}));
   const labelX=Math.max(4,Math.min(width-100,p.x+11));
   const labelY=Math.max(14,Math.min(height-12,p.y-9));
   fragment.appendChild(el('text',{x:labelX,y:labelY,fill:color,'font-size':10,
    'font-family':'-apple-system, BlinkMacSystemFont, sans-serif','font-weight':600,
    'paint-order':'stroke',stroke:'#1b1510','stroke-width':3},label));
  }
  svg.replaceChildren(fragment);
 }
 window.BodyShoulderDebug=Object.freeze({toggle,draw,status:()=>({shown})});
})();