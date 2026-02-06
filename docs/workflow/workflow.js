const STEPS = [
  { name: "Alert", desc: "Signal detected and validated", tag: "Firing" },
  { name: "Data Collection", desc: "Metrics • Logs • Traces captured", tag: "Evidence" },
  { name: "Incident", desc: "Severity, scope, and ownership set", tag: "SEV" },
  { name: "Ticketing", desc: "Work item created + tasks assigned", tag: "Ticket" },
  { name: "Runbook", desc: "Standard mitigation applied", tag: "Stabilize" },
  { name: "RCA", desc: "Cause + contributing factors documented", tag: "Draft" },
  { name: "Ticket Close", desc: "Validation complete + closure notes", tag: "Resolved" },
  { name: "Executive Summary", desc: "Business-facing summary generated", tag: "Executive" },
];

const state = {
  idx: -1,
  playing: false,
  scenario: null,
  timer: null,
};

const $ = (s) => document.querySelector(s);

const wfMap = $("#wfMap");
const wfTimeline = $("#wfTimeline");

const statusText = $("#statusText");
const artifactTitle = $("#artifactTitle");
const artifactSub = $("#artifactSub");
const artifactBody = $("#artifactBody");
const miniPhase = $("#miniPhase");

const metaIncident = $("#metaIncident");
const metaTicket = $("#metaTicket");
const metaService = $("#metaService");
const metaRegion = $("#metaRegion");
const metaSev = $("#metaSev");
const metaAlert = $("#metaAlert");
const metaScenario = $("#metaScenario");

const btnRun = $("#btnRun");
const btnNext = $("#btnNext");
const btnReset = $("#btnReset");
const scenarioSelect = $("#scenarioSelect");

function pad(n) { return String(n).padStart(2, "0"); }
function nowStamp() {
  const d = new Date();
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}
function randPick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }

