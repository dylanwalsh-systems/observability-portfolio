async function loadIncidents() {
  const res = await fetch(`./data/incidents.json?v=${Date.now()}`, { cache: "no-store" });
  if (!res.ok) throw new Error('Failed to load incidents.json');
  return await res.json();
}

function qs(name) {
  const u = new URL(window.location.href);
  return u.searchParams.get(name);
}

function severityPill(sev) {
  const s = (sev || '').toLowerCase();
  if (s === 'high') return 'bad';
  if (s === 'medium') return 'warn';
  return 'good';
}

function formatWhen(isoStart, isoEnd) {
  const s = new Date(isoStart);
  const e = new Date(isoEnd);
  const opts = { year:'numeric', month:'short', day:'2-digit', hour:'2-digit', minute:'2-digit' };
  return `${s.toLocaleString(undefined, opts)} → ${e.toLocaleString(undefined, opts)}`;
}

function downloadText(filename, text) {
  const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
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

async function renderIncidentsTable() {
  const incidents = await loadIncidents();
  const tbody = document.querySelector('#incidents-tbody');
  if (!tbody) return;

  tbody.innerHTML = '';
  for (const inc of incidents) {
    const tr = document.createElement('tr');
    const pill = severityPill(inc.severity);

    tr.innerHTML = `
      <td>
        <div class="badge">
          <span class="pill ${pill}"></span>
          ${inc.severity || 'Low'}
        </div>
      </td>
      <td><strong>${inc.title || inc.id}</strong><div class="small">${inc.customer_symptom || ''}</div></td>
      <td>${inc.where || '-'}</td>
      <td>${formatWhen(inc.start, inc.end)}</td>
      <td><a class="btn primary" href="./incident.html?id=${encodeURIComponent(inc.id)}">Open</a></td>
    `;
    tbody.appendChild(tr);
  }
}

async function renderIncidentDetail() {
  const id = qs('id');
  if (!id) return;

  const incidents = await loadIncidents();
  const inc = incidents.find(x => x.id === id);

  const root = document.querySelector('#incident-root');
  if (!root) return;

  if (!inc) {
    root.innerHTML = `<div class="card"><h2>Incident not found</h2><p class="small">No incident with id: ${id}</p></div>`;
    return;
  }

  const live = getLiveViewLink(inc);

  const evidence = (inc.evidence || []).map(ev => `
    <div class="imgcard">
      <img src="${ev.path}" alt="${ev.caption || 'Evidence'}">
      <div class="cap">${ev.caption || ''}</div>
    </div>
  `).join('');

  root.innerHTML = `
    <div class="card">
      <div class="badge"><span class="pill ${severityPill(inc.severity)}"></span>${inc.severity || 'Low'} severity</div>
      <h1 style="margin:10px 0 6px">${inc.title || inc.id}</h1>
      <div class="small">${inc.customer_symptom || ''}</div>

      <div class="kv">
        <div><div class="k">Where</div><div class="v">${inc.where || '-'}</div></div>
        <div><div class="k">When it happened</div><div class="v">${formatWhen(inc.start, inc.end)}</div></div>
        <div><div class="k">Status</div><div class="v">${inc.status || 'Resolved'}</div></div>
        <div><div class="k">Impact</div><div class="v">${inc.impact || '-'}</div></div>
      </div>

      <div class="btnrow">
        ${live ? `<a class="btn primary" href="${live}" target="_blank" rel="noopener">Open Live View</a>` : `<span class="notice">Live View link not configured yet.</span>`}
        <button class="btn" id="btn-ticket">Download Ticket</button>
        <button class="btn" id="btn-email">Copy Email Update</button>
      </div>
    </div>

    <div class="card">
      <h2>What we found</h2>
      <p class="small">${inc.findings || '—'}</p>
      <h2 style="margin-top:14px">What we did</h2>
      <p class="small">${inc.mitigation || '—'}</p>
    </div>

    <div class="card">
      <h2>Evidence</h2>
      <div class="small">Charts and comparisons captured for non-technical review.</div>
      <div class="gallery">
        ${evidence || `<div class="notice">No evidence images linked yet.</div>`}
      </div>
    </div>
  `;

  document.querySelector('#btn-ticket')?.addEventListener('click', () => {
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

## Live View
${live || 'Not configured'}
`;
    downloadText(`${inc.id}-ticket.md`, md);
  });

  document.querySelector('#btn-email')?.addEventListener('click', async () => {
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
${live ? `Live View: ${live}` : ''}

Thanks,
`;
    await navigator.clipboard.writeText(text);
    alert('Email update copied to clipboard.');
  });
}

document.addEventListener('DOMContentLoaded', () => {
  renderIncidentsTable().catch(console.error);
  renderIncidentDetail().catch(console.error);
});
