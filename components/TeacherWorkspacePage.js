"use client";

import { useEffect, useMemo, useState } from "react";
import { addDoc, collection, serverTimestamp } from "firebase/firestore";
import Link from "next/link";
import TeacherGate from "./TeacherGate";
import { useAuth } from "../lib/auth-context";
import {
  createTeacherAchievement,
  createTeacherCertificate,
  createTeacherEvent,
  deleteTeacherEvent,
  saveAttendance,
  sendTeacherMessage,
  subscribeConversationMessages,
  subscribeTeacherDashboard,
  updateTeacherEvent,
} from "../lib/teacher-data";
import { db } from "../lib/firebase";

const links = [
  "Dashboard",
  "Students",
  "Training",
  "Attendance",
  "Events",
  "Achievements",
  "Certificates",
  "Chat",
];
const paths = {
  Dashboard: "/teacher/dashboard",
  Students: "/teacher/students",
  Training: "/teacher/training",
  Attendance: "/teacher/attendance",
  Events: "/teacher/events",
  Achievements: "/teacher/achievements",
  Certificates: "/teacher/certificates",
  Chat: "/teacher/chat",
};
const blank = {
  classes: [],
  students: [],
  courses: [],
  assignments: [],
  submissions: [],
  attendance: [],
  events: [],
  activities: [],
  achievements: [],
  certificates: [],
  conversations: [],
};

function Empty({ children }) {
  return (
    <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-center text-sm text-slate-500">
      {children}
    </div>
  );
}
function Panel({ title, children, action }) {
  return (
    <section className="rounded-3xl border border-slate-200/70 bg-white p-5 shadow-sm md:p-6">
      <div className="mb-5 flex items-center justify-between gap-4">
        <h2 className="font-bold text-slate-800">{title}</h2>
        {action}
      </div>
      {children}
    </section>
  );
}
function Field({ label, ...props }) {
  return (
    <label className="grid gap-1 text-xs font-semibold text-slate-600">
      {label}
      <input
        {...props}
        className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-xs font-normal outline-none focus:ring-2 focus:ring-red-500"
      />
    </label>
  );
}

function TeacherShell({ active, children, unread }) {
  const { user, profile, logout } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);
  const name =
    profile?.displayName ||
    user?.displayName ||
    user?.email?.split("@")[0] ||
    "Teacher";
  return (
    <main className="min-h-screen bg-slate-100 text-slate-800 md:flex">
      <aside
        className={`${mobileOpen ? "translate-x-0" : "-translate-x-full"} fixed inset-y-0 left-0 z-40 flex w-72 flex-col bg-slate-900 text-slate-300 shadow-2xl transition-transform md:relative md:translate-x-0 md:shadow-none`}
      >
        <div className="border-b border-slate-800 p-5">
          <div className="flex items-center gap-3">
            <span className="grid h-10 w-10 place-items-center rounded-xl bg-red-600 text-xl font-bold text-white">
              N
            </span>
            <div>
              <b className="block text-sm text-white">Next Academy</b>
              <small className="text-[9px] uppercase tracking-widest text-red-300">
                Teacher workspace
              </small>
            </div>
            <button
              onClick={() => setMobileOpen(false)}
              className="ml-auto text-xl md:hidden"
            >
              ×
            </button>
          </div>
        </div>
        <nav className="custom-scrollbar flex-1 overflow-y-auto px-3 py-4">
          {links.map((link) => (
            <Link
              key={link}
              href={paths[link]}
              onClick={() => setMobileOpen(false)}
              className={`mb-1 flex items-center gap-3 rounded-xl px-3 py-3 text-xs font-semibold transition ${active === link ? "bg-red-600 text-white" : "text-slate-400 hover:bg-slate-800 hover:text-white"}`}
            >
              <span className="w-5 text-center">
                {link === "Chat" ? "◌" : link === "Dashboard" ? "▦" : "◈"}
              </span>
              {link}
              {link === "Chat" && unread > 0 && (
                <b className="ml-auto rounded-full bg-red-400 px-1.5 py-0.5 text-[9px]">
                  {unread}
                </b>
              )}
            </Link>
          ))}
        </nav>
        <div className="border-t border-slate-800 p-4">
          <p className="truncate text-sm font-medium text-white">{name}</p>
          <p className="truncate text-xs text-slate-400">{user?.email}</p>
          <button
            onClick={logout}
            className="mt-4 w-full rounded-lg bg-slate-800 px-3 py-2 text-xs font-semibold text-slate-300 hover:text-red-300"
          >
            ↪ Sign Out Session
          </button>
        </div>
      </aside>
      {mobileOpen && (
        <button
          onClick={() => setMobileOpen(false)}
          className="fixed inset-0 z-30 bg-slate-950/60 md:hidden"
          aria-label="Close navigation"
        />
      )}
      <section className="min-w-0 flex-1">
        <header className="sticky top-0 z-20 flex h-16 items-center justify-between border-b border-slate-200 bg-white px-4 shadow-sm md:px-6">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setMobileOpen(true)}
              className="text-xl md:hidden"
              aria-label="Open navigation"
            >
              ☰
            </button>
            <h1 className="text-lg font-bold">{active}</h1>
          </div>
          <span className="hidden text-xs text-slate-500 sm:block">
            {profile?.role} · {name}
          </span>
        </header>
        <div className="p-4 md:p-6 lg:p-8">
          <div className="mx-auto max-w-7xl">{children}</div>
        </div>
      </section>
    </main>
  );
}

