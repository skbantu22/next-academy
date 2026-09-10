"use client";

// The conversation state machine (spec section 12):
//   UNDERSTAND -> IDENTIFY ENTITY -> LOAD SCHEMA -> COLLECT -> DETECT MISSING
//   -> VALIDATE -> CHECK DATABASE -> CHECK PERMISSIONS -> SHOW SUMMARY
//   -> WAIT FOR CONFIRMATION -> EXECUTE -> VERIFY -> SHOW RESULT -> AUDIT LOG
// Every database-changing step only runs after every earlier one has
// passed — there is no path from a user message straight to executeAction().
import { ACTIONS, getAction, requiredFieldKeys } from "./schemas";
import { detectIntent, detectMutationKind, extractFields } from "./nlu";
import { formatDateForDisplay, formatTimeForDisplay, parseDate } from "./datetime";
import { validateAllFields, validateFieldValue } from "./validators";
import { preflightCheck } from "./preflight";
import { RESOLVERS, resolveCourse } from "./entityResolver";
import { executeAction } from "./executors";
import { loadTraining, updateCourse } from "../services/training-service";
import { logAiAction } from "../services/ai-audit-service";

export function initialState() {
  return { stage: "IDLE", actionId: null, mutationKind: "CREATE", values: {}, pendingField: null, pendingDisambiguation: null, updateTarget: null };
}

const YES = /^(yes|y|confirm|ok(ay)?|হ্যাঁ|হা|নিশ্চিত)\b/i;
const NO = /^(no|n|cancel|না)\b/i;
const CANCEL = /\b(cancel|start over|reset|বাতিল)\b/i;

// nlu.js's structural extractors for STUDENT_ENROLLMENT/TEACHER_ASSIGNMENT
// (the Bangla-SOV "X কে Y করো" pattern) can't know the real schema field
// names in advance, so they write to these temp keys instead — mapped onto
// the actual field names here, right after extraction, so the entity
// resolution loop below picks them up like any other freshly-typed name.
const TEMP_FIELD_MAP = { __studentQuery: "student", __courseQuery: "course", __teacherQuery: "teacher", __batchQuery: "batch" };
function applyTempFieldMap(values) {
  Object.entries(TEMP_FIELD_MAP).forEach(([tempKey, realKey]) => {
    if (values[tempKey] !== undefined && values[realKey] === undefined) values[realKey] = values[tempKey];
    delete values[tempKey];
  });
  return values;
}

function fieldEntries(actionId) {
  return Object.entries(getAction(actionId).fields);
}
function isEntityField(def) {
  return def.type.startsWith("entity:");
}
function entityKind(def) {
  return def.type.split(":")[1];
}

function missingRequired(actionId, values) {
  return requiredFieldKeys(actionId).filter((key) => values[key] === undefined || values[key] === null || values[key] === "");
}

function displayValue(def, value) {
  if (value === undefined || value === null || value === "") return "";
  if (isEntityField(def)) return value.label || value;
  if (def.type === "date") return formatDateForDisplay(value);
  if (def.type === "time") return formatTimeForDisplay(value);
  if (def.type === "boolean") return value ? "Yes" : "No";
  return String(value);
}

function summarizeProgress(actionId, values) {
  const lines = [];
  fieldEntries(actionId).forEach(([key, def]) => {
    if (values[key] !== undefined && values[key] !== null && values[key] !== "") {
      lines.push(`✓ ${def.label}: ${displayValue(def, values[key])}`);
    }
  });
  return lines;
}

function askForFields(actionId, keys) {
  const action = getAction(actionId);
  if (keys.length === 1) {
    const def = action.fields[keys[0]];
    if (def.type === "enum") return `What is the ${def.label}?\nOptions: ${def.options.join(" / ")}`;
    return `What is the ${def.label}?`;
  }
  return keys.map((key, i) => `${i + 1}. ${action.fields[key].label}`).join("\n");
}

