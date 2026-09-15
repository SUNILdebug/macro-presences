const $ = s => document.querySelector(s);
const $$ = s => document.querySelectorAll(s);

let activeSession = null;
let allStudents = [];
let activeAttendanceList = [];
let refreshTimer = null;

// --- FONCTION D'AFFICHAGE DES MESSAGES ---
function showMessage(msg, type = "error") {
  const el = $("#message");
  if (!el) return;
  el.textContent = msg;
  el.className = `message ${type}`;
  el.classList.remove("hidden");
  setTimeout(() => el.classList.add("hidden"), 5000);
}

// --- GESTION DES MODALES ---
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

// --- AUTHENTIFICATION ---
async function checkAuth() {
  const { data: { session } } = await sb.auth.getSession();
  if (session) {
    showDashboard();
  } else {
    showLogin();
  }
}

function showLogin() {
  $("#loginSection").classList.remove("hidden");
  $("#dashboardSection").classList.add("hidden");
  if (refreshTimer) clearInterval(refreshTimer);
}

function showDashboard() {
  $("#loginSection").classList.add("hidden");
  $("#dashboardSection").classList.remove("hidden");
  loadDashboardData();
  if (!refreshTimer) {
    refreshTimer = setInterval(loadDashboardData, 10000); // Actualisation auto toutes les 10s
  }
}

// Connexion
$("#loginForm").onsubmit = async (e) => {
  e.preventDefault();
  const email = $("#email").value.trim();
  const password = $("#password").value.trim();
  $("#loginBtn").disabled = true;

  const { error } = await sb.auth.signInWithPassword({ email, password });
  $("#loginBtn").disabled = false;

  if (error) {
    showMessage("Échec de la connexion : " + error.message, "error");
  } else {
    showDashboard();
  }
};

// Déconnexion
$("#logoutBtn").onclick = async () => {
  await sb.auth.signOut();
  showLogin();
};

