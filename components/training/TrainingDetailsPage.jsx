"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useAuth } from "../../lib/auth-context";
import {
  listClassEnrollments,
  saveAttendance,
  subscribeTeacherCourseAttendance,
  subscribeTeacherCourseClasses,
} from "../../lib/teacher-data";
import {
  loadUsersByIds,
  subscribeClassAttendance,
  subscribeCourse,
  subscribeCourseClasses,
} from "../../lib/training-detail";
import { updateCourse } from "../../lib/services/training-service";
import { attendancePercent } from "../../lib/attendance";
import { loadTeacherAssignmentData } from "../../lib/services/teacher-assignment-service";
import { loadEnrollments } from "../../lib/services/enrollment-service";
import { loadTeacherEnrollments } from "../../lib/services/teacher-enrollment-service";
import {
  createAssessment,
  subscribeCourseAssessments,
} from "../../lib/teacher-assessments";
import { stopEnterSubmit } from "../../lib/ui/keyboard";
import { TeacherShell } from "../TeacherWorkspacePage";
import DirectorShell from "../dashboard/DirectorShell";
import AdminShell from "../dashboard/AdminShell";
import EnrollmentManager from "./EnrollmentManager";

// Same Admin/Director module list used by app/dashboard/[role]/page.jsx's
// roleConfig.Director/Admin — duplicated here (a static, rarely-changing
// sidebar list) rather than importing from that page module, matching how
// Teacher's own sidebar list is already independently defined in
// TeacherWorkspacePage.js.
const managerModules = [
  "Dashboard",
  "Students",
  "Teacher",
  "Training",
  "Event",
  "Finance",
  "Documents",
  "Gift",
  "User",
  "Chat",
  "Achievement",
  "ID Card",
  "Scan QR Code",
];

const managerTabs = [
  "Overview",
  "Teachers",
  "Classes",
  "Students",
  "Attendance",
  "Modules & Lessons",
  "Materials",
  "Assign",
];
const teacherTabs = [
  "Overview",
  "Students",
  "Classes",
  "Attendance",
  "Assessment",
];

function Empty({ children }) {
  return (
    <div className="rounded-2xl border border-dashed border-border-subtle bg-white p-8 text-center text-sm text-muted">
      {children}
    </div>
  );
}
function Panel({ title, children, action }) {
  return (
    <section className="rounded-3xl border border-border-subtle bg-white p-7 shadow-sm">
      <div className="mb-5 flex items-center justify-between gap-3">
        <h2 className="font-bold text-ink">{title}</h2>
        {action}
      </div>
      {children}
    </section>
  );
}
function Field({ label, value }) {
  return (
    <div>
      <dt className="text-[10px] font-bold uppercase tracking-wider text-subtle">
        {label}
      </dt>
      <dd className="mt-1 text-sm text-ink">{value || "—"}</dd>
    </div>
  );
}
const formatDate = (value) =>
  value ? new Date(value).toLocaleDateString() : "—";
const friendlyError = (err) =>
  err?.code === "permission-denied"
    ? "You do not have access to this training."
    : err?.message || "Unable to load this training.";