async function applyRawValueToField(actionId, key, rawValue, now, context = {}, values = {}) {
  const def = getAction(actionId).fields[key];
  if (isEntityField(def)) {
    const kind = entityKind(def);
    const resolver = RESOLVERS[kind];
    const resolverContext = kind === "class" ? { ...context, courseId: values.course?.id } : context;
    const { matches } = await resolver(rawValue, resolverContext);
    return { key, matches, rawValue };
  }
  if (def.type === "date") {
    const parsed = parseDate(rawValue, now);
    if (!parsed) return { key, error: `I couldn't understand that date for ${def.label}. Try "20 September", "20/09/2026", or "next Friday".` };
    if (parsed.ambiguous) return { key, ambiguous: parsed.reason };
    return { key, value: parsed.value };
  }
  if (def.type === "number") {
    const num = Number(rawValue.replace(/[^\d.]/g, ""));
    if (Number.isNaN(num)) return { key, error: `${def.label} should be a number.` };
    return { key, value: num };
  }
  if (def.type === "enum") {
    const found = def.options.find((option) => rawValue.toLowerCase().includes(option.toLowerCase()));
    if (!found) return { key, error: `Please choose one of: ${def.options.join(", ")}.` };
    return { key, value: found };
  }
  if (def.type === "boolean") {
    return { key, value: /\b(yes|true|হ্যাঁ)\b/i.test(rawValue) };
  }
  return { key, value: rawValue.trim() };
}

// One user message drives the whole machine forward by exactly one step,
// returning the assistant's reply and the (possibly advanced) new state.
export async function processMessage(state, rawText, context) {
  const now = new Date();
  const text = (rawText || "").trim();
  if (!text) return { state, reply: "I didn't catch that — could you say that again?" };

  if (CANCEL.test(text) && state.stage !== "IDLE") {
    return { state: initialState(), reply: "Okay, cancelled. What would you like to do next?" };
  }

  // ---- Resolve a pending entity disambiguation (numbered list from a
  // previous turn) before anything else — the user's reply here is a
  // selection index, not a new command. `purpose` routes the choice back
  // into whichever flow asked for it (a plain field collect, or an
  // update/delete target lookup), since those need different next steps.
  if (state.stage === "DISAMBIGUATING" && state.pendingDisambiguation) {
    const { field, matches, purpose } = state.pendingDisambiguation;
    const index = Number(text.match(/\d+/)?.[0]);
    const choice = matches[index - 1];
    if (!choice) {
      return { state, reply: `Please reply with a number from 1 to ${matches.length}, or say "cancel".` };
    }
    if (purpose === "update-target") return afterUpdateTargetResolved(choice, "");
    if (purpose === "delete-target") return afterDeleteTargetResolved(choice);
    const nextValues = { ...state.values, [field]: choice };
    return continueCollecting({ ...state, stage: "COLLECTING", values: nextValues, pendingDisambiguation: null, pendingField: null }, context, now);
  }

  // ---- Confirmation gate.
  if (state.stage === "CONFIRMING") {
    if (YES.test(text)) return runExecution(state, context);
    if (NO.test(text)) return { state: initialState(), reply: "Cancelled. Nothing was created or changed." };
    return { state, reply: 'Please confirm — reply "Confirm" to proceed or "Cancel" to stop.' };
  }

  // ---- UPDATE flow (Course only — see engine.js header comment on scope).
  if (state.stage === "UPDATE_AWAIT_TARGET") return continueUpdateFlow(state, text, context, now);
  if (state.stage === "UPDATE_AWAIT_FIELD") return continueUpdateFieldFlow(state, text, context, now);
  if (state.stage === "UPDATE_CONFIRM") {
    if (YES.test(text)) return runUpdateExecution(state, context);
    if (NO.test(text)) return { state: initialState(), reply: "Cancelled. Nothing was changed." };
    return { state, reply: 'Please confirm — reply "Confirm" to proceed or "Cancel" to stop.' };
  }
  if (state.stage === "DELETE_CONFIRM") {
    if (YES.test(text)) return runDeleteExecution(state, context);
    if (NO.test(text)) return { state: initialState(), reply: "Cancelled. Nothing was deleted." };
    return { state, reply: 'Please confirm — reply "Confirm" to proceed or "Cancel" to stop.' };
  }

  // ---- UNDERSTAND + IDENTIFY ENTITY (fresh command).
  if (state.stage === "IDLE" || !state.actionId) {
    const mutationKind = detectMutationKind(text);
    const actionId = detectIntent(text);
    if (!actionId) {
      return {
        state: initialState(),
        reply: "I couldn't understand that request yet. Try asking about students, courses, teachers, events, attendance, results, finance, or LMS actions.",
      };
    }
    if (mutationKind === "UPDATE" && actionId === "CREATE_COURSE") return startUpdateFlow(text, context, now);
    if (mutationKind === "DELETE" && actionId === "CREATE_COURSE") return startDeleteFlow(text, context, now);

    // LOAD REQUIRED SCHEMA + CHECK PERMISSIONS (before collecting anything —
    // never let a user without permission spend a whole conversation on an
    // action they were always going to be denied).
    const action = getAction(actionId);
    if (!action.allowedRoles.includes(context.role)) {
      return { state: initialState(), reply: `❌ You don't have permission to ${action.label.toLowerCase()}.` };
    }
    const freshState = { ...initialState(), stage: "COLLECTING", actionId };
    return continueCollecting(freshState, context, now, text);
  }

  // ---- Already mid-collection on a known action.
  return continueCollecting(state, context, now, text);
}

