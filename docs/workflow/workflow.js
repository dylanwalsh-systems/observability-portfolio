const STEPS = [
  { name: "Alert", desc: "Signal detected and validated", tag: "Firing", tone: "warn" },
  { name: "Data Collection", desc: "Metrics • Logs • Traces captured", tag: "Evidence", tone: "warn" },
  { name: "Incident", desc: "Severity, scope, and ownership set", tag: "SEV", tone: "bad" },
  { name: "Ticketing", desc: "Work item created + tasks assigned", tag: "Ticket", tone: "bad" },
  { name: "Runbook", desc: "Standard mitigation applied", tag: "Stabilize", tone: "warn" },
  { name: "RCA", desc: "Cause + contributing factors documented", tag: "Draft", tone: "warn" },
  { name: "Ticket Close", desc: "Validation complete + closure notes", tag: "Resolved", tone: "good" },
  { name: "Executive Summary", desc: "Business-facing summary generated", tag: "Executive", tone: "good" },
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

const btnRun = $("#btnRun");
const btnNext = $("#btnNext");
const btnReset = $("#btnReset");

function pad(n){ return String(n).padStart(2,"0"); }
function nowStamp(){
  const d = new Date();
  return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}
function randPick(arr){ return arr[Math.floor(Math.random() * arr.length)]; }

function makeScenario(){
  const services = ["payments-api", "customer-portal", "edge-gateway", "auth-service", "metrics-pipeline"];
  const regions = ["us-east-1", "us-east-2", "us-west-2", "eu-central-1"];
  const causes = [
    "BGP route flap on upstream provider",
    "Bad deploy: connection pool exhaustion",
    "DNS latency spike from misconfigured resolver",
    "Certificate chain mismatch after renewal",
    "Packet loss on core switch uplink"
  ];

  const sev = randPick(["SEV-1", "SEV-2", "SEV-3"]);
  const service = randPick(services);
  const region = randPick(regions);
  const cause = randPick(causes);

  const incident = `INC-${Math.floor(1000 + Math.random()*9000)}`;
  const ticket = `CHG-${Math.floor(100000 + Math.random()*900000)}`;
  const alert = `ALRT-${Math.floor(10000 + Math.random()*90000)}`;

  return { incident, ticket, alert, sev, service, region, cause };
}

function buildMap(){
  wfMap.innerHTML = "";
  STEPS.forEach((s, i) => {
    const node = document.createElement("div");
    node.className = "wf-node";
    node.dataset.step = String(i);
    node.innerHTML = `
      <div class="left">
        <div class="wf-stepnum">${i+1}</div>
        <div>
          <div class="name">${s.name}</div>
          <div class="desc">${s.desc}</div>
        </div>
      </div>
      <div class="tag">${s.tag}</div>
    `;
    node.addEventListener("click", () => {
      if (!state.scenario) {
        state.scenario = makeScenario();
        applyMeta(state.scenario);
        statusText.textContent = "Guided Mode";
      }
      goToStep(i);
    });
    wfMap.appendChild(node);
  });
}

function buildTimeline(){
  wfTimeline.innerHTML = "";
  STEPS.forEach((s, i) => {
    const chip = document.createElement("div");
    chip.className = "wf-chip";
    chip.dataset.step = String(i);
    chip.innerHTML = `<b>${i+1}</b> ${s.name} <span>— pending</span>`;
    wfTimeline.appendChild(chip);
  });
}

function applyMeta(sc){
  metaIncident.textContent = sc.incident;
  metaTicket.textContent = sc.ticket;
  metaService.textContent = sc.service;
  metaRegion.textContent = sc.region;
  metaSev.textContent = sc.sev;
  metaAlert.textContent = sc.alert;
}

function markStep(idx){
  const nodes = Array.from(document.querySelectorAll(".wf-node"));
  const chips = Array.from(document.querySelectorAll(".wf-chip"));

  nodes.forEach((n,i) => {
    n.classList.toggle("active", i === idx);
    n.classList.toggle("done", i < idx);
  });

  chips.forEach((c,i) => {
    c.classList.toggle("active", i === idx);
    c.classList.toggle("done", i < idx);
    const label = c.querySelector("span");
    if (!label) return;
    if (i < idx) label.textContent = "— done";
    else if (i === idx) label.textContent = "— active";
    else label.textContent = "— pending";
  });
}

function artifactFor(idx, sc){
  const t = nowStamp();
  miniPhase.textContent = STEPS[idx].name;

  switch(idx){
    case 0:
      statusText.textContent = "Alert Firing";
      return {
        title: "Alert Triggered",
        sub: "Synthetic alert generated (sample data).",
        body:
`[${t}] ALERT FIRING: High Latency / Elevated Errors
AlertId: ${sc.alert}
Service: ${sc.service}
Region: ${sc.region}
Severity: ${sc.sev}

Signal:
  - p95 latency: 1460ms (threshold 450ms)
  - error rate: 3.7% (threshold 1.0%)

Auto-actions:
  - open dashboards
  - start evidence collection
  - create incident shell`
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

Collected:
  - metric_snapshot.json
  - log_extract.txt
  - trace_summary.json
  - topology_notes.md

Notable:
  - spike aligns with ${sc.region} peak
  - top endpoint: /api/v1/checkout
  - error codes: 502/504 increase`
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

Initial hypotheses:
  1) Upstream network instability
  2) Resource exhaustion (pools/threads)
  3) DNS/PKI anomaly`
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
  - Checkout latency + intermittent failures`
      };

    case 4:
      statusText.textContent = "Runbook Executing";
      return {
        title: "Runbook Opened",
        sub: "Standard response to stabilize service.",
        body:
`[${t}] RUNBOOK: High Latency / Error Spike
1) Confirm symptoms (p95/p99 + error rate)
2) Check saturation (CPU/mem/pools)
3) Identify top offenders (endpoints/deps)
4) Mitigate:
   - scale out replicas
   - rate-limit bursts / circuit breaker
   - rollback last deploy (if needed)