function DashboardView({ data }) {
  const attendanceTotal = data.attendance.length;
  const attended = data.attendance.filter((item) =>
    ["present", "late"].includes(item.status),
  ).length;
  const attendance = attendanceTotal
    ? `${Math.round((attended / attendanceTotal) * 100)}%`
    : "—";
  const pending = data.submissions.filter(
    (item) => item.status === "submitted",
  ).length;
  const stats = [
    ["My students", data.students.length, `${data.classes.length} classes`],
    ["Assignments", pending, "pending review"],
    ["Attendance", attendance, "from recorded sessions"],
    ["Class rating", "—", "No ratings yet"],
  ];
  return (
    <div className="space-y-6">
      <div className="rounded-3xl bg-gradient-to-r from-red-600 via-red-700 to-red-900 p-6 text-white shadow-xl md:p-8">
        <span className="rounded-full bg-white/20 px-3 py-1 text-[10px] font-bold uppercase tracking-wider">
          Teacher workspace
        </span>
        <h2 className="mt-3 text-3xl font-extrabold">
          Your classroom at a glance
        </h2>
        <p className="mt-2 text-xs text-red-100">
          Live data from classes, submissions, attendance, and teacher activity.
        </p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {stats.map(([label, value, note]) => (
          <article
            key={label}
            className="rounded-2xl border border-slate-200/70 bg-white p-5 shadow-sm"
          >
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
              {label}
            </p>
            <h3 className="mt-2 text-3xl font-extrabold">{value}</h3>
            <span className="mt-2 block text-[10px] text-slate-500">
              {note}
            </span>
          </article>
        ))}
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <Panel title="Upcoming schedule">
          {data.events.length ? (
            data.events.slice(0, 5).map((event) => (
              <div
                key={event.id}
                className="border-b border-slate-100 py-3 last:border-0"
              >
                <b className="block text-sm">{event.title}</b>
                <span className="text-xs text-slate-500">
                  {event.date} · {event.startTime || "Time not set"} ·{" "}
                  {event.location || "Location not set"}
                </span>
              </div>
            ))
          ) : (
            <Empty>No upcoming events or classes</Empty>
          )}
        </Panel>
        <Panel title="Recent activity">
          {data.activities.length ? (
            data.activities.slice(0, 5).map((item) => (
              <div
                key={item.id}
                className="border-b border-slate-100 py-3 last:border-0"
              >
                <b className="block text-sm">{item.title}</b>
                <span className="text-xs text-slate-500">
                  {item.description}
                </span>
              </div>
            ))
          ) : (
            <Empty>No recent activity</Empty>
          )}
        </Panel>
      </div>
    </div>
  );
}

