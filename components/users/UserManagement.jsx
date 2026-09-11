"use client";

import { useEffect, useMemo, useState } from "react";
import { Eye, ShieldCheck } from "lucide-react";
import { changeUserRole, loadUsers } from "../../lib/services/user-service";
import { useConfirm } from "../ui/ConfirmDialog";
import DataTable, { StatusBadge } from "../data-table/DataTable";

const assignableRoles = ["Student", "Teacher", "Admin", "Director"];
const dash = "—";
const ROLE_TONE = { Director: "purple", Admin: "red", Teacher: "blue", Student: "green" };

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
  const [viewing, setViewing] = useState(null);
  const [changing, setChanging] = useState(null);
  const [nextRole, setNextRole] = useState("");
  const [saving, setSaving] = useState(false);
  const confirm = useConfirm();

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

  const counts = useMemo(() => Object.fromEntries(["Director", "Admin", "Teacher", "Student"].map((item) => [item, users.filter((user) => user.role === item).length])), [users]);
  const canChange = (user) => user.uid !== currentUserId && !(role !== "Director" && user.role === "Director");

  const columns = useMemo(() => [
    { key: "userId", header: "User ID", sortable: true, accessor: (u) => u.userId || "", render: (u) => <span className="font-mono text-xs text-muted">{u.userId || dash}</span> },
    { key: "displayName", header: "Name", sortable: true, accessor: (u) => u.displayName || "", render: (u) => <b className="text-ink">{u.displayName || dash}</b> },
    { key: "email", header: "Email", sortable: true, accessor: (u) => u.email || "" },
    { key: "phone", header: "Phone", accessor: (u) => u.phone || "" },
    { key: "role", header: "Role", sortable: true, filter: {}, accessor: (u) => u.role || "", render: (u) => <StatusBadge tone={ROLE_TONE[u.role] || "gray"}>{u.role || dash}</StatusBadge> },
    { key: "status", header: "Status", sortable: true, filter: {}, accessor: (u) => (u.active === null ? "Unknown" : u.active ? "Active" : "Inactive"), render: (u) => <StatusBadge tone={u.active === false ? "gray" : "green"}>{u.active === null ? dash : u.active ? "Active" : "Inactive"}</StatusBadge> },
    { key: "createdAt", header: "Joined", sortable: true, sortValue: (u) => u.createdAt || "", exportValue: (u) => displayDate(u.createdAt), render: (u) => <span className="text-xs text-muted">{displayDate(u.createdAt)}</span> },
  ], []);

  async function updateRole(event) {
    event.preventDefault();
    if (!changing || !assignableRoles.includes(nextRole)) return;
    if (!(await confirm({
      title: "Change user role",
      message: `Change ${changing.displayName || changing.email || changing.uid} to ${nextRole}?`,
      tone: "neutral",
      confirmLabel: "Change role",
    }))) return;
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
      <div className="mb-4"><h3 className="font-bold text-ink">All Users</h3><p className="mt-1 text-xs text-muted">Search by user ID, name, email, or phone · filter by role or status · export the current view.</p></div>
      <DataTable
        title="users"
        name="users"
        columns={columns}
        rows={users}
        loading={loading}
        initialSort={{ key: "createdAt", dir: "desc" }}
        pageSize={10}
        emptyLabel="No users found."
        rowActions={(user) => (
          <>
            <button type="button" onClick={() => setViewing(user)} className="inline-flex items-center gap-1 rounded-lg bg-info px-2.5 py-1.5 text-[11px] font-bold text-white hover:opacity-90"><Eye className="h-3.5 w-3.5" /> View</button>
            {canChange(user) && <button type="button" onClick={() => { setChanging(user); setNextRole(user.role); setError(""); }} className="rounded-lg border border-border-subtle px-2.5 py-1.5 text-[11px] font-bold text-primary hover:bg-page">Change role</button>}
          </>
        )}
      />
    </section>
    {viewing && <Dialog title="User details" onClose={() => setViewing(null)}><UserDetails user={viewing} /></Dialog>}
    {changing && <Dialog title="Change user role" onClose={() => !saving && setChanging(null)}><form onSubmit={updateRole} className="space-y-5"><p className="text-sm text-muted">Change the role for <b>{changing.displayName || changing.email || changing.uid}</b>. This takes effect immediately after confirmation.</p><label className="block text-sm font-semibold text-muted">Role<select value={nextRole} onChange={(event) => setNextRole(event.target.value)} className="mt-2 w-full rounded-xl border border-border-subtle bg-white px-3 py-2.5 font-normal outline-none focus:ring-2 focus:ring-primary">{assignableRoles.filter((item) => role === "Director" || item !== "Director").map((item) => <option key={item} value={item}>{item}</option>)}</select></label>{error && <p className="rounded-xl bg-active px-3 py-2 text-sm text-primary">{error}</p>}<div className="flex justify-end gap-3"><button type="button" onClick={() => setChanging(null)} disabled={saving} className="rounded-xl px-4 py-2 text-sm font-bold text-muted">Cancel</button><button disabled={saving || !canChange(changing)} className="rounded-xl bg-primary px-4 py-2 text-sm font-bold text-white disabled:opacity-60">{saving ? "Updating role..." : "Confirm role change"}</button></div></form></Dialog>}
  </div>;
}