async function continueCollecting(state, context, now, newText) {
  const { actionId } = state;
  let values = { ...state.values };

  if (newText !== undefined) {
    const { values: extracted, dateIssues } = extractFields(actionId, newText, now);
    values = applyTempFieldMap({ ...values, ...extracted });

    if (dateIssues.length) {
      return { state: { ...state, values }, reply: dateIssues.map((issue) => issue.reason).join("\n") };
    }

    // Context-aware fallback (spec section 3/14's "remember what I just
    // asked" robustness net): if we were waiting on exactly one field and
    // extraction found nothing new for it, treat the ENTIRE reply as that
    // field's raw value.
    if (state.pendingField && values[state.pendingField] === undefined) {
      const result = await applyRawValueToField(actionId, state.pendingField, newText, now, context, values);
      if (result.error) return { state: { ...state, values }, reply: `⚠️ ${result.error}` };
      if (result.ambiguous) return { state: { ...state, values }, reply: result.ambiguous };
      if (result.matches) {
        const outcome = handleEntityMatches(state, values, result.key, result.matches, newText);
        if (outcome) return outcome;
      } else {
        values[result.key] = result.value;
      }
    }

    // Any freshly-extracted entity-typed field also needs resolving against
    // real Firestore data (never trust a bare typed name as a real record).
    for (const [key, def] of fieldEntries(actionId)) {
      if (isEntityField(def) && typeof values[key] === "string") {
        const kind = entityKind(def);
        // A "batch" field is scoped to the already-resolved course, if any,
        // so e.g. "Batch 03" only searches that course's own batches.
        const resolverContext = kind === "class" ? { ...context, courseId: values.course?.id } : context;
        const { matches } = await RESOLVERS[kind](values[key], resolverContext);
        const query = values[key];
        delete values[key];
        const outcome = handleEntityMatches(state, values, key, matches, query);
        if (outcome) return outcome;
      }
    }
  }

  // DETECT MISSING FIELDS + VALIDATE.
  const missing = missingRequired(actionId, values);
  const validationErrors = validateAllFields(actionId, values).filter((error) => !missing.some((key) => error.startsWith(getAction(actionId).fields[key]?.label)));
  if (validationErrors.length) {
    return { state: { ...state, values, pendingField: null }, reply: `⚠️ ${validationErrors.join("\n⚠️ ")}` };
  }

  if (missing.length) {
    const progress = summarizeProgress(actionId, values);
    const reply = [
      progress.length ? `Already provided:\n${progress.join("\n")}\n` : "",
      `Missing required information:\n${askForFields(actionId, missing)}`,
    ].filter(Boolean).join("\n");
    return { state: { ...state, values, pendingField: missing.length === 1 ? missing[0] : null }, reply };
  }

  // CHECK DATABASE (duplicates/business rules against real Firestore data).
  const { blockers, warnings } = await preflightCheck(actionId, values, context);
  if (blockers.length) {
    // A blocker on a specific field (duplicate code/email/etc.) clears just
    // that field so the very next message is treated as its replacement —
    // consistent with never silently ignoring a validation failure.
    return { state: { ...state, values, pendingField: null }, reply: `⚠️ ${blockers.join("\n⚠️ ")}` };
  }

  // SHOW SUMMARY + WAIT FOR CONFIRMATION.
  const action = getAction(actionId);
  const summaryLines = fieldEntries(actionId)
    .filter(([key]) => values[key] !== undefined && values[key] !== null && values[key] !== "")
    .map(([key, def]) => `${def.label}: ${displayValue(def, values[key])}`);
  const unpersisted = action.unpersistedFields?.filter((key) => values[key]) || [];
  const reply = [
    warnings.length ? `Note:\n${warnings.map((w) => `⚠️ ${w}`).join("\n")}\n` : "",
    `Everything is ready.\n\n┌ ${action.label} ─────────────\n${summaryLines.map((l) => `│ ${l}`).join("\n")}\n└────────────────────────────`,
    unpersisted.length ? `\n(Note: the current system doesn't yet store ${unpersisted.join(", ")} on an assignment — only the assignment itself will be saved.)` : "",
    "\nPlease confirm before I proceed. Reply \"Confirm\" or \"Cancel\".",
  ].filter(Boolean).join("\n");
  return { state: { ...state, values, stage: "CONFIRMING", pendingField: null }, reply };
}

