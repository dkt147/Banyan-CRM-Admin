export const navItems = [
  ["dashboard", "Dashboard", "ChartPieSlice", "Live workspace overview"],
  ["tasks", "Tasks", "CheckSquareOffset", "Follow-ups and actions"],
  ["inbox", "Inbox", "Tray", "Email and WhatsApp"],
  ["pipelines", "Pipelines", "Kanban", "Sales pipelines and stages"],
  ["deal", "Deals", "Handshake", "All workspace deals"],
  ["contact", "Contacts", "AddressBook", "People and relationships"],
  ["companies", "Companies", "Buildings", "Organizations and accounts"],
  [
    "activities",
    "Activities",
    "ClockCounterClockwise",
    "CRM interaction timeline",
  ],
  ["templates", "Templates", "EnvelopeOpen", "Reusable communication"],
  ["calendar", "Calendar", "CalendarDots", "Events and bookings"],
  ["agreements", "Agreements", "Signature", "Signature lifecycle"],
  ["invoices", "Invoices", "Receipt", "Billing and invoices"],
  ["payments", "Payments", "CreditCard", "Payment records"],
  [
    "memberships",
    "Memberships",
    "IdentificationCard",
    "Plans, members and check-ins",
  ],
  ["members", "Members", "UsersThree", "Workspace team access"],
  ["loyalty", "Loyalty", "Medal", "Event loyalty rewards"],
  ["automation", "Automations", "FlowArrow", "Rules and integrations"],
  ["integrations", "Integrations", "PlugsConnected", "Provider connections"],
  ["documents", "Documents", "Files", "Document metadata"],
  ["notifications", "Notifications", "Bell", "Workspace alerts"],
  ["audit-logs", "Audit logs", "ListChecks", "Administrative history"],
  ["workspace", "Workspace", "Gear", "Workspace settings"],
];

export const pipelineData = {
  Membership: {
    value: "HK$486,000",
    count: 14,
    close: "21 days",
    stages: [
      [
        "Enquiry",
        "HK$102,000",
        [
          [
            "Priya Raghunathan",
            "Coworking desk · HK$3,800/mo",
            "AI 82",
            "Website form",
          ],
          ["Kenneth Yau", "Day pass pack · HK$2,400", "AI 41", "Instagram DM"],
        ],
      ],
      [
        "Template sent",
        "HK$74,400",
        [
          [
            "Rina Takeshita",
            "Virtual office · HK$800/mo",
            "Referral · Saltwater",
            "",
          ],
          ["Anselm Fung", "Virtual office · HK$800/mo", "Sent 2 days ago", ""],
        ],
      ],
      [
        "Trial day booked",
        "HK$91,200",
        [
          [
            "Delphine Roux",
            "Coworking · HK$3,800/mo",
            "Quiet 6 days · follow up",
            "",
          ],
          ["Talia Berger", "Coworking · Thu 11 Sep", "Calendar blocked", ""],
        ],
      ],
      [
        "Trial completed",
        "HK$45,600",
        [["Idris Bello", "Coworking · HK$3,800/mo", "Trial completed", ""]],
      ],
      [
        "Agreement sent",
        "HK$54,000",
        [
          [
            "Novo Health Ltd",
            "Membership · HK$7,400/mo",
            "Viewed today",
            "DocuSign",
          ],
        ],
      ],
      [
        "Deposit paid",
        "HK$54,000",
        [["Wing Tai Consulting", "Coworking · 3 members", "Xero: paid", ""]],
      ],
      [
        "Active",
        "HK$64,800",
        [
          [
            "Saltwater Design Co.",
            "Private office · 6 desks",
            "Renews 18 Oct",
            "",
          ],
        ],
      ],
    ],
  },
  "Private office": {
    value: "HK$1,020,000",
    count: 9,
    close: "34 days",
    stages: [
      [
        "Enquiry",
        "HK$280,000",
        [["Meridian Legal", "4 desks · HK$24,000/mo", "AI 88", "Broker"]],
      ],
      [
        "Viewing",
        "HK$360,000",
        [["Kestrel Analytics", "Suite 1204B · 6 desks", "Viewing 15:30", ""]],
      ],
      [
        "Quote",
        "HK$220,000",
        [["Lumen Studio", "6 desks · HK$18,500/mo", "Quote sent", ""]],
      ],
      [
        "Negotiation",
        "HK$96,000",
        [["Saltwater Design Co.", "6 desks", "AI 72", ""]],
      ],
      [
        "Agreement signed",
        "HK$64,800",
        [["Novo Health Ltd", "3 desks", "DocuSign viewed", ""]],
      ],
      [
        "Deposit collected",
        "—",
        [["Wing Tai Consulting", "Deposit paid", "Xero: paid", ""]],
      ],
      ["Move-in", "—", [["Harbour Legal", "8 desks", "Move-in Friday", ""]]],
    ],
  },
  "Venue hire": {
    value: "HK$268,000",
    count: 13,
    close: "12 days",
    stages: [
      [
        "Enquiry",
        "HK$72,000",
        [
          ["Cynthia Mok", "Venue · 24 Oct", "AI 76", "Website form"],
          ["Aurora Beauty", "Launch event", "AI 91", "Referral"],
        ],
      ],
      [
        "Quote",
        "HK$86,000",
        [
          [
            "Lumen Studio",
            "Product launch · HK$38,000",
            "Overdue follow-up",
            "",
          ],
          ["Harbour Pictures", "Shoot · HK$11,500", "Agreement signed", ""],
        ],
      ],
      [
        "Agreement",
        "HK$52,000",
        [["Sonder Media", "Podcast studio · HK$26,000", "Viewed", ""]],
      ],
      [
        "Deposit",
        "HK$58,000",
        [
          ["Harbour Pictures", "Deposit · HK$5,750", "Xero draft", ""],
          ["Kestrel Analytics", "Team offsite", "Invoice paid", ""],
        ],
      ],
    ],
  },
  Transactional: {
    value: "Automated",
    count: 31,
    close: "same day",
    stages: [
      [
        "Booking received",
        "—",
        [
          ["Day pass bookings", "Automated", "Website", ""],
          ["Meeting rooms", "Automated", "Booking feed", ""],
        ],
      ],
      [
        "Confirmed",
        "—",
        [["Fiona Ng", "Meeting room · 10 pax", "Confirmed", ""]],
      ],
      [
        "Completed",
        "—",
        [["Aurora Beauty", "Event completed", "Review sent", ""]],
      ],
    ],
  },
};

