"use client";

import { useState } from "react";
import { X } from "lucide-react";
import { updateMyProfile } from "../../lib/profile-data";

const genders = ["Prefer not to say", "Male", "Female", "Other"];

function Field({ label, ...props }) {
  return (
    <label className="grid gap-1 text-xs font-semibold text-muted">
      {label}
      <input
        {...props}
        className="rounded-xl border border-border-subtle bg-page px-3 py-2.5 text-xs font-normal text-ink outline-none focus:ring-2 focus:ring-primary"
      />
    </label>
  );
}

export default function EditProfileModal({ uid, profile, onClose, onSaved }) {
  const [form, setForm] = useState({
    displayName: profile?.displayName || "",
    phone: profile?.phone || "",
    photoURL: profile?.photoURL || "",
    dateOfBirth: profile?.dateOfBirth || "",
    gender: profile?.gender || "",
    address: profile?.address || "",
    raceEthnicity: profile?.raceEthnicity || "",
    nationality: profile?.nationality || "",
    religion: profile?.religion || "",
    bloodGroup: profile?.bloodGroup || "",
    emergencyContactName: profile?.emergencyContactName || "",
    emergencyContactPhone: profile?.emergencyContactPhone || "",
    about: profile?.about || "",
    interests: (profile?.interests || []).join(", "),
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  function set(field) {
    return (event) => setForm((current) => ({ ...current, [field]: event.target.value }));
  }

  async function handleSave() {
    if (!form.displayName.trim()) {
      setError("Full name cannot be empty.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      await updateMyProfile(uid, {
        displayName: form.displayName.trim(),
        phone: form.phone.trim(),
        photoURL: form.photoURL.trim(),
        dateOfBirth: form.dateOfBirth,
        gender: form.gender,
        address: form.address.trim(),
        raceEthnicity: form.raceEthnicity.trim(),
        nationality: form.nationality.trim(),
        religion: form.religion.trim(),
        bloodGroup: form.bloodGroup.trim(),
        emergencyContactName: form.emergencyContactName.trim(),
        emergencyContactPhone: form.emergencyContactPhone.trim(),
        about: form.about.trim(),
        interests: form.interests
          .split(",")
          .map((item) => item.trim())
          .filter(Boolean),
      });
      onSaved?.();
      onClose();
    } catch (err) {
      setError(err.message || "Unable to save your profile.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/50 p-4">
      <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl border border-border-subtle bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-border-subtle p-5">
          <b className="text-base text-ink">Edit profile</b>
          <button type="button" onClick={onClose} className="text-subtle hover:text-primary" aria-label="Close">
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="grid gap-4 p-5">
          {error && <p className="rounded-xl bg-active p-3 text-xs font-semibold text-primary">{error}</p>}

          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Full name" value={form.displayName} onChange={set("displayName")} />
            <Field label="Phone number" value={form.phone} onChange={set("phone")} />
          </div>
          <Field label="Profile photo URL (optional)" value={form.photoURL} onChange={set("photoURL")} placeholder="https://..." />

          <p className="mt-2 text-[10px] font-bold uppercase tracking-wider text-subtle">Personal details</p>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Date of birth" type="date" value={form.dateOfBirth} onChange={set("dateOfBirth")} />
            <label className="grid gap-1 text-xs font-semibold text-muted">
              Gender
              <select
                value={form.gender}
                onChange={set("gender")}
                className="rounded-xl border border-border-subtle bg-page px-3 py-2.5 text-xs font-normal text-ink outline-none focus:ring-2 focus:ring-primary"
              >
                <option value="">Not set</option>
                {genders.map((g) => (
                  <option key={g} value={g}>
                    {g}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <Field label="Home address" value={form.address} onChange={set("address")} />

          <p className="mt-2 text-[10px] font-bold uppercase tracking-wider text-subtle">Background</p>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Race / Ethnicity" value={form.raceEthnicity} onChange={set("raceEthnicity")} />
            <Field label="Nationality / Citizenship" value={form.nationality} onChange={set("nationality")} />
            <Field label="Religion" value={form.religion} onChange={set("religion")} />
            <Field label="Blood group" value={form.bloodGroup} onChange={set("bloodGroup")} />
          </div>

          <p className="mt-2 text-[10px] font-bold uppercase tracking-wider text-subtle">Emergency contact</p>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Contact name" value={form.emergencyContactName} onChange={set("emergencyContactName")} />
            <Field label="Contact number" value={form.emergencyContactPhone} onChange={set("emergencyContactPhone")} />
          </div>

          <p className="mt-2 text-[10px] font-bold uppercase tracking-wider text-subtle">About you</p>
          <label className="grid gap-1 text-xs font-semibold text-muted">
            About me
            <textarea
              value={form.about}
              onChange={set("about")}
              rows={3}
              className="rounded-xl border border-border-subtle bg-page px-3 py-2.5 text-xs font-normal text-ink outline-none focus:ring-2 focus:ring-primary"
            />
          </label>
          <Field label="Interests (comma-separated)" value={form.interests} onChange={set("interests")} placeholder="Reading, Football, Music" />
        </div>
        <div className="flex justify-end gap-3 border-t border-border-subtle p-5">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-border-subtle px-4 py-2.5 text-xs font-bold text-muted hover:bg-page"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="rounded-xl bg-primary px-5 py-2.5 text-xs font-bold text-white hover:bg-primary-hover disabled:opacity-60"
          >
            {saving ? "Saving..." : "Save changes"}
          </button>
        </div>
      </div>
    </div>
  );
}
