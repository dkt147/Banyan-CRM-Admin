// Detail-page URLs for CRM records. Older ?id= links on list pages redirect here.
const enc = (id) => encodeURIComponent(String(id));

export const recordHref = {
  contact: (id) => `/contact/${enc(id)}`,
  company: (id) => `/companies/${enc(id)}`,
  deal: (id) => `/deal/${enc(id)}`,
  task: (id) => `/tasks/${enc(id)}`,
  booking: (id) => `/bookings/${enc(id)}`,
  conversation: (id) => `/inbox?id=${enc(id)}`,
};

export const refId = (value) => (value && typeof value === "object" ? value._id : value) || "";

export const contactLabel = (value) =>
  value && typeof value === "object"
    ? value.fullName || [value.firstName, value.lastName].filter(Boolean).join(" ") || value.email || "Contact"
    : "";
