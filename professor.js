/* =========================================================
   MACROÉCONOMIE 3 — PROFESSOR
   ========================================================= */

let students = [];
let sessions = [];
let activeSession = null;
let refreshTimer = null;


/* =========================================================
   UTILITAIRES
   ========================================================= */

function escapeHtml(value) {
  if (value === null || value === undefined) return "";

  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}


function showMessage(elementId, message, type = "") {
  const element = document.getElementById(elementId);

  if (!element) return;

  element.textContent = message;
  element.className = "message";

  if (type) {
    element.classList.add(type);
  }
}


function formatDate(dateValue) {
  if (!dateValue) return "—";

  const date = new Date(dateValue);

  if (Number.isNaN(date.getTime())) {
    return String(dateValue);
  }

  return date.toLocaleDateString("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric"
  });
}


function formatTime(timeValue) {
  if (!timeValue) return "—";

  return String(timeValue).substring(0, 5);
}


function formatDateTime(dateValue, timeValue = null) {
  if (timeValue) {
    return `${formatDate(dateValue)} à ${formatTime(timeValue)}`;
  }

  return formatDate(dateValue);
}


function normalizeCode(code) {
  return String(code || "").trim().toUpperCase();
}


function getTrackClass(track) {
  if (track === "Analyse économique") {
    return "track-economic";
  }

  return "track-econometrics";
}


function getStatusLabel(status) {
  const labels = {
    PROGRAMMEE: "Programmée",
    ACTIVE: "Active",
    FERMEE: "Fermée",
    EXPIREE: "Expirée"
  };

  return labels[status] || status || "—";
}


function getStatusClass(status) {
  const classes = {
    PROGRAMMEE: "status-programmee",
    ACTIVE: "status-active",
    FERMEE: "status-fermee",
    EXPIREE: "status-expiree"
  };

  return classes[status] || "";
}


/* =========================================================
   AUTHENTIFICATION
   ========================================================= */

async function getCurrentUser() {
  const {
    data,
    error
  } = await sb.auth.getUser();

  if (error) {
    console.error(error);
    return null;
  }

  return data?.user || null;
}


async function checkAuthentication() {
  const user = await getCurrentUser();

  if (!user) {
    document.getElementById("loginSection").hidden = false;
    document.getElementById("dashboardSection").hidden = true;
    document.getElementById("logoutBtn").hidden = true;
    return false;
  }

  document.getElementById("loginSection").hidden = true;
  document.getElementById("dashboardSection").hidden = false;
  document.getElementById("logoutBtn").hidden = false;

  await initializeDashboard();

  return true;
}


async function loginProfessor(event) {
  event.preventDefault();

  const email = document.getElementById("email").value.trim();
  const password = document.getElementById("password").value;

  showMessage("loginMessage", "Connexion en cours...");

  const {
    data,
    error
  } = await sb.auth.signInWithPassword({
    email,
    password
  });

  if (error) {
    console.error(error);

    showMessage(
      "loginMessage",
      error.message || "Impossible de se connecter.",
      "error"
    );

    return;
  }

  if (!data?.user) {
    showMessage(
      "loginMessage",
      "Connexion impossible.",
      "error"
    );

    return;
  }

  const authenticated = await checkAuthentication();

  if (!authenticated) {
    showMessage(
      "loginMessage",
      "Ce compte ne possède pas les droits professeur.",
      "error"
    );
  }
}


async function logoutProfessor() {
  await sb.auth.signOut();

  if (refreshTimer) {
    clearInterval(refreshTimer);
    refreshTimer = null;
  }

  window.location.reload();
}


/* =========================================================
   CHARGEMENT DU TABLEAU DE BORD
   ========================================================= */

async function initializeDashboard() {
  await loadStudents();
  await loadSessions();
  await loadActiveSession();

  renderStudents();
  renderRanking();
  renderHistory();

  startAutomaticRefresh();
}


function startAutomaticRefresh() {
  if (refreshTimer) {
    clearInterval(refreshTimer);
  }

  refreshTimer = setInterval(async () => {
    if (document.hidden) return;

    await loadSessions();
    await loadActiveSession();

    renderStudents();
    renderRanking();
    renderHistory();
  }, 10000);
}


