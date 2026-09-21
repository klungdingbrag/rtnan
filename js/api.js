// =============================================================
// RTNAN FRONTEND API CLIENT
// GitHub Pages -> Google Apps Script Web App -> Google Sheets
//
// Public read:
//   JSONP GET (read-only)
//
// Admin/login/write:
//   cross-origin form POST -> Apps Script -> Script Cache
//   -> JSONP polling for the result
//
// Tidak memakai Worker, proxy, iframe bridge, atau fetch CORS.
// =============================================================

const GAS_API_URL = "https://script.google.com/macros/s/AKfycbzlkObP01zJ_Wge9TJLFcF5CNrrsMtS7SUy7t2ij7N-Udtcz3W1dnFsDG1pD3SDSq62Sg/exec";
const API_CLIENT_BUILD = "20260921-04";

console.info("[KAS RT] API client:", API_CLIENT_BUILD);

function createRequestId() {
  if (window.crypto && typeof window.crypto.randomUUID === "function") {
    return window.crypto.randomUUID().replace(/-/g, "");
  }

  const bytes = new Uint8Array(24);
  if (window.crypto && typeof window.crypto.getRandomValues === "function") {
    window.crypto.getRandomValues(bytes);
    return Array.from(bytes, b => b.toString(16).padStart(2, "0")).join("");
  }

  return (
    Date.now().toString(36) +
    "_" +
    Math.random().toString(36).slice(2) +
    "_" +
    Math.random().toString(36).slice(2)
  );
}

function normalizeApiResponse(response) {
  const outer = response || {};

  // JSONP/relay wrapper:
  // { success:true, result:{ success:true, data:... } }
  if (
    outer.result &&
    typeof outer.result === "object" &&
    outer.result.success !== undefined
  ) {
    return outer.result;
  }

  return outer;
}

function validateApiResponse(response) {
  const result = normalizeApiResponse(response);

  if (!result || result.success !== true) {
    throw new Error(
      (result && result.message) ||
      (response && response.message) ||
      "API request gagal."
    );
  }

  return result;
}

// -------------------------------------------------------------
// PUBLIC READ TRANSPORT
// -------------------------------------------------------------
function apiRequestJsonp(action, params = {}) {
  return new Promise((resolve, reject) => {
    const callbackName =
      "__rtnan_" +
      Date.now() +
      "_" +
      Math.random().toString(36).slice(2);

    const script = document.createElement("script");
    const payload = JSON.stringify({
      action,
      ...params
    });

    let finished = false;

    function cleanup() {
      if (script.parentNode) {
        script.parentNode.removeChild(script);
      }

      try {
        delete window[callbackName];
      } catch (_) {
        window[callbackName] = undefined;
      }
    }

    const timer = setTimeout(() => {
      if (finished) return;

      finished = true;
      cleanup();
      reject(new Error("API timeout. Apps Script tidak merespons."));
    }, 15000);

    window[callbackName] = function(response) {
      if (finished) return;

      finished = true;
      clearTimeout(timer);
      cleanup();

      try {
        resolve(validateApiResponse(response));
      } catch (err) {
        reject(err);
      }
    };

    script.onerror = function() {
      if (finished) return;

      finished = true;
      clearTimeout(timer);
      cleanup();
      reject(new Error("Gagal menghubungi Google Apps Script."));
    };

    script.src =
      GAS_API_URL +
      "?api=1" +
      "&prefix=" +
      encodeURIComponent(callbackName) +
      "&payload=" +
      encodeURIComponent(payload) +
      "&_=" +
      Date.now();

    document.head.appendChild(script);
  });
}

