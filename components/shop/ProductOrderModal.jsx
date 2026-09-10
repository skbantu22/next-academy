"use client";

import { useState } from "react";
import { CalendarClock, CheckCircle2, MapPin, Minus, Plus, ShoppingBag } from "lucide-react";
import { checkout } from "../../lib/shop-data";
import { useUpcomingCollectionSessions, formatSessionDate } from "../../lib/useCollectionSessions";

const money = (value) => `$${Number(value || 0).toFixed(2)}`;
const phonePattern = /^[0-9+\-\s()]{6,20}$/;
const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// A real, single-product "Buy Now" style checkout — separate from the
// existing multi-item cart flow in Shop.jsx (which is untouched), but
// posts to the exact same /api/shop/checkout endpoint, extended to accept
// an optional variantId/customer info/collection session/notes. No second
// order system: this is the same `orders` collection, same stock-decrement
// transaction, just a second UI path into it.
export default function ProductOrderModal({ product, uid, profile, role, onClose, onViewOrders }) {
  const hasVariants = Array.isArray(product.variants) && product.variants.length > 0;
  const [variantId, setVariantId] = useState("");
  const [quantity, setQuantity] = useState(1);
  const [customerName, setCustomerName] = useState(profile?.displayName || "");
  const [customerPhone, setCustomerPhone] = useState(profile?.phone || "");
  const [customerEmail, setCustomerEmail] = useState(profile?.email || "");
  const [notes, setNotes] = useState("");
  const [collectionSessionId, setCollectionSessionId] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState(null);

  // Real upcoming class sessions the student is actually enrolled in — see
  // lib/useCollectionSessions.js (shared with the cart's CartCheckoutModal
  // so there is exactly one place this is resolved). Never invented — if
  // there are none, the Collection section is simply omitted below rather
  // than showing a fabricated date.
  const upcomingSessions = useUpcomingCollectionSessions(uid, role);
  // Exactly one real option is treated as auto-selected (nothing to
  // choose); more than one shows a real picker; zero simply hides the
  // section. Derived directly at render time rather than synced into
  // state via an effect — `collectionSessionId` state itself only ever
  // needs to hold an EXPLICIT user choice from the multi-option picker.
  const effectiveCollectionSessionId = collectionSessionId || (upcomingSessions.length === 1 ? upcomingSessions[0].id : "");

  const selectedVariant = hasVariants ? product.variants.find((v) => v.id === variantId) : null;
  const maxQuantity = hasVariants ? (selectedVariant?.stock || 0) : (product.stock || 0);
  const outOfStock = hasVariants ? !selectedVariant : maxQuantity <= 0;
  const total = product.price * quantity;

  function adjustQuantity(delta) {
    setQuantity((current) => Math.max(1, Math.min(maxQuantity || 1, current + delta)));
  }

  async function submit(e) {
    e.preventDefault();
    if (submitting) return;
    setError("");
    if (!customerName.trim()) return setError("Enter your full name.");
    if (!customerPhone.trim()) return setError("Enter your mobile number.");
    if (customerPhone.trim() && !phonePattern.test(customerPhone.trim())) return setError("Enter a valid mobile number.");
    if (customerEmail.trim() && !emailPattern.test(customerEmail.trim())) return setError("Enter a valid email address.");
    if (hasVariants && !variantId) return setError("Please select a size.");
    if (maxQuantity < 1) return setError(hasVariants ? "Selected size is out of stock." : "This product is out of stock.");
    if (quantity > maxQuantity) return setError(`Only ${maxQuantity} item(s) available.`);

    setSubmitting(true);
    try {
      const response = await checkout(
        [{ productId: product.id, quantity, ...(variantId ? { variantId } : {}) }],
        {
          customerName: customerName.trim(),
          customerPhone: customerPhone.trim(),
          customerEmail: customerEmail.trim(),
          notes: notes.trim(),
          ...(effectiveCollectionSessionId ? { collectionSessionId: effectiveCollectionSessionId } : {}),
        },
      );
      setResult(response);
    } catch (err) {
      // Never a fake success — the form stays filled in exactly as the
      // user left it so they can retry without re-typing everything.
      setError(err.message || "Unable to place order. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  const selectedSession = upcomingSessions.find((item) => item.id === effectiveCollectionSessionId);

  if (result) {
    return (
      <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/60 p-4" role="dialog" aria-modal="true">
        <div className="w-full max-w-md rounded-3xl bg-white p-8 text-center shadow-2xl">
          <div className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-success-soft">
            <CheckCircle2 className="h-7 w-7 text-success" aria-hidden="true" />
          </div>
          <h2 className="mt-4 text-xl font-black text-ink">Order Placed Successfully</h2>
          <p className="mt-1 text-sm text-muted">Thank you, your order has been placed.</p>

          <div className="mt-6 space-y-3 rounded-2xl bg-page p-4 text-left text-sm">
            <Row label="Order Number" value={`#${result.orderNumber}`} strong />
            <Row label="Product" value={product.name} />
            {selectedVariant && <Row label="Size" value={selectedVariant.label} />}
            <Row label="Quantity" value={quantity} />
            {selectedSession && (
              <Row label="Collection" value={`${formatSessionDate(selectedSession.date)}${selectedSession.startTime ? ` · ${selectedSession.startTime}` : ""}${selectedSession.location ? ` at ${selectedSession.location}` : ""}`} />
            )}
          </div>

          <div className="mt-6 flex flex-col gap-2 sm:flex-row">
            <button type="button" onClick={onViewOrders} className="flex-1 rounded-xl border border-border-subtle px-4 py-2.5 text-sm font-bold text-ink hover:bg-page">View Order</button>
            <button type="button" onClick={onClose} className="flex-1 rounded-xl bg-primary px-4 py-2.5 text-sm font-bold text-white">Continue Shopping</button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-center overflow-y-auto bg-slate-950/60 p-4" role="dialog" aria-modal="true">
      <form onSubmit={submit} className="my-8 w-full max-w-lg space-y-6 rounded-3xl bg-white p-6 shadow-2xl sm:p-8">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-xl font-black text-ink">Place Your Order</h2>
            <p className="mt-1 text-xs text-muted">Complete your details and confirm your order.</p>
          </div>
          <button type="button" onClick={onClose} className="text-xl text-muted" aria-label="Close">×</button>
        </div>

        <section className="space-y-3">
          <p className="text-[10px] font-bold uppercase tracking-wider text-subtle">Customer Information</p>
          <label className="grid gap-1 text-xs font-bold text-muted">
            Full Name *
            <input value={customerName} onChange={(e) => setCustomerName(e.target.value)} required className="rounded-xl border border-border-subtle px-3 py-2.5 text-sm font-normal" />
          </label>
          <div className="grid grid-cols-2 gap-3">
            <label className="grid gap-1 text-xs font-bold text-muted">
              Mobile Number *
              <input value={customerPhone} onChange={(e) => setCustomerPhone(e.target.value)} required className="rounded-xl border border-border-subtle px-3 py-2.5 text-sm font-normal" />
            </label>
            <label className="grid gap-1 text-xs font-bold text-muted">
              Email Address
              <input type="email" value={customerEmail} onChange={(e) => setCustomerEmail(e.target.value)} className="rounded-xl border border-border-subtle px-3 py-2.5 text-sm font-normal" />
            </label>
          </div>
        </section>

        <section>
          <p className="mb-2 text-[10px] font-bold uppercase tracking-wider text-subtle">Product</p>
          <div className="flex items-center gap-3 rounded-2xl border border-border-subtle p-3">
            <div className="grid h-16 w-16 shrink-0 place-items-center overflow-hidden rounded-xl bg-page">
              {product.imageUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={product.imageUrl} alt={product.name} className="h-full w-full object-cover" />
              ) : (
                <ShoppingBag className="h-6 w-6 text-subtle" aria-hidden="true" />
              )}
            </div>
            <div>
              <b className="block text-sm text-ink">{product.name}</b>
              <span className="text-sm font-black text-primary">{money(product.price)}</span>
            </div>
          </div>
        </section>

        {/* The size selector is conditional on the product's REAL variant
            data — never on its name or category. A product with an empty
            `variants` array never shows this section at all. */}
        {hasVariants && (
          <section>
            <p className="mb-2 text-[10px] font-bold uppercase tracking-wider text-subtle">Product Options</p>
            <label className="mb-2 block text-xs font-bold text-muted">Size *</label>
            <div className="flex flex-wrap gap-2">
              {product.variants.map((variant) => {
                const variantOutOfStock = (variant.stock || 0) <= 0;
                return (
                  <button
                    key={variant.id}
                    type="button"
                    disabled={variantOutOfStock}
                    onClick={() => {
                      setVariantId(variant.id);
                      setQuantity(1);
                    }}
                    className={`rounded-xl border px-4 py-2 text-xs font-bold transition ${
                      variantId === variant.id ? "border-primary bg-primary text-white" : "border-border-subtle text-ink hover:border-primary"
                    } ${variantOutOfStock ? "cursor-not-allowed opacity-40" : ""}`}
                  >
                    {variant.label} — {variantOutOfStock ? "Out of stock" : `${variant.stock} left`}
                  </button>
                );
              })}
            </div>
          </section>
        )}

        {upcomingSessions.length > 0 && (
          <section>
            <p className="mb-2 text-[10px] font-bold uppercase tracking-wider text-subtle">Collection</p>
            <label className="mb-2 block text-xs font-bold text-muted">Collection Date *</label>
            {upcomingSessions.length === 1 ? (
              <div className="flex items-center gap-2 rounded-xl border border-border-subtle bg-page px-3 py-2.5 text-sm text-ink">
                <CalendarClock className="h-4 w-4 text-primary" aria-hidden="true" />
                {formatSessionDate(upcomingSessions[0].date)}{upcomingSessions[0].startTime ? ` · ${upcomingSessions[0].startTime}` : ""}
                {upcomingSessions[0].location && (
                  <span className="ml-auto flex items-center gap-1 text-xs text-muted"><MapPin className="h-3 w-3" aria-hidden="true" />{upcomingSessions[0].location}</span>
                )}
              </div>
            ) : (
              <select value={collectionSessionId} onChange={(e) => setCollectionSessionId(e.target.value)} className="w-full rounded-xl border border-border-subtle px-3 py-2.5 text-sm font-normal">
                <option value="">Select a collection date</option>
                {upcomingSessions.map((session) => (
                  <option key={session.id} value={session.id}>
                    {formatSessionDate(session.date)}{session.startTime ? ` · ${session.startTime}` : ""}{session.location ? ` at ${session.location}` : ""}
                  </option>
                ))}
              </select>
            )}
          </section>
        )}

        <section>
          <p className="mb-2 text-[10px] font-bold uppercase tracking-wider text-subtle">Quantity</p>
          <div className="flex items-center gap-3">
            <button type="button" disabled={quantity <= 1} onClick={() => adjustQuantity(-1)} className="grid h-9 w-9 place-items-center rounded-lg border border-border-subtle text-muted disabled:opacity-40"><Minus className="h-4 w-4" /></button>
            <span className="w-8 text-center text-base font-bold text-ink">{quantity}</span>
            <button type="button" disabled={outOfStock || quantity >= maxQuantity} onClick={() => adjustQuantity(1)} className="grid h-9 w-9 place-items-center rounded-lg border border-border-subtle text-muted disabled:opacity-40"><Plus className="h-4 w-4" /></button>
            {!outOfStock && <span className="text-xs text-muted">{maxQuantity} available</span>}
          </div>
        </section>

        <label className="grid gap-1 text-xs font-bold text-muted">
          Notes / Special Instructions (optional)
          <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} maxLength={1000} className="rounded-xl border border-border-subtle px-3 py-2.5 text-sm font-normal" />
        </label>

        <section className="rounded-2xl bg-page p-4">
          <p className="mb-2 text-[10px] font-bold uppercase tracking-wider text-subtle">Order Summary</p>
          <div className="space-y-1 text-sm text-ink">
            <p className="font-bold">{product.name}</p>
            {selectedVariant && <p className="text-xs text-muted">Size: {selectedVariant.label}</p>}
            <p className="text-xs text-muted">Quantity: {quantity}</p>
          </div>
          <div className="mt-3 flex items-center justify-between border-t border-border-subtle pt-3 text-sm font-black text-ink">
            <span>Total</span>
            <span>{money(total)}</span>
          </div>
        </section>

        {error && <p className="rounded-xl bg-active px-3 py-2 text-sm text-primary">{error}</p>}

        <button
          type="submit"
          disabled={submitting || outOfStock}
          className="w-full rounded-xl bg-primary py-3 text-sm font-bold text-white disabled:opacity-60"
        >
          {submitting ? "Placing Order..." : "PLACE ORDER"}
        </button>
      </form>
    </div>
  );
}

function Row({ label, value, strong }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-muted">{label}</span>
      <span className={strong ? "font-black text-ink" : "font-semibold text-ink"}>{value}</span>
    </div>
  );
}
