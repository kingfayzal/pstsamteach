-- The subjects and topics Xcel Study offers (generated from prisma/seed-content/catalog.ts).
-- Adds whatever is missing and nothing else:
--   - a subject that already exists (same slug, or same name in any case) keeps its details;
--   - its existing topics keep their places, and the missing ones go after them in catalog order;
--   - a topic that already exists under that subject (same slug or name) is skipped.
-- It runs once per database, so anything an admin changes or removes afterwards stays that way.
DO $$
DECLARE
  catalog jsonb := $json$[
  {
    "slug": "mathematics",
    "name": "Mathematics",
    "tagline": "Number, algebra and problem solving",
    "description": "Work from the foundations up: arithmetic, algebra and the reasoning behind every step.",
    "color": "#2356C2",
    "topics": [
      {
        "name": "Basic Math",
        "slug": "basic-math"
      },
      {
        "name": "Algebra I & II",
        "slug": "algebra-i-ii"
      },
      {
        "name": "Geometry",
        "slug": "geometry"
      },
      {
        "name": "Trigonometry",
        "slug": "trigonometry"
      },
      {
        "name": "Calculus",
        "slug": "calculus"
      },
      {
        "name": "Statistics",
        "slug": "statistics"
      },
      {
        "name": "Advanced Placement (AP) Math",
        "slug": "advanced-placement-ap-math"
      },
      {
        "name": "International Baccalaureate (IB) Math",
        "slug": "international-baccalaureate-ib-math"
      },
      {
        "name": "Other",
        "slug": "other"
      }
    ]
  },
  {
    "slug": "english",
    "name": "English",
    "tagline": "Grammar, writing and reading with purpose",
    "description": "Clear, correct writing, from sentence structure and punctuation to essays that hold an argument.",
    "color": "#B3374A",
    "topics": [
      {
        "name": "Grammar",
        "slug": "grammar"
      },
      {
        "name": "Comprehension",
        "slug": "comprehension"
      },
      {
        "name": "Summary Writing",
        "slug": "summary-writing"
      },
      {
        "name": "Oral English",
        "slug": "oral-english"
      },
      {
        "name": "Vocabulary Development",
        "slug": "vocabulary-development"
      },
      {
        "name": "Stress Patterns",
        "slug": "stress-patterns"
      },
      {
        "name": "Other",
        "slug": "other"
      }
    ]
  },
  {
    "slug": "vocational-development",
    "name": "Vocational Development",
    "tagline": "Practical skills for work and creative life",
    "description": "Hands-on skills you can use straight away: music, photography, graphics, video editing, proposal writing and managing your money.",
    "color": "#9C2F6E",
    "topics": [
      {
        "name": "Music",
        "slug": "music"
      },
      {
        "name": "Photography",
        "slug": "photography"
      },
      {
        "name": "Graphics",
        "slug": "graphics"
      },
      {
        "name": "Video Editing",
        "slug": "video-editing"
      },
      {
        "name": "Proposal Writing",
        "slug": "proposal-writing"
      },
      {
        "name": "Financial Intelligence",
        "slug": "financial-intelligence"
      },
      {
        "name": "Other",
        "slug": "other"
      }
    ]
  },
  {
    "slug": "test-preparation",
    "name": "Test Preparation",
    "tagline": "Get ready for the exam that's next",
    "description": "Focused preparation for international and Nigerian exams, from SAT, GRE and IELTS to WAEC, NECO, UTME and Common Entrance.",
    "color": "#A84F12",
    "topics": [
      {
        "name": "SAT",
        "slug": "sat"
      },
      {
        "name": "ACT",
        "slug": "act"
      },
      {
        "name": "GRE",
        "slug": "gre"
      },
      {
        "name": "GMAT",
        "slug": "gmat"
      },
      {
        "name": "LSAT",
        "slug": "lsat"
      },
      {
        "name": "MCAT",
        "slug": "mcat"
      },
      {
        "name": "TOEFL",
        "slug": "toefl"
      },
      {
        "name": "IELTS",
        "slug": "ielts"
      },
      {
        "name": "BECE (Nigeria)",
        "slug": "bece-nigeria"
      },
      {
        "name": "WAEC (West Africa)",
        "slug": "waec-west-africa"
      },
      {
        "name": "NECO (Nigeria)",
        "slug": "neco-nigeria"
      },
      {
        "name": "Common Entrance (Nigeria)",
        "slug": "common-entrance-nigeria"
      },
      {
        "name": "UTME (Nigeria)",
        "slug": "utme-nigeria"
      },
      {
        "name": "JUPEB (Nigeria)",
        "slug": "jupeb-nigeria"
      },
      {
        "name": "IJMB (Nigeria)",
        "slug": "ijmb-nigeria"
      },
      {
        "name": "Other",
        "slug": "other"
      }
    ]
  }
]$json$;
  subject jsonb;
  topic jsonb;
  subject_id text;
  next_position integer;
BEGIN
  FOR subject IN SELECT value FROM jsonb_array_elements(catalog) WITH ORDINALITY AS item(value, n) ORDER BY n LOOP
    SELECT "id" INTO subject_id FROM "Subject"
      WHERE "slug" = subject->>'slug' OR lower("name") = lower(subject->>'name')
      ORDER BY ("slug" = subject->>'slug') DESC
      LIMIT 1;
    IF subject_id IS NULL THEN
      subject_id := gen_random_uuid()::text;
      INSERT INTO "Subject" ("id", "slug", "name", "tagline", "description", "color", "position", "isActive", "createdAt", "updatedAt")
      VALUES (
        subject_id, subject->>'slug', subject->>'name', subject->>'tagline', subject->>'description', subject->>'color',
        (SELECT COALESCE(MAX("position"), 0) + 1 FROM "Subject"), true, NOW(), NOW()
      );
    END IF;

    SELECT COALESCE(MAX("position"), 0) + 1 INTO next_position FROM "Topic" WHERE "subjectId" = subject_id;
    FOR topic IN SELECT value FROM jsonb_array_elements(subject->'topics') WITH ORDINALITY AS item(value, n) ORDER BY n LOOP
      INSERT INTO "Topic" ("id", "subjectId", "name", "slug", "position", "createdAt")
      VALUES (gen_random_uuid()::text, subject_id, topic->>'name', topic->>'slug', next_position, NOW())
      ON CONFLICT DO NOTHING;
      IF FOUND THEN
        next_position := next_position + 1;
      END IF;
    END LOOP;
  END LOOP;
END $$;