/* =========================================================
   ÉTUDIANTS
   ========================================================= */

async function loadStudents() {
  const {
    data,
    error
  } = await sb
    .from("students")
    .select("*")
    .order("nom", { ascending: true })
    .order("prenom", { ascending: true });

  if (error) {
    console.error("Erreur étudiants :", error);

    showMessage(
      "studentFormMessage",
      "Impossible de charger les étudiants.",
      "error"
    );

    return;
  }

  students = data || [];
}


async function registerStudent(event) {
  event.preventDefault();

  const nom = document.getElementById("studentNom").value.trim();
  const prenom = document.getElementById("studentPrenom").value.trim();
  const codeApogee = normalizeCode(
    document.getElementById("studentCodeApogee").value
  );
  const parcours = document.getElementById("studentParcours").value;

  if (!nom || !prenom || !codeApogee || !parcours) {
    showMessage(
      "studentFormMessage",
      "Veuillez remplir tous les champs.",
      "error"
    );

    return;
  }

  showMessage(
    "studentFormMessage",
    "Enregistrement en cours..."
  );

  const {
    data,
    error
  } = await sb.rpc("register_student", {
    p_nom: nom,
    p_prenom: prenom,
    p_code_apogee: codeApogee,
    p_parcours: parcours
  });

  if (error) {
    console.error("Erreur register_student :", error);

    showMessage(
      "studentFormMessage",
      error.message || "Impossible d'enregistrer l'étudiant.",
      "error"
    );

    return;
  }

  console.log("Étudiant enregistré :", data);

  document.getElementById("studentForm").reset();

  closeModal("studentModal");

  await loadStudents();

  renderStudents();
  renderRanking();
}


async function updateStudent(event) {
  event.preventDefault();

  const id = document.getElementById("editStudentId").value;
  const nom = document.getElementById("editStudentNom").value.trim();
  const prenom = document.getElementById("editStudentPrenom").value.trim();
  const parcours = document.getElementById("editStudentParcours").value;

  if (!id || !nom || !prenom || !parcours) {
    showMessage(
      "editStudentMessage",
      "Veuillez remplir tous les champs.",
      "error"
    );

    return;
  }

  const {
    error
  } = await sb
    .from("students")
    .update({
      nom,
      prenom,
      parcours
    })
    .eq("id", id);

  if (error) {
    console.error("Erreur modification étudiant :", error);

    showMessage(
      "editStudentMessage",
      error.message || "Impossible de modifier l'étudiant.",
      "error"
    );

    return;
  }

  closeModal("editStudentModal");

  await loadStudents();

  renderStudents();
  renderRanking();
}


async function deleteStudent(studentId) {
  const student = students.find(
    item => String(item.id) === String(studentId)
  );

  if (!student) return;

  const confirmed = window.confirm(
    `Supprimer ${student.prenom} ${student.nom} ?\n\nSes présences associées seront également supprimées.`
  );

  if (!confirmed) return;

  const {
    error
  } = await sb
    .from("students")
    .delete()
    .eq("id", studentId);

  if (error) {
    console.error("Erreur suppression étudiant :", error);

    alert(
      error.message || "Impossible de supprimer l'étudiant."
    );

    return;
  }

  await loadStudents();

  renderStudents();
  renderRanking();
}


/* =========================================================
   AFFICHAGE DES ÉTUDIANTS
   ========================================================= */

function renderStudents() {
  const economicContainer =
    document.getElementById("economicStudents");

  const econometricsContainer =
    document.getElementById("econometricsStudents");

  if (!economicContainer || !econometricsContainer) {
    return;
  }

  const search =
    document.getElementById("studentSearch")
      ?.value
      .trim()
      .toLowerCase() || "";

  const filter =
    document.getElementById("trackFilter")
      ?.value || "";

  const filtered = students.filter(student => {
    const fullText = [
      student.nom,
      student.prenom,
      student.student_identifier,
      student.parcours
    ]
      .join(" ")
      .toLowerCase();

    const matchesSearch =
      !search || fullText.includes(search);

    const matchesTrack =
      !filter || student.parcours === filter;

    return matchesSearch && matchesTrack;
  });

  const economic = filtered.filter(
    student => student.parcours === "Analyse économique"
  );

  const econometrics = filtered.filter(
    student => student.parcours === "Économétrie appliquée"
  );

  economicContainer.innerHTML =
    renderStudentsTable(economic);

  econometricsContainer.innerHTML =
    renderStudentsTable(econometrics);
}


