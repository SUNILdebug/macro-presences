const $ = s => document.querySelector(s);
const $$ = s => document.querySelectorAll(s);

let activeSession = null;
let allStudents = [];
let activeAttendanceList = [];
let refreshTimer = null;

// Utility functions
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

// Authentication handling
async function checkAuth() {
  const { data: { session } } = await sb.auth.getSession();
  if (session) {
    showDashboard();
  } else {
    showLogin();
  }
}

function showLogin() {
  const loginSection = $("#loginSection");
  const dashboardSection = $("#dashboardSection");
  if (loginSection) loginSection.classList.remove("hidden");
  if (dashboardSection) dashboardSection.classList.add("hidden");
  if (refreshTimer) clearInterval(refreshTimer);
}

function showDashboard() {
  const loginSection = $("#loginSection");
  const dashboardSection = $("#dashboardSection");
  if (loginSection) loginSection.classList.add("hidden");
  if (dashboardSection) dashboardSection.classList.remove("hidden");
  
  loadDashboardData();
  if (!refreshTimer) {
    refreshTimer = setInterval(loadDashboardData, 8000);
  }
}

const loginForm = $("#loginForm");
if (loginForm) {
  loginForm.onsubmit = async (e) => {
    e.preventDefault();
    const email = $("#email").value.trim();
    const password = $("#password").value.trim();
    $("#loginBtn").disabled = true;

    const { error } = await sb.auth.signInWithPassword({ email, password });
    $("#loginBtn").disabled = false;

    if (error) {
      showMessage("Échec de connexion : " + error.message, "error");
    } else {
      showDashboard();
    }
  };
}

const logoutBtn = $("#logoutBtn");
if (logoutBtn) {
  logoutBtn.onclick = async () => {
    await sb.auth.signOut();
    showLogin();
  };
}

// Data fetching
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

