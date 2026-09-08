async function request(slug, options = {}) {
  const response = await fetch(`/api/promote/${slug}`, {
    ...options,
    headers: { "Content-Type": "application/json", ...options.headers },
  });
  const payload = await response.json();
  if (!response.ok) throw new Error(payload.message || "Unable to complete the request. Please try again.");
  return payload;
}
export const loadPromotionLink = (slug) => request(slug);
export const recordPromotionClick = (slug) => request(slug, { method: "POST", body: JSON.stringify({ event: "click" }) });
export const submitPromotionLead = (slug, lead) => request(slug, { method: "POST", body: JSON.stringify(lead) });