function renderStudentsTable(list) {
  if (!list.length) {
    return `
      <div class="empty-state">
        Aucun étudiant trouvé.
      </div>
    `;
  }

  return `
    <div class="table-wrapper">
      <table>
        <thead>
          <tr>
            <th>Nom</th>
            <th>Prénom</th>
            <th>Code Apogée</th>
            <th>Actions</th>
          </tr>
        </thead>

        <tbody>
          ${list.map(student => `
            <tr>
              <td>${escapeHtml(student.nom)}</td>
              <td>${escapeHtml(student.prenom)}</td>
              <td>${escapeHtml(student.student_identifier)}</td>

              <td>
                <div class="table-actions">

                  <button
                    class="small-btn"
                    data-action="view-student"
                    data-id="${student.id}"
                  >
                    Voir
                  </button>

                  <button
                    class="small-btn"
                    data-action="edit-student"
                    data-id="${student.id}"
                  >
                    Modifier
                  </button>

                  <button
                    class="small-btn danger-btn"
                    data-action="delete-student"
                    data-id="${student.id}"
                  >
                    Supprimer
                  </button>

                </div>
              </td>
            </tr>
          `).join("")}
        </tbody>
      </table>
    </div>
  `;
}


/* =========================================================
   SÉANCES
   ========================================================= */

async function loadSessions() {
  const {
    data,
    error
  } = await sb
    .from("sessions")
    .select("*")
    .order("session_date", { ascending: false })
    .order("start_time", { ascending: false });

  if (error) {
    console.error("Erreur sessions :", error);
    return;
  }

  sessions = data || [];
}


async function loadActiveSession() {
  await sb.rpc("expire_sessions");

  const {
    data,
    error
  } = await sb
    .from("sessions")
    .select("*")
    .eq("status", "ACTIVE")
    .order("created_at", { ascending: false })
    .limit(1);

  if (error) {
    console.error("Erreur session active :", error);
    return;
  }

  activeSession = data?.[0] || null;

  if (activeSession) {
    await loadActiveSessionAttendances();
    renderActiveSession();
  } else {
    hideActiveSession();
  }
}


async function openNewSession() {
  const button =
    document.getElementById("openSessionBtn");

  if (button) {
    button.disabled = true;
  }

  showMessage(
    "sessionActionMessage",
    "Ouverture de la séance..."
  );

  const {
    data,
    error
  } = await sb.rpc("open_session", {
    p_duration_minutes: 120
  });

  if (error) {
    console.error("Erreur open_session :", error);

    showMessage(
      "sessionActionMessage",
      error.message || "Impossible d'ouvrir la séance.",
      "error"
    );

    if (button) {
      button.disabled = false;
    }

    return;
  }

  console.log("Nouvelle séance :", data);

  showMessage(
    "sessionActionMessage",
    "Séance ouverte.",
    "success"
  );

  await loadSessions();
  await loadActiveSession();

  renderHistory();

  if (button) {
    button.disabled = false;
  }
}


async function closeActiveSession() {
  if (!activeSession) return;

  const confirmed = window.confirm(
    "Voulez-vous vraiment fermer cette séance ?"
  );

  if (!confirmed) return;

  const {
    error
  } = await sb.rpc("close_session", {
    p_session_id: activeSession.id
  });

  if (error) {
    console.error("Erreur fermeture séance :", error);

    showMessage(
      "sessionActionMessage",
      error.message || "Impossible de fermer la séance.",
      "error"
    );

    return;
  }

  activeSession = null;

  await loadSessions();
  await loadActiveSession();

  renderHistory();
  renderRanking();
}


/* =========================================================
   PRÉSENCES DE LA SÉANCE ACTIVE
   ========================================================= */

