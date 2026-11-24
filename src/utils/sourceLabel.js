// Readable labels for stored deal/contact source keys ("walk_in" -> "Walk-in").
const LABELS = {
  walk_in: "Walk-in",
  "walk-in": "Walk-in",
  website: "Website",
  website_enquiry: "Website enquiry",
  web: "Website",
  form: "CRM form",
  manual: "Added in the CRM",
  room_booking: "Room booking",
  day_pass: "Day pass",
  hubspot: "HubSpot",
  referral: "Referral",
  email: "Email",
  phone: "Phone call",
};

export function sourceLabel(value) {
  if (!value) return "—";
  const key = String(value).trim();
  if (LABELS[key.toLowerCase()]) return LABELS[key.toLowerCase()];
  // Already readable ("Instagram", "Search Engine"): leave as typed.
  if (!/[_]/.test(key) && key !== key.toLowerCase()) return key;
  const words = key.replace(/[_-]+/g, " ").trim();
  return words.charAt(0).toUpperCase() + words.slice(1);
}