function StudentsView({ data }) {
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const filtered = data.students.filter((student) =>
    `${student.displayName} ${student.email}`
      .toLowerCase()
      .includes(search.toLowerCase()),
  );
  const rows = filtered.slice((page - 1) * 10, page * 10);
  return (
    <Panel
      title="Students"
      action={
        <input
          value={search}
          onChange={(event) => {
            setSearch(event.target.value);
            setPage(1);
          }}
          placeholder="Search students"
          className="w-40 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs outline-none focus:ring-2 focus:ring-red-500"
        />
      }
    >
      {rows.length ? (
        <>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-slate-100 text-[10px] uppercase tracking-wider text-slate-400">
                <tr>
                  <th className="p-3">Student</th>
                  <th className="p-3">Contact</th>
                  <th className="p-3">Status</th>
                  <th className="p-3">Details</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((student) => (
                  <tr key={student.id} className="border-b border-slate-100">
                    <td className="p-3 font-semibold">
                      {student.displayName || "Unnamed student"}
                    </td>
                    <td className="p-3 text-slate-500">
                      {student.email || "No contact"}
                    </td>
                    <td className="p-3">
                      {student.active === false ? "Inactive" : "Active"}
                    </td>
                    <td className="p-3 text-slate-500">
                      Teacher-scoped profile
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="mt-4 flex justify-between text-xs">
            <button
              disabled={page === 1}
              onClick={() => setPage(page - 1)}
              className="font-semibold text-red-600 disabled:text-slate-300"
            >
              Previous
            </button>
            <span>
              Page {page} of {Math.max(1, Math.ceil(filtered.length / 10))}
            </span>
            <button
              disabled={page * 10 >= filtered.length}
              onClick={() => setPage(page + 1)}
              className="font-semibold text-red-600 disabled:text-slate-300"
            >
              Next
            </button>
          </div>
        </>
      ) : (
        <Empty>No students found</Empty>
      )}
    </Panel>
  );
}

function TrainingView({ data }) {
  return (
    <Panel title="Courses and training">
      {data.courses.length ? (
        data.courses.map((course) => (
          <Link
            key={course.id}
            href={`/teacher/courses/${course.id}`}
            className="mb-3 block w-full rounded-2xl border border-slate-200 p-4 text-left hover:border-red-400"
          >
            <b className="block">{course.title}</b>
            <span className="text-xs text-slate-500">
              {course.status || "Active"} ·{" "}
              {course.description || "No description"}
            </span>
            <span className="mt-3 block text-xs font-bold text-red-600">
              Open course details →
            </span>
          </Link>
        ))
      ) : (
        <Empty>No training courses found</Empty>
      )}
    </Panel>
  );
}

function AttendanceView({ data, teacherId }) {
  const [classId, setClassId] = useState(data.classes[0]?.id || "");
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [status, setStatus] = useState({});
  const [message, setMessage] = useState("");
  const students = data.students;
  async function save() {
    const records = students.map((student) => ({
      id: `${classId}_${student.id}_${date}`,
      classId,
      studentId: student.id,
      date,
      status: status[student.id] || "present",
    }));
    await saveAttendance(teacherId, records);
    setMessage("Attendance saved.");
  }
  return (
    <Panel
      title="Attendance"
      action={
        <div className="flex gap-2">
          <select
            value={classId}
            onChange={(event) => setClassId(event.target.value)}
            className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs"
          >
            <option value="">Select class</option>
            {data.classes.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name}
              </option>
            ))}
          </select>
          <input
            type="date"
            value={date}
            onChange={(event) => setDate(event.target.value)}
            className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs"
          />
        </div>
      }
    >
      {!classId ? (
        <Empty>Select a class</Empty>
      ) : !students.length ? (
        <Empty>No enrolled students found</Empty>
      ) : (
        <>
          <div className="space-y-2">
            {students.map((student) => (
              <div
                key={student.id}
                className="flex items-center justify-between rounded-xl bg-slate-50 p-3 text-xs"
              >
                <b>{student.displayName || student.email}</b>
                <select
                  value={status[student.id] || "present"}
                  onChange={(event) =>
                    setStatus({ ...status, [student.id]: event.target.value })
                  }
                  className="rounded-lg border border-slate-200 bg-white px-2 py-1"
                >
                  <option value="present">Present</option>
                  <option value="absent">Absent</option>
                  <option value="late">Late</option>
                </select>
              </div>
            ))}
          </div>
          <button
            onClick={save}
            className="mt-5 rounded-xl bg-red-600 px-5 py-3 text-xs font-bold text-white"
          >
            Save attendance
          </button>
          {message && (
            <p className="mt-3 text-xs text-emerald-600">{message}</p>
          )}
        </>
      )}
    </Panel>
  );
}

