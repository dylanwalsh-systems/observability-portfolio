async function fetchJson(path){
  const res = await fetch(path + `?v=${Date.now()}`, { cache:"no-store" });
  if(!res.ok) throw new Error(`Failed to load ${path}`);
  return await res.json();
}
function esc(s){
  return String(s ?? "")
    .replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;")
    .replaceAll('"',"&quot;").replaceAll("'","&#039;");
}

function renderDetail(rca){
  const d = document.querySelector("#rca-detail");
  d.innerHTML = `
    <div class="badge"><span class="pill ${rca.severity === "High" ? "bad" : rca.severity === "Medium" ? "warn" : "good"}"></span>${esc(rca.severity)} severity</div>
    <h2 style="margin:10px 0 6px;">${esc(rca.title)}</h2>
    <div class="small">${esc(rca.date)} • Related: ${esc(rca.related_incident || "—")}</div>

    <div class="rca-section">
      <h3>What happened</h3>
      <div class="rca-text">${esc(rca.what_happened)}</div>
    </div>

    <div class="rca-section">
      <h3>Customer impact</h3>
      <div class="rca-text">${esc(rca.impact)}</div>
    </div>

    <div class="rca-section">
      <h3>Root cause (plain English)</h3>
      <div class="rca-text">${esc(rca.root_cause)}</div>
    </div>

    <div class="rca-section">
      <h3>What we changed</h3>
      <ul class="rca-bullets">${(rca.changes||[]).map(x=>`<li>${esc(x)}</li>`).join("")}</ul>
    </div>

    <div class="rca-section">
      <h3>How we prevent a repeat</h3>
      <ul class="rca-bullets">${(rca.prevention||[]).map(x=>`<li>${esc(x)}</li>`).join("")}</ul>
    </div>
  `;
}

async function init(){
  const data = await fetchJson("../data/rca.json");
  const list = document.querySelector("#rca-list");

  list.innerHTML = (data || []).map((r, i) => `
    <div class="rca-item" data-i="${i}">
      <div class="rca-title">${esc(r.title)}</div>
      <div class="rca-meta">${esc(r.date)} • Severity: ${esc(r.severity)} • ${esc(r.tag || "Review")}</div>
    </div>
  `).join("") || `<div class="notice">No RCAs yet.</div>`;

  const items = Array.from(document.querySelectorAll(".rca-item"));
  items.forEach(el => {
    el.addEventListener("click", () => {
      items.forEach(x => x.classList.remove("active"));
      el.classList.add("active");
      const idx = Number(el.dataset.i);
      renderDetail(data[idx]);
    });
  });

  // Auto-select first
  if(items[0] && data[0]){
    items[0].classList.add("active");
    renderDetail(data[0]);
  }
}

init().catch(console.error);
