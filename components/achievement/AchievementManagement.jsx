"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Award, BadgeCheck, FileCheck2, LayoutTemplate, ShieldCheck } from "lucide-react";
import StatCard from "../finance/StatCard";
import {
  createTemplate,
  deleteTemplate,
  loadGeneratedCertificates,
  loadTemplates,
  reissueGeneratedCertificate,
  revokeGeneratedCertificate,
  updateTemplate,
  uploadTemplateBackground,
} from "../../lib/achievement-data";
import { CERTIFICATE_TYPES } from "../../lib/achievement-shared";
// (ACHIEVEMENT_TYPES also lives in achievement-shared.js — used by
// TeacherWorkspacePage.js's Award-achievement form.)

// One sidebar entry ("Achievement" for Director/Admin), one shell, tabs
// inside — same convention as Finance/Training. Everything certificate- and
// achievement-related lives in this single module; there is no separate
// Certificate dashboard anywhere else in the app.
const tabs = ["Overview", "Templates", "Generated Certificates", "Achievements", "Verification"];

const DYNAMIC_VARIABLES = [
  "{{student_name}}", "{{course_name}}", "{{course_title}}", "{{student_id}}",
  "{{completion_date}}", "{{issue_date}}", "{{certificate_id}}", "{{instructor_name}}",
  "{{trainer_name}}", "{{academy_name}}", "{{duration}}", "{{batch_name}}",
];