function makeScenario(type = "random") {
  const servicesByType = {
    network: ["edge-gateway", "customer-portal", "metrics-pipeline"],
    deploy: ["payments-api", "auth-service", "customer-portal"],
    dns: ["auth-service", "customer-portal", "edge-gateway"],
    cert: ["edge-gateway", "auth-service"],
    db: ["payments-api", "customer-portal"],
  };

  const regions = ["us-east-1", "us-east-2", "us-west-2", "eu-central-1"];

  const scenarios = {
    network: {
      label: "Network flap (BGP/packet loss)",
      sev: "SEV-1",
      cause: "BGP route flap on upstream provider causing intermittent packet loss",
      symptoms: [
        "p95 latency spike across multiple services",
        "502/504 bursts from edge timeouts",
        "packet loss detected on core uplink",
      ],
      actions: [
        "Validated packet loss and route changes",
        "Preferred stable path / rerouted traffic",
        "Reduced retries to prevent amplification",
      ],
      prevention: [
        "Add upstream route-change alerting",
        "Tune retry budgets + circuit breakers",
        "Add multi-path health scoring for egress",
      ],
      runbook: "Network Instability / Packet Loss",
    },

    deploy: {
      label: "Bad deploy (pool exhaustion)",
      sev: "SEV-2",
      cause: "Bad deploy introduced connection pool leak leading to exhaustion",
      symptoms: [
        "steady rise in latency and saturation",
        "error rate climbs as pool hits max",
        "slow endpoints concentrated on /checkout",
      ],
      actions: [
        "Rolled back last deploy",
        "Scaled replicas to drain backlog",
        "Raised pool limit temporarily with guardrails",
      ],
      prevention: [
        "Canary + automated rollback on saturation",
        "Load tests for pool behavior",
        "Dashboards for pool utilization & queue depth",
      ],
      runbook: "Latency + 5xx after Deploy",
    },

    dns: {
      label: "DNS latency spike",
      sev: "SEV-2",
      cause: "Misconfigured resolver causing elevated DNS lookup timeouts",
      symptoms: [
        "spikes in downstream dependency call time",
        "intermittent auth failures",
        "lookup timeouts recorded in logs",
      ],
      actions: [
        "Switched resolver to known-good configuration",
        "Reduced DNS TTL to stabilize lookups",
        "Validated success rates + p95 recovery",
      ],
      prevention: [
        "DNS SLI + alerting on lookup latency",
        "Config drift detection for resolvers",
        "Fallback resolver policy",
      ],
      runbook: "Dependency Latency / DNS",
    },

    cert: {
      label: "Certificate/PKI mismatch",
      sev: "SEV-1",
      cause: "Certificate chain mismatch after renewal causing handshake failures",
      symptoms: [
        "TLS handshake errors surged",
        "client failures in a subset of edge nodes",
        "increase in timeouts due to upstream rejection",
      ],
      actions: [
        "Reverted to previous known-good cert bundle",
        "Redeployed edge configuration",
        "Validated handshake success rate",
      ],
      prevention: [
        "Pre-deploy cert chain validation",
        "Staged rollout with canary edge nodes",
        "Alerting on handshake failure rate",
      ],
      runbook: "TLS / Certificate Failure",
    },

    db: {
      label: "Database slow query / lock",
      sev: "SEV-2",
      cause: "Slow query regression + lock contention during peak traffic window",
      symptoms: [
        "p95 latency increases with queue depth",
        "DB time dominates traces",
        "timeouts observed on write operations",
      ],
      actions: [
        "Killed blocking sessions / reduced lock contention",
        "Applied temporary read routing",
        "Indexed hot path query / reverted query change",
      ],
      prevention: [
        "Query regression tests on hot paths",
        "Lock contention dashboards + alerts",
        "Traffic shaping during peak write events",
      ],
      runbook: "DB Saturation / Lock Contention",
    },
  };

  const types = Object.keys(scenarios);
  const chosenType = (type === "random") ? randPick(types) : type;
  const s = scenarios[chosenType];

  const incident = `INC-${Math.floor(1000 + Math.random() * 9000)}`;
  const ticket = `CHG-${Math.floor(100000 + Math.random() * 900000)}`;
  const alert = `ALRT-${Math.floor(10000 + Math.random() * 90000)}`;

  const service = randPick(servicesByType[chosenType] || ["payments-api", "customer-portal", "edge-gateway", "auth-service"]);
  const region = randPick(regions);

  return {
    type: chosenType,
    label: s.label,
    sev: s.sev,
    cause: s.cause,
    symptoms: s.symptoms,
    actions: s.actions,
    prevention: s.prevention,
    runbook: s.runbook,
    incident,
    ticket,
    alert,
    service,
    region,
  };
}

function buildMap() {
  wfMap.innerHTML = "";
  STEPS.forEach((s, i) => {
    const node = document.createElement("div");
    node.className = "wf-node";
    node.dataset.step = String(i);
    node.innerHTML = `
      <div class="left">
        <div class="wf-stepnum">${i + 1}</div>
        <div>
          <div class="name">${s.name}</div>
          <div class="desc">${s.desc}</div>
        </div>
      </div>
      <div class="tag">${s.tag}</div>
    `;
    node.addEventListener("click", () => {
      if (!state.scenario) {
        const picked = scenarioSelect ? scenarioSelect.value : "random";
        state.scenario = makeScenario(picked);
        applyMeta(state.scenario);
        statusText.textContent = "Guided Mode";
      }
      goToStep(i);
    });
    wfMap.appendChild(node);
  });
}

function buildTimeline() {
  wfTimeline.innerHTML = "";
  STEPS.forEach((s, i) => {
    const chip = document.createElement("div");
    chip.className = "wf-chip";
    chip.dataset.step = String(i);
    chip.innerHTML = `<b>${i + 1}</b> ${s.name} <span>— pending</span>`;
    wfTimeline.appendChild(chip);
  });
}

function applyMeta(sc) {
  metaIncident.textContent = sc.incident;
  metaTicket.textContent = sc.ticket;
  metaService.textContent = sc.service;
  metaRegion.textContent = sc.region;
  metaSev.textContent = sc.sev;
  metaAlert.textContent = sc.alert;
  metaScenario.textContent = sc.label;
}

