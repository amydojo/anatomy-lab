(function(){
 'use strict';
 const D=window.BODYLIVE_DATA;if(!D)return;
 const $=id=>document.getElementById(id);
 const escape=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const entries=Object.entries(D.regions).flatMap(([region,data])=>data.structures.map(s=>({region,...s})));
 let previousFocus=null;
 const modal=$('home-search'),query=$('home-query'),result=$('home-results');
 function showSearch(){
  previousFocus=document.activeElement;modal.classList.add('open');query.value='';renderResults('');query.focus();
 }
 function closeSearch(){modal.classList.remove('open');previousFocus?.focus?.();}
 function renderResults(q){
  const term=q.trim().toLowerCase();
  const a=entries.filter(s=>!term||[s.name,s.syn,s.system,s.region].join(' ').toLowerCase().includes(term)).slice(0,30);
  result.innerHTML=a.length?a.map(s=>'<a href="/'+escape(s.region)+'/?focus='+encodeURIComponent(s.key)+'"><strong>'+escape(s.name)+'</strong><small>'+escape(D.regions[s.region].name)+' · '+escape(s.system)+'</small></a>').join(''):'<p class="empty">No structure matches that search.</p>';
 }
 $('search-open').addEventListener('click',showSearch);
 $('search-close').addEventListener('click',closeSearch);
 query.addEventListener('input',()=>renderResults(query.value));
 modal.addEventListener('click',e=>{if(e.target===modal)closeSearch()});
 document.addEventListener('keydown',e=>{if(e.key==='Escape'&&modal.classList.contains('open'))closeSearch();if((e.metaKey||e.ctrlKey)&&e.key.toLowerCase()==='k'){e.preventDefault();showSearch()}});
 const fore=$('anterior'),back=$('posterior'),backShapes=$('body-back');
 function orient(isBack){
  fore.setAttribute('aria-pressed',String(!isBack));back.setAttribute('aria-pressed',String(isBack));
  backShapes.style.display=isBack?'':'none';$('bodydesc').textContent='Diagram of a human body seen from '+(isBack?'behind':'the front')+'. Select an available hip, knee, or shoulder hotspot to visit its interactive laboratory.';
 }
 fore.addEventListener('click',()=>orient(false));back.addEventListener('click',()=>orient(true));
 let progress={};try{progress=JSON.parse(localStorage.getItem('bodylive-v4-progress')||localStorage.getItem('bodylive-v3-lessons')||'{}')}catch{}
 const num=Object.values(progress).filter(Boolean).length;
 if(num){
  $('completed-count').textContent=num+' of 12 experiments completed';
  $('completed-note').textContent='Saved in this browser · No account required';
 }
 let last=null;try{last=JSON.parse(localStorage.getItem('bodylive-v3-last')||'null')}catch{}
 if(last&&D.regions[last.region]?.structures.some(s=>s.key===last.key)){
  const btn=document.querySelector('.actions .plain');btn.textContent='Continue exploring →';btn.href='/'+last.region+'/?focus='+encodeURIComponent(last.key);
 }
})();
