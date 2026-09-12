"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { collection, onSnapshot, query, where } from "firebase/firestore";
import { Search, GraduationCap, Presentation, BookOpen } from "lucide-react";
import { db } from "../../lib/firebase";
import SidebarIcon, { navLabel } from "./SidebarIcon";

const kindIcon = { Student: GraduationCap, Teacher: Presentation, Course: BookOpen };
// Which sidebar module a record result should jump to — both Admin's and
// Director's real modules arrays (roleConfig in app/dashboard/[role]/page.jsx)
// already contain these exact names.
const kindModule = { Student: "Students", Teacher: "Teacher", Course: "Training" };

// Real, working header search with two independent layers:
//  1. Menu/module search — every role gets this. It only matches the
//     role's own `modules` array (already-known, permission-free local
//     data — typing "shop" jumps straight to that sidebar item), so it is
//     safe and useful for every role, including Student.
//  2. Record search (Students/Teachers/Courses), live from Firestore —
//     Admin/Director only. Those are the only roles whose `admin()`
//     firestore.rules condition allows an unfiltered list read across
//     other people's user docs and all courses; a Student/Volunteer/
//     Facilitator has no legitimate broad query here (rules only let them
//     read their own doc, or a Teacher read their own assigned students),
//     so that layer simply never loads for other roles rather than
//     throwing permission-denied on every keystroke.
export default function GlobalSearch({ role, modules = [], onNavigate }) {
  const canSearchRecords = role === "Admin" || role === "Director";
  const [term, setTerm] = useState("");
  const [open, setOpen] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [directory, setDirectory] = useState({ students: [], teachers: [], courses: [] });
  const boxRef = useRef(null);

  useEffect(() => {
    if (!canSearchRecords || !db) return undefined;
    let pending = 3;
    const done = () => { pending -= 1; if (pending <= 0) setLoaded(true); };
    const unsubStudents = onSnapshot(
      query(collection(db, "users"), where("role", "==", "Student")),
      (snap) => { setDirectory((c) => ({ ...c, students: snap.docs.map((d) => ({ id: d.id, ...d.data() })) })); done(); },
      done,
    );
    const unsubTeachers = onSnapshot(
      query(collection(db, "users"), where("role", "==", "Teacher")),
      (snap) => { setDirectory((c) => ({ ...c, teachers: snap.docs.map((d) => ({ id: d.id, ...d.data() })) })); done(); },
      done,
    );
    const unsubCourses = onSnapshot(
      collection(db, "courses"),
      (snap) => { setDirectory((c) => ({ ...c, courses: snap.docs.map((d) => ({ id: d.id, ...d.data() })) })); done(); },
      done,
    );
    return () => { unsubStudents(); unsubTeachers(); unsubCourses(); };
  }, [canSearchRecords]);

  useEffect(() => {
    function onClickOutside(event) {
      if (boxRef.current && !boxRef.current.contains(event.target)) setOpen(false);
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  const menuResults = useMemo(() => {
    const term_ = term.trim().toLowerCase();
    if (!term_) return [];
    return modules
      .filter((module) => module !== "Dashboard" && navLabel(module).toLowerCase().includes(term_))
      .map((module) => ({ kind: "Menu", id: module, title: navLabel(module), subtitle: "Go to page" }));
  }, [term, modules]);

  const recordResults = useMemo(() => {
    if (!canSearchRecords) return [];
    const term_ = term.trim().toLowerCase();
    if (!term_) return [];
    const students = directory.students
      .filter((s) => `${s.displayName || ""} ${s.email || ""} ${s.userId || ""}`.toLowerCase().includes(term_))
      .slice(0, 5)
      .map((s) => ({ kind: "Student", id: s.id, title: s.displayName || s.email || "Unnamed student", subtitle: s.email || s.userId || "" }));
    const teachers = directory.teachers
      .filter((t) => `${t.displayName || ""} ${t.email || ""}`.toLowerCase().includes(term_))
      .slice(0, 5)
      .map((t) => ({ kind: "Teacher", id: t.id, title: t.displayName || t.email || "Unnamed teacher", subtitle: t.email || "" }));
    const courses = directory.courses
      .filter((c) => `${c.title || c.name || ""} ${c.courseCode || ""}`.toLowerCase().includes(term_))
      .slice(0, 5)
      .map((c) => ({ kind: "Course", id: c.id, title: c.title || c.name || "Untitled course", subtitle: c.courseCode || "" }));
    return [...students, ...teachers, ...courses];
  }, [term, directory, canSearchRecords]);

  const results = [...menuResults, ...recordResults];
  const stillLoadingRecords = canSearchRecords && !loaded && term.trim();

  function selectResult(result) {
    setTerm("");
    setOpen(false);
    onNavigate?.(result.kind === "Menu" ? result.id : kindModule[result.kind]);
  }

  return (
    <div ref={boxRef} className="relative hidden sm:block">
      <input
        value={term}
        onChange={(event) => { setTerm(event.target.value); setOpen(true); }}
        onFocus={() => setOpen(true)}
        className="w-52 rounded-xl border border-border-subtle bg-page px-4 py-2 pl-9 text-xs outline-none focus:ring-2 focus:ring-primary lg:w-64"
        placeholder={canSearchRecords ? "Search menu, students, teachers..." : "Search menu..."}
      />
      <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-subtle" aria-hidden="true" />
      {open && term.trim() && (
        <div className="absolute right-0 z-30 mt-2 w-72 overflow-hidden rounded-xl border border-border-subtle bg-white shadow-xl">
          {results.length ? (
            <ul className="max-h-80 overflow-y-auto py-1">
              {results.map((result) => (
                <li key={`${result.kind}-${result.id}`}>
                  <button
                    type="button"
                    onClick={() => selectResult(result)}
                    className="flex w-full items-center gap-3 px-3 py-2 text-left hover:bg-page"
                  >
                    <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-active text-primary">
                      {result.kind === "Menu" ? (
                        <SidebarIcon name={result.id} className="h-4 w-4" />
                      ) : (
                        (() => { const Icon = kindIcon[result.kind]; return <Icon className="h-4 w-4" aria-hidden="true" />; })()
                      )}
                    </span>
                    <span className="min-w-0">
                      <b className="block truncate text-xs text-ink">{result.title}</b>
                      <span className="block truncate text-[11px] text-muted">{result.kind}{result.subtitle ? ` · ${result.subtitle}` : ""}</span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          ) : stillLoadingRecords ? (
            <p className="p-3 text-xs text-muted">Loading…</p>
          ) : (
            <p className="p-3 text-xs text-muted">No matches for &quot;{term}&quot;.</p>
          )}
        </div>
      )}
    </div>
  );
}
