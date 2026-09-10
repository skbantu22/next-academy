"use client";

// Live-data checks (spec sections 6/7's duplicate/business-rule checks) —
// run once all fields are present and locally valid, right before the
// confirmation summary is shown. Every read here goes through the exact
// same already-secured service functions the rest of the LMS UI uses.
import { studentApi } from "../services/student-service";
import { loadTeacherAssignmentData } from "../services/teacher-assignment-service";
import { loadTraining } from "../services/training-service";
import { loadEvents } from "../services/event-service";
import { loadEnrollments } from "../services/enrollment-service";
import { loadTeacherEnrollments } from "../services/teacher-enrollment-service";

const norm = (value) => (value || "").trim().toLowerCase();

export async function preflightCheck(actionId, values, context) {
  const warnings = [];
  const blockers = [];

  if (actionId === "CREATE_COURSE") {
    const { courses } = await loadTraining();
    // Course Code is server-generated (nextCourseCode) — never user input —
    // so there is nothing to duplicate-check there; only the name matters.
    if ((courses || []).some((c) => norm(c.title) === norm(values.name))) blockers.push(`A course named "${values.name}" already exists.`);
  }

  if (actionId === "CREATE_STUDENT") {
    const { students } = await studentApi();
    if ((students || []).some((s) => norm(s.email) === norm(values.email))) blockers.push(`A student with email "${values.email}" already exists.`);
  }

  if (actionId === "CREATE_TEACHER") {
    const { teachers } = await loadTeacherAssignmentData();
    if ((teachers || []).some((t) => norm(t.email) === norm(values.email))) blockers.push(`A teacher with email "${values.email}" already exists.`);
  }

  if (actionId === "CREATE_EVENT") {
    const { events } = await loadEvents();
    const conflict = (events || []).find(
      (event) =>
        event.eventDate === values.eventDate &&
        norm(event.location) === norm(values.location) &&
        event.startTime < values.endTime &&
        values.startTime < event.endTime,
    );
    if (conflict) blockers.push(`"${conflict.name}" is already scheduled at ${values.location} on ${values.eventDate} during an overlapping time.`);
    const sameName = (events || []).find((event) => event.eventDate === values.eventDate && norm(event.name) === norm(values.name));
    if (sameName) warnings.push(`An event named "${values.name}" already exists on this date.`);
  }

  if (actionId === "STUDENT_ENROLLMENT" && values.course?.id && values.student?.id) {
    const loader = context.role === "Teacher" ? loadTeacherEnrollments : loadEnrollments;
    const payload = await loader(values.course.id);
    const already = (payload.enrollments || []).some((e) => e.studentId === values.student.id);
    if (already) blockers.push(`${values.student.label} is already enrolled in ${values.course.label}.`);
    if (payload.capacity != null && payload.enrolledCount >= payload.capacity) blockers.push(`${values.course.label} is already full (${payload.enrolledCount}/${payload.capacity}).`);
  }

  if (actionId === "TEACHER_ASSIGNMENT" && values.batch?.id && values.teacher?.id) {
    const { classes, courses } = await loadTeacherAssignmentData();
    const batch = (classes || []).find((c) => c.id === values.batch.id);
    if (!batch) blockers.push("That batch could not be found.");
    else {
      if (values.course?.id && batch.courseId !== values.course.id) blockers.push(`${values.batch.label} does not belong to ${values.course.label}.`);
      if ((batch.teacherIds || []).includes(values.teacher.id)) blockers.push(`${values.teacher.label} is already assigned to ${values.batch.label}.`);
    }
    const teacherClassCount = (classes || []).filter((c) => (c.teacherIds || []).includes(values.teacher.id)).length;
    if (teacherClassCount >= 6) warnings.push(`${values.teacher.label} is already assigned to ${teacherClassCount} other batches — consider their workload.`);
    void courses;
  }

  return { blockers, warnings };
}
