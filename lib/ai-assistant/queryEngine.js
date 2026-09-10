"use client";

// Read-only conversational layer — separate from the write-action state
// machine (engine.js) so a question never disturbs an in-progress
// create/update flow. Every LMS-data question (any entity) is routed
// through ONE reusable parser (parseLMSIntent) and ONE entity registry
// (entityRegistry.js) — see those files' headers. Purely local pattern
// matching (no external AI), with a small remembered {entity, action}
// slot so short follow-ups like "active", "last month", or "growth"
// resolve against whatever was last asked about.
import { parseLMSIntent } from "./lmsIntentParser";
import { ENTITIES } from "./entityRegistry";
import * as analytics from "./analytics";
import { loadEnrollments } from "../services/enrollment-service";
import { loadTeacherEnrollments } from "../services/teacher-enrollment-service";
import { isEnrollmentMention, answerEnrollmentQuery } from "./enrollmentQuery";
import { resolveDateRange, toIsoDate } from "./datetime";

const GREETING = [/^(hi|hey|hello|hy|assalamu[a-z]*)\b/i, /how are you/i, /কেমন আছ/, /কি অবস্থা/];
const HELP = [/^(help( me)?|what can you do|what do you support|how can you help)[.!?]*$/i, /কি করতে পার/, /কী করতে পার/];
const THANKS = [/^(thanks|thank you|ধন্যবাদ)\b/i];

const norm = (v) => (v || "").toString().trim().toLowerCase();
function growth(current, previous) {
  const delta = current - previous;
  const pct = previous > 0 ? (delta / previous) * 100 : current > 0 ? 100 : 0;
  return { delta, pct: Math.round(pct * 100) / 100 };
}
const pct = (n) => `${n >= 0 ? "+" : ""}${n}%`;

// Resolves "in Web Development" / "Batch 03" filters into real id sets by
// cross-referencing actual enrollment/class data — never a guess. Only
// computed when a filter that needs it is actually present, to avoid
// unnecessary reads on every plain query.
async function buildFilterExtra(entityKey, filter, context) {
  const extra = {};
  if (!filter.course && !filter.batch) return extra;

  if (filter.course && (entityKey === "student" || entityKey === "teacher")) {
    const { courses } = await analytics.getCourses(context);
    const term = norm(filter.course);
    const course = courses.find((c) => norm(c.title).includes(term) || term.includes(norm(c.title)));
    if (course) {
      if (entityKey === "student") {
        const loader = context.role === "Teacher" ? loadTeacherEnrollments : loadEnrollments;
        const payload = await loader(course.id).catch(() => ({ enrollments: [] }));
        extra.courseStudentIds = new Set((payload.enrollments || []).map((e) => e.studentId));
      } else {
        extra.courseTeacherIds = new Set(course.teacherIds || []);
      }
    } else {
      extra.courseNotFound = filter.course;
    }
  }

  if (filter.batch) {
    const { classes } = await ENTITIES.batch.load(context).catch(() => ({ classes: [] }));
    const term = norm(filter.batch);
    const batch = (classes || []).find((c) => norm(c.name).includes(term) || norm(c.id).includes(term));
    if (batch) {
      extra.batch = batch;
      extra.batchTeacherIds = new Set(batch.teacherIds || []);
      if (entityKey === "student") {
        const loader = context.role === "Teacher" ? loadTeacherEnrollments : loadEnrollments;
        const payload = await loader(batch.courseId).catch(() => ({ enrollments: [] }));
        extra.batchStudentIds = new Set((payload.enrollments || []).filter((e) => e.classId === batch.id).map((e) => e.studentId));
      }
    } else {
      extra.batchNotFound = filter.batch;
    }
  }
  return extra;
}

function itemsFor(entityDef, data) {
  if (entityDef.key === "student") return data.students || [];
  if (entityDef.key === "teacher") return data.teachers || [];
  if (entityDef.key === "course") return data.courses || [];
  if (entityDef.key === "event") return data.events || [];
  if (entityDef.key === "batch" || entityDef.key === "class") return data.classes || [];
  return [];
}

