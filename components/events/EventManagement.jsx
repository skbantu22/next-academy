"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { CalendarDays, Eye, EyeOff, MapPin, Pencil, Search, Trash2, UserRound, Users } from "lucide-react";
import { ChartCard, EmptyChartState } from "../dashboard/overview/ChartCard";
import EventCalendar from "./EventCalendar";
import EventForm from "./EventForm";
import DataTable, { StatusBadge as TableBadge } from "../data-table/DataTable";
import { createEvent, deleteEvent, loadEvents, setEventPublished, updateEvent, uploadEventBanner } from "../../lib/services/event-service";
import { subscribeAllEvents } from "../../lib/admin-events-data";
import { computeEventStatus, FILTER_STATUSES } from "../../lib/events-shared";

const CHART_COLORS = ["#FF2D2D", "#F59E0B", "#22C55E", "#3B82F6", "#A855F7", "#14B8A6", "#EC4899", "#98A2B3"];
const statusTones = {
  Upcoming: "bg-info-soft text-info", Ongoing: "bg-success-soft text-success",
  Completed: "bg-page text-subtle", Cancelled: "bg-active text-primary", Draft: "bg-warning-soft text-warning",
};
function StatusBadge({ value }) {
  return <span className={`rounded-full px-2.5 py-1 text-[10px] font-bold ${statusTones[value] || "bg-page text-muted"}`}>{value}</span>;
}
function EventThumbnail({ event }) {
  return (
    <div className="relative aspect-[16/10] w-full shrink-0 overflow-hidden bg-page">
      {event.bannerUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={event.bannerUrl} alt={event.name} className="h-full w-full object-cover" />
      ) : (
        <div className="flex h-full w-full flex-col items-center justify-center gap-1.5 bg-[linear-gradient(135deg,#fff5f5_0%,#ffffff_65%)] text-subtle">
          <CalendarDays className="h-7 w-7" aria-hidden="true" />
          <span className="text-[10px] font-bold uppercase tracking-widest">No thumbnail</span>
        </div>
      )}
      <span className="absolute right-2.5 top-2.5"><StatusBadge value={event.computedStatus} /></span>
      {event.type && (
        <span className="absolute bottom-2.5 left-2.5 rounded-md bg-slate-900/75 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-white">
          {event.type}
        </span>
      )}
    </div>
  );
}

function EventCard({ event, onEdit, onTogglePublish, onDelete }) {
  const timeLabel = event.startTime ? `${event.startTime}${event.endTime ? `–${event.endTime}` : ""}` : null;
  return (
    <article className="flex flex-col overflow-hidden rounded-2xl border border-border-subtle bg-white shadow-sm transition hover:shadow-md">
      <EventThumbnail event={event} />
      <div className="flex flex-1 flex-col p-4">
        <h3 className="truncate text-sm font-bold text-ink" title={event.name}>{event.name}</h3>
        <div className="mt-2 space-y-1.5 text-xs text-muted">
          <p className="flex items-center gap-1.5">
            <CalendarDays className="h-3.5 w-3.5 shrink-0 text-subtle" aria-hidden="true" />
            <span className="truncate">{event.eventDate || "—"}{timeLabel ? ` · ${timeLabel}` : ""}</span>
          </p>
          {event.location && (
            <p className="flex items-center gap-1.5">
              <MapPin className="h-3.5 w-3.5 shrink-0 text-subtle" aria-hidden="true" />
              <span className="truncate">{event.location}</span>
            </p>
          )}
          <p className="flex items-center gap-1.5">
            <Users className="h-3.5 w-3.5 shrink-0 text-subtle" aria-hidden="true" />
            {event.participantCount ?? 0}{event.maxParticipants != null ? ` / ${event.maxParticipants}` : ""} registered
          </p>
          {event.organizer && (
            <p className="flex items-center gap-1.5">
              <UserRound className="h-3.5 w-3.5 shrink-0 text-subtle" aria-hidden="true" />
              <span className="truncate">{event.organizer}</span>
            </p>
          )}
        </div>
        <div className="mt-3 flex items-center justify-between gap-2 border-t border-border-subtle pt-3">
          <Link href={`/dashboard/events/${event.id}`} className="rounded-lg bg-primary px-3 py-1.5 text-xs font-bold text-white hover:bg-primary-hover">View</Link>
          <div className="flex items-center gap-0.5">
            <button type="button" title="Edit" aria-label="Edit event" onClick={() => onEdit(event)} className="rounded-lg p-1.5 text-muted hover:bg-active hover:text-primary">
              <Pencil className="h-4 w-4" aria-hidden="true" />
            </button>
            <button type="button" title={event.published ? "Unpublish" : "Publish"} aria-label={event.published ? "Unpublish event" : "Publish event"} onClick={() => onTogglePublish(event)} className="rounded-lg p-1.5 text-muted hover:bg-active hover:text-info">
              {event.published ? <EyeOff className="h-4 w-4" aria-hidden="true" /> : <Eye className="h-4 w-4" aria-hidden="true" />}
            </button>
            <button type="button" title="Delete" aria-label="Delete event" onClick={() => onDelete(event)} className="rounded-lg p-1.5 text-muted hover:bg-active hover:text-primary">
              <Trash2 className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>
        </div>
      </div>
    </article>
  );
}