function markStep(idx) {
  const nodes = Array.from(document.querySelectorAll(".wf-node"));
  const chips = Array.from(document.querySelectorAll(".wf-chip"));

  nodes.forEach((n, i) => {
    n.classList.toggle("active", i === idx);
    n.classList.toggle("done", i < idx);
  });

  chips.forEach((c, i) => {
    c.classList.toggle("active", i === idx);
    c.classList.toggle("done", i < idx);
    const label = c.querySelector("span");
    if (!label) return;
    if (i < idx) label.textContent = "— done";
    else if (i === idx) label.textContent = "— active";
    else label.textContent = "— pending";
  });
}

function bullets(lines, indent = "  - ") {
  return lines.map(x => `${indent}${x}`).join("\n");
}

function artifactFor(idx, sc) {
  const t = nowStamp();
  miniPhase.textContent = STEPS[idx].name;

  switch (idx) {
    case 0:
      statusText.textContent = "Alert Firing";
      return {
        title: `Scenario: ${sc.label}`,
        sub: `Service: ${sc.service} • Region: ${sc.region} • ${sc.sev}`,
        body:
`[${t}] ALERT FIRING: High Latency / Elevated Errors
AlertId: ${sc.alert}
Service: ${sc.service}
Region: ${sc.region}
Severity: ${sc.sev}

Observed symptoms:
${bullets(sc.symptoms)}

Auto-actions:
  - open dashboards
  - start evidence collection
  - create incident shell`,
      };

    case 1:
      statusText.textContent = "Collecting Evidence";
      return {
        title: "Data Collection",
        sub: "Gathering metrics, logs, traces, and topology context.",
        body:
`[${t}] Evidence Collector started
Targets:
  - Metrics: latency, error rate, saturation
  - Logs: 5m extract (top errors)
  - Traces: sampled spans (slow endpoints)
  - Network: loss/route events (if applicable)

Collected artifacts:
  - metric_snapshot.json
  - log_extract.txt
  - trace_summary.json
  - topology_notes.md

Notable:
  - spike aligns with ${sc.region} peak
  - top endpoint: /api/v1/checkout
  - error codes: 502/504 increased`,
      };

    case 2:
      statusText.textContent = "Incident Open";
      return {
        title: `Incident Created (${sc.incident})`,
        sub: "Assigning severity, scope, and ownership.",
        body:
`[${t}] INCIDENT CREATED
Incident: ${sc.incident}
Severity: ${sc.sev}
Service: ${sc.service}
Scope:
  - Primary: ${sc.region}
  - Secondary: downstream retries increasing load

Assignments:
  - Incident Commander: On-call SRE
  - Comms: Secondary on-call
  - SME: Service owner (${sc.service})

Working hypothesis:
  - ${sc.cause}`,
      };

    case 3:
      statusText.textContent = "Ticket Created";
      return {
        title: `Ticket Generated (${sc.ticket})`,
        sub: "Creating work items for remediation + follow-up.",
        body:
`[${t}] TICKETING
Primary Ticket: ${sc.ticket}
Linked:
  - Incident: ${sc.incident}
  - Alert: ${sc.alert}

Tasks:
  - [ ] Validate blast radius & customer impact
  - [ ] Apply runbook mitigation
  - [ ] Identify root cause
  - [ ] Permanent fix + guardrails
  - [ ] Monitoring updates (SLO-aligned)

Stakeholder note:
  - Checkout latency + intermittent failures`,
      };

    case 4:
      statusText.textContent = "Runbook Executing";
      return {
        title: "Runbook Opened",
        sub: "Standard response to stabilize service.",
        body:
`[${t}] RUNBOOK: ${sc.runbook}
1) Confirm symptoms (p95/p99 + error rate)
2) Check saturation (CPU/mem/pools)
3) Identify top offenders (endpoints/deps)
4) Mitigate:
   - scale out replicas
   - rate-limit bursts / circuit breaker
   - rollback last deploy (if needed)
5) Validate recovery against SLO

Mitigation actions taken (demo):
${bullets(sc.actions)}`,
      };

    case 5:
      statusText.textContent = "Drafting RCA";
      return {
        title: "RCA Created (Draft)",
        sub: "Root cause, contributing factors, and prevention plan.",
        body:
`[${t}] ROOT CAUSE ANALYSIS (DRAFT)
Primary Cause:
  - ${sc.cause}

Customer-facing symptoms:
${bullets(sc.symptoms)}

Mitigation actions taken:
${bullets(sc.actions)}

Prevention / follow-ups:
${bullets(sc.prevention)}

Notes:
  - evidence auto-attached
  - post-incident review scheduled`,
      };

    case 6:
      statusText.textContent = "Closing Ticket";
      return {
        title: "Ticket Closed",
        sub: "Recovery validated and closure notes recorded.",
        body:
`[${t}] CLOSEOUT
Validation:
  - p95 latency: 310ms (below 450ms)
  - error rate: 0.3% (below 1.0%)
  - no ongoing instability detected

Resolution:
  - mitigation applied + monitoring updated
  - follow-up tasks assigned

Closure Notes:
  - stakeholder comms sent
  - RCA owner + due date set`,
      };

    case 7:
      statusText.textContent = "Executive Summary Ready";
      return {
        title: "Executive Summary",
        sub: "Business-facing summary of impact and prevention.",
        body:
`[${t}] EXECUTIVE SUMMARY
Incident: ${sc.incident} | Severity: ${sc.sev}
Service: ${sc.service} | Region: ${sc.region}

Impact:
  - Elevated latency and intermittent failures
  - Peak window affected; customer experience degraded

Detection:
  - Automated alert (${sc.alert})
  - Evidence package generated and attached

Root Cause:
  - ${sc.cause}

Mitigation:
${bullets(sc.actions)}

Prevention:
  - ${sc.prevention.join("; ")}`,
      };

    default:
      return { title: "", sub: "", body: "" };
  }
}