async function loadActiveSessionAttendances() {
  if (!activeSession) return;

  const {
    data,
    error
  } = await sb
    .from("attendances")
    .select(`
      id,
      student_id,
      session_id,
      validated_at,
      students (
        id,
        nom,
        prenom,
        student_identifier,
        parcours
      )
    `)
    .eq("session_id", activeSession.id)
    .order("validated_at", { ascending: true });

  if (error) {
    console.error(
      "Erreur présences session active :",
      error
    );

    activeSession.attendances = [];

    return;
  }

  activeSession.attendances = data || [];
}


function renderActiveSession() {
  if (!activeSession) {
    hideActiveSession();
    return;
  }

  const section =
    document.getElementById("activeSessionSection");

  section.hidden = false;

  document.getElementById("activeSessionDate").textContent =
    `${formatDate(activeSession.session_date)} — ${formatTime(activeSession.start_time)} à ${formatTime(activeSession.end_time)}`;

  document.getElementById("confirmationCode").textContent =
    activeSession.confirmation_code || "—";

  const attendanceCount =
    activeSession.attendances?.length || 0;

  document.getElementById("presentCount").textContent =
    attendanceCount;

  document.getElementById("activeSessionStatus").textContent =
    getStatusLabel(activeSession.status);

  const qrImage =
    document.getElementById("qrCodeImage");

  const studentUrl =
    `${window.location.origin}${window.location.pathname.replace("professor.html", "")}student.html?session=${encodeURIComponent(activeSession.qr_token)}`;

  qrImage.src =
    `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(studentUrl)}`;

  qrImage.alt =
    "QR code permettant de rejoindre la séance";

  const presentList =
    document.getElementById("presentList");

  const attendances =
    activeSession.attendances || [];

  if (!attendances.length) {
    presentList.innerHTML = `
      <div class="empty-state">
        Aucun étudiant présent pour le moment.
      </div>
    `;

    return;
  }

  presentList.innerHTML = `
    <div class="table-wrapper">
      <table>
        <thead>
          <tr>
            <th>#</th>
            <th>Nom</th>
            <th>Prénom</th>
            <th>Code Apogée</th>
            <th>Parcours</th>
            <th>Heure</th>
          </tr>
        </thead>

        <tbody>
          ${attendances.map((attendance, index) => {
            const student = attendance.students;

            return `
              <tr>
                <td>${index + 1}</td>
                <td>${escapeHtml(student?.nom)}</td>
                <td>${escapeHtml(student?.prenom)}</td>
                <td>${escapeHtml(student?.student_identifier)}</td>
                <td>${escapeHtml(student?.parcours)}</td>
                <td>${formatValidatedTime(attendance.validated_at)}</td>
              </tr>
            `;
          }).join("")}
        </tbody>
      </table>
    </div>
  `;
}


function formatValidatedTime(value) {
  if (!value) return "—";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "—";
  }

  return date.toLocaleTimeString("fr-FR", {
    hour: "2-digit",
    minute: "2-digit"
  });
}


function hideActiveSession() {
  const section =
    document.getElementById("activeSessionSection");

  if (section) {
    section.hidden = true;
  }
}


/* =========================================================
   HISTORIQUE
   ========================================================= */

function renderHistory() {
  const container =
    document.getElementById("sessionsHistory");

  if (!container) return;

  const completedSessions =
    sessions.filter(session =>
      ["FERMEE", "EXPIREE"].includes(session.status)
    );

  const active =
    sessions.filter(session => session.status === "ACTIVE");

  const programmable =
    sessions.filter(session => session.status === "PROGRAMMEE");

  const ordered = [
    ...active,
    ...programmable,
    ...completedSessions
  ];

  if (!ordered.length) {
    container.innerHTML = `
      <div class="empty-state">
        Aucune séance enregistrée.
      </div>
    `;

    return;
  }

  container.innerHTML = `
    <div class="table-wrapper">
      <table>
        <thead>
          <tr>
            <th>Date</th>
            <th>Horaire</th>
            <th>Statut</th>
            <th>Présents</th>
            <th>Action</th>
          </tr>
        </thead>

        <tbody>
          ${ordered.map(session => `
            <tr>
              <td>${formatDate(session.session_date)}</td>

              <td>
                ${formatTime(session.start_time)}
                —
                ${formatTime(session.end_time)}
              </td>

              <td>
                <span class="status-badge ${getStatusClass(session.status)}">
                  ${getStatusLabel(session.status)}
                </span>
              </td>

              <td>
                <span
                  class="session-present-count"
                  data-session-count="${session.id}"
                >
                  —
                </span>
              </td>

              <td>
                <button
                  class="small-btn"
                  data-action="view-session"
                  data-id="${session.id}"
                >
                  Voir
                </button>
              </td>
            </tr>
          `).join("")}
        </tbody>
      </table>
    </div>
  `;

  loadSessionCounts();
}