// -------------------------------------------------------------
// WRITE/ADMIN TRANSPORT
// -------------------------------------------------------------
// Form POST adalah cross-origin write yang browser izinkan tanpa
// perlu CORS preflight. Response POST tidak dibaca oleh browser.
// Apps Script menyimpan hasil ke Script Cache, lalu kita polling
// hasilnya menggunakan JSONP.
function apiPostRelay(payload) {
  const requestId = createRequestId();

  const iframe = document.createElement("iframe");
  iframe.name = "rtnan_relay_" + requestId;
  iframe.setAttribute("aria-hidden", "true");
  iframe.style.position = "fixed";
  iframe.style.width = "1px";
  iframe.style.height = "1px";
  iframe.style.left = "-10000px";
  iframe.style.top = "-10000px";
  iframe.style.border = "0";
  iframe.style.opacity = "0";
  iframe.style.pointerEvents = "none";

  const form = document.createElement("form");
  form.method = "POST";
  form.action = GAS_API_URL;
  form.target = iframe.name;
  form.style.display = "none";

  const payloadInput = document.createElement("input");
  payloadInput.type = "hidden";
  payloadInput.name = "payload";
  payloadInput.value = JSON.stringify(payload);

  const requestIdInput = document.createElement("input");
  requestIdInput.type = "hidden";
  requestIdInput.name = "requestId";
  requestIdInput.value = requestId;

  form.appendChild(payloadInput);
  form.appendChild(requestIdInput);

  document.body.appendChild(iframe);
  document.body.appendChild(form);

  // Submit setelah elemen target tersedia.
  form.submit();

  return pollRelayResult(requestId)
    .finally(() => {
      setTimeout(() => {
        if (form.parentNode) form.parentNode.removeChild(form);
        if (iframe.parentNode) iframe.parentNode.removeChild(iframe);
      }, 500);
    });
}

function pollRelayResult(requestId) {
  const startedAt = Date.now();
  const timeoutMs = 20000;
  const intervalMs = 250;

  return new Promise((resolve, reject) => {
    let stopped = false;

    function poll() {
      if (stopped) return;

      if (Date.now() - startedAt > timeoutMs) {
        stopped = true;
        reject(new Error("API timeout setelah 20 detik."));
        return;
      }

      const callbackName =
        "__rtnan_poll_" +
        Date.now() +
        "_" +
        Math.random().toString(36).slice(2);

      const script = document.createElement("script");
      let callbackFinished = false;

      function cleanup() {
        if (script.parentNode) {
          script.parentNode.removeChild(script);
        }

        try {
          delete window[callbackName];
        } catch (_) {
          window[callbackName] = undefined;
        }
      }

      const timer = setTimeout(() => {
        if (callbackFinished) return;

        callbackFinished = true;
        cleanup();
        setTimeout(poll, intervalMs);
      }, 5000);

      window[callbackName] = function(response) {
        if (callbackFinished) return;

        callbackFinished = true;
        clearTimeout(timer);
        cleanup();

        if (response && response.pending) {
          setTimeout(poll, intervalMs);
          return;
        }

        stopped = true;

        try {
          resolve(validateApiResponse(response));
        } catch (err) {
          reject(err);
        }
      };

      script.onerror = function() {
        if (callbackFinished) return;

        callbackFinished = true;
        clearTimeout(timer);
        cleanup();
        setTimeout(poll, intervalMs);
      };

      script.src =
        GAS_API_URL +
        "?api=1" +
        "&poll=1" +
        "&requestId=" +
        encodeURIComponent(requestId) +
        "&prefix=" +
        encodeURIComponent(callbackName) +
        "&_=" +
        Date.now();

      document.head.appendChild(script);
    }

    poll();
  });
}

// -------------------------------------------------------------
// UNIFIED API
// -------------------------------------------------------------
async function apiRequest(action, params = {}) {
  const publicActions = new Set([
    "health",
    "getDashboardData"
  ]);

  const startedAt = performance.now();

  let result;

  if (publicActions.has(action)) {
    result = await apiRequestJsonp(action, params);
  } else {
    result = await apiPostRelay({
      action,
      ...params
    });
  }

  console.debug(
    "[KAS RT API]",
    action,
    Math.round(performance.now() - startedAt) + " ms"
  );

  return result;
}
