"use client";

import { useEffect, useState } from "react";
import { Award, BookOpen, Mail, Phone, ShieldCheck, Trophy } from "lucide-react";
import { subscribeMyAchievements, subscribeMyCertificates } from "../../lib/achievement-data";
import { StatusBadge } from "../data-table/DataTable";
import { studentStatus } from "./StudentTable";

const STATUS_TONE = { Pending: "orange", Rejected: "red", Inactive: "gray", Active: "green" };
const metric = (value) => (value == null ? "No data yet" : `${value}%`);

function initialsOf(name, email) {
  const source = (name || email || "?").trim();
  const parts = source.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return source.slice(0, 2).toUpperCase() || "?";
}

function Section({ title, icon: Icon, children }) {
  return (
    <section className="rounded-2xl border border-border-subtle p-4">
      <h4 className="mb-3 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-subtle">
        {Icon && <Icon className="h-3.5 w-3.5" aria-hidden="true" />} {title}
      </h4>
      {children}
    </section>
  );
}

function Metric({ label, value }) {
  return (
    <div>
      <p className="text-[10px] font-bold uppercase tracking-wider text-subtle">{label}</p>
      <p className="text-lg font-black text-ink">{value}</p>
    </div>
  );
}

// Achievements/Certificates are read live from Firestore, the SAME
// subscriptions the student's own "My Achievements" page uses — real data,
// no second system. firestore.rules' admin() branch already lets a
// Director/Admin read any studentId's docs this way.
export default function StudentDetails({ student }) {
  const [achievements, setAchievements] = useState([]);
  const [certificates, setCertificates] = useState([]);

  useEffect(() => {
    if (!student?.id) return undefined;
    const unsubA = subscribeMyAchievements(student.id, setAchievements, () => {});
    const unsubC = subscribeMyCertificates(student.id, setCertificates, () => {});
    return () => {
      unsubA();
      unsubC();
    };
  }, [student?.id]);

  const status = studentStatus(student);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <span className="grid h-14 w-14 shrink-0 place-items-center rounded-full bg-active text-lg font-bold text-primary">
          {initialsOf(student.displayName, student.email)}
        </span>
        <div className="min-w-0 flex-1">
          <b className="block truncate text-base text-ink">{student.displayName || "Unnamed student"}</b>
          <span className="block font-mono text-xs text-subtle">{student.userId || "—"}</span>
        </div>
        <StatusBadge tone={STATUS_TONE[status]}>{status}</StatusBadge>
      </div>

      {status === "Rejected" && student.rejectionReason && (
        <p className="rounded-xl bg-active px-3 py-2 text-xs text-primary">
          <b>Rejection reason:</b> {student.rejectionReason}
        </p>
      )}

      <Section title="Contact information" icon={Mail}>
        <div className="grid gap-2 sm:grid-cols-2">
          <p className="flex items-center gap-2 text-sm text-ink"><Mail className="h-3.5 w-3.5 text-subtle" aria-hidden="true" /> {student.email || "—"}</p>
          <p className="flex items-center gap-2 text-sm text-ink"><Phone className="h-3.5 w-3.5 text-subtle" aria-hidden="true" /> {student.phone || "—"}</p>
        </div>
      </Section>

      <Section title="Enrollment &amp; progress" icon={BookOpen}>
        <p className="mb-3 text-sm text-ink">{student.courseNames || <span className="text-subtle">No enrollment</span>}</p>
        <div className="grid grid-cols-2 gap-4">
          <Metric label="Progress" value={metric(student.progress)} />
          <Metric label="Attendance" value={metric(student.attendance)} />
        </div>
      </Section>

      <Section title="Achievements" icon={Trophy}>
        {achievements.length ? (
          <div className="space-y-2">
            {achievements.map((item) => (
              <div key={item.id} className="rounded-xl border border-border-subtle p-2.5">
                <b className="block text-xs text-ink">{item.title}</b>
                <span className="text-[10px] font-bold uppercase tracking-wider text-subtle">{item.type ? item.type.replace(/_/g, " ") : "Achievement"}</span>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-xs text-muted">No awards yet.</p>
        )}
      </Section>

      <Section title="Certificates" icon={Award}>
        {certificates.length ? (
          <div className="space-y-2">
            {certificates.map((cert) => (
              <div key={cert.id} className="flex items-center justify-between gap-2 rounded-xl border border-border-subtle p-2.5">
                <div className="min-w-0">
                  <b className="block truncate text-xs text-ink">{cert.title || "Certificate"}</b>
                  <span className="font-mono text-[10px] text-subtle">{cert.certificateCode || cert.id}</span>
                </div>
                {cert.status === "revoked" ? (
                  <span className="shrink-0 rounded-full bg-active px-2 py-0.5 text-[10px] font-bold text-primary">Revoked</span>
                ) : (
                  <ShieldCheck className="h-4 w-4 shrink-0 text-success" aria-hidden="true" />
                )}
              </div>
            ))}
          </div>
        ) : (
          <p className="text-xs text-muted">No certificates yet.</p>
        )}
      </Section>
    </div>
  );
}
