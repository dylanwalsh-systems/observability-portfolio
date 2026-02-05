async function loadIncidents() {
  // Cache-bust so GitHub Pages/CDN doesn’t serve stale JSON
  const res = await fetch(`./data/incidents.json?v=${Date.now()}`, { cache: "no-store" });
  if (!res.ok) throw new Error("Failed to load incidents.json");
  return await res.json();
}

function qs(name) {
  const u = new URL(window.location.href);
  return u.searchParams.get(name);
}

function severityPill(sev) {
  const s = (sev || "").toLowerCase();
  if (s === "high") return "bad";
  if (s === "medium") return "warn";
  return "good";
}

function formatWhen(isoStart, isoEnd) {
  const s = new Date(isoStart);
  const e = new Date(isoEnd);
  const opts = {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  };
  return `${s.toLocaleString(undefined, opts)} → ${e.toLocaleString(undefined, opts)}`;
}

function downloadText(filename, text) {
  const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function getLiveViewLink(inc) {
  if (inc.grafana && inc.grafana.url) return inc.grafana.url;
  return null;
}

function escapeHtml(str) {
  return String(str ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

async function renderIncidentsTable() {
  const incidents = await loadIncidents();
  const tbody = document.querySelector("#incidents-tbody");
  if (!tbody) return;

  tbody.innerHTML = "";
  for (const inc of incidents) {
    const tr = document.createElement("tr");
    const pill = severityPill(inc.severity);

    tr.innerHTML = `
      <td>
        <div class="badge">
          <span class="pill ${pill}"></span>
          ${escapeHtml(inc.severity || "Low")}
        </div>
      </td>
      <td>
        <strong>${escapeHtml(inc.title || inc.id)}</strong>
        <div class="small">${escapeHtml(inc.customer_symptom || "")}</div>
      </td>
      <td>${escapeHtml(inc.where || "-")}</td>
      <td>${escapeHtml(formatWhen(inc.start, inc.end))}</td>
      <td><a class="btn primary" href="./incident.html?id=${encodeURIComponent(inc.id)}">Open</a></td>
    `;

    tbody.appendChild(tr);
  }
}

function buildTimelineHtml(inc) {
  if (!inc.timeline || !Array.isArray(inc.timeline) || inc.timeline.length === 0) return "";

  const rows = inc.timeline
    .map(
      (t) => `
    <tr>
      <td style="white-space:nowrap;"><strong>${escapeHtml(t.time)}</strong></td>
      <td>${escapeHtml(t.event)}</td>
    </tr>
  `
    )
    .join("");

  return `
    <div class="card">
      <h2>Timeline</h2>
      <div class="small">A simple step-by-step summary of what happened.</div>
      <table class="table">
        <thead>
          <tr><th>Time</th><th>What happened</th></tr>
        </thead>
        <tbody>
          ${rows}
        </tbody>
      </table>
    </div>
  `;
}

async function renderIncidentDetail() {
  const id = qs("id");
  if (!id) return;

  const incidents = await loadIncidents();
  const inc = incidents.find((x) => x.id === id);

  const root = document.querySelector("#incident-root");
  if (!root) return;

  if (!inc) {
    root.innerHTML = `
      <div class="card">
        <h2>Incident not found</h2>
        <p class="small">No incident with id: ${escapeHtml(id)}</p>
      </div>
    `;
    return;
  }

  const live = getLiveViewLink(inc);

  const evidenceHtml =
    inc.evidence && Array.isArray(inc.evidence) && inc.evidence.length
      ? inc.evidence
          .map(
            (ev) => `
        <div class="imgcard">
          <img src="${escapeHtml(ev.path)}" alt="${escapeHtml(ev.caption || "Evidence")}">
          <div class="cap">${escapeHtml(ev.caption || "")}</div>
        </div>
      `
          )
          .join("")
      : `<div class="notice">No evidence images linked yet.</div>`;

  const timelineHtml = buildTimelineHtml(inc);

  root.innerHTML = `
    <div class="card">
      <div class="badge"><span class="pill ${severityPill(inc.severity)}"></span>${escapeHtml(
    inc.severity || "Low"
  )} severity</div>
      <h1 style="margin:10px 0 6px">${escapeHtml(inc.title || inc.id)}</h1>
      <div class="small">${escapeHtml(inc.customer_symptom || "")}</div>

      <div class="kv">
        <div><div class="k">Where</div><div class="v">${escapeHtml(inc.where || "-")}</div></div>
        <div><div class="k">When it happened</div><div class="v">${escapeHtml(formatWhen(inc.start, inc.end))}</div></div>
        <div><div class="k">Status</div><div class="v">${escapeHtml(inc.status || "Resolved")}</div></div>
        <div><div class="k">Impact</div><div class="v">${escapeHtml(inc.impact || "-")}</div></div>
      </div>

      <div class="btnrow">
        ${
          live
            ? `<a class="btn primary" href="${escapeHtml(live)}" target="_blank" rel="noopener">Open Live View</a>`
            : `<span class="notice">Live View link not configured yet.</span>`
        }
        <button class="btn" id="btn-ticket">Download Ticket</button>
        <button class="btn" id="btn-email">Copy Email Update</button>
      </div>
    </div>

    <div class="card">
      <h2>What we found</h2>
      <p class="small">${escapeHtml(inc.findings || "—")}</p>
      <h2 style="margin-top:14px">What we did</h2>
      <p class="small">${escapeHtml(inc.mitigation || "—")}</p>
    </div>

    ${timelineHtml}

    <div class="card">
      <h2>Evidence</h2>
      <div class="small">Charts and comparisons captured for non-technical review.</div>
      <div class="gallery">
        ${evidenceHtml}
      </div>
    </div>
  `;

  document.querySelector("#btn-ticket")?.addEventListener("click", () => {
    const md = `# Incident ${inc.id}: ${inc.title}

**Severity:** ${inc.severity}
**Status:** ${inc.status}
**Where:** ${inc.where}
**When:** ${formatWhen(inc.start, inc.end)}
**Impact:** ${inc.impact}

## Customer Symptoms
${inc.customer_symptom}

## Findings (Plain English)
${inc.findings}

## Mitigation / Resolution
${inc.mitigation}

## Timeline
${(inc.timeline || []).map(t => `- ${t.time} — ${t.event}`).join("\n")}

## Live View
${live || "Not configured"}
`;
    downloadText(`${inc.id}-ticket.md`, md);
  });

  document.querySelector("#btn-email")?.addEventListener("click", async () => {
    const text = `Subject: Update: ${inc.title} (${inc.id})

Hi team,

Issue location: ${inc.where}
Time window: ${formatWhen(inc.start, inc.end)}
Customer impact: ${inc.customer_symptom}

What we found:
${inc.findings}

What we did:
${inc.mitigation}

Status: ${inc.status}
${live ? `Live View: ${live}` : ""}

Thanks,
`;
    try {
      await navigator.clipboard.writeText(text);
      alert("Email update copied to clipboard.");
    } catch {
      alert("Could not copy automatically. Try on GitHub Pages (not local file).");
    }
  });
}

document.addEventListener("DOMContentLoaded", () => {
  renderIncidentsTable().catch(console.error);
  renderIncidentDetail().catch(console.error);
});
