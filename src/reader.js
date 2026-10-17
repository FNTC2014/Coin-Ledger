// Reads invoices, receipts and slab labels with Claude, using the Anthropic API key saved in Settings.
// The key stays on this device. Each read is billed to that Anthropic account.
(function readerModule() {
  "use strict";
  const KEY = "coinledger:apiKey", MODEL = "coinledger:model";
  const MODELS = {
    sonnet: { id: "claude-sonnet-5-5", label: "Sonnet 5.5", note: "Most accurate. About 2¢ US for an invoice photo." },
    haiku: { id: "claude-haiku-5-5", label: "Haiku 5.5", note: "Cheapest. A fraction of a cent a read." }
  };
  const get = (k) => { try { return localStorage.getItem(k) || ""; } catch (e) { return ""; } };
  const set = (k, v) => { try { if (v) localStorage.setItem(k, v); else localStorage.removeItem(k); } catch (e) { /* ignore */ } };
  const b64 = (blob) => new Promise((res, rej) => {
    const r = new FileReader();
    r.onload = () => res(String(r.result).split(",")[1] || "");
    r.onerror = () => rej(r.error);
    r.readAsDataURL(blob);
  });

  // The whole reply as JSON; else a fenced block; else the text from the first { or [ to the last } or ].
  function parseJSON(text) {
    const t = String(text || "").trim();
    try { return JSON.parse(t); } catch (e) { /* keep looking */ }
    const fence = t.match(/```(?:json)?\s*([\s\S]*?)```/i);
    if (fence) { try { return JSON.parse(fence[1]); } catch (e) { /* keep looking */ } }
    const a = t.search(/[[{]/), b = Math.max(t.lastIndexOf("}"), t.lastIndexOf("]"));
    if (a >= 0 && b > a) { try { return JSON.parse(t.slice(a, b + 1)); } catch (e) { /* give up */ } }
    return undefined;
  }

  function codeFor(status, err) {
    const type = (err && err.type) || "", msg = (err && err.message) || "";
    if (status === 401 || type === "authentication_error") return "bad_key";
    if (status === 403 || type === "permission_error") return "bad_key";
    if (status === 413 || type === "request_too_large") return "too_large";
    if (status === 429 || type === "rate_limit_error") return "rate_limited";
    if (status === 529 || type === "overloaded_error") return "overloaded";
    if (/credit balance/i.test(msg)) return "no_credit";
    if (status === 400) return "invalid_request";
    return "upstream_error";
  }

  async function call(content, opts) {
    const key = get(KEY);
    if (!key) throw { code: "no_key" };
    const model = (MODELS[opts.model || get(MODEL)] || MODELS.sonnet).id;
    let res;
    try {
      res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "x-api-key": key,
          "anthropic-version": "2023-06-01",
          "content-type": "application/json",
          "anthropic-dangerous-direct-browser-access": "true"
        },
        body: JSON.stringify({ model, max_tokens: opts.maxTokens || 8000, messages: [{ role: "user", content }] }),
        signal: opts.signal
      });
    } catch (e) {
      if (e && e.name === "AbortError") throw { code: "cancelled" };
      throw { code: "offline", message: String(e && e.message || e) };
    }
    let data = null;
    try { data = await res.json(); } catch (e) { data = null; }
    if (!res.ok) throw { code: codeFor(res.status, data && data.error), message: data && data.error && data.error.message };
    const text = ((data && data.content) || []).filter((b) => b.type === "text").map((b) => b.text).join("");
    if (!text.trim()) throw { code: "empty_completion" };
    return { text, truncated: data.stop_reason === "max_tokens" };
  }

  // Same shape as the ledger page's Claude call: json(prompt, {images, pdfs, signal}) resolves the parsed reply.
  async function json(prompt, opts) {
    opts = opts || {};
    const content = [];
    for (const p of opts.pdfs || []) content.push({ type: "document", source: { type: "base64", media_type: "application/pdf", data: await b64(p) } });
    for (const img of opts.images || []) content.push({ type: "image", source: { type: "base64", media_type: img.type || "image/jpeg", data: await b64(img) } });
    content.push({ type: "text", text: prompt + "\n\nReply with only the JSON object, no other text." });
    if (opts.signal && opts.signal.aborted) throw { code: "cancelled" };
    const { text } = await call(content, opts);
    const v = parseJSON(text);
    if (v === undefined) throw { code: "invalid_json", text };
    return v;
  }

  async function check(key) {
    const old = get(KEY);
    if (key) set(KEY, key);
    try {
      await call([{ type: "text", text: "Reply with the word OK." }], { model: "haiku", maxTokens: 10 });
      return true;
    } finally {
      if (key && !old) set(KEY, ""); else if (key) set(KEY, old);
    }
  }

  window.LedgerReader = {
    json, check, parseJSON, MODELS,
    hasKey: () => !!get(KEY),
    getKey: () => get(KEY),
    setKey: (v) => set(KEY, String(v || "").trim()),
    getModel: () => (MODELS[get(MODEL)] ? get(MODEL) : "sonnet"),
    setModel: (v) => set(MODEL, MODELS[v] ? v : "sonnet")
  };
})();
