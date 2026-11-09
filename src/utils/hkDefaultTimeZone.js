/*
 * Display every date and time in Hong Kong time, whatever the browser's time zone
 * (decision 2026-11-10). Calls that pass their own timeZone are left alone; calls
 * without one (toLocaleString, toLocaleDateString, toLocaleTimeString and
 * Intl.DateTimeFormat across the existing screens) default to Asia/Hong_Kong.
 * Imported once in main.jsx, before the app renders.
 */
const HK = "Asia/Hong_Kong";
const withHk = (options) => (options && options.timeZone ? options : { ...(options || {}), timeZone: HK });

for (const method of ["toLocaleString", "toLocaleDateString", "toLocaleTimeString"]) {
  const original = Date.prototype[method];
  Object.defineProperty(Date.prototype, method, {
    configurable: true,
    writable: true,
    value: function hkLocale(locales, options) {
      return original.call(this, locales, withHk(options));
    },
  });
}

const OriginalDateTimeFormat = Intl.DateTimeFormat;
function HkDateTimeFormat(locales, options) {
  return new OriginalDateTimeFormat(locales, withHk(options));
}
HkDateTimeFormat.prototype = OriginalDateTimeFormat.prototype;
HkDateTimeFormat.supportedLocalesOf = OriginalDateTimeFormat.supportedLocalesOf.bind(OriginalDateTimeFormat);
Intl.DateTimeFormat = HkDateTimeFormat;
