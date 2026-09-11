"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  Building2, CalendarDays, ChevronLeft, ChevronRight, Clock, CloudOff, DoorOpen,
  GraduationCap, MapPin, Plus, Users, User, Wifi, X,
} from "lucide-react";
import { useAuth } from "../../lib/auth-context";
import {
  activeRooms as filterActiveRooms, cancelRoomBooking, createRoom, createRoomBooking,
  deleteRoom, findConflict, setRoomStatus, subscribeClasses, subscribeCourses,
  subscribeRoomBookings, subscribeRooms, subscribeTeachers, updateRoom, updateRoomBooking, ymd,
} from "../../lib/room-booking-data";

const MANAGER_ROLES = new Set(["Admin", "Director"]);
const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const ROOM_TYPES = ["Classroom", "Computer Lab", "Science Lab", "Meeting Room", "Auditorium", "Studio", "Workshop", "Seminar Room"];

// Colour is only a glance-hint (the room name is always shown), so a stable
// hash of the room id into a small palette scales to any number of rooms.
const PALETTE = [
  { chip: "bg-info-soft text-info", dot: "bg-info" },
  { chip: "bg-success-soft text-success", dot: "bg-success" },
  { chip: "bg-warning-soft text-warning", dot: "bg-warning" },
  { chip: "bg-purple-soft text-purple", dot: "bg-purple" },
  { chip: "bg-teal-soft text-teal", dot: "bg-teal" },
  { chip: "bg-active text-primary", dot: "bg-primary" },
];
function hashString(value) {
  let hash = 0;
  for (let i = 0; i < value.length; i += 1) hash = (hash * 31 + value.charCodeAt(i)) | 0;
  return Math.abs(hash);
}
const roomStyle = (roomId) => PALETTE[hashString(roomId || "") % PALETTE.length];

function to12h(value) {
  if (!/^\d{2}:\d{2}$/.test(value || "")) return value || "";
  const [h, m] = value.split(":").map(Number);
  const period = h >= 12 ? "PM" : "AM";
  const hour = h % 12 === 0 ? 12 : h % 12;
  return `${hour}:${String(m).padStart(2, "0")} ${period}`;
}
const timeRange = (booking) => `${to12h(booking.startTime)} – ${to12h(booking.endTime)}`;

function prettyDate(iso, opts = { weekday: "short", month: "short", day: "numeric" }) {
  const date = new Date(`${iso}T00:00:00`);
  return Number.isNaN(date.getTime()) ? iso : date.toLocaleDateString("en-US", opts);
}

function useOnlineStatus() {
  const [online, setOnline] = useState(() => (typeof navigator === "undefined" ? true : navigator.onLine));
  useEffect(() => {
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    return () => {
      window.removeEventListener("online", on);
      window.removeEventListener("offline", off);
    };
  }, []);
  return online;
}

