async function fetchJson(path) {
  const res = await fetch(path, { cache: "no-store" });
  if (!res.ok) throw new Error(`Failed to load ${path} (${res.status})`);
  return await res.json();
}

function riskClass(risk) {
  const r = (risk || "").toLowerCase();
  if (r === "accepted") return "sec-risk-pill r-accepted";
  if (r === "monitored") return "sec-risk-pill r-monitored";
  if (r === "mitigated") return "sec-risk-pill r-mitigated";
  return "sec-risk-pill";
}

function escapeHtml(s) {
  return String(s ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function renderThreats(rows) {
  const tbody = document.querySelector("#threatTable tbody");
  if (!tbody) return;

  if (!Array.isArray(rows) || rows.length === 0) {
    tbody.innerHTML = `<tr><td colspan="4" class="sec-muted">No threat data found.</td></tr>`;
    return;
  }

  tbody.innerHTML = rows.map(r => {
    const status = r.status || "Monitored";
    const risk = r.risk || "Monitored";
    return `
      <tr>
        <td>${escapeHtml(r.vector || "")}</td>
        <td>${escapeHtml(r.threat || "")}</td>
        <td><span class="${riskClass(risk)}">${escapeHtml(risk)}</span></td>
        <td class="sec-muted">${escapeHtml(status)}</td>
      </tr>
    `;
  }).join("");
}

function renderKPIs(metrics) {
  const grid = document.querySelector("#kpiGrid");
  if (!grid) return;

  const kpis = [
    { label: "Req/min", value: metrics.req_per_min, sub: "baseline" },
    { label: "4xx rate", value: metrics.rate_4xx, sub: "invalid requests" },
    { label: "Anomaly score", value: metrics.anomaly_score, sub: "burst detection" },
    { label: "Signal confidence", value: metrics.signal_confidence, sub: "noise filter" },
  ];

  const cards = grid.querySelectorAll(".sec-kpi");
  kpis.forEach((k, i) => {
    const card = cards[i];
    if (!card) return;
    card.querySelector(".sec-kpi-label").textContent = k.label;
    card.querySelector(".sec-kpi-value").textContent = String(k.value ?? "—");
    card.querySelector(".sec-kpi-sub").textContent = k.sub;
  });
}

function renderDecisions(items) {
  const el = document.querySelector("#decisionTimeline");
  if (!el) return;

  if (!Array.isArray(items) || items.length === 0) {
    el.innerHTML = `<div class="sec-muted">No decision log found.</div>`;
    return;
  }

  el.innerHTML = items.map(d => `
    <div class="sec-t-item">
      <div class="sec-t-dot"></div>
      <div class="sec-t-card">
        <div class="sec-t-title">${escapeHtml(d.decision || "Decision")}</div>
        <div class="sec-t-meta">${escapeHtml(d.tag || "Tradeoff")} • ${escapeHtml(d.date || "")}</div>
        <div class="sec-t-grid">
          <div><b>Reason:</b> ${escapeHtml(d.reason || "")}</div>
          <div><b>Tradeoff:</b> ${escapeHtml(d.tradeoff || "")}</div>
          <div><b>Mitigation:</b> ${escapeHtml(d.mitigation || "")}</div>
        </div>
      </div>
    </div>
  `).join("");
}

const FLOW = {
  alert: {
    title: "Alert",
    body: `
      <b>Goal:</b> detect a meaningful signal without creating noise.<br>
      <b>Inputs:</b> request bursts, error rate shifts, repeated malformed payloads.<br>
      <b>Outputs:</b> severity + context snapshot.
    `
  },
  triage: {
    title: "Triage",
    body: `
      <b>Goal:</b> decide if this is real, noisy, or expected change.<br>
      <b>Checks:</b> confidence score, recent deploy/change, baseline deviations.<br>
      <b>Decision:</b> proceed to validate or downgrade/close as noise.
    `
  },
  validate: {
    title: "Validate",
    body: `
      <b>Goal:</b> confirm impact and likely cause.<br>
      <b>Checks:</b> logs + metrics correlation, scope (single path vs global), repetition patterns.<br>
      <b>Outcome:</b> confirmed incident vs false positive.
    `
  },
  contain: {
    title: "Contain",
    body: `
      <b>Goal:</b> apply guardrails to stop escalation (without breaking normal use).<br>
      <b>Actions (demo-friendly):</b> rate-limit recommendations, caching, temporary shielding.<br>
      <b>Note:</b> keep actions non-destructive and observable.
    `
  },
  learn: {
    title: "Learn",
    body: `
      <b>Goal:</b> improve detection fidelity and reduce future risk.<br>
      <b>Outputs:</b> tuning thresholds, adding telemetry, documenting decisions.<br>
      <b>Metric focus:</b> lower false positives, improve MTTD/MTTR.
    `
  }
};

function setupFlow() {
  const nodes = document.querySelectorAll(".sec-flow-node");
  const detail = document.querySelector("#flowDetail");
  if (!nodes.length || !detail) return;

  nodes.forEach(btn => {
    btn.addEventListener("click", () => {
      nodes.forEach(n => n.classList.remove("active"));
      btn.classList.add("active");

      const step = btn.dataset.step;
      const item = FLOW[step];
      if (!item) return;

      detail.innerHTML = `
        <div style="font-weight:800; color:#cfe0ff; margin-bottom:6px;">${escapeHtml(item.title)}</div>
        <div class="sec-muted">${item.body}</div>
      `;
    });
  });
}

(async function init() {
  try {
    const [metrics, threats, decisions] = await Promise.all([
      fetchJson("../data/security-metrics.json"),
      fetchJson("../data/security-threats.json"),
      fetchJson("../data/security-decisions.json"),
    ]);

    renderKPIs(metrics);
    renderThreats(threats);
    renderDecisions(decisions);
    setupFlow();
  } catch (e) {
    console.error(e);
    const threatBody = document.querySelector("#threatTable tbody");
    if (threatBody) threatBody.innerHTML = `<tr><td colspan="4" class="sec-muted">Failed to load security data. Check console + JSON paths.</td></tr>`;
    const timeline = document.querySelector("#decisionTimeline");
    if (timeline) timeline.innerHTML = `<div class="sec-muted">Failed to load decision log. Check console + JSON paths.</div>`;
  }
})();
