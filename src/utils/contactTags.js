// One list of contact tags for every screen (contact page, contacts list filters, bulk
// tagging, new-contact form). Two kinds:
//  - Segments: set by staff to describe the relationship. Used for filtering, saved views,
//    reports and (later) automation and newsletter audiences.
//  - Sources: added automatically by the CRM when a contact arrives through a channel.
//    Staff can remove them, but normally leave them as a record of where the lead came from.
// Matches the backend catalogue (GET /contacts/tag-catalogue). Tags must match
// ^[a-z0-9_]{1,50}$, at most 30 per contact; the server normalises "Active Member" → active_member.

export const TAG_GROUPS = [
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

const ALL = TAG_GROUPS.flatMap((g) => g.tags.map(([key, label, description]) => ({ key, label, description, group: g.key })));
const BY_KEY = new Map(ALL.map((t) => [t.key, t]));

export const SEGMENT_TAGS = TAG_GROUPS[0].tags.map(([k]) => k);
export const KNOWN_TAGS = ALL.map((t) => t.key);

/** "website_enquiry" -> "Website enquiry"; unknown tags are title-cased. */
export const tagLabel = (t) => BY_KEY.get(t)?.label || String(t).replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
export const tagInfo = (t) => BY_KEY.get(t) || { key: t, label: tagLabel(t), description: "Custom tag (not in the standard list).", group: "other" };

/** Grouped options for selects; tags seen in the data but not in the list go under "Other". */
export function tagOptionGroups(extraTags = []) {
  const others = [...new Set(extraTags)].filter((t) => t && !BY_KEY.has(t)).sort();
  const groups = TAG_GROUPS.map((g) => ({ key: g.key, label: g.label, tags: g.tags.map(([k]) => k) }));
  if (others.length) groups.push({ key: "other", label: "Other tags in use", tags: others });
  return groups;
}

/** Normalise free text into a tag key: "Corporate Client" -> "corporate_client". */
export const toTagKey = (text) => String(text || "").trim().toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "").slice(0, 50);
