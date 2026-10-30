/* V13 educational structure annotations. Explicitly limited to reviewed textbook-level facts.
 * References: OpenStax Anatomy & Physiology 2e, chapters 6, 8 and 11
 * https://openstax.org/details/books/anatomy-and-physiology-2e
 * This is not a clinical or geometry-registration validation.
 */
(function(){'use strict';
const records=Object.freeze({
 patella:{type:'Sesamoid bone',summary:'Protects the anterior knee and increases the quadriceps tendon moment arm.',relations:'Quadriceps tendon · patellar ligament · femur',source:'OpenStax A&P 2e, chapters 8 and 11'},
 femur:{type:'Long bone',summary:'The thigh bone; articulates with the hip socket and tibia.',relations:'Hip · knee · tibia · patella',source:'OpenStax A&P 2e, chapters 8 and 11'},
 tibia:{type:'Long bone',summary:'Primary weight-bearing bone of the lower leg.',relations:'Femur · fibula · talus',source:'OpenStax A&P 2e, chapter 8'},
 scapula:{type:'Flat bone',summary:'Shoulder blade; its glenoid cavity articulates with the humeral head.',relations:'Humerus · clavicle · rotator cuff',source:'OpenStax A&P 2e, chapter 8'},
 humerus:{type:'Long bone',summary:'Upper-arm bone forming the shoulder and elbow joints.',relations:'Scapula · radius · ulna',source:'OpenStax A&P 2e, chapter 8'},
 supraspinatus:{type:'Skeletal muscle',summary:'Helps initiate arm abduction and stabilizes the glenohumeral joint.',relations:'Supraspinous fossa · greater tubercle · suprascapular nerve',source:'OpenStax A&P 2e, chapter 11'},
 gastrocnemius:{type:'Skeletal muscle',summary:'Plantarflexes the ankle and assists knee flexion.',relations:'Femoral condyles · calcaneal tendon · calcaneus',source:'OpenStax A&P 2e, chapter 11'}
});
function lookup(id){const key=String(id||'').toLowerCase().replace(/[^a-z]/g,'');return records[key]||null;}
window.BodyAnatomyInfo=Object.freeze({lookup,records});
})();
