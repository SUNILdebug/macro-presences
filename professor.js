const $ = (s)=>document.querySelector(s);
let students=[], sessions=[], activeSession=null, refreshTimer=null;

function msg(text, type=""){const el=$("#loginMsg"); el.textContent=text; el.className="message "+type}
function toast(text){const el=$("#toast");el.textContent=text;el.style.display="block";setTimeout(()=>el.style.display="none",2800)}
function esc(v){return String(v??"").replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[m]))}
function fmtTime(v){return new Date(v).toLocaleTimeString("fr-FR",{hour:"2-digit",minute:"2-digit"})}
function fmtDate(v){return new Date(v+"T12:00:00").toLocaleDateString("fr-FR",{day:"2-digit",month:"2-digit",year:"numeric"})}
function statusBadge(s){const cls=s==="ACTIVE"?"badge-active":s==="FERMEE"||s==="EXPIREE"?"badge-closed":"badge-neutral";return `<span class="badge ${cls}">${s}</span>`}

async function init(){
  const {data:{session}}=await sb.auth.getSession();
  if(session) showDashboard(); else showLogin();
  sb.auth.onAuthStateChange((_e,s)=>s?showDashboard():showLogin());
}
function showLogin(){$("#loginView").classList.remove("hidden");$("#dashboardView").classList.add("hidden");$("#logoutBtn").classList.add("hidden")}
async function showDashboard(){
  $("#loginView").classList.add("hidden");$("#dashboardView").classList.remove("hidden");$("#logoutBtn").classList.remove("hidden");
  await loadAll();
  clearInterval(refreshTimer);refreshTimer=setInterval(loadAll,10000);
}
async function loadAll(){
  await Promise.all([loadStudents(),loadSessions()]);
  await loadActive();
  renderStats();
}
async function loadStudents(){
  const {data,error}=await sb.from("students").select("*").order("nom").order("prenom");
  if(error){toast(error.message);return} students=data||[]; renderStudents();
}
async function loadSessions(){
  const {data,error}=await sb.from("sessions").select("*").order("start_time",{ascending:false});
  if(error){toast(error.message);return} sessions=data||[]; renderSessions();
}
async function loadActive(){
  await sb.rpc("expire_sessions");
  const {data,error}=await sb.from("sessions").select("*").eq("status","ACTIVE").order("start_time",{ascending:false}).limit(1);
  if(error){toast(error.message);return}
  activeSession=data?.[0]||null; renderActive();
}
function renderStats(){
  const total=students.length;
  let present=0;
  if(activeSession) present=0;
  const today=new Date().toISOString().slice(0,10);
  $("#globalStats").innerHTML=[
    ["👥",total,"Étudiants"],
    ["📅",sessions.length,"Séances"],
    ["▶",activeSession?"1":"0","Séance active"],
    ["✓",present,"Présents actuels"]
  ].map(x=>`<div class="stat"><div>${x[0]}</div><div class="stat-value">${x[1]}</div><div class="stat-label">${x[2]}</div></div>`).join("");
}
function renderStudents(){
  const q=$("#studentSearch").value.toLowerCase(), f=$("#trackFilter").value;
  const rows=students.filter(s=>(!q||`${s.nom} ${s.prenom} ${s.student_identifier}`.toLowerCase().includes(q))&&(!f||s.parcours===f));
  $("#studentsBody").innerHTML=rows.length?rows.map(s=>`<tr><td><strong>${esc(s.student_identifier)}</strong></td><td>${esc(s.nom)}</td><td>${esc(s.prenom)}</td><td>${esc(s.parcours)}</td><td><button class="btn btn-secondary" onclick="editStudent(${s.id})">Modifier</button> <button class="btn btn-danger" onclick="deleteStudent(${s.id})">Supprimer</button></td></tr>`).join(""):`<tr><td colspan="5">Aucun étudiant.</td></tr>`;
}
function renderSessions(){
  $("#sessionsBody").innerHTML=sessions.length?sessions.map(s=>`<tr><td>${fmtDate(s.session_date)}</td><td>${fmtTime(s.start_time)} — ${fmtTime(s.end_time)}</td><td>${statusBadge(s.status)}</td><td id="count-${s.id}">…</td><td><button class="btn btn-secondary" onclick="showSession(${s.id})">Voir</button></td></tr>`).join(""):`<tr><td colspan="5">Aucune séance.</td></tr>`;
  sessions.forEach(async s=>{const {count}=await sb.from("attendances").select("*",{count:"exact",head:true}).eq("session_id",s.id);const el=$(`#count-${s.id}`);if(el)el.textContent=count??0});
}
async function renderActive(){
  const panel=$("#sessionContent"), close=$("#closeSessionBtn");
  if(!activeSession){$("#sessionMeta").textContent="Aucune séance active.";close.classList.add("hidden");panel.innerHTML='<div class="empty">Aucune séance active. Clique sur « Ouvrir la séance ».</div>';return}
  $("#sessionMeta").textContent=`${fmtDate(activeSession.session_date)} · ${fmtTime(activeSession.start_time)} — ${fmtTime(activeSession.end_time)}`;
  close.classList.remove("hidden");
  const url=`${location.origin}${location.pathname.replace(/professor\.html$/,"student.html")}?session=${encodeURIComponent(activeSession.qr_token)}`;
  const qr=`https://api.qrserver.com/v1/create-qr-code/?size=320x320&data=${encodeURIComponent(url)}`;
  const {data:att}=await sb.from("attendances").select("validated_at, students(student_identifier,nom,prenom,parcours)").eq("session_id",activeSession.id).order("validated_at",{ascending:false});
  const list=att||[];
  panel.innerHTML=`<div class="session-live">
    <div>
      <div class="badge badge-active">● SÉANCE ACTIVE</div>
      <p class="muted">Code à lire à voix haute — il n'apparaît jamais sur l'écran étudiant avant que tu le donnes.</p>
      <div class="code-big">${esc(activeSession.confirmation_code)}</div>
      <h3>Présents : ${list.length} / ${students.length}</h3>
      <div class="present-list">${list.length?list.map(a=>`<div class="present-row"><span><strong>${esc(a.students.nom)} ${esc(a.students.prenom)}</strong><br><small>${esc(a.students.student_identifier)} · ${esc(a.students.parcours)}</small></span><span>${fmtTime(a.validated_at)}</span></div>`).join(""):'<div class="empty">Aucune présence pour le moment.</div>'}</div>
    </div>
    <div class="qr-box"><img src="${qr}" alt="QR de la séance"><small>Scannez ce QR avec le téléphone étudiant.</small></div>
  </div>`;
}
async function openSession(){
  if(activeSession){toast("Une séance est déjà active.");return}
  const duration=120;
  const {data,error}=await sb.rpc("open_session",{p_duration_minutes:duration});
  if(error){toast(error.message);return}
  activeSession=data;toast("Séance ouverte.");await loadAll();
}
async function closeSession(){
  if(!activeSession)return;
  if(!confirm("Fermer immédiatement cette séance ? Le QR et le code deviendront invalides."))return;
  const {error}=await sb.rpc("close_session",{p_session_id:activeSession.id});
  if(error){toast(error.message);return}
  activeSession=null;toast("Séance fermée.");await loadAll();
}
function openModal(html){$("#modalContent").innerHTML=html;$("#modal").classList.remove("hidden")}
function closeModal(){$("#modal").classList.add("hidden")}
function addStudent(){
  openModal(`<h2>Ajouter un étudiant</h2>
  <form id="studentForm">
  <label>Nom<input name="nom" required></label>
  <label>Prénom<input name="prenom" required></label>
  <label>Parcours<select name="parcours" required><option value="Analyse économique">Analyse économique</option><option value="Économétrie appliquée">Économétrie appliquée</option></select></label>
  <button class="btn btn-primary" type="submit">Créer l'étudiant</button>
  </form>`);
  $("#studentForm").onsubmit=async e=>{e.preventDefault();const f=new FormData(e.target);const {data,error}=await sb.rpc("register_student",{p_nom:f.get("nom"),p_prenom:f.get("prenom"),p_parcours:f.get("parcours")});if(error){toast(error.message);return}closeModal();toast(`Étudiant créé : ${data.student_identifier}`);await loadStudents();};
}
function editStudent(id){
 const s=students.find(x=>x.id===id);if(!s)return;
 openModal(`<h2>Modifier l'étudiant</h2><form id="editForm"><label>Identifiant<input value="${esc(s.student_identifier)}" disabled></label><label>Nom<input name="nom" value="${esc(s.nom)}" required></label><label>Prénom<input name="prenom" value="${esc(s.prenom)}" required></label><label>Parcours<select name="parcours"><option ${s.parcours==="Analyse économique"?"selected":""}>Analyse économique</option><option ${s.parcours==="Économétrie appliquée"?"selected":""}>Économétrie appliquée</option></select></label><button class="btn btn-primary">Enregistrer</button></form>`);
 $("#editForm").onsubmit=async e=>{e.preventDefault();const f=new FormData(e.target);const {error}=await sb.from("students").update({nom:f.get("nom"),prenom:f.get("prenom"),parcours:f.get("parcours")}).eq("id",id);if(error){toast(error.message);return}closeModal();await loadStudents();toast("Étudiant modifié.");}
}
async function deleteStudent(id){if(!confirm("Supprimer cet étudiant ? Ses présences associées seront également supprimées."))return;const {error}=await sb.from("students").delete().eq("id",id);if(error){toast(error.message);return}await loadAll();toast("Étudiant supprimé.")}
async function showSession(id){
 const s=sessions.find(x=>x.id===id);if(!s)return;$("#detailTitle").textContent=`${fmtDate(s.session_date)} · ${fmtTime(s.start_time)} — ${fmtTime(s.end_time)}`;
 const {data:att,error}=await sb.from("attendances").select("validated_at,students(student_identifier,nom,prenom,parcours)").eq("session_id",id).order("validated_at");
 if(error){$("#sessionDetail").textContent=error.message;return}
 const presentIds=new Set((att||[]).map(x=>x.students.student_identifier));
 const rows=students.map(st=>({st,present:presentIds.has(st.student_identifier)}));
 $("#sessionDetail").innerHTML=`<div class="table-wrap"><table><thead><tr><th>Étudiant</th><th>Parcours</th><th>Présence</th><th>Heure</th></tr></thead><tbody>${rows.map(r=>{const a=(att||[]).find(x=>x.students.student_identifier===r.st.student_identifier);return `<tr><td><strong>${esc(r.st.nom)} ${esc(r.st.prenom)}</strong><br><small>${esc(r.st.student_identifier)}</small></td><td>${esc(r.st.parcours)}</td><td>${r.present?'<span class="badge badge-active">Présent</span>':'<span class="badge badge-closed">Absent</span>'}</td><td>${a?fmtTime(a.validated_at):"—"}</td></tr>`}).join("")}</tbody></table></div>`;
}
$("#loginForm").onsubmit=async e=>{e.preventDefault();msg("Connexion…");const {error}=await sb.auth.signInWithPassword({email:$("#email").value,password:$("#password").value});if(error)msg(error.message,"error")};
$("#logoutBtn").onclick=()=>sb.auth.signOut();
$("#openSessionBtn").onclick=openSession;$("#closeSessionBtn").onclick=closeSession;$("#refreshBtn").onclick=loadAll;$("#addStudentBtn").onclick=addStudent;$("#modalClose").onclick=closeModal;$("#modal").onclick=e=>{if(e.target.id==="modal")closeModal()};$("#studentSearch").oninput=renderStudents;$("#trackFilter").onchange=renderStudents;
init();
