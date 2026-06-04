/**
 * App Debug Collector
 *
 * Captures:
 * 1) Console logs
 * 2) Network request summaries
 * 3) Basic UI events
 *
 * Recommended for development only.
 */
(function () {
  "use strict";

  // Run only in local development
  var isLocalhost =
    window.location.hostname === "localhost" ||
    window.location.hostname === "127.0.0.1";

  if (!isLocalhost) return;

  // Prevent double initialization
  if (window.__SAJA_DEBUG_COLLECTOR__) return;

  const CONFIG = {
    reportEndpoint: "/api/debug/logs",
    bufferSize: {
      console: 200,
      network: 100,
      ui: 150,
    },
    reportInterval: 3000,
    sensitiveFields: [
      "password",
      "token",
      "secret",
      "key",
      "authorization",
      "cookie",
      "session",
    ],
    maxBodyLength: 3000,
    uiTextMaxLen: 60,
  };

  const store = {
    consoleLogs: [],
    networkRequests: [],
    uiEvents: [],
  };

  function pruneBuffer(buffer, maxSize) {
    if (buffer.length > maxSize) {
      buffer.splice(0, buffer.length - maxSize);
    }
  }

  function sanitizeValue(value, depth) {
    if (depth === void 0) depth = 0;
    if (depth > 4) return "[Max Depth]";
    if (value == null) return value;

    if (typeof value === "string") {
      return value.length > 500 ? value.slice(0, 500) + "...[truncated]" : value;
    }

    if (typeof value !== "object") return value;

    if (Array.isArray(value)) {
      return value.slice(0, 50).map(function (item) {
        return sanitizeValue(item, depth + 1);
      });
    }

    var output = {};
    for (var key in value) {
      if (!Object.prototype.hasOwnProperty.call(value, key)) continue;

      var isSensitive = CONFIG.sensitiveFields.some(function (field) {
        return key.toLowerCase().indexOf(field) !== -1;
      });

      output[key] = isSensitive
        ? "[REDACTED]"
        : sanitizeValue(value[key], depth + 1);
    }

    return output;
  }

  function formatArg(arg) {
    try {
      if (arg instanceof Error) {
        return {
          type: "Error",
          message: arg.message,
          stack: arg.stack || null,
        };
      }

      if (typeof arg === "object") return sanitizeValue(arg);
      return String(arg);
    } catch (error) {
      return "[Unserializable]";
    }
  }

  function describeElement(el) {
    if (!el || !(el instanceof Element)) return null;

    var tag = el.tagName ? el.tagName.toLowerCase() : null;
    var id = el.id || null;
    var name = el.getAttribute("name") || null;
    var text = (el.innerText || el.textContent || "").trim().replace(/\s+/g, " ");
    if (text.length > CONFIG.uiTextMaxLen) {
      text = text.slice(0, CONFIG.uiTextMaxLen) + "…";
    }

    return {
      tag: tag,
      id: id,
      name: name,
      text: text || "",
    };
  }

  function logUiEvent(kind, payload) {
    store.uiEvents.push({
      timestamp: Date.now(),
      kind: kind,
      url: window.location.href,
      payload: sanitizeValue(payload),
    });

    pruneBuffer(store.uiEvents, CONFIG.bufferSize.ui);
  }

  document.addEventListener(
    "click",
    function (event) {
      logUiEvent("click", {
        target: describeElement(event.target),
        x: event.clientX,
        y: event.clientY,
      });
    },
    true
  );

  document.addEventListener(
    "submit",
    function (event) {
      logUiEvent("submit", {
        target: describeElement(event.target),
      });
    },
    true
  );

  window.addEventListener("error", function (event) {
    store.consoleLogs.push({
      timestamp: Date.now(),
      level: "ERROR",
      args: [
        {
          message: event.message,
          filename: event.filename,
          lineno: event.lineno,
          colno: event.colno,
        },
      ],
    });

    pruneBuffer(store.consoleLogs, CONFIG.bufferSize.console);
  });

  var originalConsole = {
    log: console.log.bind(console),
    info: console.info.bind(console),
    warn: console.warn.bind(console),
    error: console.error.bind(console),
    debug: console.debug.bind(console),
  };

  ["log", "info", "warn", "error", "debug"].forEach(function (method) {
    console[method] = function () {
      var args = Array.prototype.slice.call(arguments);

      store.consoleLogs.push({
        timestamp: Date.now(),
        level: method.toUpperCase(),
        args: args.map(formatArg),
      });

      pruneBuffer(store.consoleLogs, CONFIG.bufferSize.console);
      originalConsole[method].apply(console, args);
    };
  });

  var originalFetch = window.fetch.bind(window);

  window.fetch = function (input, init) {
    init = init || {};
    var startTime = Date.now();
    var url =
      typeof input === "string"
        ? input
        : (input && (input.url || input.href || String(input))) || "";

    var method = (init.method || (input && input.method) || "GET").toUpperCase();

    if (url.indexOf(CONFIG.reportEndpoint) === 0) {
      return originalFetch(input, init);
    }

    return originalFetch(input, init)
      .then(function (response) {
        store.networkRequests.push({
          timestamp: startTime,
          type: "fetch",
          method: method,
          url: url,
          response: {
            status: response.status,
            statusText: response.statusText,
          },
          duration: Date.now() - startTime,
        });

        pruneBuffer(store.networkRequests, CONFIG.bufferSize.network);
        return response;
      })
      .catch(function (error) {
        store.networkRequests.push({
          timestamp: startTime,
          type: "fetch",
          method: method,
          url: url,
          error: {
            message: error.message,
          },
          duration: Date.now() - startTime,
        });

        pruneBuffer(store.networkRequests, CONFIG.bufferSize.network);
        throw error;
      });
  };

  function reportLogs() {
    if (
      store.consoleLogs.length === 0 &&
      store.networkRequests.length === 0 &&
      store.uiEvents.length === 0
    ) {
      return Promise.resolve();
    }

    var payload = {
      timestamp: Date.now(),
      consoleLogs: store.consoleLogs.splice(0),
      networkRequests: store.networkRequests.splice(0),
      uiEvents: store.uiEvents.splice(0),
    };

    return originalFetch(CONFIG.reportEndpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    }).catch(function () {
      // Ignore reporting failure in local debug mode
    });
  }

  setInterval(reportLogs, CONFIG.reportInterval);

  window.__SAJA_DEBUG_COLLECTOR__ = {
    version: "1.0.0",
    store: store,
    forceReport: reportLogs,
  };

  console.debug("[App Debug] Collector initialized");
})();