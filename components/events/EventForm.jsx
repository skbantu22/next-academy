"use client";

import { useEffect, useState } from "react";
import { ImagePlus } from "lucide-react";
import { EVENT_TYPES, TARGET_AUDIENCES } from "../../lib/events-shared";
import { loadUsers } from "../../lib/services/user-service";
import { stopEnterSubmit } from "../../lib/ui/keyboard";

const staffRoles = new Set(["Admin", "Director", "Teacher"]);

export default function EventForm({ form, setForm, saving, error, onCancel, onSubmit, bannerPreview, onBannerSelect, onBannerRemove }) {
  const [staff, setStaff] = useState([]);

  useEffect(() => {
    loadUsers()
      .then((result) => setStaff((result.users || []).filter((item) => staffRoles.has(item.role))))
      .catch(() => {});
  }, []);

  function set(field, value) {
    setForm((current) => ({ ...current, [field]: value }));
  }
  function toggleAudience(item) {
    setForm((current) => ({
      ...current,
      targetAudience: current.targetAudience.includes(item)
        ? current.targetAudience.filter((entry) => entry !== item)
        : [...current.targetAudience, item],
    }));
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="grid gap-1 text-xs font-bold text-muted sm:col-span-2">
          Event Name
          <input value={form.name} onChange={(e) => set("name", e.target.value)} onKeyDown={stopEnterSubmit} required maxLength={160} className="rounded-xl border border-border-subtle px-3 py-2.5 text-sm font-normal" />
        </label>
        <label className="grid gap-1 text-xs font-bold text-muted">
          Event Type
          <select value={form.type} onChange={(e) => set("type", e.target.value)} required className="rounded-xl border border-border-subtle px-3 py-2.5 text-sm font-normal">
            <option value="">Choose a type</option>
            {EVENT_TYPES.map((item) => <option key={item} value={item}>{item}</option>)}
          </select>
        </label>
        <label className="grid gap-1 text-xs font-bold text-muted">
          Location
          <input value={form.location} onChange={(e) => set("location", e.target.value)} onKeyDown={stopEnterSubmit} maxLength={200} className="rounded-xl border border-border-subtle px-3 py-2.5 text-sm font-normal" />
        </label>
        <label className="grid gap-1 text-xs font-bold text-muted sm:col-span-2">
          Description
          <textarea value={form.description} onChange={(e) => set("description", e.target.value)} rows={3} maxLength={5000} className="rounded-xl border border-border-subtle px-3 py-2.5 text-sm font-normal" />
        </label>
        <label className="grid gap-1 text-xs font-bold text-muted">
          Event Date
          <input type="date" value={form.eventDate} onChange={(e) => set("eventDate", e.target.value)} onKeyDown={stopEnterSubmit} required className="rounded-xl border border-border-subtle px-3 py-2.5 text-sm font-normal" />
        </label>
        <div />
        <label className="grid gap-1 text-xs font-bold text-muted">
          Start Time
          <input type="time" value={form.startTime} onChange={(e) => set("startTime", e.target.value)} onKeyDown={stopEnterSubmit} required className="rounded-xl border border-border-subtle px-3 py-2.5 text-sm font-normal" />
        </label>
        <label className="grid gap-1 text-xs font-bold text-muted">
          End Time
          <input type="time" value={form.endTime} onChange={(e) => set("endTime", e.target.value)} onKeyDown={stopEnterSubmit} required className="rounded-xl border border-border-subtle px-3 py-2.5 text-sm font-normal" />
        </label>
        <label className="grid gap-1 text-xs font-bold text-muted">
          Organizer
          <input value={form.organizer} onChange={(e) => set("organizer", e.target.value)} onKeyDown={stopEnterSubmit} placeholder="e.g. Academic Affairs Office" maxLength={160} className="rounded-xl border border-border-subtle px-3 py-2.5 text-sm font-normal" />
        </label>
        <label className="grid gap-1 text-xs font-bold text-muted">
          Organizer (staff account, optional)
          <select value={form.organizerId} onChange={(e) => set("organizerId", e.target.value)} className="rounded-xl border border-border-subtle px-3 py-2.5 text-sm font-normal">
            <option value="">None</option>
            {staff.map((item) => <option key={item.uid} value={item.uid}>{item.displayName || item.email} ({item.role})</option>)}
          </select>
          <span className="font-normal normal-case text-subtle">Lets a Teacher manage this event&apos;s attendance.</span>
        </label>
        <label className="grid gap-1 text-xs font-bold text-muted">
          Maximum Participants
          <input type="number" min="0" value={form.maxParticipants} onChange={(e) => set("maxParticipants", e.target.value)} onKeyDown={stopEnterSubmit} placeholder="No limit" className="rounded-xl border border-border-subtle px-3 py-2.5 text-sm font-normal" />
        </label>
        <label className="grid gap-1 text-xs font-bold text-muted">
          Status Override
          <select value={form.status} onChange={(e) => set("status", e.target.value)} className="rounded-xl border border-border-subtle px-3 py-2.5 text-sm font-normal">
            <option value="">Automatic (Upcoming/Ongoing/Completed)</option>
            <option value="Draft">Draft</option>
            <option value="Cancelled">Cancelled</option>
          </select>
        </label>

        <div className="sm:col-span-2">
          <p className="mb-1 text-xs font-bold text-muted">Target Audience</p>
          <div className="flex flex-wrap gap-2">
            {TARGET_AUDIENCES.map((item) => (
              <button type="button" key={item} onClick={() => toggleAudience(item)} className={`rounded-full px-3 py-1.5 text-xs font-bold transition ${form.targetAudience.includes(item) ? "bg-primary text-white" : "bg-page text-muted hover:bg-active hover:text-primary"}`}>
                {item}
              </button>
            ))}
          </div>
        </div>

        <div className="sm:col-span-2">
          <p className="mb-1 text-xs font-bold text-muted">Event Banner</p>
          <label className="relative flex h-40 w-full cursor-pointer items-center justify-center overflow-hidden rounded-xl border-2 border-dashed border-border-subtle bg-page transition hover:border-primary">
            {bannerPreview ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={bannerPreview} alt="Event banner preview" className="h-full w-full object-cover" />
            ) : (
              <span className="flex flex-col items-center gap-1.5 px-4 text-center normal-case">
                <ImagePlus className="h-6 w-6 text-subtle" aria-hidden="true" />
                <span className="text-xs font-bold text-muted">Click to upload a thumbnail</span>
                <span className="text-[10px] font-normal text-subtle">PNG or JPG · recommended 1200×630</span>
              </span>
            )}
            <input
              type="file"
              accept="image/*"
              onChange={(e) => onBannerSelect(e.target.files?.[0] || null)}
              className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
              aria-label="Upload event thumbnail"
            />
          </label>
          {bannerPreview && (
            <button type="button" onClick={onBannerRemove} className="mt-2 rounded-lg border border-border-subtle px-3 py-1.5 text-xs font-bold text-primary hover:bg-active">
              Remove
            </button>
          )}
        </div>

        <label className="flex items-center gap-2 text-xs font-bold text-muted">
          <input type="checkbox" checked={form.registrationRequired} onChange={(e) => set("registrationRequired", e.target.checked)} />
          Registration Required
        </label>
        <label className="flex items-center gap-2 text-xs font-bold text-muted">
          <input type="checkbox" checked={form.published} onChange={(e) => set("published", e.target.checked)} />
          Publish Event
        </label>
        {form.registrationRequired && (
          <label className="grid gap-1 text-xs font-bold text-muted sm:col-span-2">
            Registration Deadline
            <input type="date" value={form.registrationDeadline} onChange={(e) => set("registrationDeadline", e.target.value)} onKeyDown={stopEnterSubmit} className="rounded-xl border border-border-subtle px-3 py-2.5 text-sm font-normal" />
          </label>
        )}
      </div>

      {error && <p className="rounded-xl bg-active px-3 py-2 text-sm text-primary">{error}</p>}
      <div className="flex justify-end gap-3 pt-2">
        <button type="button" onClick={onCancel} disabled={saving} className="rounded-xl px-4 py-2.5 text-sm font-bold text-muted">Cancel</button>
        <button disabled={saving} className="rounded-xl bg-primary px-5 py-2.5 text-sm font-bold text-white disabled:opacity-60">{saving ? "Saving..." : "Save Event"}</button>
      </div>
    </form>
  );
}