async function answerOverview(entityDef, context) {
  if (entityDef.key === "finance") return formatFinance(context);
  if (entityDef.key === "result") return formatResults(context);
  const data = await entityDef.load(context);
  if (data.denied) return data.message;
  const items = itemsFor(entityDef, data);
  if (!items.length) return `There ${entityDef.key === "course" || entityDef.key === "event" ? "are" : "are"} no ${data.scope ? `${data.scope} ` : ""}${entityDef.label.toLowerCase()} yet.`;
  const preview = items.slice(0, 5).map((item) => `• ${entityDef.itemName(item)}`).join("\n");
  const scopeLabel = data.scope && data.scope !== "organization" ? ` (${data.scope})` : "";
  return `${entityDef.icon} ${entityDef.label}${scopeLabel}\n\nTotal: ${items.length}\n\n${items.length > 5 ? "Recent" : "All"}:\n${preview}${items.length > 5 ? `\n…and ${items.length - 5} more` : ""}`;
}

async function answerCount(entityDef, context, filter) {
  if (entityDef.key === "finance") return formatFinance(context);
  if (entityDef.key === "result") return formatResults(context);
  const data = await entityDef.load(context);
  if (data.denied) return data.message;
  let items = itemsFor(entityDef, data);
  const scopeLabel = data.scope && data.scope !== "organization" ? ` ${data.scope}` : "";
  if (Object.keys(filter).length) {
    const extra = await buildFilterExtra(entityDef.key, filter, context);
    if (extra.courseNotFound) return `I couldn't find a course matching "${extra.courseNotFound}".`;
    if (extra.batchNotFound) return `I couldn't find a batch matching "${extra.batchNotFound}".`;
    items = items.filter((item) => entityDef.matchesFilter(item, filter, extra));
    return `${items.length}${scopeLabel} ${entityDef.label.toLowerCase()} match that.`;
  }
  const activeCount = items.filter((item) => entityDef.isActive(item)).length;
  return `Your LMS currently has ${items.length}${scopeLabel} ${entityDef.label.toLowerCase()} (${activeCount} active).`;
}

async function answerList(entityDef, context, filter) {
  if (entityDef.key === "finance") return formatFinance(context);
  if (entityDef.key === "result") return formatResults(context);
  const data = await entityDef.load(context);
  if (data.denied) return data.message;
  let items = itemsFor(entityDef, data);
  const extra = await buildFilterExtra(entityDef.key, filter, context);
  if (extra.courseNotFound) return `I couldn't find a course matching "${extra.courseNotFound}".`;
  if (extra.batchNotFound) return `I couldn't find a batch matching "${extra.batchNotFound}".`;
  items = items.filter((item) => entityDef.matchesFilter(item, filter, extra));
  if (!items.length) return `No ${entityDef.label.toLowerCase()} match that.`;
  const shown = items.slice(0, 12).map((item) => `• ${entityDef.itemName(item)}`).join("\n");
  return `${entityDef.label} (${items.length}):\n${shown}${items.length > 12 ? `\n…and ${items.length - 12} more` : ""}`;
}

