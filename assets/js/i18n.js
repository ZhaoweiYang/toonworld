/* ==========================================================================
   Tiny i18n runtime.

   Language resolution order:
     1. ?lang= in the URL
     2. the visitor's saved choice (localStorage)
     3. the browser's preferred languages (navigator.languages)
     4. English

   Bindings in the markup:
     data-i18n="a.b.c"                  -> textContent
     data-i18n-html="a.b.c"             -> innerHTML (dictionary content only)
     data-i18n-attr="placeholder:a.b|aria-label:c.d"
   ========================================================================== */

(function () {
  "use strict";

  var SUPPORTED = ["en", "ja", "zh-Hant"];
  var FALLBACK = "en";
  var STORE_KEY = "toonworld.lang";

  /** Map any BCP-47 tag onto one of the languages we ship. */
  function normalize(tag) {
    if (!tag) return null;
    var t = String(tag).toLowerCase().replace(/_/g, "-");
    if (t === "zh-hant" || t === "zh-tw" || t === "zh-hk" || t === "zh-mo") return "zh-Hant";
    // Simplified variants and bare "zh" fall back to our only Chinese locale.
    if (t === "zh" || t.indexOf("zh-") === 0) return "zh-Hant";
    if (t.indexOf("ja") === 0) return "ja";
    if (t.indexOf("en") === 0) return "en";
    return null;
  }

  function fromQuery() {
    try {
      return normalize(new URLSearchParams(window.location.search).get("lang"));
    } catch (e) {
      return null;
    }
  }

  function fromStorage() {
    try {
      return normalize(window.localStorage.getItem(STORE_KEY));
    } catch (e) {
      return null;
    }
  }

  function fromBrowser() {
    var list = navigator.languages && navigator.languages.length
      ? navigator.languages
      : [navigator.language || navigator.userLanguage];
    for (var i = 0; i < list.length; i++) {
      var hit = normalize(list[i]);
      if (hit) return hit;
    }
    return null;
  }

  var I18n = {
    lang: FALLBACK,
    supported: SUPPORTED,
    /** Values available to every {placeholder} in the dictionaries. */
    globals: { year: String(new Date().getFullYear()), date: "2026-08-16" },

    dict: function (lang) {
      return (window.TOON_I18N && window.TOON_I18N[lang || this.lang]) || {};
    },

    /** Resolve a dotted path, falling back to English and then to the path itself. */
    raw: function (path, lang) {
      var langs = [lang || this.lang, FALLBACK];
      for (var i = 0; i < langs.length; i++) {
        var node = this.dict(langs[i]);
        var parts = String(path).split(".");
        var ok = true;
        for (var j = 0; j < parts.length; j++) {
          if (node && Object.prototype.hasOwnProperty.call(node, parts[j])) {
            node = node[parts[j]];
          } else {
            ok = false;
            break;
          }
        }
        if (ok && node !== undefined && node !== null) return node;
      }
      return undefined;
    },

    /** Translate to a string, interpolating {vars}. */
    t: function (path, vars) {
      var value = this.raw(path);
      if (value === undefined) return path;
      if (typeof value !== "string") return value;
      var all = Object.assign({}, this.globals, vars || {});
      return value.replace(/\{(\w+)\}/g, function (match, key) {
        return Object.prototype.hasOwnProperty.call(all, key) ? all[key] : match;
      });
    },

    /** Always returns an array, so callers can map over it safely. */
    list: function (path) {
      var value = this.raw(path);
      return Array.isArray(value) ? value : [];
    },

    /** Apply every binding inside `root` (defaults to the whole document). */
    apply: function (root) {
      var scope = root || document;
      var self = this;

      scope.querySelectorAll("[data-i18n]").forEach(function (el) {
        var value = self.t(el.getAttribute("data-i18n"));
        if (typeof value === "string") el.textContent = value;
      });

      scope.querySelectorAll("[data-i18n-html]").forEach(function (el) {
        var value = self.t(el.getAttribute("data-i18n-html"));
        if (typeof value === "string") el.innerHTML = value;
      });

      scope.querySelectorAll("[data-i18n-attr]").forEach(function (el) {
        el.getAttribute("data-i18n-attr").split("|").forEach(function (pair) {
          var idx = pair.indexOf(":");
          if (idx < 0) return;
          var attr = pair.slice(0, idx).trim();
          var value = self.t(pair.slice(idx + 1).trim());
          if (typeof value === "string") el.setAttribute(attr, value);
        });
      });

      if (!root) this.applyHead();
    },

    /** Document title, meta description and the <html lang> attribute. */
    applyHead: function () {
      var page = document.body ? document.body.getAttribute("data-page") : null;
      var meta = this.raw("_meta") || {};
      document.documentElement.setAttribute("lang", meta.htmlLang || this.lang);

      if (page) {
        var title = this.t("meta." + page + ".title");
        var desc = this.t("meta." + page + ".desc");
        if (title && title.indexOf("meta.") !== 0) document.title = title;
        if (desc && desc.indexOf("meta.") !== 0) {
          [
            'meta[name="description"]',
            'meta[property="og:description"]'
          ].forEach(function (sel) {
            var node = document.querySelector(sel);
            if (node) node.setAttribute("content", desc);
          });
          var ogTitle = document.querySelector('meta[property="og:title"]');
          if (ogTitle) ogTitle.setAttribute("content", title);
          var ogLocale = document.querySelector('meta[property="og:locale"]');
          if (ogLocale) ogLocale.setAttribute("content", meta.htmlLang || this.lang);
        }
      }
    },

    /** Switch language, re-render and notify listeners. `persist` defaults to true. */
    set: function (lang, persist) {
      var next = normalize(lang) || FALLBACK;
      this.lang = next;
      if (persist !== false) {
        try { window.localStorage.setItem(STORE_KEY, next); } catch (e) { /* private mode */ }
      }
      this.apply();
      document.dispatchEvent(new CustomEvent("i18n:change", { detail: { lang: next } }));
    },

    /** True when nothing was explicitly chosen — i.e. the browser decided. */
    isAuto: function () {
      return !fromQuery() && !fromStorage();
    },

    init: function () {
      // Upload limits live in the config but are quoted in the dictionaries.
      var cfg = window.TOON_CONFIG || {};
      this.globals.size = String(cfg.maxFileSizeMB || 8);
      this.globals.count = String(cfg.maxFiles || 3);

      this.lang = fromQuery() || fromStorage() || fromBrowser() || FALLBACK;
      this.apply();
      document.dispatchEvent(new CustomEvent("i18n:change", { detail: { lang: this.lang } }));
    }
  };

  window.I18n = I18n;
})();
