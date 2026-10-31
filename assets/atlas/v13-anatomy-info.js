/* Textbook-level facts inspected against specific OpenStax passages.
 * Text verification is separate from geometry, attachment, and biomechanics validation. */
(function(){'use strict';
const records={
 "patella": {
  "type": "Sesamoid bone",
  "summary": "The kneecap lies within the quadriceps femoris tendon and articulates with the distal femur.",
  "relations": "Quadriceps femoris tendon \u00b7 femur",
  "source": "OpenStax A&P 2e, 8.4 \u2014 Patella; Figure 8.16",
  "sourceUrl": "https://openstax.org/books/anatomy-and-physiology-2e/pages/8-4-bones-of-the-lower-limb",
  "reviewed": "2026-10-30",
  "evidence": {
   "type": [
    {
     "url": "https://openstax.org/books/anatomy-and-physiology-2e/pages/8-4-bones-of-the-lower-limb",
     "passage": "Patella; Figure 8.16"
    }
   ],
   "summary": [
    {
     "url": "https://openstax.org/books/anatomy-and-physiology-2e/pages/8-4-bones-of-the-lower-limb",
     "passage": "Patella; Figure 8.16"
    }
   ],
   "relations": [
    {
     "url": "https://openstax.org/books/anatomy-and-physiology-2e/pages/8-4-bones-of-the-lower-limb",
     "passage": "Patella; Figure 8.16"
    }
   ]
  }
 },
 "femur": {
  "type": "Bone",
  "summary": "The thigh bone articulates with the hip bone above and the tibia at the knee below.",
  "relations": "Hip bone \u00b7 tibia",
  "source": "OpenStax A&P 2e, 8.4 \u2014 Femur; Figure 8.16",
  "sourceUrl": "https://openstax.org/books/anatomy-and-physiology-2e/pages/8-4-bones-of-the-lower-limb",
  "reviewed": "2026-10-30",
  "evidence": {
   "type": [
    {
     "url": "https://openstax.org/books/anatomy-and-physiology-2e/pages/8-4-bones-of-the-lower-limb",
     "passage": "Femur; Figure 8.16"
    }
   ],
   "summary": [
    {
     "url": "https://openstax.org/books/anatomy-and-physiology-2e/pages/8-4-bones-of-the-lower-limb",
     "passage": "Femur; Figure 8.16"
    }
   ],
   "relations": [
    {
     "url": "https://openstax.org/books/anatomy-and-physiology-2e/pages/8-4-bones-of-the-lower-limb",
     "passage": "Femur; Figure 8.16"
    }
   ]
  }
 },
 "tibia": {
  "type": "Bone",
  "summary": "The tibia is the larger, weight-bearing bone on the medial side of the leg.",
  "relations": "Femur \u00b7 fibula",
  "source": "OpenStax A&P 2e, 8.4 \u2014 Tibia; Figure 8.18",
  "sourceUrl": "https://openstax.org/books/anatomy-and-physiology-2e/pages/8-4-bones-of-the-lower-limb",
  "reviewed": "2026-10-30",
  "evidence": {
   "type": [
    {
     "url": "https://openstax.org/books/anatomy-and-physiology-2e/pages/8-4-bones-of-the-lower-limb",
     "passage": "Tibia; Figure 8.18"
    }
   ],
   "summary": [
    {
     "url": "https://openstax.org/books/anatomy-and-physiology-2e/pages/8-4-bones-of-the-lower-limb",
     "passage": "Tibia; Figure 8.18"
    }
   ],
   "relations": [
    {
     "url": "https://openstax.org/books/anatomy-and-physiology-2e/pages/8-4-bones-of-the-lower-limb",
     "passage": "Tibia; Figure 8.18"
    }
   ]
  }
 },
 "scapula": {
  "type": "Bone",
  "summary": "The shoulder blade has a glenoid cavity that articulates with the head of the humerus.",
  "relations": "Humerus",
  "source": "OpenStax A&P 2e, 8.2 \u2014 Humerus; Figure 8.5",
  "sourceUrl": "https://openstax.org/books/anatomy-and-physiology-2e/pages/8-2-bones-of-the-upper-limb",
  "reviewed": "2026-10-30",
  "evidence": {
   "type": [
    {
     "url": "https://openstax.org/books/anatomy-and-physiology-2e/pages/8-2-bones-of-the-upper-limb",
     "passage": "Humerus; Figure 8.5"
    }
   ],
   "summary": [
    {
     "url": "https://openstax.org/books/anatomy-and-physiology-2e/pages/8-2-bones-of-the-upper-limb",
     "passage": "Humerus; Figure 8.5"
    },
    {
     "url": "https://openstax.org/books/anatomy-and-physiology-2e/pages/8-1-the-pectoral-girdle",
     "passage": "Scapula; introductory pectoral girdle paragraph"
    }
   ],
   "relations": [
    {
     "url": "https://openstax.org/books/anatomy-and-physiology-2e/pages/8-2-bones-of-the-upper-limb",
     "passage": "Humerus; Figure 8.5"
    }
   ]
  }
 },
 "humerus": {
  "type": "Bone",
  "summary": "The upper arm contains the humerus; its head articulates with the glenoid cavity of the scapula.",
  "relations": "Scapula",
  "source": "OpenStax A&P 2e, 8.2 \u2014 Humerus; Figure 8.5",
  "sourceUrl": "https://openstax.org/books/anatomy-and-physiology-2e/pages/8-2-bones-of-the-upper-limb",
  "reviewed": "2026-10-30",
  "evidence": {
   "type": [
    {
     "url": "https://openstax.org/books/anatomy-and-physiology-2e/pages/8-2-bones-of-the-upper-limb",
     "passage": "Humerus; Figure 8.5"
    }
   ],
   "summary": [
    {
     "url": "https://openstax.org/books/anatomy-and-physiology-2e/pages/8-2-bones-of-the-upper-limb",
     "passage": "Humerus; Figure 8.5"
    }
   ],
   "relations": [
    {
     "url": "https://openstax.org/books/anatomy-and-physiology-2e/pages/8-2-bones-of-the-upper-limb",
     "passage": "Humerus; Figure 8.5"
    }
   ]
  }
 },
 "supraspinatus": {
  "type": "Skeletal muscle",
  "summary": "This muscle lies above the scapular spine and contributes to arm abduction. Its tendon is part of the rotator cuff.",
  "relations": "Scapula \u00b7 humerus \u00b7 rotator cuff",
  "source": "OpenStax A&P 2e, 11.5 \u2014 Muscles That Move the Humerus",
  "sourceUrl": "https://openstax.org/books/anatomy-and-physiology-2e/pages/11-5-muscles-of-the-pectoral-girdle-and-upper-limbs",
  "reviewed": "2026-10-30",
  "evidence": {
   "type": [
    {
     "url": "https://openstax.org/books/anatomy-and-physiology-2e/pages/11-5-muscles-of-the-pectoral-girdle-and-upper-limbs",
     "passage": "Muscles That Move the Humerus"
    }
   ],
   "summary": [
    {
     "url": "https://openstax.org/books/anatomy-and-physiology-2e/pages/11-5-muscles-of-the-pectoral-girdle-and-upper-limbs",
     "passage": "Muscles That Move the Humerus"
    }
   ],
   "relations": [
    {
     "url": "https://openstax.org/books/anatomy-and-physiology-2e/pages/11-5-muscles-of-the-pectoral-girdle-and-upper-limbs",
     "passage": "Muscles That Move the Humerus"
    }
   ]
  }
 },
 "gastrocnemius": {
  "type": "Skeletal muscle",
  "summary": "The gastrocnemius is a superficial calf muscle, with the soleus lying deeper.",
  "relations": "Soleus",
  "source": "OpenStax A&P 2e, 11.6 \u2014 Muscles That Move the Feet and Toes; posterior compartment paragraph",
  "sourceUrl": "https://openstax.org/books/anatomy-and-physiology-2e/pages/11-6-appendicular-muscles-of-the-pelvic-girdle-and-lower-limbs",
  "reviewed": "2026-10-30",
  "evidence": {
   "type": [
    {
     "url": "https://openstax.org/books/anatomy-and-physiology-2e/pages/11-6-appendicular-muscles-of-the-pelvic-girdle-and-lower-limbs",
     "passage": "Muscles That Move the Feet and Toes; posterior compartment paragraph"
    }
   ],
   "summary": [
    {
     "url": "https://openstax.org/books/anatomy-and-physiology-2e/pages/11-6-appendicular-muscles-of-the-pelvic-girdle-and-lower-limbs",
     "passage": "Muscles That Move the Feet and Toes; posterior compartment paragraph"
    }
   ],
   "relations": [
    {
     "url": "https://openstax.org/books/anatomy-and-physiology-2e/pages/11-6-appendicular-muscles-of-the-pelvic-girdle-and-lower-limbs",
     "passage": "Muscles That Move the Feet and Toes; posterior compartment paragraph"
    }
   ]
  }
 }
};
Object.values(records).forEach(Object.freeze);Object.freeze(records);
const aliases=Object.freeze({
 "patella": "patella",
 "femur": "femur",
 "tibia": "tibia",
 "scapula": "scapula",
 "humerus": "humerus",
 "supraspinatus": "supraspinatus",
 "gastrocnemius": "gastrocnemius",
 "left-femur": "femur",
 "left-tibia": "tibia",
 "left-scapula": "scapula",
 "left-humerus": "humerus",
 "left-patella": "patella",
 "left-supraspinatus": "supraspinatus",
 "medial-head-of-left-gastrocnemius": "gastrocnemius",
 "lateral-head-of-left-gastrocnemius": "gastrocnemius",
 "right-femur": "femur",
 "right-tibia": "tibia",
 "right-scapula": "scapula",
 "right-humerus": "humerus",
 "right-patella": "patella",
 "right-supraspinatus": "supraspinatus",
 "medial-head-of-right-gastrocnemius": "gastrocnemius",
 "lateral-head-of-right-gastrocnemius": "gastrocnemius"
});
function lookup(id){return records[aliases[String(id||'')]]||null;}
window.BodyAnatomyInfo=Object.freeze({lookup,records,aliases});
})();
