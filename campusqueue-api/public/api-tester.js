import { groups } from "./api-tester-examples.js";

const byId = (id) => document.getElementById(id);
const catalog = byId("catalog");
const search = byId("search");
const dialog = byId("request-dialog");
const query = byId("query");
const token = byId("token");
const body = byId("body");
const send = byId("send");
const simulate = byId("simulate");
const status = byId("response-status");
const responseCheck = byId("response-check");
const output = byId("response-body");
const download = byId("download");
const clearSession = byId("clear-session");
const pretty = (value) => JSON.stringify(value, null, 2);
const exampleText = (example) => typeof example === "string" ? example : pretty(example);

let endpoint;
let request;
let session;
let responseFile;

byId("origin").textContent = location.origin;

function add(parent, tag, className, content) {
  const element = document.createElement(tag);
  element.className = className;
  if (content !== undefined) element.textContent = content;
  parent.append(element);
  return element;
}

function renderCatalog() {
  const words = search.value.toLowerCase().trim().split(/\s+/);
  catalog.replaceChildren();
  for (const group of groups) {
    const matches = group.endpoints.filter((item) => {
      const text = [
        group.name, item.name, item.method, item.path, item.access, item.query, item.body?.action,
      ].join(" ").toLowerCase();
      return words.every((word) => text.includes(word));
    });
    if (!matches.length) continue;

    const section = add(catalog, "section", "endpoint-group");
    add(section, "h2", "group-title", group.name);
    for (const item of matches) {
      const row = add(section, "button", "endpoint");
      row.type = "button";
      row.setAttribute("aria-label", `Test ${item.method} ${item.path}, ${item.name}, ${group.name}`);
      row.addEventListener("click", () => openRequest(item));

      const input = add(row, "span", "example");
      const route = add(input, "span", "route");
      add(route, "span", `method ${item.method.toLowerCase()}`, item.method);
      add(route, "code", "", item.path);
      add(route, "span", "access", item.access);
      add(input, "span", "operation", item.name);
      if (item.query) add(input, "code", "query-example", `?${item.query}`);
      add(input, "code", "snippet", item.body ? exampleText(item.body) : "No request body");

      const result = add(row, "span", "example");
      const expected = add(result, "span", "expected-heading");
      add(expected, "span", "mobile-label", "Expected response");
      add(expected, "span", "expected-code", "200");
      add(result, "code", "snippet", exampleText(item.response));
      add(row, "span", "arrow", "→").setAttribute("aria-hidden", "true");
    }
  }
  byId("empty").hidden = catalog.childElementCount > 0;
}

function setSession(value) {
  session = value;
  byId("session-status").textContent = session
    ? `Session loaded${session.role ? ` · ${session.role}` : ""}`
    : "No session";
  clearSession.hidden = !session;
}

function resetResponse(message, kind = "") {
  status.textContent = message;
  status.className = kind;
  output.textContent = "";
  output.hidden = true;
  responseCheck.hidden = true;
  download.hidden = true;
  responseFile = undefined;
}

function openRequest(item) {
  request?.abort();
  request = undefined;
  endpoint = item;
  byId("request-title").textContent = item.name;
  byId("request-route").textContent = `${item.method} ${item.path} · ${item.access}`;
  query.value = item.query ?? "";
  const tokenRequired = !["Public", "Refresh token"].includes(item.access);
  byId("token-field").hidden = !tokenRequired;
  token.value = tokenRequired ? session?.idToken ?? "" : "";
  byId("body-field").hidden = item.method === "GET";
  byId("body-label").textContent = item.requestType === "text/csv" ? "Request body (CSV)" : "Request body (JSON)";
  const example = item.path === "/api/session" && session?.refreshToken
    ? { refreshToken: session.refreshToken }
    : item.body;
  body.value = example ? exampleText(example) : "";
  byId("request-note").textContent = item.writes ? "Sending this request can change backend data." : "";
  byId("expected").textContent = exampleText(item.response);
  const note = byId("response-note");
  note.textContent = item.responseNote ?? "";
  note.hidden = !note.textContent;
  resetResponse("Ready to send");
  setPending(false);
  dialog.showModal();
}

function setPending(pending) {
  for (const field of [query, token, body, send, simulate]) field.disabled = pending;
  send.textContent = pending ? "Sending…" : "Send request";
}

