"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { doc, onSnapshot } from "firebase/firestore";
import { useAuth } from "../../../lib/auth-context";
import { db } from "../../../lib/firebase";
import StudentManagement from "../../../components/StudentManagement";
import TeacherAssignment from "../../../components/teacher-assignment/TeacherAssignment";
import SidebarIcon from "../../../components/dashboard/SidebarIcon";
import DirectorOverview from "../../../components/dashboard/DirectorOverview";
import UserManagement from "../../../components/users/UserManagement";
import TrainingManagement from "../../../components/training/TrainingManagement";

const roleConfig = {
  Student: {
    greeting: "Continue building your future with focused, practical learning.",
    modules: [
      "Dashboard",
      "My Training",
      "Events",
      "Attendance",
      "Achievements",
      "Certificates",
      "ID Card",
      "Chat",
      "QR Scanner",
    ],
    stats: [
      ["Active courses", "04", "2 due this week", "ðŸŽ“"],
      ["Learning streak", "12", "days", "ðŸ”¥"],
      ["Achievements", "08", "earned", "ðŸ†"],
      ["Attendance", "96%", "this term", "âœ“"],
    ],
  },
  Volunteer: {
    greeting: "Make an impact in your community.",
    modules: [
      "Dashboard",
      "Events",
      "Activities",
      "Training",
      "Achievements",
      "ID Card",
      "Chat",
    ],
    stats: [
      ["Students supported", "24", "this month", "â™™"],
      ["Hours logged", "18", "this week", "â—·"],
      ["Events joined", "06", "upcoming", "â—‰"],
      ["Impact score", "94%", "positive", "âœ¦"],
    ],
  },
  Facilitator: {
    greeting: "Your sessions are ready to lead.",
    modules: [
      "Dashboard",
      "Training",
      "Students",
      "Events",
      "Attendance",
      "Certificates",
      "Chat",
    ],
    stats: [
      ["Active cohorts", "06", "in progress", "â–¦"],
      ["Sessions hosted", "18", "this month", "â—·"],
      ["Feedback rate", "94%", "positive", "âœ“"],
      ["Students reached", "126", "this term", "â™™"],
    ],
  },
  Teacher: {
    greeting:
      "Your classroom data will appear here when teacher records are available.",
    modules: [
      "Dashboard",
      "Students",
      "Training",
      "Attendance",
      "Events",
      "Achievements",
      "Certificates",
      "Chat",
    ],
    stats: [],
  },
  Director: {
    greeting:
      "Your organization overview will appear here when Director data sources are available.",
    modules: [
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
    ],
    stats: [],
  },
  Admin: {
    greeting: "Everything is under control.",
    modules: [
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
    ],
    stats: [
      ["Total users", "684", "â†‘ 32 this month", "â™™"],
      ["Pending reviews", "14", "need attention", "!"],
      ["System health", "99.9%", "uptime", "âœ“"],
      ["Active programs", "50", "across academy", "â–¦"],
    ],
  },
};
const teacherUnavailableStats = [
  ["My students", "â€”", "No class relationship recorded"],
  ["Assignments", "â€”", "No assignment data available"],
  ["Attendance", "â€”", "No attendance records available"],
  ["Class rating", "â€”", "No rating records available"],
];

function Brand() {
  return (
    <div className="flex items-center gap-3">
      <img
        src="/logo.jpeg"
        alt="Next Academy logo"
        className="h-10 w-10 rounded-xl object-contain shadow-lg shadow-red-950/30"
      />
      <div>
        <p className="text-sm font-bold leading-tight text-white">
          Next Academy
        </p>
        <p className="text-[9px] font-semibold uppercase tracking-[.18em] text-red-300">
          Learning platform
        </p>
      </div>
    </div>
  );
}

function EmptyDataPanel({ title, message }) {
  return (
    <div className="rounded-3xl border border-dashed border-slate-300 bg-white p-6 shadow-sm">
      <h2 className="font-bold text-slate-800">{title}</h2>
      <p className="mt-4 text-sm text-slate-500">{message}</p>
    </div>
  );
}

