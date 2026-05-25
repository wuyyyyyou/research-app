# GPT Researcher Anna Adaptation

This context describes the language for adapting GPT Researcher into an Anna App while preserving the research engine as a reusable capability.

## Language

**Anna App Adapter MVP**:
The first migration slice: a minimal Anna App shell and Executa wrapper around the existing GPT Researcher engine, proving the end-to-end Anna invocation path before replacing deeper internals. It intentionally does not mean a full feature-equivalent rewrite of the original FastAPI/WebSocket app.
_Avoid_: Full migration, rewrite, final Anna-native app

**GPT Researcher Engine**:
The existing Python research core that plans research, gathers sources, builds context, and writes a report. One Anna App Adapter MVP uses one engine invocation to produce one research result.
_Avoid_: Backend, server

**Executa Wrapper**:
The Anna stdio tool process that exposes the GPT Researcher Engine through JSON-RPC tool methods. It is a wrapper around the engine, not the engine itself.
_Avoid_: FastAPI backend, web server

**Anna App Shell**:
The static SPA bundle loaded by Anna App Runtime to collect user input and display research results. It communicates through Anna host APIs rather than directly calling GPT Researcher's original HTTP/WebSocket endpoints.
_Avoid_: Original frontend, FastAPI static site

**Async Research Job**:
A research run that starts in one Executa invocation and is observed by later invocations using a research identifier. One Anna App Adapter MVP can have many Async Research Jobs over time, and each job eventually produces one Research Result or a failure.
_Avoid_: Synchronous run, blocking report generation

**Research Result**:
The completed output of an Async Research Job, including the report text and selected metadata such as source URLs and costs. It is the user-facing product of the GPT Researcher Engine.
_Avoid_: Raw logs, internal context

**Executa Local Job Store**:
The local storage owned by the Executa Wrapper for tracking Async Research Jobs and their Research Results. The Anna App Shell reads it only through tool methods, not by accessing files directly.
_Avoid_: Anna App Storage, browser storage, FastAPI report store

**Research Tool Dispatcher**:
The single tool method exposed by the Executa Wrapper for managing research actions such as starting a job, checking status, and reading a result. It uses an action parameter rather than separate tool methods for each operation.
_Avoid_: Multiple research tools, endpoint-style tool methods

**Single Active Job**:
The MVP concurrency rule that one Executa Wrapper runs at most one Async Research Job at a time. A new start request while another job is running reports the current job instead of launching another.
_Avoid_: Unlimited jobs, parallel research runs

**Anna Sampling LLM**:
The Anna-hosted LLM path used by the Executa Wrapper through protocol v2 sampling. It makes the Anna host responsible for model routing, billing, and quota instead of requiring the wrapper to own an external LLM API key.
_Avoid_: External LLM, plugin-owned OpenAI key

**Research Report Only**:
The MVP report-type boundary where the adapter supports only the standard research report and excludes detailed, deep, resource, outline, and multi-agent reports. It keeps the first Anna Sampling LLM integration on the main report path.
_Avoid_: Full report type parity

**Web Research Sources**:
The MVP source boundary where research uses web search plus optional domain filtering. It excludes user-provided source URLs, local documents, hybrid document search, Azure storage, and Anna file ingestion.
_Avoid_: Source URL ingestion, local documents, hybrid sources, Azure sources

**Tavily Required Credential**:
The MVP search boundary where web retrieval depends on a Tavily API key supplied to the Executa Wrapper through credentials or local environment fallback. Without that credential, starting an Async Research Job is a configuration error.
_Avoid_: Anonymous search fallback, retriever picker

**LLM Boundary Adapter**:
The MVP integration point where Anna Sampling LLM is connected at the GPT Researcher Engine's chat-completion boundary, keeping the original report flow mostly intact while replacing external model calls. It is narrower than a full LangChain provider and broader than an environment-variable proxy.
_Avoid_: Full LLM provider rewrite, OpenAI-compatible proxy

**Minimal Research Result**:
The MVP shape of a Research Result: the completed markdown report, source URL evidence, job status, failure summary when relevant, and basic timestamps. It excludes generated document exports and full internal research context from the default user-facing result.
_Avoid_: File export bundle, debug context dump

**Polling Job Observation**:
The MVP communication pattern where the Anna App Shell starts an Async Research Job and then repeatedly invokes the Research Tool Dispatcher to read status or result. It replaces the original FastAPI WebSocket progress stream for the first migration slice.
_Avoid_: WebSocket progress stream, server-sent events, direct file reads from the app

**Invoke-Advanced Research Job**:
An Async Research Job that progresses through repeated short tool invocations. Each advancement performs a bounded slice of research work and may use the current invocation's Anna Sampling LLM authorization, instead of relying on one long-running background task.
_Avoid_: Detached background research run, one invoke per full report

**Context Selector**:
The research boundary that turns collected search results into the bounded context passed to report generation. It is intentionally provider-neutral so the MVP can start without embeddings and later switch to a local or hosted embedding selector.
_Avoid_: Hard-coded embedding compressor, prompt-level result dumping

**Lexical Context Selector**:
The MVP Context Selector implementation that ranks and trims web search results using deterministic lexical signals such as keyword overlap, title matches, URL deduplication, source limits, and context budget. It avoids external embedding credentials and local model dependencies.
_Avoid_: OpenAI embedding requirement, local embedding runtime