async function loadSessionCounts() {
  const completedSessions =
    sessions.filter(session =>
      ["FERMEE", "EXPIREE"].includes(session.status)
    );

  for (const session of completedSessions) {
    const {
      count,
      error
    } = await sb
      .from("attendances")
      .select("*", {
        count: "exact",
        head: true
      })
      .eq("session_id", session.id);

    if (error) {
      console.error(
        "Erreur compteur séance :",
        error
      );

      continue;
    }

    const element =
      document.querySelector(
        `[data-session-count="${session.id}"]`
      );

    if (element) {
      element.textContent = count || 0;
    }
  }

  if (activeSession) {
    const element =
      document.querySelector(
        `[data-session-count="${activeSession.id}"]`
      );

    if (element) {
      element.textContent =
        activeSession.attendances?.length || 0;
    }
  }
}


/* =========================================================
   DÉTAIL D'UNE SÉANCE
   ========================================================= */

async function showSessionDetail(sessionId) {
  const session =
    sessions.find(
      item => String(item.id) === String(sessionId)
    );

  if (!session) return;

  const modal =
    document.getElementById("sessionDetailModal");

  const content =
    document.getElementById("sessionDetailContent");

  content.innerHTML = `
    <div class="loading">
      Chargement...
    </div>
  `;

  modal.hidden = false;

  const {
    data,
    error
  } = await sb
    .from("attendances")
    .select(`
      student_id,
      validated_at,
      students (
        id,
        nom,
        prenom,
        student_identifier,
        parcours
      )
    `)
    .eq("session_id", session.id)
    .order("validated_at", { ascending: true });

  if (error) {
    console.error("Erreur détail séance :", error);

    content.innerHTML = `
      <p class="message error">
        Impossible de charger le détail de cette séance.
      </p>
    `;

    return;
  }

  const attendanceMap = new Map(
    (data || []).map(item => [
      String(item.student_id),
      item
    ])
  );

  const isCompleted =
    ["FERMEE", "EXPIREE"].includes(session.status);

  content.innerHTML = `
    <div class="detail-header">
      <h4>
        ${formatDate(session.session_date)}
      </h4>

      <p>
        ${formatTime(session.start_time)}
        —
        ${formatTime(session.end_time)}
      </p>

      <span class="status-badge ${getStatusClass(session.status)}">
        ${getStatusLabel(session.status)}
      </span>
    </div>

    <div class="table-wrapper">
      <table>
        <thead>
          <tr>
            <th>Nom</th>
            <th>Prénom</th>
            <th>Code Apogée</th>
            <th>Parcours</th>
            <th>Présence</th>
            <th>Heure</th>
          </tr>
        </thead>

        <tbody>
          ${students.map(student => {
            const attendance =
              attendanceMap.get(String(student.id));

            let status = "Non validé";

            if (attendance) {
              status = "Présent";
            } else if (isCompleted) {
              status = "Absent";
            }

            return `
              <tr>
                <td>${escapeHtml(student.nom)}</td>
                <td>${escapeHtml(student.prenom)}</td>
                <td>${escapeHtml(student.student_identifier)}</td>
                <td>${escapeHtml(student.parcours)}</td>
                <td>
                  <span class="${attendance ? "present-status" : "absent-status"}">
                    ${status}
                  </span>
                </td>
                <td>
                  ${
                    attendance
                      ? formatValidatedTime(attendance.validated_at)
                      : "—"
                  }
                </td>
              </tr>
            `;
          }).join("")}
        </tbody>
      </table>
    </div>
  `;

  modal.hidden = false;
}


