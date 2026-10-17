import React, { useCallback, useEffect, useState } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import { apiRequest } from "../api";

function unwrapInvoice(response) {
  return response?.data?.invoice || response?.data?.data?.invoice || response?.data?.data || response?.invoice || response?.data || response;
}

function money(amount, currency = "HKD") {
  const value = Number(amount || 0);
  try {
    return new Intl.NumberFormat(undefined, { style: "currency", currency: String(currency || "HKD").toUpperCase() }).format(value);
  } catch {
    return `${String(currency || "HKD").toUpperCase()} ${value.toLocaleString()}`;
  }
}

function displayDate(value) {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "—" : date.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

export default function PublicInvoicePayment() {
  const { token } = useParams();
  const [searchParams] = useSearchParams();
  const [invoice, setInvoice] = useState(null);
  const [loading, setLoading] = useState(true);
  const [paying, setPaying] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const loadInvoice = useCallback(async () => {
    if (!token) return;
    try {
      const response = await apiRequest(`/public/invoices/${encodeURIComponent(token)}`);
      const nextInvoice = unwrapInvoice(response);
      if (!nextInvoice || typeof nextInvoice !== "object" || !nextInvoice.status) {
        throw new Error("The invoice response from the server was invalid.");
      }
      setInvoice(nextInvoice);
      setError("");
      if (nextInvoice.status === "paid") setNotice("Payment received. This invoice has been marked as paid.");
    } catch (e) {
      setError(e.message || "This payment link is invalid or unavailable.");
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => { loadInvoice(); }, [loadInvoice]);

  useEffect(() => {
    const result = searchParams.get("payment");
    if (result === "success") {
      setNotice("Thank you. We are confirming your payment with Stripe.");
      let stopped = false;
      let attempts = 0;
      const poll = async () => {
        while (!stopped && attempts < 20) {
          attempts += 1;
          await new Promise((resolve) => window.setTimeout(resolve, 1500));
          if (stopped) return;
          try {
            const response = await apiRequest(`/public/invoices/${encodeURIComponent(token)}`);
            const latest = unwrapInvoice(response);
            if (latest?.status === "paid") {
              setInvoice(latest);
              setNotice("Payment successful. Thank you! Your invoice is now marked as paid.");
              return;
            }
          } catch { /* retry briefly while the webhook is processed */ }
        }
        if (!stopped) setNotice("Your payment may still be processing. This page will show the updated status once Stripe confirms it. You can refresh in a moment.");
      };
      poll();
      return () => { stopped = true; };
    }
    if (result === "cancelled") setNotice("Checkout was cancelled. No payment has been confirmed. You can try again below.");
    return undefined;
  }, [searchParams, token]);

  async function payWithStripe() {
    if (!token || paying || invoice?.status === "paid") return;
    try {
      setPaying(true);
      setError("");
      const response = await apiRequest(`/public/invoices/${encodeURIComponent(token)}/checkout`, { method: "POST", body: {} });
      const checkoutUrl = response?.data?.checkoutUrl || response?.data?.data?.checkoutUrl || response?.checkoutUrl;
      if (!checkoutUrl) throw new Error("The server did not return a Stripe Checkout URL.");
      const url = new URL(checkoutUrl);
      if (url.protocol !== "https:" || url.hostname !== "checkout.stripe.com") {
        throw new Error("The server returned an invalid Stripe Checkout URL.");
      }
      window.location.assign(url.toString());
    } catch (e) {
      setError(e.message || "Could not open Stripe Checkout. Please try again.");
      setPaying(false);
    }
  }

  const paid = invoice?.status === "paid";
  const closed = ["cancelled", "draft"].includes(invoice?.status);

  return (
    <main className="public-payment-page">
      <section className="public-payment-card">
        <div className="public-payment-brand">
          <img src="/banyan-logo.svg" alt="Banyan" />
          <span>BANYAN</span>
        </div>
        {loading ? (
          <div className="public-payment-state"><span className="eyebrow">SECURE INVOICE</span><h1>Loading invoice…</h1><p>Please wait while we retrieve your invoice details.</p></div>
        ) : error && !invoice ? (
          <div className="public-payment-state"><h1>Payment link unavailable</h1><p>{error}</p><p className="muted">Please contact the Banyan team if you believe this link should be active.</p></div>
        ) : invoice ? (
          <>
            <div className="public-payment-state">
              <span className="eyebrow">INVOICE PAYMENT</span>
              <h1>{paid ? "Payment received" : "Your invoice"}</h1>
              <p>{paid ? "This invoice has been paid successfully." : "Review the details below, then continue to our secure Stripe checkout."}</p>
            </div>
            {notice && <div className={`notice ${paid ? "green" : ""}`} role="status">{notice}</div>}
            {error && <div className="notice error" role="alert">{error}</div>}
            <div className="public-invoice-details">
              <div><span>Invoice number</span><strong>{invoice.invoiceNumber || invoice.number || "—"}</strong></div>
              <div><span>Invoice status</span><strong className="public-invoice-status">{invoice.status || "awaiting"}</strong></div>
              <div><span>Description</span><strong>{invoice.description || "Services provided by Banyan"}</strong></div>
              <div><span>Due date</span><strong>{displayDate(invoice.dueAt)}</strong></div>
              <div className="public-invoice-total"><span>Amount due</span><strong>{money(invoice.total ?? invoice.amountDue, invoice.currency)}</strong></div>
            </div>
            {paid ? (
              <div className="public-paid-note"> <span aria-hidden="true">✓</span> Paid in full </div>
            ) : (
              <button className="btn primary public-pay-button" onClick={payWithStripe} disabled={paying || closed || Number(invoice.total ?? invoice.amountDue ?? 0) <= 0}>
                {paying ? "Opening secure checkout…" : "Pay with Stripe"}
              </button>
            )}
            {closed && <p className="public-payment-footnote">This invoice is not currently payable. Please contact Banyan for assistance.</p>}
            {!paid && !closed && <p className="public-payment-footnote">Payments are securely processed by Stripe. Your invoice status updates after payment is verified.</p>}
          </>
        ) : null}
        <footer className="public-payment-footer">Banyan · Secure payments</footer>
      </section>
    </main>
  );
}
