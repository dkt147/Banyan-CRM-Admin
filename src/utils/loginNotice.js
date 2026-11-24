// A one-off message for the login page, e.g. "Your password was changed. Please sign in again."
const KEY = "banyan-login-notice";

export function setLoginNotice(text) {
  try { sessionStorage.setItem(KEY, text); } catch { /* ignore */ }
}

export function takeLoginNotice() {
  try {
    const text = sessionStorage.getItem(KEY);
    sessionStorage.removeItem(KEY);
    return text || "";
  } catch { return ""; }
}
