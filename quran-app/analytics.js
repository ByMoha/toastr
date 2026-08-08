/* ===== Analytics: Microsoft Clarity =====
 * Loads the Clarity tag (heatmaps + session recording) when a project id is
 * configured, and exposes window.track(event, tags) for custom activity events.
 * Everything degrades to a no-op when Clarity is absent (offline/demo builds),
 * so callers can invoke window.track(...) unconditionally.
 */
(function () {
  "use strict";
  var cfg = (window.QURAN_CONFIG && window.QURAN_CONFIG.analytics && window.QURAN_CONFIG.analytics.clarity) || {};
  var id = cfg.projectId;

  // custom-event helper — safe before/without Clarity (queues via clarity stub)
  window.track = function (event, tags) {
    try {
      if (typeof window.clarity !== "function") return;
      window.clarity("event", String(event));
      if (tags) Object.keys(tags).forEach(function (k) {
        window.clarity("set", k, String(tags[k]));
      });
    } catch (_) {}
  };

  if (!cfg.enabled || !id) return;   // tracking disabled or unconfigured

  // official Clarity bootstrap (async tag loader)
  (function (c, l, a, r, i, t, y) {
    c[a] = c[a] || function () { (c[a].q = c[a].q || []).push(arguments); };
    t = l.createElement(r); t.async = 1; t.src = "https://www.clarity.ms/tag/" + i;
    y = l.getElementsByTagName(r)[0]; y.parentNode.insertBefore(t, y);
  })(window, document, "clarity", "script", id);
})();