function handleEntityMatches(state, values, key, matches, query) {
  if (matches.length === 0) {
    return { state: { ...state, values, pendingField: key }, reply: `I couldn't find anyone/anything matching "${query}". Please check the spelling, or provide the exact ID.` };
  }
  if (matches.length > 1) {
    const list = matches.slice(0, 8).map((m, i) => `${i + 1}. ${m.label}${m.sublabel ? ` — ${m.sublabel}` : ""}`).join("\n");
    return {
      state: { ...state, values, stage: "DISAMBIGUATING", pendingDisambiguation: { field: key, matches: matches.slice(0, 8), rawQuery: query, purpose: "collect" } },
      reply: `I found multiple matches for "${query}". Which one do you mean?\n${list}`,
    };
  }
  values[key] = matches[0];
  return null;
}

async function runExecution(state, context) {
  const { actionId, values } = state;
  let result;
  try {
    result = await executeAction(actionId, values, context);
  } catch (error) {
    await logAudit(context, actionId, values, { result: "failure", errorMessage: error.message, confirmationStatus: "confirmed" });
    return { state: initialState(), reply: `❌ I couldn't complete this action because: ${error.message}` };
  }
  await logAudit(context, actionId, values, { result: "success", entityId: result.entityId, confirmationStatus: "confirmed" });
  const action = getAction(actionId);
  const extraNote = result.extra ? ` (${Object.entries(result.extra).map(([k, v]) => `${k}: ${v}`).join(", ")})` : "";
  return { state: initialState(), reply: `✅ ${action.label} completed successfully.${extraNote ? extraNote : ""}${result.entityId ? `\nID: ${result.entityId}` : ""}` };
}

async function logAudit(context, actionId, values, extra) {
  try {
    await logAiAction({
      action: actionId,
      entity: extra.entity || actionId,
      entityId: extra.entityId || "",
      requestedData: sanitizeForLog(values),
      result: extra.result,
      confirmationStatus: extra.confirmationStatus,
      errorMessage: extra.errorMessage || "",
    });
  } catch {
    // Audit logging must never itself block or crash the user-facing flow.
  }
}
function sanitizeForLog(values) {
  const out = {};
  Object.entries(values).forEach(([key, value]) => {
    if (key === "password") return; // never persist a plaintext password in the audit trail
    out[key] = value && typeof value === "object" && "id" in value ? { id: value.id, label: value.label } : value;
  });
  return out;
}