/* =========================================================
   CLASSEMENT / STATISTIQUES
   ========================================================= */

async function calculateStudentStatistics() {
  const completedSessions =
    sessions.filter(session =>
      ["FERMEE", "EXPIREE"].includes(session.status)
    );

  if (!completedSessions.length) {
    return students.map(student => ({
      student,
      totalSessions: 0,
      presence: 0,
      absence: 0,
      rate: 0
    }));
  }

  const sessionIds =
    completedSessions.map(session => session.id);

  const {
    data,
    error
  } = await sb
    .from("attendances")
    .select("student_id, session_id")
    .in("session_id", sessionIds);

  if (error) {
    console.error(
      "Erreur statistiques :",
      error
    );

    return students.map(student => ({
      student,
      totalSessions: completedSessions.length,
      presence: 0,
      absence: completedSessions.length,
      rate: 0
    }));
  }

  const attendanceMap = new Map();

  (data || []).forEach(item => {
    const studentId = String(item.student_id);

    if (!attendanceMap.has(studentId)) {
      attendanceMap.set(studentId, new Set());
    }

    attendanceMap
      .get(studentId)
      .add(String(item.session_id));
  });

  return students.map(student => {
    const totalSessions =
      completedSessions.length;

    const presence =
      attendanceMap.get(String(student.id))?.size || 0;

    const absence =
      totalSessions - presence;

    const rate =
      totalSessions > 0
        ? (presence / totalSessions) * 100
        : 0;

    return {
      student,
      totalSessions,
      presence,
      absence,
      rate
    };
  });
}


async function renderRanking() {
  const economicContainer =
    document.getElementById("economicRanking");

  const econometricsContainer =
    document.getElementById("econometricsRanking");

  if (!economicContainer || !econometricsContainer) {
    return;
  }

  economicContainer.innerHTML = `
    <div class="loading">
      Calcul...
    </div>
  `;

  econometricsContainer.innerHTML = `
    <div class="loading">
      Calcul...
    </div>
  `;

  const statistics =
    await calculateStudentStatistics();

  const economic =
    statistics
      .filter(item =>
        item.student.parcours === "Analyse économique"
      )
      .sort(sortRanking);

  const econometrics =
    statistics
      .filter(item =>
        item.student.parcours === "Économétrie appliquée"
      )
      .sort(sortRanking);

  economicContainer.innerHTML =
    renderRankingTable(economic);

  econometricsContainer.innerHTML =
    renderRankingTable(econometrics);
}


function sortRanking(a, b) {
  if (b.rate !== a.rate) {
    return b.rate - a.rate;
  }

  if (b.presence !== a.presence) {
    return b.presence - a.presence;
  }

  const nameA =
    `${a.student.nom} ${a.student.prenom}`.toLowerCase();

  const nameB =
    `${b.student.nom} ${b.student.prenom}`.toLowerCase();

  return nameA.localeCompare(nameB, "fr");
}


function renderRankingTable(list) {
  if (!list.length) {
    return `
      <div class="empty-state">
        Aucun étudiant dans ce parcours.
      </div>
    `;
  }

  return `
    <div class="table-wrapper">
      <table>
        <thead>
          <tr>
            <th>Rang</th>
            <th>Nom</th>
            <th>Prénom</th>
            <th>Code Apogée</th>
            <th>Séances</th>
            <th>Présence</th>
            <th>Absence</th>
            <th>Taux</th>
          </tr>
        </thead>

        <tbody>
          ${list.map((item, index) => `
            <tr>
              <td>
                <strong>${index + 1}</strong>
              </td>

              <td>${escapeHtml(item.student.nom)}</td>

              <td>${escapeHtml(item.student.prenom)}</td>

              <td>
                ${escapeHtml(item.student.student_identifier)}
              </td>

              <td>${item.totalSessions}</td>

              <td>${item.presence}</td>

              <td>${item.absence}</td>

              <td>
                <strong>
                  ${item.rate.toFixed(1)} %
                </strong>
              </td>
            </tr>
          `).join("")}
        </tbody>
      </table>
    </div>
  `;
}


