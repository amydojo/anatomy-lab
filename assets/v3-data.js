/* BODY / LIVE V3: curated anatomy content and hands-on lessons.
 * Educational approximations, not diagnostic evidence. */
window.BODYLIVE_DATA = Object.freeze({
 sources: [
  {name:"OpenStax — Anatomy of Selected Synovial Joints",url:"https://openstax.org/books/anatomy-and-physiology-2e/pages/9-6-anatomy-of-selected-synovial-joints"},
  {name:"OpenStax — Muscles of Upper Limb",url:"https://openstax.org/books/anatomy-and-physiology-2e/pages/11-5-muscles-of-the-pectoral-girdle-and-upper-limbs"},
  {name:"OpenStax — Muscles of Lower Limb",url:"https://openstax.org/books/anatomy-and-physiology-2e/pages/11-6-appendicular-muscles-of-the-pelvic-girdle-and-lower-limbs"},
  {name:"OpenStax — Peripheral Nervous System",url:"https://openstax.org/books/anatomy-and-physiology-2e/pages/13-4-the-peripheral-nervous-system"},
  {name:"OpenStax — Types of Body Movements",url:"https://openstax.org/books/anatomy-and-physiology-2e/pages/9-5-types-of-body-movements"}
 ],
 regions:{
  knee:{
   name:"Knee",number:"02",caption:"The constrained hinge",axis:"Flexion · illustrative sagittal view",max:125,
   intro:"A joint that rolls, glides, and finds stability through soft-tissue restraints. Discover the machinery behind every step.",
   layers:["Surface","Muscles","Ligaments","Menisci","Nerves"],
   motion:"Flexion / extension",motionNote:"This sagittal-inspired demonstration does not model true six-degree-of-freedom joint kinematics.",
   structures:[
    {key:"femur",name:"Femur",system:"bone",syn:"thighbone",fact:"The rounded femoral condyles contact the tibia and roll and slide as the knee bends.",related:["meniscus","acl"]},
    {key:"patella",name:"Patella",system:"bone",syn:"kneecap",fact:"This sesamoid bone improves the quadriceps' leverage and moves with knee flexion.",related:["quads"]},
    {key:"quads",name:"Quadriceps",system:"muscle",syn:"front thigh muscle",fact:"The quadriceps straighten the knee via the quadriceps tendon, patella, and patellar ligament.",related:["patella"]},
    {key:"hamstrings",name:"Hamstrings",system:"muscle",syn:"back thigh",fact:"These muscles flex the knee and help control movement.",related:["quads"]},
    {key:"acl",name:"Anterior cruciate ligament",system:"ligament",syn:"ACL",fact:"The ACL helps resist excessive forward movement of the tibia relative to the femur and contributes to rotational stability.",related:["pcl","meniscus"]},
    {key:"pcl",name:"Posterior cruciate ligament",system:"ligament",syn:"PCL",fact:"The PCL helps resist excessive backward movement of the tibia relative to the femur.",related:["acl"]},
    {key:"meniscus",name:"Menisci",system:"cartilage",syn:"meniscus cartilage shock absorber",fact:"The two fibrocartilage menisci help distribute loads and increase congruence between the joint surfaces.",related:["femur","acl"]},
    {key:"fibularNerve",name:"Common fibular nerve",system:"nerve",syn:"common peroneal outer knee foot",fact:"A sciatic nerve branch winds near the fibular neck and divides into superficial and deep fibular nerves.",related:[],nerve:true}
   ],
   traces:[{name:"Common fibular nerve",key:"fibularNerve",path:"Sciatic nerve → common fibular nerve near lateral knee → superficial and deep fibular branches",territory:"The superficial fibular nerve supplies much of the dorsum of the foot; the deep fibular nerve supplies the first dorsal web space. Individual territories overlap.",note:"The sural nerve, formed from contributing branches, supplies much of the outer foot."}],
   feel:"Sitting comfortably, place a hand over your upper thigh and gently tighten your quadriceps without forcing your knee. The muscle under your hand may become firmer. Stop if symptoms increase."
  },
  shoulder:{
   name:"Shoulder",number:"03",caption:"A suspended socket",axis:"Arm elevation · illustrative posterior-oblique view",max:150,
   intro:"A mobile ball-and-socket joint made stable by coordinated muscles, tendons, and moving shoulder blades.",
   layers:["Surface","Deltoid","Rotator cuff","Joint","Nerves"],
   motion:"Elevation",motionNote:"Scapular rotation is an educational approximation; actual coordination varies. Axial rotation is not animated in this view.",
   structures:[
    {key:"humerus",name:"Humerus",system:"bone",syn:"upper arm bone",fact:"Its rounded head moves against the shallow glenoid cavity of the scapula.",related:["scapula","labrum"]},
    {key:"scapula",name:"Scapula",system:"bone",syn:"shoulder blade",fact:"The scapula rotates and tilts on the thorax as the arm moves overhead.",related:["humerus"]},
    {key:"deltoid",name:"Deltoid",system:"muscle",syn:"shoulder cap",fact:"A large shoulder muscle that helps elevate, flex, and extend the arm, depending on fiber orientation.",related:["supraspinatus"]},
    {key:"supraspinatus",name:"Supraspinatus",system:"muscle",syn:"rotator cuff top",fact:"A cuff muscle that contributes to abduction and stabilization of the humeral head.",related:["infraspinatus","deltoid"]},
    {key:"infraspinatus",name:"Infraspinatus",system:"muscle",syn:"rotator cuff back",fact:"Primarily externally rotates the humerus and helps stabilize the shoulder joint.",related:["teresMinor"]},
    {key:"teresMinor",name:"Teres minor",system:"muscle",syn:"rotator cuff external rotation",fact:"Works with other posterior cuff muscles to externally rotate and stabilize the humerus.",related:["infraspinatus"]},
    {key:"subscapularis",name:"Subscapularis",system:"muscle",syn:"rotator cuff front",fact:"The anterior rotator cuff muscle; internally rotates the humerus and contributes to stability.",related:["supraspinatus"]},
    {key:"labrum",name:"Glenoid labrum",system:"cartilage",syn:"shoulder labrum socket",fact:"A fibrocartilage rim that deepens the glenoid socket and contributes to joint stability.",related:["humerus"]},
    {key:"axillaryNerve",name:"Axillary nerve",system:"nerve",syn:"nerve deltoid shoulder",fact:"A branch of the brachial plexus that travels near the surgical neck of the humerus and supplies deltoid and teres minor.",related:["deltoid"],nerve:true}
   ],
   traces:[{name:"Axillary nerve",key:"axillaryNerve",path:"Brachial plexus → posterior cord → axillary nerve → quadrangular space → deltoid and teres minor",territory:"Sensory supply includes the skin over part of the lateral shoulder; areas vary between people.",note:"This is a regional pathway, not a measure of nerve compression."}],
   feel:"Rest your hand over the outside of your shoulder. Gently raise your arm only within a comfortable range; you may feel the deltoid firm. Skip if it provokes discomfort."
  },
  hip:{
   name:"Hip",number:"01",caption:"The body's main motors",axis:"Abduction · posterior schematic view",max:35,
   intro:"Peel through the gluteal layers, expose deep hip rotators, and discover the sciatic nerve's remarkable pathway.",
   layers:["Gluteus maximus","Side stabilizers","Deep rotators","Sciatic nerve"],
   motion:"Hip abduction",motionNote:"Only posterior-view abduction is animated in this original model. Flexion, extension, and rotation are described but not simulated.",
   structures:[
    {key:"max",name:"Gluteus maximus",system:"muscle",syn:"buttock glute",layer:0,fact:"A powerful hip extensor; contributes to rising, climbing, and accelerating.",related:["med","pir"]},
    {key:"med",name:"Gluteus medius",system:"muscle",syn:"side glutes",layer:1,fact:"Abducts the hip and contributes to controlling pelvis position during single-leg stance.",related:["min"]},
    {key:"min",name:"Gluteus minimus",system:"muscle",syn:"deep side glute",layer:1,fact:"Assists hip abduction, internal rotation, and pelvic stabilization.",related:["med"]},
    {key:"pir",name:"Piriformis",system:"muscle",syn:"deep buttock rotator",layer:2,fact:"A deep hip rotator and stabilizer; the sciatic nerve most often passes inferior to it.",related:["nerve"]},
    {key:"nerve",name:"Sciatic nerve",system:"nerve",syn:"sciatica buttock leg",layer:3,fact:"Nerve fibers from L4–S3 join into a large nerve traveling beneath most of the deep gluteal region into the posterior thigh.",related:["pir"],nerve:true}
   ],
   traces:[{name:"Sciatic nerve",key:"nerve",path:"Lumbosacral plexus (L4–S3) → greater sciatic foramen → below piriformis (usually) → posterior thigh → tibial and common fibular divisions",territory:"The sciatic nerve's branches serve much of the lower leg and foot. Root and peripheral nerve territories overlap; numbness location alone cannot diagnose its source.",note:"Anatomical variants of sciatic-nerve passage around piriformis exist."}],
   feel:"Place your palm over the fleshy gluteal area and gently contract both glutes while seated. Feeling a surface muscle tense does not reveal whether a deep nerve is irritated."
  }
 },
 lessons:{
  knee:[
   {id:"k-patella",title:"The traveling kneecap",prompt:"Why does the patella change position when the knee bends?",options:["It is fixed to the femur","It follows the quadriceps–patellar mechanism","It floats freely in fluid"],correct:1,task:"Move",target:{type:"angle",min:55},instruction:"Bend the virtual knee beyond 55°. Watch the patellar region.",answer:"The patella articulates with the femur and tracks as the extensor mechanism moves. The illustration exaggerates motion for clarity.",key:"patella"},
   {id:"k-menisci",title:"The load distributors",prompt:"What do the menisci contribute to the knee?",options:["Load distribution and joint congruence","Nerve signaling","Active muscle contraction"],correct:0,task:"Inspect",target:{type:"select",key:"meniscus"},instruction:"Find and select the menisci in Explore mode.",answer:"Menisci are fibrocartilage wedges that share load and improve the fit of the contact surfaces.",key:"meniscus"},
   {id:"k-quads",title:"The extension cable",prompt:"Which structure supplies the primary active force for straightening the knee?",options:["ACL","Quadriceps","Meniscus"],correct:1,task:"Inspect",target:{type:"select",key:"quads"},instruction:"Select the quadriceps in the anatomy search.",answer:"Quadriceps force travels through the quadriceps tendon, patella, and patellar ligament to extend the knee.",key:"quads"},
   {id:"k-ligaments",title:"Crossing stabilizers",prompt:"Where are the ACL and PCL located?",options:["Within the knee joint region","Inside the calf muscle","On top of the skin"],correct:0,task:"Peel",target:{type:"depth",min:2},instruction:"Peel the virtual knee to the ligament depth.",answer:"These cruciate ligaments cross inside the central knee and help constrain tibial translations and rotation.",key:"acl"}
  ],
  shoulder:[
   {id:"s-mobility",title:"A joint that needs teamwork",prompt:"What allows the hand to reach overhead?",options:["Only the humerus moves","Coordinated movement of the arm and scapula","The clavicle is fixed in place"],correct:1,task:"Move",target:{type:"angle",min:100},instruction:"Raise the virtual arm beyond 100°. Watch the scapula.",answer:"Arm elevation combines glenohumeral motion, scapular movement, and clavicular motion.",key:"scapula"},
   {id:"s-cuff",title:"The stabilizing cuff",prompt:"What is a central role of the rotator cuff?",options:["Hold bones completely still","Help center and control the humeral head","Produce knee extension"],correct:1,task:"Inspect",target:{type:"select",key:"supraspinatus"},instruction:"Find and highlight supraspinatus.",answer:"Cuff muscles work together to actively stabilize the shoulder during movement.",key:"supraspinatus"},
   {id:"s-scapula",title:"The moving platform",prompt:"Does the scapula remain stationary as the arm rises?",options:["Yes","No, it rotates and moves on the thorax"],correct:1,task:"Move",target:{type:"angle",min:70},instruction:"Scrub the arm past 70° and watch the shoulder blade.",answer:"The scapula contributes substantially to overhead elevation, with variable timing between people.",key:"scapula"},
   {id:"s-rotation",title:"Two directions, two teams",prompt:"Which rotator cuff muscle is an internal rotator?",options:["Infraspinatus","Subscapularis","Teres minor"],correct:1,task:"Inspect",target:{type:"select",key:"subscapularis"},instruction:"Select subscapularis and inspect its location. Axial rotation is not modeled in this view.",answer:"Subscapularis is an anterior cuff muscle with a prominent internal rotation function.",key:"subscapularis"}
  ],
  hip:[
   {id:"h-motor",title:"The powerful motor",prompt:"Which gluteal muscle is a major hip extensor?",options:["Gluteus maximus","Piriformis","Gluteus minimus"],correct:0,task:"Inspect",target:{type:"select",key:"max"},instruction:"Select gluteus maximus, the most superficial muscle in this view.",answer:"Gluteus maximus contributes strongly to hip extension. This particular illustration animates abduction, not extension.",key:"max"},
   {id:"h-balance",title:"The pelvis stabilizer",prompt:"Which gluteal muscle helps keep the pelvis level when walking?",options:["Gluteus medius","Biceps brachii","Trapezius"],correct:0,task:"Peel",target:{type:"depth",min:1},instruction:"Peel to the side-stabilizer layer.",answer:"Gluteus medius and minimus assist with maintaining pelvic position during single-leg support.",key:"med"},
   {id:"h-hidden",title:"The deep rotators",prompt:"Where is the piriformis relative to gluteus maximus?",options:["Superficial to it","Deep beneath it","Inside the spinal canal"],correct:1,task:"Peel",target:{type:"depth",min:2},instruction:"Remove superficial muscle layers to expose the deep rotators.",answer:"Piriformis lies beneath gluteus maximus and near the sciatic nerve.",key:"pir"},
   {id:"h-nerve",title:"Follow the signal",prompt:"Where does the sciatic nerve usually pass relative to piriformis?",options:["Under it","Across the kneecap","Inside the femoral shaft"],correct:0,task:"Trace",target:{type:"trace",key:"nerve"},instruction:"Switch to Trace and highlight the sciatic nerve.",answer:"The sciatic nerve usually courses inferior to piriformis. Variations exist; maps are educational, not diagnostic.",key:"nerve"}
  ]
 }
});
