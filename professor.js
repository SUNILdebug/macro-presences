const $ = s => document.querySelector(s);
const $$ = s => document.querySelectorAll(s);

let activeSession = null;
let allStudents = [];
let activeAttendanceList = [];
let refreshTimer = null;

function showMessage(msg, type = "error") {
  const el = $("#message");
  if (!el) return;
  el.textContent = msg;
  el.className = `message ${type}`;
  el.classList.remove("hidden");
  setTimeout(() => el.classList.add("hidden"), 5000);
}

function openModal(modalId) {
  const m = $(`#${modalId}`);
  if (m) m.classList.remove("hidden");
}

function closeModal(modalId) {
  const m = $(`#${modalId}`);
  if (m) m.classList.add("hidden");
}

function setupModalClosers() {
  $$("[data-close-modal]").forEach(btn => {
    btn.onclick = () => {
      const modal = btn.closest(".modal");
      if (modal) modal.classList.add("hidden");
    };
  });
}

async function checkAuth() {
  const { data: { session } } = await sb.auth.getSession();
  if (session) showDashboard(); else showLogin();
}

function showLogin() {
  $("#loginSection")?.classList.remove("hidden");
  $("#dashboardSection")?.classList.add("hidden");
  if (refreshTimer) clearInterval(refreshTimer);
}

function showDashboard() {
  $("#loginSection")?.classList.add("hidden");
  $("#dashboardSection")?.classList.remove("hidden");
  loadDashboardData();
  if (!refreshTimer) refreshTimer = setInterval(loadDashboardData, 8000);
}

if ($("#loginForm")) {
  $("#loginForm").onsubmit = async (e) => {
    e.preventDefault();
    const email = $("#email").value.trim();
    const password = $("#password").value.trim();
    $("#loginBtn").disabled = true;

    const { error } = await sb.auth.signInWithPassword({ email, password });
    $("#loginBtn").disabled = false;

    if (error) showMessage("Échec de connexion : " + error.message, "error");
    else showDashboard();
  };
}

if ($("#logoutBtn")) {
  $("#logoutBtn").onclick = async () => {
    await sb.auth.signOut();
    showLogin();
  };
}

async function loadDashboardData() {
  const { data, error } = await sb.rpc("get_professor_dashboard_data");

  if (error) {
    showMessage("Erreur : " + error.message, "error");
    return;
  }

  const res = Array.isArray(data) ? data[0] : data;
  if (!res) return;

  activeSession = res.active_session || null;
  allStudents = res.students || [];
  activeAttendanceList = res.active_attendances || [];

  renderActiveSession();
  renderStudents();
  renderSessionsHistory(res.sessions_history || []);
  renderRanking(res.ranking || []);
}

function renderActiveSession() {
  const activeSec = $("#activeSessionSection");
  const noActiveSec = $("#noActiveSession");

  if (activeSession) {
    activeSec?.classList.remove("hidden");
    noActiveSec?.classList.add("hidden");

    if ($("#activeSessionDate")) $("#activeSessionDate").textContent = activeSession.session_date || "—";
    if ($("#activeSessionStart")) $("#activeSessionStart").textContent = activeSession.start_time ? new Date(activeSession.start_time).toLocaleTimeString("fr-FR", { hour: '2-digit', minute: '2-digit' }) : "—";
    if ($("#confirmationCode")) $("#confirmationCode").textContent = activeSession.confirmation_code || "----";

    const qrContainer = $("#qrcode");
    if (qrContainer) {
      qrContainer.innerHTML = "";
      const studentUrl = `${window.location.origin}${window.location.pathname.replace('professor.html', 'student.html')}?session=${encodeURIComponent(activeSession.qr_token)}`;
      
      try {
        if (typeof QRCode !== "undefined") {
          new QRCode(qrContainer, { text: studentUrl, width: 180, height: 180 });
        } else {
          qrContainer.innerHTML = `<img src="https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(studentUrl)}" alt="QR Code" />`;
        }
      } catch (e) {
        qrContainer.innerHTML = `<img src="https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(studentUrl)}" alt="QR Code" />`;
      }
    }

    if ($("#presentCount")) $("#presentCount").textContent = activeAttendanceList.length;
    const attListEl = $("#attendanceList");

    if (attListEl) {
      if (activeAttendanceList.length === 0) {
        attListEl.innerHTML = `<div class="empty">Aucune présence validée pour le moment.</div>`;
      } else {
        attListEl.innerHTML = activeAttendanceList.map(a => `
          <div class="present-row">
            <div>
              <strong>${a.nom} ${a.prenom}</strong>
              <br><small class="muted">Code: ${a.student_identifier}</small>
            </div>
            <span class="badge badge-active">${a.parcours}</span>
          </div>
        `).join("");
      }
    }
  } else {
    activeSec?.classList.add("hidden");
    noActiveSec?.classList.remove("hidden");
  }
}