/* =========================================================
   DÉTAIL D'UN ÉTUDIANT
   ========================================================= */

async function showStudentDetail(studentId) {
  const student =
    students.find(
      item => String(item.id) === String(studentId)
    );

  if (!student) return;

  const modal =
    document.getElementById("studentDetailModal");

  const content =
    document.getElementById("studentDetailContent");

  content.innerHTML = `
    <div class="loading">
      Chargement...
    </div>
  `;

  modal.hidden = false;

  const completedSessions =
    sessions.filter(session =>
      ["FERMEE", "EXPIREE"].includes(session.status)
    );

  const {
    data,
    error
  } = await sb
    .from("attendances")
    .select("session_id, validated_at")
    .eq("student_id", student.id);

  if (error) {
    console.error(
      "Erreur détail étudiant :",
      error
    );

    content.innerHTML = `
      <p class="message error">
        Impossible de charger les données.
      </p>
    `;

    return;
  }

  const attendanceMap = new Map(
    (data || []).map(item => [
      String(item.session_id),
      item
    ])
  );

  const total =
    completedSessions.length;

  const presence =
    completedSessions.filter(session =>
      attendanceMap.has(String(session.id))
    ).length;

  const absence =
    total - presence;

  const rate =
    total > 0
      ? (presence / total) * 100
      : 0;

  content.innerHTML = `
    <div class="student-profile">
      <h4>
        ${escapeHtml(student.prenom)}
        ${escapeHtml(student.nom)}
      </h4>

      <p>
        <strong>Code Apogée :</strong>
        ${escapeHtml(student.student_identifier)}
      </p>

      <p>
        <strong>Parcours :</strong>
        ${escapeHtml(student.parcours)}
      </p>
    </div>

    <div class="stats-grid">

      <div class="info-box">
        <span class="info-label">Séances</span>
        <strong>${total}</strong>
      </div>

      <div class="info-box">
        <span class="info-label">Présence</span>
        <strong>${presence}</strong>
      </div>

      <div class="info-box">
        <span class="info-label">Absence</span>
        <strong>${absence}</strong>
      </div>

      <div class="info-box">
        <span class="info-label">Taux</span>
        <strong>${rate.toFixed(1)} %</strong>
      </div>

    </div>

    <h4 class="detail-section-title">
      Détail des séances
    </h4>

    ${
      completedSessions.length
        ? `
          <div class="table-wrapper">
            <table>
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Horaire</th>
                  <th>Statut</th>
                  <th>Heure de validation</th>
                </tr>
              </thead>

              <tbody>
                ${completedSessions.map(session => {
                  const attendance =
                    attendanceMap.get(String(session.id));

                  return `
                    <tr>
                      <td>
                        ${formatDate(session.session_date)}
                      </td>

                      <td>
                        ${formatTime(session.start_time)}
                        —
                        ${formatTime(session.end_time)}
                      </td>

                      <td>
                        ${
                          attendance
                            ? "Présent"
                            : "Absent"
                        }
                      </td>

                      <td>
                        ${
                          attendance
                            ? formatValidatedTime(
                                attendance.validated_at
                              )
                            : "—"
                        }
                      </td>
                    </tr>
                  `;
                }).join("")}
              </tbody>
            </table>
          </div>
        `
        : `
          <div class="empty-state">
            Aucune séance terminée.
          </div>
        `
    }
  `;
}


/* =========================================================
   MODALES
   ========================================================= */

function openModal(id) {
  const modal = document.getElementById(id);

  if (modal) {
    modal.hidden = false;
  }
}


function closeModal(id) {
  const modal = document.getElementById(id);

  if (modal) {
    modal.hidden = true;
  }
}


function openEditStudent(studentId) {
  const student =
    students.find(
      item => String(item.id) === String(studentId)
    );

  if (!student) return;

  document.getElementById("editStudentId").value =
    student.id;

  document.getElementById("editStudentNom").value =
    student.nom || "";

  document.getElementById("editStudentPrenom").value =
    student.prenom || "";

  document.getElementById("editStudentCodeApogee").value =
    student.student_identifier || "";

  document.getElementById("editStudentParcours").value =
    student.parcours || "";

  showMessage("editStudentMessage", "");

  openModal("editStudentModal");
}


