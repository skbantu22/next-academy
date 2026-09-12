"use client";

import { useMemo, useState } from "react";
import { CalendarDays, ChevronLeft, ChevronRight, Clock, MapPin } from "lucide-react";

// Category/status chips reuse the app's existing semantic color tokens
// (success/info/purple/warning/primary) — already saturated enough to read
// as clear, colorful badges on the calendar's dark card surface below.
const typeTones = {
  Workshop: "bg-info-soft text-info", Orientation: "bg-purple-soft text-purple",
  "Team Building": "bg-success-soft text-success", "CSR Activity": "bg-teal-soft text-teal",
  Seminar: "bg-active text-primary", Meeting: "bg-page text-ink",
  Training: "bg-warning-soft text-warning", Other: "bg-page text-muted",
};
const statusTones = {
  Upcoming: "bg-info-soft text-info", Ongoing: "bg-success-soft text-success",
  Completed: "bg-page text-subtle", Cancelled: "bg-active text-primary", Draft: "bg-warning-soft text-warning",
};

const iso = (date) => date.toISOString().slice(0, 10);
const startOfWeek = (date) => { const d = new Date(date); d.setDate(d.getDate() - d.getDay()); return d; };

function eventsByDate(events) {
  const map = new Map();
  events.forEach((event) => {
    if (!event.eventDate) return;
    if (!map.has(event.eventDate)) map.set(event.eventDate, []);
    map.get(event.eventDate).push(event);
  });
  return map;
}

// Structural (non-accent) classes for the calendar's own dark-navy surface —
// this is a self-contained skin scoped to just this component (the rest of
// the Event Organization page — stats/charts/table/tabs — is untouched and
// stays on the app's normal light theme). Category/status chip colors above
// are unchanged; only the grid/card/border/text structure below is new.
const tone = {
  card: "bg-[#151922]",
  cardHover: "hover:bg-[#1c212c]",
  cell: "bg-[#171b24]",
  border: "border-white/[0.06]",
  ink: "text-white",
  muted: "text-slate-300",
  subtle: "text-slate-400",
  outOfMonth: "opacity-35",
  todayCell: "bg-[#1b2130] border-white/10",
  todayBadge: "bg-red-500 text-white",
  navBtn: "bg-[#1c212c] text-slate-300 hover:bg-[#252b38] hover:text-white",
  viewBtnActive: "bg-emerald-500 text-[#06170f]",
  viewBtnInactive: "bg-[#1c212c] text-slate-400 hover:text-white",
  emptyText: "text-slate-400",
};

function EventChip({ event, onSelect }) {
  return (
    <button
      type="button"
      onClick={() => onSelect(event)}
      title={event.name}
      className={`block w-full truncate rounded-md px-1 py-0.5 text-left text-[9px] font-bold leading-tight sm:text-[10px] ${typeTones[event.type] || "bg-white/10 text-white"}`}
    >
      {event.startTime ? `${event.startTime} ` : ""}{event.name}
    </button>
  );
}

