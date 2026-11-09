import { useEffect, useState } from "react";
import { useAuth } from "../auth/AuthContext";

// Option lists for selects (contacts, companies, deals, members, pipelines), cached for
// a minute so moving between pages does not repeat the same requests.
const TTL_MS = 60_000;
const cache = new Map();
const PATHS = {
  contacts: ["/contacts", { page: 1, limit: 100, isArchived: false }],
  companies: ["/companies", { page: 1, limit: 100, isArchived: false }],
  deals: ["/deals", { page: 1, limit: 100 }],
  members: ["/members", {}],
  pipelines: ["/pipelines", { page: 1, limit: 100, isActive: true, sort: "sortOrder", order: "asc" }],
  resources: ["/resources", { page: 1, limit: 100, isActive: true, sort: "sortOrder", order: "asc" }],
};

const unwrap = (response) => {
  const data = response?.data;
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.items)) return data.items;
  return [];
};

export function invalidateLookups(...names) {
  for (const name of names.length ? names : Object.keys(PATHS)) cache.delete(name);
}

export function useLookups(names) {
  const { request } = useAuth();
  const [state, setState] = useState(() =>
    Object.fromEntries(names.map((n) => [n, cache.get(n)?.rows || []])),
  );
  const key = names.join(",");
  useEffect(() => {
    let active = true;
    names.forEach((name) => {
      const hit = cache.get(name);
      if (hit && Date.now() - hit.at < TTL_MS) {
        hit.promise.then((rows) => active && setState((s) => ({ ...s, [name]: rows })));
        return;
      }
      const [path, query] = PATHS[name];
      const promise = request(path, { query }).then(unwrap).catch(() => []);
      const entry = { at: Date.now(), promise, rows: hit?.rows || [] };
      cache.set(name, entry);
      promise.then((rows) => { entry.rows = rows; if (active) setState((s) => ({ ...s, [name]: rows })); });
    });
    return () => { active = false; };
  }, [key, request]);
  return state;
}

export const personLabel = (c) =>
  c ? c.fullName || [c.firstName, c.lastName].filter(Boolean).join(" ") || c.email || "Unnamed contact" : "";
