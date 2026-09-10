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
          <h2 className="text-lg font-bold text-ink">{title}</h2>
          <button onClick={onClose} className="text-xl text-muted" aria-label="Close dialog">×</button>
        </div>
        {children}
      </div>
    </div>
  );
}

function RoleBadge({ role }) {
  const colors = {
    Director: "bg-purple-soft text-purple ring-purple",
    Admin: "bg-active text-primary ring-red-line",
    Teacher: "bg-info-soft text-info ring-info",
    Student: "bg-success-soft text-success ring-success",
  };
  return <span className={`inline-flex rounded-full px-2.5 py-1 text-[10px] font-bold ring-1 ${colors[role] || "bg-page text-muted ring-border-subtle"}`}>{role || dash}</span>;
}

function displayDate(value) {
  if (!value) return dash;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? dash : new Intl.DateTimeFormat(undefined, { dateStyle: "medium" }).format(date);
}

function UserDetails({ user }) {
  const rows = [["User ID", user.userId || dash], ["Name", user.displayName], ["Email", user.email], ["Phone", user.phone], ["Role", user.role], ["Status", user.active === null ? null : user.active ? "Active" : "Inactive"], ["Joined", displayDate(user.createdAt)]];
  return <dl className="grid gap-4 text-sm">{rows.map(([label, value]) => <div key={label}><dt className="text-[10px] font-bold uppercase tracking-wider text-subtle">{label}</dt><dd className="mt-1 break-all font-medium text-muted">{value || dash}</dd></div>)}</dl>;
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
    return users.filter((user) => (filter === "All" || user.role === filter) && (!query || `${user.userId || ""} ${user.uid} ${user.displayName} ${user.email} ${user.phone}`.toLowerCase().includes(query)));
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
    <section className="flex flex-wrap items-center justify-between gap-4 rounded-3xl border border-[#f3aaaa] bg-[linear-gradient(120deg,#fff0f0_0%,#fff7f7_45%,#ffffff_100%)] p-6 text-ink shadow-xl">
      <div><h2 className="text-3xl font-black">Users</h2><p className="mt-2 text-sm text-muted">Manage all registered users and their roles.</p></div>
      <div className="rounded-2xl bg-active p-3"><ShieldCheck className="h-7 w-7 text-primary" aria-hidden="true" /></div>
    </section>
    {notice && <p className="rounded-xl bg-success-soft px-4 py-3 text-sm text-success">{notice}</p>}
    {error && !changing && <div className="rounded-xl bg-active px-4 py-3 text-sm text-primary"><b>Unable to load users. Please try again.</b><p>{error}</p></div>}
    <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">{[["Total Users", users.length], ["Directors", counts.Director], ["Admins", counts.Admin], ["Teachers", counts.Teacher], ["Students", counts.Student]].map(([label, value]) => <article key={label} className="rounded-2xl border border-border-subtle/70 bg-white p-5 shadow-sm"><p className="text-[10px] font-bold uppercase tracking-wider text-subtle">{label}</p><p className="mt-2 text-2xl font-extrabold text-ink">{loading ? dash : value}</p></article>)}</section>
    <section className="rounded-3xl border border-border-subtle bg-white p-5 shadow-sm md:p-6">
      <div className="mb-5 flex flex-wrap items-end justify-between gap-4"><div><h3 className="font-bold text-ink">All Users</h3><p className="mt-1 text-xs text-muted">Search by user ID, name, email, or phone.</p></div><label className="relative w-full sm:w-72"><Search className="absolute left-3 top-2.5 h-4 w-4 text-subtle" aria-hidden="true" /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search users" className="w-full rounded-xl border border-border-subtle bg-page py-2 pl-9 pr-3 text-sm outline-none focus:ring-2 focus:ring-primary" /></label></div>
      <div className="mb-5 flex flex-wrap gap-2">{filters.map((item) => <button key={item} onClick={() => setFilter(item)} className={`rounded-full px-3 py-1.5 text-xs font-bold transition ${filter === item ? "bg-primary text-white" : "bg-page text-muted hover:bg-active hover:text-primary"}`}>{item}</button>)}</div>
      {loading ? <p className="py-10 text-center text-sm text-muted">Loading users...</p> : error ? null : visible.length ? <div className="overflow-x-auto"><table className="w-full min-w-[1050px] text-left text-sm"><thead className="border-b text-[10px] uppercase tracking-wider text-subtle"><tr>{["User ID", "Name", "Email", "Phone", "Role", "Status", "Joined", "Actions"].map((label) => <th key={label} className="p-3">{label}</th>)}</tr></thead><tbody>{visible.map((user) => <tr key={user.id} className="border-b border-border-subtle align-middle"><td className="max-w-36 truncate p-3 font-mono text-xs text-muted" title={user.userId || user.uid}>{user.userId || dash}</td><td className="p-3 font-semibold text-ink">{user.displayName || dash}</td><td className="p-3 text-muted">{user.email || dash}</td><td className="p-3 text-muted">{user.phone || dash}</td><td className="p-3"><RoleBadge role={user.role} /></td><td className="p-3 text-muted">{user.active === null ? dash : user.active ? "Active" : "Inactive"}</td><td className="p-3 text-muted">{displayDate(user.createdAt)}</td><td className="space-x-3 whitespace-nowrap p-3 text-xs font-bold"><button onClick={() => setViewing(user)} className="inline-flex items-center gap-1 text-muted hover:text-primary"><Eye className="h-3.5 w-3.5" />View</button>{canChange(user) && <button onClick={() => openRoleDialog(user)} className="text-primary hover:text-primary-hover">Change role</button>}</td></tr>)}</tbody></table></div> : <p className="py-10 text-center text-sm text-muted">{search || filter !== "All" ? "No users match your search." : "No users found."}</p>}
    </section>
    {viewing && <Dialog title="User details" onClose={() => setViewing(null)}><UserDetails user={viewing} /></Dialog>}
    {changing && <Dialog title="Change user role" onClose={() => !saving && setChanging(null)}><form onSubmit={updateRole} className="space-y-5"><p className="text-sm text-muted">Change the role for <b>{changing.displayName || changing.email || changing.uid}</b>. This takes effect immediately after confirmation.</p><label className="block text-sm font-semibold text-muted">Role<select value={nextRole} onChange={(event) => setNextRole(event.target.value)} className="mt-2 w-full rounded-xl border border-border-subtle bg-white px-3 py-2.5 font-normal outline-none focus:ring-2 focus:ring-primary">{assignableRoles.filter((item) => role === "Director" || item !== "Director").map((item) => <option key={item} value={item}>{item}</option>)}</select></label>{error && <p className="rounded-xl bg-active px-3 py-2 text-sm text-primary">{error}</p>}<div className="flex justify-end gap-3"><button type="button" onClick={() => setChanging(null)} disabled={saving} className="rounded-xl px-4 py-2 text-sm font-bold text-muted">Cancel</button><button disabled={saving || !canChange(changing)} className="rounded-xl bg-primary px-4 py-2 text-sm font-bold text-white disabled:opacity-60">{saving ? "Updating role..." : "Confirm role change"}</button></div></form></Dialog>}
  </div>;
}
