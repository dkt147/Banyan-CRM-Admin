import React, { useEffect, useState } from "react";
import { Page, Empty } from "./Dashboard";
import Badge from "../components/Badge";
import { useAuth } from "../auth/AuthContext";
export default function Deal() {
  const { request } = useAuth();
  const [deals, setDeals] = useState([]),
    [error, setError] = useState("");
  useEffect(() => {
    request("/deals", { query: { limit: 100 } })
      .then((r) => setDeals(r.data?.items || []))
      .catch((e) => setError(e.message));
  }, []);
  return (
    <Page title="Deals" kicker="All workspace deals">
      {error && (
        <div className="notice error">
          <b>Deals</b>
          <span>{error}</span>
        </div>
      )}
      <section className="panel table-wrap">
        <table>
          <thead>
            <tr>
              <th>Deal</th>
              <th>Contact</th>
              <th>Pipeline</th>
              <th>Stage</th>
              <th>Value</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {deals.map((d) => (
              <tr key={d._id}>
                <td>
                  <b>{d.title}</b>
                  <span>{d.productType || "—"}</span>
                </td>
                <td>
                  {d.contactId?.firstName} {d.contactId?.lastName}
                </td>
                <td>{d.pipelineId?.name}</td>
                <td>
                  <Badge>{d.stageId?.name || "—"}</Badge>
                </td>
                <td>HK${Number(d.value || 0).toLocaleString()}</td>
                <td>
                  {d.status}{" "}
                  <button
                    className="btn ghost"
                    onClick={async () => {
                      const title = prompt("Deal title", d.title);
                      if (!title) return;
                      try {
                        await request(`/deals/${d._id}`, {
                          method: "PATCH",
                          body: { title },
                        });
                        const r = await request("/deals", {
                          query: { limit: 100 },
                        });
                        setDeals(r.data?.items || []);
                      } catch (e) {
                        setError(e.message);
                      }
                    }}
                  >
                    Edit
                  </button>{" "}
                  <button
                    className="btn ghost"
                    onClick={async () => {
                      if (!confirm("Delete deal?")) return;
                      try {
                        await request(`/deals/${d._id}`, { method: "DELETE" });
                        setDeals((ds) => ds.filter((x) => x._id !== d._id));
                      } catch (e) {
                        setError(e.message);
                      }
                    }}
                  >
                    Delete
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {deals.length === 0 && <Empty text="No deals found." />}
      </section>
    </Page>
  );
}