function MonthView({ cursor, byDate, onSelect }) {
  const year = cursor.getFullYear();
  const month = cursor.getMonth();
  const firstDay = new Date(year, month, 1);
  const gridStart = startOfWeek(firstDay);
  const cells = Array.from({ length: 42 }, (_, i) => {
    const date = new Date(gridStart);
    date.setDate(gridStart.getDate() + i);
    return date;
  });
  const today = iso(new Date());

  return (
    <div>
      <div className="grid grid-cols-7 gap-1">
        {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => (
          <div key={day} className="p-0.5 text-center text-[9px] font-bold uppercase tracking-wider text-slate-400 sm:text-[10px]">{day}</div>
        ))}
      </div>
      <div className="mt-1 grid grid-cols-7 gap-1 [grid-auto-rows:56px] sm:[grid-auto-rows:70px]">
        {cells.map((date) => {
          const key = iso(date);
          const dayEvents = byDate.get(key) || [];
          const inMonth = date.getMonth() === month;
          const isToday = key === today;
          return (
            <div
              key={key}
              className={`space-y-0.5 overflow-hidden rounded-lg border p-1 sm:rounded-xl ${isToday ? tone.todayCell : `${tone.cell} ${tone.border}`} ${inMonth ? "" : tone.outOfMonth}`}
            >
              {isToday ? (
                <span className={`flex h-4 w-4 items-center justify-center rounded-full text-[10px] font-bold sm:h-5 sm:w-5 sm:text-xs ${tone.todayBadge}`}>{date.getDate()}</span>
              ) : (
                <p className={`text-[10px] font-bold sm:text-xs ${inMonth ? tone.muted : tone.subtle}`}>{date.getDate()}</p>
              )}
              <div className="space-y-0.5">
                {dayEvents.slice(0, 2).map((event) => <EventChip key={event.id} event={event} onSelect={onSelect} />)}
                {dayEvents.length > 2 && <p className="text-[8px] font-bold text-slate-400 sm:text-[9px]">+{dayEvents.length - 2} more</p>}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function WeekView({ cursor, byDate, onSelect }) {
  const start = startOfWeek(cursor);
  const days = Array.from({ length: 7 }, (_, i) => { const d = new Date(start); d.setDate(start.getDate() + i); return d; });
  return (
    <div className="grid grid-cols-1 gap-2 sm:grid-cols-7">
      {days.map((date) => {
        const key = iso(date);
        const dayEvents = (byDate.get(key) || []).sort((a, b) => (a.startTime || "").localeCompare(b.startTime || ""));
        return (
          <div key={key} className={`rounded-xl border ${tone.border} ${tone.cell} p-2.5`}>
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">{date.toLocaleDateString(undefined, { weekday: "short", day: "numeric" })}</p>
            <div className="mt-2 space-y-1">
              {dayEvents.length ? dayEvents.map((event) => <EventChip key={event.id} event={event} onSelect={onSelect} />) : <p className="text-[10px] text-slate-500">No events</p>}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function DayView({ cursor, byDate, onSelect }) {
  const dayEvents = (byDate.get(iso(cursor)) || []).sort((a, b) => (a.startTime || "").localeCompare(b.startTime || ""));
  return (
    <div className={`space-y-2 rounded-xl border ${tone.border} ${tone.cell} p-4`}>
      <p className="text-sm font-bold text-white">{cursor.toLocaleDateString(undefined, { weekday: "long", year: "numeric", month: "long", day: "numeric" })}</p>
      {dayEvents.length ? (
        <div className="space-y-2">
          {dayEvents.map((event) => (
            <button key={event.id} type="button" onClick={() => onSelect(event)} className={`flex w-full items-center justify-between rounded-xl ${tone.card} p-3 text-left text-xs ${tone.cardHover}`}>
              <span><b className="block text-white">{event.name}</b><span className="text-slate-400">{event.startTime}–{event.endTime} · {event.location || "No location set"}</span></span>
              <span className={`rounded-full px-2 py-1 text-[10px] font-bold ${typeTones[event.type] || "bg-white/10 text-white"}`}>{event.type}</span>
            </button>
          ))}
        </div>
      ) : (
        <p className={`py-6 text-center text-sm ${tone.emptyText}`}>No events on this day.</p>
      )}
    </div>
  );
}

// Flat, chronological list of every event in view — the "at minimum, Month
// and List must work" requirement. Not date-scoped to the cursor like the
// other three views (a list is most useful showing everything at once).
function ListView({ events, onSelect }) {
  const sorted = useMemo(
    () => [...events].sort((a, b) => (a.eventDate || "").localeCompare(b.eventDate || "") || (a.startTime || "").localeCompare(b.startTime || "")),
    [events],
  );
  if (!sorted.length) return <p className={`py-10 text-center text-sm ${tone.emptyText}`}>No events to show.</p>;
  return (
    <div className={`overflow-hidden rounded-xl border ${tone.border} ${tone.cell}`}>
      {sorted.map((event) => (
        <button
          key={event.id}
          type="button"
          onClick={() => onSelect(event)}
          className={`flex w-full flex-wrap items-center justify-between gap-3 border-b ${tone.border} p-3.5 text-left last:border-0 ${tone.cardHover}`}
        >
          <span className="min-w-0">
            <span className="mb-1 flex items-center gap-2 text-[10px] font-bold uppercase tracking-wider text-slate-400">
              <CalendarDays className="h-3 w-3" />
              {new Date(`${event.eventDate}T00:00:00`).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}
              {event.startTime && (
                <>
                  <Clock className="ml-1.5 h-3 w-3" />
                  {event.startTime}{event.endTime ? `–${event.endTime}` : ""}
                </>
              )}
            </span>
            <b className="block truncate text-white">{event.name}</b>
            {event.location && (
              <span className="mt-0.5 flex items-center gap-1 text-xs text-slate-400">
                <MapPin className="h-3 w-3 shrink-0" />
                {event.location}
              </span>
            )}
          </span>
          <span className="flex shrink-0 flex-wrap items-center gap-1.5">
            <span className={`rounded-full px-2 py-1 text-[10px] font-bold ${typeTones[event.type] || "bg-white/10 text-white"}`}>{event.type}</span>
            {event.computedStatus && <span className={`rounded-full px-2 py-1 text-[10px] font-bold ${statusTones[event.computedStatus] || "bg-white/10 text-white"}`}>{event.computedStatus}</span>}
          </span>
        </button>
      ))}
    </div>
  );
}

// Reusable Month / Week / Day / List calendar used by the shared Event
// Organization page (Director/Teacher/Student alike). Only this component's
// own visual skin is dark-navy/rounded to match the reference design; the
// rest of the Event Organization page (stats, charts, table, tabs) is
// unaffected and stays on the app's normal light theme. All view/date-
// navigation logic is unchanged from before this restyle.
export default function EventCalendar({ events, onSelectEvent, views = ["month", "week", "day", "list"] }) {
  const [view, setView] = useState(views[0] || "month");
  const [cursor, setCursor] = useState(() => new Date());
  const byDate = useMemo(() => eventsByDate(events), [events]);

  function shift(amount) {
    const next = new Date(cursor);
    if (view === "month") next.setMonth(next.getMonth() + amount);
    else if (view === "week") next.setDate(next.getDate() + amount * 7);
    else next.setDate(next.getDate() + amount);
    setCursor(next);
  }

  const label =
    view === "month"
      ? cursor.toLocaleDateString(undefined, { month: "long", year: "numeric" })
      : view === "week"
        ? `Week of ${startOfWeek(cursor).toLocaleDateString()}`
        : view === "day"
          ? cursor.toLocaleDateString(undefined, { month: "long", day: "numeric", year: "numeric" })
          : "All events";

  return (
    <div className={`space-y-2 rounded-2xl border ${tone.border} ${tone.card} p-2 sm:space-y-2.5 sm:p-3`}>
      <div className="flex flex-wrap items-center justify-between gap-2 sm:gap-3">
        <p className="text-sm font-bold text-white sm:text-lg">{label}</p>
        <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
          {view !== "list" && (
            <div className="flex items-center gap-1">
              <button type="button" onClick={() => shift(-1)} className={`rounded-lg p-1.5 sm:p-2 ${tone.navBtn}`} aria-label="Previous"><ChevronLeft className="h-3.5 w-3.5 sm:h-4 sm:w-4" /></button>
              <button type="button" onClick={() => setCursor(new Date())} className={`rounded-lg px-2 py-1.5 text-[10px] font-bold sm:px-3 sm:text-xs ${tone.navBtn}`}>Today</button>
              <button type="button" onClick={() => shift(1)} className={`rounded-lg p-1.5 sm:p-2 ${tone.navBtn}`} aria-label="Next"><ChevronRight className="h-3.5 w-3.5 sm:h-4 sm:w-4" /></button>
            </div>
          )}
          <div className="flex gap-1">
            {views.map((item) => (
              <button
                key={item}
                type="button"
                onClick={() => setView(item)}
                className={`rounded-full px-2 py-1 text-[10px] font-bold capitalize transition sm:px-3 sm:py-1.5 sm:text-xs ${view === item ? tone.viewBtnActive : tone.viewBtnInactive}`}
              >
                {item}
              </button>
            ))}
          </div>
        </div>
      </div>
      {view === "month" && <MonthView cursor={cursor} byDate={byDate} onSelect={onSelectEvent} />}
      {view === "week" && <WeekView cursor={cursor} byDate={byDate} onSelect={onSelectEvent} />}
      {view === "day" && <DayView cursor={cursor} byDate={byDate} onSelect={onSelectEvent} />}
      {view === "list" && <ListView events={events} onSelect={onSelectEvent} />}
    </div>
  );
}