function requestOptions() {
  const headers = new Headers();
  const options = { method: endpoint.method, headers, redirect: "error", cache: "no-store" };
  const idToken = token.value.trim().replace(/^Bearer\s+/i, "");
  if (idToken) headers.set("Authorization", `Bearer ${idToken}`);

  if (endpoint.method !== "GET") {
    const requestType = endpoint.requestType ?? "application/json";
    if (requestType === "application/json") {
      try {
        const value = JSON.parse(body.value);
        if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error();
      } catch {
        throw new Error("Enter a valid JSON object in the request body.");
      }
    }
    headers.set("Content-Type", requestType);
    options.body = body.value;
  }
  return options;
}

async function sendRequest(event) {
  event.preventDefault();
  if (request) return;

  let options;
  try {
    options = requestOptions();
  } catch (error) {
    resetResponse(error.message, "error");
    return;
  }

  const current = new AbortController();
  request = current;
  const timeout = setTimeout(() => current.abort(), 30_000);
  const url = new URL(endpoint.path, location.origin);
  url.search = new URLSearchParams(query.value.trim()).toString();
  const started = performance.now();
  setPending(true);
  resetResponse("Sending request…");

  try {
    const response = await fetch(url, { ...options, signal: current.signal });
    const type = response.headers.get("content-type")?.split(";")[0];
    const isFile = type === "application/pdf" || type === "text/csv";
    const file = isFile ? await response.blob() : undefined;
    const raw = type === "application/pdf" ? "" : file ? await file.text() : await response.text();
    if (request !== current || !dialog.open) return;

    let data;
    try {
      data = JSON.parse(raw);
    } catch {
      // Plain-text and binary responses do not have a JSON body.
    }

    if (response.ok && endpoint.sessionResponse && data?.idToken && data?.refreshToken) {
      setSession({ idToken: data.idToken, refreshToken: data.refreshToken, role: data.role ?? session?.role });
      if (endpoint.path === "/api/password") token.value = data.idToken;
      if (endpoint.path === "/api/session") body.value = pretty({ refreshToken: data.refreshToken });
    }

    const elapsed = Math.round(performance.now() - started);
    status.textContent = `${response.status} ${response.statusText} · ${elapsed} ms`.replace("  ·", " ·");
    const expectedType = endpoint.responseType ?? "application/json";
    const matches = response.status === 200 && type === expectedType;
    status.className = matches ? "success" : "error";
    responseCheck.textContent = matches
      ? `HTTP status and content type match (200 · ${expectedType}).`
      : `Expected 200 · ${expectedType}. Received ${response.status} · ${type || "no content type"}.`;
    responseCheck.hidden = false;
    output.textContent = type === "application/pdf" ? `PDF · ${file.size.toLocaleString()} bytes`
      : (data === undefined ? raw : pretty(data)) || "(empty response)";
    output.hidden = false;
    if (file) {
      responseFile = file;
      download.hidden = false;
    }
  } catch {
    if (request === current && dialog.open) {
      resetResponse(current.signal.aborted ? "Request timed out." : "Could not reach the API.", "error");
    }
  } finally {
    clearTimeout(timeout);
    if (request === current) {
      request = undefined;
      setPending(false);
    }
  }
}

search.addEventListener("input", renderCatalog);
byId("request-form").addEventListener("submit", sendRequest);
simulate.addEventListener("click", () => {
  if (request) return;
  resetResponse("Simulated 200 OK", "success");
  responseCheck.textContent = "Sample response. No request was sent.";
  responseCheck.hidden = false;
  output.textContent = exampleText(endpoint.response);
  output.hidden = false;
});
byId("close-dialog").addEventListener("click", () => dialog.close());
dialog.addEventListener("close", () => {
  if (dialog.open) return;
  request?.abort();
  request = undefined;
  token.value = "";
  body.value = "";
  resetResponse("Ready to send");
});
clearSession.addEventListener("click", () => {
  setSession(undefined);
  search.focus();
});
download.addEventListener("click", () => {
  if (!responseFile) return;
  const link = document.createElement("a");
  link.href = URL.createObjectURL(responseFile);
  link.download = `campusqueue-response.${responseFile.type === "application/pdf" ? "pdf" : "csv"}`;
  link.click();
  setTimeout(() => URL.revokeObjectURL(link.href), 1000);
});

renderCatalog();