/* =========================================================
   ÉVÉNEMENTS
   ========================================================= */

document.addEventListener("DOMContentLoaded", () => {

  const loginForm =
    document.getElementById("loginForm");

  if (loginForm) {
    loginForm.addEventListener(
      "submit",
      loginProfessor
    );
  }


  const logoutBtn =
    document.getElementById("logoutBtn");

  if (logoutBtn) {
    logoutBtn.addEventListener(
      "click",
      logoutProfessor
    );
  }


  const openSessionBtn =
    document.getElementById("openSessionBtn");

  if (openSessionBtn) {
    openSessionBtn.addEventListener(
      "click",
      openNewSession
    );
  }


  const closeSessionBtn =
    document.getElementById("closeSessionBtn");

  if (closeSessionBtn) {
    closeSessionBtn.addEventListener(
      "click",
      closeActiveSession
    );
  }


  const refreshSessionBtn =
    document.getElementById("refreshSessionBtn");

  if (refreshSessionBtn) {
    refreshSessionBtn.addEventListener(
      "click",
      async () => {
        await loadSessions();
        await loadActiveSession();
        renderHistory();
        renderRanking();
      }
    );
  }


  const refreshHistoryBtn =
    document.getElementById("refreshHistoryBtn");

  if (refreshHistoryBtn) {
    refreshHistoryBtn.addEventListener(
      "click",
      async () => {
        await loadSessions();
        await loadActiveSession();
        renderHistory();
      }
    );
  }


  const refreshRankingBtn =
    document.getElementById("refreshRankingBtn");

  if (refreshRankingBtn) {
    refreshRankingBtn.addEventListener(
      "click",
      renderRanking
    );
  }


  const addStudentBtn =
    document.getElementById("addStudentBtn");

  if (addStudentBtn) {
    addStudentBtn.addEventListener(
      "click",
      () => {
        showMessage("studentFormMessage", "");
        openModal("studentModal");
      }
    );
  }


  const studentForm =
    document.getElementById("studentForm");

  if (studentForm) {
    studentForm.addEventListener(
      "submit",
      registerStudent
    );
  }


  const editStudentForm =
    document.getElementById("editStudentForm");

  if (editStudentForm) {
    editStudentForm.addEventListener(
      "submit",
      updateStudent
    );
  }


  const studentSearch =
    document.getElementById("studentSearch");

  if (studentSearch) {
    studentSearch.addEventListener(
      "input",
      renderStudents
    );
  }


  const trackFilter =
    document.getElementById("trackFilter");

  if (trackFilter) {
    trackFilter.addEventListener(
      "change",
      renderStudents
    );
  }


  document.addEventListener(
    "click",
    async event => {

      const actionElement =
        event.target.closest("[data-action]");

      if (actionElement) {

        const action =
          actionElement.dataset.action;

        const id =
          actionElement.dataset.id;

        if (action === "view-student") {
          await showStudentDetail(id);
        }

        if (action === "edit-student") {
          openEditStudent(id);
        }

        if (action === "delete-student") {
          await deleteStudent(id);
        }

        if (action === "view-session") {
          await showSessionDetail(id);
        }
      }


      const closeElement =
        event.target.closest(
          "[data-close-modal]"
        );

      if (closeElement) {
        closeModal(
          closeElement.dataset.closeModal
        );
      }
    }
  );


  document.querySelectorAll(".modal").forEach(modal => {
    modal.addEventListener("click", event => {
      if (event.target === modal) {
        modal.hidden = true;
      }
    });
  });


  checkAuthentication();
});


/* =========================================================
   ÉTAT AUTH SUPABASE
   ========================================================= */

sb.auth.onAuthStateChange(async (event, session) => {

  if (event === "SIGNED_OUT") {
    window.location.reload();
    return;
  }

  if (
    event === "SIGNED_IN" &&
    session?.user
  ) {
    await checkAuthentication();
  }
});