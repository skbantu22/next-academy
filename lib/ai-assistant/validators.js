// Pure, synchronous field + cross-field validation (spec section 5) — no
// Firestore reads here (see preflight.js for duplicate/business-rule checks
// that need live data). Every function returns a list of human-readable
// error strings; an empty list means valid.
import { compareDates, compareTimes } from "./datetime";
import { getAction } from "./schemas";

export function validateFieldValue(def, value) {
  if (value === undefined || value === null || value === "") return def.required ? "This field is required." : null;
  if (def.type === "number" && (Number.isNaN(Number(value)) || Number(value) < 0)) return "Enter a valid, non-negative number.";
  if (def.type === "enum" && !def.options.includes(value)) return `Choose one of: ${def.options.join(", ")}.`;
  if (def.type === "date" && !/^\d{4}-\d{2}-\d{2}$/.test(value)) return "That doesn't look like a valid date.";
  if (def.type === "time" && !/^\d{2}:\d{2}$/.test(value)) return "That doesn't look like a valid time.";
  return null;
}

// Section 5's explicit cross-field rules. Only checked once the relevant
// fields are all present — partial data never triggers a false error.
export function validateCrossFields(actionId, values) {
  const errors = [];
  if (actionId === "CREATE_EVENT") {
    if (values.startTime && values.endTime && compareTimes(values.startTime, values.endTime) >= 0) {
      errors.push("End time cannot be earlier than (or the same as) start time.");
    }
    if (values.registrationRequired && values.eventDate && !values.registrationDeadline) {
      errors.push("Set a registration deadline since registration is required.");
    }
    if (values.registrationDeadline && values.eventDate && compareDates(values.registrationDeadline, values.eventDate) > 0) {
      errors.push("Registration deadline cannot be after the event date.");
    }
    if (values.maxParticipants !== undefined && Number(values.maxParticipants) < 0) {
      errors.push("Maximum participants cannot be negative.");
    }
  }
  if (actionId === "CREATE_COURSE") {
    if (values.startDate && values.endDate && compareDates(values.startDate, values.endDate) > 0) {
      errors.push("End date cannot be before start date.");
    }
    if (values.price !== undefined && Number(values.price) < 0) errors.push("Price cannot be negative.");
    if (values.capacity !== undefined && Number(values.capacity) < 0) errors.push("Capacity cannot be negative.");
  }
  if (actionId === "TEACHER_ASSIGNMENT") {
    if (values.startDate && values.endDate && compareDates(values.startDate, values.endDate) > 0) {
      errors.push("End date cannot be before the start date.");
    }
  }
  return errors;
}

export function validateAllFields(actionId, values) {
  const action = getAction(actionId);
  if (!action) return ["Unknown action."];
  const errors = [];
  Object.entries(action.fields).forEach(([key, def]) => {
    const error = validateFieldValue(def, values[key]);
    if (error && def.required) errors.push(`${def.label}: ${error}`);
  });
  return [...errors, ...validateCrossFields(actionId, values)];
}