**Anna Research Orchestrator**:
The MVP research flow owned by the Executa Wrapper. It advances an Async Research Job through Anna-compatible stages while selectively reusing GPT Researcher concepts and components, instead of directly running the original monolithic research runtime.
_Avoid_: Direct GPTResearcher runtime invocation, full backend port

**Adaptive Research Role**:
The MVP behavior where the Anna Research Orchestrator uses Anna Sampling LLM to choose a research agent role for the query before planning searches and writing the report. It is kept as an explicit advancement stage rather than hidden inside a monolithic run.
_Avoid_: Fixed-only researcher role, implicit role selection

**Bounded Query Planning**:
The MVP planning behavior where Anna Sampling LLM may generate a small structured set of search queries, while the original user query is always retained and invalid planning output falls back to the original query. It excludes iterative deep-research planning.
_Avoid_: Unbounded query expansion, deep research planning

**Tavily Summary Retrieval**:
The MVP retrieval behavior where the Anna Research Orchestrator uses Tavily search results as the source text for context selection, without independently scraping each result URL. Source URLs are preserved as evidence, while full-page extraction is deferred.
_Avoid_: Browser scraping, full-page extraction, image scraping

**Core Research Actions**:
The MVP action set for the Research Tool Dispatcher: start a job, advance the next bounded stage, read status, and read the final result. It excludes job history, cancellation, retry orchestration, and export management.
_Avoid_: Full job management API, endpoint parity

**Single-Page Research Workbench**:
The MVP Anna App Shell experience: one page for entering a research query, optionally constraining domains, observing job progress, and reading the markdown report with source URLs. It excludes report-type switching, exports, follow-up chat, history, and multi-job management.
_Avoid_: Original frontend parity, multi-report dashboard

## Example Dialogue

Developer: "For the first release, are we building the full Anna-native app?"

Domain expert: "No. Build the Anna App Adapter MVP: an Anna App Shell calls an Executa Wrapper, and the wrapper invokes the GPT Researcher Engine to return a report."

Developer: "So the original FastAPI WebSocket progress stream is not required in the MVP?"

Domain expert: "Correct. It can be replaced later after the Anna invocation path is proven."

Developer: "Should the tool block until the report is done?"

Domain expert: "No. It should create an Async Research Job and let the Anna App Shell poll for the Research Result."

Developer: "Where should the job record live in the MVP?"

Domain expert: "In the Executa Local Job Store. The UI should query it through the wrapper instead of reading files."

Developer: "Should the wrapper expose separate tools for start and status?"

Domain expert: "No. Use one Research Tool Dispatcher with an action parameter."

Developer: "Can users start several research runs in parallel?"

Domain expert: "Not in the MVP. The wrapper follows Single Active Job semantics."

Developer: "Should the MVP use the original external LLM configuration?"

Domain expert: "No. It should use Anna Sampling LLM for the core research generation path."

Developer: "Should the first version support detailed and deep reports?"

Domain expert: "No. It is Research Report Only."

Developer: "Can the MVP research local PDFs?"

Domain expert: "No. It uses Web Research Sources only."

Developer: "Should the MVP silently fall back to DuckDuckGo when Tavily is not configured?"

Domain expert: "No. Tavily is a required credential for MVP web retrieval."

Developer: "Should Anna Sampling be implemented as a full LangChain model provider first?"

Domain expert: "No. Use an LLM Boundary Adapter first so the Research Report Only path can call Anna Sampling without rewriting the whole LLM stack."

Developer: "Should the first result contract preserve the original backend's PDF, DOCX, MD, and JSON file outputs?"

Domain expert: "No. Use a Minimal Research Result first: markdown report plus source URL evidence and job metadata."

Developer: "Should the Anna App Shell receive live progress through a push channel in the MVP?"

Domain expert: "No. Use Polling Job Observation through the Research Tool Dispatcher."

Developer: "Should the MVP start a detached background process that keeps using one sampling context until the report is finished?"

Domain expert: "No. Use an Invoke-Advanced Research Job so every LLM slice runs inside a current Anna invocation."

Developer: "Should the MVP keep the original embedding-based context compression?"

Domain expert: "No. Define a Context Selector boundary and use a Lexical Context Selector first."

Developer: "Should the MVP directly run the original GPTResearcher conduct_research flow?"

Domain expert: "No. Use an Anna Research Orchestrator that reuses selected GPT Researcher assets while respecting Anna invocation and sampling constraints."

Developer: "Should the MVP skip GPT Researcher's automatic agent role selection?"

Domain expert: "No. Keep an Adaptive Research Role, but run it as a bounded Anna Research Orchestrator stage."

Developer: "Should search planning be open-ended in the MVP?"

Domain expert: "No. Use Bounded Query Planning so the Anna Research Orchestrator can keep sampling calls and retrieval work predictable."

Developer: "Should the MVP scrape every Tavily result page before context selection?"

Domain expert: "No. Use Tavily Summary Retrieval first and defer full-page extraction."

Developer: "Should the MVP expose cancellation, listing, retry, and export actions?"

Domain expert: "No. Use Core Research Actions first."

Developer: "Can the MVP accept arbitrary source URLs if it does not scrape pages?"

Domain expert: "No. Web Research Sources means web search with optional domain filtering, not source URL ingestion."

Developer: "Should the first Anna App Shell port the original GPT Researcher frontend feature set?"

Domain expert: "No. Build a Single-Page Research Workbench for the Anna App Adapter MVP."