// ---------------------------------------------------------------------
// UPDATE_COURSE / DELETE_COURSE — the reference update/delete flow (spec
// sections 9/10). Scoped to Course, the entity both worked examples in the
// spec use; the same pattern (resolve -> show current value -> confirm ->
// PATCH the existing route) extends to other entities as a follow-up.
// ---------------------------------------------------------------------

// Distinctive keywords per updatable Course field — deliberately NOT just
// "the first word of the field's label" (every one of Course Name/Course
// Code/Course Status starts with "Course," which any message mentioning
// the course at all would also match, misrouting the field almost every
// time). Longer, more specific phrases are listed/checked first.
const COURSE_FIELD_KEYWORDS = [
  ["startDate", ["start date", "শুরুর তারিখ"]],
  ["endDate", ["end date", "শেষ তারিখ"]],
  ["duration", ["duration", "মেয়াদ"]],
  ["category", ["category", "ক্যাটাগরি"]],
  ["status", ["status", "স্ট্যাটাস"]],
  ["price", ["price", "fee", "মূল্য", "ফি"]],
  ["capacity", ["capacity", "ধারণক্ষমতা"]],
  ["description", ["description", "বর্ণনা"]],
  ["name", ["name", "title", "নাম"]],
];
function detectCourseField(text) {
  const lower = text.toLowerCase();
  for (const [key, words] of COURSE_FIELD_KEYWORDS) {
    const hit = words.find((word) => lower.includes(word));
    if (hit) return { key, matchedWord: hit };
  }
  return null;
}

async function startUpdateFlow(text, context, now) {
  if (!["Admin", "Director"].includes(context.role)) {
    return { state: initialState(), reply: "❌ You don't have permission to update courses." };
  }
  const nameGuess = text.match(/^(.+?)\s*(?:course|কোর্স)/i)?.[1]?.trim() || text;
  const { matches } = await resolveCourse(nameGuess);
  if (!matches.length) {
    return { state: { ...initialState(), stage: "UPDATE_AWAIT_TARGET" }, reply: `I couldn't find a course matching "${nameGuess}". Which course did you mean? (Or say "cancel".)` };
  }
  if (matches.length > 1) {
    const list = matches.slice(0, 8).map((m, i) => `${i + 1}. ${m.label}${m.sublabel ? ` — ${m.sublabel}` : ""}`).join("\n");
    return { state: { ...initialState(), stage: "DISAMBIGUATING", mutationKind: "UPDATE", pendingDisambiguation: { field: "__course", matches: matches.slice(0, 8), rawQuery: nameGuess, purpose: "update-target" } }, reply: `I found multiple matching courses. Which one do you mean?\n${list}` };
  }
  return afterUpdateTargetResolved(matches[0], text, now);
}

async function continueUpdateFlow(state, text, context, now) {
  void context;
  const { matches } = await resolveCourse(text);
  if (!matches.length) return { state, reply: `I couldn't find a course matching "${text}". Try again or say "cancel".` };
  if (matches.length > 1) {
    const list = matches.slice(0, 8).map((m, i) => `${i + 1}. ${m.label}${m.sublabel ? ` — ${m.sublabel}` : ""}`).join("\n");
    return { state: { ...state, stage: "DISAMBIGUATING", pendingDisambiguation: { field: "__course", matches: matches.slice(0, 8), rawQuery: text, purpose: "update-target" } }, reply: `Still multiple matches. Which one?\n${list}` };
  }
  return afterUpdateTargetResolved(matches[0], "", now);
}

