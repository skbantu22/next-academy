"use client";

import { useEffect, useMemo, useState } from "react";
import { Mail, Phone } from "lucide-react";
import { loadTeacherAssignmentData, saveTeacherAssignment } from "../../lib/services/teacher-assignment-service";
import TeacherSelector from "./TeacherSelector";

function TeacherAvatar({ teacher, size = "h-12 w-12" }) {
  return teacher.photoURL ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={teacher.photoURL} alt={teacher.displayName || "Teacher"} className={`${size} shrink-0 rounded-full object-cover`} />
  ) : (
    <span className={`grid ${size} shrink-0 place-items-center rounded-full bg-active text-sm font-bold text-primary`}>
      {(teacher.displayName || teacher.email || "?").slice(0, 2).toUpperCase()}
    </span>
  );
}

function TeacherCard({ teacher, courseCount, classCount }) {
  return (
    <article className="rounded-2xl border border-border-subtle bg-white p-4 shadow-sm">
      <div className="flex items-center gap-3">
        <TeacherAvatar teacher={teacher} />
        <div className="min-w-0">
          <b className="block truncate text-sm text-ink">{teacher.displayName || "Unnamed teacher"}</b>
          <span className="block truncate text-xs text-muted">{teacher.userId || "—"}</span>
        </div>
      </div>
      <div className="mt-3 space-y-1.5 text-xs text-muted">
        {teacher.email && (
          <p className="flex items-center gap-1.5 truncate">
            <Mail className="h-3.5 w-3.5 shrink-0 text-subtle" aria-hidden="true" />
            {teacher.email}
          </p>
        )}
        {teacher.phone && (
          <p className="flex items-center gap-1.5 truncate">
            <Phone className="h-3.5 w-3.5 shrink-0 text-subtle" aria-hidden="true" />
            {teacher.phone}
          </p>
        )}
        {(teacher.designation || teacher.department) && (
          <p className="truncate">{[teacher.designation, teacher.department].filter(Boolean).join(" · ")}</p>
        )}
      </div>
      <div className="mt-3 flex gap-2 border-t border-border-subtle pt-3 text-[10px] font-bold uppercase tracking-wider text-subtle">
        <span className="rounded-full bg-page px-2.5 py-1">{courseCount} course{courseCount === 1 ? "" : "s"}</span>
        <span className="rounded-full bg-page px-2.5 py-1">{classCount} class{classCount === 1 ? "" : "es"}</span>
      </div>
    </article>
  );
}

export default function TeacherAssignment() {
  const [data, setData] = useState({ teachers: [], courses: [], classes: [] });
  const [type, setType] = useState("course");
  const [selectedId, setSelectedId] = useState("");
  const [teacherIds, setTeacherIds] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  async function load() {
    setLoading(true);
    try {
      setData(await loadTeacherAssignmentData());
      setError("");
    } catch (e) {
      setError(e.message || "Unable to load teacher assignments.");
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => { void Promise.resolve().then(load); }, []);

  const records = type === "course" ? data.courses : data.classes;
  const selected = useMemo(() => records.find((item) => item.id === selectedId), [records, selectedId]);

  // Real assignment counts per teacher, derived from the same courses/
  // classes already loaded here — nothing invented or separately fetched.
  const assignmentCounts = useMemo(() => {
    const counts = new Map();
    for (const teacher of data.teachers) {
      counts.set(teacher.id, {
        courses: data.courses.filter((course) => (course.teacherIds || []).includes(teacher.id)).length,
        classes: data.classes.filter((cls) => (cls.teacherIds || []).includes(teacher.id)).length,
      });
    }
    return counts;
  }, [data.teachers, data.courses, data.classes]);

  function choose(id) {
    setSelectedId(id);
    setTeacherIds(records.find((item) => item.id === id)?.teacherIds || []);
    setNotice("");
  }
  async function save() {
    if (!selected) return;
    setSaving(true);
    try {
      await saveTeacherAssignment({ type, id: selected.id, teacherIds });
      setNotice("Teacher assignments saved.");
      await load();
    } catch (e) {
      setError(e.message || "Unable to save teacher assignments.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <section className="rounded-3xl border border-[#f3aaaa] bg-[linear-gradient(120deg,#fff0f0_0%,#fff7f7_45%,#ffffff_100%)] p-6 text-ink shadow-xl">
        <h2 className="text-3xl font-black">Teacher Assignment</h2>
        <p className="mt-2 text-sm text-muted">Assign real teacher accounts to existing courses and classes.</p>
      </section>

      {error && <p className="rounded-xl bg-active p-4 text-sm text-primary">{error}</p>}
      {notice && <p className="rounded-xl bg-success-soft p-4 text-sm text-success">{notice}</p>}

      <section className="rounded-3xl border border-border-subtle bg-white p-5 shadow-sm md:p-6">
        <h3 className="mb-1 font-bold text-ink">Teacher Directory</h3>
        <p className="mb-4 text-xs text-muted">Every active teacher account, with their real profile and current course/class load.</p>
        {loading ? (
          <p className="py-6 text-center text-sm text-muted">Loading teachers...</p>
        ) : data.teachers.length ? (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {data.teachers.map((teacher) => (
              <TeacherCard
                key={teacher.id}
                teacher={teacher}
                courseCount={assignmentCounts.get(teacher.id)?.courses || 0}
                classCount={assignmentCounts.get(teacher.id)?.classes || 0}
              />
            ))}
          </div>
        ) : (
          <p className="py-6 text-center text-sm text-muted">No active teacher accounts exist yet.</p>
        )}
      </section>

      {loading ? (
        <p className="py-10 text-center text-sm text-muted">Loading assignments...</p>
      ) : (
        <section className="grid gap-5 rounded-3xl border border-border-subtle bg-white p-5 shadow-sm lg:grid-cols-2">
          <div>
            <div className="mb-4 flex gap-2">
              <button onClick={() => { setType("course"); choose(""); }} className={`rounded-xl px-3 py-2 text-xs font-bold ${type === "course" ? "bg-primary text-white" : "bg-page"}`}>Courses</button>
              <button onClick={() => { setType("class"); choose(""); }} className={`rounded-xl px-3 py-2 text-xs font-bold ${type === "class" ? "bg-primary text-white" : "bg-page"}`}>Classes</button>
            </div>
            <label className="grid gap-1 text-xs font-semibold text-muted">
              Select {type}
              <select value={selectedId} onChange={(e) => choose(e.target.value)} className="rounded-xl border border-border-subtle bg-page px-3 py-2.5 text-sm">
                <option value="">Choose an existing {type}</option>
                {records.map((item) => <option key={item.id} value={item.id}>{item.title || item.name}{type === "class" && item.courseId ? ` · ${item.courseId}` : ""}</option>)}
              </select>
            </label>
            {!records.length && <p className="mt-4 text-sm text-muted">No {type} records exist yet.</p>}
          </div>
          <div>
            {selected ? (
              <>
                <h3 className="mb-3 font-bold">Assigned teachers</h3>
                <TeacherSelector teachers={data.teachers} selectedIds={teacherIds} onChange={setTeacherIds} />
                <button disabled={saving} onClick={save} className="mt-4 rounded-xl bg-primary px-4 py-3 text-xs font-bold text-white disabled:opacity-60">{saving ? "Saving..." : "Save assignments"}</button>
              </>
            ) : (
              <p className="py-10 text-center text-sm text-muted">Choose a {type} to view or change its teachers.</p>
            )}
          </div>
        </section>
      )}
    </div>
  );
}