export default function TrainingDetailsPage() {
  const { user, profile, loading: authLoading, logout } = useAuth();
  const { courseId } = useParams();
  const [tab, setTab] = useState("Overview");
  const [course, setCourse] = useState(null);
  const [classes, setClasses] = useState([]);
  const [enrollments, setEnrollments] = useState([]);
  const [students, setStudents] = useState([]);
  const [attendance, setAttendance] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const canManage = profile?.role === "Admin" || profile?.role === "Director";
  const isAssignedTeacher =
    profile?.role === "Teacher" && course?.teacherIds?.includes(user?.uid);
  const allowed = canManage || isAssignedTeacher;
  const tabs = canManage ? managerTabs : teacherTabs;

  useEffect(() => {
    if (!courseId) return undefined;
    const fail = (err) => {
      console.error("[training-details] load failed", err);
      setError(friendlyError(err));
      setLoading(false);
    };
    return subscribeCourse(
      courseId,
      (item) => {
        setCourse(item);
        setLoading(false);
      },
      fail,
    );
  }, [courseId]);

  // Classes must be queried differently per role: the `classes` security
  // rule for a Teacher checks resource.data.teacherIds — a field that isn't
  // part of a plain `where("courseId","==",courseId)` filter, so Firestore
  // rejects that whole list query for a Teacher even though the actual
  // class document would individually pass the rule. Admin/Director aren't
  // affected (their `admin()` rule branch doesn't depend on per-document
  // data), so only the Teacher path needs the teacherIds-filtered query —
  // reusing the exact helper TeacherCoursePage.js already uses successfully.
  useEffect(() => {
    if (!courseId || authLoading || !profile?.role) return undefined;
    const fail = (err) =>
      console.error("[training-details] classes load failed", err);
    if (profile.role === "Teacher") {
      return subscribeTeacherCourseClasses(
        user?.uid,
        courseId,
        setClasses,
        fail,
      );
    }
    return subscribeCourseClasses(courseId, setClasses, fail);
  }, [courseId, authLoading, profile?.role, user?.uid]);

  // Legacy trainings (created before classes were auto-created) can have
  // teacherIds but no linked class yet. Poking either enrollment endpoint
  // once self-heals that — see ensurePrimaryClass in lib/server/enrollment-
  // core.js — regardless of which tab the teacher happens to open first.
  useEffect(() => {
    if (!course?.id || !profile?.role) return;
    const loader = canManage
      ? loadEnrollments
      : profile.role === "Teacher"
        ? loadTeacherEnrollments
        : null;
    loader?.(course.id).catch(() => {});
  }, [course?.id, profile?.role, canManage]);

  const classIds = useMemo(() => classes.map((item) => item.id), [classes]);

  useEffect(() => {
    let cancelled = false;
    async function loadClassEnrollments() {
      if (!classIds.length) {
        setEnrollments([]);
        return;
      }
      const groups = await Promise.all(
        classIds.map((id) => listClassEnrollments(id)),
      );
      if (!cancelled)
        setEnrollments(
          groups.flat().filter((item) => item.status !== "withdrawn"),
        );
    }
    loadClassEnrollments();
    return () => {
      cancelled = true;
    };
  }, [classIds]);

  useEffect(() => {
    let cancelled = false;
    const studentIds = enrollments
      .map((item) => item.studentId)
      .filter(Boolean);
    loadUsersByIds(studentIds).then((rows) => {
      if (!cancelled) setStudents(rows);
    });
    return () => {
      cancelled = true;
    };
  }, [enrollments]);

  // Same rule-vs-query-shape issue as classes above: the attendance rule
  // checks resource.data.teacherId, not classId, so a Teacher's list query
  // must filter on teacherId+courseId (the already-proven pattern) rather
  // than classId alone.
  useEffect(() => {
    if (authLoading || !profile?.role) return undefined;
    if (profile.role === "Teacher") {
      if (!user?.uid || !courseId) return undefined;
      return subscribeTeacherCourseAttendance(
        user.uid,
        courseId,
        setAttendance,
        () => {},
      );
    }
    return subscribeClassAttendance(classIds, setAttendance, () => {});
  }, [classIds, authLoading, profile?.role, user?.uid, courseId]);

  const body = (
    <div className=" px-2 ">
      <Link
        href={
          profile?.role === "Teacher"
            ? "/teacher/training"
            : `/dashboard/${(profile?.role || "admin").toLowerCase()}`
        }
        className="mb-6 inline-block text-xs font-semibold text-primary"
      >
        ← Back to Training
      </Link>
      {authLoading || loading ? (
        <div className="mt-6">
          <Empty>Loading training...</Empty>
        </div>
      ) : error ? (
        <div className="mt-6">
          <Empty>{error}</Empty>
        </div>
      ) : !course ? (
        <div className="mt-6">
          <Empty>Training not found</Empty>
        </div>
      ) : !allowed ? (
        <div className="mt-6">
          <Empty>You do not have access to this training.</Empty>
        </div>
      ) : (
        <>
          <header className="rounded-3xl border border-[#f3aaaa] bg-[linear-gradient(120deg,#fff0f0_0%,#fff7f7_45%,#ffffff_100%)] p-6 text-ink shadow-xl">
            <p className="font-mono text-[10px] uppercase tracking-widest text-primary">
              {course.courseCode || course.id} · Offline Training
            </p>
            <h1 className="mt-2 text-3xl font-black md:text-5xl">
              {course.title}
            </h1>
            <p className="mt-2 max-w-2xl text-sm text-muted">
              {course.description || "No description available."}
            </p>
          </header>

          <nav className="my-5 flex gap-2 overflow-x-auto rounded-2xl border border-border-subtle bg-white p-1.5 shadow-sm">
            {tabs.map((item) => (
              <button
                key={item}
                type="button"
                onClick={() => setTab(item)}
                className={`shrink-0 rounded-xl px-3 py-1.5 text-xs font-bold ${tab === item ? "bg-primary text-white" : "text-muted hover:bg-active"}`}
              >
                {item}
              </button>
            ))}
          </nav>

          {tab === "Overview" && (
            <Panel title="Overview">
              <dl className="grid gap-x-12 gap-y-6 sm:grid-cols-3">
                <Field label="Status" value={course.status} />
                <Field label="Category" value={course.category} />
                <Field label="Level" value={course.level} />
                <Field label="Training Type" value="Offline" />
                <Field
                  label="Start / End Date"
                  value={`${formatDate(course.startDate)} – ${formatDate(course.endDate)}`}
                />
                <Field
                  label="Time"
                  value={
                    course.startTime && course.endTime
                      ? `${course.startTime}–${course.endTime}`
                      : "—"
                  }
                />
                <Field label="Duration" value={course.duration} />
                <Field label="Class Frequency" value={course.classFrequency} />
                <Field label="Total Classes" value={course.totalClasses} />
                <Field
                  label="Campus / Building"
                  value={[course.campus, course.building]
                    .filter(Boolean)
                    .join(", ")}
                />
                <Field
                  label="Room / Floor"
                  value={[course.room, course.floor].filter(Boolean).join(", ")}
                />
                <Field label="Batch Name" value={course.batchName} />
                <Field
                  label="Max Students / Seat Capacity"
                  value={`${course.maxStudents ?? "—"} / ${course.seatCapacity ?? "—"}`}
                />
                <Field
                  label="Enrollment Window"
                  value={`${formatDate(course.enrollmentStartDate)} – ${formatDate(course.enrollmentDeadline)}`}
                />
                <Field
                  label="Enrollment Status"
                  value={course.enrollmentStatus}
                />
                <Field label="Passing Score" value={course.passingScore} />
                <Field
                  label="Certificate"
                  value={
                    course.certificateEnabled
                      ? `Enabled (min ${course.certificateMinAttendance ?? 0}% attendance, ${course.certificateMinScore ?? 0} score)`
                      : "Disabled"
                  }
                />
              </dl>
            </Panel>
          )}

          {tab === "Teachers" && <TeachersTab course={course} />}

          {tab === "Classes" && (
            <Panel title="Classes / Batches">
              {classes.length ? (
                <div className="grid gap-3 sm:grid-cols-2">
                  {classes.map((item, index) => (
                    <div
                      key={item.id}
                      className="rounded-2xl border border-border-subtle p-4"
                    >
                      <div className="flex items-center justify-between">
                        <b className="block text-sm">{item.name || "Batch"}</b>
                        <span className="text-[10px] font-bold uppercase tracking-wider text-subtle">
                          Class {index + 1}
                        </span>
                      </div>
                      <span className="text-xs text-muted">
                        {[item.campus, item.building, item.floor, item.room]
                          .filter(Boolean)
                          .join(", ") || "No room set"}
                      </span>
                      <p className="mt-2 text-xs text-muted">
                        {formatDate(item.startDate)} –{" "}
                        {formatDate(item.endDate)}
                        {item.startTime && item.endTime
                          ? ` · ${item.startTime}–${item.endTime}`
                          : ""}
                      </p>
                      <p className="mt-1 text-xs font-semibold text-muted">
                        {
                          enrollments.filter((e) => e.classId === item.id)
                            .length
                        }{" "}
                        student(s) enrolled
                        {item.maxStudents ? ` / max ${item.maxStudents}` : ""}
                      </p>
                    </div>
                  ))}
                </div>
              ) : (
                <Empty>No classes found for this training</Empty>
              )}
            </Panel>
          )}

          {tab === "Students" && (
            <Panel title="Students">
              <EnrollmentManager
                mode={canManage ? "manage" : "teacher"}
                courseId={course.id}
                courseTitle={course.title}
                courseCode={course.courseCode || course.id}
                attendance={attendance}
                classroomInfo={
                  canManage
                    ? undefined
                    : {
                        campus: course.campus,
                        building: course.building,
                        floor: course.floor,
                        room: course.room,
                        batchName: course.batchName,
                        schedule: course.classFrequency,
                      }
                }
              />
            </Panel>
          )}

          {tab === "Attendance" && (
            <AttendanceTab
              courseId={course.id}
              classes={classes}
              students={students}
              attendance={attendance}
              teacherId={user?.uid}
              canMark={isAssignedTeacher}
            />
          )}
          {tab === "Assessment" && (
            <AssessmentTab
              courseId={course.id}
              students={students}
              teacherId={user?.uid}
              classId={course.primaryClassId}
            />
          )}
          {tab === "Modules & Lessons" && (
            <Panel title="Modules & Lessons">
              <Empty>Content authoring is coming in a later update.</Empty>
            </Panel>
          )}
          {tab === "Materials" && (
            <Panel title="Materials">
              <Empty>Lesson materials are coming in a later update.</Empty>
            </Panel>
          )}
          {tab === "Assign" && canManage && <AssignTab course={course} />}
          {tab === "Assign" && !canManage && (
            <Panel title="Assign">
              <Empty>Only Admin or Director can reassign teachers.</Empty>
            </Panel>
          )}
        </>
      )}
    </div>
  );

  // -mx-4 cancels out the shell's own px-4 content padding so this page
  // alone sits flush to the shell's edges, without touching the shell
  // itself (every other page under that shell still relies on its px-4).
  const paddedBody = <div className="-mx-4">{body}</div>;

  if (profile?.role === "Teacher") {
    return <TeacherShell active="Training">{paddedBody}</TeacherShell>;
  }

  if (profile?.role === "Director") {
    const name = profile?.displayName || user?.displayName || user?.email?.split("@")[0] || "Director";
    return (
      <DirectorShell
        modules={managerModules}
        active="Training"
        getHref={() => "/dashboard/director"}
        name={name}
        initials={name.slice(0, 2).toUpperCase()}
        userEmail={user?.email}
        headerTitle="Training"
        headerSubtitle="Organization overview"
        onLogout={logout}
      >
        {paddedBody}
      </DirectorShell>
    );
  }

  if (profile?.role === "Admin") {
    const name = profile?.displayName || user?.displayName || user?.email?.split("@")[0] || "Member";
    return (
      <AdminShell
        role="Admin"
        modules={managerModules}
        active="Training"
        getHref={() => "/dashboard/admin"}
        name={name}
        initials={name.slice(0, 2).toUpperCase()}
        userEmail={user?.email}
        headerTitle="Training"
        onLogout={logout}
      >
        {paddedBody}
      </AdminShell>
    );
  }

  return (
    <main className="min-h-screen bg-page text-ink">{body}</main>
  );
}

