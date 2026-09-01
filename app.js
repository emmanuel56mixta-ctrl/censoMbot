  const DB = {summary:{"registros_encuesta_con_mbot":147,"planteles_unicos":145,"primaria":104,"secundaria":41,"kits_total_estimado":940,"kits_sin_cantidad":1,"geolocalizados":145,"estados":{"Sin uso":125,"En uso":15,"Uso limitado":2,"Requiere capacitación":2,"Dañados / incompletos":1},"duplicados_resueltos":2,"cct_ajustados_para_ubicacion":6},schools:window.MBOT_SCHOOLS||[]};
  const schools = DB.schools;
  const statusColors = {
    "En uso":"#178a51",
    "Sin uso":"#c94747",
    "Uso limitado":"#d58a12",
    "Requiere capacitación":"#7252c7",
    "Dañados / incompletos":"#384152"
  };

  const map = L.map("map", {zoomControl:true, preferCanvas:true}).setView([20.68,-103.35], 8);
  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom:18, attribution:'&copy; OpenStreetMap'
  }).addTo(map);

  const markerLayer = L.layerGroup().addTo(map);
  let filtered = schools.slice();
  let markers = new Map();
  let selectedCct = null;
  let quickMode = "all";

  const els = {
    q:document.getElementById("q"), level:document.getElementById("level"), region:document.getElementById("region"),
    municipality:document.getElementById("municipality"), condition:document.getElementById("condition"), kits:document.getElementById("kits"),
    results:document.getElementById("results"), resultCount:document.getElementById("resultCount"),
    kpiSchools:document.getElementById("kpiSchools"), kpiKits:document.getElementById("kpiKits"), kpiUse:document.getElementById("kpiUse"),
    kpiPrimary:document.getElementById("kpiPrimary"), kpiSecondary:document.getElementById("kpiSecondary")
  };

  const uniqueSorted = key => [...new Set(schools.map(s=>s[key]).filter(Boolean))].sort((a,b)=>a.localeCompare(b,"es"));
  function fillSelect(el, values){
    values.forEach(v=>{const o=document.createElement("option");o.value=v;o.textContent=v;el.appendChild(o);});
  }
  fillSelect(els.level, uniqueSorted("nivel"));
  fillSelect(els.region, uniqueSorted("region"));
  fillSelect(els.municipality, uniqueSorted("municipio"));
  fillSelect(els.condition, uniqueSorted("condicion"));

  function esc(v){
    return String(v ?? "").replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[m]));
  }
  function normalize(v){return String(v||"").normalize("NFD").replace(/\p{Diacritic}/gu,"").toLowerCase().trim();}
  function kitsMatch(k, rule){
    if(!rule) return true;
    if(rule==="unknown") return k==null;
    if(k==null) return false;
    if(rule==="1-4") return k>=1 && k<=4;
    if(rule==="5") return k===5;
    if(rule==="6-9") return k>=6 && k<=9;
    if(rule==="10+") return k>=10;
    return true;
  }
  function isAttention(s){return s.condicion!=="En uso";}
  function badgeStyle(status){
    const c=statusColors[status]||"#68738a";
    return `color:${c};background:${c}16;border:1px solid ${c}33`;
  }
  function radius(k){return k==null?6:Math.max(6,Math.min(17,5+Math.sqrt(k)*2));}

  function applyFilters(){
    const q=normalize(els.q.value);
    filtered=schools.filter(s=>{
      const text=normalize(`${s.cct} ${s.escuela} ${s.municipio} ${s.region}`);
      if(q && !text.includes(q)) return false;
      if(els.level.value && s.nivel!==els.level.value) return false;
      if(els.region.value && s.region!==els.region.value) return false;
      if(els.municipality.value && s.municipio!==els.municipality.value) return false;
      if(els.condition.value && s.condicion!==els.condition.value) return false;
      if(!kitsMatch(s.kits,els.kits.value)) return false;
      if(quickMode==="active" && s.condicion!=="En uso") return false;
      if(quickMode==="attention" && !isAttention(s)) return false;
      return true;
    });
    renderAll();
  }

  function popupHtml(s){
    const mapUrl=`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(s.lat+","+s.lng)}`;
    return `<div class="popup-title">${esc(s.escuela)}</div>
      <div class="popup-row"><b>${esc(s.nivel)}</b> · ${esc(s.municipio)} · ${esc(s.region)}</div>
      <div class="popup-row">CCT: ${esc(s.cct)}${s.ajuste_cct?` <span title="CCT usado sólo para ubicar">(ubicación: ${esc(s.cct_ubicacion)})</span>`:""}</div>
      <div class="popup-row"><b>Kits:</b> ${s.kits==null?"Sin dato":esc(s.kits)} · <b>Condición:</b> ${esc(s.condicion)}</div>
      <div class="popup-row"><b>Domicilio:</b> ${esc(s.domicilio||"Sin dato")}</div>
      <div class="popup-observation"><b>Reporte original:</b><br>${esc(s.actividad_original||"Sin observación")}</div>
      <a class="popup-link" href="${mapUrl}" target="_blank" rel="noopener">Abrir ubicación ↗</a>`;
  }

  function renderMap(){
    markerLayer.clearLayers(); markers.clear();
    filtered.forEach(s=>{
      if(s.lat==null||s.lng==null) return;
      const m=L.circleMarker([s.lat,s.lng],{
        radius:radius(s.kits),color:"#ffffff",weight:1.5,fillColor:statusColors[s.condicion]||"#68738a",fillOpacity:.82
      }).bindPopup(popupHtml(s),{maxWidth:340});
      m.on("click",()=>selectSchool(s.cct,false));
      m.addTo(markerLayer); markers.set(s.cct,m);
    });
  }

  function renderList(){
    els.results.innerHTML="";
    els.resultCount.textContent=`${filtered.length} resultado${filtered.length===1?"":"s"}`;
    if(!filtered.length){els.results.innerHTML='<div class="empty">No hay planteles que coincidan con los filtros.</div>';return;}
    const frag=document.createDocumentFragment();
    filtered.slice().sort((a,b)=>a.escuela.localeCompare(b.escuela,"es")).forEach(s=>{
      const d=document.createElement("article");
      d.className="school"+(s.cct===selectedCct?" active":"");
      d.dataset.cct=s.cct;
      d.tabIndex=0;
      d.innerHTML=`<div class="school-top"><div><div class="school-name">${esc(s.escuela)}</div><div class="meta">${esc(s.cct)} · ${esc(s.municipio)} · ${esc(s.region)}</div></div><span class="badge" style="${badgeStyle(s.condicion)}">${esc(s.condicion)}</span></div>
        <div class="school-grid">
          <div class="mini"><span>Nivel</span><b>${esc(s.nivel)}</b></div>
          <div class="mini"><span>Kits</span><b>${s.kits==null?"Sin dato":esc(s.kits)+(s.kits_aprox?" aprox.":"")}</b></div>
        </div>`;
      d.addEventListener("click",()=>selectSchool(s.cct,true));
      d.addEventListener("keydown",e=>{if(e.key==="Enter"||e.key===" "){e.preventDefault();selectSchool(s.cct,true);}});
      frag.appendChild(d);
    });
    els.results.appendChild(frag);
  }

  function renderKpis(){
    const kits=filtered.reduce((a,s)=>a+(Number.isFinite(s.kits)?s.kits:0),0);
    els.kpiSchools.textContent=filtered.length.toLocaleString("es-MX");
    els.kpiKits.textContent=kits.toLocaleString("es-MX");
    els.kpiUse.textContent=filtered.filter(s=>s.condicion==="En uso").length.toLocaleString("es-MX");
    els.kpiPrimary.textContent=filtered.filter(s=>s.nivel==="Primaria").length.toLocaleString("es-MX");
    els.kpiSecondary.textContent=filtered.filter(s=>s.nivel==="Secundaria").length.toLocaleString("es-MX");
  }
  function renderAll(){renderMap();renderList();renderKpis();}

  function selectSchool(cct, move){
    selectedCct=cct;
    document.querySelectorAll(".school").forEach(x=>x.classList.toggle("active",x.dataset.cct===cct));
    const s=schools.find(x=>x.cct===cct), m=markers.get(cct);
    if(s&&m){
      if(move) map.setView([s.lat,s.lng],Math.max(map.getZoom(),14),{animate:true});
      m.openPopup();
    }
    const card=document.querySelector(`.school[data-cct="${CSS.escape(cct)}"]`);
    if(card&&move) card.scrollIntoView({block:"nearest",behavior:"smooth"});
  }

  function fitCurrent(){
    const pts=filtered.filter(s=>s.lat!=null&&s.lng!=null).map(s=>[s.lat,s.lng]);
    if(!pts.length) return;
    if(pts.length===1) map.setView(pts[0],14);
    else map.fitBounds(pts,{padding:[28,28],maxZoom:13});
  }

  function setQuick(mode){
    quickMode=mode;
    document.getElementById("chipAll").classList.toggle("active",mode==="all");
    document.getElementById("chipActive").classList.toggle("active",mode==="active");
    document.getElementById("chipAttention").classList.toggle("active",mode==="attention");
    applyFilters();
  }

  [els.q,els.level,els.region,els.municipality,els.condition,els.kits].forEach(el=>el.addEventListener(el===els.q?"input":"change",applyFilters));
  document.getElementById("reset").addEventListener("click",()=>{
    els.q.value="";els.level.value="";els.region.value="";els.municipality.value="";els.condition.value="";els.kits.value="";
    setQuick("all"); fitCurrent();
  });
  document.getElementById("chipAll").addEventListener("click",()=>setQuick("all"));
  document.getElementById("chipActive").addEventListener("click",()=>setQuick("active"));
  document.getElementById("chipAttention").addEventListener("click",()=>setQuick("attention"));
  document.getElementById("fit").addEventListener("click",fitCurrent);

  document.getElementById("downloadCsv").addEventListener("click",()=>{
    const cols=["CCT","Escuela","Nivel","Región","Municipio","Kits","Condición","Reporte original","Fecha reporte","Latitud","Longitud"];
    const rows=filtered.map(s=>[s.cct,s.escuela,s.nivel,s.region,s.municipio,s.kits??"",s.condicion,s.actividad_original,s.fecha_reporte,s.lat,s.lng]);
    const csv=[cols,...rows].map(r=>r.map(v=>`"${String(v??"").replace(/"/g,'""')}"`).join(",")).join("\r\n");
    const blob=new Blob(["\ufeff"+csv],{type:"text/csv;charset=utf-8"});
    const a=document.createElement("a");a.href=URL.createObjectURL(blob);a.download="mbot_jalisco_filtrado.csv";a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000);
  });

  setQuick("all");
  fitCurrent();
