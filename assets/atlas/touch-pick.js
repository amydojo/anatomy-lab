/* V14 touch selection policy (issue #41). Pure decision logic, no DOM, no geometry.
 *
 * Exact-triangle picking stays the first priority and is untouched. Only when a real TOUCH misses does the
 * atlas ask the renderer for structures whose PROJECTED geometry lies within a small CSS-pixel radius, then this
 * module decides whether that is enough to act on:
 *   select  - one unambiguous nearby structure
 *   choose  - several plausible structures too close to tell apart: show a chooser, never guess
 *   none    - nothing plausible: behave exactly like an empty-space tap
 * Mouse and pen input never get tolerance (desktop precision is preserved). */
(function(){'use strict';
 const POLICY=Object.freeze({
  radiusMin:12,          // CSS px, never search less than this for a touch
  radiusMax:24,          // CSS px, never search more than this (half of a 48 px touch target)
  radiusDefault:16,      // CSS px, used when the browser reports no usable contact size
  minRealContact:8,      // CSS px: smaller reported pointer width/height is a placeholder, not a fingertip
  smallTarget:44,        // CSS px: a structure gets tolerance only if its on-screen footprint is below this in some axis
  confidentMargin:8,     // CSS px: runner-up must be at least this much farther than the winner...
  confidentRatio:1.75,   // ...and at least this many times as far, otherwise the choice is ambiguous
  ambiguityBand:14,      // CSS px: chooser lists everything within this of the closest (or 0.75x its distance, if larger)
  maxOptions:4,
  version:'1'
 });
 const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
 const touchLike=o=>!!o&&o.pointerType==='touch';
 /* Adaptive search radius. contact = reported pointer contact diameter in CSS px (0/undefined when unknown). */
 function radiusFor(o){
  if(!touchLike(o))return 0;
  const contact=Number(o.contact);
  // Contact sizes of 0-2 CSS px are placeholders (Chromium reports 1-2, WebKit reports 2 for every touch), not a measured
  // fingertip. Believing them shrank the radius to 12 in WebKit CI. A real fingertip is >= ~8 px, so only those adapt.
  const r=Number.isFinite(contact)&&contact>=POLICY.minRealContact?10+contact/2:POLICY.radiusDefault;
  return clamp(Math.round(r),POLICY.radiusMin,POLICY.radiusMax);
 }
 const isSmall=c=>!!c.footprint&&Math.min(c.footprint.w,c.footprint.h)<POLICY.smallTarget;
 /* candidates: renderer touchCandidates() output (screen-space distances, nearest visible first). */
 function decide(candidates,radius){
  const R=Number(radius)||0;
  if(!R||!Array.isArray(candidates))return {kind:'none',reason:'no-tolerance'};
  const visible=candidates.filter(c=>c&&!c.occludedBy&&c.distance<=R).sort((a,b)=>a.distance-b.distance||b.depth-a.depth);
  if(!visible.length)return {kind:'none',reason:'nothing-within-radius'};
  const first=visible[0],second=visible[1];
  const confident=!second||(second.distance-first.distance>=POLICY.confidentMargin&&second.distance>=first.distance*POLICY.confidentRatio);
  if(confident){
   // A large structure the finger merely grazed is not a target: only small footprints receive tolerance.
   if(!isSmall(first))return {kind:'none',reason:'nearest-not-a-small-target',nearest:first.id};
   return {kind:'select',id:first.id,candidate:first,alternatives:visible.slice(1,POLICY.maxOptions)};
  }
  const band=Math.max(POLICY.ambiguityBand,first.distance*.75);
  const options=visible.filter(c=>c.distance<=first.distance+band).slice(0,POLICY.maxOptions);
  // A chooser exists to rescue a small target. If every plausible candidate is a large structure the finger merely
  // grazed (e.g. femur next to tibia), treat the tap as empty space instead of interrupting with a popup.
  if(!options.some(isSmall))return {kind:'none',reason:'ambiguous-but-no-small-target'};
  return {kind:'choose',options,reason:'too-close-to-distinguish'};
 }
 window.BodyTouchPick=Object.freeze({POLICY,radiusFor,decide,isSmall});
})();