function Dialog({ title, children, onClose }) {
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/60 p-4" role="dialog" aria-modal="true">
      <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-3xl bg-white p-6 shadow-2xl">
        <div className="mb-5 flex items-center justify-between"><h2 className="text-lg font-bold text-ink">{title}</h2><button type="button" onClick={onClose} className="text-xl text-muted" aria-label="Close">×</button></div>
        {children}
      </div>
    </div>
  );
}
const monthLabel = (key) => { const [y, m] = key.split("-").map(Number); return new Date(y, m - 1, 1).toLocaleString("en-US", { month: "short", year: "numeric" }); };
const blankForm = { name: "", type: "", description: "", eventDate: "", startTime: "", endTime: "", location: "", organizer: "", organizerId: "", maxParticipants: "", targetAudience: [], registrationRequired: false, registrationDeadline: "", status: "", published: false };

export default function EventManagement() {
  const [data, setData] = useState({ events: [], stats: null });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("All");
  const [tab, setTab] = useState("Table");
  const [form, setForm] = useState(blankForm);
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState(null);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");
  const [bannerFile, setBannerFile] = useState(null);
  const [bannerPreview, setBannerPreview] = useState("");
  const [confirmDelete, setConfirmDelete] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const result = await loadEvents();
      setData(result);
      setError("");
    } catch (loadError) {
      setData({ events: [], stats: null });
      setError(loadError.message || "Unable to load events. Please try again.");
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => { void Promise.resolve().then(load); }, [load]);
  useEffect(() => {
    if (!notice) return undefined;
    const timer = setTimeout(() => setNotice(""), 4500);
    return () => clearTimeout(timer);
  }, [notice]);

  // Live event list — real-time via Firestore's own onSnapshot listener on
  // the same academyEvents collection (no separate data source), so a
  // create/edit/publish/delete from any tab or another admin's session
  // updates every card here immediately with no manual refresh. The stats
  // cards/charts above still come from loadEvents()'s server-computed
  // aggregates (unaffected by this — see the `load()` call after each
  // mutation below), since that math isn't part of what this task changed.
  const [liveEvents, setLiveEvents] = useState([]);
  const [liveLoading, setLiveLoading] = useState(true);
  useEffect(() => {
    return subscribeAllEvents(
      (rows) => {
        setLiveEvents(rows.map((event) => ({ ...event, computedStatus: computeEventStatus(event) })));
        setLiveLoading(false);
      },
      () => setLiveLoading(false),
    );
  }, []);

  const events = useMemo(() => liveEvents
    .filter((event) =>
      (filter === "All" || event.computedStatus === filter) &&
      `${event.name} ${event.type} ${event.location} ${event.organizer}`.toLowerCase().includes(search.trim().toLowerCase()),
    )
    .sort((a, b) => (a.eventDate || "").localeCompare(b.eventDate || "") || (a.startTime || "").localeCompare(b.startTime || "")),
  [liveEvents, search, filter]);

  function selectBanner(file) {
    setBannerFile(file);
    setBannerPreview(file ? URL.createObjectURL(file) : "");
  }
  function removeBanner() {
    selectBanner(null);
    setForm((current) => ({ ...current, bannerUrl: "", bannerPath: "" }));
  }
  function open(event) {
    setEditing(event || null);
    setAdding(!event);
    setForm(
      event
        ? {
            name: event.name, type: event.type, description: event.description,
            eventDate: event.eventDate, startTime: event.startTime, endTime: event.endTime,
            location: event.location, organizer: event.organizer, organizerId: event.organizerId || "",
            maxParticipants: event.maxParticipants ?? "", targetAudience: event.targetAudience || [],
            registrationRequired: event.registrationRequired, registrationDeadline: event.registrationDeadline,
            status: event.status || "", published: event.published, bannerUrl: event.bannerUrl || "",
          }
        : { ...blankForm },
    );
    selectBanner(null);
    setFormError("");
  }
  function closeForm() {
    setEditing(null);
    setAdding(false);
    setForm(blankForm);
    selectBanner(null);
  }

  async function submit(e) {
    e.preventDefault();
    if (saving) return;
    setSaving(true);
    setFormError("");
    try {
      if (editing) {
        let bannerUrl = form.bannerUrl;
        let bannerPath = form.bannerPath;
        if (bannerFile) ({ bannerUrl, bannerPath } = await uploadEventBanner(editing.id, bannerFile));
        await updateEvent({ id: editing.id, ...form, bannerUrl, bannerPath });
        setNotice("Event updated successfully.");
      } else {
        const result = await createEvent(form);
        const created = result.event;
        if (bannerFile) {
          const { bannerUrl, bannerPath } = await uploadEventBanner(created.id, bannerFile);
          await updateEvent({ id: created.id, ...form, bannerUrl, bannerPath });
        }
        setNotice(`Event "${created.name}" created successfully.`);
      }
      closeForm();
      await load();
    } catch (saveError) {
      setFormError(saveError.message || "Unable to save this event.");
    } finally {
      setSaving(false);
    }
  }

  async function togglePublish(event) {
    try {
      await setEventPublished(event.id, !event.published);
      setNotice(event.published ? "Event unpublished." : "Event published.");
      await load();
    } catch (toggleError) {
      setError(toggleError.message || "Unable to update publish state.");
    }
  }
  async function confirmDeleteEvent() {
    if (!confirmDelete) return;
    try {
      await deleteEvent(confirmDelete.id);
      setNotice("Event deleted.");
      setConfirmDelete(null);
      await load();
    } catch (deleteError) {
      setError(deleteError.message || "Unable to delete this event.");
    }
  }

  const stats = data.stats;
  const byMonth = (stats?.byMonth || []).map((row) => ({ month: monthLabel(row.month), count: row.count }));
  const byType = stats?.byType || [];

  return (
    <div className="space-y-6">
      <section className="flex flex-wrap items-center justify-between gap-4 rounded-3xl border border-[#f3aaaa] bg-[linear-gradient(120deg,#fff0f0_0%,#fff7f7_45%,#ffffff_100%)] p-6 text-ink shadow-xl">
        <div><h2 className="text-3xl font-black">Events</h2><p className="mt-2 text-sm text-muted">Create, publish, and manage academy-wide events, workshops, and activities.</p></div>
        <button type="button" onClick={() => open(null)} className="rounded-xl bg-primary px-4 py-3 text-xs font-bold text-white">Add Event</button>
      </section>

      {notice && <p className="rounded-xl bg-success-soft p-4 text-sm text-success">{notice}</p>}
      {error && <p className="rounded-xl bg-active p-4 text-sm text-primary">{error}</p>}

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        {[["Total Events", stats?.total], ["Upcoming", stats?.upcoming], ["Ongoing", stats?.ongoing], ["Completed", stats?.completed], ["Total Participants", stats?.totalParticipants]].map(([label, value]) => (
          <article key={label} className="rounded-2xl border border-border-subtle bg-white p-5 shadow-sm">
            <p className="text-[10px] font-bold uppercase tracking-wider text-subtle">{label}</p>
            <p className="mt-2 text-2xl font-extrabold text-ink">{loading ? "—" : (value ?? 0)}</p>
          </article>
        ))}
      </section>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <ChartCard title="Events by Month" subtitle="Scheduled events across the year" icon={CalendarDays}>
          {loading ? <EmptyChartState message="Loading..." /> : byMonth.length ? (
            <div className="h-70 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={byMonth} margin={{ top: 8, right: 16, left: -16, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6" />
                  <XAxis dataKey="month" tick={{ fontSize: 11, fill: "#667085" }} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: "#667085" }} />
                  <Tooltip contentStyle={{ borderRadius: 12, border: "1px solid #e7e5e4", fontSize: 12 }} />
                  <Bar dataKey="count" name="Events" fill="#FF2D2D" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : <EmptyChartState message="No events yet" />}
        </ChartCard>
        <ChartCard title="Events by Type" subtitle="Breakdown across categories" icon={Users}>
          {loading ? <EmptyChartState message="Loading..." /> : byType.length ? (
            <div className="h-70 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={byType} dataKey="count" nameKey="type" innerRadius="50%" outerRadius="80%" paddingAngle={2}>
                    {byType.map((entry, index) => <Cell key={entry.type} fill={CHART_COLORS[index % CHART_COLORS.length]} />)}
                  </Pie>
                  <Tooltip contentStyle={{ borderRadius: 12, border: "1px solid #e7e5e4", fontSize: 12 }} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          ) : <EmptyChartState message="No events yet" />}
        </ChartCard>
      </div>

      <div className="flex gap-2">
        {["Table", "List", "Calendar"].map((item) => (
          <button key={item} type="button" onClick={() => setTab(item)} className={`rounded-full px-4 py-2 text-xs font-bold transition ${tab === item ? "bg-primary text-white" : "bg-page text-muted hover:bg-active hover:text-primary"}`}>{item}</button>
        ))}
      </div>

      {tab === "Table" ? (
        <section className="rounded-3xl border border-border-subtle bg-white p-5 shadow-sm md:p-6">
          <DataTable
            title="events"
            name="events"
            columns={[
              { key: "name", header: "Event", sortable: true, accessor: (e) => e.name || "", render: (e) => <b className="text-ink">{e.name}</b> },
              { key: "type", header: "Type", sortable: true, filter: {}, accessor: (e) => e.type || "" },
              { key: "eventDate", header: "Date", sortable: true, accessor: (e) => e.eventDate || "", render: (e) => <span className="text-xs">{e.eventDate || "—"}{e.startTime ? ` · ${e.startTime}${e.endTime ? `–${e.endTime}` : ""}` : ""}</span>, exportValue: (e) => e.eventDate || "" },
              { key: "location", header: "Location", accessor: (e) => e.location || "" },
              { key: "participantCount", header: "Registered", align: "right", sortable: true, accessor: (e) => e.participantCount ?? 0, render: (e) => `${e.participantCount ?? 0}${e.maxParticipants != null ? ` / ${e.maxParticipants}` : ""}`, exportValue: (e) => e.participantCount ?? 0 },
              { key: "organizer", header: "Organizer", sortable: true, accessor: (e) => e.organizer || "" },
              { key: "computedStatus", header: "Status", sortable: true, filter: {}, accessor: (e) => e.computedStatus || "", render: (e) => <TableBadge tone={{ Upcoming: "blue", Ongoing: "green", Completed: "gray", Cancelled: "red", Draft: "orange" }[e.computedStatus] || "gray"}>{e.computedStatus}</TableBadge> },
              { key: "published", header: "Published", sortable: true, filter: {}, accessor: (e) => (e.published ? "Published" : "Draft") },
            ]}
            rows={events}
            loading={liveLoading}
            initialSort={{ key: "eventDate", dir: "desc" }}
            pageSize={10}
            emptyLabel="No events found."
            rowActions={(event) => (
              <>
                <Link href={`/dashboard/events/${event.id}`} className="rounded-lg bg-info px-2.5 py-1.5 text-[11px] font-bold text-white hover:opacity-90">View</Link>
                <button type="button" onClick={() => open(event)} className="rounded-lg border border-border-subtle px-2.5 py-1.5 text-[11px] font-bold text-ink hover:bg-page">Edit</button>
                <button type="button" onClick={() => togglePublish(event)} className="rounded-lg border border-border-subtle px-2.5 py-1.5 text-[11px] font-bold text-info hover:bg-page">{event.published ? "Unpublish" : "Publish"}</button>
                <button type="button" onClick={() => setConfirmDelete(event)} className="rounded-lg border border-border-subtle px-2.5 py-1.5 text-[11px] font-bold text-primary hover:bg-page">Delete</button>
              </>
            )}
          />
        </section>
      ) : tab === "Calendar" ? (
        <section className="rounded-3xl border border-border-subtle bg-white p-5 shadow-sm md:p-6">
          <EventCalendar events={events} onSelectEvent={(event) => open(event)} />
        </section>
      ) : (
        <section className="rounded-3xl border border-border-subtle bg-white p-5 shadow-sm md:p-6">
          <div className="mb-5 flex flex-wrap gap-3">
            <label className="relative min-w-56 flex-1">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-subtle" />
              <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search event, type, location, organizer" className="w-full rounded-xl border border-border-subtle bg-page py-2 pl-9 pr-3 text-sm" />
            </label>
            {FILTER_STATUSES.map((item) => (
              <button key={item} type="button" onClick={() => setFilter(item)} className={`rounded-full px-3 py-1.5 text-xs font-bold transition ${filter === item ? "bg-primary text-white" : "bg-page text-muted hover:bg-active hover:text-primary"}`}>{item}</button>
            ))}
          </div>

          {liveLoading ? (
            <p className="py-10 text-center text-sm text-muted">Loading events...</p>
          ) : events.length ? (
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {events.map((event) => (
                <EventCard key={event.id} event={event} onEdit={open} onTogglePublish={togglePublish} onDelete={setConfirmDelete} />
              ))}
            </div>
          ) : (
            <p className="py-10 text-center text-sm text-muted">{search || filter !== "All" ? "No events match your search." : "No events found. Click \"Add Event\" to create the first one."}</p>
          )}
        </section>
      )}

      {(adding || editing) && (
        <Dialog title={editing ? "Edit Event" : "Add Event"} onClose={closeForm}>
          <EventForm form={form} setForm={setForm} saving={saving} error={formError} onCancel={closeForm} onSubmit={submit} bannerPreview={bannerPreview || form.bannerUrl} onBannerSelect={selectBanner} onBannerRemove={removeBanner} />
        </Dialog>
      )}

      {confirmDelete && (
        <Dialog title="Delete Event" onClose={() => setConfirmDelete(null)}>
          <p className="text-sm text-muted">Delete <b>{confirmDelete.name}</b>? This will permanently remove the event and all of its participant records. This cannot be undone.</p>
          <div className="mt-5 flex justify-end gap-3">
            <button type="button" onClick={() => setConfirmDelete(null)} className="rounded-xl px-4 py-2.5 text-sm font-bold text-muted">Cancel</button>
            <button type="button" onClick={confirmDeleteEvent} className="rounded-xl bg-primary px-4 py-2.5 text-sm font-bold text-white">Delete</button>
          </div>
        </Dialog>
      )}
    </div>
  );
}