async function afterUpdateTargetResolved(course, originalText, now = new Date()) {
  // Try to parse "<field> <value>" straight from the original command
  // (e.g. "Web Development course-এর duration 6 months করে দাও").
  const detected = originalText ? detectCourseField(originalText) : null;
  if (detected) {
    const afterField = originalText.slice(originalText.toLowerCase().indexOf(detected.matchedWord) + detected.matchedWord.length);
    const cleaned = afterField.replace(/করে\s*দাও|করো/g, "").replace(/^[:\-]\s*/, "").trim();
    if (cleaned) {
      return applyCourseFieldUpdate({ updateTarget: { course, field: null } }, detected.key, cleaned, now);
    }
  }
  return {
    state: { stage: "UPDATE_AWAIT_FIELD", actionId: null, mutationKind: "UPDATE", values: {}, pendingField: null, pendingDisambiguation: null, updateTarget: { course, field: null } },
    reply: `Found: ${course.label} (${course.raw.courseCode || course.id}).\nWhich field would you like to update, and to what value? (e.g. "duration 6 months")`,
  };
}

async function continueUpdateFieldFlow(state, text, context, now) {
  void context;
  const course = state.updateTarget.course;
  const detected = detectCourseField(text);
  if (!detected) {
    return { state, reply: 'I didn\'t catch which field to change. Try e.g. "duration 6 months" or "status Active".' };
  }
  const rawValue = text.slice(text.toLowerCase().indexOf(detected.matchedWord) + detected.matchedWord.length).replace(/^[:\-]\s*/, "").trim();
  return applyCourseFieldUpdate({ updateTarget: { course, field: null } }, detected.key, rawValue, now);
}

async function applyCourseFieldUpdate(state, key, rawValue, now) {
  const course = state.updateTarget.course;
  const def = getAction("CREATE_COURSE").fields[key];
  const applied = await applyRawValueToField("CREATE_COURSE", key, rawValue, now);
  if (applied.error) return { state, reply: `⚠️ ${applied.error}` };
  if (applied.ambiguous) return { state, reply: applied.ambiguous };
  const newValue = applied.matches ? applied.matches[0] : applied.value;
  const fieldError = validateFieldValue(def, newValue);
  if (fieldError) return { state, reply: `⚠️ ${fieldError}` };
  const currentValue = course.raw[key === "name" ? "title" : key === "code" ? "courseCode" : key];
  return {
    state: { stage: "UPDATE_CONFIRM", actionId: null, mutationKind: "UPDATE", values: {}, pendingField: null, pendingDisambiguation: null, updateTarget: { course, field: key, newValue } },
    reply: `I found:\n\n${course.raw.title}\nCourse Code: ${course.raw.courseCode || course.id}\nCurrent ${def.label}: ${currentValue || "—"}\n\nNew ${def.label}: ${displayValue(def, newValue)}\n\nConfirm update?`,
  };
}

async function runUpdateExecution(state, context) {
  const { course, field, newValue } = state.updateTarget;
  const patch = { id: course.id, title: course.raw.title, description: course.raw.description, status: course.raw.status, category: course.raw.category, level: course.raw.level, thumbnailUrl: course.raw.thumbnailUrl, thumbnailPath: course.raw.thumbnailPath, price: course.raw.price, discountPrice: course.raw.discountPrice, startDate: course.raw.startDate, endDate: course.raw.endDate, startTime: course.raw.startTime, endTime: course.raw.endTime, classFrequency: course.raw.classFrequency, totalClasses: course.raw.totalClasses, duration: course.raw.duration, campus: course.raw.campus, building: course.raw.building, room: course.raw.room, floor: course.raw.floor, batchName: course.raw.batchName, maxStudents: course.raw.maxStudents, seatCapacity: course.raw.seatCapacity, enrollmentStartDate: course.raw.enrollmentStartDate, enrollmentDeadline: course.raw.enrollmentDeadline, enrollmentStatus: course.raw.enrollmentStatus, passingScore: course.raw.passingScore, certificateEnabled: course.raw.certificateEnabled, certificateMinAttendance: course.raw.certificateMinAttendance, certificateMinScore: course.raw.certificateMinScore, certificateTemplateId: course.raw.certificateTemplateId, certificateCode: course.raw.certificateCode, primaryTeacherId: course.raw.primaryTeacherId, assistantTeacherId: course.raw.assistantTeacherId };
  const mappedKey = field === "name" ? "title" : field === "code" ? "courseCode" : field;
  patch[mappedKey] = newValue;
  try {
    await updateCourse(patch);
    await logAudit(context, "UPDATE_COURSE", { courseId: course.id, [field]: newValue }, { result: "success", entity: "courses", entityId: course.id, confirmationStatus: "confirmed" });
    return { state: initialState(), reply: `✅ Updated. ${course.raw.title}'s ${getAction("CREATE_COURSE").fields[field].label} is now ${displayValue(getAction("CREATE_COURSE").fields[field], newValue)}.` };
  } catch (error) {
    await logAudit(context, "UPDATE_COURSE", { courseId: course.id }, { result: "failure", entity: "courses", entityId: course.id, errorMessage: error.message, confirmationStatus: "confirmed" });
    return { state: initialState(), reply: `❌ I couldn't complete this update because: ${error.message}` };
  }
}

