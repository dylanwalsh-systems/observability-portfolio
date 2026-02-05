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

function dotClass(status){
  const s = (status || "").toLowerCase();
  if(s === "operational") return "dot-green";
  if(s === "degraded") return "dot-yellow";
  return "dot-red";
}

function pillText(status){
  const s = (status || "").toLowerCase();
  if(s === "operational") return "All systems normal";
  if(s === "degraded") return "Degraded performance";
  return "Service disruption";
}

function render(data){
  // Banner
  const banner = document.querySelector("#status-banner");
  const meta = document.querySelector("#status-meta");
  const customerMsg = document.querySelector("#customer-message");

  banner.innerHTML = `
    <div class="banner-row">
      <div class="banner-title">${esc(data.banner?.title || "Status update")}</div>
      <div class="banner-pill">
        <span class="dot-mini ${dotClass(data.banner?.state)}"></span>
        ${esc(pillText(data.banner?.state))}
      </div>
    </div>
    <div class="small" style="margin-top:10px; line-height:1.5;">
      ${esc(data.banner?.body || "")}
    </div>
  `;

  meta.textContent = `Last updated: ${data.last_updated || "—"} • Next update: ${data.next_update || "—"}`;
  customerMsg.textContent = data.customer_message || "—";

  // Services
  const grid = document.querySelector("#services-grid");
  const services = Array.isArray(data.services) ? data.services : [];
  grid.innerHTML = services.map(s => `
    <div class="svc">
      <div class="banner-row">
        <div class="svc-name">${esc(s.name)}</div>
        <div class="banner-pill">
          <span class="dot-mini ${dotClass(s.status)}"></span>
          ${esc((s.status || "").toUpperCase())}
        </div>
      </div>
      <div class="svc-sub">${esc(s.summary || "")}</div>
      <div class="svc-meta">
        <span class="chip">Impact: ${esc(s.impact || "None")}</span>
        <span class="chip">Owner: ${esc(s.owner || "Ops")}</span>
        ${s.link ? `<a class="chip" href="${esc(s.link)}">Details →</a>` : ``}
      </div>
    </div>
  `).join("") || `<div class="notice">No services listed yet.</div>`;

  // Updates
  const updatesEl = document.querySelector("#updates");
  const updates = Array.isArray(data.updates) ? data.updates : [];
  updatesEl.innerHTML = updates.map(u => `
    <div class="update">
      <div class="update-top">
        <div class="update-time">${esc(u.time || "")}</div>
        <div class="badge"><span class="pill ${u.level === "high" ? "bad" : u.level === "medium" ? "warn" : "good"}"></span>${esc((u.level||"low").toUpperCase())}</div>
      </div>
      <div class="update-text">${esc(u.text || "")}</div>
    </div>
  `).join("") || `<div class="notice">No updates yet.</div>`;

  // Copy customer update
  document.querySelector("#btn-copy-update")?.addEventListener("click", async () => {
    const txt = `Customer Update (${data.last_updated || ""}):\n\n${data.customer_message || ""}`;
    try{
      await navigator.clipboard.writeText(txt);
      alert("Customer update copied.");
    }catch{
      alert("Could not copy automatically in this browser.");
    }
  });
}

async function init(){
  const data = await fetchJson("../data/status.json");
  render(data);

  document.querySelector("#btn-refresh")?.addEventListener("click", async () => {
    const d = await fetchJson("../data/status.json");
    render(d);
  });
}

init().catch(console.error);
