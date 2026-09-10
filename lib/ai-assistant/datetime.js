// Natural-language date/time parsing for the AI Assistant. Deliberately
// rule-based (see nlu.js header) — covers the exact phrasings in the spec
// (today/tomorrow/next <weekday>/"20 September"/"20/09/2026"/
// "September 20, 2026"/"10 AM"/"2:30 PM"/"14:30") plus close variants.
// Never silently guesses: an ambiguous or unparseable input returns
// { ambiguous: true } or null instead of a best-guess date, so the engine
// can ask the user rather than commit to a wrong value.

const MONTHS = {
  jan: 0, january: 0, feb: 1, february: 1, mar: 2, march: 2, apr: 3, april: 3,
  may: 4, jun: 5, june: 5, jul: 6, july: 6, aug: 7, august: 7, sep: 8, sept: 8, september: 8,
  oct: 9, october: 9, nov: 10, november: 10, dec: 11, december: 11,
};
const WEEKDAYS = { sunday: 0, monday: 1, tuesday: 2, wednesday: 3, thursday: 4, friday: 5, saturday: 6 };

const pad2 = (n) => String(n).padStart(2, "0");
export function toIsoDate(date) {
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;
}
export function formatDateForDisplay(isoDate) {
  const date = new Date(`${isoDate}T00:00:00`);
  if (Number.isNaN(date.getTime())) return isoDate;
  return date.toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" });
}
export function formatTimeForDisplay(hhmm) {
  const [h, m] = (hhmm || "").split(":").map(Number);
  if (Number.isNaN(h)) return hhmm;
  const period = h >= 12 ? "PM" : "AM";
  const hour12 = h % 12 === 0 ? 12 : h % 12;
  return `${hour12}:${pad2(m || 0)} ${period}`;
}

// Returns { value: "YYYY-MM-DD" } | { ambiguous: true, reason } | null (no date-like text found)
export function parseDate(text, now = new Date()) {
  if (!text) return null;
  const raw = text.trim();
  const lower = raw.toLowerCase();

  if (/\b(today|আজ|আজকে)\b/.test(lower)) return { value: toIsoDate(now) };
  if (/\b(tomorrow|আগামীকাল|আগামিকাল|কাল)\b/.test(lower)) {
    const d = new Date(now);
    d.setDate(d.getDate() + 1);
    return { value: toIsoDate(d) };
  }

  // "next Friday" / "next monday" / Banglish "next শুক্রবার" — bare weekday
  // names without "next" are ambiguous (this week or next?), so only the
  // "next X" form is resolved automatically.
  const nextWeekday = lower.match(/\bnext\s+(sunday|monday|tuesday|wednesday|thursday|friday|saturday)\b/);
  if (nextWeekday) {
    const target = WEEKDAYS[nextWeekday[1]];
    const d = new Date(now);
    const current = d.getDay();
    let delta = (target - current + 7) % 7;
    if (delta === 0) delta = 7; // "next Friday" said ON a Friday means the following one
    d.setDate(d.getDate() + delta);
    return { value: toIsoDate(d) };
  }
  const bareWeekday = lower.match(/\b(this\s+)?(sunday|monday|tuesday|wednesday|thursday|friday|saturday)\b/);
  if (bareWeekday && !nextWeekday) {
    return { ambiguous: true, reason: `Do you mean this coming ${bareWeekday[2]}, or the one after? Please say "next ${bareWeekday[2]}" or give an exact date.` };
  }

  // DD/MM/YYYY or DD-MM-YYYY (Bangladesh/day-first convention, matching the spec's own "20/09/2026" example)
  const slash = raw.match(/\b(\d{1,2})[/-](\d{1,2})[/-](\d{4})\b/);
  if (slash) {
    const day = Number(slash[1]);
    const month = Number(slash[2]);
    const year = Number(slash[3]);
    if (month > 12) return { ambiguous: true, reason: `"${slash[0]}" isn't a valid day/month/year date. Please use DD/MM/YYYY.` };
    const d = new Date(year, month - 1, day);
    if (d.getMonth() !== month - 1) return { ambiguous: true, reason: `"${slash[0]}" isn't a valid calendar date.` };
    return { value: toIsoDate(d) };
  }

  // "20 September" / "20 September 2026" / "September 20, 2026" / "September 20"
  const dayMonth = lower.match(/\b(\d{1,2})(?:st|nd|rd|th)?\s+([a-z]+)(?:\s+(\d{4}))?\b/);
  const monthDay = lower.match(/\b([a-z]+)\s+(\d{1,2})(?:st|nd|rd|th)?(?:,)?\s*(\d{4})?\b/);
  const match = dayMonth && MONTHS[dayMonth[2]] !== undefined ? { day: dayMonth[1], month: dayMonth[2], year: dayMonth[3] } : monthDay && MONTHS[monthDay[1]] !== undefined ? { day: monthDay[2], month: monthDay[1], year: monthDay[3] } : null;
  if (match) {
    const month = MONTHS[match.month];
    const day = Number(match.day);
    // No year given: assume the next upcoming occurrence of that day/month,
    // never silently assuming the current (possibly already-past) year.
    let year = match.year ? Number(match.year) : now.getFullYear();
    if (!match.year) {
      const candidate = new Date(year, month, day);
      if (candidate < new Date(now.getFullYear(), now.getMonth(), now.getDate())) year += 1;
    }
    const d = new Date(year, month, day);
    if (d.getMonth() !== month || d.getDate() !== day) return { ambiguous: true, reason: `"${match.day} ${match.month}" isn't a valid calendar date.` };
    return { value: toIsoDate(d) };
  }

  return null;
}

