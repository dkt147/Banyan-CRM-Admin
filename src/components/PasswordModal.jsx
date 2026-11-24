import React, { useState } from "react";
import Modal from "./Modal";
import { useAuth } from "../auth/AuthContext";

// Passwords (client meeting 25 Nov: "password reset feature").
//   mode "set"    – an admin sets a new password for another user: POST /members/:id/password { password }
//   mode "change" – the signed-in user changes their own:          POST /auth/change-password { currentPassword, newPassword }
// The backend signs the user out of their other sessions. After changing your own password
// you sign in again with the new one.

const MIN = 8;

function strongPassword() {
  const sets = ["ABCDEFGHJKLMNPQRSTUVWXYZ", "abcdefghijkmnpqrstuvwxyz", "23456789", "!@#%*?"];
  const all = sets.join("");
  const pick = (s) => s[crypto.getRandomValues(new Uint32Array(1))[0] % s.length];
  const chars = [...sets.map(pick), ...Array.from({ length: 10 }, () => pick(all))];
  for (let i = chars.length - 1; i > 0; i--) { const j = crypto.getRandomValues(new Uint32Array(1))[0] % (i + 1); [chars[i], chars[j]] = [chars[j], chars[i]]; }
  return chars.join("");
}

export function passwordProblem(pw, email) {
  if (pw.length < MIN) return `Use at least ${MIN} characters.`;
  if (!/[A-Za-z]/.test(pw) || !/[0-9]/.test(pw)) return "Use letters and at least one number.";
  if (email && pw.toLowerCase().includes(String(email).split("@")[0].toLowerCase())) return "Don't use the email name in the password.";
  return "";
}

export default function PasswordModal({ mode, member, onClose }) {
  const { request, user, logout } = useAuth();
  const self = mode === "change";
  const email = self ? user?.email : member?.email;
  const [v, setV] = useState({ current: "", next: "", confirm: "" });
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);

  async function submit(e) {
    e.preventDefault();
    if (self && !v.current) { setError("Enter your current password."); return; }
    const problem = passwordProblem(v.next, email);
    if (problem) { setError(problem); return; }
    if (v.next !== v.confirm) { setError("The two new passwords don't match."); return; }
    if (self && v.next === v.current) { setError("The new password must be different from the current one."); return; }
    setBusy(true); setError("");
    try {
      if (self) await request("/auth/change-password", { method: "POST", body: { currentPassword: v.current, newPassword: v.next } });
      else await request(`/members/${member._id}/password`, { method: "POST", body: { password: v.next } });
      setDone(true);
    } catch (err) {
      setError(err.status === 404 ? "Password changes need the latest server update. Please try again later."
        // 400 INVALID_CURRENT_PASSWORD (never 401: a 401 would sign the user out).
        : err.payload?.code === "INVALID_CURRENT_PASSWORD" ? "Your current password isn't right."
          : err.message || "The password could not be changed.");
    } finally { setBusy(false); }
  }

  if (done) return (
    <Modal title={self ? "Password changed" : "New password set"} onClose={self ? logout : onClose}
      actions={<button type="button" className="btn primary" onClick={self ? logout : onClose}>{self ? "Sign in again" : "Done"}</button>}>
      {self ? <p>Your password is changed and you've been signed out of other devices. Sign in again with the new password.</p>
        : <>
          <p><b>{member.name || email}</b> can now sign in with the new password, and is signed out of any other devices.</p>
          <p className="lk-muted">Send the password separately from the email address (e.g. by phone or a different chat), and ask them to change it from <b>Profile → Change password</b> after signing in.</p>
        </>}
    </Modal>
  );

  return (
    <Modal title={self ? "Change your password" : `Set a new password for ${member.name || email}`} onClose={onClose}
      actions={<>
        <button type="submit" form="password-form" className="btn primary" disabled={busy}>{busy ? "Saving…" : self ? "Change password" : "Set password"}</button>
        <button type="button" className="btn ghost" onClick={onClose} disabled={busy}>Cancel</button>
      </>}>
      <form id="password-form" className="form-grid" onSubmit={submit} autoComplete="off">
        <input type="email" value={email || ""} autoComplete="username" readOnly hidden />
        {self && <label className="form-span-2">Current password<input type={show ? "text" : "password"} autoComplete="current-password" autoFocus value={v.current} disabled={busy} onChange={(e) => setV({ ...v, current: e.target.value })} /></label>}
        <label>New password<input type={show ? "text" : "password"} autoComplete="new-password" autoFocus={!self} value={v.next} disabled={busy} onChange={(e) => setV({ ...v, next: e.target.value })} /></label>
        <label>Repeat new password<input type={show ? "text" : "password"} autoComplete="new-password" value={v.confirm} disabled={busy} onChange={(e) => setV({ ...v, confirm: e.target.value })} /></label>
        <div className="form-span-2 pw-tools">
          <label className="fm-inline"><input type="checkbox" checked={show} onChange={(e) => setShow(e.target.checked)} /> Show passwords</label>
          {!self && <button type="button" className="av-link" onClick={() => { const p = strongPassword(); setV({ ...v, next: p, confirm: p }); setShow(true); }}>Generate a strong password</button>}
        </div>
        <p className="lk-muted form-span-2">At least {MIN} characters, with letters and a number.{!self ? " They'll be signed out everywhere else." : ""}</p>
        {error && <p className="lk-warn-text form-span-2">{error}</p>}
      </form>
    </Modal>
  );
}
