"use client";

// Dedicated READ-vs-WRITE disambiguation for enrollment requests. This is
// separate from lmsIntentParser.js's generic entity registry on purpose:
// "enroll" is the one entity word in this LMS that is ALSO the literal verb
// for the write action (CREATE enrollment in engine.js/nlu.js), so it needs
// an explicit safety rule the generic parser doesn't need for
// unambiguous nouns like "student"/"course"/"event". The rule, in order:
//   1. A read signal (list/show/today/who/count/...) anywhere -> READ,
//      no matter what else is in the sentence ("today enroll list").
//   2. Otherwise, a clear write verb/imperative shape -> WRITE, so
//      "enroll Rahim in X" / "create enrollment" / the Bangla-SOV
//      "X কে ... enroll করো" pattern are never misread as READ.
//   3. Otherwise (ambiguous, e.g. "Rahim's enrollments") -> READ, since
//      silently showing data is far safer than silently writing it.
import { resolveDateRange } from "./datetime";
import { getEnrollments } from "./analytics";
import { fuzzyFindBest } from "./fuzzyMatch";

const ENROLLMENT_WORD = /\b(enrollments?|enroll(ed|ing)?|ভর্তি|এনরোলমেন্ট)\b/i;
const READ_SIGNAL = /\b(list|show|view|display|count|how many|who|which|today|yesterday|this week|last week|this month|last month|this year|recent|history|koyjon|koyta|koto|korse|hoise|kobe|kothay|আজ|আজকে|গতকাল|কয়জন|কয়টা|কত|কবে|কোথায়)\b/i;
const CLEAR_WRITE_VERB = /\b(create|add)\b/i;
const WRITE_IMPERATIVE_SHAPE = /^enroll\s+\S/i;
const BANGLISH_SOV_WRITE = /\bke\b.+\benroll\b|কে.+enroll/i;
const ENROLLMENT_TYPO_CANDIDATES = ["enrollment", "enrollments", "enroll", "enrolled", "enrolling"];

// Exact regex first (the common case); only when that fails, fuzzy-check
// each word against the same small enrollment vocabulary so a typo
// ("enrolement", "enrollement") isn't silently misread as "no entity
// mentioned at all" and dropped to the generic parser/unknown fallback.
export function isEnrollmentMention(text) {
  if (ENROLLMENT_WORD.test(text)) return true;
  const words = (text || "").toLowerCase().split(/\s+/).filter(Boolean);
  return words.some((w) => fuzzyFindBest(w, ENROLLMENT_TYPO_CANDIDATES) !== null);
}

function looksLikeWrite(text) {
  if (READ_SIGNAL.test(text)) return false;
  return CLEAR_WRITE_VERB.test(text) || WRITE_IMPERATIVE_SHAPE.test(text) || BANGLISH_SOV_WRITE.test(text);
}

const DATE_KEYS = [
  ["today", ["today", "aj", "ajke", "আজ", "আজকে"]],
  ["yesterday", ["yesterday", "গতকাল"]],
  ["last-week", ["last week", "গত সপ্তাহ"]],
  ["this-week", ["this week", "এই সপ্তাহ"]],
  ["last-month", ["last month", "গত মাস"]],
  ["this-month", ["this month", "এই মাস"]],
  ["this-year", ["this year", "এই বছর"]],
];
function detectDateKey(lower) {
  for (const [key, words] of DATE_KEYS) {
    if (words.some((w) => lower.includes(w))) return key;
  }
  return null;
}

// "Web Development e ajke koyjon enroll hoise" -> course fragment before a
// standalone "e"/"এ" particle. Best-effort: only fires on that specific,
// common construction, never guesses a course name out of thin air.
function detectCourseTerm(original) {
  const match = original.match(/^(.+?)\s+(?:e|এ)\s+/i);
  return match ? match[1].trim() : null;
}
// A leading/standalone capitalized word in the ORIGINAL (pre-lowercase)
// text that isn't part of a detected course phrase is treated as a
// student-name search term ("Rahim's enrollments", "show Rahim
// enrollments").
function detectStudentTerm(original, courseTerm) {
  const words = original.replace(/'s\b/gi, "").split(/\s+/);
  for (const word of words) {
    const clean = word.replace(/[^A-Za-z]/g, "");
    if (clean.length > 1 && /^[A-Z]/.test(clean) && (!courseTerm || !courseTerm.includes(clean))) return clean;
  }
  return null;
}

// Returns a formatted reply string, or null when this isn't an enrollment
// READ request at all (caller should try the write-action engine instead —
// see looksLikeWrite's rule above for exactly when that happens).
export async function answerEnrollmentQuery(originalText, context) {
  if (!isEnrollmentMention(originalText)) return null;
  if (looksLikeWrite(originalText)) return null;

  const lower = originalText.toLowerCase();
  const dateKey = detectDateKey(lower);
  const courseTerm = detectCourseTerm(originalText);
  const studentTerm = detectStudentTerm(originalText, courseTerm);
  const isCount = /\b(count|how many|koyjon|koyta|koto)\b/i.test(originalText);

  const { rows, courseNotFound, scope } = await getEnrollments(context, { courseTerm });
  if (courseNotFound) return `I couldn't find a course matching "${courseNotFound}".`;

  let filtered = rows;
  let periodLabel = "";
  if (dateKey) {
    const range = resolveDateRange(dateKey, new Date());
    periodLabel = range.label;
    filtered = filtered.filter((r) => {
      const day = (r.enrolledAt || "").slice(0, 10);
      return day && day >= range.start && day <= range.end;
    });
  }
  if (studentTerm) {
    const term = studentTerm.toLowerCase();
    filtered = filtered.filter((r) => (r.displayName || "").toLowerCase().includes(term));
  }

  const periodPhrase = periodLabel ? (periodLabel === "today" ? "Today's" : `${periodLabel[0].toUpperCase()}${periodLabel.slice(1)}`) : scope === "your own" ? "Your" : "All";

  if (isCount) {
    return `📝 ${periodPhrase} Enrollments\n\n${filtered.length} student${filtered.length === 1 ? "" : "s"} enrolled${periodLabel && periodLabel !== "today" ? ` ${periodLabel}` : periodLabel === "today" ? " today" : ""}${studentTerm ? ` matching "${studentTerm}"` : ""}${courseTerm ? ` in ${courseTerm}` : ""}.`;
  }

  if (!filtered.length) {
    if (dateKey === "today") return "📚 No enrollments were found for today.";
    return `📚 No enrollments were found${periodLabel ? ` for ${periodLabel}` : ""}${studentTerm ? ` matching "${studentTerm}"` : ""}${courseTerm ? ` in ${courseTerm}` : ""}.`;
  }

  const sorted = [...filtered].sort((a, b) => String(b.enrolledAt || "").localeCompare(String(a.enrolledAt || "")));
  const lines = sorted.slice(0, 15).map((r, i) => `${i + 1}. ${r.displayName} → ${r.courseTitle}`);
  return `📝 ${periodPhrase} Enrollments\n\nTotal: ${filtered.length}\n\n${lines.join("\n")}${filtered.length > 15 ? `\n…and ${filtered.length - 15} more` : ""}`;
}
