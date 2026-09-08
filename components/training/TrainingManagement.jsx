"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Eye, Pencil, Search } from "lucide-react";
import TrainingForm from "./TrainingForm";
import { createCourse, loadTraining, updateCourse } from "../../lib/services/training-service";

const blank = { title: "", description: "", status: "Draft", teacherIds: [] };
const formatDate = (value) =>
  value ? new Date(value).toLocaleDateString() : "—";

function Dialog({ title, children, close }) {
  return <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/60 p-4" role="dialog" aria-modal="true"><div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-3xl bg-white p-6 shadow-2xl"><div className="mb-5 flex justify-between"><h2 className="text-lg font-bold">{title}</h2><button onClick={close} className="text-xl text-slate-500" aria-label="Close">×</button></div>{children}</div></div>;
}
function Badge({ value }) {
  return <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-bold text-slate-700">{value || "—"}</span>;
}

export default function TrainingManagement({ role }) {
  const [data, setData] = useState({ courses: [], teachers: [], canManage: false });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("All");
  const [teacher, setTeacher] = useState("All");
  const [form, setForm] = useState(blank);
  const [editing, setEditing] = useState(null);
  const [saving, setSaving] = useState(false);
  const [viewing, setViewing] = useState(null);
  const isTeacher = role === "Teacher";

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const result = await loadTraining();
      setData(result);
      setError("");
    } catch (loadError) {
      console.error("[training] assigned course load failed", loadError);
      setData({ courses: [], teachers: [], canManage: false });
      setError(isTeacher ? "Failed to load your assigned courses." : (loadError.message || "Unable to load training data. Please try again."));
    } finally {
      setLoading(false);
    }
  }, [isTeacher]);

  useEffect(() => { void Promise.resolve().then(load); }, [load]);
  useEffect(() => {
    if (!notice) return undefined;
    const timer = setTimeout(() => setNotice(""), 4500);
    return () => clearTimeout(timer);
  }, [notice]);

  const courses = useMemo(() => data.courses.filter((course) =>
    (status === "All" || course.status === status) &&
    (teacher === "All" || course.teacherIds.includes(teacher)) &&
    `${course.courseCode || ""} ${course.id} ${course.title} ${course.teachers.map((item) => `${item.displayName} ${item.email}`).join(" ")}`.toLowerCase().includes(search.trim().toLowerCase()),
  ), [data.courses, search, status, teacher]);
  const counts = useMemo(() => ({
    total: data.courses.length,
    active: data.courses.filter((item) => item.status === "Active").length,
    upcoming: data.courses.filter((item) => item.status === "Upcoming").length,
    enrolled: data.courses.reduce((sum, item) => sum + Number(item.enrolled || 0), 0),
  }), [data.courses]);
  const statuses = ["All", ...new Set(data.courses.map((course) => course.status).filter(Boolean))];

  function open(course) {
    setEditing(course || null);
    setForm(course ? { title: course.title, description: course.description, status: course.status || "Draft", teacherIds: course.teacherIds } : { ...blank });
    setError("");
  }
  async function submit(event) {
    event.preventDefault();
    if (saving) return;
    setSaving(true);
    try {
      const result = editing ? await updateCourse({ id: editing.id, ...form }) : await createCourse(form);
      const created = result.course;
      const teacherNames = (created?.teacherIds || form.teacherIds).map((id) => data.teachers.find((item) => item.id === id)?.displayName || data.teachers.find((item) => item.id === id)?.email || id).join(", ") || "Not assigned";
      setNotice(created ? `Course Created Successfully — ${created.title} (Course ID: ${created.courseCode || created.id}; Teacher: ${teacherNames})` : "Course updated successfully.");
      setEditing(null);
      setForm(blank);
      await load();
    } catch (saveError) {
      setError(saveError.message || "Unable to save course.");
    } finally {
      setSaving(false);
    }
  }

  return <div className="space-y-6">
    <section className="flex flex-wrap items-center justify-between gap-4 rounded-3xl bg-gradient-to-r from-slate-900 to-red-950 p-6 text-white shadow-xl"><div><p className="text-[10px] font-bold uppercase tracking-widest text-red-300">{role} workspace</p><h2 className="mt-2 text-3xl font-black">Training</h2><p className="mt-2 text-sm text-slate-300">{isTeacher ? "Your assigned courses, classes, and enrolled students." : "Manage courses, teachers, classes, and enrolled students."}</p></div>{data.canManage && <button onClick={() => open(null)} className="rounded-xl bg-red-600 px-4 py-3 text-xs font-bold">Add Training</button>}</section>
    {notice && <p className="rounded-xl bg-emerald-50 p-4 text-sm text-emerald-700">{notice}</p>}
    {error && !editing && <p className="rounded-xl bg-red-50 p-4 text-sm text-red-700">{error}</p>}
    <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{[["Total Training", counts.total], ["Active", counts.active], ["Upcoming", counts.upcoming], ["Total Enrolled", counts.enrolled]].map(([label, value]) => <article key={label} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">{label}</p><p className="mt-2 text-2xl font-extrabold">{loading ? "—" : value}</p></article>)}</section>
    <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm md:p-6"><div className="mb-5 flex flex-wrap gap-3"><label className="relative min-w-56 flex-1"><Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400"/><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search course, ID, or teacher" className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2 pl-9 pr-3 text-sm"/></label><select value={status} onChange={(event) => setStatus(event.target.value)} className="rounded-xl border border-slate-200 px-3 py-2 text-sm">{statuses.map((item) => <option key={item}>{item}</option>)}</select>{data.canManage && <select value={teacher} onChange={(event) => setTeacher(event.target.value)} className="rounded-xl border border-slate-200 px-3 py-2 text-sm"><option value="All">All teachers</option>{data.teachers.map((item) => <option value={item.id} key={item.id}>{item.displayName || item.email || item.id}</option>)}</select>}</div>
      {loading ? <p className="py-10 text-center text-sm text-slate-500">{isTeacher ? "Loading assigned courses..." : "Loading training..."}</p> : courses.length ? <div className="overflow-x-auto"><table className="w-full min-w-[1100px] text-left text-sm"><thead className="border-b text-[10px] uppercase tracking-wider text-slate-400"><tr>{["Course ID", "Course Title", "Start", "End", "Duration", "Teacher", "Enrolled", "Classes", "Status", "Actions"].map((label) => <th key={label} className="p-3">{label}</th>)}</tr></thead><tbody>{courses.map((course) => <tr key={course.id} className="border-b border-slate-100"><td className="p-3 font-mono text-xs">{course.courseCode || course.id}</td><td className="p-3"><b>{course.title || "—"}</b><p className="max-w-sm truncate text-xs text-slate-500">{course.description || "—"}</p></td><td className="p-3">{formatDate(course.startDate)}</td><td className="p-3">{formatDate(course.endDate)}</td><td className="p-3">{course.duration || "—"}</td><td className="p-3">{course.teachers.length ? course.teachers.map((item) => item.displayName || item.email || item.id).join(", ") : "Not assigned"}</td><td className="p-3">{course.enrolled}</td><td className="p-3">{course.classCount}</td><td className="p-3"><Badge value={course.status}/></td><td className="space-x-3 p-3 text-xs font-bold"><button onClick={() => setViewing(course)} className="inline-flex items-center gap-1"><Eye className="h-3.5 w-3.5"/>View</button>{data.canManage && <button onClick={() => open(course)} className="inline-flex items-center gap-1 text-red-700"><Pencil className="h-3.5 w-3.5"/>Edit</button>}</td></tr>)}</tbody></table></div> : <p className="py-10 text-center text-sm text-slate-500">{search || status !== "All" || teacher !== "All" ? "No training programs match your search." : isTeacher ? "No courses have been assigned to you yet." : "No training programs found."}</p>}
    </section>
    {editing !== null && <Dialog title="Edit Training" close={() => !saving && setEditing(null)}><TrainingForm course={{ form, setForm, editing }} teachers={data.teachers} saving={saving} onCancel={() => setEditing(null)} onSubmit={submit}/>{error && <p className="mt-3 text-sm text-red-700">{error}</p>}</Dialog>}
    {editing === null && form !== blank && <Dialog title="Add Training" close={() => setForm(blank)}><TrainingForm course={{ form, setForm }} teachers={data.teachers} saving={saving} onCancel={() => setForm(blank)} onSubmit={submit}/></Dialog>}
    {viewing && <Dialog title="Course details" close={() => setViewing(null)}><dl className="grid gap-4 text-sm"><div><dt className="text-xs text-slate-400">COURSE ID</dt><dd>{viewing.courseCode || viewing.id}</dd></div><div><dt className="text-xs text-slate-400">DESCRIPTION</dt><dd>{viewing.description || "—"}</dd></div><div><dt className="text-xs text-slate-400">START / END</dt><dd>{formatDate(viewing.startDate)} / {formatDate(viewing.endDate)}</dd></div><div><dt className="text-xs text-slate-400">DURATION</dt><dd>{viewing.duration || "—"}</dd></div><div><dt className="text-xs text-slate-400">TEACHERS</dt><dd>{viewing.teachers.map((item) => item.displayName || item.email).join(", ") || "Not assigned"}</dd></div><div><dt className="text-xs text-slate-400">ENROLLED STUDENTS / CLASSES</dt><dd>{viewing.enrolled} / {viewing.classCount}</dd></div><div><dt className="text-xs text-slate-400">STATUS</dt><dd>{viewing.status || "—"}</dd></div></dl></Dialog>}
  </div>;
}