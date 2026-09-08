"use client";

import { useEffect, useMemo, useState } from "react";
import { Eye, Search, ShieldCheck, Users } from "lucide-react";
import { changeUserRole, loadUsers } from "../../lib/services/user-service";

const standardRoles = ["All", "Director", "Admin", "Teacher", "Student"];
const assignableRoles = ["Student", "Teacher", "Admin", "Director"];
const dash = "—";

function Dialog({ title, children, onClose }) {
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/60 p-4" role="dialog" aria-modal="true">
      <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-3xl bg-white p-6 shadow-2xl">
        <div className="mb-5 flex items-center justify-between gap-4">
          <h2 className="text-lg font-bold text-slate-800">{title}</h2>
          <button onClick={onClose} className="text-xl text-slate-500" aria-label="Close dialog">×</button>
        </div>
        {children}
      </div>
    </div>
  );
}

function RoleBadge({ role }) {
  const colors = {
    Director: "bg-violet-50 text-violet-700 ring-violet-200",
    Admin: "bg-red-50 text-red-700 ring-red-200",
    Teacher: "bg-sky-50 text-sky-700 ring-sky-200",
    Student: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  };
  return <span className={`inline-flex rounded-full px-2.5 py-1 text-[10px] font-bold ring-1 ${colors[role] || "bg-slate-100 text-slate-600 ring-slate-200"}`}>{role || dash}</span>;
}

function displayDate(value) {
  if (!value) return dash;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? dash : new Intl.DateTimeFormat(undefined, { dateStyle: "medium" }).format(date);
}

function UserDetails({ user }) {
  const rows = [["User ID", user.uid], ["Name", user.displayName], ["Email", user.email], ["Phone", user.phone], ["Role", user.role], ["Status", user.active === null ? null : user.active ? "Active" : "Inactive"], ["Joined", displayDate(user.createdAt)]];
  return <dl className="grid gap-4 text-sm">{rows.map(([label, value]) => <div key={label}><dt className="text-[10px] font-bold uppercase tracking-wider text-slate-400">{label}</dt><dd className="mt-1 break-all font-medium text-slate-700">{value || dash}</dd></div>)}</dl>;
}