export const contacts = [
  ["Adeline Cheung", "Meridian Legal · Ops Director", "Prospect"],
  ["Cynthia Mok", "Lumen Studio · Producer", "Event client"],
  ["Marcus Oyelaran", "Independent · Active member", "Active member"],
  ["Priya Raghunathan", "Kestrel Analytics · Founder", "Prospect"],
  ["Idris Bello", "Bello Advisory · Prospect", "Prospect"],
  ["Rina Takeshita", "Takeshita Studio · Prospect", "Prospect"],
  ["Wendy Lo", "Colliers HK · Broker", "Broker"],
];

export const templates = [
  [
    "Day pass enquiry response",
    "Re: your day pass enquiry",
    "Transactional",
    "name, date, rate",
    "Booking received",
    "",
  ],
  [
    "Coworking desk enquiry",
    "Your Banyan coworking options",
    "Membership",
    "name, plan, rate",
    "Template sent",
    "In 3 days if no reply",
  ],
  [
    "Private office enquiry + viewing",
    "Private office options for {{company}}",
    "Private office",
    "name, company, suite, rate",
    "Viewing",
    "In 2 days",
  ],
  [
    "Virtual office enquiry",
    "Virtual office at Banyan",
    "Membership",
    "name, rate",
    "Template sent",
    "In 3 days",
  ],
  [
    "Meeting room quote",
    "Your meeting room booking",
    "Transactional",
    "name, room, date, rate",
    "Quote sent",
    "In 2 days",
  ],
  [
    "Venue hire quote",
    "Your venue hire proposal",
    "Venue hire",
    "name, date, venue, rate, loyaltyDiscount",
    "Quote sent",
    "In 3 days",
  ],
  [
    "Photoshoot / podcast quote",
    "Studio hire proposal",
    "Venue hire",
    "name, studio, date, rate, loyaltyDiscount",
    "Quote sent",
    "In 3 days",
  ],
  [
    "Trial day confirmation",
    "Your Banyan trial day",
    "Membership",
    "name, date, time",
    "Trial booked",
    "Day before",
  ],
  [
    "Agreement sent",
    "Your Banyan agreement",
    "Agreement",
    "name, company, agreementUrl",
    "Agreement sent",
    "In 2 days",
  ],
  [
    "Deposit invoice request",
    "Deposit invoice — next step",
    "Deposit",
    "name, amount, invoiceUrl",
    "Deposit paid",
    "In 1 day",
  ],
  [
    "Renewal reminder",
    "Your Banyan membership renewal",
    "Members",
    "name, plan, renewalDate",
    "60 days before expiry",
    "Repeat at 30 days",
  ],
  [
    "Post-event thanks + review",
    "Thank you for hosting with Banyan",
    "Venue hire",
    "name, event, reviewUrl",
    "Event completed",
    "After 2 days",
  ],
];

export const loyaltyClients = [
  [
    "Aurora Beauty",
    "6 events",
    "Platinum",
    "HK$612,000",
    "1,200",
    "Top tier",
    "28 Aug",
  ],
  [
    "Harbour Pictures",
    "9 shoots",
    "Platinum",
    "HK$528,000",
    "2,840",
    "Top tier",
    "2 Sep",
  ],
  [
    "Lumen Studio",
    "5 bookings",
    "Silver → Gold",
    "HK$268,000",
    "2,640",
    "Gold reached",
    "14 Jun",
  ],
  [
    "Sonder Media",
    "4 bookings",
    "Gold",
    "HK$318,000",
    "980",
    "HK$182,000 to Platinum",
    "10 Sep",
  ],
  [
    "Meridian Legal",
    "2 offsites",
    "Silver",
    "HK$146,000",
    "1,460",
    "HK$104,000 to Gold",
    "22 Jul",
  ],
  [
    "Kestrel Analytics",
    "1 event",
    "Bronze",
    "HK$42,000",
    "420",
    "HK$58,000 to Silver",
    "5 May",
  ],
];
