/* V6 serializable atlas state, no DOM assumptions. */
(function(){'use strict';
const AVAILABLE=['hip','nerve','knee','shoulder'];
const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
function create(){
 const s={view:'overview',region:null,selection:null,evidence:false,evidenceMode:'clean',camera:{yaw:-.20,pitch:-.07,zoom:1.03,frameSpan:10.8,target:{x:0,y:-.12,z:0}},previous:null,layer:0,mode:'explore',seam:false,frameReady:false,failed:false};
 const snapshot=()=>JSON.parse(JSON.stringify(s));
 function select(region){if(!AVAILABLE.includes(region))return false;s.region=region;s.view='focused';s.selection=null;s.seam=false;s.mode='explore';s.layer=0;return true;}
 function enter(){if(!s.region||!AVAILABLE.includes(s.region))return false;s.view='detail';s.frameReady=false;return true;}
 function body(){s.view='overview';s.previous=s.region;s.region=null;s.selection=null;s.seam=false;s.layer=0;s.mode='explore';s.camera={yaw:-.20,pitch:-.07,zoom:1.03,frameSpan:10.8,target:{x:0,y:-.12,z:0}};}
 function transfer(){if(s.view!=='detail'||!['hip','nerve'].includes(s.region))return false;s.seam=true;return true;}
 function closeSeam(){s.seam=false;}
 function completeTransfer(){if(!s.seam)return false;s.region='knee';s.view='detail';s.seam=false;s.frameReady=false;s.layer=0;s.mode='explore';return true;}
 function mode(which){if(!['explore','peel','trace'].includes(which))return false;s.mode=which;return true;}
 function setDepth(n){s.layer=clamp(Math.round(Number(n)||0),0,4);}
 function setEvidence(mode){if(!['clean','evidence'].includes(mode))return false;s.evidenceMode=mode;return true;}
 return Object.freeze({data:s,snapshot,select,enter,body,transfer,closeSeam,completeTransfer,mode,setDepth,setEvidence});
}
window.BodyAtlasState=Object.freeze({create,regions:AVAILABLE});
})();