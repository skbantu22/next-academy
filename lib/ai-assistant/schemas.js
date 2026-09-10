// Declarative field schema per AI Assistant action — the single source of
// truth the engine (engine.js), NLU (nlu.js), and executors (executors.js)
// all read from, so "what's required," "what did the user still not give
// me," and "what do I send to the real API" can never drift apart.
//
// CRITICAL RULE: every field/requirement here must be verified against the
// REAL backend route it executes against (see the file path noted per
// action) — never against a generic/assumed LMS schema. A field is
// `required: true` here ONLY if the underlying route actually throws
// without it. Getting this wrong means the assistant asks for information
// the database doesn't need (or worse, silently skips something it does),
// which is exactly the failure mode this file exists to prevent.
//
// `type` drives both validation and, for `entity:*` fields, which
// entityResolver.js search function is used to resolve a typed name into a
// real Firestore record (with disambiguation when more than one matches).
export const ACTIONS = {
  // Verified against app/api/admin/training/route.js's courseFields() +
  // validateInstructors(): the ONLY things that actually throw when absent
  // are title, status, and primaryTeacherId. courseCode is SERVER-GENERATED
  // (nextCourseCode) exactly like Student ID / Teacher ID below — never a
  // user-supplied field, so it is never asked for here, matching how this
  // schema already treats those. category/duration/price/capacity/dates are
  // real, stored fields but are NOT required by that route, so they stay
  // optional here too.
  CREATE_COURSE: {
    label: "Create Course",
    allowedRoles: ["Admin", "Director"],
    fields: {
      name: { label: "Course Name", required: true, type: "text" },
      status: { label: "Course Status", required: true, type: "enum", options: ["Draft", "Upcoming", "Active", "Completed", "Archived"] },
      instructor: { label: "Instructor (Primary Teacher)", required: true, type: "entity:teacher" },
      category: { label: "Category", required: false, type: "text" },
      duration: { label: "Duration", required: false, type: "text" },
      description: { label: "Description", required: false, type: "text" },
      price: { label: "Price", required: false, type: "number" },
      capacity: { label: "Capacity (Max Students)", required: false, type: "number" },
      startDate: { label: "Start Date", required: false, type: "date" },
      endDate: { label: "End Date", required: false, type: "date" },
    },
  },
  // Verified against lib/events-shared.js's validateEventFields(): only
  // name/type/eventDate/startTime/endTime actually throw when missing.
  // location/organizer/status are real stored fields but are NOT required
  // by that function — length-capped free text (organizer/location) or an
  // optional manual override (status; the event's real displayed status is
  // otherwise computed automatically from date/time, so it is never asked
  // for as if it were a plain required field).
  CREATE_EVENT: {
    label: "Create Event",
    allowedRoles: ["Admin", "Director"],
    fields: {
      name: { label: "Event Name", required: true, type: "text" },
      type: { label: "Event Type", required: true, type: "enum", options: ["Workshop", "Orientation", "Team Building", "CSR Activity", "Seminar", "Meeting", "Training", "Other"] },
      eventDate: { label: "Event Date", required: true, type: "date" },
      startTime: { label: "Start Time", required: true, type: "time" },
      endTime: { label: "End Time", required: true, type: "time" },
      location: { label: "Location", required: false, type: "text" },
      organizer: { label: "Organizer", required: false, type: "text" },
      description: { label: "Description", required: false, type: "text" },
      maxParticipants: { label: "Maximum Participants", required: false, type: "number" },
      registrationRequired: { label: "Registration Required", required: false, type: "boolean" },
      registrationDeadline: { label: "Registration Deadline", required: false, type: "date" },
    },
  },
  // Verified against app/api/admin/students/route.js's POST body check —
  // displayName/email/phone/courseId/password all throw when missing.
  // Student ID is server-generated (nextStudentCode), never asked for.
  CREATE_STUDENT: {
    label: "Create Student",
    allowedRoles: ["Admin", "Director"],
    fields: {
      displayName: { label: "Full Name", required: true, type: "text" },
      email: { label: "Email", required: true, type: "text" },
      phone: { label: "Phone", required: true, type: "text" },
      course: { label: "Course/Enrollment", required: true, type: "entity:course" },
      password: { label: "Initial Password", required: true, type: "text" },
    },
  },
  // Verified against app/api/admin/teachers/route.js (built alongside this
  // schema — no prior teacher-creation endpoint existed at all). Teacher ID
  // is server-generated (nextTeacherCode) the same way Student ID is.
  CREATE_TEACHER: {
    label: "Create Teacher",
    allowedRoles: ["Admin", "Director"],
    fields: {
      displayName: { label: "Full Name", required: true, type: "text" },
      email: { label: "Email", required: true, type: "text" },
      phone: { label: "Phone", required: true, type: "text" },
      department: { label: "Department", required: true, type: "text" },
      designation: { label: "Designation", required: true, type: "text" },
      joiningDate: { label: "Joining Date", required: true, type: "date" },
      status: { label: "Status", required: true, type: "enum", options: ["Active", "Inactive"] },
      password: { label: "Initial Password", required: true, type: "text" },
      qualification: { label: "Qualification", required: false, type: "text" },
      experience: { label: "Experience", required: false, type: "text" },
      specialization: { label: "Specialization", required: false, type: "text" },
    },
  },
  // Verified against app/api/admin/teacher-assignments/route.js's PATCH:
  // the real model is a flat teacherIds array on the class/course doc, with
  // NO per-assignment metadata at all. Only Teacher + Course + Batch map to
  // anything actually persisted — Start Date / Assignment Role / End Date /
  // Notes were dropped entirely (not merely marked optional) rather than
  // collecting information the database has nowhere to put.
  TEACHER_ASSIGNMENT: {
    label: "Teacher Assignment",
    allowedRoles: ["Admin", "Director"],
    fields: {
      teacher: { label: "Teacher", required: true, type: "entity:teacher" },
      course: { label: "Course", required: true, type: "entity:course" },
      batch: { label: "Class/Batch", required: true, type: "entity:class" },
    },
  },
  // Verified against app/api/admin/enrollments/route.js and
  // app/api/teacher/enrollments/route.js's POST: both need only
  // courseId + studentId — the class/batch is derived automatically from
  // the course's primaryClassId, so it's accepted if mentioned but never
  // required.
  STUDENT_ENROLLMENT: {
    label: "Student Enrollment",
    allowedRoles: ["Admin", "Director", "Teacher"],
    fields: {
      student: { label: "Student", required: true, type: "entity:student" },
      course: { label: "Course", required: true, type: "entity:course" },
      batch: { label: "Class/Batch", required: false, type: "entity:class" },
    },
  },
};

export function getAction(actionId) {
  return ACTIONS[actionId] || null;
}
export function requiredFieldKeys(actionId) {
  const action = getAction(actionId);
  if (!action) return [];
  return Object.entries(action.fields).filter(([, def]) => def.required).map(([key]) => key);
}
export function optionalFieldKeys(actionId) {
  const action = getAction(actionId);
  if (!action) return [];
  return Object.entries(action.fields).filter(([, def]) => !def.required).map(([key]) => key);
}