// Returns { value: "HH:MM" (24h) } | { ambiguous: true, reason } | null
export function parseTime(text) {
  if (!text) return null;
  const lower = text.trim().toLowerCase();

  const withPeriod = lower.match(/\b(\d{1,2})(?::(\d{2}))?\s*(am|pm)\b/);
  if (withPeriod) {
    let hour = Number(withPeriod[1]);
    const minute = Number(withPeriod[2] || 0);
    const period = withPeriod[3];
    if (hour < 1 || hour > 12) return { ambiguous: true, reason: `"${withPeriod[0]}" isn't a valid time.` };
    if (period === "pm" && hour !== 12) hour += 12;
    if (period === "am" && hour === 12) hour = 0;
    return { value: `${pad2(hour)}:${pad2(minute)}` };
  }

  // 24-hour "14:30" — only treated as a time when unambiguous (hour >= 13,
  // or explicitly followed by a colon-minute with no am/pm marker at all).
  const twentyFour = lower.match(/\b([01]?\d|2[0-3]):([0-5]\d)\b/);
  if (twentyFour) {
    const hour = Number(twentyFour[1]);
    return { value: `${pad2(hour)}:${twentyFour[2]}` };
  }

  // A bare "10" or "10 o'clock" with no am/pm is genuinely ambiguous —
  // never silently assume AM or PM.
  const bareHour = lower.match(/\b(\d{1,2})\s*(?:o'?clock)?\b/);
  if (bareHour && Number(bareHour[1]) <= 12 && /\bo'?clock\b/.test(lower)) {
    return { ambiguous: true, reason: `Is ${bareHour[1]} o'clock AM or PM?` };
  }

  return null;
}

export function compareTimes(startHHMM, endHHMM) {
  return startHHMM < endHHMM ? -1 : startHHMM > endHHMM ? 1 : 0;
}
export function compareDates(isoA, isoB) {
  return isoA < isoB ? -1 : isoA > isoB ? 1 : 0;
}

// Resolves a small, closed set of relative date-range phrases ("today",
// "yesterday", "this week", "last week", "this month", "last month", "this
// year") into a concrete [startIso, endIso] (inclusive) — shared by every
// module that needs "show me X for <period>" (enrollments, events, ...)
// so the actual calendar math lives in exactly one place. Weeks start
// Sunday, matching Date#getDay()'s convention already used elsewhere in
// this file (parseDate's weekday resolution).
export function resolveDateRange(key, now = new Date()) {
  const startOfDay = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const today = startOfDay(now);
  if (key === "today") return { start: toIsoDate(today), end: toIsoDate(today), label: "today" };
  if (key === "yesterday") {
    const d = new Date(today);
    d.setDate(d.getDate() - 1);
    return { start: toIsoDate(d), end: toIsoDate(d), label: "yesterday" };
  }
  if (key === "tomorrow") {
    const d = new Date(today);
    d.setDate(d.getDate() + 1);
    return { start: toIsoDate(d), end: toIsoDate(d), label: "tomorrow" };
  }
  if (key === "this-week" || key === "last-week" || key === "next-week") {
    const weekStart = new Date(today);
    weekStart.setDate(weekStart.getDate() - weekStart.getDay());
    if (key === "last-week") weekStart.setDate(weekStart.getDate() - 7);
    if (key === "next-week") weekStart.setDate(weekStart.getDate() + 7);
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekEnd.getDate() + 6);
    return { start: toIsoDate(weekStart), end: toIsoDate(weekEnd), label: key === "this-week" ? "this week" : key === "last-week" ? "last week" : "next week" };
  }
  if (key === "this-month" || key === "last-month" || key === "next-month") {
    const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
    if (key === "last-month") monthStart.setMonth(monthStart.getMonth() - 1);
    if (key === "next-month") monthStart.setMonth(monthStart.getMonth() + 1);
    const monthEnd = new Date(monthStart.getFullYear(), monthStart.getMonth() + 1, 0);
    return { start: toIsoDate(monthStart), end: toIsoDate(monthEnd), label: key === "this-month" ? "this month" : key === "last-month" ? "last month" : "next month" };
  }
  if (key === "this-year") {
    return { start: `${today.getFullYear()}-01-01`, end: `${today.getFullYear()}-12-31`, label: "this year" };
  }
  return null;
}