export default function UserManagement({ role, currentUserId }) {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("All");
  const [viewing, setViewing] = useState(null);
  const [changing, setChanging] = useState(null);
  const [nextRole, setNextRole] = useState("");
  const [saving, setSaving] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const data = await loadUsers();
      setUsers(data.users || []);
      setError("");
    } catch (loadError) {
      setUsers([]);
      setError(loadError.message || "Unable to load users. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void Promise.resolve().then(load); }, []);

  const filters = useMemo(() => [...standardRoles, ...[...new Set(users.map((user) => user.role).filter((item) => item && !standardRoles.includes(item)))].sort()], [users]);
  const visible = useMemo(() => {
    const query = search.trim().toLowerCase();
    return users.filter((user) => (filter === "All" || user.role === filter) && (!query || `${user.uid} ${user.displayName} ${user.email} ${user.phone}`.toLowerCase().includes(query)));
  }, [users, filter, search]);
  const counts = useMemo(() => Object.fromEntries(["Director", "Admin", "Teacher", "Student"].map((item) => [item, users.filter((user) => user.role === item).length])), [users]);
  const canChange = (user) =>
    user.uid !== currentUserId &&
    !(role !== "Director" && user.role === "Director");

  function openRoleDialog(user) {
    setChanging(user);
    setNextRole(user.role);
    setError("");
  }

  async function updateRole(event) {
    event.preventDefault();
    if (!changing || !assignableRoles.includes(nextRole)) return;
    if (!window.confirm(`Change ${changing.displayName || changing.email || changing.uid} to ${nextRole}?`)) return;
    setSaving(true);
    try {
      await changeUserRole(changing.uid, nextRole);
      setChanging(null);
      setNotice("User role updated successfully.");
      await load();
    } catch (updateError) {
      setError(updateError.message || "Unable to update the user role.");
    } finally {
      setSaving(false);
    }
  }

  return <div className="space-y-6">
    <section className="flex flex-wrap items-center justify-between gap-4 rounded-3xl bg-gradient-to-r from-slate-900 to-red-950 p-6 text-white shadow-xl">
      <div><p className="text-[10px] font-bold uppercase tracking-widest text-red-300">{role} workspace</p><h2 className="mt-2 text-3xl font-black">Users</h2><p className="mt-2 text-sm text-slate-300">Manage all registered users and their roles.</p></div>
      <div className="rounded-2xl bg-white/10 p-3"><ShieldCheck className="h-7 w-7 text-red-200" aria-hidden="true" /></div>
    </section>
    {notice && <p className="rounded-xl bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{notice}</p>}
    {error && !changing && <div className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700"><b>Unable to load users. Please try again.</b><p>{error}</p></div>}
    <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">{[["Total Users", users.length], ["Directors", counts.Director], ["Admins", counts.Admin], ["Teachers", counts.Teacher], ["Students", counts.Student]].map(([label, value]) => <article key={label} className="rounded-2xl border border-slate-200/70 bg-white p-5 shadow-sm"><p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">{label}</p><p className="mt-2 text-2xl font-extrabold text-slate-800">{loading ? dash : value}</p></article>)}</section>
    <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm md:p-6">
      <div className="mb-5 flex flex-wrap items-end justify-between gap-4"><div><h3 className="font-bold text-slate-800">All Users</h3><p className="mt-1 text-xs text-slate-500">Search by user ID, name, email, or phone.</p></div><label className="relative w-full sm:w-72"><Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" aria-hidden="true" /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search users" className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2 pl-9 pr-3 text-sm outline-none focus:ring-2 focus:ring-red-500" /></label></div>
      <div className="mb-5 flex flex-wrap gap-2">{filters.map((item) => <button key={item} onClick={() => setFilter(item)} className={`rounded-full px-3 py-1.5 text-xs font-bold transition ${filter === item ? "bg-red-600 text-white" : "bg-slate-100 text-slate-600 hover:bg-red-50 hover:text-red-700"}`}>{item}</button>)}</div>
      {loading ? <p className="py-10 text-center text-sm text-slate-500">Loading users...</p> : error ? null : visible.length ? <div className="overflow-x-auto"><table className="w-full min-w-[1050px] text-left text-sm"><thead className="border-b text-[10px] uppercase tracking-wider text-slate-400"><tr>{["User ID", "Name", "Email", "Phone", "Role", "Status", "Joined", "Actions"].map((label) => <th key={label} className="p-3">{label}</th>)}</tr></thead><tbody>{visible.map((user) => <tr key={user.id} className="border-b border-slate-100 align-middle"><td className="max-w-36 truncate p-3 font-mono text-xs text-slate-600" title={user.uid}>{user.uid || dash}</td><td className="p-3 font-semibold text-slate-800">{user.displayName || dash}</td><td className="p-3 text-slate-600">{user.email || dash}</td><td className="p-3 text-slate-600">{user.phone || dash}</td><td className="p-3"><RoleBadge role={user.role} /></td><td className="p-3 text-slate-600">{user.active === null ? dash : user.active ? "Active" : "Inactive"}</td><td className="p-3 text-slate-600">{displayDate(user.createdAt)}</td><td className="space-x-3 whitespace-nowrap p-3 text-xs font-bold"><button onClick={() => setViewing(user)} className="inline-flex items-center gap-1 text-slate-700 hover:text-red-700"><Eye className="h-3.5 w-3.5" />View</button>{canChange(user) && <button onClick={() => openRoleDialog(user)} className="text-red-700 hover:text-red-900">Change role</button>}</td></tr>)}</tbody></table></div> : <p className="py-10 text-center text-sm text-slate-500">{search || filter !== "All" ? "No users match your search." : "No users found."}</p>}
    </section>
    {viewing && <Dialog title="User details" onClose={() => setViewing(null)}><UserDetails user={viewing} /></Dialog>}
    {changing && <Dialog title="Change user role" onClose={() => !saving && setChanging(null)}><form onSubmit={updateRole} className="space-y-5"><p className="text-sm text-slate-600">Change the role for <b>{changing.displayName || changing.email || changing.uid}</b>. This takes effect immediately after confirmation.</p><label className="block text-sm font-semibold text-slate-700">Role<select value={nextRole} onChange={(event) => setNextRole(event.target.value)} className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 font-normal outline-none focus:ring-2 focus:ring-red-500">{assignableRoles.filter((item) => role === "Director" || item !== "Director").map((item) => <option key={item} value={item}>{item}</option>)}</select></label>{error && <p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}<div className="flex justify-end gap-3"><button type="button" onClick={() => setChanging(null)} disabled={saving} className="rounded-xl px-4 py-2 text-sm font-bold text-slate-600">Cancel</button><button disabled={saving || !canChange(changing)} className="rounded-xl bg-red-600 px-4 py-2 text-sm font-bold text-white disabled:opacity-60">{saving ? "Updating role..." : "Confirm role change"}</button></div></form></Dialog>}
  </div>;
}