function EventsView({ data, teacherId }) {
  const empty = {
    title: "",
    description: "",
    date: "",
    startTime: "",
    endTime: "",
    location: "",
    classId: "",
  };
  const [form, setForm] = useState(empty);
  const [editing, setEditing] = useState(null);
  const [message, setMessage] = useState("");
  async function save() {
    if (editing) await updateTeacherEvent(editing, teacherId, form);
    else await createTeacherEvent(teacherId, form);
    setForm(empty);
    setEditing(null);
    setMessage("Event saved.");
  }
  return (
    <div className="grid gap-4 lg:grid-cols-[.75fr_1fr]">
      <Panel title={editing ? "Edit event" : "Create event"}>
        <div className="grid gap-3">
          <Field
            label="Title"
            value={form.title}
            onChange={(e) => setForm({ ...form, title: e.target.value })}
            required
          />
          <Field
            label="Date"
            type="date"
            value={form.date}
            onChange={(e) => setForm({ ...form, date: e.target.value })}
            required
          />
          <div className="grid grid-cols-2 gap-3">
            <Field
              label="Start"
              type="time"
              value={form.startTime}
              onChange={(e) => setForm({ ...form, startTime: e.target.value })}
            />
            <Field
              label="End"
              type="time"
              value={form.endTime}
              onChange={(e) => setForm({ ...form, endTime: e.target.value })}
            />
          </div>
          <Field
            label="Location"
            value={form.location}
            onChange={(e) => setForm({ ...form, location: e.target.value })}
          />
          <button
            onClick={save}
            className="rounded-xl bg-red-600 py-3 text-xs font-bold text-white"
          >
            Save event
          </button>
          {message && <p className="text-xs text-emerald-600">{message}</p>}
        </div>
      </Panel>
      <Panel title="Your events">
        {data.events.length ? (
          data.events.map((event) => (
            <div
              key={event.id}
              className="flex items-center justify-between border-b border-slate-100 py-4"
            >
              <div>
                <b className="block text-sm">{event.title}</b>
                <span className="text-xs text-slate-500">
                  {event.date} · {event.startTime || "Time not set"} ·{" "}
                  {event.location || "Location not set"}
                </span>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => {
                    setEditing(event.id);
                    setForm(event);
                  }}
                  className="text-xs font-bold text-red-600"
                >
                  Edit
                </button>
                <button
                  onClick={() => deleteTeacherEvent(event.id)}
                  className="text-xs font-bold text-red-700"
                >
                  Delete
                </button>
              </div>
            </div>
          ))
        ) : (
          <Empty>No upcoming events</Empty>
        )}
      </Panel>
    </div>
  );
}

function AchievementsView({ data, teacherId }) {
  const [title, setTitle] = useState("");
  async function create() {
    if (!title) return;
    await createTeacherAchievement(teacherId, {
      title,
      description: "",
      studentId: "",
      classId: "",
    });
    setTitle("");
  }
  return (
    <Panel
      title="Student achievements"
      action={
        <div className="flex gap-2">
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Achievement title"
            className="rounded-xl border border-slate-200 px-3 py-2 text-xs"
          />
          <button
            onClick={create}
            className="rounded-xl bg-red-600 px-3 py-2 text-xs font-bold text-white"
          >
            Award
          </button>
        </div>
      }
    >
      {data.achievements.length ? (
        data.achievements.map((item) => (
          <div key={item.id} className="border-b border-slate-100 py-3">
            <b>{item.title}</b>
            <span className="ml-3 text-xs text-slate-500">
              {item.studentId || "Student not linked"}
            </span>
          </div>
        ))
      ) : (
        <Empty>No achievements</Empty>
      )}
    </Panel>
  );
}
function CertificatesView({ data, teacherId }) {
  const [title, setTitle] = useState("");
  async function create() {
    if (!title) return;
    await createTeacherCertificate(teacherId, {
      title,
      studentId: "",
      courseId: "",
      classId: "",
    });
    setTitle("");
  }
  return (
    <Panel
      title="Certificates"
      action={
        <div className="flex gap-2">
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Certificate title"
            className="rounded-xl border border-slate-200 px-3 py-2 text-xs"
          />
          <button
            onClick={create}
            className="rounded-xl bg-red-600 px-3 py-2 text-xs font-bold text-white"
          >
            Issue
          </button>
        </div>
      }
    >
      {data.certificates.length ? (
        data.certificates.map((item) => (
          <div key={item.id} className="border-b border-slate-100 py-3">
            <b>{item.title}</b>
            <span className="ml-3 text-xs text-slate-500">
              {item.certificateId || item.id} · {item.status}
            </span>
          </div>
        ))
      ) : (
        <Empty>No certificates</Empty>
      )}
    </Panel>
  );
}

