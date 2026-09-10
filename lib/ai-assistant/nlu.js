// Rule-based, multilingual (English / Bangla / Banglish) intent + field
// extraction for the AI Assistant. This is deliberately NOT a general LLM —
// see the "NLU approach" decision recorded for this feature — it's a
// pattern/keyword matcher scoped to the exact action set in schemas.js.
// It is intentionally conservative: when it isn't confident about a field,
// it leaves that field unset rather than guessing, and the engine's
// "answer the field I just asked about" fallback (engine.js) is what makes
// the overall conversation robust to phrasings this file can't parse.
import { parseDate, parseTime } from "./datetime";
import { getAction } from "./schemas";

const INTENTS = [
  // Order matters — more specific phrases are checked first so e.g. "assign
  // a teacher" isn't mis-classified before the more specific
  // TEACHER_ASSIGNMENT check below has a chance to run.
  { actionId: "TEACHER_ASSIGNMENT", patterns: [/teacher\s*(assign|assignment)/i, /assign.*teacher/i, /শিক্ষক\s*(নিয়োগ|এসাইন)/, /টিচার\s*assign/i, /^assign\s+\S+\s+(to|for)\b/i, /কে\s+.+\s*(এর)?\s*(এসাইন|নিয়োগ)\s*করো/] },
  { actionId: "STUDENT_ENROLLMENT", patterns: [/\benroll/i, /ভর্তি\s*করো/, /এনরোল/] },
  { actionId: "CREATE_EVENT", patterns: [/create.*event/i, /new event/i, /event.*(create|বানাও|তৈরি)/i, /ইভেন্ট/, /\b(seminar|workshop|orientation)\b.*(create|বানাও|তৈরি)/i] },
  { actionId: "CREATE_TEACHER", patterns: [/create.*teacher/i, /add.*teacher/i, /new teacher/i, /teacher.*(add|create|যোগ)/i, /শিক্ষক\s*(তৈরি|যোগ)/] },
  { actionId: "CREATE_STUDENT", patterns: [/create.*student/i, /add.*student/i, /new student/i, /student.*(add|create|যোগ)/i, /ছাত্র.*(তৈরি|যোগ)/, /শিক্ষার্থী.*(তৈরি|যোগ)/] },
  { actionId: "CREATE_COURSE", patterns: [/create.*course/i, /new course/i, /course.*(create|বানাও|তৈরি)/i, /কোর্স/] },
];

export function detectIntent(text) {
  const normalized = (text || "").trim();
  for (const { actionId, patterns } of INTENTS) {
    if (patterns.some((pattern) => pattern.test(normalized))) return actionId;
  }
  return null;
}

// A pending edit/delete/update phrase, detected separately from create
// intents so the engine can route to the update/delete flow instead.
export function detectMutationKind(text) {
  const normalized = (text || "").toLowerCase();
  if (/\b(delete|remove)\b|মুছ|ডিলিট/.test(normalized)) return "DELETE";
  if (/\b(update|change|edit|rename)\b|পরিবর্তন|করে\s*দাও|আপডেট/.test(normalized)) return "UPDATE";
  return "CREATE";
}

const BOOLEAN_YES = /\b(yes|true|required|required\s*=?\s*yes|হ্যাঁ|হা)\b/i;
const BOOLEAN_NO = /\b(no|false|not\s*required|না)\b/i;