async function answerSearch(entityDef, context, searchTerm) {
  if (entityDef.key === "finance" || entityDef.key === "result") return answerOverview(entityDef, context);
  const data = await entityDef.load(context);
  if (data.denied) return data.message;
  const items = itemsFor(entityDef, data);
  const term = norm(searchTerm);
  const matches = items.filter((item) => norm(entityDef.itemName(item)).includes(term));
  if (!matches.length) return `I couldn't find any ${entityDef.label.toLowerCase()} matching "${searchTerm}".`;
  if (matches.length > 1) {
    return `I found multiple matching ${entityDef.label.toLowerCase()}. Which one do you mean?\n${matches.slice(0, 8).map((m, i) => `${i + 1}. ${entityDef.itemName(m)}`).join("\n")}`;
  }
  const item = matches[0];
  if (entityDef.key === "course") {
    return `${item.title}\nStatus: ${item.status || "—"}\nEnrolled: ${item.enrolled ?? 0}${item.category ? `\nCategory: ${item.category}` : ""}${item.duration ? `\nDuration: ${item.duration}` : ""}`;
  }
  if (entityDef.key === "teacher") {
    const batchCount = (data.classes || []).filter((c) => (c.teacherIds || []).includes(item.id)).length;
    return `${item.displayName || item.email}\nEmail: ${item.email || "—"}\nStatus: ${item.active !== false ? "Active" : "Inactive"}\nAssigned batches: ${batchCount}`;
  }
  if (entityDef.key === "student") {
    return `${item.displayName || item.email}\nEmail: ${item.email || "—"}\nStatus: ${item.active !== false ? "Active" : "Inactive"}${typeof item.attendance === "number" ? `\nAttendance: ${item.attendance}%` : ""}`;
  }
  if (entityDef.key === "batch") {
    const teacherNames = (data.teachers || []).filter((t) => (item.teacherIds || []).includes(t.id)).map((t) => t.displayName || t.email);
    return `${item.name || item.id}\nTeacher(s): ${teacherNames.join(", ") || "Not assigned"}`;
  }
  return entityDef.itemName(item);
}