function renderStudents() {
  const search = $("#studentSearch") ? $("#studentSearch").value.toLowerCase().trim() : "";
  const filterParcours = $("#studentParcoursFilter") ? $("#studentParcoursFilter").value : "";

  const filtered = allStudents.filter(s => {
    const matchSearch = (s.nom + " " + s.prenom + " " + s.student_identifier).toLowerCase().includes(search);
    const matchParcours = filterParcours ? s.parcours === filterParcours : true;
    return matchSearch && matchParcours;
  });

  const aeStudents = filtered.filter(s => s.parcours.toLowerCase().includes("analyse"));
  const eaStudents = filtered.filter(s => s.parcours.toLowerCase().includes("économétrie") || s.parcours.toLowerCase().includes("econometrie"));

  if ($("#studentsAnalyseEconomique")) $("#studentsAnalyseEconomique").innerHTML = buildStudentTable(aeStudents);
  if ($("#studentsEconometrieAppliquee")) $("#studentsEconometrieAppliquee").innerHTML = buildStudentTable(eaStudents);
}

function buildStudentTable(students) {
  if (!students.length) return `<div class="empty">Aucun étudiant dans ce groupe.</div>`;

  return `
    <div class="table-wrap">
      <table>
        <thead>
          <tr>
            <th>Apogée</th>
            <th>Nom & Prénom</th>
            <th>Parcours</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          ${students.map(s => `
            <tr>
              <td><code>${s.student_identifier}</code></td>
              <td><strong>${s.nom} ${s.prenom}</strong></td>
              <td><span class="badge badge-neutral">${s.parcours}</span></td>
              <td>
                <button class="btn btn-secondary" onclick="editStudent(${s.id})">✏️ Modifier</button>
              </td>
            </tr>
          `).join("")}
        </tbody>
      </table>
    </div>
  `;
}

window.editStudent = (id) => {
  const s = allStudents.find(x => x.id === id);
  if (!s) return;

  if ($("#studentIdInput")) $("#studentIdInput").value = s.id;
  if ($("#studentNomInput")) $("#studentNomInput").value = s.nom;
  if ($("#studentPrenomInput")) $("#studentPrenomInput").value = s.prenom;
  if ($("#studentCodeApogeeInput")) $("#studentCodeApogeeInput").value = s.student_identifier;
  if ($("#studentParcoursInput")) $("#studentParcoursInput").value = s.parcours;
  
  openModal("studentModal");
};

if ($("#openSessionBtn")) {
  $("#openSessionBtn").onclick = async () => {
    const { error } = await sb.rpc("open_session");
    if (error) showMessage(error.message, "error");
    else {
      showMessage("Session ouverte !", "success");
      loadDashboardData();
    }
  };
}

if ($("#closeSessionBtn")) {
  $("#closeSessionBtn").onclick = async () => {
    if (!confirm("Fermer la session en cours ?")) return;
    const { error } = await sb.rpc("close_session");
    if (error) showMessage(error.message, "error");
    else {
      showMessage("Session fermée.", "success");
      loadDashboardData();
    }
  };
}

if ($("#addStudentBtn")) {
  $("#addStudentBtn").onclick = () => {
    if ($("#studentForm")) $("#studentForm").reset();
    if ($("#studentIdInput")) $("#studentIdInput").value = "";
    openModal("studentModal");
  };
}