5) Validate recovery against SLO

Action taken (demo):
  - scale-out: +3 replicas
  - temporary rate-limit: -15% on /checkout bursts`
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

Contributing Factors:
  - thresholds too permissive during peak
  - missing canary guardrail on dependency latency
  - retry storm amplified downstream load

What went well:
  - evidence auto-attached
  - mitigation stabilized service quickly

Improvements:
  - tighten SLO-based alerting
  - dependency budgets + circuit breaker defaults
  - deploy guard during peak window

Permanent Fix (proposed):
  - config change + validation tests
  - dashboards + alert rules update
  - post-incident review scheduled`
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
  - no ongoing loss/route instability detected

Resolution:
  - mitigation applied + monitoring updated
  - follow-up tasks assigned

Closure Notes:
  - stakeholder comms sent
  - RCA owner + due date set`
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
  - Elevated latency and intermittent checkout failures
  - Peak window affected; customer experience degraded

Detection:
  - Automated alert (${sc.alert})
  - Evidence package generated and attached

Root Cause:
  - ${sc.cause}

Mitigation:
  - scaled capacity + temporary burst controls

Prevention:
  - SLO-aligned alerting improvements
  - guardrails to reduce retry amplification
  - follow-up validation of permanent fix`
      };

    default:
      return { title:"", sub:"", body:"" };
  }
}

function goToStep(nextIdx){
  if (!state.scenario){
    state.scenario = makeScenario();
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

function nextStep(){
  if (state.idx >= STEPS.length - 1) return;
  goToStep(state.idx + 1);
}

function runDemo(){
  if (state.playing) return;
  clearTimeout(state.timer);

  state.scenario = makeScenario();
  applyMeta(state.scenario);

  state.idx = -1;
  state.playing = true;
  statusText.textContent = "Running Demo";

  const tick = () => {
    if (!state.playing) return;
    if (state.idx >= STEPS.length - 1){
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

function resetAll(){
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

  markStep(-1);
}

btnRun.addEventListener("click", runDemo);
btnNext.addEventListener("click", () => {
  if (!state.scenario) {
    state.scenario = makeScenario();
    applyMeta(state.scenario);
    statusText.textContent = "Guided Mode";
  }
  nextStep();
});
btnReset.addEventListener("click", resetAll);

buildMap();
buildTimeline();
resetAll();