// --- CHARGEMENT DU TABLEAU DE BORD ---
async function loadDashboardData() {
  const { data, error } = await sb.rpc("get_professor_dashboard_data");

  if (error) {
    showMessage("Erreur lors du chargement : " + error.message, "error");
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

// --- RENDU : SÉANCE ACTIVE ---
function renderActiveSession() {
  if (activeSession) {
    $("#activeSessionSection").classList.remove("hidden");
    $("#noActiveSession").classList.add("hidden");

    $("#activeSessionDate").textContent = activeSession.session_date || "—";
    $("#activeSessionStart").textContent = activeSession.start_time || "—";
    $("#activeSessionEnd").textContent = activeSession.end_time || "—";
    $("#confirmationCode").textContent = activeSession.confirmation_code || "----";

    // QR Code
    const qrContainer = $("#qrcode");
    qrContainer.innerHTML = "";
    
    // URL relative pointant vers la page étudiant avec le token
    const studentUrl = `${window.location.origin}${window.location.pathname.replace('professor.html', 'student.html')}?session=${activeSession.qr_token}`;
    
    new QRCode(qrContainer, {
      text: studentUrl,
      width: 180,
      height: 180
    });

    // Liste des présents
    $("#presentCount").textContent = activeAttendanceList.length;
    const attListEl = $("#attendanceList");

    if (activeAttendanceList.length === 0) {
      attListEl.innerHTML = `<div class="empty-state">En attente de validation par les étudiants...</div>`;
    } else {
      attListEl.innerHTML = activeAttendanceList.map(a => `
        <div class="attendance-item">
          <strong>${a.nom} ${a.prenom}</strong>
          <span class="muted">${a.student_identifier} · ${a.parcours}</span>
          <span class="badge badge-active">${a.validation_time}</span>
        </div>
      `).join("");
    }
  } else {
    $("#activeSessionSection").classList.add("hidden");
    $("#noActiveSession").classList.remove("hidden");
  }
}

// --- RENDU : LISTE DES ÉTUDIANTS ---
function renderStudents() {
  const search = $("#studentSearch").value.toLowerCase().trim();
  const filterParcours = $("#studentParcoursFilter").value;

  const filtered = allStudents.filter(s => {
    const matchSearch = (s.nom + " " + s.prenom + " " + s.student_identifier).toLowerCase().includes(search);
    const matchParcours = filterParcours ? s.parcours === filterParcours : true;
    return matchSearch && matchParcours;
  });

  const aeStudents = filtered.filter(s => s.parcours === "Analyse économique");
  const eaStudents = filtered.filter(s => s.parcours === "Économétrie appliquée");

  $("#studentsAnalyseEconomique").innerHTML = buildStudentTable(aeStudents);
  $("#studentsEconometrieAppliquee").innerHTML = buildStudentTable(eaStudents);
}

function buildStudentTable(students) {
  if (!students.length) return `<p class="muted">Aucun étudiant trouvé.</p>`;

  return `
    <table class="data-table">
      <thead>
        <tr>
          <th>Code Apogée</th>
          <th>Nom & Prénom</th>
          <th>Actions</th>
        </tr>
      </thead>
      <tbody>
        ${students.map(s => `
          <tr>
            <td><code>${s.student_identifier}</code></td>
            <td><strong>${s.nom} ${s.prenom}</strong></td>
            <td>
              <button class="btn btn-sm btn-secondary" onclick="viewStudentDetail('${s.id}')">👁 Voir</button>
              <button class="btn btn-sm btn-ghost" onclick="openEditStudentModal('${s.id}')">✏️ Edit</button>
            </td>
          </tr>
        `).join("")}
      </tbody>
    </table>
  `;
}

// --- ACTIONS SESSIONS ---
$("#openSessionBtn").onclick = async () => {
  const { data, error } = await sb.rpc("open_session");
  if (error) {
    showMessage(error.message, "error");
  } else {
    showMessage("Nouvelle session ouverte avec succès !", "success");
    loadDashboardData();
  }
};

$("#closeSessionBtn").onclick = async () => {
  if (!confirm("Voulez-vous vraiment fermer la session en cours ?")) return;
  const { error } = await sb.rpc("close_session");
  if (error) {
    showMessage(error.message, "error");
  } else {
    showMessage("Session fermée.", "success");
    loadDashboardData();
  }
};

// --- GESTION ÉTUDIANT (AJOUT, ÉDITION, DÉTAILS) ---
$("#addStudentBtn").onclick = () => {
  $("#studentForm").reset();
  openModal("studentModal");
};

$("#studentForm").onsubmit = async (e) => {
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
    showMessage("Étudiant ajouté avec succès !", "success");
    closeModal("studentModal");
    loadDashboardData();
  }
};

window.openEditStudentModal = (id) => {
  const s = allStudents.find(x => x.id === id);
  if (!s) return;

  $("#editStudentId").value = s.id;
  $("#editStudentNom").value = s.nom;
  $("#editStudentPrenom").value = s.prenom;
  $("#editStudentCodeApogee").value = s.student_identifier;
  $("#editStudentParcours").value = s.parcours;

  openModal("editStudentModal");
};

$("#updateStudentBtn").onclick = async () => {
  const id = $("#editStudentId").value;
  const nom = $("#editStudentNom").value.trim();
  const prenom = $("#editStudentPrenom").value.trim();
  const parcours = $("#editStudentParcours").value;

  const { error } = await sb.rpc("update_student", {
    p_id: id,
    p_nom: nom,
    p_prenom: prenom,
    p_parcours: parcours
  });

  if (error) {
    showMessage(error.message, "error");
  } else {
    showMessage("Étudiant mis à jour !", "success");
    closeModal("editStudentModal");
    loadDashboardData();
  }
};

window.viewStudentDetail = async (id) => {
  const s = allStudents.find(x => x.id === id);
  if (!s) return;

  const { data, error } = await sb.rpc("get_student_detail", { p_student_id: id });
  
  if (error) {
    showMessage(error.message, "error");
    return;
  }

  const res = Array.isArray(data) ? data[0] : data;

  $("#studentDetailTitle").textContent = `${s.nom} ${s.prenom}`;
  $("#studentDetailContent").innerHTML = `
    <p><strong>Code Apogée :</strong> ${s.student_identifier}</p>
    <p><strong>Parcours :</strong> ${s.parcours}</p>
    <p><strong>Taux de présence :</strong> ${res?.attendance_rate || 0}% (${res?.present_count || 0} / ${res?.total_sessions || 0} séances)</p>
    <h3>Historique de présence :</h3>
    <ul class="detail-list">
      ${(res?.history || []).map(h => `
        <li>
          <span>${h.session_date} (${h.start_time})</span>
          <span class="badge ${h.status === 'Présent' ? 'badge-active' : 'badge-closed'}">${h.status}</span>
        </li>
      `).join("")}
    </ul>
  `;

  openModal("studentDetailModal");
};

// --- RENDU HISTORIQUE ET CLASSEMENT ---
function renderSessionsHistory(sessions) {
  const container = $("#sessionsList");
  if (!sessions.length) {
    container.innerHTML = `<p class="muted">Aucune séance enregistrée pour l'instant.</p>`;
    return;
  }

  container.innerHTML = `
    <table class="data-table">
      <thead>
        <tr>
          <th>Date</th>
          <th>Plage horaire</th>
          <th>Présents</th>
          <th>Statut</th>
        </tr>
      </thead>
      <tbody>
        ${sessions.map(s => `
          <tr>
            <td><strong>${s.session_date}</strong></td>
            <td>${s.start_time} - ${s.end_time || 'En cours'}</td>
            <td>${s.present_count} présent(s)</td>
            <td><span class="badge ${s.status === 'active' ? 'badge-active' : 'badge-closed'}">${s.status}</span></td>
          </tr>
        `).join("")}
      </tbody>
    </table>
  `;
}

function renderRanking(ranking) {
  const container = $("#rankingContainer");
  if (!ranking.length) {
    container.innerHTML = `<p class="muted">Aucune donnée de présence disponible.</p>`;
    return;
  }

  container.innerHTML = `
    <table class="data-table">
      <thead>
        <tr>
          <th>Étudiant</th>
          <th>Parcours</th>
          <th>Présences</th>
          <th>Taux</th>
        </tr>
      </thead>
      <tbody>
        ${ranking.map(r => `
          <tr>
            <td><strong>${r.nom} ${r.prenom}</strong></td>
            <td>${r.parcours}</td>
            <td>${r.present_count} / ${r.total_sessions}</td>
            <td><strong>${r.attendance_rate}%</strong></td>
          </tr>
        `).join("")}
      </tbody>
    </table>
  `;
}

// Filtres et recherche
$("#studentSearch").oninput = renderStudents;
$("#studentParcoursFilter").onchange = renderStudents;
$("#refreshBtn").onclick = loadDashboardData;

// Initialisation
setupModalClosers();
checkAuth();
