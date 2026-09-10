"use client";

// The ONLY place the AI Assistant actually touches Firebase — and even
// here, it never writes directly. Every branch calls the exact same
// already-secured API route the corresponding existing UI screen calls
// (training-service/student-service/teacher-service/event-service/
// enrollment-service/teacher-assignment-service), so every one of that
// route's server-side auth/role/validation checks still applies
// independently of anything the assistant itself decided. Spec section 16.
import { createCourse } from "../services/training-service";
import { createStudent } from "../services/student-service";
import { createTeacher } from "../services/teacher-service";
import { createEvent } from "../services/event-service";
import { enrollStudent } from "../services/enrollment-service";
import { teacherEnrollStudent } from "../services/teacher-enrollment-service";
import { saveTeacherAssignment } from "../services/teacher-assignment-service";

// Converts resolved assistant values (entity fields are {id,label,raw})
// into the literal payload shape each existing endpoint expects.
export async function executeAction(actionId, values, context) {
  if (actionId === "CREATE_COURSE") {
    const result = await createCourse({
      title: values.name,
      description: values.description || "",
      status: values.status,
      category: values.category,
      level: "",
      thumbnailUrl: "",
      thumbnailPath: "",
      price: values.price || 0,
      discountPrice: null,
      currency: "SGD",
      startDate: values.startDate || "",
      endDate: values.endDate || "",
      startTime: "",
      endTime: "",
      classFrequency: "",
      totalClasses: "",
      duration: values.duration,
      campus: "",
      building: "",
      room: "",
      floor: "",
      batchName: "",
      maxStudents: values.capacity || "",
      seatCapacity: "",
      enrollmentStartDate: "",
      enrollmentDeadline: "",
      enrollmentStatus: "Open",
      passingScore: "",
      certificateEnabled: false,
      certificateMinAttendance: "",
      certificateMinScore: "",
      primaryTeacherId: values.instructor?.id || "",
      assistantTeacherId: "",
    });
    return { entityId: result.course?.id, entity: "courses" };
  }

  if (actionId === "CREATE_STUDENT") {
    const result = await createStudent({ displayName: values.displayName, email: values.email, phone: values.phone, courseId: values.course.id, password: values.password });
    return { entityId: result.uid, entity: "users", extra: { studentId: result.studentId } };
  }

  if (actionId === "CREATE_TEACHER") {
    const result = await createTeacher({
      displayName: values.displayName,
      email: values.email,
      phone: values.phone,
      department: values.department,
      designation: values.designation,
      joiningDate: values.joiningDate,
      status: values.status,
      password: values.password,
      qualification: values.qualification || "",
      experience: values.experience || "",
      specialization: values.specialization || "",
    });
    return { entityId: result.uid, entity: "users", extra: { teacherId: result.teacherId } };
  }

  if (actionId === "CREATE_EVENT") {
    const result = await createEvent({
      name: values.name,
      type: values.type,
      description: values.description || "",
      eventDate: values.eventDate,
      startTime: values.startTime,
      endTime: values.endTime,
      location: values.location,
      organizer: values.organizer,
      organizerId: "",
      maxParticipants: values.maxParticipants ?? "",
      targetAudience: [],
      registrationRequired: Boolean(values.registrationRequired),
      registrationDeadline: values.registrationDeadline || "",
      status: values.status || "",
      published: true,
    });
    return { entityId: result.event?.id, entity: "academyEvents" };
  }

  if (actionId === "STUDENT_ENROLLMENT") {
    if (context.role === "Teacher") await teacherEnrollStudent(values.course.id, values.student.id);
    else await enrollStudent(values.course.id, values.student.id);
    return { entityId: `${values.course.id}_${values.student.id}`, entity: "enrollments" };
  }

  if (actionId === "TEACHER_ASSIGNMENT") {
    const existing = values.batch.raw?.teacherIds || [];
    const teacherIds = [...new Set([...existing, values.teacher.id])];
    await saveTeacherAssignment({ type: "class", id: values.batch.id, teacherIds });
    return { entityId: values.batch.id, entity: "classes" };
  }

  throw new Error("Unknown action.");
}
