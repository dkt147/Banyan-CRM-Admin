import React, { useEffect, useState } from "react";
import { Page, Empty } from "./Dashboard";
import Badge from "../components/Badge";
import Modal from "../components/Modal";
import { useAuth } from "../auth/AuthContext";

export default function Calendar() {
  const { request } = useAuth();

  const [events, setEvents] = useState([]);
  const [bookings, setBookings] = useState([]);

  const [modal, setModal] = useState(false);
  const [eventModal, setEventModal] = useState(false);

  const [error, setError] = useState("");

  const [eventForm, setEventForm] = useState({
    title: "",
    type: "meeting",
    startAt: "",
    endAt: "",
    location: "",
    status: "scheduled",
  });

  const [form, setForm] = useState({
    title: "",
    resourceName: "Harbour Room",
    startAt: "",
    endAt: "",
    bookingType: "meeting",
    price: 0,
    notes: "",
  });

  async function load() {
    try {
      setError("");

      const [eventsResponse, bookingsResponse] = await Promise.all([
        request("/calendar-events", {
          query: {
            limit: 100,
            sort: "startAt",
            order: "asc",
          },
        }),

        request("/bookings", {
          query: {
            limit: 100,
            sort: "startAt",
            order: "asc",
          },
        }),
      ]);

      setEvents(
        eventsResponse.data?.items || eventsResponse.data?.events || [],
      );

      setBookings(
        bookingsResponse.data?.items || bookingsResponse.data?.bookings || [],
      );
    } catch (e) {
      setError(e.message);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function hold() {
    try {
      setError("");

      if (!form.startAt || !form.endAt) {
        throw new Error("Start and end time are required.");
      }

      const start = new Date(form.startAt).toISOString();
      const end = new Date(form.endAt).toISOString();

      const availability = await request("/calendar/availability", {
        query: {
          startAt: start,
          endAt: end,
        },
      });

      if (!availability.data?.available) {
        throw new Error("Selected slot is unavailable.");
      }

      const response = await request("/calendar/hold", {
        method: "POST",
        body: {
          title: form.title,
          resourceName: form.resourceName,
          bookingType: form.bookingType,
          startAt: start,
          endAt: end,
          price: Number(form.price) || 0,
          notes: form.notes || "",
        },
      });

      setBookings((current) => [response.data, ...current]);

      setModal(false);

      setForm({
        title: "",
        resourceName: "Harbour Room",
        startAt: "",
        endAt: "",
        bookingType: "meeting",
        price: 0,
        notes: "",
      });
    } catch (e) {
      setError(e.message);
    }
  }

  async function toggleEvent(event) {
    try {
      setError("");

      await request(`/calendar-events/${event._id}`, {
        method: "PATCH",
        body: {
          status: event.status === "scheduled" ? "cancelled" : "scheduled",
        },
      });

      await load();
    } catch (e) {
      setError(e.message);
    }
  }

  async function deleteEvent(event) {
    if (!window.confirm("Delete calendar event?")) {
      return;
    }

    try {
      setError("");

      await request(`/calendar-events/${event._id}`, {
        method: "DELETE",
      });

      setEvents((current) => current.filter((item) => item._id !== event._id));
    } catch (e) {
      setError(e.message);
    }
  }

  async function confirmBooking(booking) {
    try {
      setError("");

      await request(`/calendar/${booking._id}/confirm`, {
        method: "PATCH",
      });

      await load();
    } catch (e) {
      setError(e.message);
    }
  }

  async function cancelBooking(booking) {
    try {
      setError("");

      await request(`/calendar/${booking._id}/cancel`, {
        method: "PATCH",
      });

      await load();
    } catch (e) {
      setError(e.message);
    }
  }

  async function deleteBooking(booking) {
    if (!window.confirm("Delete booking?")) {
      return;
    }

    try {
      setError("");

      await request(`/bookings/${booking._id}`, {
        method: "DELETE",
      });

      setBookings((current) =>
        current.filter((item) => item._id !== booking._id),
      );
    } catch (e) {
      setError(e.message);
    }
  }

  const rows = [
    ...events.map((event) => ({
      ...event,
      _kind: "event",
    })),

    ...bookings.map((booking) => ({
      ...booking,
      _kind: "booking",
    })),
  ].sort(
    (a, b) => new Date(a.startAt).getTime() - new Date(b.startAt).getTime(),
  );

  return (
    <Page
      title="Calendar & availability"
      kicker="Live calendar events and bookings"
      actions={
        <>
          <button
            className="btn ghost"
            onClick={() => {
              setError("");
              setEventModal(true);
            }}
          >
            New calendar event
          </button>

          <button
            className="btn primary"
            onClick={() => {
              setError("");
              setModal(true);
            }}
          >
            Check & hold a slot
          </button>
        </>
      }
    >
      {error && (
        <div className="notice error">
          <b>Calendar</b>
          <span>{error}</span>
        </div>
      )}

      <div className="metrics three">
        <div className="metric">
          <span className="eyebrow">Calendar events</span>
          <strong>{events.length}</strong>
          <span className="muted">loaded from CRM</span>
        </div>

        <div className="metric">
          <span className="eyebrow">Bookings</span>
          <strong>{bookings.length}</strong>
          <span className="muted">held / confirmed / completed</span>
        </div>

        <div className="metric">
          <span className="eyebrow">Sync</span>
          <strong>CRM</strong>
          <span className="muted">External provider fields supported</span>
        </div>
      </div>

      <section className="panel table-wrap">
        <table>
          <thead>
            <tr>
              <th>When</th>
              <th>Title / resource</th>
              <th>Contact</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>

          <tbody>
            {rows.map((item) => (
              <tr key={`${item._kind}-${item._id}`}>
                <td>
                  {item.startAt ? new Date(item.startAt).toLocaleString() : "—"}
                </td>

                <td>
                  <b>{item.title || item.resourceName || "Booking"}</b>

                  <span>{item.bookingType || item.type || ""}</span>
                </td>

                <td>
                  {item.contactId?.firstName
                    ? `${item.contactId.firstName} ${
                        item.contactId.lastName || ""
                      }`
                    : "—"}
                </td>

                <td>
                  <Badge>{item.status}</Badge>
                </td>

                <td>
                  <div className="table-actions">
                    {item._kind === "booking" && item.status === "held" && (
                      <button
                        className="btn ghost"
                        onClick={() => confirmBooking(item)}
                      >
                        Confirm
                      </button>
                    )}

                    {item._kind === "booking" &&
                      ["held", "pending", "confirmed"].includes(
                        item.status,
                      ) && (
                        <button
                          className="btn ghost"
                          onClick={() => cancelBooking(item)}
                        >
                          Cancel
                        </button>
                      )}

                    {item._kind === "booking" && (
                      <button
                        className="btn ghost"
                        onClick={() => deleteBooking(item)}
                      >
                        Delete
                      </button>
                    )}

                    {item._kind === "event" && (
                      <>
                        <button
                          className="btn ghost"
                          onClick={() => toggleEvent(item)}
                        >
                          {item.status === "scheduled" ? "Cancel" : "Schedule"}
                        </button>

                        <button
                          className="btn ghost"
                          onClick={() => deleteEvent(item)}
                        >
                          Delete
                        </button>
                      </>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {rows.length === 0 && <Empty text="No calendar activity." />}
      </section>

      {eventModal && (
        <Modal
          title="New calendar event"
          onClose={() => setEventModal(false)}
          actions={
            <>
              <button
                className="btn ghost"
                onClick={() => setEventModal(false)}
              >
                Cancel
              </button>

              <button
                className="btn primary"
                onClick={async () => {
                  try {
                    setError("");

                    if (
                      !eventForm.title.trim() ||
                      !eventForm.startAt ||
                      !eventForm.endAt
                    ) {
                      throw new Error(
                        "Title, start and end time are required.",
                      );
                    }

                    const response = await request("/calendar-events", {
                      method: "POST",
                      body: {
                        ...eventForm,
                        startAt: new Date(eventForm.startAt).toISOString(),
                        endAt: new Date(eventForm.endAt).toISOString(),
                      },
                    });

                    setEvents((current) => [response.data, ...current]);

                    setEventModal(false);

                    setEventForm({
                      title: "",
                      type: "meeting",
                      startAt: "",
                      endAt: "",
                      location: "",
                      status: "scheduled",
                    });
                  } catch (e) {
                    setError(e.message);
                  }
                }}
              >
                Create event
              </button>
            </>
          }
        >
          <div className="form-grid">
            <label>
              Title
              <input
                value={eventForm.title}
                onChange={(e) =>
                  setEventForm({
                    ...eventForm,
                    title: e.target.value,
                  })
                }
              />
            </label>

            <label>
              Type
              <input
                value={eventForm.type}
                onChange={(e) =>
                  setEventForm({
                    ...eventForm,
                    type: e.target.value,
                  })
                }
              />
            </label>

            <label>
              Start
              <input
                type="datetime-local"
                value={eventForm.startAt}
                onChange={(e) =>
                  setEventForm({
                    ...eventForm,
                    startAt: e.target.value,
                  })
                }
              />
            </label>

            <label>
              End
              <input
                type="datetime-local"
                value={eventForm.endAt}
                onChange={(e) =>
                  setEventForm({
                    ...eventForm,
                    endAt: e.target.value,
                  })
                }
              />
            </label>

            <label>
              Location
              <input
                value={eventForm.location}
                onChange={(e) =>
                  setEventForm({
                    ...eventForm,
                    location: e.target.value,
                  })
                }
              />
            </label>
          </div>
        </Modal>
      )}

      {modal && (
        <Modal
          title="Hold a slot"
          onClose={() => setModal(false)}
          actions={
            <>
              <button className="btn ghost" onClick={() => setModal(false)}>
                Cancel
              </button>

              <button className="btn primary" onClick={hold}>
                Create hold
              </button>
            </>
          }
        >
          <label>
            Title
            <input
              value={form.title}
              onChange={(e) =>
                setForm({
                  ...form,
                  title: e.target.value,
                })
              }
            />
          </label>

          <div className="form-grid">
            <label>
              Resource
              <input
                value={form.resourceName}
                onChange={(e) =>
                  setForm({
                    ...form,
                    resourceName: e.target.value,
                  })
                }
              />
            </label>

            <label>
              Booking type
              <input
                value={form.bookingType}
                onChange={(e) =>
                  setForm({
                    ...form,
                    bookingType: e.target.value,
                  })
                }
              />
            </label>

            <label>
              Start
              <input
                type="datetime-local"
                value={form.startAt}
                onChange={(e) =>
                  setForm({
                    ...form,
                    startAt: e.target.value,
                  })
                }
              />
            </label>

            <label>
              End
              <input
                type="datetime-local"
                value={form.endAt}
                onChange={(e) =>
                  setForm({
                    ...form,
                    endAt: e.target.value,
                  })
                }
              />
            </label>

            <label>
              Price
              <input
                type="number"
                min="0"
                value={form.price}
                onChange={(e) =>
                  setForm({
                    ...form,
                    price: e.target.value,
                  })
                }
              />
            </label>

            <label>
              Notes
              <textarea
                value={form.notes}
                onChange={(e) =>
                  setForm({
                    ...form,
                    notes: e.target.value,
                  })
                }
              />
            </label>
          </div>
        </Modal>
      )}
    </Page>
  );
}
