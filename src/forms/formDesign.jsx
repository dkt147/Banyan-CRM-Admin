import React, { useEffect } from "react";

// Banyan form look, taken from banyanworkspace.com (Elementor globals) and the walk-in form
// the team uses today: Playfair Display headings, Instrument Sans text, Banyan green.
// Stored on the form as `design` and used by the CRM preview, the embed code and the
// WordPress page (the plugin renders the same fields with the same values).
export const BANYAN_DESIGN = {
  title: "",
  intro: "",
  buttonText: "Submit",
  successMessage: "Thank you! We'll be in touch soon.",
  layout: "centered",          // centered | image-left
  imageUrl: "",
  headingFont: "Playfair Display",
  bodyFont: "Instrument Sans",
  colors: {
    text: "#1A2E1F",
    button: "#2D5F4C",
    buttonHover: "#5A4A2E",
    buttonText: "#FFFFFF",
    background: "#FFFFFF",
    page: "#EAEDEB",
  },
};

export const LAYOUTS = [["centered", "Centred"], ["image-left", "Image on the left"]];
export const COLOR_FIELDS = [
  ["text", "Text"], ["button", "Button"], ["buttonHover", "Button (hover)"], ["buttonText", "Button text"],
  ["background", "Form background"], ["page", "Page background"],
];

/** Merge a stored design over the Banyan defaults (old forms have none). */
export const withDesign = (design) => ({ ...BANYAN_DESIGN, ...(design || {}), colors: { ...BANYAN_DESIGN.colors, ...(design?.colors || {}) } });

const HEX = /^#[0-9a-f]{6}$/i;
export const validColor = (c) => HEX.test(String(c || ""));

// Load the two Banyan fonts once, for the preview only.
const FONT_HREF = "https://fonts.googleapis.com/css2?family=Instrument+Sans:wght@400;500;600&family=Playfair+Display:wght@400;500;600&display=swap";
function useBanyanFonts() {
  useEffect(() => {
    if (document.querySelector(`link[data-banyan-fonts]`)) return;
    const link = document.createElement("link");
    link.rel = "stylesheet"; link.href = FONT_HREF; link.dataset.banyanFonts = "1";
    document.head.appendChild(link);
  }, []);
}

/** Branded preview: what the form looks like on its own page. */
export function BrandedPreview({ form }) {
  useBanyanFonts();
  const d = withDesign(form.design);
  const style = {
    "--bf-text": d.colors.text, "--bf-button": d.colors.button, "--bf-button-hover": d.colors.buttonHover,
    "--bf-button-text": d.colors.buttonText, "--bf-bg": d.colors.background, "--bf-page": d.colors.page,
    "--bf-heading": `"${d.headingFont}", Georgia, serif`, "--bf-body": `"${d.bodyFont}", system-ui, sans-serif`,
  };
  const image = d.layout === "image-left" && d.imageUrl;
  return (
    <div className="bf-page" style={style}>
      <div className={`bf-card${image ? " bf-with-image" : ""}`}>
        {image && <div className="bf-image" style={{ backgroundImage: `url("${d.imageUrl.replace(/"/g, "")}")` }} role="img" aria-label="" />}
        <form className="bf-form" onSubmit={(e) => e.preventDefault()}>
          {d.title && <h2 className="bf-title">{d.title}</h2>}
          {d.intro && <p className="bf-intro">{d.intro}</p>}
          {(form.fields || []).map((f, i) => (
            <div key={i} className="bf-field">
              <span className="bf-label">{f.label}{f.required && <span aria-hidden="true"> *</span>}</span>
              {f.type === "textarea" ? <textarea rows={3} disabled />
                : f.type === "checkboxes" ? <span className="bf-options">{(f.options || []).map((o) => <label key={o}><input type="checkbox" disabled /> {o}</label>)}</span>
                  : f.type === "select" ? <select disabled><option>Choose…</option>{(f.options || []).map((o) => <option key={o}>{o}</option>)}</select>
                    : <input type={f.type} disabled placeholder={f.label} />}
            </div>
          ))}
          {form.consentText && <label className="bf-consent"><input type="checkbox" disabled /> {form.consentText}</label>}
          <button type="button" className="bf-button">{d.buttonText || "Submit"}</button>
        </form>
      </div>
    </div>
  );
}

/** Design settings for the form editor. */
export function DesignFields({ design, onChange }) {
  const d = withDesign(design);
  const set = (patch) => onChange({ ...d, ...patch });
  const setColor = (k, v) => onChange({ ...d, colors: { ...d.colors, [k]: v } });
  const isDefault = JSON.stringify(d.colors) === JSON.stringify(BANYAN_DESIGN.colors) && d.headingFont === BANYAN_DESIGN.headingFont && d.bodyFont === BANYAN_DESIGN.bodyFont;
  return (
    <div className="form-grid bf-design">
      <label className="form-span-2">Title<input value={d.title} placeholder="e.g. Welcome to Banyan Workspace" onChange={(e) => set({ title: e.target.value })} /><small className="lk-muted">Also the website page title. Empty uses the form name.</small></label>
      <label className="form-span-2">Introduction<textarea rows={2} value={d.intro} placeholder="A sentence or two above the fields" onChange={(e) => set({ intro: e.target.value })} /></label>
      <label>Button text<input value={d.buttonText} maxLength={40} onChange={(e) => set({ buttonText: e.target.value })} /></label>
      <label>Layout<select value={d.layout} onChange={(e) => set({ layout: e.target.value })}>{LAYOUTS.map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></label>
      {d.layout === "image-left" && <label className="form-span-2">Image address (https://…)<input value={d.imageUrl} placeholder="https://banyanworkspace.com/wp-content/uploads/…jpg" onChange={(e) => set({ imageUrl: e.target.value.trim() })} /></label>}
      <label className="form-span-2">Thank-you message<input value={d.successMessage} onChange={(e) => set({ successMessage: e.target.value })} /></label>
      <fieldset className="form-span-2 bf-colors">
        <legend>Colours</legend>
        {COLOR_FIELDS.map(([k, l]) => (
          <label key={k} className="bf-color">
            <input type="color" value={validColor(d.colors[k]) ? d.colors[k] : BANYAN_DESIGN.colors[k]} onChange={(e) => setColor(k, e.target.value.toUpperCase())} aria-label={l} />
            <span>{l}<code>{d.colors[k]}</code></span>
          </label>
        ))}
      </fieldset>
      {!isDefault && <button type="button" className="btn ghost form-span-2" onClick={() => onChange({ ...d, colors: { ...BANYAN_DESIGN.colors }, headingFont: BANYAN_DESIGN.headingFont, bodyFont: BANYAN_DESIGN.bodyFont })}>Reset to Banyan colours</button>}
    </div>
  );
}
