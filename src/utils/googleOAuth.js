const GOOGLE_OAUTH_RESULT = "banyan-google-oauth-result";

// Shown once the Google window is open. The CRM can't see errors Google shows in that
// window (e.g. redirect_uri_mismatch), so callers stop waiting and show this instead.
export const GOOGLE_POPUP_HINT = "Google sign-in opened in a new window. Finish there and this page updates. If Google shows an error (for example redirect_uri_mismatch), close that window and ask your admin to check the Google Cloud OAuth settings.";

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
      popup.location.href = authorizationUrl;
      return { ...response.data, inPopup: true };
    }
    window.location.assign(authorizationUrl);
    return { ...response.data, inPopup: false };
  } catch (error) {
    if (popup && !popup.closed) popup.close();
    throw error;
  }
}

/** Listen only for a Google OAuth result from the same-origin CRM popup. */
export function listenForGoogleOAuth(callback) {
  const expectedOrigin = window.location.origin;
  const handler = (event) => {
    if (event.origin !== expectedOrigin) return;
    if (event.data?.type !== GOOGLE_OAUTH_RESULT) return;
    callback(event.data);
  };
  window.addEventListener("message", handler);
  return () => window.removeEventListener("message", handler);
}
