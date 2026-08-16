/* ==========================================================================
   Support Center: tab routing, screenshot uploads, validation and submission.

   Submission has two modes, decided by TOON_CONFIG.supportEndpoint:
     - endpoint set  -> POST multipart/form-data with the screenshots attached
     - endpoint empty -> build a reference number, a copyable summary, a
                         downloadable receipt and a pre-filled mailto: link
   ========================================================================== */

(function () {
  "use strict";

  var CFG = window.TOON_CONFIG || {};
  var MAX_FILES = CFG.maxFiles || 3;
  var MAX_MB = CFG.maxFileSizeMB || 8;
  var ACCEPTED = CFG.acceptedTypes || ["image/png", "image/jpeg", "image/webp"];
  var HISTORY_KEY = "toonworld.tickets";

  /** Files chosen per form, keyed by form id. */
  var uploads = {};
  /** The request currently shown on the result screen. */
  var lastSubmit = null;

  function t(path, vars) { return window.I18n ? I18n.t(path, vars) : path; }
  function $(sel, root) { return (root || document).querySelector(sel); }
  function $$(sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); }

  /* --------------------------------------------------------------- tabs --- */

  function initTabs() {
    var tabs = $$(".tab");
    if (!tabs.length) return;

    function show(name, focus) {
      tabs.forEach(function (tab) {
        var on = tab.getAttribute("data-tab") === name;
        tab.setAttribute("aria-selected", String(on));
        tab.setAttribute("tabindex", on ? "0" : "-1");
      });
      $$(".panel").forEach(function (panel) {
        panel.hidden = panel.getAttribute("data-panel") !== name;
      });
      if (focus) {
        var active = tabs.filter(function (tab) { return tab.getAttribute("data-tab") === name; })[0];
        if (active) active.focus();
      }
      if (name === "contact") renderHistory();
    }

    tabs.forEach(function (tab) {
      tab.addEventListener("click", function () {
        var name = tab.getAttribute("data-tab");
        show(name);
        history.replaceState(null, "", "#" + name);
      });
    });

    // Left/right arrows move between tabs, as expected of a tablist.
    $(".tabs").addEventListener("keydown", function (event) {
      var idx = tabs.indexOf(document.activeElement);
      if (idx < 0) return;
      var next = null;
      if (event.key === "ArrowDown" || event.key === "ArrowRight") next = (idx + 1) % tabs.length;
      if (event.key === "ArrowUp" || event.key === "ArrowLeft") next = (idx - 1 + tabs.length) % tabs.length;
      if (event.key === "Home") next = 0;
      if (event.key === "End") next = tabs.length - 1;
      if (next === null) return;
      event.preventDefault();
      show(tabs[next].getAttribute("data-tab"), true);
    });

    var fromHash = (window.location.hash || "").replace("#", "");
    var known = tabs.map(function (tab) { return tab.getAttribute("data-tab"); });
    show(known.indexOf(fromHash) >= 0 ? fromHash : known[0]);

    window.addEventListener("hashchange", function () {
      var name = (window.location.hash || "").replace("#", "");
      if (known.indexOf(name) >= 0) show(name);
    });
  }

  /* ------------------------------------------------------------ uploads --- */

  function humanSize(bytes) {
    if (bytes < 1024) return bytes + " B";
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(0) + " KB";
    return (bytes / 1024 / 1024).toFixed(1) + " MB";
  }

  function isAcceptedImage(file) {
    if (file.type && ACCEPTED.indexOf(file.type) >= 0) return true;
    // Some browsers report an empty type for HEIC; fall back to the extension.
    return /\.(png|jpe?g|webp|heic|heif|gif)$/i.test(file.name || "");
  }

  function initDropzone(zone) {
    var form = zone.closest("form");
    var input = $('input[type="file"]', zone);
    var thumbs = $(".thumbs", zone.parentNode);
    var errorEl = $(".error-msg", zone.parentNode);
    uploads[form.id] = uploads[form.id] || [];

    function fail(message) {
      if (!errorEl) return;
      errorEl.textContent = message;
      errorEl.setAttribute("data-show", "true");
    }

    function clearError() {
      if (errorEl) errorEl.setAttribute("data-show", "false");
      zone.setAttribute("aria-invalid", "false");
    }

    function render() {
      thumbs.innerHTML = "";
      uploads[form.id].forEach(function (item, index) {
        var fig = document.createElement("div");
        fig.className = "thumb";
        fig.innerHTML =
          '<img alt="" src="' + item.url + '">' +
          '<button type="button" class="thumb__del" title="' + t("support.upload.remove") +
          '" aria-label="' + t("support.upload.remove") + '">&times;</button>' +
          '<span class="thumb__meta">' + escapeHtml(item.file.name) + "<br>" + humanSize(item.file.size) + "</span>";
        $(".thumb__del", fig).addEventListener("click", function () {
          URL.revokeObjectURL(item.url);
          uploads[form.id].splice(index, 1);
          render();
        });
        thumbs.appendChild(fig);
      });
    }

    function add(fileList) {
      clearError();
      var files = Array.prototype.slice.call(fileList);
      for (var i = 0; i < files.length; i++) {
        var file = files[i];
        if (uploads[form.id].length >= MAX_FILES) {
          fail(t("support.errors.fileCount", { count: MAX_FILES }));
          break;
        }
        if (!isAcceptedImage(file)) {
          fail(t("support.errors.fileType", { name: file.name }));
          continue;
        }
        if (file.size > MAX_MB * 1024 * 1024) {
          fail(t("support.errors.fileSize", { name: file.name, size: MAX_MB }));
          continue;
        }
        uploads[form.id].push({ file: file, url: URL.createObjectURL(file) });
      }
      render();
    }

    zone.addEventListener("click", function () { input.click(); });
    zone.addEventListener("keydown", function (event) {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        input.click();
      }
    });
    input.addEventListener("change", function () {
      add(input.files);
      input.value = ""; // so picking the same file twice still fires change
    });

    ["dragenter", "dragover"].forEach(function (name) {
      zone.addEventListener(name, function (event) {
        event.preventDefault();
        zone.setAttribute("data-drag", "true");
      });
    });
    ["dragleave", "drop"].forEach(function (name) {
      zone.addEventListener(name, function (event) {
        event.preventDefault();
        zone.setAttribute("data-drag", "false");
      });
    });
    zone.addEventListener("drop", function (event) {
      if (event.dataTransfer && event.dataTransfer.files) add(event.dataTransfer.files);
    });
  }

  /* --------------------------------------------------------- validation --- */

  var EMAIL_RE = /^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i;

  function fieldError(control, message) {
    var wrap = control.closest(".field") || control.parentNode;
    var errorEl = $(".error-msg", wrap);
    if (message) {
      control.setAttribute("aria-invalid", "true");
      if (errorEl) {
        errorEl.textContent = message;
        errorEl.setAttribute("data-show", "true");
      }
    } else {
      control.setAttribute("aria-invalid", "false");
      if (errorEl) errorEl.setAttribute("data-show", "false");
    }
  }

  function validate(form) {
    var problems = [];

    $$("[data-validate]", form).forEach(function (control) {
      var value = (control.value || "").trim();
      var rules = control.getAttribute("data-validate").split(" ");
      var message = null;

      if (rules.indexOf("required") >= 0 && !value) {
        message = t("support.errors.required");
      } else if (value && rules.indexOf("email") >= 0 && !EMAIL_RE.test(value)) {
        message = t("support.errors.email");
      } else if (value && rules.indexOf("amount") >= 0 && !/^\d+([.,]\d{1,2})?$/.test(value)) {
        message = t("support.errors.amount");
      } else if (value && control.hasAttribute("data-minlen")) {
        var min = parseInt(control.getAttribute("data-minlen"), 10);
        if (value.length < min) message = t("support.errors.short", { n: min });
      }

      fieldError(control, message);
      if (message) problems.push(control);
    });

    $$('input[type="checkbox"][data-validate-check]', form).forEach(function (box) {
      var kind = box.getAttribute("data-validate-check");
      var wrap = box.closest(".field") || box.parentNode.parentNode;
      var errorEl = $(".error-msg", wrap);
      if (!box.checked) {
        if (errorEl) {
          errorEl.textContent = t(kind === "consent" ? "support.errors.consent" : "support.errors.confirm");
          errorEl.setAttribute("data-show", "true");
        }
        problems.push(box);
      } else if (errorEl) {
        errorEl.setAttribute("data-show", "false");
      }
    });

    var zone = $(".dropzone[data-required='true']", form);
    if (zone && !(uploads[form.id] || []).length) {
      var zoneError = $(".error-msg", zone.parentNode);
      if (zoneError) {
        zoneError.textContent = t("support.errors.filesRequired");
        zoneError.setAttribute("data-show", "true");
      }
      zone.setAttribute("aria-invalid", "true");
      problems.push(zone);
    }

    return problems;
  }

  /* ------------------------------------------------------------ summary --- */

  function labelFor(control, form) {
    if (control.type === "checkbox") {
      var line = control.closest(".checkline");
      return line ? line.textContent.trim() : control.name;
    }
    var wrap = control.closest(".field");
    var label = wrap ? $("label", wrap) : null;
    if (!label) return control.name;
    // Drop the "required"/"optional" hint that follows the label text.
    var clone = label.cloneNode(true);
    $$(".hint, .req", clone).forEach(function (node) { node.remove(); });
    return clone.textContent.trim().replace(/[:：]\s*$/, "");
  }

  /** Reads the live form, so the summary follows the current language. */
  function buildSummary(form) {
    var rows = [];
    $$("input, select, textarea", form).forEach(function (control) {
      if (!control.name || control.type === "file") return;
      if (control.type === "checkbox") {
        if (control.getAttribute("data-summary") === "skip") return;
        rows.push({ label: labelFor(control, form), value: t(control.checked ? "support.labels.yes" : "support.labels.no") });
        return;
      }
      var value = (control.value || "").trim();
      if (!value) return;
      if (control.tagName === "SELECT") {
        var opt = control.options[control.selectedIndex];
        value = opt ? opt.textContent.trim() : value;
      }
      rows.push({ label: labelFor(control, form), value: value });
    });

    var files = uploads[form.id] || [];
    rows.push({
      label: t("support.labels.files"),
      value: files.length
        ? files.map(function (f) { return f.file.name + " (" + humanSize(f.file.size) + ")"; }).join("\n")
        : t("support.labels.none")
    });
    return rows;
  }

  function summaryToText(kindLabel, ticket, rows, when) {
    var lines = [
      "ToonWorld — " + kindLabel,
      t("support.result.ticketLabel") + ": " + ticket,
      t("support.labels.submitted") + ": " + when,
      "----------------------------------------"
    ];
    rows.forEach(function (row) { lines.push(row.label + ": " + row.value); });
    return lines.join("\n");
  }

  function escapeHtml(str) {
    return String(str).replace(/[&<>"']/g, function (ch) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[ch];
    });
  }

  /* ------------------------------------------------------------- ticket --- */

  var PREFIX = { suggestion: "FB", refund: "RF", cancel: "CS" };

  function makeTicket(kind) {
    var now = new Date();
    var stamp =
      now.getFullYear() +
      String(now.getMonth() + 1).padStart(2, "0") +
      String(now.getDate()).padStart(2, "0");
    var rand = "";
    var alphabet = "ABCDEFGHJKMNPQRSTUVWXYZ23456789"; // no easily-confused characters
    var bytes = new Uint32Array(5);
    (window.crypto || window.msCrypto).getRandomValues(bytes);
    for (var i = 0; i < 5; i++) rand += alphabet[bytes[i] % alphabet.length];
    return "TW-" + (PREFIX[kind] || "GN") + "-" + stamp + "-" + rand;
  }

  /* ------------------------------------------------------ local history --- */

  function readHistory() {
    try {
      var raw = window.localStorage.getItem(HISTORY_KEY);
      var list = raw ? JSON.parse(raw) : [];
      return Array.isArray(list) ? list : [];
    } catch (e) {
      return [];
    }
  }

  function saveHistory(entry) {
    if (!CFG.keepLocalHistory) return;
    try {
      var list = readHistory();
      list.unshift(entry);
      window.localStorage.setItem(HISTORY_KEY, JSON.stringify(list.slice(0, 20)));
    } catch (e) { /* storage full or blocked */ }
  }

  function renderHistory() {
    var host = $("#history-list");
    if (!host) return;
    var list = readHistory();
    var clearBtn = $("#history-clear");

    if (!list.length) {
      host.innerHTML = '<p class="form-status">' + escapeHtml(t("support.contact.recentEmpty")) + "</p>";
      if (clearBtn) clearBtn.hidden = true;
      return;
    }
    if (clearBtn) clearBtn.hidden = false;

    host.innerHTML =
      '<div class="summary">' +
      list
        .map(function (item) {
          var kind = t("support.tabs." + item.kind);
          var when = new Date(item.at).toLocaleString(I18n.lang);
          return (
            '<div class="summary__row"><dt>' + escapeHtml(item.id) + "</dt><dd>" +
            escapeHtml(kind) + " · " + escapeHtml(when) +
            (item.email ? " · " + escapeHtml(item.email) : "") +
            "</dd></div>"
          );
        })
        .join("") +
      "</div>";
  }

  /* ---------------------------------------------------------- submitting --- */

  /**
   * Refunds are unconditional within 30 days of the charge; anything older is
   * still reviewed, just by hand. Cancellations always get the standard note —
   * the form has no reliable "last charge" date to test against.
   */
  function assurancePath(form, kind) {
    if (kind === "refund") {
      var input = $("input[data-eligibility]", form);
      if (input && input.value) {
        var charged = new Date(input.value + "T00:00:00");
        var days = (Date.now() - charged.getTime()) / 86400000;
        if (!isNaN(days) && days > 30) return "support.refund.assuranceLate";
      }
    }
    return "support." + kind + ".assurance";
  }

  function showResult(form, data) {
    var panel = form.closest(".panel");
    var result = $(".result", panel);
    form.hidden = true;
    result.hidden = false;

    var assurance = $(".result__assurance", result);
    if (assurance) {
      var path = assurancePath(form, data.kind);
      $(".result__assurance-title", assurance).textContent = t(path + ".title");
      $(".result__assurance-body", assurance).textContent = t(path + ".body");
    }

    $(".result__ticket-value", result).textContent = data.ticket;
    $(".result__title", result).textContent = t(data.sent ? "support.result.sentTitle" : "support.result.title");
    $(".result__body", result).textContent = t(data.sent ? "support.result.sentBody" : "support.result.body");

    var mailBlock = $(".result__mail", result);
    mailBlock.hidden = !!data.sent;

    $(".summary", result).innerHTML = data.rows
      .map(function (row) {
        return "<div class=\"summary__row\"><dt>" + escapeHtml(row.label) + "</dt><dd>" +
          escapeHtml(row.value) + "</dd></div>";
      })
      .join("");

    result.scrollIntoView({ behavior: "smooth", block: "center" });
  }

  function refreshResult() {
    // Re-render the visible result after a language switch.
    if (!lastSubmit) return;
    var form = document.getElementById(lastSubmit.formId);
    if (!form || !form.hidden) return;
    lastSubmit.rows = buildSummary(form);
    showResult(form, lastSubmit);
  }

  function mailtoFor(data) {
    var to = data.kind === "suggestion" ? CFG.supportEmail : CFG.billingEmail;
    var subject = "[" + data.ticket + "] " + data.kindLabel;
    var body = data.text;
    if (body.length > 1800) body = body.slice(0, 1800) + "\n…";
    return (
      "mailto:" + to +
      "?subject=" + encodeURIComponent(subject) +
      "&body=" + encodeURIComponent(body)
    );
  }

  function initForm(form) {
    var kind = form.getAttribute("data-kind");
    var panel = form.closest(".panel");
    var result = $(".result", panel);
    var status = $(".form-status", form);
    var submitBtn = $('button[type="submit"]', form);

    $$(".dropzone", form).forEach(initDropzone);

    // Live-clear an error once the visitor starts fixing the field.
    form.addEventListener("input", function (event) {
      if (event.target.getAttribute("aria-invalid") === "true") fieldError(event.target, null);
    });

    form.addEventListener("submit", function (event) {
      event.preventDefault();
      var problems = validate(form);
      if (problems.length) {
        status.textContent = t("support.common.formError");
        problems[0].focus({ preventScroll: true });
        problems[0].scrollIntoView({ behavior: "smooth", block: "center" });
        return;
      }
      status.textContent = "";

      var ticket = makeTicket(kind);
      var when = new Date();
      var rows = buildSummary(form);
      var kindLabel = t("support.tabs." + kind);
      var emailField = $('input[type="email"]', form);

      var data = {
        formId: form.id,
        kind: kind,
        kindLabel: kindLabel,
        ticket: ticket,
        rows: rows,
        at: when.toISOString(),
        text: summaryToText(kindLabel, ticket, rows, when.toLocaleString(I18n.lang)),
        sent: false
      };

      function finish() {
        lastSubmit = data;
        saveHistory({ id: ticket, kind: kind, at: data.at, email: emailField ? emailField.value.trim() : "" });
        showResult(form, data);
        renderHistory();
      }

      if (!CFG.supportEndpoint) {
        finish();
        return;
      }

      var payload = new FormData(form);
      payload.append("ticket", ticket);
      payload.append("requestType", kind);
      payload.append("language", I18n.lang);
      payload.append("summary", data.text);
      (uploads[form.id] || []).forEach(function (item, i) {
        payload.append("screenshot" + (i + 1), item.file, item.file.name);
      });

      submitBtn.disabled = true;
      status.textContent = t("support.common.submitting");

      fetch(CFG.supportEndpoint, { method: "POST", body: payload, headers: { Accept: "application/json" } })
        .then(function (response) {
          if (!response.ok) throw new Error("HTTP " + response.status);
          data.sent = true;
          status.textContent = "";
          finish();
        })
        .catch(function () {
          // Fall back to the offline flow so the visitor never loses their input.
          status.textContent = t("support.errors.network");
          finish();
        })
        .then(function () { submitBtn.disabled = false; });
    });

    // Result screen actions
    $(".result__copy", result).addEventListener("click", function (event) {
      var btn = event.currentTarget;
      var text = lastSubmit ? lastSubmit.text : "";
      var done = function () {
        var original = btn.textContent;
        btn.textContent = t("support.result.copied");
        setTimeout(function () { btn.textContent = original; }, 1800);
      };
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text).then(done, done);
      } else {
        var area = document.createElement("textarea");
        area.value = text;
        document.body.appendChild(area);
        area.select();
        try { document.execCommand("copy"); } catch (e) { /* ignore */ }
        area.remove();
        done();
      }
    });

    $(".result__download", result).addEventListener("click", function () {
      if (!lastSubmit) return;
      var blob = new Blob([lastSubmit.text], { type: "text/plain;charset=utf-8" });
      var link = document.createElement("a");
      link.href = URL.createObjectURL(blob);
      link.download = lastSubmit.ticket + ".txt";
      document.body.appendChild(link);
      link.click();
      link.remove();
      setTimeout(function () { URL.revokeObjectURL(link.href); }, 1000);
    });

    $(".result__mailbtn", result).addEventListener("click", function () {
      if (lastSubmit) window.location.href = mailtoFor(lastSubmit);
    });

    $(".result__again", result).addEventListener("click", function () {
      form.reset();
      (uploads[form.id] || []).forEach(function (item) { URL.revokeObjectURL(item.url); });
      uploads[form.id] = [];
      $$(".thumbs", form).forEach(function (node) { node.innerHTML = ""; });
      $$('[aria-invalid="true"]', form).forEach(function (node) { node.setAttribute("aria-invalid", "false"); });
      $$(".error-msg", form).forEach(function (node) { node.setAttribute("data-show", "false"); });
      status.textContent = "";
      lastSubmit = null;
      result.hidden = true;
      form.hidden = false;
      form.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }

  /* ------------------------------------------ dictionary-driven blocks --- */

  function renderLists() {
    var policy = $("#refund-policy");
    if (policy) {
      policy.innerHTML = I18n.list("support.refund.policyItems")
        .map(function (item) { return "<li>" + escapeHtml(item) + "</li>"; })
        .join("");
    }

    var steps = $("#cancel-steps");
    if (steps) {
      steps.innerHTML = I18n.list("support.cancel.storeItems")
        .map(function (item) { return "<li>" + escapeHtml(item) + "</li>"; })
        .join("");
    }

    var cards = $("#contact-cards");
    if (cards) {
      cards.innerHTML = I18n.list("support.contact.cards")
        .map(function (card) {
          return (
            '<article class="contact"><h3>' + escapeHtml(card.title) + "</h3><p>" +
            escapeHtml(card.body) + '</p><a href="mailto:' + encodeURIComponent(card.value) + '">' +
            escapeHtml(card.value) + "</a></article>"
          );
        })
        .join("");
    }
  }

  /* ---------------------------------------------------------------- go ---- */

  document.addEventListener("DOMContentLoaded", function () {
    if (!$(".support-layout")) return;
    renderLists();
    initTabs();
    $$("form[data-kind]").forEach(initForm);

    var clearBtn = $("#history-clear");
    if (clearBtn) {
      clearBtn.addEventListener("click", function () {
        try { window.localStorage.removeItem(HISTORY_KEY); } catch (e) { /* ignore */ }
        renderHistory();
      });
    }
    renderHistory();

    document.addEventListener("i18n:change", function () {
      renderLists();
      renderHistory();
      refreshResult();
    });
  });
})();