async function startDeleteFlow(text, context, now) {
  void now;
  if (!["Admin", "Director"].includes(context.role)) {
    return { state: initialState(), reply: "❌ You don't have permission to delete or archive courses." };
  }
  const nameGuess = text.match(/^(?:delete|remove|মুছে?\s*দাও)\s+(.+?)\s*(?:course|কোর্স)?\??$/i)?.[1]?.trim() || text.replace(/delete|remove|মুছে?\s*দাও|\?/gi, "").trim();
  const { matches } = await resolveCourse(nameGuess);
  if (!matches.length) return { state: initialState(), reply: `I couldn't find a course matching "${nameGuess}".` };
  if (matches.length > 1) {
    const list = matches.slice(0, 8).map((m, i) => `${i + 1}. ${m.label}${m.sublabel ? ` — ${m.sublabel}` : ""}`).join("\n");
    return { state: { ...initialState(), stage: "DISAMBIGUATING", mutationKind: "DELETE", pendingDisambiguation: { field: "__course", matches: matches.slice(0, 8), rawQuery: nameGuess, purpose: "delete-target" } }, reply: `I found multiple matching courses. Which one do you mean?\n${list}` };
  }
  return afterDeleteTargetResolved(matches[0]);
}

async function afterDeleteTargetResolved(course) {
  const { courses } = await loadTraining();
  const full = courses.find((c) => c.id === course.id) || course.raw;
  return {
    state: { stage: "DELETE_CONFIRM", actionId: null, mutationKind: "DELETE", values: {}, pendingField: null, pendingDisambiguation: null, updateTarget: { course: { ...course, raw: full } } },
    reply: `Delete "${full.title}"?\n\nThis LMS prefers archiving over permanent deletion, so I will set its status to Archived (hiding it from active listings) rather than erasing its records.\n\nThis may affect:\n- ${full.classCount ?? 0} batch(es)\n- ${full.enrolled ?? 0} enrollment(s)\n\nAre you sure? Reply "Confirm" or "Cancel".`,
  };
}

async function runDeleteExecution(state, context) {
  const { course } = state.updateTarget;
  try {
    await updateCourse({ ...course.raw, id: course.id, title: course.raw.title, status: "Archived" });
    await logAudit(context, "DELETE_COURSE", { courseId: course.id }, { result: "success", entity: "courses", entityId: course.id, confirmationStatus: "confirmed" });
    return { state: initialState(), reply: `✅ "${course.raw.title}" has been archived.` };
  } catch (error) {
    await logAudit(context, "DELETE_COURSE", { courseId: course.id }, { result: "failure", entity: "courses", entityId: course.id, errorMessage: error.message, confirmationStatus: "confirmed" });
    return { state: initialState(), reply: `❌ I couldn't complete this because: ${error.message}` };
  }
}

export function actionCatalog() {
  return ACTIONS;
}
