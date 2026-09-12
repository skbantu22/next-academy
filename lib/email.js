import "server-only";

// Generic email send via Resend — no new email provider or architecture
// introduced. `bcc` (not `to`) is used for broadcasts so recipients never
// see each other's addresses.
export async function sendEmail({ to, bcc, subject, text }) {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.RESEND_FROM_EMAIL;
  if (!apiKey || !from) {
    throw new Error("Resend email settings are not configured.");
  }
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from, to: to || [from], ...(bcc?.length ? { bcc } : {}), subject, text }),
  });
  if (!response.ok) {
    throw new Error(`Resend request failed with status ${response.status}.`);
  }
}

const chunk = (items, size) => Array.from({ length: Math.ceil(items.length / size) }, (_, i) => items.slice(i * size, i * size + size));

// Best-effort broadcast to many recipients — Resend caps recipients per
// call, so this sends in small bcc batches. Every batch failure is
// collected and returned rather than thrown, so one bad address never
// aborts the rest of the broadcast.
export async function broadcastEmail(emails, { subject, text }) {
  const batches = chunk([...new Set(emails.filter(Boolean))], 45);
  const failures = [];
  for (const batch of batches) {
    try {
      await sendEmail({ bcc: batch, subject, text });
    } catch (error) {
      failures.push({ batchSize: batch.length, message: error.message });
    }
  }
  return { sent: batches.length - failures.length, failed: failures.length };
}