export default function AchievementManagement() {
  const [tab, setTab] = useState("Overview");
  const [templates, setTemplates] = useState([]);
  const [certificates, setCertificates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(() => {
    setLoading(true);
    Promise.all([loadTemplates(), loadGeneratedCertificates()])
      .then(([t, c]) => {
        setTemplates(t.templates || []);
        setCertificates(c.certificates || []);
        setError("");
      })
      .catch((err) => setError(err.message || "Unable to load Achievement data."))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    void Promise.resolve().then(load);
  }, [load]);

  const stats = useMemo(() => {
    const activeTemplates = templates.filter((item) => item.status === "active").length;
    const activeCerts = certificates.filter((item) => item.status !== "revoked");
    const now = new Date();
    const thisMonth = activeCerts.filter((item) => {
      const d = item.issueDate?.toDate?.() || (item.issueDate ? new Date(item.issueDate) : null);
      return d && d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
    });
    const studentsWithCerts = new Set(activeCerts.map((item) => item.studentId)).size;
    return {
      totalTemplates: templates.length,
      activeTemplates,
      generatedCertificates: activeCerts.length,
      certificatesThisMonth: thisMonth.length,
      totalAchievements: certificates.length,
      studentsWithCertificates: studentsWithCerts,
    };
  }, [templates, certificates]);

  return (
    <div className="space-y-6">
      <section className="flex flex-wrap items-center justify-between gap-4 rounded-3xl border border-[#f3aaaa] bg-[linear-gradient(120deg,#fff0f0_0%,#fff7f7_45%,#ffffff_100%)] p-6 text-ink shadow-xl">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-widest text-primary">Achievement</p>
          <h2 className="mt-2 text-3xl font-black">Achievement &amp; Certificates</h2>
          <p className="mt-2 text-sm text-muted">Certificate templates, automatic course-completion certificates, and student achievements — all in one place.</p>
        </div>
      </section>

      <nav className="flex flex-wrap gap-2 overflow-x-auto rounded-2xl border border-border-subtle bg-white p-2 shadow-sm">
        {tabs.map((item) => (
          <button
            key={item}
            type="button"
            onClick={() => setTab(item)}
            className={`shrink-0 rounded-xl px-4 py-2 text-xs font-bold ${tab === item ? "bg-primary text-white" : "text-muted hover:bg-active"}`}
          >
            {item}
          </button>
        ))}
      </nav>

      {error && <p className="rounded-xl bg-active p-4 text-sm text-primary">{error}</p>}

      {tab === "Overview" && (
        <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          <StatCard label="Total Templates" value={stats.totalTemplates} icon={LayoutTemplate} iconBg="bg-active" iconColor="text-primary" loading={loading} />
          <StatCard label="Active Templates" value={stats.activeTemplates} icon={BadgeCheck} iconBg="bg-success-soft" iconColor="text-success" loading={loading} />
          <StatCard label="Generated Certificates" value={stats.generatedCertificates} icon={FileCheck2} iconBg="bg-active" iconColor="text-primary" loading={loading} />
          <StatCard label="Certificates This Month" value={stats.certificatesThisMonth} icon={FileCheck2} iconBg="bg-warning-soft" iconColor="text-warning" loading={loading} />
          <StatCard label="Total Achievements" value={stats.totalAchievements} icon={Award} iconBg="bg-active" iconColor="text-primary" loading={loading} />
          <StatCard label="Students With Certificates" value={stats.studentsWithCertificates} icon={ShieldCheck} iconBg="bg-success-soft" iconColor="text-success" loading={loading} />
        </section>
      )}

      {tab === "Templates" && <TemplatesTab templates={templates} onChanged={load} />}
      {tab === "Generated Certificates" && <CertificatesTab certificates={certificates} onChanged={load} />}
      {tab === "Achievements" && <AchievementsTab certificates={certificates} />}
      {tab === "Verification" && <VerificationTab />}
    </div>
  );
}

const blankTemplate = { name: "", description: "", templateCode: "", type: CERTIFICATE_TYPES[0] };

function TemplatesTab({ templates, onChanged }) {
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(blankTemplate);
  const [file, setFile] = useState(null);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  function openNew() {
    setEditing("new");
    setForm(blankTemplate);
    setFile(null);
    setMessage("");
  }
  function openEdit(template) {
    setEditing(template.id);
    setForm({ name: template.name, description: template.description || "", templateCode: template.templateCode, type: template.type });
    setFile(null);
    setMessage("");
  }
  function close() {
    setEditing(null);
    setFile(null);
  }

  async function save() {
    if (!form.name.trim() || !form.templateCode.trim()) return;
    setSaving(true);
    setMessage("");
    try {
      let id = editing !== "new" ? editing : null;
      if (!id) {
        const created = await createTemplate(form);
        id = created.id;
      } else {
        await updateTemplate({ id, ...form });
      }
      if (file) {
        const { backgroundUrl, backgroundPath } = await uploadTemplateBackground(id, file);
        await updateTemplate({ id, backgroundUrl, backgroundPath });
      }
      setMessage(editing === "new" ? "Template created." : "Template updated.");
      close();
      onChanged();
    } catch (error) {
      setMessage(error.message || "Unable to save the template.");
    } finally {
      setSaving(false);
    }
  }
  async function toggleStatus(template) {
    await updateTemplate({ id: template.id, status: template.status === "active" ? "inactive" : "active" });
    onChanged();
  }
  async function duplicate(template) {
    await createTemplate({
      name: `${template.name} (Copy)`,
      description: template.description,
      templateCode: `${template.templateCode}-COPY`,
      type: template.type,
      backgroundUrl: template.backgroundUrl,
      backgroundPath: template.backgroundPath,
      config: template.config,
    });
    onChanged();
  }
  async function remove(template) {
    if (!window.confirm(`Delete template "${template.name}"?`)) return;
    try {
      await deleteTemplate(template.id);
      onChanged();
    } catch (error) {
      window.alert(error.message || "Unable to delete this template.");
    }
  }

  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-bold text-ink">Certificate Templates</h3>
        <button onClick={openNew} className="rounded-xl bg-primary px-4 py-2 text-xs font-bold text-white">+ New Template</button>
      </div>

      {message && !editing && <p className="text-xs text-muted">{message}</p>}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {templates.map((template) => (
          <article key={template.id} className="overflow-hidden rounded-2xl border border-border-subtle bg-white shadow-sm">
            <div className="aspect-video w-full bg-page">
              {template.backgroundUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={template.backgroundUrl} alt={template.name} className="h-full w-full object-cover" />
              ) : (
                <div className="grid h-full place-items-center text-xs text-subtle">No background uploaded</div>
              )}
            </div>
            <div className="space-y-2 p-4">
              <div className="flex items-center justify-between">
                <b className="text-sm text-ink">{template.name}</b>
                <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${template.status === "active" ? "bg-success-soft text-success" : "bg-page text-subtle"}`}>
                  {template.status === "active" ? "Active" : "Inactive"}
                </span>
              </div>
              <p className="text-[11px] text-muted">{template.type} · <span className="font-mono">{template.templateCode}</span></p>
              {template.description && <p className="text-xs text-muted">{template.description}</p>}
              <div className="flex flex-wrap gap-2 pt-2">
                <button onClick={() => openEdit(template)} className="rounded-lg border border-border-subtle px-3 py-1.5 text-[11px] font-bold text-ink hover:bg-active">Edit</button>
                <button onClick={() => toggleStatus(template)} className="rounded-lg border border-border-subtle px-3 py-1.5 text-[11px] font-bold text-ink hover:bg-active">
                  {template.status === "active" ? "Deactivate" : "Activate"}
                </button>
                <button onClick={() => duplicate(template)} className="rounded-lg border border-border-subtle px-3 py-1.5 text-[11px] font-bold text-ink hover:bg-active">Duplicate</button>
                <button onClick={() => remove(template)} className="rounded-lg border border-border-subtle px-3 py-1.5 text-[11px] font-bold text-primary hover:bg-active">Delete</button>
              </div>
            </div>
          </article>
        ))}
        {!templates.length && <p className="text-sm text-muted">No certificate templates yet — create one to enable certificates on a course.</p>}
      </div>

      {editing && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4">
          <div className="w-full max-w-lg space-y-4 rounded-2xl bg-white p-6 shadow-xl">
            <h4 className="text-sm font-bold text-ink">{editing === "new" ? "New Certificate Template" : "Edit Certificate Template"}</h4>
            <label className="grid gap-1 text-xs font-bold text-muted">
              Name
              <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Next Academy Course Completion" className="rounded-xl border border-border-subtle px-3 py-2 text-sm font-normal" />
            </label>
            <label className="grid gap-1 text-xs font-bold text-muted">
              Description
              <textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={2} className="rounded-xl border border-border-subtle px-3 py-2 text-sm font-normal" />
            </label>
            <div className="grid grid-cols-2 gap-3">
              <label className="grid gap-1 text-xs font-bold text-muted">
                Template Code
                <input value={form.templateCode} onChange={(e) => setForm({ ...form, templateCode: e.target.value })} placeholder="NACADEMY-COURSE" className="rounded-xl border border-border-subtle px-3 py-2 text-sm font-normal" />
              </label>
              <label className="grid gap-1 text-xs font-bold text-muted">
                Certificate Type
                <select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })} className="rounded-xl border border-border-subtle px-3 py-2 text-sm font-normal">
                  {CERTIFICATE_TYPES.map((type) => <option key={type} value={type}>{type}</option>)}
                </select>
              </label>
            </div>
            <label className="grid gap-1 text-xs font-bold text-muted">
              Background Image
              <input type="file" accept="image/*" onChange={(e) => setFile(e.target.files?.[0] || null)} className="text-xs" />
            </label>
            <div className="rounded-xl border border-dashed border-border-subtle p-3">
              <p className="mb-1 text-[10px] font-bold uppercase text-subtle">Dynamic variables available on the final certificate</p>
              <p className="font-mono text-[11px] text-muted">{DYNAMIC_VARIABLES.join("  ")}</p>
            </div>
            {message && <p className="text-xs text-primary">{message}</p>}
            <div className="flex justify-end gap-3">
              <button onClick={close} disabled={saving} className="px-4 py-2 text-sm font-bold text-muted">Cancel</button>
              <button onClick={save} disabled={saving || !form.name.trim() || !form.templateCode.trim()} className="rounded-xl bg-primary px-4 py-2 text-sm font-bold text-white disabled:opacity-60">
                {saving ? "Saving..." : "Save Template"}
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

function CertificatesTab({ certificates, onChanged }) {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");
  const [busyId, setBusyId] = useState("");

  const filtered = certificates.filter((cert) => {
    if (statusFilter !== "All" && (cert.status || "active") !== statusFilter.toLowerCase()) return false;
    const haystack = `${cert.studentName} ${cert.studentUserId} ${cert.courseName} ${cert.certificateCode}`.toLowerCase();
    return haystack.includes(search.trim().toLowerCase());
  });

  async function revoke(cert) {
    if (!window.confirm(`Revoke certificate ${cert.certificateCode || cert.id}? It will no longer verify as valid.`)) return;
    setBusyId(cert.id);
    try {
      await revokeGeneratedCertificate(cert.id);
      onChanged();
    } catch (error) {
      window.alert(error.message || "Unable to revoke this certificate.");
    } finally {
      setBusyId("");
    }
  }
  async function reissue(cert) {
    setBusyId(cert.id);
    try {
      await reissueGeneratedCertificate(cert.id);
      onChanged();
    } catch (error) {
      window.alert(error.message || "Unable to reissue this certificate.");
    } finally {
      setBusyId("");
    }
  }

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search student, ID, course, certificate code..." className="min-w-[240px] flex-1 rounded-xl border border-border-subtle px-3 py-2 text-sm" />
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="rounded-xl border border-border-subtle px-3 py-2 text-sm">
          {["All", "Active", "Revoked"].map((item) => <option key={item} value={item}>{item}</option>)}
        </select>
      </div>
      <div className="overflow-x-auto rounded-2xl border border-border-subtle bg-white shadow-sm">
        <table className="w-full min-w-[900px] text-left text-xs">
          <thead className="bg-page text-[10px] font-bold uppercase tracking-wider text-subtle">
            <tr>
              <th className="p-3">Student</th>
              <th className="p-3">Course</th>
              <th className="p-3">Type</th>
              <th className="p-3">Template</th>
              <th className="p-3">Certificate ID</th>
              <th className="p-3">Issue Date</th>
              <th className="p-3">Status</th>
              <th className="p-3">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((cert) => (
              <tr key={cert.id} className="border-t border-border-subtle">
                <td className="p-3">
                  <b className="block text-ink">{cert.studentName || "—"}</b>
                  <span className="text-subtle">{cert.studentUserId}</span>
                </td>
                <td className="p-3">{cert.courseName || "—"}</td>
                <td className="p-3">{cert.type || "—"}</td>
                <td className="p-3">{cert.templateName || "—"}</td>
                <td className="p-3 font-mono">{cert.certificateCode || cert.id}</td>
                <td className="p-3">{cert.issueDate?.toDate?.().toLocaleDateString?.() || cert.metadata?.completionDate || "—"}</td>
                <td className="p-3">
                  <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${cert.status === "revoked" ? "bg-active text-primary" : "bg-success-soft text-success"}`}>
                    {cert.status === "revoked" ? "Revoked" : "Active"}
                  </span>
                </td>
                <td className="p-3">
                  <div className="flex flex-wrap gap-2">
                    <a href={`/api/certificates/${cert.id}/pdf`} target="_blank" rel="noreferrer" className="rounded-lg border border-border-subtle px-2 py-1 font-bold text-ink hover:bg-active">View</a>
                    <a href={`/verify/${encodeURIComponent(cert.certificateCode || cert.id)}`} target="_blank" rel="noreferrer" className="rounded-lg border border-border-subtle px-2 py-1 font-bold text-ink hover:bg-active">Verify</a>
                    {cert.status !== "revoked" ? (
                      <button disabled={busyId === cert.id} onClick={() => revoke(cert)} className="rounded-lg border border-border-subtle px-2 py-1 font-bold text-primary hover:bg-active disabled:opacity-50">Revoke</button>
                    ) : (
                      <button disabled={busyId === cert.id} onClick={() => reissue(cert)} className="rounded-lg border border-border-subtle px-2 py-1 font-bold text-ink hover:bg-active disabled:opacity-50">Reissue</button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
            {!filtered.length && (
              <tr><td colSpan={8} className="p-6 text-center text-muted">No certificates match these filters.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function AchievementsTab({ certificates }) {
  // Achievements are the underlying "award" every issued certificate is
  // linked to (see certificate-core.js) — this view gives the admin the
  // same list from the achievement angle without a second data source.
  return (
    <section className="rounded-2xl border border-border-subtle bg-white p-5 shadow-sm">
      <h3 className="mb-3 text-sm font-bold text-ink">Certificates issued (linked achievements)</h3>
      <div className="space-y-2">
        {certificates.map((cert) => (
          <div key={cert.id} className="flex items-center justify-between border-b border-border-subtle py-2 text-xs last:border-0">
            <span><b className="text-ink">{cert.studentName || cert.studentId}</b> — {cert.title || cert.type}</span>
            <span className="text-subtle">{cert.type}</span>
          </div>
        ))}
        {!certificates.length && <p className="text-sm text-muted">No achievements recorded yet.</p>}
      </div>
    </section>
  );
}

function VerificationTab() {
  const [id, setId] = useState("");
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);

  async function verify() {
    if (!id.trim()) return;
    setLoading(true);
    setResult(null);
    try {
      const response = await fetch(`/api/verify/${encodeURIComponent(id.trim())}`);
      setResult(await response.json());
    } catch {
      setResult({ result: "not_found" });
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="max-w-lg space-y-4 rounded-2xl border border-border-subtle bg-white p-6 shadow-sm">
      <h3 className="text-sm font-bold text-ink">Verify a Certificate</h3>
      <div className="flex gap-2">
        <input value={id} onChange={(e) => setId(e.target.value)} placeholder="Enter Certificate ID" className="flex-1 rounded-xl border border-border-subtle px-3 py-2 text-sm" />
        <button onClick={verify} disabled={loading} className="rounded-xl bg-primary px-4 py-2 text-xs font-bold text-white disabled:opacity-50">Verify</button>
      </div>
      {result && (
        <div className={`rounded-xl border p-4 text-sm ${result.result === "valid" ? "border-success bg-success-soft" : "border-primary bg-active"}`}>
          {result.result === "valid" && (
            <>
              <b className="block text-success">✓ Valid Certificate</b>
              <p className="mt-2 text-xs text-ink">Student: {result.studentName}</p>
              <p className="text-xs text-ink">Course: {result.courseName}</p>
              <p className="text-xs text-ink">Issue Date: {result.issueDate}</p>
              <p className="text-xs text-ink">Certificate ID: {result.certificateId}</p>
            </>
          )}
          {result.result === "revoked" && <b className="block text-primary">⚠ This certificate has been revoked and is no longer valid.</b>}
          {result.result === "not_found" && <b className="block text-primary">✕ No certificate found with this ID.</b>}
        </div>
      )}
    </section>
  );
}