function TeachersTab({ course }) {
  const [teacherRows, setTeacherRows] = useState([]);
  useEffect(() => {
    const ids = [course.primaryTeacherId, course.assistantTeacherId].filter(
      Boolean,
    );
    let cancelled = false;
    loadUsersByIds(ids).then((rows) => {
      if (!cancelled) setTeacherRows(rows);
    });
    return () => {
      cancelled = true;
    };
  }, [course.primaryTeacherId, course.assistantTeacherId]);
  const nameFor = (id) => {
    const teacher = teacherRows.find((item) => item.id === id);
    return (
      teacher?.displayName ||
      teacher?.email ||
      (id ? "Loading..." : "Not assigned")
    );
  };
  return (
    <Panel title="Teachers">
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="rounded-2xl bg-page p-4">
          <p className="text-[10px] font-bold uppercase tracking-wider text-subtle">
            Primary Teacher
          </p>
          <p className="mt-1 text-sm font-semibold">
            {nameFor(course.primaryTeacherId)}
          </p>
        </div>
        <div className="rounded-2xl bg-page p-4">
          <p className="text-[10px] font-bold uppercase tracking-wider text-subtle">
            Assistant Teacher
          </p>
          <p className="mt-1 text-sm font-semibold">
            {course.assistantTeacherId
              ? nameFor(course.assistantTeacherId)
              : "None"}
          </p>
        </div>
      </div>
      <p className="mt-4 text-xs text-muted">
        To change teachers, use the Assign tab.
      </p>
    </Panel>
  );
}

