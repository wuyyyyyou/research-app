const TOOL_ID = "tool-test-researcher-12345678";
const TOOL_METHOD = "research";

const $ = (sel) => document.querySelector(sel);

const els = {
  query: $("#query-input"),
  domains: $("#domains-input"),
  start: $("#start-btn"),
  advance: $("#advance-btn"),
  conn: $("#conn-status"),
  stage: $("#stage-label"),
  sources: $("#source-label"),
  fill: $("#progress-fill"),
  message: $("#message"),
  report: $("#report"),
  sourceList: $("#sources-list"),
};

let anna = null;
let currentJob = null;
let polling = false;

async function init() {
  bind();
  try {
    if (typeof AnnaAppRuntime === "undefined") throw new Error("AnnaAppRuntime SDK not loaded");
    anna = await AnnaAppRuntime.connect();
    setConnection("Connected");
  } catch (err) {
    console.warn("[anna-researcher] standalone mode:", err?.message || err);
    setConnection("Standalone");
  }
}

function bind() {
  els.start.addEventListener("click", () => startResearch());
  els.advance.addEventListener("click", () => advanceOnce());
}

async function callResearch(action, extra = {}) {
  if (!anna) {
    throw new Error("Anna runtime is not connected");
  }
  return await anna.tools.invoke({
    tool_id: TOOL_ID,
    method: TOOL_METHOD,
    args: { action, ...extra },
  });
}

async function startResearch() {
  const query = els.query.value.trim();
  if (!query) {
    setMessage("Enter a research query.", true);
    return;
  }
  setBusy(true);
  clearResult();
  try {
    const result = await callResearch("start", {
      query,
      query_domains: parseDomains(els.domains.value),
    });
    applyStatus(result.job);
    currentJob = result.job;
    els.advance.disabled = false;
    void runPollingLoop();
  } catch (err) {
    setMessage(errorMessage(err), true);
  } finally {
    setBusy(false);
  }
}

async function advanceOnce() {
  if (!currentJob?.research_id) return;
  setBusy(true);
  try {
    const result = await callResearch("advance", { research_id: currentJob.research_id });
    applyStatus(result.job);
    currentJob = result.job;
    if (currentJob.status === "completed") {
      await loadResult();
    }
  } catch (err) {
    setMessage(errorMessage(err), true);
  } finally {
    setBusy(false);
  }
}

async function runPollingLoop() {
  if (polling) return;
  polling = true;
  try {
    while (currentJob && !["completed", "failed", "cancelled"].includes(currentJob.status)) {
      await advanceOnce();
      await wait(900);
    }
  } finally {
    polling = false;
  }
}

async function loadResult() {
  const result = await callResearch("get_result", { research_id: currentJob.research_id });
  renderResult(result.result);
  els.advance.disabled = true;
}

function applyStatus(job) {
  if (!job) return;
  currentJob = job;
  els.stage.textContent = `${job.status || "unknown"} · ${job.stage || "unknown"}`;
  els.sources.textContent = `${job.source_count || 0} sources`;
  els.fill.style.width = `${Math.max(0, Math.min(100, job.progress || 0))}%`;
  if (job.error) {
    setMessage(job.error.message || "Research failed.", true);
  } else if (job.status === "completed") {
    setMessage("Research complete.");
  } else {
    setMessage(stageMessage(job));
  }
}

function renderResult(result) {
  els.report.classList.remove("empty");
  els.report.innerHTML = markdownToHtml(result.report_markdown || "");
  els.sourceList.innerHTML = "";
  for (const url of result.source_urls || []) {
    const li = document.createElement("li");
    const a = document.createElement("a");
    a.href = url;
    a.target = "_blank";
    a.rel = "noreferrer";
    a.textContent = url;
    li.appendChild(a);
    els.sourceList.appendChild(li);
  }
}

function clearResult() {
  els.report.classList.add("empty");
  els.report.textContent = "The report will appear here.";
  els.sourceList.innerHTML = "";
}

function parseDomains(value) {
  return value.split(",").map((item) => item.trim()).filter(Boolean);
}

function markdownToHtml(markdown) {
  const escaped = escapeHtml(markdown);
  return escaped
    .replace(/^### (.*)$/gm, "<h3>$1</h3>")
    .replace(/^## (.*)$/gm, "<h2>$1</h2>")
    .replace(/^# (.*)$/gm, "<h1>$1</h1>")
    .replace(/^\- (.*)$/gm, "<li>$1</li>")
    .replace(/\n\n/g, "</p><p>")
    .replace(/^(.*)$/s, "<p>$1</p>")
    .replace(/<p><h/g, "<h")
    .replace(/<\/h([123])><\/p>/g, "</h$1>");
}

function escapeHtml(text) {
  return String(text || "").replace(/[&<>"']/g, (ch) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  }[ch]));
}

function stageMessage(job) {
  const stage = job.stage || "idle";
  if (stage === "select_role") return "Selecting the research role.";
  if (stage === "plan_queries") return "Planning bounded search queries.";
  if (stage === "search_next_query") return `Searching ${job.search_index || 0}/${job.search_total || "?"}.`;
  if (stage === "select_context") return "Selecting context.";
  if (stage === "write_report") return "Writing the report.";
  return "Ready.";
}

function setConnection(label) {
  els.conn.textContent = label;
  els.conn.dataset.connected = label === "Connected" ? "true" : "false";
}

function setMessage(message, isError = false) {
  els.message.textContent = message;
  els.message.dataset.error = isError ? "true" : "false";
}

function setBusy(isBusy) {
  els.start.disabled = isBusy;
  els.advance.disabled = isBusy || !currentJob || ["completed", "failed", "cancelled"].includes(currentJob.status);
}

function errorMessage(err) {
  return err?.message || String(err || "Unknown error");
}

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

document.addEventListener("DOMContentLoaded", init);

