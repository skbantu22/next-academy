// ONE reusable, entity-agnostic parser — every LMS query (students,
// teachers, courses, events, batches, finance, results, ...) goes through
// this same function. It never hard-codes a specific entity's phrasing;
// it only knows how to (1) find which entity from entityRegistry.js was
// mentioned, (2) figure out what the user wants done with it, using
// synonym/marker word lists that apply uniformly to every entity.
import { ENTITIES } from "./entityRegistry";
import { fuzzyFindBest } from "./fuzzyMatch";

// ---- Fuzzy normalization (spec: lowercase, trim, collapse spaces, strip
// punctuation, singular/plural — singular/plural is handled by each
// entity's synonym list already containing both forms).
export function normalizeInput(raw) {
  return (raw || "")
    .toString()
    .trim()
    .toLowerCase()
    .replace(/[?!.,।]+$/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

const COUNT_MARKERS = [
  "how many", "count", "koyjon", "koy jon", "koyta", "koy ta", "kotojon", "koto ta",
  "কয়জন", "কয়টা", "কতজন", "কতটা", "কত", "koto", "mot", "মোট", "total", "number of",
];
const LIST_MARKERS = [
  "list", "show", "all", "sob", "সব", "dekhao", "দেখাও", "dao", "দাও", "give me", "please show",
  "provide", "can show", "display",
];
// "next"/"kobe" imply exactly ONE nearest result; "upcoming"/"asche" imply
// the whole (plural-framed) list — kept as separate marker sets since
// "next event" and "upcoming events" mean genuinely different things.
const NEXT_MARKERS = ["next", "kobe", "কবে", "কখন", "when is"];
const UPCOMING_MARKERS = ["upcoming", "asche", "আসছে"];
const ACTIVE_MARKERS = ["active", "সক্রিয়"];
const INACTIVE_MARKERS = ["inactive", "নিষ্ক্রিয়"];
// Deliberately excludes "new"/"নতুন" — "new course"/"new student"/"new
// teacher" are established WRITE phrasings (nlu.js's CREATE_* patterns);
// treating "new" as a read-only recency filter here would silently steal
// those commands away from the write engine the same way "enroll" almost
// did (see enrollmentQuery.js's header for that whole class of bug).
const RECENT_MARKERS = ["recent", "সাম্প্রতিক"];
// A leftover remainder made ENTIRELY of write-imperative words (after
// every real filter/marker is already stripped) means the user issued a
// write command that happens to start with a bare entity noun ("course
// create করো", "student add koro") — never reported as a fake "search for
// something literally named create/করো"; parseLMSIntent returns null
// instead so the caller falls through to the write-action engine.
const WRITE_VERB_WORDS = new Set(["create", "add", "make", "new", "assign", "তৈরি", "যোগ", "বানাও", "নিয়োগ", "করো", "banao", "toiri", "toiry", "koro", "banan"]);
// Unambiguous English write verbs — if ANY leftover word is one of these
// (not just "every word is"), the whole message is treated as a write
// command regardless of what other words (names, batch numbers, ...)
// are also present: "assign Antu to Batch 03" must not become a search
// for a batch literally named "assign antu 03".
const STRONG_WRITE_VERBS = new Set(["create", "add", "assign", "enroll"]);
// One unified date-filter table, checked for EVERY entity (not just
// events) — longest phrases first so "next week" is matched whole before
// the bare "next" markers above would otherwise claim it. Values become
// filter.when, consumed by whichever entity actually understands a date
// range (currently Class and Event; harmless no-op filter for others).
const DATE_FILTER_MARKERS = [
  ["next-month", ["next month", "পরের মাস"]],
  ["last-month", ["last month", "গত মাস"]],
  ["this-month", ["this month", "এই মাস"]],
  ["next-week", ["next week", "পরের সপ্তাহ"]],
  ["last-week", ["last week", "গত সপ্তাহ"]],
  ["this-week", ["this week", "এই সপ্তাহ"]],
  ["tomorrow", ["tomorrow", "আগামীকাল", "আগামিকাল"]],
  ["yesterday", ["yesterday", "গতকাল"]],
  ["today", ["today", "aj", "ajke", "আজ", "আজকে"]],
];
// Generic filler that shouldn't itself be treated as a search term when
// left over after every other marker is stripped.
const FILLER_WORDS = new Set(["a", "the", "please", "me", "my", "our", "mine", "of", "do", "did", "to", "for", "is", "are", "get", "can", "you", "details", "detail", "info", "information"]);

function stripFirst(text, phrase) {
  const idx = text.indexOf(phrase);
  if (idx === -1) return text;
  return (text.slice(0, idx) + " " + text.slice(idx + phrase.length)).replace(/\s+/g, " ").trim();
}
function containsAny(text, markers) {
  return markers.find((m) => text.includes(m)) || null;
}

// Longest-synonym-first, across every registered entity, so e.g. "seminar"
// (an Event synonym) isn't shadowed by a shorter, unrelated match.
function findEntityMatch(text) {
  let best = null;
  for (const entity of Object.values(ENTITIES)) {
    for (const synonym of entity.synonyms) {
      const index = text.indexOf(synonym);
      if (index === -1) continue;
      // Earliest position in the sentence wins (the grammatical subject
      // usually comes first: "course got how many students" is about the
      // course, not a global student count) — length only breaks a tie at
      // the same position (e.g. "courses" over a coincidental shorter hit).
      if (!best || index < best.index || (index === best.index && synonym.length > best.synonym.length)) {
        best = { entity, synonym, index };
      }
    }
  }
  if (best) return best;
  return findEntityMatchFuzzy(text);
}

// Typo tolerance (spec: "revenew"->"revenue", "studnets"->"students",
// "techer"->"teacher", "coursee"->"course", "enrolement"->"enrollment",
// "attendence"->"attendance", "clas(es)"->"class(es)") — tried ONLY after
// an exact match already failed, word by word against every entity's
// synonym list, via fuzzyMatch.js's bounded Levenshtein distance. The
// matched word (not the corrected synonym) is what gets stripped from the
// remainder afterward, since that's what's actually sitting in the text.
function findEntityMatchFuzzy(text) {
  const words = text.split(" ").filter(Boolean);
  let best = null;
  for (const word of words) {
    const index = text.indexOf(word);
    for (const entity of Object.values(ENTITIES)) {
      const hit = fuzzyFindBest(word, entity.synonyms);
      if (hit && (!best || index < best.index)) {
        best = { entity, synonym: word, index };
      }
    }
  }
  return best;
}

// Real event-type values (lib/events-shared.js's EVENT_TYPES) recognized as
// a filter, not as a second competing entity match — "seminar events"
// means "events of type Seminar," not "search for something named events".
const EVENT_TYPE_HINTS = [
  ["Workshop", ["workshop", "workshops"]], ["Orientation", ["orientation"]],
  ["Team Building", ["team building"]], ["CSR Activity", ["csr"]],
  ["Seminar", ["seminar", "seminars", "সেমিনার"]], ["Meeting", ["meeting", "meetings"]],
  ["Training", ["training"]], ["Other", []],
];

// Returns null when no entity is recognized at all — the caller (queryEngine)
// falls back to the write-action parser / "I couldn't understand" only then.
export function parseLMSIntent(rawInput) {
  const text = normalizeInput(rawInput);
  if (!text) return null;

  const match = findEntityMatch(text);
  if (!match) return null;
  const { entity } = match;
  let { synonym } = match;

  // When the winning entity is Event and the plain generic word ("event"/
  // "events"/its Bangla forms) is ALSO present, strip that generic word as
  // the primary match instead of whatever type-hint word (e.g. "seminar")
  // happened to be chosen by position — the type-hint scan just below is
  // what turns the leftover type word into a real filter.type, so it must
  // still be sitting in the remainder afterward, not already consumed here.
  if (entity.key === "event") {
    const generic = entity.synonyms.find((s) => !EVENT_TYPE_HINTS.some(([, hints]) => hints.includes(s)) && text.includes(s));
    if (generic) synonym = generic;
  }

  let remainder = stripFirst(text, synonym);
  const filter = {};

  // Event type words ("seminar", "workshop", ...) double as both a generic
  // Event synonym (so a bare "seminars" still resolves to the event
  // entity) and, when they co-occur with the plain word "event(s)" in the
  // same sentence, a type filter — strip every one found so none of them
  // is left dangling as a false "search term" afterward.
  if (entity.key === "event") {
    for (const [type, hints] of EVENT_TYPE_HINTS) {
      const hit = hints.find((h) => remainder.includes(h));
      if (hit) {
        filter.type = type;
        remainder = stripFirst(remainder, hit);
      }
    }
  }

  // Filters are detected and stripped from the remainder before deciding
  // the action, so e.g. "active students" reduces to action=list with
  // filter.status="active", not a confusing leftover search term.
  if (containsAny(remainder, ACTIVE_MARKERS)) {
    filter.status = "active";
    ACTIVE_MARKERS.forEach((m) => { remainder = stripFirst(remainder, m); });
  } else if (containsAny(remainder, INACTIVE_MARKERS)) {
    filter.status = "inactive";
    INACTIVE_MARKERS.forEach((m) => { remainder = stripFirst(remainder, m); });
  }
  if (containsAny(remainder, RECENT_MARKERS)) {
    filter.recent = true;
    RECENT_MARKERS.forEach((m) => { remainder = stripFirst(remainder, m); });
  }
  if ((entity.key === "event" || entity.key === "class") && containsAny(remainder, UPCOMING_MARKERS)) {
    filter.when = "upcoming";
    UPCOMING_MARKERS.forEach((m) => { remainder = stripFirst(remainder, m); });
  } else {
    for (const [when, words] of DATE_FILTER_MARKERS) {
      const hit = words.find((w) => remainder.includes(w));
      if (hit) {
        filter.when = when;
        remainder = stripFirst(remainder, hit);
        break;
      }
    }
  }

  // "Batch 03" / "ব্যাচ ৩" mentioned anywhere (as a filter on students/
  // teachers, or as the subject itself for the batch entity).
  const batchMatch = remainder.match(/\bbatch\s*([a-z0-9]+)\b/i);
  if (batchMatch && entity.key !== "batch") {
    filter.batch = batchMatch[1];
    remainder = stripFirst(remainder, batchMatch[0]);
  }
  // "in <course>" / "for <course>" / "at <course>" names a course filter
  // for another entity (e.g. "students in Web Development").
  const courseFilterMatch = remainder.match(/\b(?:in|for|at)\s+(.+)$/i);
  if (courseFilterMatch && entity.key !== "course" && courseFilterMatch[1].trim()) {
    filter.course = courseFilterMatch[1].trim();
    remainder = stripFirst(remainder, courseFilterMatch[0]);
  }

  remainder = remainder.trim();

  // Next/upcoming is its own action (distinct from a plain list) since it
  // implies "just the nearest one," not "show everything."
  if (containsAny(remainder, NEXT_MARKERS)) {
    NEXT_MARKERS.forEach((m) => { remainder = stripFirst(remainder, m); });
    return { entity: entity.key, action: "next", filter, searchTerm: "", remainder: remainder.trim() };
  }
  if (containsAny(remainder, COUNT_MARKERS)) {
    return { entity: entity.key, action: "count", filter, searchTerm: "" };
  }
  if (containsAny(remainder, LIST_MARKERS) || Object.keys(filter).length) {
    return { entity: entity.key, action: "list", filter, searchTerm: "" };
  }
  if (!remainder) {
    return { entity: entity.key, action: "overview", filter, searchTerm: "" };
  }

  // Whatever's left (after every marker/filter word is stripped) that isn't
  // pure filler is treated as a search term/name — "Antu teacher",
  // "teacher Antu", "Web Development" (as the course entity itself), etc.
  const leftoverWords = remainder.split(" ").filter((w) => w && !FILLER_WORDS.has(w));
  if (leftoverWords.length) {
    // A write command wearing an entity noun as its subject ("course
    // create করো", "assign Antu to Batch 03") — never reported as a
    // nonsense search for something literally named "create করো" or
    // "assign antu 03"; let the write-action engine handle it instead.
    if (leftoverWords.some((w) => STRONG_WRITE_VERBS.has(w))) return null;
    if (leftoverWords.every((w) => WRITE_VERB_WORDS.has(w))) return null;
    return { entity: entity.key, action: "search", filter, searchTerm: leftoverWords.join(" ") };
  }
  return { entity: entity.key, action: "overview", filter, searchTerm: "" };
}