// Render active session and QR code
function renderActiveSession() {
  const activeSec = $("#activeSessionSection");
  const noActiveSec = $("#noActiveSession");

  if (activeSession) {
    if (activeSec) activeSec.classList.remove("hidden");
    if (noActiveSec) noActiveSec.classList.add("hidden");

    const dateEl = $("#activeSessionDate");
    const startEl = $("#activeSessionStart");
    const codeEl = $("#confirmationCode");
    const countEl = $("#presentCount");

    if (dateEl) dateEl.textContent = activeSession.session_date || "—";
    if (startEl) startEl.textContent = activeSession.start_time ? new Date(activeSession.start_time).toLocaleTimeString("fr-FR", { hour: '2-digit', minute: '2-digit' }) : "—";
    if (codeEl) codeEl.textContent = activeSession.confirmation_code || "----";

    const qrContainer = $("#qrcode");
    if (qrContainer) {
      qrContainer.innerHTML = "";
      const studentUrl = `${window.location.origin}${window.location.pathname.replace('professor.html', 'student.html')}?session=${activeSession.qr_token}`;
      new QRCode(qrContainer, { text: studentUrl, width: 180, height: 180 });
    }

    if (countEl) countEl.textContent = activeAttendanceList.length;
    const attListEl = $("#attendanceList");

    if (attListEl) {
      if (activeAttendanceList.length === 0) {
        attListEl.innerHTML = `<div class="empty">En attente des validations d'étudiants...</div>`;
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
    if (activeSec) activeSec.classList.add("hidden");
    if (noActiveSec) noActiveSec.classList.remove("hidden");
  }
}

// Render student list separated by track
function renderStudents() {
  const searchInput = $("#studentSearch");
  const parcoursSelect = $("#studentParcoursFilter");

  const search = searchInput ? searchInput.value.toLowerCase().trim() : "";
  const filterParcours = parcoursSelect ? parcoursSelect.value : "";

  const filtered = allStudents.filter(s => {
    const matchSearch = (s.nom + " " + s.prenom + " " + s.student_identifier).toLowerCase().includes(search);
    const matchParcours = filterParcours ? s.parcours === filterParcours : true;
    return matchSearch && matchParcours;
  });

  const aeStudents = filtered.filter(s => s.parcours === "Analyse Économique" || s.parcours === "Analyse économique");
  const eaStudents = filtered.filter(s => s.parcours === "Économétrie Appliquée" || s.parcours === "Économétrie appliquée");

  const aeContainer = $("#studentsAnalyseEconomique");
  const eaContainer = $("#studentsEconometrieAppliquee");

  if (aeContainer) aeContainer.innerHTML = buildStudentTable(aeStudents);
  if (eaContainer) eaContainer.innerHTML = buildStudentTable(eaStudents);
}

function buildStudentTable(students) {
  if (!students.length) return `<div class="empty">Aucun étudiant dans ce groupe.</div>`;

  return `
    <div class="table-wrap">
      <table>
        <thead>
          <tr>
            <th>Code Apogée</th>
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
                <button class="btn btn-secondary" onclick="editStudent('${s.id}', '${s.nom.replace(/'/g, "\\'")}', '${s.prenom.replace(/'/g, "\\'")}', '${s.student_identifier}', '${s.parcours}')">✏️ Modifier</button>
              </td>
            </tr>
          `).join("")}
        </tbody>
      </table>
    </div>
  `;
}

// Edit student modal helper
window.editStudent = (id, nom, prenom, identifier, parcours) => {
  $("#studentIdInput").value = id;
  $("#studentNomInput").value = nom;
  $("#studentPrenomInput").value = prenom;
  $("#studentCodeApogeeInput").value = identifier;
  $("#studentParcoursInput").value = parcours;
  openModal("studentModal");
};

// Session Actions
const openSessionBtn = $("#openSessionBtn");
if (openSessionBtn) {
  openSessionBtn.onclick = async () => {
    const { error } = await sb.rpc("open_session");
    if (error) showMessage(error.message, "error");
    else {
      showMessage("Nouvelle session ouverte !", "success");
      loadDashboardData();
    }
  };
}

const closeSessionBtn = $("#closeSessionBtn");
if (closeSessionBtn) {
  closeSessionBtn.onclick = async () => {
    if (!confirm("Voulez-vous vraiment fermer cette session ?")) return;
    const { error } = await sb.rpc("close_session");
    if (error) showMessage(error.message, "error");
    else {
      showMessage("Session fermée avec succès", "success");
      loadDashboardData();
    }
  };
}

// Student form (Add / Edit)
const addStudentBtn = $("#addStudentBtn");
if (addStudentBtn) {
  addStudentBtn.onclick = () => {
    const form = $("#studentForm");
    if (form) form.reset();
    const idInput = $("#studentIdInput");
    if (idInput) idInput.value = "";
    openModal("studentModal");
  };
}

const studentForm = $("#studentForm");
if (studentForm) {
  studentForm.onsubmit = async (e) => {
    e.preventDefault();
    const nom = $("#studentNomInput").value.trim();
    const prenom = $("#studentPrenomInput").value.trim();
    const student_identifier = $("#studentCodeApogeeInput").value.trim();
    const parcours = $("#studentParcoursInput").value;

    const { error } = await sb.rpc("add_student", {
      p_nom: nom,
      p_prenom: prenom,
      p_identifier: student_identifier,
      p_parcours: parcours
    });

    if (error) {
      showMessage(error.message, "error");
    } else {
      showMessage("Étudiant enregistré avec succès !", "success");
      closeModal("studentModal");
      loadDashboardData();
    }
  };
}

// Render Sessions History
function renderSessionsHistory(sessions) {
  const container = $("#sessionsList");
  if (!container) return;

  if (!sessions.length) {
    container.innerHTML = `<div class="empty">Aucune séance dans l'historique.</div>`;
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
              <td><strong>${s.present_count}</strong> étudiant(s)</td>
            </tr>
          `).join("")}
        </tbody>
      </table>
    </div>
  `;
}

// Render Overall Attendance & Ranking
function renderRanking(ranking) {
  const container = $("#rankingContainer");
  if (!container) return;

  if (!ranking.length) {
    container.innerHTML = `<div class="empty">Aucune donnée de bilan disponible.</div>`;
    return;
  }

  container.innerHTML = `
    <div class="table-wrap">
      <table>
        <thead>
          <tr>
            <th>Nom & Prénom</th>
            <th>Parcours</th>
            <th>Présences</th>
            <th>Absences</th>
            <th>Taux de Présence</th>
          </tr>
        </thead>
        <tbody>
          ${ranking.map(r => `
            <tr>
              <td><strong>${r.nom} ${r.prenom}</strong></td>
              <td><span class="badge badge-neutral">${r.parcours}</span></td>
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

// Dynamic Search & Filter events
const studentSearch = $("#studentSearch");
if (studentSearch) studentSearch.oninput = renderStudents;

const studentParcoursFilter = $("#studentParcoursFilter");
if (studentParcoursFilter) studentParcoursFilter.onchange = renderStudents;

const refreshBtn = $("#refreshBtn");
if (refreshBtn) refreshBtn.onclick = loadDashboardData;

setupModalClosers();
checkAuth();