// Tries every labeled-field pattern for this action against the raw text,
// returning whatever it's confident about. `now` is injected (not read from
// Date.now() internally) so date parsing is deterministic and testable.
export function extractFields(actionId, text, now = new Date()) {
  const action = getAction(actionId);
  if (!action) return { values: {}, dateIssues: [] };
  const raw = (text || "").trim();
  const values = {};
  const dateIssues = [];

  function setDateLike(key, candidateText) {
    const result = parseDate(candidateText, now);
    if (!result) return;
    if (result.ambiguous) dateIssues.push({ field: key, reason: result.reason });
    else values[key] = result.value;
  }
  function setTimeLike(key, candidateText) {
    const result = parseTime(candidateText);
    if (!result) return;
    if (result.ambiguous) dateIssues.push({ field: key, reason: result.reason });
    else values[key] = result.value;
  }

  // ---- Generic "label: value" / "label - value" / "label is value" scan,
  // tried for every field this action defines, in both English and common
  // Bangla label words. This is the safety net for anything not covered by
  // the structural extractors below (e.g. "code: WD-001", "category IT").
  const labelWords = {
    // "নাম" (bare "name") is deliberately excluded here — it's a literal
    // prefix of "নামে" ("named as"), so it would fire on that structural
    // marker first and capture garbage before the dedicated "নামে"
    // extractor below ever runs. English "name" is unambiguous, so it stays.
    name: ["name"], code: ["code", "কোড"], category: ["category", "ক্যাটাগরি"],
    duration: ["duration", "মেয়াদ"], status: ["status", "স্ট্যাটাস"], description: ["description", "বর্ণনা"],
    price: ["price", "fee", "মূল্য", "ফি"], capacity: ["capacity", "ধারণক্ষমতা"],
    startDate: ["start date", "শুরুর তারিখ"], endDate: ["end date", "শেষ তারিখ"],
    displayName: ["full name", "name"], email: ["email", "ইমেইল"], phone: ["phone", "ফোন"],
    department: ["department", "বিভাগ"], designation: ["designation", "পদবি"], joiningDate: ["joining date", "যোগদানের তারিখ"],
    qualification: ["qualification", "যোগ্যতা"], experience: ["experience", "অভিজ্ঞতা"], specialization: ["specialization", "বিশেষত্ব"],
    location: ["location", "স্থান", "location "], organizer: ["organizer", "আয়োজক"], maxParticipants: ["max participants", "maximum participants", "সর্বোচ্চ অংশগ্রহণকারী"],
    notes: ["notes", "নোট"], password: ["password", "পাসওয়ার্ড"],
  };
  Object.entries(action.fields).forEach(([key, def]) => {
    const words = labelWords[key];
    if (!words) return;
    for (const word of words) {
      const pattern = new RegExp(`${word}\\s*[:\\-]?\\s*([^,\\n]+)`, "i");
      const match = raw.match(pattern);
      if (match) {
        // Trim trailing sentence punctuation ("6 months." at the end of a
        // sentence, or "6 months।" with the Bangla daŗi) that a comma-only
        // capture boundary otherwise leaves attached to the last field.
        const captured = match[1].trim().replace(/[.।]+$/, "").trim();
        if (def.type === "date") setDateLike(key, captured);
        else if (def.type === "time") setTimeLike(key, captured);
        else if (def.type === "number") {
          const num = captured.match(/\d+(\.\d+)?/);
          if (num) values[key] = Number(num[0]);
        } else if (def.type === "boolean") {
          if (BOOLEAN_YES.test(captured)) values[key] = true;
          else if (BOOLEAN_NO.test(captured)) values[key] = false;
        } else if (def.type === "enum") {
          const found = def.options.find((option) => captured.toLowerCase().includes(option.toLowerCase()));
          if (found) values[key] = found;
        } else if (!values[key]) {
          values[key] = captured;
        }
        break;
      }
    }
  });

  // ---- Structural extractors for the exact worked examples in the spec.
  if (actionId === "CREATE_COURSE" || actionId === "CREATE_EVENT") {
    const nameKey = "name";
    if (!values[nameKey]) {
      const namedBangla = raw.match(/^(.+?)\s*নামে/);
      const calledEn = raw.match(/called\s+([^,.]+)/i) || raw.match(/named\s+([^,.]+)/i);
      if (namedBangla) values[nameKey] = namedBangla[1].trim();
      else if (calledEn) values[nameKey] = calledEn[1].trim();
    }
  }
  if (actionId === "CREATE_EVENT") {
    for (const option of action.fields.type.options) {
      if (new RegExp(`\\b${option}\\b`, "i").test(raw)) {
        values.type = option;
        break;
      }
    }
    if (!values.eventDate) setDateLike("eventDate", raw);
    if (!values.startTime || !values.endTime) {
      const rangeMatch = raw.match(/(\d{1,2}(?::\d{2})?\s*(?:am|pm)?)\s*(?:to|-|–|থেকে)\s*(\d{1,2}(?::\d{2})?\s*(?:am|pm)?)/i);
      if (rangeMatch) {
        setTimeLike("startTime", rangeMatch[1]);
        setTimeLike("endTime", rangeMatch[2]);
      } else if (!values.startTime) {
        setTimeLike("startTime", raw);
      }
    }
  }

  if (actionId === "STUDENT_ENROLLMENT") {
    const banglish = raw.match(/^(.+?)\s*কে\s+(.+?)\s*(?:এ|এর)?\s*enroll/i);
    const english = raw.match(/enroll\s+(.+?)\s+(?:in|into|to)\s+(.+)/i);
    const pair = banglish || english;
    if (pair) {
      values.__studentQuery = pair[1].trim();
      values.__courseQuery = pair[2].trim();
    }
  }
  if (actionId === "TEACHER_ASSIGNMENT") {
    const banglish = raw.match(/^(.+?)\s*কে\s+(.+?)\s*(?:এর)?\s*teacher\s*assign/i);
    const english = raw.match(/assign\s+(.+?)\s+(?:as\s+(?:the\s+)?teacher\s+)?(?:for|to)\s+(.+)/i);
    const pair = banglish || english;
    if (pair) {
      values.__teacherQuery = pair[1].trim();
      values.__batchQuery = pair[2].trim();
    }
    if (!values.startDate) setDateLike("startDate", raw);
  }

  return { values, dateIssues };
}
