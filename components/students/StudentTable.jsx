import DataTable, { StatusBadge } from "../data-table/DataTable";

function formatDate(value) {
  if (!value) return "";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "" : date.toLocaleDateString();
}
const metric = (value) => (value == null ? "—" : `${value}%`);

// Approval / account state as one label, used for the badge, the filter and export.
export function studentStatus(item) {
  if (item.status === "pending") return "Pending";
  if (item.status === "rejected") return "Rejected";
  return item.active === false ? "Inactive" : "Active";
}
const STATUS_TONE = { Pending: "orange", Rejected: "red", Inactive: "gray", Active: "green" };

export default function StudentTable({ students, onView, onEdit, onDeactivate, onApprove, onReject }) {
  const columns = [
    { key: "userId", header: "Student ID", sortable: true, accessor: (r) => r.userId || "", render: (r) => <b className="text-ink">{r.userId || "—"}</b> },
    { key: "displayName", header: "Student", sortable: true, accessor: (r) => r.displayName || "", render: (r) => <b className="text-ink">{r.displayName || "Unnamed student"}</b> },
    { key: "email", header: "Email", sortable: true, accessor: (r) => r.email || "" },
    { key: "phone", header: "Phone", accessor: (r) => r.phone || "" },
    { key: "courseNames", header: "Courses", accessor: (r) => r.courseNames || "", render: (r) => r.courseNames || <span className="text-subtle">No enrollment</span> },
    { key: "progress", header: "Progress", align: "right", sortable: true, sortValue: (r) => r.progress ?? -1, render: (r) => metric(r.progress) },
    { key: "attendance", header: "Attendance", align: "right", sortable: true, sortValue: (r) => r.attendance ?? -1, render: (r) => metric(r.attendance) },
    {
      key: "status", header: "Status", sortable: true, filter: {},
      accessor: (r) => studentStatus(r),
      render: (r) => <StatusBadge tone={STATUS_TONE[studentStatus(r)]}>{studentStatus(r)}</StatusBadge>,
    },
    { key: "createdAt", header: "Joined", sortable: true, sortValue: (r) => r.createdAt || "", exportValue: (r) => formatDate(r.createdAt), render: (r) => <span className="text-xs text-muted">{formatDate(r.createdAt) || "—"}</span> },
  ];

  return (
    <section className="rounded-3xl border border-border-subtle bg-white p-5 shadow-sm md:p-6">
      <div className="mb-4">
        <h3 className="font-bold text-ink">Student directory</h3>
        <p className="mt-1 text-xs text-muted">Search by ID, name, email, or phone · filter by status · export the current view.</p>
      </div>
      <DataTable
        title="students"
        name="students"
        columns={columns}
        rows={students}
        initialSort={{ key: "createdAt", dir: "desc" }}
        pageSize={10}
        emptyLabel="No students have been created yet."
        rowActions={(item) => (
          <>
            <button type="button" onClick={() => onView(item)} className="rounded-lg bg-info px-2.5 py-1.5 text-[11px] font-bold text-white hover:opacity-90">View</button>
            <button type="button" onClick={() => onEdit(item)} className="rounded-lg border border-border-subtle px-2.5 py-1.5 text-[11px] font-bold text-ink hover:bg-page">Edit</button>
            {item.status === "pending" ? (
              <>
                <button type="button" onClick={() => onApprove(item)} className="rounded-lg border border-border-subtle px-2.5 py-1.5 text-[11px] font-bold text-success hover:bg-page">Approve</button>
                <button type="button" onClick={() => onReject(item)} className="rounded-lg border border-border-subtle px-2.5 py-1.5 text-[11px] font-bold text-primary hover:bg-page">Reject</button>
              </>
            ) : item.active !== false ? (
              <button type="button" onClick={() => onDeactivate(item)} className="rounded-lg border border-border-subtle px-2.5 py-1.5 text-[11px] font-bold text-primary hover:bg-page">Deactivate</button>
            ) : null}
          </>
        )}
      />
    </section>
  );
}
