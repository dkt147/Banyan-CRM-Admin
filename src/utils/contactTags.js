import { useSyncExternalStore } from "react";

// One list of contact tags for every screen (contact page, contacts list filters, bulk
// tagging, new-contact form). Two kinds:
//  - Segments: set by staff to describe the relationship. Used for filtering, saved views,
//    reports and (later) automation and newsletter audiences.
//  - Sources: added automatically by the CRM when a contact arrives through a channel.
//    Staff can remove them, but normally leave them as a record of where the lead came from.
// Tags must match ^[a-z0-9_]{1,50}$, at most 30 per contact; the server normalises
// "Active Member" → active_member.
//
// Since 26 Nov the team edits the list in Settings → Contact tags (GET /contact-tags).
// The built-in list below is used until that list has loaded, or if the server is older.
// A tag's key never changes (contacts store the key); only its label, description and
// group do. Archived tags keep their label on contacts but leave the pickers.

const BUILT_IN = [
  {
    key: "segment",
    label: "Segments (set by staff)",
    tags: [
      ["prospect", "Prospect", "Interested but hasn't bought or signed anything yet."],
      ["active_member", "Active member", "Has a current membership, desk, office or virtual office."],
      ["past_member", "Past member", "Membership has ended. Good for win-back offers."],
      ["event_client", "Event client", "Has hired the venue, studio or event space."],
      ["broker_agent", "Broker/Agent", "Refers clients to Banyan (property broker or agent)."],
      ["ngo", "NGO", "Non-profit organisation (eligible for NGO pricing)."],
      ["vip", "VIP", "Priority relationship: give extra attention."],
    ],
  },
  {
    key: "source",
    label: "Sources (added automatically)",
    tags: [
      ["website_enquiry", "Website enquiry", "Sent the enquiry form on banyanworkspace.com."],
      ["website_booking", "Website booking", "Booked or paid for something on the website."],
      ["room_booking", "Room booking", "Booked a meeting room or the Library through WordPress."],
      ["email_lead", "Email lead", "First contact was an email to the shared inbox."],
      ["whatsapp_lead", "WhatsApp lead", "First contact was a WhatsApp message."],
      ["form_submission", "Form submission", "Sent one of the CRM forms embedded on a website."],
      ["test_booking", "Test booking", "Made a booking paid in Stripe test mode (not real revenue)."],
      ["newsletter", "Newsletter", "Signed up for the newsletter (also added to Flodesk)."],
      ["walk_in", "Walk-in", "Filled in the walk-in form at reception."],
    ],
  },
];

export const GROUP_LABELS = { segment: "Segments (set by staff)", source: "Sources (added automatically)" };

// Mutable on purpose: the arrays are refilled in place when the team's list loads, so
// existing imports (TAG_GROUPS, SEGMENT_TAGS, KNOWN_TAGS) stay valid.
export const TAG_GROUPS = [];
export const SEGMENT_TAGS = [];
export const KNOWN_TAGS = [];
const BY_KEY = new Map();

function rebuild(list) {
  // list: [{ key, label, description, group, isActive }]
  const groups = new Map(Object.keys(GROUP_LABELS).map((g) => [g, []]));
  BY_KEY.clear();
  for (const t of list) {
    const group = t.group === "source" ? "source" : "segment";
    BY_KEY.set(t.key, { key: t.key, label: t.label || t.key, description: t.description || "", group, isActive: t.isActive !== false });
    if (t.isActive !== false) groups.get(group).push([t.key, t.label || t.key, t.description || ""]);
  }
  TAG_GROUPS.splice(0, TAG_GROUPS.length, ...[...groups].map(([key, tags]) => ({ key, label: GROUP_LABELS[key], tags })));
  SEGMENT_TAGS.splice(0, SEGMENT_TAGS.length, ...groups.get("segment").map(([k]) => k));
  KNOWN_TAGS.splice(0, KNOWN_TAGS.length, ...[...BY_KEY.values()].filter((t) => t.isActive).map((t) => t.key));
}
rebuild(BUILT_IN.flatMap((g) => g.tags.map(([key, label, description]) => ({ key, label, description, group: g.key }))));

let version = 0;
const listeners = new Set();
/** Replace the catalogue with the team's list (Settings → Contact tags). */
export function applyTagCatalogue(list) {
  if (!Array.isArray(list) || !list.length) return;
  rebuild(list.filter((t) => t && t.key));
  version += 1;
  listeners.forEach((fn) => fn());
}
/** Re-render when the team's tag list loads or changes. */
export function useTagCatalogue() {
  return useSyncExternalStore((fn) => { listeners.add(fn); return () => listeners.delete(fn); }, () => version);
}

/** "website_enquiry" -> "Website enquiry"; unknown tags are title-cased. */
export const tagLabel = (t) => BY_KEY.get(t)?.label || String(t).replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
export const tagInfo = (t) => BY_KEY.get(t) || { key: t, label: tagLabel(t), description: "Custom tag (not in the standard list).", group: "other" };

/** Grouped options for selects; tags seen in the data but not in the list go under "Other". */
export function tagOptionGroups(extraTags = []) {
  const active = new Set(KNOWN_TAGS);
  const others = [...new Set(extraTags)].filter((t) => t && !active.has(t)).sort();
  const groups = TAG_GROUPS.map((g) => ({ key: g.key, label: g.label, tags: g.tags.map(([k]) => k) }));
  if (others.length) groups.push({ key: "other", label: "Other tags in use", tags: others });
  return groups;
}

/** Normalise free text into a tag key: "Corporate Client" -> "corporate_client". */
export const toTagKey = (text) => String(text || "").trim().toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "").slice(0, 50);

/** Load the team's tag list (GET /contact-tags). Older servers without it keep the built-in list. */
export function loadTagCatalogue(request) {
  return request("/contact-tags", { query: { includeInactive: true } })
    .then((r) => { const list = r.data?.items || r.data || []; applyTagCatalogue(list); return list; })
    .catch((e) => { if (e?.status !== 404) console.warn("[tags]", e?.message); return null; });
}