const attendanceStatuses = ["present", "absent", "late", "excused"];

function AttendanceTab({
  courseId,
  classes,
  students,
  attendance,
  teacherId,
  canMark,
}) {
  const [manualClassId, setManualClassId] = useState("");
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  // Derived, not synced via an effect: whenever `classes` loads or changes,
  // this simply falls back to the first class until the user manually picks
  // one — no setState-during-render/effect needed.
  const classId =
    manualClassId && classes.some((item) => item.id === manualClassId)
      ? manualClassId
      : classes[0]?.id || "";

  const rate = useMemo(() => {
    return students.reduce((result, student) => {
      result[student.id] = attendancePercent(
        attendance.filter((item) => item.studentId === student.id),
      );
      return result;
    }, {});
  }, [attendance, students]);

  // Most recently marked status per student (by date), so the summary
  // reflects what was just saved in plain words, not just a rolled-up rate.
  const latestStatus = useMemo(() => {
    return students.reduce((result, student) => {
      const records = attendance
        .filter((item) => item.studentId === student.id)
        .sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
      if (records.length) result[student.id] = records[0].status;
      return result;
    }, {});
  }, [attendance, students]);

  return (
    <Panel
      title="Attendance"
      action={
        canMark && (
          <div className="flex gap-2">
            <select
              value={classId}
              onChange={(event) => setManualClassId(event.target.value)}
              className="rounded-xl border border-border-subtle bg-page px-3 py-2 text-xs"
            >
              {classes.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name || item.id}
                </option>
              ))}
            </select>
            <input
              type="date"
              value={date}
              onChange={(event) => setDate(event.target.value)}
              onKeyDown={stopEnterSubmit}
              className="rounded-xl border border-border-subtle bg-page px-3 py-2 text-xs"
            />
          </div>
        )
      }
    >
      {!classes.length ? (
        <Empty>No classes found for this training</Empty>
      ) : !students.length ? (
        <Empty>No enrolled students found</Empty>
      ) : (
        <>
          {canMark && (
            <AttendanceMarkGrid
              key={`${classId}_${date}`}
              courseId={courseId}
              classId={classId}
              date={date}
              students={students}
              attendance={attendance}
              teacherId={teacherId}
            />
          )}
          <p className="mb-2 text-[10px] font-bold uppercase tracking-wider text-subtle">
            Attendance summary
          </p>
          <div className="space-y-2">
            {students.map((student) => {
              const status = latestStatus[student.id];
              const label = status
                ? status[0].toUpperCase() + status.slice(1)
                : "No attendance yet";
              return (
                <div
                  key={student.id}
                  className="flex items-center justify-between rounded-xl bg-page p-3 text-xs"
                >
                  <b>{student.displayName || student.email}</b>
                  <span className="font-bold text-primary">
                    {status && rate[student.id] != null
                      ? `${label} · ${rate[student.id]}%`
                      : label}
                  </span>
                </div>
              );
            })}
          </div>
        </>
      )}
    </Panel>
  );
}