function DirectorDashboard({ profile, user }) {
  const { logout } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [active, setActive] = useState("Dashboard");
  const [profileOpen, setProfileOpen] = useState(false);
  const config = roleConfig.Director;
  const name =
    profile.displayName ||
    user.displayName ||
    user.email?.split("@")[0] ||
    "Director";
  const initials = name.slice(0, 2).toUpperCase();
  const unavailable = active !== "Dashboard";

  return (
    <main className="min-h-screen bg-slate-100 text-slate-800 md:flex">
      <aside
        className={`${mobileOpen ? "translate-x-0" : "-translate-x-full"} fixed inset-y-0 left-0 z-40 flex h-screen w-[280px] flex-col bg-slate-950 text-slate-300 shadow-2xl transition-transform duration-300 md:sticky md:top-0 md:translate-x-0 md:shadow-none`}
      >
        <div className="flex items-center justify-between border-b border-slate-800 p-5">
          <Brand />
          <button
            onClick={() => setMobileOpen(false)}
            className="text-xl text-slate-400 md:hidden"
            aria-label="Close menu"
          >
            Ã—
          </button>
        </div>
        <div className="border-b border-slate-800 px-5 py-4">
          <span className="rounded bg-red-500/15 px-2 py-1 text-[10px] font-bold uppercase tracking-widest text-red-300">
            Director workspace
          </span>
        </div>
        <nav className="flex-1 overflow-y-auto px-4 py-5">
          {config.modules.map((module) => (
            <button
              key={module}
              onClick={() => {
                setActive(module);
                setMobileOpen(false);
              }}
              className={`mb-2 flex min-h-12 w-full items-center gap-4 rounded-xl px-4 py-3 text-left text-[15px] font-semibold transition ${active === module ? "bg-red-600 text-white shadow-lg shadow-red-950/30" : "text-slate-400 hover:bg-slate-800 hover:text-white"}`}
            >
              <span className="grid h-6 w-6 shrink-0 place-items-center">
                <SidebarIcon name={module} className="h-6 w-6" />
              </span>
              {module}
            </button>
          ))}
        </nav>
        <div className="border-t border-slate-800 bg-slate-950/60 p-4">
          <div className="flex items-center gap-3">
            <span className="grid h-9 w-9 place-items-center rounded-full bg-red-700 text-sm font-bold text-white">
              {initials}
            </span>
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-white">DIRECTOR</p>
              <p className="truncate text-xs text-slate-400">director@learninghome.org</p>
            </div>
          </div>
          <button
            onClick={logout}
            className="mt-4 w-full rounded-lg bg-slate-800 px-3 py-2.5 text-xs font-semibold text-slate-300 hover:text-red-300"
          >
            â†ª Sign Out Session
          </button>
        </div>
      </aside>
      {mobileOpen && (
        <button
          className="fixed inset-0 z-30 bg-slate-950/60 md:hidden"
          onClick={() => setMobileOpen(false)}
          aria-label="Close navigation"
        />
      )}
      <section className="min-w-0 flex-1">
        <header className="sticky top-0 z-20 flex h-16 items-center justify-between border-b border-slate-200 bg-white px-4 shadow-sm md:px-6">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setMobileOpen(true)}
              className="text-xl text-slate-600 md:hidden"
              aria-label="Open menu"
            >
              â˜°
            </button>
            <div>
              <h1 className="text-lg font-bold text-slate-800">
                {active === "Dashboard" ? "Director Dashboard" : active}
              </h1>
              <p className="hidden text-[10px] uppercase tracking-wider text-slate-400 sm:block">
                Organization overview
              </p>
            </div>
          </div>
          <div className="relative">
            <button
              onClick={() => setProfileOpen(!profileOpen)}
              className="flex items-center gap-2 border-l border-slate-200 pl-3"
            >
              <span className="grid h-9 w-9 place-items-center rounded-full bg-red-600 text-xs font-bold text-white">
                {initials}
              </span>
              <span className="hidden text-left sm:block">
                <b className="block text-xs text-slate-800">{name}</b>
                <small className="text-[10px] text-slate-500">Director</small>
              </span>
              <span className="text-slate-400">âŒ„</span>
            </button>
            {profileOpen && (
              <div className="absolute right-0 top-12 z-30 w-52 rounded-2xl border border-slate-200 bg-white p-3 shadow-2xl">
                <p className="border-b border-slate-100 pb-3 text-xs font-semibold">
                  {user.email}
                </p>
                <p className="py-3 text-xs text-slate-500">
                  Authenticated Director profile
                </p>
                <button
                  onClick={logout}
                  className="w-full rounded-lg bg-red-50 px-3 py-2 text-left text-xs font-bold text-red-700"
                >
                  Sign Out Session
                </button>
              </div>
            )}
          </div>
        </header>
        <div className="p-4 md:p-6 lg:p-8">
          <div className="mx-auto max-w-7xl space-y-6">
            {active === "Dashboard" && (
              <DirectorOverview
                greeting={config.greeting}
                onOpenStudents={() => setActive("Students")}
                onOpenReports={() => setActive("Reports")}
              />
            )}
            {active === "Students" ? (
              <StudentManagement role="Director" />
            ) : active === "User" ? (
              <UserManagement role="Director" currentUserId={user.uid} />
            ) : active === "Training" ? (
              <TrainingManagement role="Director" />
            ) : active === "Teacher" ? (
              <TeacherAssignment />
            ) : unavailable ? (
              <EmptyDataPanel
                title={`${active} module`}
                message="This Director module does not have an implemented page or permitted Firestore data source yet."
              />
            ) : (
              <>
                <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                  {[
                    [
                      "Enrolled students",
                      "No data available",
                      "No Director student aggregate source",
                    ],
                    [
                      "Active teachers",
                      "No data available",
                      "No Director teacher aggregate source",
                    ],
                    [
                      "Monthly revenue",
                      "No financial data",
                      "No permitted finance source",
                    ],
                    [
                      "Upcoming events",
                      "No data available",
                      "No Director events source",
                    ],
                  ].map(([label, value, note]) => (
                    <article
                      key={label}
                      className="rounded-2xl border border-slate-200/70 bg-white p-5 shadow-sm"
                    >
                      <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                        {label}
                      </p>
                      <h3 className="mt-3 text-xl font-extrabold text-slate-800">
                        {value}
                      </h3>
                      <span className="mt-3 block text-[10px] leading-4 text-slate-500">
                        {note}
                      </span>
                    </article>
                  ))}
                </section>
                <section className="grid gap-4 lg:grid-cols-2">
                  <EmptyDataPanel
                    title="Upcoming events"
                    message="No upcoming events are available from a Director-authorized data source."
                  />
                  <EmptyDataPanel
                    title="Recent activity"
                    message="No Director activity records are available."
                  />
                </section>
                <section className="rounded-3xl border border-slate-200/70 bg-white p-6 shadow-sm">
                  <div className="flex items-center justify-between">
                    <div>
                      <h2 className="font-bold text-slate-800">
                        Director modules
                      </h2>
                      <p className="mt-1 text-xs text-slate-500">
                        Navigate to a module to inspect its current
                        implementation status.
                      </p>
                    </div>
                    <span className="rounded-full bg-slate-100 px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-slate-500">
                      {config.modules.length} areas
                    </span>
                  </div>
                  <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
                    {config.modules.map((module) => (
                      <button
                        key={module}
                        onClick={() => setActive(module)}
                        className="rounded-2xl border border-slate-100 bg-slate-50/60 p-4 text-left transition hover:-translate-y-0.5 hover:border-red-300 hover:bg-red-50"
                      >
                        <span className="text-xl text-red-600">
                          <SidebarIcon name={module} className="h-6 w-6" />
                        </span>
                        <b className="mt-3 block text-xs">{module}</b>
                        <small className="mt-1 block text-[10px] text-slate-500">
                          {module === "Dashboard"
                            ? "Available"
                            : "Not implemented"}
                        </small>
                      </button>
                    ))}
                  </div>
                </section>
              </>
            )}
          </div>
        </div>
      </section>
    </main>
  );
}