function goToStep(nextIdx) {
  if (!state.scenario) {
    const picked = scenarioSelect ? scenarioSelect.value : "random";
    state.scenario = makeScenario(picked);
    applyMeta(state.scenario);
  }

  state.idx = Math.max(0, Math.min(nextIdx, STEPS.length - 1));
  markStep(state.idx);

  const art = artifactFor(state.idx, state.scenario);
  artifactTitle.textContent = art.title;
  artifactSub.textContent = art.sub;
  artifactBody.textContent = art.body;

  if (state.idx === STEPS.length - 1) {
    state.playing = false;
    statusText.textContent = "Complete";
  }
}

function nextStep() {
  if (state.idx >= STEPS.length - 1) return;
  goToStep(state.idx + 1);
}

function runDemo() {
  if (state.playing) return;
  clearTimeout(state.timer);

  const picked = scenarioSelect ? scenarioSelect.value : "random";
  state.scenario = makeScenario(picked);
  applyMeta(state.scenario);

  state.idx = -1;
  state.playing = true;
  statusText.textContent = "Running Demo";

  const tick = () => {
    if (!state.playing) return;
    if (state.idx >= STEPS.length - 1) {
      state.playing = false;
      return;
    }
    nextStep();
    const delay = (state.idx === 1) ? 1100 : (state.idx === 4) ? 1200 : 950;
    state.timer = setTimeout(tick, delay);
  };

  goToStep(0);
  state.timer = setTimeout(tick, 900);
}

function resetAll() {
  clearTimeout(state.timer);
  state.timer = null;
  state.playing = false;
  state.idx = -1;
  state.scenario = null;

  statusText.textContent = "Idle";
  miniPhase.textContent = "—";

  artifactTitle.textContent = "Ready";
  artifactSub.textContent = "Press “Run Demo” to generate a scenario.";
  artifactBody.textContent = "";

  metaIncident.textContent = "—";
  metaTicket.textContent = "—";
  metaService.textContent = "—";
  metaRegion.textContent = "—";
  metaSev.textContent = "—";
  metaAlert.textContent = "—";
  metaScenario.textContent = "—";

  markStep(-1);
}

btnRun.addEventListener("click", runDemo);
btnNext.addEventListener("click", () => {
  if (!state.scenario) {
    const picked = scenarioSelect ? scenarioSelect.value : "random";
    state.scenario = makeScenario(picked);
    applyMeta(state.scenario);
    statusText.textContent = "Guided Mode";
  }
  nextStep();
});
btnReset.addEventListener("click", resetAll);

buildMap();
buildTimeline();
resetAll();