const DETAIL_SUFFIX = /\s+(details?|info|information)$/i;
async function answerBareNameLookup(trimmed, context) {
  if (!DETAIL_SUFFIX.test(trimmed)) return null;
  const name = trimmed.replace(DETAIL_SUFFIX, "").trim();
  if (!name) return null;
  const courseReply = await answerSearch(ENTITIES.course, context, name);
  if (!/couldn't find/i.test(courseReply)) return courseReply;
  if (["Admin", "Director"].includes(context.role)) {
    const teacherReply = await answerSearch(ENTITIES.teacher, context, name);
    if (!/couldn't find|denied|permission/i.test(teacherReply)) return teacherReply;
  }
  return null;
}

async function answerNext(entityDef, context) {
  if (entityDef.key !== "event") return answerOverview(entityDef, context);
  const event = await analytics.getNextEvent(context);
  if (!event) return "There are no upcoming events scheduled right now.";
  return `The next event is "${event.name}" on ${event.eventDate}${event.startTime ? ` at ${event.startTime}` : ""}${event.location ? ` (${event.location})` : ""}.`;
}

// This LMS's `classes` Firestore collection is really each training
// batch's own record — startDate/endDate span the WHOLE course, with a
// single recurring daily startTime/endTime, not one row per session. So
// "today's classes" is answered honestly as "batches whose training
// period currently covers today," using only those real fields.
function classMatchesWhen(item, whenKey) {
  if (!whenKey) return true;
  const start = item.startDate;
  const end = item.endDate || start;
  if (!start) return false;
  const today = toIsoDate(new Date());
  if (whenKey === "upcoming") return start > today;
  const range = resolveDateRange(whenKey);
  if (!range) return true;
  return start <= range.end && end >= range.start;
}

function describeClass(item, data) {
  const course = (data.courses || []).find((c) => c.id === item.courseId);
  const teacherNames = (data.teachers || []).filter((t) => (item.teacherIds || []).includes(t.id)).map((t) => t.displayName || t.email);
  const timeLabel = item.startTime && item.endTime ? `${item.startTime}–${item.endTime}` : item.startTime || "";
  const parts = [item.name || item.id];
  if (course?.title) parts.push(course.title);
  const room = [item.room, item.building].filter(Boolean).join(", ");
  if (room) parts.push(room);
  if (teacherNames.length) parts.push(teacherNames.join(", "));
  return { timeLabel, line: parts.join(" — ") };
}

async function answerClassSchedule(context, action, filter) {
  const data = await ENTITIES.class.load(context);
  if (data.denied) return data.message;
  // A bare "classes"/"class" (action=overview, no explicit date) defaults
  // to TODAY's schedule, matching "classes -> Today's/upcoming class
  // overview" — an explicit "class list"/"show classes" with no date
  // filter, on the other hand, is a real request to see every batch.
  const whenKey = filter.when || (action === "overview" ? "today" : null);
  const matches = (data.classes || []).filter((item) => classMatchesWhen(item, whenKey));
  const periodLabel = whenKey ? (resolveDateRange(whenKey)?.label ?? (whenKey === "upcoming" ? "upcoming" : whenKey)) : null;

  if (action === "count") {
    return `${matches.length} class${matches.length === 1 ? "" : "es"}${periodLabel ? ` scheduled ${periodLabel === "today" ? "today" : periodLabel}` : ""}.`;
  }
  if (action === "next") {
    const today = toIsoDate(new Date());
    const upcoming = (data.classes || []).filter((c) => c.startDate > today).sort((a, b) => (a.startDate || "").localeCompare(b.startDate || ""));
    if (!upcoming.length) return "There are no upcoming classes scheduled.";
    const { line } = describeClass(upcoming[0], data);
    return `The next class is ${line} (starting ${upcoming[0].startDate}).`;
  }
  if (!matches.length) {
    return periodLabel === "today" ? "No classes are scheduled for today." : `No classes are scheduled${periodLabel ? ` for ${periodLabel}` : ""}.`;
  }
  const lines = matches
    .map((item) => describeClass(item, data))
    .sort((a, b) => (a.timeLabel || "").localeCompare(b.timeLabel || ""))
    .map(({ timeLabel, line }) => (timeLabel ? `${timeLabel}\n${line}` : line));
  const title = periodLabel === "today" ? "Today's Classes" : periodLabel ? `Classes — ${periodLabel[0].toUpperCase()}${periodLabel.slice(1)}` : "Classes";
  return `${title}\n\n${lines.join("\n\n")}`;
}

async function formatAttendance(context) {
  const result = await analytics.getAttendanceRate(context);
  if (result.denied) return result.message;
  if (result.none) return context.role === "Student" ? "You don't have any recorded attendance yet." : "There isn't enough attendance data available to calculate this accurately.";
  if (context.role === "Student") return `Your attendance is ${result.average}%.`;
  return `Average attendance across ${result.studentsCounted} ${result.scope} student${result.studentsCounted === 1 ? "" : "s"} is ${result.average}%.`;
}

async function formatResults(context) {
  if (context.role !== "Student") {
    return "Marks/results are tracked per training course, not organization-wide. Tell me which course, and I can look from there once that view is available in the assistant.";
  }
  const result = await analytics.getMyResults(context);
  if (result.none) return "You don't have any recorded results yet.";
  const lines = result.rows.map((r) => `• ${r.title || "Assessment"}: ${r.score}${r.maxScore ? `/${r.maxScore}` : ""} (${r.status === "pass" ? "Pass" : "Fail"})`);
  const more = result.count > result.rows.length ? `\n…and ${result.count - result.rows.length} more` : "";
  return `Your Results (${result.count})\n\n${lines.join("\n")}${more}\n\nPassed: ${result.passed} · Failed: ${result.failed}`;
}
async function formatLowAttendance(context) {
  const result = await analytics.getLowAttendanceStudents(context);
  if (result.denied) return result.message;
  if (!result.rows.length) return `No ${result.scope} students are below ${result.threshold}% attendance right now.`;
  return `Students below ${result.threshold}% attendance:\n${result.rows.map((r) => `• ${r.name} — ${r.attendance}%`).join("\n")}`;
}

async function formatFinance(context) {
  const result = await analytics.getFinanceSummary(context);
  if (result.denied) return result.message;
  return [
    "Revenue",
    "",
    `This month: $${result.monthIncome.toLocaleString()}`,
    `Today: $${result.todayIncome.toLocaleString()}`,
    `All time: $${result.income.toLocaleString()}`,
    `Profit (all time): $${result.profit.toLocaleString()}`,
    `Outstanding due: $${result.due.toLocaleString()}`,
    `Pending payments: ${result.pendingCount} (${result.paidCount} fully paid)`,
  ].join("\n");
}

const FOLLOWUP_PATTERNS = {
  GROWTH: /^growth\??$/i, LAST_MONTH: /^last month\??$/i, THIS_MONTH: /^this month\??$/i, ACTIVE: /^(and\s+)?active\??$/i,
  // Bare date words as a follow-up ("classes" then just "tomorrow") only
  // make sense for schedule-shaped entities (Class/Event) — handled by
  // re-running that entity's own date-filtered query, not the growth/active
  // logic below, which is student-count-specific.
  BARE_DATE: /^(today|tomorrow|yesterday|this week|next week|last week|next month|upcoming)\??$/i,
};

async function answerFollowUp(kind, context, memory, rawText) {
  if (!memory?.entity) return "Could you clarify what you'd like to know? (e.g. \"how many students\" first)";
  const entityDef = ENTITIES[memory.entity];
  if (kind === "BARE_DATE") {
    if (memory.entity === "class") {
      const intent = parseLMSIntent(`classes ${rawText}`);
      return answerClassSchedule(context, "list", intent?.filter || {});
    }
    return `I don't have a date-filtered view for ${entityDef?.label?.toLowerCase() || "that"} yet.`;
  }
  if (kind === "ACTIVE") {
    const data = await entityDef.load(context);
    if (data.denied) return data.message;
    const items = itemsFor(entityDef, data);
    const active = items.filter((i) => entityDef.isActive(i)).length;
    return `${active} of ${items.length} ${entityDef.label.toLowerCase()} are active.`;
  }
  if (memory.entity !== "student") return `I don't have a month-over-month comparison for ${entityDef.label.toLowerCase()} yet — try asking about students.`;
  const result = await analytics.getStudentGrowth(context);
  if (result.denied) return result.message;
  if (kind === "LAST_MONTH") return `Last month there were ${result.lastMonth} new ${result.scope} student sign-ups.`;
  if (kind === "THIS_MONTH") return `${result.thisMonth} new students this month.`;
  return `${result.thisMonth} new students this month vs ${result.lastMonth} last month — ${result.delta >= 0 ? "growth" : "decline"} of ${Math.abs(result.delta)} (${pct(result.pct)}).`;
}

// `memory` = { entity, action } — persisted in AiAssistantPanel's component
// state across turns, passed in and (a possibly updated copy) returned.
// Returns null when nothing — not even a recognized LMS entity — matched,
// so the caller can fall through to the write-action parser / genuine
// "I couldn't understand" message; it is never used for a request that
// actually named a real LMS entity.
export async function answerQuery(rawText, context, memory) {
  const trimmed = (rawText || "").trim();
  if (THANKS.some((p) => p.test(trimmed))) return { reply: "You're welcome!", memory };
  if (HELP.some((p) => p.test(trimmed))) {
    return {
      reply: "I can answer questions about students, teachers, courses, events, batches, attendance, and finance, and I can create/update LMS records (course, student, teacher, event, teacher assignment, enrollment) with your confirmation before saving anything.",
      memory,
    };
  }
  if (GREETING.some((p) => p.test(trimmed))) return { reply: "Hi! How can I help you with your LMS today?", memory };

  const followUpKind = Object.entries(FOLLOWUP_PATTERNS).find(([, pattern]) => pattern.test(trimmed))?.[0];
  if (followUpKind) return { reply: await answerFollowUp(followUpKind, context, memory, trimmed), memory };

  if (
    /academy.*(doing|overview|status|performing)/i.test(trimmed) ||
    /\boverview\b/i.test(trimmed) ||
    /management report/i.test(trimmed) ||
    /\bdashboard\b/i.test(trimmed) ||
    /how (is|are) (we|things|it) doing/i.test(trimmed) ||
    /today.?s summary/i.test(trimmed)
  ) {
    return { reply: await answerAcademyOverview(context), memory: { entity: null, action: null } };
  }

  // Enrollment is checked here, ahead of the generic entity parser, because
  // "enroll" is the one entity word that's also the literal write verb —
  // see enrollmentQuery.js's header for the READ-vs-WRITE rule. A `null`
  // here can mean two different things: no enrollment word at all (fall
  // through normally below), or an enrollment word that reads as a genuine
  // write command (e.g. "enroll Rahim in X") — the latter must ALSO stop
  // here and return null, so the caller falls through to the write-action
  // engine instead of the generic parser potentially misreading it.
  if (isEnrollmentMention(trimmed)) {
    const enrollmentReply = await answerEnrollmentQuery(trimmed, context);
    if (enrollmentReply) return { reply: enrollmentReply, memory: { entity: "enrollment", action: "list" } };
    return null;
  }

  const intent = parseLMSIntent(trimmed);
  if (!intent) {
    // No entity keyword at all (e.g. "Web Development details") — the one
    // bounded fallback: a bare name followed by a details/info word is
    // looked up directly against real course and teacher names (the two
    // things most often referred to by name alone) before giving up.
    const bareNameReply = await answerBareNameLookup(trimmed, context);
    if (bareNameReply) return { reply: bareNameReply, memory: { entity: null, action: "search" } };
    return null;
  }
  const entityDef = ENTITIES[intent.entity];
  if (!entityDef) return null;

  // "low attendance" / "students with low attendance" / "at-risk students"
  // — checked ahead of the generic dispatch since it names a specific,
  // real list (getLowAttendanceStudents), not the plain average rate.
  if (entityDef.key === "attendance" && /\blow\b|কম/i.test(trimmed)) {
    return { reply: await formatLowAttendance(context), memory: { entity: "attendance", action: "list" } };
  }
  if (entityDef.key === "attendance") {
    const reply = await formatAttendance(context);
    return { reply, memory: { entity: "attendance", action: intent.action } };
  }
  if (entityDef.key === "class") {
    const reply = await answerClassSchedule(context, intent.action, intent.filter);
    return { reply, memory: { entity: "class", action: intent.action } };
  }

  let reply;
  if (intent.action === "overview") reply = await answerOverview(entityDef, context);
  else if (intent.action === "count") reply = await answerCount(entityDef, context, intent.filter);
  else if (intent.action === "list") reply = await answerList(entityDef, context, intent.filter);
  else if (intent.action === "next") reply = await answerNext(entityDef, context);
  else if (intent.action === "search") reply = await answerSearch(entityDef, context, intent.searchTerm);
  else reply = await answerOverview(entityDef, context);

  return { reply, memory: { entity: intent.entity, action: intent.action } };
}

// Every line is conditional on that section's data actually being
// available/authorized for the caller — a Teacher asking "how's the
// academy doing" gets students/teachers/courses/classes/finance quietly
// omitted (denied) rather than an error, since a partial, honest overview
// beats an all-or-nothing failure.
async function answerAcademyOverview(context) {
  const overview = await analytics.getAcademyOverview(context);
  const lines = ["ACADEMY OVERVIEW", ""];
  if (!overview.students.denied) lines.push(`Students\n${overview.students.total} total\n${overview.students.active} active`);
  if (!overview.teachers.denied) lines.push(`Teachers\n${overview.teachers.active} active`);
  if (!overview.courses.denied) lines.push(`Courses\n${overview.courses.active} active`);
  if (!overview.enrollments.denied) lines.push(`Enrollments\n${overview.enrollments.thisMonth} this month`);
  if (!overview.attendance.denied && !overview.attendance.none) lines.push(`Attendance\n${overview.attendance.average}%`);
  if (!overview.classesToday.denied) lines.push(`Classes\n${overview.classesToday.count} today`);
  lines.push(`Upcoming Events\n${overview.upcomingEvents.length}`);
  if (!overview.finance.denied) {
    lines.push(`Revenue\n$${overview.finance.income.toLocaleString()}`);
    lines.push(`Pending Payments\n${overview.finance.pendingCount}`);
    lines.push(`Profit\n$${overview.finance.profit.toLocaleString()}`);
  }
  return lines.join("\n\n");
}

// Retained for direct callers that only need entity detection without a
// formatted reply (none currently, kept for parity/testability).
export { parseLMSIntent };
