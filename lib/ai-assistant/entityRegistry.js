"use client";

// One declarative registry of every LMS entity the assistant can answer
// questions about — parseLMSIntent (lmsIntentParser.js) matches against
// this registry's synonym lists, and queryEngine.js formats replies from
// it, so adding a new entity never means writing a second parser. Every
// `load` function reuses the exact same already-secured service functions
// the rest of the app uses (see analytics.js's own header for why) — this
// file adds no new Firestore access path, only a uniform shape on top.
import * as analytics from "./analytics";
import { computeEventStatus } from "../events-shared";
import { loadTeacherAssignmentData } from "../services/teacher-assignment-service";

const norm = (v) => (v || "").toString().trim().toLowerCase();

// Marks/Results are tracked per-course via lib/teacher-assessments.js's
// assessments subcollection (createAssessment/subscribeCourseAssessments) —
// there is no org-wide "all marks" aggregation anywhere in the app to reuse,
// so rather than invent one, that entity honestly reports what it can't do
// yet instead of fabricating a number.
export const ENTITIES = {
  student: {
    key: "student",
    label: "Students",
    icon: "👨‍🎓",
    synonyms: ["students", "student", "স্টুডেন্ট", "স্টুডেন্টস", "শিক্ষার্থী", "শিক্ষার্থীরা", "ছাত্র", "ছাত্রী", "ছাত্রছাত্রী"],
    async load(context) {
      return analytics.getStudents(context);
    },
    itemName: (s) => s.displayName || s.email || s.id,
    isActive: (s) => s.active !== false,
    filterableBy: ["course", "batch", "status"],
    matchesFilter(item, filter, extra) {
      if (filter.status === "active" && item.active === false) return false;
      if (filter.status === "inactive" && item.active !== false) return false;
      if (filter.course && !(extra.courseStudentIds?.has(item.id))) return false;
      if (filter.batch && !(extra.batchStudentIds?.has(item.id))) return false;
      return true;
    },
  },
  teacher: {
    key: "teacher",
    label: "Teachers",
    icon: "👨‍🏫",
    synonyms: ["teachers", "teacher", "শিক্ষক", "শিক্ষকরা", "শিক্ষিকা"],
    async load(context) {
      if (!["Admin", "Director"].includes(context.role)) return { denied: true, message: "I don't have permission to show teacher data." };
      const { teachers, classes } = await loadTeacherAssignmentData();
      return { scope: "organization", teachers: teachers || [], classes: classes || [] };
    },
    itemName: (t) => t.displayName || t.email || t.id,
    isActive: (t) => t.active !== false,
    filterableBy: ["batch", "status"],
    matchesFilter(item, filter, extra) {
      if (filter.status === "active" && item.active === false) return false;
      if (filter.status === "inactive" && item.active !== false) return false;
      if (filter.batch && !(extra.batchTeacherIds?.has(item.id))) return false;
      return true;
    },
  },
  course: {
    key: "course",
    label: "Courses",
    icon: "📚",
    synonyms: ["courses", "course", "trainings", "training", "কোর্স", "কোর্সসমূহ", "ট্রেনিং"],
    async load(context) {
      return analytics.getCourses(context);
    },
    itemName: (c) => c.title || c.courseCode || c.id,
    isActive: (c) => c.status === "Active",
    filterableBy: ["status"],
    matchesFilter(item, filter) {
      if (filter.status === "active" && item.status !== "Active") return false;
      if (filter.status === "inactive" && item.status === "Active") return false;
      return true;
    },
  },
  event: {
    key: "event",
    label: "Events",
    icon: "📅",
    synonyms: ["events", "event", "ইভেন্ট", "ইভেন্টস", "সেমিনার", "seminar", "seminars", "workshop", "workshops"],
    async load(context) {
      const events = await analytics.getEvents(context);
      return { scope: context.role === "Admin" || context.role === "Director" ? "organization" : "published", events: events.map((e) => ({ ...e, computedStatus: e.computedStatus || computeEventStatus(e) })) };
    },
    itemName: (e) => e.name,
    isActive: (e) => e.computedStatus === "Upcoming" || e.computedStatus === "Ongoing",
    filterableBy: ["type", "when"],
    matchesFilter(item, filter) {
      if (filter.type && norm(item.type) !== norm(filter.type)) return false;
      if (filter.when === "upcoming" && !["Upcoming", "Ongoing"].includes(item.computedStatus)) return false;
      if (filter.when === "this-month" && (item.eventDate || "").slice(0, 7) !== new Date().toISOString().slice(0, 7)) return false;
      if (filter.when === "tomorrow") {
        const t = new Date();
        t.setDate(t.getDate() + 1);
        if (item.eventDate !== t.toISOString().slice(0, 10)) return false;
      }
      return true;
    },
  },
  // "Batch" = identity/lookup by name ("Batch 03", "students in Batch 03")
  // — deliberately does NOT share the word "class"/"classes" with the
  // schedule-focused `class` entity below, even though both read the same
  // Firestore `classes` collection, precisely so "class today" can never
  // be misread as "search for a batch literally named today".
  batch: {
    key: "batch",
    label: "Batches",
    icon: "🏷️",
    synonyms: ["batches", "batch", "ব্যাচ"],
    async load(context) {
      if (!["Admin", "Director"].includes(context.role)) return { denied: true, message: "I don't have permission to show batch data." };
      const { classes, teachers, courses } = await loadTeacherAssignmentData();
      return { scope: "organization", classes: classes || [], teachers: teachers || [], courses: courses || [] };
    },
    itemName: (c) => c.name || c.id,
    isActive: () => true,
    filterableBy: [],
    matchesFilter: () => true,
  },
  // "Class" = the schedule view onto the exact same `classes` collection —
  // this LMS's `classes` docs are actually whole training batches (each
  // with a startDate/endDate spanning the full course, and a recurring
  // daily startTime/endTime), not single dated sessions, so "today's
  // classes" is answered honestly as "batches whose training period
  // currently covers today," using only real, existing fields — never an
  // invented per-day session record.
  class: {
    key: "class",
    label: "Classes",
    icon: "🏫",
    synonyms: ["classes", "class", "ক্লাস"],
    async load(context) {
      return analytics.getClassSchedule(context);
    },
    itemName: (c) => c.name || c.id,
    isActive: (c) => c.status !== "inactive" && c.status !== "archived",
    filterableBy: [],
    matchesFilter: () => true,
  },
  attendance: {
    key: "attendance",
    label: "Attendance",
    icon: "📊",
    synonyms: ["attendance", "উপস্থিতি", "হাজিরা"],
    async load(context) {
      return analytics.getAttendanceRate(context);
    },
    itemName: () => "",
    isActive: () => true,
    filterableBy: [],
    matchesFilter: () => true,
  },
  finance: {
    key: "finance",
    label: "Finance",
    icon: "💰",
    synonyms: ["finance", "revenue", "income", "profit", "loss", "payments", "payment", "pending payments", "টাকা", "আয়", "লাভ", "পেমেন্ট"],
    async load(context) {
      return analytics.getFinanceSummary(context);
    },
    itemName: () => "",
    isActive: () => true,
    filterableBy: [],
    matchesFilter: () => true,
  },
  result: {
    key: "result",
    label: "Marks / Results",
    icon: "📝",
    synonyms: ["results", "result", "marks", "mark", "grades", "grade", "মার্কস", "ফলাফল"],
    async load(context) {
      // Staff have no org/course-wide aggregation to reuse (real data
      // lives per-course in lib/teacher-assessments.js), so that's
      // disclosed honestly rather than approximated. A Student's own
      // rows, however, are a small direct read they're already permitted
      // — see analytics.getMyResults.
      if (context.role === "Student") return analytics.getMyResults(context);
      return { unsupportedOrgWide: true };
    },
    itemName: () => "",
    isActive: () => true,
    filterableBy: [],
    matchesFilter: () => true,
  },
};

export function findEntity(key) {
  return ENTITIES[key] || null;
}