if ($("#studentForm")) {
  $("#studentForm").onsubmit = async (e) => {
    e.preventDefault();
    const id = $("#studentIdInput") ? $("#studentIdInput").value : "";
    const nom = $("#studentNomInput").value.trim();
    const prenom = $("#studentPrenomInput").value.trim();
    const student_identifier = $("#studentCodeApogeeInput").value.trim();
    const parcours = $("#studentParcoursInput").value;

    let error;
    if (id) {
      const res = await sb.from("students").update({
        nom: nom,
        prenom: prenom,
        student_identifier: student_identifier,
        parcours: parcours
      }).eq("id", id);
      error = res.error;
    } else {
      const res = await sb.rpc("add_student", {
        p_nom: nom,
        p_prenom: prenom,
        p_identifier: student_identifier,
        p_parcours: parcours
      });
      error = res.error;
    }

    if (error) {
      showMessage(error.message, "error");
    } else {
      showMessage("Enregistrement réussi !", "success");
      closeModal("studentModal");
      loadDashboardData();
    }
  };
}

function renderSessionsHistory(sessions) {
  const container = $("#sessionsList");
  if (!container) return;

  if (!sessions.length) {
    container.innerHTML = `<div class="empty">Aucune séance enregistrée.</div>`;
    return;
  }

  container.innerHTML = `
    <div class="table-wrap">
      <table>
        <thead>
          <tr>
            <th>Date</th>
            <th>Statut</th>
            <th>Présents</th>
          </tr>
        </thead>
        <tbody>
          ${sessions.map(s => `
            <tr>
              <td><strong>${s.session_date}</strong></td>
              <td><span class="badge ${s.status === 'ACTIVE' ? 'badge-active' : 'badge-closed'}">${s.status}</span></td>
              <td><strong>${s.present_count}</strong> présent(s)</td>
            </tr>
          `).join("")}
        </tbody>
      </table>
    </div>
  `;
}

function renderRanking(ranking) {
  const container = $("#rankingContainer");
  if (!container) return;

  if (!ranking.length) {
    container.innerHTML = `<div class="empty">Aucun bilan disponible.</div>`;
    return;
  }

  const aeRanking = ranking.filter(r => r.parcours.toLowerCase().includes("analyse"));
  const eaRanking = ranking.filter(r => r.parcours.toLowerCase().includes("économétrie") || r.parcours.toLowerCase().includes("econometrie"));

  container.innerHTML = `
    <div style="margin-bottom: 24px;">
      <h3 style="color: #2563eb; margin-bottom: 8px;">📊 Parcours : Analyse Économique</h3>
      ${buildRankingTable(aeRanking)}
    </div>
    <div>
      <h3 style="color: #2563eb; margin-bottom: 8px;">📊 Parcours : Économétrie Appliquée</h3>
      ${buildRankingTable(eaRanking)}
    </div>
  `;
}

function buildRankingTable(list) {
  if (!list.length) return `<div class="empty">Aucune donnée pour ce parcours.</div>`;

  return `
    <div class="table-wrap">
      <table>
        <thead>
          <tr>
            <th>Nom & Prénom</th>
            <th>Présences</th>
            <th>Absences</th>
            <th>Taux de Présence</th>
          </tr>
        </thead>
        <tbody>
          ${list.map(r => `
            <tr>
              <td><strong>${r.nom} ${r.prenom}</strong></td>
              <td>${r.present_count} / ${r.total_sessions}</td>
              <td><strong style="color: #ef4444;">${(r.total_sessions - r.present_count)}</strong></td>
              <td><strong>${r.attendance_rate}%</strong></td>
            </tr>
          `).join("")}
        </tbody>
      </table>
    </div>
  `;
}

if ($("#studentSearch")) $("#studentSearch").oninput = renderStudents;
if ($("#studentParcoursFilter")) $("#studentParcoursFilter").onchange = renderStudents;
if ($("#refreshBtn")) $("#refreshBtn").onclick = loadDashboardData;

setupModalClosers();
checkAuth();