function Modal({ title, children, onClose, wide }) {
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/60 p-4" role="dialog" aria-modal="true">
      <div className={`max-h-[92vh] w-full overflow-y-auto rounded-3xl bg-white p-5 shadow-2xl sm:p-6 ${wide ? "max-w-2xl" : "max-w-lg"}`}>
        <div className="mb-4 flex items-center justify-between gap-4">
          <h2 className="text-lg font-bold text-ink">{title}</h2>
          <button type="button" onClick={onClose} className="rounded-lg p-1 text-muted hover:bg-page" aria-label="Close">
            <X className="h-5 w-5" />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

const LABEL = "grid gap-1 text-xs font-bold text-muted";
const FIELD = "rounded-xl border border-border-subtle bg-white px-3 py-2.5 text-sm font-normal text-ink outline-none focus:ring-2 focus:ring-primary";

// ---------------------------------------------------------------------------
// Room management (the "Rooms" tab)
// ---------------------------------------------------------------------------
const BLANK_ROOM = { name: "", code: "", capacity: "", building: "", floor: "", roomType: "", facilities: "", status: "active" };

function RoomForm({ initial, editingId, onClose, onSaved }) {
  const [form, setForm] = useState(() => ({ ...BLANK_ROOM, ...initial }));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const set = (key) => (event) => setForm((current) => ({ ...current, [key]: event.target.value }));

  async function submit(event) {
    event.preventDefault();
    if (saving) return;
    setSaving(true);
    setError("");
    try {
      if (editingId) await updateRoom(editingId, form);
      else await createRoom(form);
      onSaved(editingId ? "Room updated." : `${form.name.trim() || "Room"} added.`);
    } catch (submitError) {
      setError(submitError?.message || "Could not save this room.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <label className={LABEL}>Room name<input value={form.name} onChange={set("name")} required maxLength={120} placeholder="Room A" className={FIELD} /></label>
        <label className={LABEL}>Room number / code<input value={form.code} onChange={set("code")} maxLength={60} placeholder="A-201" className={FIELD} /></label>
        <label className={LABEL}>Capacity<input type="number" min="0" value={form.capacity} onChange={set("capacity")} placeholder="40" className={FIELD} /></label>
        <label className={LABEL}>
          Room type
          <input list="rb-room-types" value={form.roomType} onChange={set("roomType")} maxLength={80} placeholder="Classroom" className={FIELD} />
          <datalist id="rb-room-types">{ROOM_TYPES.map((type) => <option key={type} value={type} />)}</datalist>
        </label>
        <label className={LABEL}>Building / location<input value={form.building} onChange={set("building")} maxLength={160} placeholder="Main Campus" className={FIELD} /></label>
        <label className={LABEL}>Floor<input value={form.floor} onChange={set("floor")} maxLength={60} placeholder="2" className={FIELD} /></label>
      </div>
      <label className={LABEL}>
        Facilities <span className="font-normal text-subtle">(comma separated)</span>
        <input value={form.facilities} onChange={set("facilities")} placeholder="Projector, AC, Whiteboard" className={FIELD} />
      </label>
      <label className={LABEL}>
        Status
        <select value={form.status} onChange={set("status")} className={FIELD}>
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
        </select>
      </label>
      {error && <p className="rounded-xl bg-active px-3 py-2 text-sm text-primary">{error}</p>}
      <div className="flex justify-end gap-3 pt-1">
        <button type="button" onClick={onClose} disabled={saving} className="rounded-xl px-4 py-2.5 text-sm font-bold text-muted">Cancel</button>
        <button disabled={saving} className="rounded-xl bg-primary px-5 py-2.5 text-sm font-bold text-white disabled:opacity-50">{saving ? "Saving…" : editingId ? "Save changes" : "Add room"}</button>
      </div>
    </form>
  );
}

function RoomsManager({ rooms, bookings, onNotice }) {
  const [formState, setFormState] = useState(null); // { initial, editingId } | null
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [error, setError] = useState("");

  const upcomingByRoom = useMemo(() => {
    const today = ymd(new Date());
    const map = new Map();
    bookings.forEach((booking) => {
      if (booking.status === "cancelled" || booking.date < today) return;
      map.set(booking.roomId, (map.get(booking.roomId) || 0) + 1);
    });
    return map;
  }, [bookings]);

  async function toggle(room) {
    setError("");
    try {
      await setRoomStatus(room.id, room.status === "active" ? "inactive" : "active");
      onNotice(room.status === "active" ? `${room.name} deactivated.` : `${room.name} reactivated.`);
    } catch (toggleError) {
      setError(toggleError?.message || "Could not update this room.");
    }
  }
  async function remove() {
    if (!confirmDelete) return;
    setError("");
    try {
      await deleteRoom(confirmDelete.id);
      onNotice(`${confirmDelete.name} deleted.`);
      setConfirmDelete(null);
    } catch (deleteError) {
      setError(deleteError?.message || "Could not delete this room.");
      setConfirmDelete(null);
    }
  }

  return (
    <section className="space-y-4 rounded-3xl border border-border-subtle bg-white p-4 shadow-sm md:p-5">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h3 className="font-bold text-ink">Rooms</h3>
          <p className="text-xs text-muted">{rooms.length} room{rooms.length === 1 ? "" : "s"} · {filterActiveRooms(rooms).length} active. Every filter, form and calendar column below is built from this list.</p>
        </div>
        <button type="button" onClick={() => setFormState({ initial: BLANK_ROOM, editingId: null })} className="flex items-center gap-1.5 rounded-xl bg-primary px-4 py-2.5 text-xs font-bold text-white">
          <Plus className="h-4 w-4" /> Add Room
        </button>
      </div>
      {error && <p className="rounded-xl bg-active p-3 text-sm text-primary">{error}</p>}

      {!rooms.length ? (
        <p className="rounded-2xl border border-dashed border-border-subtle py-12 text-center text-sm text-muted">No rooms yet. Add your first classroom to start booking.</p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-border-subtle">
          <table className="w-full min-w-[760px] text-left text-sm">
            <thead className="border-b border-border-subtle bg-page text-[10px] uppercase tracking-wider text-subtle">
              <tr>{["Room", "Code", "Capacity", "Building", "Floor", "Type", "Facilities", "Status", "Actions"].map((head) => <th key={head} className="p-3">{head}</th>)}</tr>
            </thead>
            <tbody>
              {rooms.map((room) => (
                <tr key={room.id} className="border-b border-border-subtle last:border-0 align-top">
                  <td className="p-3">
                    <span className="flex items-center gap-2 font-semibold text-ink">
                      <span className={`h-2.5 w-2.5 rounded-full ${roomStyle(room.id).dot}`} /> {room.name}
                    </span>
                  </td>
                  <td className="p-3 text-muted">{room.code || "—"}</td>
                  <td className="p-3 text-muted">{room.capacity ?? "—"}</td>
                  <td className="p-3 text-muted">{room.building || "—"}</td>
                  <td className="p-3 text-muted">{room.floor || "—"}</td>
                  <td className="p-3 text-muted">{room.roomType || "—"}</td>
                  <td className="p-3">
                    {room.facilities.length ? (
                      <span className="flex flex-wrap gap-1">
                        {room.facilities.map((facility) => <span key={facility} className="rounded-full bg-page px-2 py-0.5 text-[10px] font-semibold text-muted">{facility}</span>)}
                      </span>
                    ) : <span className="text-muted">—</span>}
                  </td>
                  <td className="p-3">
                    <span className={`rounded-full px-2.5 py-1 text-[10px] font-bold ${room.status === "active" ? "bg-success-soft text-success" : "bg-page text-muted"}`}>
                      {room.status === "active" ? "Active" : "Inactive"}
                    </span>
                  </td>
                  <td className="whitespace-nowrap p-3 text-xs font-bold">
                    <button type="button" onClick={() => setFormState({ initial: { ...room, capacity: room.capacity ?? "", facilities: room.facilities.join(", ") }, editingId: room.id })} className="text-muted hover:text-primary">Edit</button>
                    <button type="button" onClick={() => toggle(room)} className="ml-3 text-info hover:underline">{room.status === "active" ? "Deactivate" : "Activate"}</button>
                    <button
                      type="button"
                      onClick={() => (upcomingByRoom.get(room.id) ? setError(`${room.name} has ${upcomingByRoom.get(room.id)} upcoming booking(s). Deactivate it instead of deleting.`) : setConfirmDelete(room))}
                      className="ml-3 text-primary hover:underline"
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {formState && (
        <Modal title={formState.editingId ? "Edit room" : "Add a room"} onClose={() => setFormState(null)} wide>
          <RoomForm
            initial={formState.initial}
            editingId={formState.editingId}
            onClose={() => setFormState(null)}
            onSaved={(message) => { setFormState(null); onNotice(message); }}
          />
        </Modal>
      )}
      {confirmDelete && (
        <Modal title="Delete room" onClose={() => setConfirmDelete(null)}>
          <p className="text-sm text-muted">Delete <b>{confirmDelete.name}</b>? Past bookings keep their room name for history, but the room won&apos;t be selectable any more.</p>
          <div className="mt-5 flex justify-end gap-3">
            <button type="button" onClick={() => setConfirmDelete(null)} className="rounded-xl px-4 py-2.5 text-sm font-bold text-muted">Cancel</button>
            <button type="button" onClick={remove} className="rounded-xl bg-primary px-4 py-2.5 text-sm font-bold text-white">Delete</button>
          </div>
        </Modal>
      )}
    </section>
  );
}

// ---------------------------------------------------------------------------
// Booking form
// ---------------------------------------------------------------------------
const BLANK_BOOKING = { roomId: "", courseId: "", classId: "", teacherId: "", date: "", startTime: "", endTime: "", notes: "" };

function BookingForm({ initial, editingId, rooms, courses, classes, teachers, allBookings, onClose, onSaved }) {
  const [form, setForm] = useState(() => ({ ...BLANK_BOOKING, ...initial }));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const { profile, user } = useAuth();

  // Active rooms + (when editing) the booking's current room even if it was
  // since deactivated, so an edit never silently drops the room.
  const roomOptions = useMemo(() => {
    const active = filterActiveRooms(rooms);
    if (form.roomId && !active.some((room) => room.id === form.roomId)) {
      const current = rooms.find((room) => room.id === form.roomId);
      if (current) return [...active, current].sort((a, b) => a.name.localeCompare(b.name));
    }
    return active;
  }, [rooms, form.roomId]);

  const set = (key) => (event) => {
    const value = event.target.value;
    setForm((current) => {
      const next = { ...current, [key]: value };
      if (key === "courseId" && current.classId) {
        const stillValid = classes.some((batch) => batch.id === current.classId && batch.courseId === value);
        if (!stillValid) next.classId = "";
      }
      if (key === "classId" && value) {
        const batch = classes.find((entry) => entry.id === value);
        const suggested = batch?.teacherIds?.[0] || courses.find((course) => course.id === next.courseId)?.primaryTeacherId || "";
        if (suggested && !next.teacherId) next.teacherId = suggested;
      }
      return next;
    });
  };

  const courseClasses = useMemo(() => classes.filter((batch) => batch.courseId === form.courseId), [classes, form.courseId]);

  const liveConflict = useMemo(() => {
    if (!form.roomId || !form.date || !/^\d{2}:\d{2}$/.test(form.startTime) || !/^\d{2}:\d{2}$/.test(form.endTime)) return null;
    if (form.endTime <= form.startTime) return null;
    return findConflict(allBookings, form, editingId);
  }, [allBookings, form, editingId]);

  async function submit(event) {
    event.preventDefault();
    if (saving) return;
    setSaving(true);
    setError("");
    const room = rooms.find((entry) => entry.id === form.roomId);
    const course = courses.find((entry) => entry.id === form.courseId);
    const batch = classes.find((entry) => entry.id === form.classId);
    const teacher = teachers.find((entry) => entry.id === form.teacherId);
    const payload = {
      ...form,
      roomName: room?.name || "",
      courseTitle: course?.title || "",
      className: batch?.name || "",
      teacherName: teacher?.name || "",
    };
    const meta = { createdByName: profile?.displayName || user?.email || "", updatedByName: profile?.displayName || user?.email || "" };
    try {
      if (editingId) await updateRoomBooking(editingId, payload, meta);
      else await createRoomBooking(payload, meta);
      onSaved(editingId ? "Booking updated." : `${room?.name || "Room"} booked for ${prettyDate(form.date)}.`);
    } catch (submitError) {
      setError(submitError?.message || "Could not save this booking. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  if (!roomOptions.length) {
    return (
      <div className="space-y-4">
        <p className="rounded-xl bg-warning-soft px-3 py-3 text-sm font-semibold text-warning">There are no active rooms yet. Add a room in the Rooms tab first.</p>
        <div className="flex justify-end"><button type="button" onClick={onClose} className="rounded-xl px-4 py-2.5 text-sm font-bold text-muted">Close</button></div>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <label className={LABEL}>
        Room
        <select value={form.roomId} onChange={set("roomId")} required className={FIELD}>
          <option value="">Select a room</option>
          {roomOptions.map((room) => (
            <option key={room.id} value={room.id}>
              {room.name}{room.code ? ` (${room.code})` : ""}{room.status === "inactive" ? " — inactive" : ""}
            </option>
          ))}
        </select>
      </label>

      <label className={LABEL}>
        Course
        <select value={form.courseId} onChange={set("courseId")} required className={FIELD}>
          <option value="">Select a course</option>
          {courses.map((course) => <option key={course.id} value={course.id}>{course.title}{course.courseCode ? ` (${course.courseCode})` : ""}</option>)}
        </select>
      </label>

      <label className={LABEL}>
        Class / Batch
        <select value={form.classId} onChange={set("classId")} required disabled={!form.courseId} className={`${FIELD} disabled:bg-page disabled:text-muted`}>
          <option value="">{form.courseId ? "Select a class" : "Choose a course first"}</option>
          {courseClasses.map((batch) => <option key={batch.id} value={batch.id}>{batch.name}</option>)}
        </select>
        {form.courseId && !courseClasses.length && <span className="text-[11px] font-semibold text-primary">This course has no classes yet — add one in Training first.</span>}
      </label>

      <label className={LABEL}>
        Teacher
        <select value={form.teacherId} onChange={set("teacherId")} required className={FIELD}>
          <option value="">Select a teacher</option>
          {teachers.map((teacher) => <option key={teacher.id} value={teacher.id}>{teacher.name}</option>)}
        </select>
      </label>

      <div className="grid gap-4 sm:grid-cols-3">
        <label className={LABEL}>Date<input type="date" value={form.date} onChange={set("date")} required className={FIELD} /></label>
        <label className={LABEL}>Start time<input type="time" value={form.startTime} onChange={set("startTime")} required className={FIELD} /></label>
        <label className={LABEL}>End time<input type="time" value={form.endTime} onChange={set("endTime")} required className={FIELD} /></label>
      </div>

      <label className={LABEL}>
        Notes <span className="font-normal text-subtle">(optional)</span>
        <textarea value={form.notes} onChange={set("notes")} rows={2} maxLength={1000} className={FIELD} />
      </label>

      {liveConflict && !error && (
        <p className="rounded-xl bg-warning-soft px-3 py-2 text-xs font-semibold text-warning">
          {rooms.find((room) => room.id === form.roomId)?.name || "That room"} already has “{liveConflict.courseTitle || "a booking"}” from {to12h(liveConflict.startTime)} to {to12h(liveConflict.endTime)} that day. Choose another room or time.
        </p>
      )}
      {error && <p className="rounded-xl bg-active px-3 py-2 text-sm text-primary">{error}</p>}

      <div className="flex justify-end gap-3 pt-1">
        <button type="button" onClick={onClose} disabled={saving} className="rounded-xl px-4 py-2.5 text-sm font-bold text-muted">Cancel</button>
        <button disabled={saving || Boolean(liveConflict)} className="rounded-xl bg-primary px-5 py-2.5 text-sm font-bold text-white disabled:opacity-50">
          {saving ? "Saving…" : editingId ? "Save changes" : "Book room"}
        </button>
      </div>
    </form>
  );
}

// ---------------------------------------------------------------------------
// Booking detail
// ---------------------------------------------------------------------------
function DetailRow({ icon: Icon, label, children }) {
  return (
    <div className="flex gap-3 border-b border-border-subtle py-2.5 last:border-0">
      <Icon className="mt-0.5 h-4 w-4 shrink-0 text-subtle" aria-hidden="true" />
      <div className="min-w-0">
        <p className="text-[10px] font-bold uppercase tracking-wider text-subtle">{label}</p>
        <p className="text-sm font-semibold text-ink">{children || "—"}</p>
      </div>
    </div>
  );
}

function BookingDetail({ booking, roomName, canManage, onEdit, onCancel, onClose }) {
  const [confirming, setConfirming] = useState(false);
  const style = roomStyle(booking.roomId);
  return (
    <Modal title="Booking details" onClose={onClose}>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold ${style.chip}`}>
          <span className={`h-2 w-2 rounded-full ${style.dot}`} /> {roomName}
        </span>
        {booking.status === "cancelled" && <span className="rounded-full bg-page px-2.5 py-1 text-[10px] font-bold uppercase text-muted">Cancelled</span>}
        {booking.conflictWith && booking.status !== "cancelled" && <span className="rounded-full bg-warning-soft px-2.5 py-1 text-[10px] font-bold uppercase text-warning">Overlaps another booking</span>}
      </div>
      <div className="rounded-2xl border border-border-subtle p-3">
        <DetailRow icon={GraduationCap} label="Course">{booking.courseTitle}</DetailRow>
        <DetailRow icon={Users} label="Class / Batch">{booking.className}</DetailRow>
        <DetailRow icon={User} label="Teacher">{booking.teacherName}</DetailRow>
        <DetailRow icon={MapPin} label="Room">{roomName}</DetailRow>
        <DetailRow icon={CalendarDays} label="Date">{prettyDate(booking.date, { weekday: "long", year: "numeric", month: "long", day: "numeric" })}</DetailRow>
        <DetailRow icon={Clock} label="Time">{timeRange(booking)}</DetailRow>
        {booking.notes && <DetailRow icon={DoorOpen} label="Notes">{booking.notes}</DetailRow>}
        <DetailRow icon={User} label="Created by">{booking.createdByName || "—"}</DetailRow>
      </div>
      {canManage && booking.status !== "cancelled" && (
        <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:justify-end">
          {confirming ? (
            <>
              <span className="flex-1 self-center text-xs font-semibold text-primary">Cancel this booking? The room slot will free up.</span>
              <button type="button" onClick={() => setConfirming(false)} className="rounded-xl px-4 py-2.5 text-sm font-bold text-muted">Keep it</button>
              <button type="button" onClick={onCancel} className="rounded-xl bg-primary px-4 py-2.5 text-sm font-bold text-white">Cancel booking</button>
            </>
          ) : (
            <>
              <button type="button" onClick={onEdit} className="rounded-xl border border-border-subtle px-4 py-2.5 text-sm font-bold text-ink hover:bg-active">Edit</button>
              <button type="button" onClick={() => setConfirming(true)} className="rounded-xl border border-border-subtle px-4 py-2.5 text-sm font-bold text-primary hover:bg-active">Cancel booking</button>
            </>
          )}
        </div>
      )}
    </Modal>
  );
}

// ---------------------------------------------------------------------------
// Calendar views
// ---------------------------------------------------------------------------
function Chip({ booking, resolveRoomName, onClick }) {
  const style = roomStyle(booking.roomId);
  return (
    <button
      type="button"
      onClick={() => onClick(booking)}
      title={`${resolveRoomName(booking)} · ${booking.courseTitle || "Booking"} · ${timeRange(booking)}`}
      className={`block w-full truncate rounded px-1.5 py-0.5 text-left text-[10px] font-bold ${style.chip} ${booking.conflictWith ? "ring-1 ring-warning" : ""}`}
    >
      {booking.startTime} {booking.courseTitle || resolveRoomName(booking)}
    </button>
  );
}

function CalendarGrid({ cursor, byDate, roomFilter, resolveRoomName, onSelectDay, onSelectBooking }) {
  const year = cursor.getFullYear();
  const month = cursor.getMonth();
  const gridStart = new Date(year, month, 1);
  gridStart.setDate(gridStart.getDate() - gridStart.getDay());
  const cells = Array.from({ length: 42 }, (_, i) => { const date = new Date(gridStart); date.setDate(gridStart.getDate() + i); return date; });
  const today = ymd(new Date());

  return (
    <div className="overflow-x-auto">
      <div className="grid min-w-[640px] grid-cols-7 gap-px overflow-hidden rounded-xl border border-border-subtle bg-border-subtle">
        {WEEKDAYS.map((day) => <div key={day} className="bg-page p-2 text-center text-[10px] font-bold uppercase tracking-wider text-subtle">{day}</div>)}
        {cells.map((date) => {
          const key = ymd(date);
          const inMonth = date.getMonth() === month;
          const dayBookings = (byDate.get(key) || []).filter((b) => roomFilter === "all" || b.roomId === roomFilter);
          return (
            <div key={key} className={`flex min-h-24 flex-col gap-1 bg-white p-1.5 ${inMonth ? "" : "opacity-40"} ${key === today ? "ring-2 ring-inset ring-primary" : ""}`}>
              <button type="button" onClick={() => onSelectDay(key)} className="self-start rounded px-1 text-[10px] font-bold text-subtle hover:bg-page hover:text-ink">{date.getDate()}</button>
              {dayBookings.slice(0, 3).map((booking) => <Chip key={booking.id} booking={booking} resolveRoomName={resolveRoomName} onClick={onSelectBooking} />)}
              {dayBookings.length > 3 && <button type="button" onClick={() => onSelectDay(key)} className="text-left text-[9px] font-bold text-subtle hover:text-ink">+{dayBookings.length - 3} more</button>}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// The spec's dates × rooms ledger: one row per day of the visible month, a
// column per displayed room (dynamic — from the rooms collection, or the
// single filtered room).
function LedgerGrid({ cursor, byRoomDate, columns, canManage, onSelectBooking, onBook }) {
  const year = cursor.getFullYear();
  const month = cursor.getMonth();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const days = Array.from({ length: daysInMonth }, (_, i) => ymd(new Date(year, month, i + 1)));
  const today = ymd(new Date());

  return (
    <div className="overflow-x-auto rounded-xl border border-border-subtle">
      <table className="w-full border-collapse text-left text-sm" style={{ minWidth: `${180 + columns.length * 150}px` }}>
        <thead>
          <tr className="border-b border-border-subtle bg-page text-[10px] uppercase tracking-wider text-subtle">
            <th className="sticky left-0 z-10 bg-page p-3">Date</th>
            {columns.map((room) => <th key={room.id} className="p-3">{room.name}{room.status === "inactive" ? " (inactive)" : ""}</th>)}
          </tr>
        </thead>
        <tbody>
          {days.map((day) => (
            <tr key={day} className={`border-b border-border-subtle last:border-0 ${day === today ? "bg-active/40" : ""}`}>
              <td className="sticky left-0 z-10 whitespace-nowrap bg-white p-3 align-top text-xs font-bold text-ink">{prettyDate(day, { weekday: "short", day: "numeric" })}</td>
              {columns.map((room) => {
                const slot = (byRoomDate.get(`${room.id}|${day}`) || []).slice().sort((a, b) => a.startTime.localeCompare(b.startTime));
                return (
                  <td key={room.id} className="p-2 align-top">
                    {slot.length ? (
                      <div className="space-y-1">
                        {slot.map((booking) => (
                          <button key={booking.id} type="button" onClick={() => onSelectBooking(booking)} className={`block w-full rounded-lg px-2 py-1 text-left text-xs font-semibold ${roomStyle(booking.roomId).chip} ${booking.conflictWith ? "ring-1 ring-warning" : ""}`}>
                            <span className="block truncate">{booking.courseTitle || "Booking"}</span>
                            <span className="block text-[10px] font-normal opacity-80">{timeRange(booking)}</span>
                          </button>
                        ))}
                      </div>
                    ) : canManage && room.status === "active" ? (
                      <button type="button" onClick={() => onBook({ roomId: room.id, date: day })} className="w-full rounded-lg border border-dashed border-border-subtle px-2 py-1.5 text-[11px] font-semibold text-subtle hover:border-primary hover:text-primary">Available</button>
                    ) : (
                      <span className="block px-2 py-1.5 text-[11px] font-semibold text-subtle">Available</span>
                    )}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function AgendaList({ monthBookings, roomFilter, resolveRoomName, onSelectBooking, emptyLabel }) {
  const filtered = monthBookings
    .filter((b) => roomFilter === "all" || b.roomId === roomFilter)
    .slice()
    .sort((a, b) => a.date.localeCompare(b.date) || a.startTime.localeCompare(b.startTime));
  if (!filtered.length) return <p className="rounded-2xl border border-dashed border-border-subtle bg-white py-12 text-center text-sm text-muted">{emptyLabel}</p>;

  const groups = [];
  filtered.forEach((booking) => {
    const last = groups[groups.length - 1];
    if (last && last.date === booking.date) last.items.push(booking);
    else groups.push({ date: booking.date, items: [booking] });
  });
  return (
    <div className="space-y-4">
      {groups.map((group) => (
        <div key={group.date}>
          <p className="mb-2 text-xs font-bold uppercase tracking-wider text-subtle">{prettyDate(group.date, { weekday: "long", month: "long", day: "numeric" })}</p>
          <div className="space-y-2">
            {group.items.map((booking) => {
              const name = resolveRoomName(booking);
              return (
                <button key={booking.id} type="button" onClick={() => onSelectBooking(booking)} className="flex w-full items-center gap-3 rounded-2xl border border-border-subtle bg-white p-3 text-left shadow-sm hover:border-primary">
                  <span className={`grid h-11 w-11 shrink-0 place-items-center rounded-xl text-[10px] font-black ${roomStyle(booking.roomId).chip}`}>
                    {name.replace(/^Room\s+/i, "").slice(0, 4) || "RM"}
                  </span>
                  <span className="min-w-0 flex-1">
                    <b className="block truncate text-sm text-ink">{booking.courseTitle || "Booking"}</b>
                    <span className="block truncate text-xs text-muted">{name} · {timeRange(booking)}</span>
                    <span className="block truncate text-[11px] text-subtle">{booking.className || "—"} · {booking.teacherName || "—"}</span>
                  </span>
                  {booking.status === "cancelled" && <span className="shrink-0 text-[10px] font-bold uppercase text-muted">Cancelled</span>}
                  {booking.conflictWith && booking.status !== "cancelled" && <span className="shrink-0 text-[10px] font-bold uppercase text-warning">Overlap</span>}
                </button>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

function DayPanel({ day, byRoomDate, columns, canManage, onSelectBooking, onBook, onClose }) {
  return (
    <section className="rounded-3xl border border-border-subtle bg-white p-5 shadow-sm">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-bold text-ink">{prettyDate(day, { weekday: "long", year: "numeric", month: "long", day: "numeric" })}</h3>
        <button type="button" onClick={onClose} className="rounded-lg p-1 text-muted hover:bg-page" aria-label="Close day view"><X className="h-4 w-4" /></button>
      </div>
      {!columns.length ? (
        <p className="py-6 text-center text-sm text-muted">No rooms to show.</p>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {columns.map((room) => {
            const slot = (byRoomDate.get(`${room.id}|${day}`) || []).slice().sort((a, b) => a.startTime.localeCompare(b.startTime));
            const style = roomStyle(room.id);
            return (
              <div key={room.id} className="rounded-2xl border border-border-subtle p-3">
                <p className="mb-2 flex items-center gap-2 text-xs font-bold text-ink"><span className={`h-2.5 w-2.5 rounded-full ${style.dot}`} /> {room.name}</p>
                {slot.length ? (
                  <div className="space-y-1.5">
                    {slot.map((booking) => (
                      <button key={booking.id} type="button" onClick={() => onSelectBooking(booking)} className={`block w-full rounded-lg px-2.5 py-1.5 text-left text-xs font-semibold ${style.chip}`}>
                        <span className="block truncate">{booking.courseTitle || "Booking"}</span>
                        <span className="block text-[10px] font-normal opacity-80">{timeRange(booking)} · {booking.teacherName || "—"}</span>
                      </button>
                    ))}
                    {canManage && room.status === "active" && <button type="button" onClick={() => onBook({ roomId: room.id, date: day })} className="mt-1 w-full rounded-lg border border-dashed border-border-subtle px-2 py-1 text-[11px] font-semibold text-subtle hover:border-primary hover:text-primary">+ Add another</button>}
                  </div>
                ) : canManage && room.status === "active" ? (
                  <button type="button" onClick={() => onBook({ roomId: room.id, date: day })} className="w-full rounded-lg border border-dashed border-border-subtle px-2 py-2 text-xs font-semibold text-success hover:border-primary hover:text-primary">Available — book it</button>
                ) : (
                  <span className="text-xs font-semibold text-success">Available</span>
                )}
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------
export default function RoomBooking({ role }) {
  const canManage = MANAGER_ROLES.has(role);
  const online = useOnlineStatus();
  const { profile, user } = useAuth();

  const [rooms, setRooms] = useState([]);
  const [roomsLoaded, setRoomsLoaded] = useState(false);
  const [bookings, setBookings] = useState([]);
  const [meta, setMeta] = useState({ fromCache: false, pendingWrites: false });
  const [loaded, setLoaded] = useState(false);
  const [courses, setCourses] = useState([]);
  const [classes, setClasses] = useState([]);
  const [teachers, setTeachers] = useState([]);
  const [loadError, setLoadError] = useState("");

  const [tab, setTab] = useState("calendar");
  const [cursor, setCursor] = useState(() => { const d = new Date(); return new Date(d.getFullYear(), d.getMonth(), 1); });
  const [roomFilter, setRoomFilter] = useState("all");
  const [view, setView] = useState(() => (typeof window !== "undefined" && window.innerWidth < 768 ? "agenda" : "ledger"));
  const [selectedDay, setSelectedDay] = useState(null);
  const [detail, setDetail] = useState(null);
  const [formState, setFormState] = useState(null);
  const [notice, setNotice] = useState("");
  const noticeTimer = useRef(null);

  // Wait for auth to be restored before subscribing — a Firestore
  // `onSnapshot` that fires before the ID token is attached gets a
  // permission-denied it never recovers from.
  const uid = user?.uid;
  useEffect(() => {
    if (!uid) return undefined;
    return subscribeRooms(
      (rows) => { setRooms(rows); setRoomsLoaded(true); },
      () => { setLoadError("Unable to load rooms."); setRoomsLoaded(true); },
    );
  }, [uid]);
  useEffect(() => {
    if (!uid) return undefined;
    return subscribeRoomBookings(
      (rows, m) => { setBookings(rows); setMeta(m); setLoaded(true); },
      () => { setLoadError("Unable to load room bookings."); setLoaded(true); },
    );
  }, [uid]);
  useEffect(() => {
    if (!uid || !canManage) return undefined;
    const unsubs = [subscribeCourses(setCourses), subscribeClasses(setClasses), subscribeTeachers(setTeachers)];
    return () => unsubs.forEach((fn) => fn && fn());
  }, [uid, canManage]);
  useEffect(() => {
    if (!notice) return undefined;
    noticeTimer.current = setTimeout(() => setNotice(""), 4000);
    return () => clearTimeout(noticeTimer.current);
  }, [notice]);

  const roomById = useMemo(() => new Map(rooms.map((room) => [room.id, room])), [rooms]);
  const resolveRoomName = useMemo(() => (booking) => roomById.get(booking.roomId)?.name || booking.roomName || "Room", [roomById]);
  const activeRoomList = useMemo(() => filterActiveRooms(rooms), [rooms]);

  const visible = useMemo(() => bookings.filter((b) => b.status !== "cancelled"), [bookings]);
  const monthKey = `${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, "0")}`;
  const monthBookings = useMemo(() => visible.filter((b) => (b.date || "").startsWith(monthKey)), [visible, monthKey]);

  const byDate = useMemo(() => {
    const map = new Map();
    visible.forEach((b) => { if (!b.date) return; if (!map.has(b.date)) map.set(b.date, []); map.get(b.date).push(b); });
    return map;
  }, [visible]);
  const byRoomDate = useMemo(() => {
    const map = new Map();
    visible.forEach((b) => { if (!b.date || !b.roomId) return; const key = `${b.roomId}|${b.date}`; if (!map.has(key)) map.set(key, []); map.get(key).push(b); });
    return map;
  }, [visible]);

  // Columns for the ledger / day panel: active rooms, plus any room a
  // still-visible booking this month references even if it was since
  // deactivated or deleted (so nothing vanishes). Filtered to one room
  // when a specific room is selected.
  const columns = useMemo(() => {
    const referenced = new Set(monthBookings.map((b) => b.roomId));
    const extras = [];
    referenced.forEach((roomId) => {
      if (activeRoomList.some((room) => room.id === roomId)) return;
      const known = roomById.get(roomId);
      extras.push(known || { id: roomId, name: monthBookings.find((b) => b.roomId === roomId)?.roomName || "Room", status: "inactive" });
    });
    let list = [...activeRoomList, ...extras].sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));
    if (roomFilter !== "all") list = list.filter((room) => room.id === roomFilter);
    return list;
  }, [activeRoomList, roomById, monthBookings, roomFilter]);

  const conflictCount = useMemo(() => new Set(visible.filter((b) => b.conflictWith).map((b) => b.id)).size, [visible]);
  const filterOptions = useMemo(() => [{ id: "all", name: "All rooms" }, ...activeRoomList], [activeRoomList]);

  function shiftMonth(delta) {
    setCursor((current) => new Date(current.getFullYear(), current.getMonth() + delta, 1));
    setSelectedDay(null);
  }
  function goToday() {
    const d = new Date();
    setCursor(new Date(d.getFullYear(), d.getMonth(), 1));
    setSelectedDay(ymd(d));
  }
  function openCreate(prefill = {}) {
    setDetail(null);
    setFormState({ initial: { ...BLANK_BOOKING, ...prefill }, editingId: null });
  }
  function openEdit(booking) {
    setDetail(null);
    setFormState({
      initial: {
        roomId: booking.roomId, courseId: booking.courseId, classId: booking.classId, teacherId: booking.teacherId,
        date: booking.date, startTime: booking.startTime, endTime: booking.endTime, notes: booking.notes || "",
      },
      editingId: booking.id,
    });
  }
  async function handleCancel() {
    if (!detail) return;
    try {
      await cancelRoomBooking(detail.id, { cancelledByName: profile?.displayName || user?.email || "" });
      setNotice("Booking cancelled — the room slot is free again.");
      setDetail(null);
    } catch (error) {
      setNotice(error?.message || "Could not cancel this booking.");
    }
  }

  return (
    <div className="space-y-6">
      <section className="flex flex-col gap-4 rounded-3xl border border-[#f3aaaa] bg-[linear-gradient(120deg,#fff0f0_0%,#fff7f7_45%,#ffffff_100%)] p-6 text-ink shadow-xl md:flex-row md:items-center md:justify-between md:p-8">
        <div>
          <h2 className="flex items-center gap-2 text-2xl font-black md:text-3xl"><DoorOpen className="h-7 w-7 text-primary" aria-hidden="true" /> Room Booking</h2>
          <p className="mt-2 text-sm text-muted">Schedule classrooms and avoid double bookings.</p>
        </div>
        <div className="flex items-center gap-3">
          <span className="flex items-center gap-1.5 rounded-full border border-border-subtle bg-white px-3 py-1.5 text-[11px] font-bold shadow-sm">
            {online ? <><Wifi className="h-3.5 w-3.5 text-success" /> <span className="text-success">Online</span></> : <><CloudOff className="h-3.5 w-3.5 text-warning" /> <span className="text-warning">Offline</span></>}
            {meta.pendingWrites && <span className="border-l border-border-subtle pl-2 text-muted">syncing…</span>}
          </span>
          {canManage && tab === "calendar" && (
            <button type="button" onClick={() => openCreate(selectedDay ? { date: selectedDay } : {})} className="flex items-center gap-1.5 rounded-xl bg-primary px-4 py-3 text-xs font-bold text-white">
              <Plus className="h-4 w-4" /> Book Room
            </button>
          )}
        </div>
      </section>

      {canManage && (
        <div className="flex gap-2">
          {[["calendar", "Calendar", CalendarDays], ["rooms", "Rooms", Building2]].map(([id, text, Icon]) => (
            <button key={id} type="button" onClick={() => setTab(id)} className={`flex items-center gap-2 rounded-full px-4 py-2 text-xs font-bold transition ${tab === id ? "bg-primary text-white" : "bg-page text-muted hover:bg-active hover:text-primary"}`}>
              <Icon className="h-3.5 w-3.5" /> {text}
            </button>
          ))}
        </div>
      )}

      {notice && <p className="rounded-xl bg-success-soft p-4 text-sm text-success">{notice}</p>}
      {loadError && <p className="rounded-xl bg-active p-4 text-sm text-primary">{loadError}</p>}

      {tab === "rooms" && canManage ? (
        <RoomsManager rooms={rooms} bookings={bookings} onNotice={setNotice} />
      ) : (
        <>
          {!online && (
            <p className="rounded-xl bg-warning-soft p-3 text-xs font-semibold text-warning">
              You&apos;re offline. Existing bookings stay visible and any booking you make now is saved on this device and syncs automatically when you reconnect.
            </p>
          )}
          {conflictCount > 0 && (
            <p className="rounded-xl bg-warning-soft p-3 text-xs font-semibold text-warning">
              {conflictCount} booking{conflictCount > 1 ? "s" : ""} overlap another in the same room — open {conflictCount > 1 ? "them" : "it"} to reschedule.
            </p>
          )}

          {roomsLoaded && !activeRoomList.length ? (
            <section className="rounded-3xl border border-dashed border-border-subtle bg-white py-16 text-center">
              <Building2 className="mx-auto h-8 w-8 text-subtle" aria-hidden="true" />
              <p className="mt-3 font-bold text-ink">No active rooms yet</p>
              <p className="mt-1 text-sm text-muted">Add your classrooms and they&apos;ll appear here automatically.</p>
              {canManage && <button type="button" onClick={() => setTab("rooms")} className="mt-4 rounded-xl bg-primary px-4 py-2.5 text-xs font-bold text-white">Add a room</button>}
            </section>
          ) : (
            <section className="space-y-4 rounded-3xl border border-border-subtle bg-white p-4 shadow-sm md:p-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <button type="button" onClick={() => shiftMonth(-1)} className="rounded-lg border border-border-subtle p-2 hover:bg-active" aria-label="Previous month"><ChevronLeft className="h-4 w-4" /></button>
                  <button type="button" onClick={goToday} className="rounded-lg border border-border-subtle px-3 py-2 text-xs font-bold text-muted hover:bg-active">Today</button>
                  <button type="button" onClick={() => shiftMonth(1)} className="rounded-lg border border-border-subtle p-2 hover:bg-active" aria-label="Next month"><ChevronRight className="h-4 w-4" /></button>
                  <p className="ml-1 min-w-40 text-sm font-bold text-ink md:text-base">{MONTHS[cursor.getMonth()]} {cursor.getFullYear()}</p>
                </div>
                <div className="hidden gap-2 md:flex">
                  {[["ledger", "Grid"], ["calendar", "Calendar"], ["agenda", "Agenda"]].map(([id, text]) => (
                    <button key={id} type="button" onClick={() => setView(id)} className={`rounded-full px-3 py-1.5 text-xs font-bold transition ${view === id ? "bg-primary text-white" : "bg-page text-muted hover:bg-active hover:text-primary"}`}>{text}</button>
                  ))}
                </div>
              </div>

              <div className="flex flex-wrap gap-2">
                {filterOptions.map((option) => (
                  <button key={option.id} type="button" onClick={() => setRoomFilter(option.id)} className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-bold transition ${roomFilter === option.id ? "bg-ink text-white" : "border border-border-subtle bg-white text-muted hover:border-ink hover:text-ink"}`}>
                    {option.id !== "all" && <span className={`h-2 w-2 rounded-full ${roomStyle(option.id).dot}`} />}
                    {option.name}
                  </button>
                ))}
              </div>

              {!loaded ? (
                <p className="py-12 text-center text-sm text-muted">Loading room schedule…</p>
              ) : (
                <>
                  <div className="md:hidden">
                    <AgendaList monthBookings={monthBookings} roomFilter={roomFilter} resolveRoomName={resolveRoomName} onSelectBooking={setDetail} emptyLabel={`No bookings in ${MONTHS[cursor.getMonth()]}.`} />
                  </div>
                  <div className="hidden md:block">
                    {view === "ledger" && <LedgerGrid cursor={cursor} byRoomDate={byRoomDate} columns={columns} canManage={canManage} onSelectBooking={setDetail} onBook={openCreate} />}
                    {view === "calendar" && <CalendarGrid cursor={cursor} byDate={byDate} roomFilter={roomFilter} resolveRoomName={resolveRoomName} onSelectDay={setSelectedDay} onSelectBooking={setDetail} />}
                    {view === "agenda" && <AgendaList monthBookings={monthBookings} roomFilter={roomFilter} resolveRoomName={resolveRoomName} onSelectBooking={setDetail} emptyLabel={`No bookings in ${MONTHS[cursor.getMonth()]}.`} />}
                  </div>
                </>
              )}
            </section>
          )}

          {selectedDay && activeRoomList.length > 0 && (
            <DayPanel day={selectedDay} byRoomDate={byRoomDate} columns={columns} canManage={canManage} onSelectBooking={setDetail} onBook={openCreate} onClose={() => setSelectedDay(null)} />
          )}
        </>
      )}

      {detail && (
        <BookingDetail
          booking={detail}
          roomName={resolveRoomName(detail)}
          canManage={canManage}
          onEdit={() => openEdit(detail)}
          onCancel={handleCancel}
          onClose={() => setDetail(null)}
        />
      )}

      {formState && (
        <Modal title={formState.editingId ? "Edit booking" : "Book a room"} onClose={() => setFormState(null)} wide>
          <BookingForm
            initial={formState.initial}
            editingId={formState.editingId}
            rooms={rooms}
            courses={courses}
            classes={classes}
            teachers={teachers}
            allBookings={bookings}
            onClose={() => setFormState(null)}
            onSaved={(message) => { setFormState(null); setNotice(message); }}
          />
        </Modal>
      )}
    </div>
  );
}
