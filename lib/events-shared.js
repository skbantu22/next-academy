// Shared by client components and server API routes (app/api/admin/events,
// app/api/events/*) so validation and status rules never drift between what
// the UI shows and what the backend actually enforces. No "server-only" tag
// here on purpose — this file must be importable from both.

export const EVENT_TYPES = [
  "Workshop",
  "Orientation",
  "Team Building",
  "CSR Activity",
  "Seminar",
  "Meeting",
  "Training",
  "Other",
];

export const TARGET_AUDIENCES = ["Student", "Teacher", "Staff", "Volunteer", "Facilitator", "Public"];

// "Draft" and "Cancelled" are the only two states an organizer sets by hand
// (stored in event.status). Every other visible status is derived live from
// the event's own date/time below, per the "do not rely only on manually
// entered status" requirement.
export const MANUAL_STATUSES = ["Draft", "Cancelled"];
export const FILTER_STATUSES = ["All", "Upcoming", "Ongoing", "Completed", "Cancelled"];

function toDate(dateStr, timeStr) {
  if (!dateStr) return null;
  const time = timeStr && /^\d{2}:\d{2}$/.test(timeStr) ? timeStr : "00:00";
  const value = new Date(`${dateStr}T${time}:00`);
  return Number.isNaN(value.getTime()) ? null : value;
}

// The single source of truth for an event's displayed status. "Draft" and
// "Cancelled" are manual overrides; everything else — Upcoming / Ongoing /
// Completed — is computed from eventDate/startTime/endTime against `now`,
// so a stale "status" field written at creation time never lies once the
// event's actual date arrives.
export function computeEventStatus(event, now = new Date()) {
  if (event.status === "Cancelled") return "Cancelled";
  if (event.status === "Draft") return "Draft";
  const start = toDate(event.eventDate, event.startTime);
  const end = toDate(event.eventDate, event.endTime) || start;
  if (!start) return "Draft";
  if (now < start) return "Upcoming";
  if (end && now > end) return "Completed";
  return "Ongoing";
}

export function isRegistrationOpen(event, now = new Date()) {
  if (!event.registrationRequired) return false;
  if (!event.published) return false;
  const status = computeEventStatus(event, now);
  if (status !== "Upcoming" && status !== "Ongoing") return false;
  if (event.registrationDeadline) {
    const deadline = toDate(event.registrationDeadline, "23:59");
    if (deadline && now > deadline) return false;
  }
  return true;
}

const text = (value, max) => {
  const v = typeof value === "string" ? value.trim() : "";
  if (max && v.length > max) throw new Error(`Enter up to ${max} characters.`);
  return v;
};
const numberOrNull = (value) => {
  if (value === "" || value === null || value === undefined) return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
};

// Shared field validation — used by the create/edit form for inline errors
// AND by the API route as the real enforcement point, so a client bypass
// can never save data the UI itself wouldn't have allowed.
export function validateEventFields(body) {
  const name = text(body.name, 160);
  if (!name) throw new Error("Event name is required.");

  const type = typeof body.type === "string" && EVENT_TYPES.includes(body.type) ? body.type : "";
  if (!type) throw new Error("Choose a valid event type.");

  const eventDate = text(body.eventDate, 20);
  if (!eventDate) throw new Error("Event date is required.");

  const startTime = text(body.startTime, 10);
  if (!startTime) throw new Error("Start time is required.");
  const endTime = text(body.endTime, 10);
  if (!endTime) throw new Error("End time is required.");
  if (endTime <= startTime) throw new Error("End time cannot be before start time.");

  const maxParticipants = numberOrNull(body.maxParticipants);
  if (maxParticipants !== null && maxParticipants < 0) throw new Error("Maximum participants cannot be negative.");

  const registrationRequired = Boolean(body.registrationRequired);
  const registrationDeadline = text(body.registrationDeadline, 20);
  if (registrationRequired) {
    if (!registrationDeadline) throw new Error("Set a registration deadline when registration is required.");
    if (registrationDeadline > eventDate) throw new Error("Registration deadline cannot be after the event date.");
  } else if (registrationDeadline && registrationDeadline > eventDate) {
    throw new Error("Registration deadline cannot be after the event date.");
  }

  const status = typeof body.status === "string" && MANUAL_STATUSES.includes(body.status) ? body.status : "";
  const targetAudience = Array.isArray(body.targetAudience)
    ? body.targetAudience.filter((item) => TARGET_AUDIENCES.includes(item))
    : [];

  return {
    name,
    type,
    description: text(body.description, 5000),
    eventDate,
    startTime,
    endTime,
    location: text(body.location, 200),
    organizer: text(body.organizer, 160),
    organizerId: text(body.organizerId, 128),
    maxParticipants,
    targetAudience,
    registrationRequired,
    registrationDeadline,
    status,
    published: Boolean(body.published),
  };
}
