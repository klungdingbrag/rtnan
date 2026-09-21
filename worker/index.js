const GAS_API_URL = "https://script.google.com/macros/s/AKfycbzlkObP01zJ_Wge9TJLFcF5CNrrsMtS7SUy7t2ij7N-Udtcz3W1dnFsDG1pD3SDSq62Sg/exec";
const ALLOWED_ORIGIN = "https://klungdingbrag.github.io";

function corsHeaders(origin) {
  const allowed = origin === ALLOWED_ORIGIN ? origin : ALLOWED_ORIGIN;
  return {
    "Access-Control-Allow-Origin": allowed,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Max-Age": "86400",
    "Vary": "Origin"
  };
}

function json(data, status = 200, origin = ALLOWED_ORIGIN) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json; charset=UTF-8",
      ...corsHeaders(origin)
    }
  });
}

export default {
  async fetch(request) {
    const origin = request.headers.get("Origin") || "";

    if (request.method === "OPTIONS") {
      if (origin !== ALLOWED_ORIGIN) {
        return new Response(null, { status: 403 });
      }
      return new Response(null, {
        status: 204,
        headers: corsHeaders(origin)
      });
    }

    if (origin && origin !== ALLOWED_ORIGIN) {
      return json({ success: false, message: "Origin tidak diizinkan." }, 403, origin);
    }

    if (request.method !== "POST") {
      return json({
        success: false,
        message: "Method tidak diizinkan. Gunakan POST."
      }, 405, origin);
    }

    try {
      const body = await request.arrayBuffer();

      const upstreamHeaders = new Headers();
      const contentType = request.headers.get("Content-Type");
      if (contentType) {
        upstreamHeaders.set("Content-Type", contentType);
      }
      upstreamHeaders.set("Accept", "application/json");

      const upstreamRequest = new Request(GAS_API_URL, {
        method: "POST",
        headers: upstreamHeaders,
        body
      });

      const upstream = await fetch(upstreamRequest, {
        redirect: "follow",
        cache: "no-store"
      });

      const text = await upstream.text();

      return new Response(text, {
        status: upstream.status,
        headers: {
          "Content-Type": upstream.headers.get("Content-Type") || "application/json; charset=UTF-8",
          ...corsHeaders(origin)
        }
      });
    } catch (error) {
      return json({
        success: false,
        message: "API Gateway gagal menghubungi Google Apps Script.",
        error: String(error && error.message ? error.message : error)
      }, 502, origin);
    }
  }
};