function ChatView({ data, teacherId }) {
  const [selected, setSelected] = useState(data.conversations[0]?.id || "");
  const [messages, setMessages] = useState([]);
  const [body, setBody] = useState("");
  const conversation = data.conversations.find((item) => item.id === selected);
  useEffect(
    () => subscribeConversationMessages(selected, setMessages, () => {}),
    [selected],
  );
  async function send() {
    if (!body || !conversation) return;
    await sendTeacherMessage(
      teacherId,
      conversation.id,
      conversation.studentId,
      body,
    );
    setBody("");
  }
  return (
    <div className="grid gap-4 lg:grid-cols-[.35fr_1fr]">
      <Panel title="Conversations">
        {data.conversations.length ? (
          data.conversations.map((item) => (
            <button
              key={item.id}
              onClick={() => setSelected(item.id)}
              className={`mb-2 w-full rounded-xl p-3 text-left text-xs ${selected === item.id ? "bg-red-50 text-red-700" : "bg-slate-50"}`}
            >
              Student: {item.studentId || "Unknown"}
            </button>
          ))
        ) : (
          <Empty>No conversations</Empty>
        )}
      </Panel>
      <Panel title="Messages">
        {conversation ? (
          <>
            <div className="min-h-64 space-y-3">
              {messages.length ? (
                messages.map((item) => (
                  <div
                    key={item.id}
                    className="rounded-xl bg-slate-50 p-3 text-xs"
                  >
                    <b>{item.senderId === teacherId ? "You" : "Student"}</b>
                    <p className="mt-1">{item.body}</p>
                  </div>
                ))
              ) : (
                <Empty>No messages</Empty>
              )}
            </div>
            <div className="mt-4 flex gap-2">
              <input
                value={body}
                onChange={(e) => setBody(e.target.value)}
                className="flex-1 rounded-xl border border-slate-200 px-3 py-2 text-xs"
                placeholder="Write a message"
              />
              <button
                onClick={send}
                className="rounded-xl bg-red-600 px-4 text-xs font-bold text-white"
              >
                Send
              </button>
            </div>
          </>
        ) : (
          <Empty>Select a conversation</Empty>
        )}
      </Panel>
    </div>
  );
}

export default function TeacherWorkspacePage({ module = "Dashboard" }) {
  const { user } = useAuth();
  const [data, setData] = useState(blank);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  useEffect(() => {
    if (!user?.uid) return undefined;
    const update = (key) => (value) => {
      setData((current) => ({ ...current, [key]: value }));
      setLoading(false);
    };
    return subscribeTeacherDashboard(user.uid, {
      classes: update("classes"),
      students: update("students"),
      courses: update("courses"),
      assignments: update("assignments"),
      submissions: update("submissions"),
      attendance: update("attendance"),
      events: update("events"),
      activities: update("activities"),
      achievements: update("achievements"),
      certificates: update("certificates"),
      conversations: update("conversations"),
      error: (firebaseError, collectionName) => {
        console.error("[teacher-workspace] data load failed", firebaseError);
        setError(
          `Unable to load teacher data (${collectionName}: ${firebaseError.code}).`,
        );
        setLoading(false);
      },
    });
  }, [user?.uid]);
  const unread = useMemo(
    () =>
      data.conversations.reduce(
        (total, conversation) => total + Number(conversation.unreadCount || 0),
        0,
      ),
    [data.conversations],
  );
  const content = loading ? (
    <Empty>Loading teacher data...</Empty>
  ) : error ? (
    <Empty>{error}</Empty>
  ) : module === "Dashboard" ? (
    <DashboardView data={data} />
  ) : module === "Students" ? (
    <StudentsView data={data} />
  ) : module === "Training" ? (
    <TrainingView data={data} />
  ) : module === "Attendance" ? (
    <AttendanceView data={data} teacherId={user.uid} />
  ) : module === "Events" ? (
    <EventsView data={data} teacherId={user.uid} />
  ) : module === "Achievements" ? (
    <AchievementsView data={data} teacherId={user.uid} />
  ) : module === "Certificates" ? (
    <CertificatesView data={data} teacherId={user.uid} />
  ) : (
    <ChatView data={data} teacherId={user.uid} />
  );
  return (
    <TeacherGate>
      <TeacherShell active={module} unread={unread}>
        {content}
      </TeacherShell>
    </TeacherGate>
  );
}
