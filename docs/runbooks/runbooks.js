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

let RUNBOOKS = [];

function renderList(filter=""){
  const list = document.querySelector("#rb-list");
  const q = filter.trim().toLowerCase();

  const items = RUNBOOKS.filter(r => {
    if(!q) return true;
    const blob = `${r.title} ${(r.tags||[]).join(" ")} ${r.when||""}`.toLowerCase();
    return blob.includes(q);
  });

  list.innerHTML = items.map((r, i) => `
    <div class="rb-item" data-id="${esc(r.id)}">
      <div class="rb-title">${esc(r.title)}</div>
      <div class="rb-tags">
        ${(r.tags||[]).map(t=>`<span class="rb-tag">${esc(t)}</span>`).join("")}
      </div>
    </div>
  `).join("") || `<div class="notice">No matching runbooks.</div>`;

  Array.from(document.querySelectorAll(".rb-item")).forEach(el => {
    el.addEventListener("click", () => {
      document.querySelectorAll(".rb-item").forEach(x => x.classList.remove("active"));
      el.classList.add("active");
      const id = el.dataset.id;
      const rb = RUNBOOKS.find(x => x.id === id);
      if(rb) renderDetail(rb);
    });
  });

  // Auto-select first
  const first = document.querySelector(".rb-item");
  if(first){
    first.classList.add("active");
    const rb = RUNBOOKS.find(x => x.id === first.dataset.id);
    if(rb) renderDetail(rb);
  }
}

function renderDetail(rb){
  const d = document.querySelector("#rb-detail");
  d.innerHTML = `
    <h2 style="margin:0 0 6px;">${esc(rb.title)}</h2>
    <div class="small">${esc(rb.when || "")}</div>

    <div class="rb-section">
      <h3>Goal</h3>
      <div class="rb-text">${esc(rb.goal || "")}</div>
    </div>

    <div class="rb-section">
      <h3>Steps</h3>
      <ol class="rb-steps">${(rb.steps||[]).map(s=>`<li>${esc(s)}</li>`).join("")}</ol>
    </div>

    <div class="rb-callout">
      <strong>When to escalate:</strong><br>
      ${esc(rb.escalate || "If the issue persists or impact grows.")}
    </div>

    <div class="rb-section">
      <h3>What to tell stakeholders</h3>
      <div class="rb-text">${esc(rb.stakeholder_message || "")}</div>
      <div class="btnrow" style="margin-top:10px;">
        <button class="btn" id="rb-copy">Copy update</button>
      </div>
    </div>
  `;

  document.querySelector("#rb-copy")?.addEventListener("click", async () => {
    const txt = rb.stakeholder_message || "";
    try{ await navigator.clipboard.writeText(txt); alert("Update copied."); }
    catch{ alert("Could not copy automatically."); }
  });
}

async function init(){
  RUNBOOKS = await fetchJson("../data/runbooks.json");
  renderList("");

  document.querySelector("#rb-q")?.addEventListener("input", (e) => {
    renderList(e.target.value || "");
  });
}

init().catch(console.error);
