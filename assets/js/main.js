/* ==========================================================================
   Shared site behaviour: theme, navigation, language picker, and the
   dictionary-driven sections of the home page.
   ========================================================================== */

(function () {
  "use strict";

  var THEME_KEY = "toonworld.theme";

  var ICONS = {
    scroll: '<path d="M7 3h10a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2Z"/><path d="M9 8h6M9 12h6M9 16h3"/>',
    globe: '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a15 15 0 0 1 0 18a15 15 0 0 1 0-18Z"/>',
    download: '<path d="M12 3v12"/><path d="m7 11 5 5 5-5"/><path d="M4 20h16"/>',
    gift: '<path d="M20 12v8a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1v-8"/><path d="M3 8h18v4H3z"/><path d="M12 8v13"/><path d="M12 8S10.5 3 8 3a2.5 2.5 0 0 0 0 5m4 0s1.5-5 4-5a2.5 2.5 0 0 1 0 5"/>',
    bell: '<path d="M18 8a6 6 0 1 0-12 0c0 6-3 7-3 7h18s-3-1-3-7"/><path d="M13.7 21a2 2 0 0 1-3.4 0"/>',
    shield: '<path d="M12 3 4 6v6c0 5 3.4 8.3 8 9 4.6-.7 8-4 8-9V6l-8-3Z"/><path d="m9 12 2 2 4-4"/>'
  };

  function svg(name) {
    return (
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" ' +
      'stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
      (ICONS[name] || "") +
      "</svg>"
    );
  }

  /* ------------------------------------------------------------- theme --- */

  function currentTheme() {
    var explicit = document.documentElement.getAttribute("data-theme");
    if (explicit) return explicit;
    return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  }

  function initTheme() {
    var btn = document.querySelector(".theme-toggle");
    if (!btn) return;
    btn.addEventListener("click", function () {
      var next = currentTheme() === "dark" ? "light" : "dark";
      document.documentElement.setAttribute("data-theme", next);
      try { window.localStorage.setItem(THEME_KEY, next); } catch (e) { /* private mode */ }
      btn.setAttribute("aria-pressed", String(next === "dark"));
    });
    btn.setAttribute("aria-pressed", String(currentTheme() === "dark"));
  }

  /* -------------------------------------------------------- navigation --- */

  function initNav() {
    var burger = document.querySelector(".nav__burger");
    var links = document.querySelector(".nav__links");
    if (!burger || !links) return;

    burger.addEventListener("click", function () {
      var open = links.getAttribute("data-open") === "true";
      links.setAttribute("data-open", String(!open));
      burger.setAttribute("aria-expanded", String(!open));
    });

    links.addEventListener("click", function (event) {
      if (event.target.closest("a")) {
        links.setAttribute("data-open", "false");
        burger.setAttribute("aria-expanded", "false");
      }
    });
  }

  /* --------------------------------------------------- language picker --- */

  function initLangPicker() {
    var root = document.querySelector(".lang");
    if (!root || !window.I18n) return;

    var btn = root.querySelector(".lang__btn");
    var label = root.querySelector(".lang__label");
    var menu = root.querySelector(".lang__menu");

    menu.innerHTML = I18n.supported
      .map(function (code) {
        var meta = (window.TOON_I18N[code] && window.TOON_I18N[code]._meta) || {};
        return (
          '<li role="none"><button type="button" role="menuitemradio" data-lang="' + code + '" ' +
          'aria-checked="false"><span>' + (meta.native || code) + "</span>" +
          '<span class="lang__native">' + (meta.name || code) + "</span></button></li>"
        );
      })
      .join("");

    function sync() {
      var meta = (window.TOON_I18N[I18n.lang] && window.TOON_I18N[I18n.lang]._meta) || {};
      if (label) label.textContent = meta.native || I18n.lang;
      menu.querySelectorAll("button").forEach(function (item) {
        item.setAttribute("aria-checked", String(item.getAttribute("data-lang") === I18n.lang));
      });
    }

    function close() {
      menu.setAttribute("data-open", "false");
      btn.setAttribute("aria-expanded", "false");
    }

    btn.addEventListener("click", function (event) {
      event.stopPropagation();
      var open = menu.getAttribute("data-open") === "true";
      menu.setAttribute("data-open", String(!open));
      btn.setAttribute("aria-expanded", String(!open));
    });

    menu.addEventListener("click", function (event) {
      var item = event.target.closest("button[data-lang]");
      if (!item) return;
      I18n.set(item.getAttribute("data-lang"));
      close();
      btn.focus();
    });

    document.addEventListener("click", function (event) {
      if (!root.contains(event.target)) close();
    });
    document.addEventListener("keydown", function (event) {
      if (event.key === "Escape") close();
    });

    document.addEventListener("i18n:change", sync);
    sync();
  }

  /* ------------------------------------------------- home page content --- */

  function renderHome() {
    var featureGrid = document.getElementById("feature-grid");
    if (!featureGrid) return; // not the home page

    featureGrid.innerHTML = I18n.list("features.items")
      .map(function (item) {
        return (
          '<article class="card reveal">' +
          '<div class="card__ico">' + svg(item.icon) + "</div>" +
          "<h3>" + item.title + "</h3><p>" + item.body + "</p></article>"
        );
      })
      .join("");

    var steps = document.getElementById("steps");
    if (steps) {
      steps.innerHTML = I18n.list("how.steps")
        .map(function (step) {
          return '<div class="step reveal"><h3>' + step.title + "</h3><p>" + step.body + "</p></div>";
        })
        .join("");
    }

    var genres = document.getElementById("genre-list");
    if (genres) {
      genres.innerHTML = I18n.list("genres.items")
        .map(function (name) { return '<span class="genre">' + name + "</span>"; })
        .join("");
    }

    var faq = document.getElementById("faq-list");
    if (faq) {
      faq.innerHTML = I18n.list("faq.items")
        .map(function (item) {
          return (
            "<details><summary>" + item.q + "</summary>" +
            '<div class="faq__body">' + item.a + "</div></details>"
          );
        })
        .join("");
    }

    var stats = document.getElementById("hero-stats");
    if (stats) {
      stats.innerHTML = I18n.list("hero.stats")
        .map(function (stat) {
          return "<div><strong>" + stat.v + "</strong><span>" + stat.l + "</span></div>";
        })
        .join("");
    }

    var strip = document.getElementById("strip-track");
    if (strip) {
      var words = I18n.list("strip");
      var run = words.map(function (w) { return "<span>" + w + "</span>"; }).join("");
      strip.innerHTML = run + run; // duplicated so the marquee loops seamlessly
    }

    observeReveals();
  }

  /* ------------------------------------------------------ legal pages --- */

  function renderLegal() {
    var host = document.getElementById("legal-body");
    if (!host) return;
    var which = host.getAttribute("data-legal"); // "privacy" | "terms"
    host.innerHTML = I18n.list("legal." + which + ".sections")
      .map(function (section) {
        return "<h2>" + section.h + "</h2><p>" + section.p + "</p>";
      })
      .join("");
  }

  /* ------------------------------------------------------ scroll reveal --- */

  var observer = null;

  function observeReveals() {
    var items = document.querySelectorAll(".reveal:not(.is-in)");
    if (!("IntersectionObserver" in window)) {
      items.forEach(function (el) { el.classList.add("is-in"); });
      return;
    }
    if (!observer) {
      observer = new IntersectionObserver(function (entries) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting) {
            entry.target.classList.add("is-in");
            observer.unobserve(entry.target);
          }
        });
      }, { rootMargin: "0px 0px -60px 0px", threshold: 0.08 });
    }
    items.forEach(function (el) { observer.observe(el); });
  }

  /* --------------------------------------------------------------- go ---- */

  function initStoreLinks() {
    var cfg = window.TOON_CONFIG || {};
    document.querySelectorAll("[data-store]").forEach(function (el) {
      var url = el.getAttribute("data-store") === "ios" ? cfg.iosUrl : cfg.androidUrl;
      if (url && url !== "#") {
        el.setAttribute("href", url);
        el.setAttribute("rel", "noopener");
      }
    });
  }

  document.addEventListener("DOMContentLoaded", function () {
    if (window.I18n) I18n.init();
    initTheme();
    initNav();
    initLangPicker();
    initStoreLinks();
    renderHome();
    renderLegal();
    observeReveals();
    document.addEventListener("i18n:change", function () {
      renderHome();
      renderLegal();
    });
  });
})();
