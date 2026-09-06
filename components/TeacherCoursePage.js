"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import TeacherGate from "./TeacherGate";
import { useAuth } from "../lib/auth-context";
import {
  listClassEnrollments,
  saveAttendance,
  subscribeTeacherCourse,
  subscribeTeacherCourseAttendance,
  subscribeTeacherCourseClasses,
  subscribeTeacherStudents,
} from "../lib/teacher-data";

function Empty({ children }) {
  return (
    <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-center text-sm text-slate-500">
      {children}
    </div>
  );
}

export default function TeacherCoursePage() {
  const { user } = useAuth();
  const { courseId } = useParams();
  const [course, setCourse] = useState(null);
  const [classes, setClasses] = useState([]);
  const [students, setStudents] = useState([]);
  const [enrolledIds, setEnrolledIds] = useState([]);
  const [attendance, setAttendance] = useState([]);
  const [selectedClassId, setSelectedClassId] = useState("");
  const [statuses, setStatuses] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (!user?.uid || !courseId) return undefined;
    const fail = (firebaseError) => {
      console.error("[teacher-course] load failed", firebaseError);
      setError(firebaseError?.message || "Unable to load course data.");
      setLoading(false);
    };
    const unsubscribers = [
      subscribeTeacherCourse(user.uid, courseId, setCourse, fail),
      subscribeTeacherCourseClasses(
        user.uid,
        courseId,
        (items) => {
          setClasses(items);
          setSelectedClassId((current) => current || items[0]?.id || "");
          setLoading(false);
        },
        fail,
      ),
      subscribeTeacherStudents(user.uid, (items) => setStudents(items), fail),
      subscribeTeacherCourseAttendance(user.uid, courseId, setAttendance, fail),
    ];
    return () => unsubscribers.forEach((unsubscribe) => unsubscribe());
  }, [courseId, user?.uid]);

  useEffect(() => {
    let cancelled = false;
    async function loadEnrollments() {
      if (!classes.length) {
        setEnrolledIds([]);
        return;
      }
      try {
        const enrollmentGroups = await Promise.all(
          classes.map((item) => listClassEnrollments(item.id)),
        );
        if (!cancelled)
          setEnrolledIds([
            ...new Set(
              enrollmentGroups
                .flat()
                .filter(
                  (item) =>
                    item.courseId === courseId && item.status !== "withdrawn",
                )
                .map((item) => item.studentId),
            ),
          ]);
      } catch (loadError) {
        if (!cancelled) {
          console.error("[teacher-course] enrollment load failed", loadError);
          setError(loadError.message || "Unable to load course enrollments.");
        }
      }
    }
    loadEnrollments();
    return () => {
      cancelled = true;
    };
  }, [classes, courseId]);

  const enrolledStudents = useMemo(
    () => students.filter((student) => enrolledIds.includes(student.id)),
    [enrolledIds, students],
  );
  const selectedClass = classes.find((item) => item.id === selectedClassId);
  const selectedDate =
    selectedClass?.date ||
    selectedClass?.startsAt?.toDate?.()?.toISOString?.().slice(0, 10) ||
    "";

  const attendanceByStudent = useMemo(() => {
    return enrolledStudents.reduce((result, student) => {
      const records = attendance.filter(
        (item) => item.studentId === student.id,
      );
      const present = records.filter((item) =>
        ["present", "late"].includes(item.status),
      ).length;
      result[student.id] = classes.length
        ? Math.round((present / classes.length) * 100)
        : null;
      return result;
    }, {});
  }, [attendance, classes.length, enrolledStudents]);

  async function saveSelectedAttendance() {
    if (!selectedClassId || !selectedDate || !enrolledStudents.length) return;
    setMessage("");
    try {
      await saveAttendance(
        user.uid,
        enrolledStudents.map((student) => ({
          id: `${courseId}_${selectedClassId}_${student.id}_${selectedDate}`,
          courseId,
          classId: selectedClassId,
          studentId: student.id,
          date: selectedDate,
          status: statuses[student.id] || "present",
        })),
      );
      setMessage("Attendance saved for this course session.");
    } catch (saveError) {
      setError(saveError.message || "Unable to save attendance.");
    }
  }

  return (
    <TeacherGate>
      <main className="min-h-screen bg-slate-100 text-slate-800">
        <div className="mx-auto max-w-6xl p-4 md:p-8">
          <Link
            href="/teacher/training"
            className="text-xs font-semibold text-red-600"
          >
            ← Back to my courses
          </Link>
          {loading ? (
            <div className="mt-6">
              <Empty>Loading course data...</Empty>
            </div>
          ) : error ? (
            <div className="mt-6">
              <Empty>{error}</Empty>
            </div>
          ) : !course ? (
            <div className="mt-6">
              <Empty>No course found</Empty>
            </div>
          ) : (
            <>
              <header className="mt-5 rounded-3xl bg-gradient-to-r from-slate-900 to-red-950 p-6 text-white shadow-xl md:p-8">
                <p className="font-mono text-[10px] uppercase tracking-widest text-red-300">
                  Teacher course
                </p>
                <h1 className="mt-3 text-3xl font-black md:text-5xl">
                  {course.title}
                </h1>
                <p className="mt-3 max-w-2xl text-sm text-slate-300">
                  {course.description || "No course description available."}
                </p>
              </header>
              <nav className="my-5 flex gap-2 overflow-x-auto rounded-2xl border border-slate-200 bg-white p-2 shadow-sm">
                <a
                  href="#overview"
                  className="rounded-xl bg-red-600 px-4 py-2 text-xs font-bold text-white"
                >
                  Overview
                </a>
                <a
                  href="#students"
                  className="rounded-xl px-4 py-2 text-xs font-bold text-slate-600 hover:bg-red-50"
                >
                  Students
                </a>
                <a
                  href="#sessions"
                  className="rounded-xl px-4 py-2 text-xs font-bold text-slate-600 hover:bg-red-50"
                >
                  Classes / Sessions
                </a>
                <a
                  href="#attendance"
                  className="rounded-xl px-4 py-2 text-xs font-bold text-slate-600 hover:bg-red-50"
                >
                  Attendance
                </a>
              </nav>
              <section id="overview" className="grid gap-4 md:grid-cols-3">
                <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                    Enrolled students
                  </span>
                  <strong className="mt-2 block text-3xl">
                    {enrolledStudents.length}
                  </strong>
                </article>
                <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                    Class sessions
                  </span>
                  <strong className="mt-2 block text-3xl">
                    {classes.length}
                  </strong>
                </article>
                <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                    Course status
                  </span>
                  <strong className="mt-2 block text-lg">
                    {course.status || "Not specified"}
                  </strong>
                </article>
              </section>
              <section
                id="students"
                className="mt-5 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm"
              >
                <h2 className="font-bold">Students enrolled in this course</h2>
                {enrolledStudents.length ? (
                  <div className="mt-4 grid gap-3 sm:grid-cols-2">
                    {enrolledStudents.map((student) => (
                      <div
                        key={student.id}
                        className="flex items-center justify-between rounded-2xl bg-slate-50 p-4"
                      >
                        <div>
                          <b className="block text-sm">
                            {student.displayName || "Unnamed student"}
                          </b>
                          <span className="text-xs text-slate-500">
                            {student.email || "No contact available"}
                          </span>
                        </div>
                        <span className="text-xs font-bold text-red-600">
                          {attendanceByStudent[student.id] == null
                            ? "No attendance"
                            : `${attendanceByStudent[student.id]}%`}
                        </span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="mt-4">
                    <Empty>No students enrolled in this course</Empty>
                  </div>
                )}
              </section>
              <section
                id="sessions"
                className="mt-5 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm"
              >
                <h2 className="font-bold">Classes / training sessions</h2>
                {classes.length ? (
                  <div className="mt-4 grid gap-3 sm:grid-cols-2">
                    {classes.map((item) => (
                      <button
                        key={item.id}
                        onClick={() => setSelectedClassId(item.id)}
                        className={`rounded-2xl border p-4 text-left ${selectedClassId === item.id ? "border-red-500 bg-red-50" : "border-slate-200"}`}
                      >
                        <b className="block text-sm">
                          {item.name || "Class session"}
                        </b>
                        <span className="text-xs text-slate-500">
                          {item.date ||
                            item.startsAt?.toDate?.()?.toLocaleDateString?.() ||
                            "Date not set"}{" "}
                          · {item.room || "Room not set"}
                        </span>
                      </button>
                    ))}
                  </div>
                ) : (
                  <div className="mt-4">
                    <Empty>No class sessions found for this course</Empty>
                  </div>
                )}
              </section>
              <section
                id="attendance"
                className="mt-5 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm"
              >
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h2 className="font-bold">Offline attendance</h2>
                    <p className="mt-1 text-xs text-slate-500">
                      {selectedClass
                        ? `${selectedClass.name || "Selected session"} · ${selectedDate || "Date not set"}`
                        : "Select a class session first."}
                    </p>
                  </div>
                  <button
                    disabled={!selectedClassId || !enrolledStudents.length}
                    onClick={saveSelectedAttendance}
                    className="rounded-xl bg-red-600 px-4 py-3 text-xs font-bold text-white disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    Save attendance
                  </button>
                </div>
                {message && (
                  <p className="mt-3 text-xs text-emerald-600">{message}</p>
                )}
                {selectedClassId && enrolledStudents.length ? (
                  <div className="mt-5 space-y-2">
                    {enrolledStudents.map((student) => (
                      <div
                        key={student.id}
                        className="flex items-center justify-between rounded-xl bg-slate-50 p-3 text-xs"
                      >
                        <b>{student.displayName || student.email}</b>
                        <select
                          value={statuses[student.id] || "present"}
                          onChange={(event) =>
                            setStatuses({
                              ...statuses,
                              [student.id]: event.target.value,
                            })
                          }
                          className="rounded-lg border border-slate-200 bg-white px-2 py-2"
                        >
                          <option value="present">Present</option>
                          <option value="absent">Absent</option>
                        </select>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="mt-5">
                    <Empty>
                      {selectedClassId
                        ? "No enrolled students"
                        : "Select a class session to mark attendance"}
                    </Empty>
                  </div>
                )}
              </section>
            </>
          )}
        </div>
      </main>
    </TeacherGate>
  );
}
