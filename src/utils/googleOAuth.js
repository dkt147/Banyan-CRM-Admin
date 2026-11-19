const GOOGLE_OAUTH_RESULT = "banyan-google-oauth-result";
const CHANNEL = "banyan-google-oauth";
// Set only when the popup was blocked and the whole CRM tab went to Google instead.
const FULL_PAGE_FLAG = "banyan-google-oauth-fullpage";

// Shown once the Google window is open. The CRM can't see errors Google shows in that
// window (e.g. redirect_uri_mismatch), so callers stop waiting and show this instead.
export const GOOGLE_POPUP_HINT = "Google sign-in opened in a new window. Finish there and this page updates. If Google shows an error (for example redirect_uri_mismatch), close that window and ask your admin to check the Google Cloud OAuth settings.";

let pending = false;   // a popup flow is in progress in this tab

const safeSession = {
  get(k) { try { return sessionStorage.getItem(k); } catch { return null; } },
  set(k, v) { try { sessionStorage.setItem(k, v); } catch { /* ignore */ } },
  remove(k) { try { sessionStorage.removeItem(k); } catch { /* ignore */ } },
};

/** Start the Google OAuth flow in a popup (created synchronously to avoid popup blockers). */
export async function openGoogleOAuth(request) {
  const popup = window.open(
    "about:blank",
    "banyan-google-oauth",
    "popup,width=620,height=760,resizable=yes,scrollbars=yes",
  );

  try {
    const response = await request("/integrations/google/connect");
    const authorizationUrl = response?.data?.authorizationUrl;
    if (!authorizationUrl) {
      throw new Error("The backend did not return a Google authorization URL.");
    }
    if (popup && !popup.closed) {
      pending = true;
      popup.location.href = authorizationUrl;
      return { ...response.data, inPopup: true };
    }
    safeSession.set(FULL_PAGE_FLAG, "1");
    window.location.assign(authorizationUrl);
    return { ...response.data, inPopup: false };
  } catch (error) {
    if (popup && !popup.closed) popup.close();
    throw error;
  }
}

/**
 * The backend sends Google's result to /integrations?google_oauth=success|error
 * (&google_oauth_code, &google_oauth_message). Returns the parsed result, or null.
 */
export function readGoogleOAuthReturn(search = window.location.search) {
  const params = new URLSearchParams(search);
  const status = params.get("google_oauth");
  if (!status) return null;
  const success = status === "success";
  const code = params.get("google_oauth_code") || null;
  const message = success
    ? "Google Workspace and Calendar connected."
    : params.get("google_oauth_message") || "Google sign-in was cancelled or failed.";
  return { type: GOOGLE_OAUTH_RESULT, success, status, code, message };
}

/** Remove the google_oauth* parameters from the address bar. */
export function clearGoogleOAuthParams() {
  const params = new URLSearchParams(window.location.search);
  ["google_oauth", "google_oauth_code", "google_oauth_message"].forEach((k) => params.delete(k));
  const query = params.toString();
  window.history.replaceState({}, document.title, `${window.location.pathname}${query ? `?${query}` : ""}${window.location.hash}`);
}

/**
 * Called before the app renders. "popup" means this window is the Google popup coming
 * back: render only the small result page (GoogleOAuthReturn), not the CRM.
 * "page" means the whole tab went to Google (popup was blocked): render the CRM normally.
 */
export function googleOAuthReturnMode() {
  if (!readGoogleOAuthReturn()) return null;
  if (safeSession.get(FULL_PAGE_FLAG)) { safeSession.remove(FULL_PAGE_FLAG); return "page"; }
  return "popup";
}

/**
 * In the popup: send the result to the CRM tab and close. Uses window.opener when the
 * browser kept it, and a BroadcastChannel as well (some browsers drop the opener after
 * the Google redirect). Returns true if it could reach the opener.
 */
export function deliverGoogleOAuthResult(result) {
  let viaOpener = false;
  try {
    if (window.opener && window.opener !== window) {
      window.opener.postMessage(result, window.location.origin);
      viaOpener = true;
    }
  } catch { /* opener gone */ }
  try {
    const ch = new BroadcastChannel(CHANNEL);
    ch.postMessage(result);
    ch.close();
  } catch { /* not supported */ }
  return viaOpener;
}

/**
 * Listen for the popup's result (same origin only). onReturn, if given, is also called
 * when this tab regains focus while a popup flow is pending, so the page can re-check
 * the integration status even if no message arrives.
 */
export function listenForGoogleOAuth(callback, onReturn) {
  const expectedOrigin = window.location.origin;
  let last = 0;
  const handle = (data) => {
    if (data?.type !== GOOGLE_OAUTH_RESULT) return;
    // The same result can arrive twice (opener + channel).
    if (Date.now() - last < 2000) return;
    last = Date.now();
    pending = false;
    callback(data);
  };
  const onMessage = (event) => { if (event.origin === expectedOrigin) handle(event.data); };
  const onFocus = () => { if (pending && onReturn) onReturn(); };
  let channel = null;
  try { channel = new BroadcastChannel(CHANNEL); channel.onmessage = (e) => handle(e.data); } catch { /* not supported */ }
  window.addEventListener("message", onMessage);
  window.addEventListener("focus", onFocus);
  return () => {
    window.removeEventListener("message", onMessage);
    window.removeEventListener("focus", onFocus);
    channel?.close();
  };
}
