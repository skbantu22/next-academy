"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { CalendarDays, MapPin, Search, Users } from "lucide-react";
import { subscribePublishedEvents } from "../../lib/events-client";
import { computeEventStatus, FILTER_STATUSES } from "../../lib/events-shared";

const statusTones = { Upcoming: "bg-info-soft text-info", Ongoing: "bg-success-soft text-success", Completed: "bg-page text-subtle", Cancelled: "bg-active text-primary" };

export default function StudentEvents() {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("All");

  useEffect(() => {
    return subscribePublishedEvents(
      (rows) => {
        setEvents(rows.map((row) => ({ ...row, computedStatus: computeEventStatus(row) })));
        setLoading(false);
        setError("");
      },
      () => {
        setLoading(false);
        setError("Unable to load events. Please try again.");
      },
    );
  }, []);

  const visible = useMemo(
    () =>
      events
        .filter((event) => (filter === "All" || event.computedStatus === filter) && `${event.name} ${event.type} ${event.location}`.toLowerCase().includes(search.trim().toLowerCase()))
        .sort((a, b) => (a.eventDate || "").localeCompare(b.eventDate || "")),
    [events, search, filter],
  );

  return (
    <div className="space-y-6">
      <section className="rounded-3xl border border-[#f3aaaa] bg-[linear-gradient(120deg,#fff0f0_0%,#fff7f7_45%,#ffffff_100%)] p-6 text-ink shadow-xl">
        <h2 className="text-3xl font-black">Events</h2>
        <p className="mt-2 text-sm text-muted">Browse published academy events and manage your registrations.</p>
      </section>

      {error && <p className="rounded-xl bg-active p-4 text-sm text-primary">{error}</p>}

      <section className="rounded-3xl border border-border-subtle bg-white p-5 shadow-sm md:p-6">
        <div className="mb-5 flex flex-wrap gap-3">
          <label className="relative min-w-56 flex-1">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-subtle" />
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search events" className="w-full rounded-xl border border-border-subtle bg-page py-2 pl-9 pr-3 text-sm" />
          </label>
          {FILTER_STATUSES.map((item) => (
            <button key={item} type="button" onClick={() => setFilter(item)} className={`rounded-full px-3 py-1.5 text-xs font-bold transition ${filter === item ? "bg-primary text-white" : "bg-page text-muted hover:bg-active hover:text-primary"}`}>{item}</button>
          ))}
        </div>

        {loading ? (
          <p className="py-10 text-center text-sm text-muted">Loading events...</p>
        ) : visible.length ? (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {visible.map((event) => (
              <article key={event.id} className="flex flex-col overflow-hidden rounded-2xl border border-border-subtle bg-white shadow-sm">
                {event.bannerUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={event.bannerUrl} alt={event.name} className="h-32 w-full object-cover" />
                ) : (
                  <div className="grid h-32 w-full place-items-center bg-active text-2xl font-black text-primary">{(event.name || "E")[0].toUpperCase()}</div>
                )}
                <div className="flex flex-1 flex-col gap-2 p-4">
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-[10px] font-bold uppercase tracking-wider text-subtle">{event.type}</span>
                    <span className={`rounded-full px-2 py-1 text-[10px] font-bold ${statusTones[event.computedStatus] || "bg-page text-muted"}`}>{event.computedStatus}</span>
                  </div>
                  <h3 className="font-bold text-ink">{event.name}</h3>
                  <p className="flex items-center gap-1.5 text-xs text-muted"><CalendarDays className="h-3.5 w-3.5 text-subtle" />{event.eventDate} · {event.startTime}–{event.endTime}</p>
                  <p className="flex items-center gap-1.5 text-xs text-muted"><MapPin className="h-3.5 w-3.5 text-subtle" />{event.location || "Location TBA"}</p>
                  {event.maxParticipants != null && <p className="flex items-center gap-1.5 text-xs text-muted"><Users className="h-3.5 w-3.5 text-subtle" />{event.participantCount || 0} / {event.maxParticipants} registered</p>}
                  <Link href={`/dashboard/events/${event.id}`} className="mt-auto inline-flex items-center justify-center rounded-xl bg-primary px-4 py-2.5 text-xs font-bold text-white">View Details</Link>
                </div>
              </article>
            ))}
          </div>
        ) : (
          <p className="py-10 text-center text-sm text-muted">No published events match your search.</p>
        )}
      </section>
    </div>
  );
}