// Keyed by `${classId}_${date}` from the parent so switching class/date
// remounts this component — that's what resets `statuses` to match the
// newly-selected class/date's existing records, without needing an effect.
function AttendanceMarkGrid({
  courseId,
  classId,
  date,
  students,
  attendance,
  teacherId,
}) {
  const [statuses, setStatuses] = useState(() => {
    const existing = {};
    attendance
      .filter((item) => item.classId === classId && item.date === date)
      .forEach((item) => {
        existing[item.studentId] = item.status;
      });
    return existing;
  });
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  async function save() {
    if (!classId || !date || !students.length) return;
    setSaving(true);
    setMessage("");
    try {
      await saveAttendance(
        teacherId,
        students.map((student) => ({
          id: `${classId}_${student.id}_${date}`,
          courseId,
          classId,
          studentId: student.id,
          date,
          status: statuses[student.id] || "present",
        })),
      );
      setMessage("Attendance saved.");
    } catch (error) {
      setMessage(error.message || "Unable to save attendance.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mb-5 space-y-2 border-b border-border-subtle pb-5">
      {students.map((student) => (
        <div
          key={student.id}
          className="flex items-center justify-between rounded-xl bg-page p-3 text-xs"
        >
          <b>{student.displayName || student.email}</b>
          <select
            value={statuses[student.id] || "present"}
            onChange={(event) =>
              setStatuses({ ...statuses, [student.id]: event.target.value })
            }
            className="rounded-lg border border-border-subtle bg-white px-2 py-2 capitalize"
          >
            {attendanceStatuses.map((status) => (
              <option key={status} value={status}>
                {status[0].toUpperCase() + status.slice(1)}
              </option>
            ))}
          </select>
        </div>
      ))}
      <div className="flex items-center justify-between pt-2">
        <button
          type="button"
          onClick={save}
          disabled={saving}
          className="rounded-xl bg-primary px-4 py-2.5 text-xs font-bold text-white disabled:opacity-40"
        >
          {saving ? "Saving..." : "Save Attendance"}
        </button>
        {message && <p className="text-xs text-muted">{message}</p>}
      </div>
    </div>
  );
}

const assessmentTypes = ["quiz", "assignment", "midterm", "final"];
const assessmentTypeLabels = {
  quiz: "Quiz",
  assignment: "Assignment",
  midterm: "Midterm Exam",
  final: "Final Exam",
};

function AssessmentTab({ courseId, students, teacherId, classId }) {
  const [records, setRecords] = useState([]);
  const [studentId, setStudentId] = useState("");
  const [type, setType] = useState("quiz");
  const [title, setTitle] = useState("");
  const [score, setScore] = useState("");
  const [maxScore, setMaxScore] = useState("100");
  const [passingScore, setPassingScore] = useState("60");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(
    () => subscribeCourseAssessments(teacherId, courseId, setRecords, () => {}),
    [teacherId, courseId],
  );

  const studentName = (id) =>
    students.find((item) => item.id === id)?.displayName ||
    students.find((item) => item.id === id)?.email ||
    id;

  async function save() {
    if (!studentId || !title) return;
    setSaving(true);
    setMessage("");
    try {
      await createAssessment(teacherId, {
        studentId,
        courseId,
        classId,
        type,
        title,
        score,
        maxScore,
        passingScore,
      });
      setTitle("");
      setScore("");
      setMessage("Assessment recorded.");
    } catch (error) {
      setMessage(error.message || "Unable to record assessment.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Panel title="Assessment">
      <div className="mb-5 grid gap-3 rounded-2xl bg-page p-4 sm:grid-cols-2">
        <label className="grid gap-1 text-xs font-bold text-muted">
          Student
          <select
            value={studentId}
            onChange={(event) => setStudentId(event.target.value)}
            className="rounded-xl border border-border-subtle px-3 py-2.5 text-sm"
          >
            <option value="">Choose student</option>
            {students.map((student) => (
              <option key={student.id} value={student.id}>
                {student.displayName || student.email}
              </option>
            ))}
          </select>
        </label>
        <label className="grid gap-1 text-xs font-bold text-muted">
          Type
          <select
            value={type}
            onChange={(event) => setType(event.target.value)}
            className="rounded-xl border border-border-subtle px-3 py-2.5 text-sm"
          >
            {assessmentTypes.map((item) => (
              <option key={item} value={item}>
                {assessmentTypeLabels[item]}
              </option>
            ))}
          </select>
        </label>
        <label className="col-span-full grid gap-1 text-xs font-bold text-muted">
          Title
          <input
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            onKeyDown={stopEnterSubmit}
            placeholder="e.g. Chapter 3 Quiz"
            className="rounded-xl border border-border-subtle px-3 py-2.5 text-sm font-normal"
          />
        </label>
        <label className="grid gap-1 text-xs font-bold text-muted">
          Score
          <input
            type="number"
            value={score}
            onChange={(event) => setScore(event.target.value)}
            onKeyDown={stopEnterSubmit}
            className="rounded-xl border border-border-subtle px-3 py-2.5 text-sm font-normal"
          />
        </label>
        <label className="grid gap-1 text-xs font-bold text-muted">
          Maximum Score
          <input
            type="number"
            value={maxScore}
            onChange={(event) => setMaxScore(event.target.value)}
            onKeyDown={stopEnterSubmit}
            className="rounded-xl border border-border-subtle px-3 py-2.5 text-sm font-normal"
          />
        </label>
        <label className="grid gap-1 text-xs font-bold text-muted">
          Passing Score
          <input
            type="number"
            value={passingScore}
            onChange={(event) => setPassingScore(event.target.value)}
            onKeyDown={stopEnterSubmit}
            className="rounded-xl border border-border-subtle px-3 py-2.5 text-sm font-normal"
          />
        </label>
        <div className="col-span-full flex items-center justify-between">
          <button
            type="button"
            onClick={save}
            disabled={saving || !studentId || !title}
            className="rounded-xl bg-primary px-4 py-2.5 text-xs font-bold text-white disabled:opacity-40"
          >
            {saving ? "Saving..." : "Record Assessment"}
          </button>
          {message && <p className="text-xs text-muted">{message}</p>}
        </div>
      </div>

      {records.length ? (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead className="border-b text-[10px] uppercase tracking-wider text-subtle">
              <tr>
                {["Student", "Type", "Title", "Score", "Passing", "Result"].map(
                  (label) => (
                    <th key={label} className="p-3">
                      {label}
                    </th>
                  ),
                )}
              </tr>
            </thead>
            <tbody>
              {records
                .slice()
                .sort(
                  (a, b) =>
                    (b.createdAt?.toMillis?.() || 0) -
                    (a.createdAt?.toMillis?.() || 0),
                )
                .map((record) => (
                  <tr
                    key={record.id}
                    className="border-b border-border-subtle text-xs"
                  >
                    <td className="p-3">{studentName(record.studentId)}</td>
                    <td className="p-3">
                      {assessmentTypeLabels[record.type] || record.type}
                    </td>
                    <td className="p-3">{record.title}</td>
                    <td className="p-3">
                      {record.score ?? "—"} / {record.maxScore ?? "—"}
                    </td>
                    <td className="p-3">{record.passingScore ?? "—"}</td>
                    <td className="p-3">
                      <span
                        className={`rounded-full px-2.5 py-1 text-[10px] font-bold ${record.status === "pass" ? "bg-success-soft text-success" : "bg-active text-primary"}`}
                      >
                        {record.status === "pass" ? "Pass" : "Fail"}
                      </span>
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      ) : (
        <Empty>No assessments recorded yet</Empty>
      )}
    </Panel>
  );
}

function AssignTab({ course }) {
  const [teachers, setTeachers] = useState([]);
  const [primaryTeacherId, setPrimaryTeacherId] = useState(
    course.primaryTeacherId || "",
  );
  const [assistantTeacherId, setAssistantTeacherId] = useState(
    course.assistantTeacherId || "",
  );
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    loadTeacherAssignmentData()
      .then((result) => setTeachers(result.teachers || []))
      .catch(() => {});
  }, []);

  async function save() {
    setSaving(true);
    setMessage("");
    try {
      await updateCourse({
        id: course.id,
        title: course.title,
        description: course.description,
        status: course.status,
        category: course.category,
        level: course.level,
        thumbnailUrl: course.thumbnailUrl,
        thumbnailPath: course.thumbnailPath,
        startDate: course.startDate,
        endDate: course.endDate,
        startTime: course.startTime,
        endTime: course.endTime,
        duration: course.duration,
        classFrequency: course.classFrequency,
        totalClasses: course.totalClasses,
        campus: course.campus,
        building: course.building,
        room: course.room,
        floor: course.floor,
        batchName: course.batchName,
        maxStudents: course.maxStudents,
        seatCapacity: course.seatCapacity,
        enrollmentStartDate: course.enrollmentStartDate,
        enrollmentDeadline: course.enrollmentDeadline,
        enrollmentStatus: course.enrollmentStatus,
        passingScore: course.passingScore,
        certificateEnabled: course.certificateEnabled,
        certificateMinAttendance: course.certificateMinAttendance,
        certificateMinScore: course.certificateMinScore,
        primaryTeacherId,
        assistantTeacherId,
      });
      setMessage("Teachers updated.");
    } catch (error) {
      setMessage(error.message || "Unable to update teachers.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Panel title="Assign Teachers">
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="grid gap-1 text-xs font-bold text-muted">
          Primary Teacher
          <select
            value={primaryTeacherId}
            onChange={(event) => setPrimaryTeacherId(event.target.value)}
            className="rounded-xl border border-border-subtle px-3 py-2.5 text-sm"
          >
            <option value="">Choose primary teacher</option>
            {teachers
              .filter((t) => t.id !== assistantTeacherId)
              .map((t) => (
                <option key={t.id} value={t.id}>
                  {t.displayName || t.email}
                </option>
              ))}
          </select>
        </label>
        <label className="grid gap-1 text-xs font-bold text-muted">
          Assistant Teacher (optional)
          <select
            value={assistantTeacherId}
            onChange={(event) => setAssistantTeacherId(event.target.value)}
            className="rounded-xl border border-border-subtle px-3 py-2.5 text-sm"
          >
            <option value="">None</option>
            {teachers
              .filter((t) => t.id !== primaryTeacherId)
              .map((t) => (
                <option key={t.id} value={t.id}>
                  {t.displayName || t.email}
                </option>
              ))}
          </select>
        </label>
      </div>
      <button
        type="button"
        onClick={save}
        disabled={saving || !primaryTeacherId}
        className="mt-4 rounded-xl bg-primary px-4 py-2.5 text-xs font-bold text-white disabled:opacity-40"
      >
        {saving ? "Saving..." : "Save assignment"}
      </button>
      {message && <p className="mt-3 text-xs text-muted">{message}</p>}
    </Panel>
  );
}