function DashboardContent({ role, profile, user }) {
  const router = useRouter();
  const { logout } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [active, setActive] = useState("Dashboard");
  const [profileOpen, setProfileOpen] = useState(false);
  const [teacherProfile, setTeacherProfile] = useState(profile);
  const [teacherProfileError, setTeacherProfileError] = useState("");
  const config = roleConfig[role] || roleConfig.Student;
  const name =
    profile.displayName ||
    user.displayName ||
    user.email?.split("@")[0] ||
    "Member";
  const initials = name.slice(0, 2).toUpperCase();

  useEffect(() => {
    if (role === "Teacher") router.replace("/teacher/dashboard");
  }, [role, router]);

  useEffect(() => {
    if (role !== "Teacher" || !db || !user?.uid) return undefined;
    return onSnapshot(
      doc(db, "users", user.uid),
      (snapshot) => {
        setTeacherProfile(
          snapshot.exists() ? { uid: user.uid, ...snapshot.data() } : null,
        );
        setTeacherProfileError("");
      },
      () => setTeacherProfileError("Unable to load your live teacher profile."),
    );
  }, [role, user?.uid]);

  if (role === "Director")
    return <DirectorDashboard profile={profile} user={user} />;

  if (role === "Teacher") {
    return (
      <div className="grid min-h-screen place-items-center bg-slate-100 text-sm text-slate-500">
        Opening your teacher workspace...
      </div>
    );
  }

  function selectModule(module) {
    setActive(module);
    setMobileOpen(false);
  }

  return (
    <main className="min-h-screen bg-slate-100 text-slate-800 md:flex">
      <aside
        className={`${mobileOpen ? "translate-x-0" : "-translate-x-full"} fixed inset-y-0 left-0 z-40 flex h-screen w-[280px] flex-col bg-slate-900 text-slate-300 shadow-2xl transition-transform duration-300 md:sticky md:top-0 md:translate-x-0 md:shadow-none`}
      >
        <div className="flex items-center justify-between border-b border-slate-800 p-5">
          <Brand />
          <button
            onClick={() => setMobileOpen(false)}
            className="text-xl text-slate-400 md:hidden"
            aria-label="Close menu"
          >
            Ã—
          </button>
        </div>
        <div className="border-b border-slate-800 px-5 py-4">
          <span className="rounded bg-red-500/15 px-2 py-1 text-[10px] font-bold uppercase tracking-widest text-red-300">
            {role} workspace
          </span>
        </div>
        <nav className="custom-scrollbar flex-1 overflow-y-auto px-4 py-5">
          {config.modules.map((module) => (
            <button
              key={module}
              onClick={() => selectModule(module)}
              className={`mb-2 flex min-h-12 w-full items-center gap-4 rounded-xl px-4 py-3 text-left text-[15px] font-semibold transition ${active === module ? "bg-red-600 text-white shadow-lg shadow-red-950/30" : "text-slate-400 hover:bg-slate-800 hover:text-white"}`}
            >
              <span className="grid h-6 w-6 shrink-0 place-items-center">
                <SidebarIcon name={module} className="h-6 w-6" />
              </span>
              {module}
              {module === "Chat" && (
                <b className="ml-auto rounded-full bg-red-400 px-1.5 py-0.5 text-[9px] text-white">
                  3
                </b>
              )}
            </button>
          ))}
        </nav>
        <div className="border-t border-slate-800 bg-slate-950/40 p-4">
          <div className="mb-4 flex items-center gap-3">
            <span className="grid h-9 w-9 place-items-center rounded-full bg-red-700 text-sm font-bold text-white">
              {initials}
            </span>
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-white">{name}</p>
              <p className="truncate text-xs text-slate-400">{user.email}</p>
            </div>
          </div>
          <button
            onClick={logout}
            className="flex w-full items-center justify-center gap-2 rounded-lg bg-slate-800 px-3 py-2.5 text-xs font-semibold text-slate-300 transition hover:bg-red-600/20 hover:text-red-300"
          >
            â†ª Sign Out Session
          </button>
        </div>
      </aside>
      {mobileOpen && (
        <button
          className="fixed inset-0 z-30 bg-slate-950/60 md:hidden"
          onClick={() => setMobileOpen(false)}
          aria-label="Close navigation"
        />
      )}

      <section className="flex min-h-screen min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-20 flex h-16 items-center justify-between border-b border-slate-200 bg-white px-4 shadow-sm md:px-6">
          <div className="flex items-center gap-4">
            <button
              onClick={() => setMobileOpen(true)}
              className="text-xl text-slate-600 md:hidden"
              aria-label="Open menu"
            >
              â˜°
            </button>
            <h1 className="text-lg font-bold text-slate-800 md:text-xl">
              {active === "Dashboard" ? `${role} Dashboard` : active}
            </h1>
          </div>
          <div className="flex items-center gap-3">
            <div className="relative hidden sm:block">
              <input
                className="w-52 rounded-xl border border-slate-200 bg-slate-50 px-4 py-2 pl-9 text-xs outline-none focus:ring-2 focus:ring-red-500"
                placeholder="Search records, students..."
              />
              <span className="absolute left-3 top-2.5 text-slate-400">âŒ•</span>
            </div>
            <button
              onClick={() => selectModule("Chat")}
              className="relative rounded-xl p-2.5 text-slate-600 hover:bg-slate-100"
              aria-label="Open chat"
            >
              â—Œ
              <i className="absolute right-1 top-1 h-2 w-2 rounded-full bg-red-500" />
            </button>
            <button
              onClick={() => setProfileOpen(!profileOpen)}
              className="flex items-center gap-2 border-l border-slate-200 pl-3"
            >
              <span className="grid h-9 w-9 place-items-center rounded-full bg-red-600 text-xs font-bold text-white">
                {initials}
              </span>
              <span className="hidden text-left sm:block">
                <b className="block text-xs text-slate-800">{name}</b>
                <small className="text-[10px] text-slate-500">{role}</small>
              </span>
              <span className="text-slate-400">âŒ„</span>
            </button>
            {profileOpen && (
              <div className="absolute right-4 top-14 z-30 w-52 rounded-2xl border border-slate-200 bg-white p-3 shadow-2xl">
                <p className="border-b border-slate-100 pb-3 text-xs font-semibold">
                  {user.email}
                </p>
                <p className="py-3 text-xs text-slate-500">
                  Role: <b className="text-red-600">{role}</b>
                </p>
                <button
                  onClick={logout}
                  className="w-full rounded-lg bg-red-50 px-3 py-2 text-left text-xs font-bold text-red-700"
                >
                  Sign Out Session
                </button>
              </div>
            )}
          </div>
        </header>
        <div className="flex-1 p-4 md:p-6 lg:p-8">
          <div className="mx-auto max-w-7xl space-y-6">
            {role === "Admin" && active === "Students" ? (
              <StudentManagement role="Admin" />
            ) : role === "Admin" && active === "User" ? (
              <UserManagement role="Admin" currentUserId={user.uid} />
            ) : (active === "Training" || active === "My Training") ? (
              <TrainingManagement role={role} />
            ) : role === "Admin" && active === "Teacher" ? (
              <TeacherAssignment />
            ) : (
              <>
            {active === "Dashboard" && (
            <section className="flex flex-col justify-between gap-6 rounded-3xl bg-gradient-to-r from-red-600 via-red-700 to-red-900 p-6 text-white shadow-xl md:flex-row md:items-center md:p-8">
              <div>
                <span className="rounded-full bg-white/20 px-3 py-1 text-[10px] font-bold uppercase tracking-wider">
                  Enterprise workspace Â· {role}
                </span>
                <h2 className="mt-3 text-3xl font-extrabold">
                  Welcome, {name}
                </h2>
                <p className="mt-2 max-w-xl text-xs leading-relaxed text-red-100">
                  {config.greeting}
                </p>
              </div>
              <div className="flex gap-3">
                <button
                  onClick={() => selectModule(config.modules[1] || "Training")}
                  className="rounded-xl bg-white px-4 py-3 text-xs font-bold text-red-600 shadow transition hover:bg-red-50"
                >
                  View programs
                </button>
                <button
                  onClick={() =>
                    selectModule(
                      config.modules.includes("QR Scanner")
                        ? "QR Scanner"
                        : config.modules[0],
                    )
                  }
                  className="rounded-xl border border-red-300/40 bg-red-950/30 px-4 py-3 text-xs font-bold text-white transition hover:bg-red-950/60"
                >
                  Quick action
                </button>
              </div>
            </section>
            )}
            <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              {(role === "Teacher"
                ? teacherUnavailableStats
                : config.stats
              ).map(([label, value, note, icon], index) => (
                <article
                  key={label}
                  className="flex items-center justify-between rounded-2xl border border-slate-200/70 bg-white p-5 shadow-sm"
                >
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                      {label}
                    </p>
                    <h3 className="mt-2 text-2xl font-extrabold text-slate-800">
                      {value}
                    </h3>
                    <span
                      className={`mt-2 inline-block text-[10px] font-bold ${role === "Teacher" ? "text-slate-500" : index === 1 ? "text-amber-600" : "text-emerald-600"}`}
                    >
                      {note}
                    </span>
                  </div>
                  <div className="grid h-12 w-12 place-items-center rounded-2xl bg-red-50 text-xl text-red-600 shadow-inner">
                    {icon || "â€”"}
                  </div>
                </article>
              ))}
            </section>
            {role === "Teacher" && (
              <div className="rounded-2xl border border-amber-200 bg-amber-50 px-5 py-4 text-xs text-amber-900">
                Teacher dashboard data is connected to your Firebase profile and
                updates live. Class, assignment, attendance, schedule, activity,
                and rating records are not present in the current project schema
                yet.
                {teacherProfileError && (
                  <span className="mt-1 block font-semibold text-red-700">
                    {teacherProfileError}
                  </span>
                )}
                {teacherProfile && (
                  <span className="mt-1 block text-amber-800">
                    Profile sync active for {teacherProfile.email || user.email}
                    .
                  </span>
                )}
              </div>
            )}
            <section className="rounded-3xl border border-slate-200/70 bg-white p-5 shadow-sm md:p-6">
              <div className="mb-5 flex items-center justify-between">
                <div>
                  <h2 className="font-bold text-slate-800">
                    Workspace modules
                  </h2>
                  <p className="mt-1 text-xs text-slate-500">
                    Access the tools available for your {role.toLowerCase()}{" "}
                    role.
                  </p>
                </div>
                <span className="hidden rounded-full bg-slate-100 px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-slate-500 sm:block">
                  {config.modules.length} modules
                </span>
              </div>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
                {config.modules.map((module) => (
                  <button
                    key={module}
                    onClick={() => selectModule(module)}
                    className={`group rounded-2xl border p-4 text-center transition ${active === module ? "border-red-500 bg-red-50" : "border-slate-100 bg-slate-50/50 hover:border-red-300 hover:bg-red-50/50"}`}
                  >
                    <span
                      className={`mx-auto grid h-11 w-11 place-items-center rounded-xl bg-white text-lg shadow-sm transition group-hover:bg-red-600 group-hover:text-white ${active === module ? "bg-red-600 text-white" : "text-slate-700"}`}
                    >
                      <SidebarIcon name={module} className="h-6 w-6" />
                    </span>
                    <span className="mt-3 block text-[11px] font-bold text-slate-700">
                      {module}
                    </span>
                  </button>
                ))}
              </div>
            </section>
            {role === "Teacher" ? (
              <section className="grid gap-4 lg:grid-cols-2">
                <EmptyDataPanel
                  title="Upcoming schedule"
                  message="No upcoming classes, events, training sessions, or meetings are available for this teacher."
                />
                <EmptyDataPanel
                  title="Recent activity"
                  message="No recent teacher activity is available."
                />
              </section>
            ) : (
              <section className="grid gap-4 lg:grid-cols-2">
                <div className="rounded-3xl border border-slate-200/70 bg-white p-6 shadow-sm">
                  <div className="flex items-center justify-between">
                    <h2 className="font-bold text-slate-800">
                      Upcoming schedule
                    </h2>
                    <button className="text-xs font-bold text-red-600">
                      View all â†’
                    </button>
                  </div>
                  {[
                    "Leadership in practice",
                    "Community workshop",
                    "Portfolio review",
                  ].map((item, index) => (
                    <div
                      className="flex items-center gap-4 border-b border-slate-100 py-4 last:border-0"
                      key={item}
                    >
                      <span className="grid h-11 w-11 place-items-center rounded-xl bg-red-50 text-center text-red-600">
                        <b className="block text-lg">{10 + index * 2}</b>
                      </span>
                      <div>
                        <b className="block text-xs text-slate-800">{item}</b>
                        <span className="text-[10px] text-slate-500">
                          {index === 0
                            ? "Today Â· 14:00 Â· Room A"
                            : "This week Â· Next Academy"}
                        </span>
                      </div>
                      <span className="ml-auto text-slate-400">â†’</span>
                    </div>
                  ))}
                </div>
                <div className="rounded-3xl border border-slate-200/70 bg-white p-6 shadow-sm">
                  <h2 className="font-bold text-slate-800">Recent activity</h2>
                  {[
                    "Module completed",
                    "Achievement unlocked",
                    "Feedback received",
                  ].map((item, index) => (
                    <div
                      className="flex items-center gap-3 border-b border-slate-100 py-4 last:border-0"
                      key={item}
                    >
                      <span className="grid h-8 w-8 place-items-center rounded-full bg-emerald-50 text-sm text-emerald-600">
                        {index === 0 ? "âœ“" : index === 1 ? "âœ¦" : "â†—"}
                      </span>
                      <div>
                        <b className="block text-xs text-slate-800">{item}</b>
                        <span className="text-[10px] text-slate-500">
                          {index === 0
                            ? "Conflict resolution Â· 2h ago"
                            : index === 1
                              ? "Thoughtful collaborator"
                              : "From your academy mentor"}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            )}
              </>
            )}
          </div>
        </div>
      </section>
    </main>
  );
}

export default function RoleDashboardPage() {
  const params = useParams();
  const router = useRouter();
  const { user, profile, loading } = useAuth();
  const rawRole = params?.role;

  const roleKey = Array.isArray(rawRole) ? rawRole[0] : rawRole;
  const formattedRole = roleKey
    ? roleKey.charAt(0).toUpperCase() + roleKey.slice(1).toLowerCase()
    : "Student";

  const requestedRole = roleConfig[formattedRole] ? formattedRole : "Student";
  const profileRole = roleConfig[profile?.role] ? profile.role : null;

  const requiresVerification = Boolean(
    user?.providerData?.some(
      (provider) => provider.providerId === "password",
    ) && !user.emailVerified,
  );

  useEffect(() => {
    if (!loading && (!user || requiresVerification || !profileRole || requestedRole !== profileRole)) {
      router.replace("/login");
    }
  }, [loading, profileRole, requestedRole, requiresVerification, router, user]);

  if (loading) {
    return (
      <div className="grid min-h-screen place-items-center bg-slate-100 text-sm text-slate-500">
        Loading your learning home...
      </div>
    );
  }

  if (!user || requiresVerification || !profileRole || requestedRole !== profileRole) {
    return (
      <div className="grid min-h-screen place-items-center bg-slate-100 text-sm text-slate-500">
        Redirecting to login...
      </div>
    );
  }

  return (
    <DashboardContent role={profileRole} profile={profile || {}} user={user} />
  );
}









