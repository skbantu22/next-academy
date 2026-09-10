"use client";

import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

const typeColors = {
  Workshop: "bg-info-soft text-info", Orientation: "bg-purple-soft text-purple",
  "Team Building": "bg-success-soft text-success", "CSR Activity": "bg-teal-soft text-teal",
  Seminar: "bg-active text-primary", Meeting: "bg-page text-ink",
  Training: "bg-warning-soft text-warning", Other: "bg-page text-muted",
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

function EventChip({ event, onSelect }) {
  return (
    <button
      type="button"
      onClick={() => onSelect(event)}
      title={event.name}
      className={`block w-full truncate rounded px-1.5 py-0.5 text-left text-[10px] font-bold ${typeColors[event.type] || "bg-page text-muted"}`}
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
    <div className="grid grid-cols-7 gap-px overflow-hidden rounded-xl border border-border-subtle bg-border-subtle text-xs">
      {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => (
        <div key={day} className="bg-page p-2 text-center text-[10px] font-bold uppercase tracking-wider text-subtle">{day}</div>
      ))}
      {cells.map((date) => {
        const key = iso(date);
        const dayEvents = byDate.get(key) || [];
        const inMonth = date.getMonth() === month;
        return (
          <div key={key} className={`min-h-24 space-y-1 bg-white p-1.5 ${inMonth ? "" : "opacity-40"} ${key === today ? "ring-2 ring-inset ring-primary" : ""}`}>
            <p className="text-[10px] font-bold text-subtle">{date.getDate()}</p>
            {dayEvents.slice(0, 3).map((event) => <EventChip key={event.id} event={event} onSelect={onSelect} />)}
            {dayEvents.length > 3 && <p className="text-[9px] font-bold text-subtle">+{dayEvents.length - 3} more</p>}
          </div>
        );
      })}
    </div>
  );
}

function WeekView({ cursor, byDate, onSelect }) {
  const start = startOfWeek(cursor);
  const days = Array.from({ length: 7 }, (_, i) => { const d = new Date(start); d.setDate(start.getDate() + i); return d; });
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-7">
      {days.map((date) => {
        const key = iso(date);
        const dayEvents = (byDate.get(key) || []).sort((a, b) => (a.startTime || "").localeCompare(b.startTime || ""));
        return (
          <div key={key} className="rounded-xl border border-border-subtle bg-white p-3">
            <p className="text-[10px] font-bold uppercase tracking-wider text-subtle">{date.toLocaleDateString(undefined, { weekday: "short", day: "numeric" })}</p>
            <div className="mt-2 space-y-1">
              {dayEvents.length ? dayEvents.map((event) => <EventChip key={event.id} event={event} onSelect={onSelect} />) : <p className="text-[10px] text-subtle">No events</p>}
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
    <div className="space-y-2 rounded-xl border border-border-subtle bg-white p-4">
      <p className="text-sm font-bold text-ink">{cursor.toLocaleDateString(undefined, { weekday: "long", year: "numeric", month: "long", day: "numeric" })}</p>
      {dayEvents.length ? (
        <div className="space-y-2">
          {dayEvents.map((event) => (
            <button key={event.id} type="button" onClick={() => onSelect(event)} className="flex w-full items-center justify-between rounded-xl bg-page p-3 text-left text-xs hover:bg-active">
              <span><b className="block text-ink">{event.name}</b><span className="text-subtle">{event.startTime}–{event.endTime} · {event.location || "No location set"}</span></span>
              <span className={`rounded-full px-2 py-1 text-[10px] font-bold ${typeColors[event.type] || "bg-page text-muted"}`}>{event.type}</span>
            </button>
          ))}
        </div>
      ) : (
        <p className="py-6 text-center text-sm text-muted">No events on this day.</p>
      )}
    </div>
  );
}

export default function EventCalendar({ events, onSelectEvent }) {
  const [view, setView] = useState("month");
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
        : cursor.toLocaleDateString();

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <button type="button" onClick={() => shift(-1)} className="rounded-lg border border-border-subtle p-2 hover:bg-active" aria-label="Previous"><ChevronLeft className="h-4 w-4" /></button>
          <p className="min-w-40 text-sm font-bold text-ink">{label}</p>
          <button type="button" onClick={() => shift(1)} className="rounded-lg border border-border-subtle p-2 hover:bg-active" aria-label="Next"><ChevronRight className="h-4 w-4" /></button>
          <button type="button" onClick={() => setCursor(new Date())} className="rounded-lg border border-border-subtle px-3 py-2 text-xs font-bold text-muted hover:bg-active">Today</button>
        </div>
        <div className="flex gap-2">
          {["month", "week", "day"].map((item) => (
            <button key={item} type="button" onClick={() => setView(item)} className={`rounded-full px-3 py-1.5 text-xs font-bold capitalize transition ${view === item ? "bg-primary text-white" : "bg-page text-muted hover:bg-active hover:text-primary"}`}>
              {item}
            </button>
          ))}
        </div>
      </div>
      {view === "month" && <MonthView cursor={cursor} byDate={byDate} onSelect={onSelectEvent} />}
      {view === "week" && <WeekView cursor={cursor} byDate={byDate} onSelect={onSelectEvent} />}
      {view === "day" && <DayView cursor={cursor} byDate={byDate} onSelect={onSelectEvent} />}
    </div>
  );
}
