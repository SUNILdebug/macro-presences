/* =========================================================
   MACROÉCONOMIE 3 — ESPACE PROFESSEUR
   professor.js
   ========================================================= */

let currentUser = null;
let currentSession = null;
let students = [];
let sessions = [];
let attendances = [];

/* =========================================================
   OUTILS
   ========================================================= */

function $(id) {
  return document.getElementById(id);
}

function escapeHtml(value) {
  if (value === null || value === undefined) return "";
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function normalizeCode(value) {
  return String(value || "").trim().toUpperCase();
}

function formatDate(value) {
  if (!value) return "—";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleDateString("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric"
  });
}

function formatDateTime(value) {
  if (!value) return "—";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleString("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  });
}

function showMessage(message, type = "info") {
  const box = $("message");

  if (!box) {
    alert(message);
    return;
  }

  box.textContent = message;
  box.className = `message ${type}`;

  setTimeout(() => {
    box.classList.add("hidden");
  }, 5000);
}

/* =========================================================
   MODALES
   IMPORTANT : UNE SEULE MODALE À LA FOIS
   ========================================================= */

const MODAL_IDS = [
  "studentModal",
  "editStudentModal",
  "studentDetailModal",
  "sessionDetailModal"
];

function closeAllModals() {
  MODAL_IDS.forEach(id => {
    const modal = $(id);

    if (modal) {
      modal.classList.remove("show");
      modal.classList.add("hidden");
      modal.style.display = "none";
    }
  });

  document.body.classList.remove("modal-open");
}

function openModal(id) {
  closeAllModals();

  const modal = $(id);

  if (!modal) return;

  modal.classList.remove("hidden");
  modal.classList.add("show");
  modal.style.display = "flex";

  document.body.classList.add("modal-open");
}

function closeModal(id) {
  const modal = $(id);

  if (!modal) return;

  modal.classList.remove("show");
  modal.classList.add("hidden");
  modal.style.display = "none";

  const anotherOpen = MODAL_IDS.some(modalId => {
    const element = $(modalId);
    return element && element.classList.contains("show");
  });

  if (!anotherOpen) {
    document.body.classList.remove("modal-open");
  }
}

function setupModalClosing() {
  MODAL_IDS.forEach(id => {
    const modal = $(id);

    if (!modal) return;

    modal.addEventListener("click", event => {
      if (event.target === modal) {
        closeModal(id);
      }
    });

    const closeButtons = modal.querySelectorAll(
      "[data-close-modal], .modal-close, .close-modal"
    );

    closeButtons.forEach(button => {
      button.addEventListener("click", event => {
        event.preventDefault();
        event.stopPropagation();
        closeModal(id);
      });
    });
  });

  document.addEventListener("keydown", event => {
    if (event.key === "Escape") {
      closeAllModals();
    }
  });
}

/* =========================================================
   AUTHENTIFICATION
   ========================================================= */

async function checkAuthentication() {
  const { data, error } = await sb.auth.getSession();

  if (error) {
    console.error(error);
    showLogin();
    return;
  }

  if (!data.session) {
    showLogin();
    return;
  }

  currentUser = data.session.user;

  const { data: professor, error: professorError } = await sb
    .from("professors")
    .select("*")
    .eq("id", currentUser.id)
    .maybeSingle();

  if (professorError) {
    console.error(professorError);
  }

  if (!professor) {
    await sb.auth.signOut();

    showLogin();
    showMessage(
      "Ce compte n'est pas autorisé à accéder à l'espace professeur.",
      "error"
    );

    return;
  }

  showDashboard();

  await loadAllData();
}

async function login(email, password) {
  const button = $("loginBtn");

  if (button) {
    button.disabled = true;
    button.textContent = "Connexion...";
  }

  const { data, error } = await sb.auth.signInWithPassword({
    email,
    password
  });

  if (button) {
    button.disabled = false;
    button.textContent = "Se connecter";
  }

  if (error) {
    console.error(error);

    showMessage(
      "Adresse e-mail ou mot de passe incorrect.",
      "error"
    );

    return;
  }

  currentUser = data.user;

  await checkAuthentication();
}

async function logout() {
  closeAllModals();

  await sb.auth.signOut();

  currentUser = null;
  currentSession = null;

  showLogin();
}

/* =========================================================
   AFFICHAGE LOGIN / DASHBOARD
   ========================================================= */

function showLogin() {
  const loginSection = $("loginSection");
  const dashboardSection = $("dashboardSection");

  if (loginSection) {
    loginSection.classList.remove("hidden");
    loginSection.style.display = "";
  }

  if (dashboardSection) {
    dashboardSection.classList.add("hidden");
    dashboardSection.style.display = "none";
  }
}

function showDashboard() {
  const loginSection = $("loginSection");
  const dashboardSection = $("dashboardSection");

  if (loginSection) {
    loginSection.classList.add("hidden");
    loginSection.style.display = "none";
  }

  if (dashboardSection) {
    dashboardSection.classList.remove("hidden");
    dashboardSection.style.display = "";
  }
}

/* =========================================================
   CHARGEMENT DES DONNÉES
   ========================================================= */

async function loadAllData() {
  try {
    await expireSessions();
    await Promise.all([
      loadStudents(),
      loadSessions()
    ]);

    await loadCurrentSession();

    renderStudents();
    renderSessions();
    renderRanking();
  } catch (error) {
    console.error(error);
    showMessage(
      "Une erreur est survenue lors du chargement des données.",
      "error"
    );
  }
}

async function loadStudents() {
  const { data, error } = await sb
    .from("students")
    .select("*")
    .order("parcours", { ascending: true })
    .order("nom", { ascending: true })
    .order("prenom", { ascending: true });

  if (error) {
    console.error(error);
    throw error;
  }

  students = data || [];
}

async function loadSessions() {
  const { data, error } = await sb
    .from("sessions")
    .select("*")
    .order("session_date", { ascending: false })
    .order("start_time", { ascending: false });

  if (error) {
    console.error(error);
    throw error;
  }

  sessions = data || [];
}

async function loadCurrentSession() {
  const activeSessions = sessions.filter(
    session => session.status === "ACTIVE"
  );

  if (!activeSessions.length) {
    currentSession = null;
    renderNoActiveSession();
    return;
  }

  currentSession = activeSessions[0];

  await loadAttendances(currentSession.id);
  renderCurrentSession();
}

async function loadAttendances(sessionId) {
  const { data, error } = await sb
    .from("attendances")
    .select("*")
    .eq("session_id", sessionId)
    .order("validated_at", { ascending: true });

  if (error) {
    console.error(error);
    attendances = [];
    return;
  }

  attendances = data || [];
}

/* =========================================================
   SESSIONS
   ========================================================= */

async function expireSessions() {
  const { error } = await sb.rpc("expire_sessions");

  if (error) {
    console.warn("Expiration des sessions :", error.message);
  }
}

async function openNewSession() {
  const button = $("openSessionBtn");

  if (button) {
    button.disabled = true;
    button.textContent = "Ouverture...";
  }

  try {
    await expireSessions();

    const { data, error } = await sb.rpc("open_session", {
      p_duration_minutes: 120
    });

    if (error) {
      console.error(error);
      throw error;
    }

    currentSession = Array.isArray(data) ? data[0] : data;

    await loadSessions();

    if (currentSession && currentSession.id) {
      await loadAttendances(currentSession.id);
    }

    renderCurrentSession();

    showMessage(
      "La nouvelle session a été ouverte.",
      "success"
    );

  } catch (error) {
    console.error(error);

    showMessage(
      error.message || "Impossible d'ouvrir la session.",
      "error"
    );
  } finally {
    if (button) {
      button.disabled = false;
      button.textContent = "Ouvrir une nouvelle session";
    }
  }
}

async function closeCurrentSession() {
  if (!currentSession) {
    showMessage("Aucune session active.", "error");
    return;
  }

  const confirmed = confirm(
    "Voulez-vous vraiment fermer cette session ?"
  );

  if (!confirmed) return;

  const button = $("closeSessionBtn");

  if (button) {
    button.disabled = true;
    button.textContent = "Fermeture...";
  }

  try {
    const { error } = await sb.rpc("close_session", {
      p_session_id: currentSession.id
    });

    if (error) {
      console.error(error);
      throw error;
    }

    currentSession = null;

    await loadSessions();
    await loadCurrentSession();

    renderSessions();
    renderRanking();

    showMessage(
      "La session a été fermée.",
      "success"
    );

  } catch (error) {
    console.error(error);

    showMessage(
      error.message || "Impossible de fermer la session.",
      "error"
    );
  } finally {
    if (button) {
      button.disabled = false;
      button.textContent = "Fermer la session";
    }
  }
}

function renderNoActiveSession() {
  const section = $("activeSessionSection");

  if (section) {
    section.classList.add("hidden");
  }

  const empty = $("noActiveSession");

  if (empty) {
    empty.classList.remove("hidden");
  }
}

function renderCurrentSession() {
  const section = $("activeSessionSection");
  const empty = $("noActiveSession");

  if (!currentSession) {
    renderNoActiveSession();
    return;
  }

  if (empty) {
    empty.classList.add("hidden");
  }

  if (section) {
    section.classList.remove("hidden");
  }

  const dateElement = $("activeSessionDate");
  const startElement = $("activeSessionStart");
  const endElement = $("activeSessionEnd");
  const codeElement = $("confirmationCode");
  const countElement = $("presentCount");

  if (dateElement) {
    dateElement.textContent = formatDate(
      currentSession.session_date
    );
  }

  if (startElement) {
    startElement.textContent = formatDateTime(
      currentSession.start_time
    );
  }

  if (endElement) {
    endElement.textContent = formatDateTime(
      currentSession.end_time
    );
  }

  if (codeElement) {
    codeElement.textContent =
      currentSession.confirmation_code || "---";
  }

  if (countElement) {
    countElement.textContent = attendances.length;
  }

  renderQRCode();
  renderAttendanceList();
}

function renderQRCode() {
  const container = $("qrcode");

  if (!container || !currentSession) return;

  container.innerHTML = "";

  if (!currentSession.qr_token) {
    container.textContent = "QR indisponible";
    return;
  }

  const studentUrl =
    `${window.location.origin}${window.location.pathname.replace(
      "professor.html",
      "student.html"
    )}?session=${encodeURIComponent(currentSession.qr_token)}`;

  if (typeof QRCode !== "undefined") {
    new QRCode(container, {
      text: studentUrl,
      width: 220,
      height: 220
    });
  } else {
    container.innerHTML = `
      <div class="qr-error">
        QR code indisponible.
      </div>
    `;
  }
}

function renderAttendanceList() {
  const container = $("attendanceList");

  if (!container) return;

  if (!attendances.length) {
    container.innerHTML = `
      <div class="empty-state">
        Aucun étudiant n'a encore validé sa présence.
      </div>
    `;
    return;
  }

  const rows = attendances.map(attendance => {
    const student = students.find(
      student => student.id === attendance.student_id
    );

    return `
      <div class="attendance-row">
        <div>
          <strong>
            ${escapeHtml(
              student
                ? `${student.nom} ${student.prenom}`
                : attendance.student_identifier || "Étudiant"
            )}
          </strong>
        </div>

        <div>
          ${escapeHtml(
            student?.student_identifier ||
            attendance.student_identifier ||
            "—"
          )}
        </div>

        <div>
          ${escapeHtml(
            student?.parcours || "—"
          )}
        </div>

        <div>
          ${formatDateTime(attendance.validated_at)}
        </div>
      </div>
    `;
  });

  container.innerHTML = rows.join("");
}

/* =========================================================
   ÉTUDIANTS
   ========================================================= */

async function addStudent() {
  const nom = $("studentNomInput")?.value.trim();
  const prenom = $("studentPrenomInput")?.value.trim();
  const codeApogee = normalizeCode(
    $("studentCodeApogeeInput")?.value
  );
  const parcours = $("studentParcoursInput")?.value;

  if (!nom || !prenom || !codeApogee || !parcours) {
    showMessage(
      "Veuillez remplir tous les champs.",
      "error"
    );
    return;
  }

  const button = $("saveStudentBtn");

  if (button) {
    button.disabled = true;
    button.textContent = "Enregistrement...";
  }

  try {
    const { data, error } = await sb.rpc("register_student", {
      p_nom: nom,
      p_prenom: prenom,
      p_code_apogee: codeApogee,
      p_parcours: parcours
    });

    if (error) {
      console.error(error);
      throw error;
    }

    closeModal("studentModal");

    const form = $("studentForm");

    if (form) {
      form.reset();
    }

    await loadStudents();

    renderStudents();
    renderRanking();

    showMessage(
      "Étudiant ajouté avec succès.",
      "success"
    );

  } catch (error) {
    console.error(error);

    showMessage(
      error.message || "Impossible d'ajouter l'étudiant.",
      "error"
    );
  } finally {
    if (button) {
      button.disabled = false;
      button.textContent = "Enregistrer";
    }
  }
}

function openAddStudentModal() {
  closeAllModals();

  const form = $("studentForm");

  if (form) {
    form.reset();
  }

  openModal("studentModal");
}

function openEditStudentModal(studentId) {
  closeAllModals();

  const student = students.find(
    item => String(item.id) === String(studentId)
  );

  if (!student) {
    showMessage("Étudiant introuvable.", "error");
    return;
  }

  const idInput = $("editStudentId");
  const nomInput = $("editStudentNom");
  const prenomInput = $("editStudentPrenom");
  const codeInput = $("editStudentCodeApogee");
  const parcoursInput = $("editStudentParcours");

  if (idInput) idInput.value = student.id;
  if (nomInput) nomInput.value = student.nom || "";
  if (prenomInput) prenomInput.value = student.prenom || "";
  if (codeInput) {
    codeInput.value = student.student_identifier || "";
    codeInput.disabled = true;
  }
  if (parcoursInput) {
    parcoursInput.value = student.parcours || "";
  }

  openModal("editStudentModal");
}

async function updateStudent() {
  const id = $("editStudentId")?.value;
  const nom = $("editStudentNom")?.value.trim();
  const prenom = $("editStudentPrenom")?.value.trim();
  const parcours = $("editStudentParcours")?.value;

  if (!id || !nom || !prenom || !parcours) {
    showMessage(
      "Veuillez remplir tous les champs.",
      "error"
    );
    return;
  }

  const button = $("updateStudentBtn");

  if (button) {
    button.disabled = true;
    button.textContent = "Enregistrement...";
  }

  try {
    const { error } = await sb
      .from("students")
      .update({
        nom,
        prenom,
        parcours
      })
      .eq("id", id);

    if (error) {
      console.error(error);
      throw error;
    }

    closeModal("editStudentModal");

    await loadStudents();

    renderStudents();
    renderRanking();

    showMessage(
      "Étudiant modifié avec succès.",
      "success"
    );

  } catch (error) {
    console.error(error);

    showMessage(
      error.message || "Impossible de modifier l'étudiant.",
      "error"
    );
  } finally {
    if (button) {
      button.disabled = false;
      button.textContent = "Enregistrer";
    }
  }
}

async function deleteStudent(studentId) {
  const student = students.find(
    item => String(item.id) === String(studentId)
  );

  if (!student) return;

  const confirmed = confirm(
    `Supprimer ${student.nom} ${student.prenom} ?`
  );

  if (!confirmed) return;

  try {
    const { error } = await sb
      .from("students")
      .delete()
      .eq("id", studentId);

    if (error) {
      console.error(error);
      throw error;
    }

    await loadStudents();

    renderStudents();
    renderRanking();

    showMessage(
      "Étudiant supprimé.",
      "success"
    );

  } catch (error) {
    console.error(error);

    showMessage(
      error.message || "Impossible de supprimer l'étudiant.",
      "error"
    );
  }
}

/* =========================================================
   AFFICHAGE DES ÉTUDIANTS
   ========================================================= */

function renderStudents() {
  const economicContainer = $("studentsAnalyseEconomique");
  const econometricsContainer = $("studentsEconometrieAppliquee");

  if (!economicContainer && !econometricsContainer) {
    return;
  }

  const search =
    $("studentSearch")?.value.trim().toLowerCase() || "";

  const filter =
    $("studentParcoursFilter")?.value || "";

  let filtered = [...students];

  if (search) {
    filtered = filtered.filter(student => {
      const text = [
        student.nom,
        student.prenom,
        student.student_identifier,
        student.parcours
      ]
        .join(" ")
        .toLowerCase();

      return text.includes(search);
    });
  }

  if (filter) {
    filtered = filtered.filter(
      student => student.parcours === filter
    );
  }

  const analyse = filtered.filter(
    student => student.parcours === "Analyse économique"
  );

  const econometrie = filtered.filter(
    student => student.parcours === "Économétrie appliquée"
  );

  if (economicContainer) {
    economicContainer.innerHTML =
      renderStudentTable(analyse);
  }

  if (econometricsContainer) {
    econometricsContainer.innerHTML =
      renderStudentTable(econometrie);
  }

  const allContainer = $("studentsTableBody");

  if (allContainer) {
    allContainer.innerHTML =
      filtered.map(student => renderStudentRow(student)).join("");
  }
}

function renderStudentTable(list) {
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
            <th>#</th>
            <th>Nom</th>
            <th>Prénom</th>
            <th>Code Apogée</th>
            <th>Actions</th>
          </tr>
        </thead>

        <tbody>
          ${list.map((student, index) =>
            renderStudentRow(student, index + 1)
          ).join("")}
        </tbody>
      </table>
    </div>
  `;
}

function renderStudentRow(student, index = "") {
  return `
    <tr>
      <td>${index}</td>

      <td>
        ${escapeHtml(student.nom)}
      </td>

      <td>
        ${escapeHtml(student.prenom)}
      </td>

      <td>
        <strong>
          ${escapeHtml(student.student_identifier)}
        </strong>
      </td>

      <td class="actions-cell">

        <button
          type="button"
          class="secondary-btn"
          onclick="openStudentDetailModal('${student.id}')"
        >
          Détails
        </button>

        <button
          type="button"
          class="secondary-btn"
          onclick="openEditStudentModal('${student.id}')"
        >
          Modifier
        </button>

        <button
          type="button"
          class="danger-btn"
          onclick="deleteStudent('${student.id}')"
        >
          Supprimer
        </button>

      </td>
    </tr>
  `;
}

/* =========================================================
   DÉTAIL ÉTUDIANT
   ========================================================= */

async function openStudentDetailModal(studentId) {
  closeAllModals();

  const student = students.find(
    item => String(item.id) === String(studentId)
  );

  if (!student) {
    showMessage("Étudiant introuvable.", "error");
    return;
  }

  const title = $("studentDetailTitle");
  const content = $("studentDetailContent");

  if (title) {
    title.textContent =
      `${student.nom} ${student.prenom}`;
  }

  if (content) {
    content.innerHTML = `
      <div class="student-detail-card">

        <div class="detail-item">
          <span>Nom</span>
          <strong>${escapeHtml(student.nom)}</strong>
        </div>

        <div class="detail-item">
          <span>Prénom</span>
          <strong>${escapeHtml(student.prenom)}</strong>
        </div>

        <div class="detail-item">
          <span>Code Apogée</span>
          <strong>${escapeHtml(student.student_identifier)}</strong>
        </div>

        <div class="detail-item">
          <span>Parcours</span>
          <strong>${escapeHtml(student.parcours)}</strong>
        </div>

        <div id="studentStats">
          Chargement des statistiques...
        </div>

      </div>
    `;
  }

  openModal("studentDetailModal");

  await loadStudentStatistics(student);
}

async function loadStudentStatistics(student) {
  const container = $("studentStats");

  if (!container) return;

  const { data, error } = await sb
    .from("attendances")
    .select("session_id, validated_at")
    .eq("student_id", student.id);

  if (error) {
    console.error(error);

    container.innerHTML = `
      <p>Impossible de charger les statistiques.</p>
    `;

    return;
  }

  const completedSessions = sessions.filter(
    session =>
      session.status === "FERMEE" ||
      session.status === "EXPIREE"
  );

  const presentSessionIds = new Set(
    (data || []).map(item => String(item.session_id))
  );

  const presence = completedSessions.filter(
    session => presentSessionIds.has(String(session.id))
  ).length;

  const total = completedSessions.length;
  const absence = Math.max(total - presence, 0);
  const rate = total
    ? ((presence / total) * 100).toFixed(1)
    : "0.0";

  container.innerHTML = `
    <div class="student-stats">

      <div class="stat-card">
        <span>Sessions terminées</span>
        <strong>${total}</strong>
      </div>

      <div class="stat-card">
        <span>Présences</span>
        <strong>${presence}</strong>
      </div>

      <div class="stat-card">
        <span>Absences</span>
        <strong>${absence}</strong>
      </div>

      <div class="stat-card">
        <span>Taux</span>
        <strong>${rate}%</strong>
      </div>

    </div>

    <h3>Historique</h3>

    <div class="student-session-history">

      ${
        completedSessions.length
          ? completedSessions.map(session => `
              <div class="history-row">

                <span>
                  ${formatDate(session.session_date)}
                </span>

                <strong>
                  ${
                    presentSessionIds.has(String(session.id))
                      ? "Présent"
                      : "Absent"
                  }
                </strong>

              </div>
            `).join("")
          : `
            <p>Aucune session terminée.</p>
          `
      }

    </div>
  `;
}

/* =========================================================
   HISTORIQUE DES SÉANCES
   ========================================================= */

function renderSessions() {
  const container = $("sessionsList");

  if (!container) return;

  if (!sessions.length) {
    container.innerHTML = `
      <div class="empty-state">
        Aucune séance enregistrée.
      </div>
    `;
    return;
  }

  container.innerHTML = sessions.map(session => `
    <div class="session-card">

      <div>
        <strong>
          Macroéconomie 3
        </strong>

        <span>
          ${formatDate(session.session_date)}
        </span>
      </div>

      <div>
        <span class="status status-${String(
          session.status || ""
        ).toLowerCase()}">
          ${escapeHtml(session.status)}
        </span>
      </div>

      <div>
        ${formatDateTime(session.start_time)}
      </div>

      <button
        type="button"
        class="secondary-btn"
        onclick="openSessionDetailModal('${session.id}')"
      >
        Détails
      </button>

    </div>
  `).join("");
}

/* =========================================================
   DÉTAIL SÉANCE
   ========================================================= */

async function openSessionDetailModal(sessionId) {
  /*
    IMPORTANT :
    On ferme toutes les autres modales AVANT d'ouvrir celle-ci.
    Cela empêche le problème visible sur ta capture.
  */

  closeAllModals();

  const session = sessions.find(
    item => String(item.id) === String(sessionId)
  );

  if (!session) {
    showMessage("Séance introuvable.", "error");
    return;
  }

  const title = $("sessionDetailTitle");
  const content = $("sessionDetailContent");

  if (title) {
    title.textContent = "Détail de la séance";
  }

  if (content) {
    content.innerHTML = `
      <div class="session-detail-card">

        <div class="detail-item">
          <span>Matière</span>
          <strong>Macroéconomie 3</strong>
        </div>

        <div class="detail-item">
          <span>Date</span>
          <strong>${formatDate(session.session_date)}</strong>
        </div>

        <div class="detail-item">
          <span>Début</span>
          <strong>${formatDateTime(session.start_time)}</strong>
        </div>

        <div class="detail-item">
          <span>Fin</span>
          <strong>${formatDateTime(session.end_time)}</strong>
        </div>

        <div class="detail-item">
          <span>Statut</span>
          <strong>${escapeHtml(session.status)}</strong>
        </div>

        <div id="sessionDetailAttendance">
          Chargement...
        </div>

      </div>
    `;
  }

  openModal("sessionDetailModal");

  await loadSessionDetailAttendance(session);
}

async function loadSessionDetailAttendance(session) {
  const container = $("sessionDetailAttendance");

  if (!container) return;

  const { data, error } = await sb
    .from("attendances")
    .select("*")
    .eq("session_id", session.id)
    .order("validated_at", { ascending: true });

  if (error) {
    console.error(error);

    container.innerHTML = `
      <p>Impossible de charger les présences.</p>
    `;

    return;
  }

  const sessionAttendances = data || [];

  const completed =
    session.status === "FERMEE" ||
    session.status === "EXPIREE";

  container.innerHTML = `
    <h3>
      Présences : ${sessionAttendances.length}
    </h3>

    ${
      sessionAttendances.length
        ? `
          <div class="session-attendance-list">
            ${sessionAttendances.map(attendance => {

              const student = students.find(
                item =>
                  String(item.id) ===
                  String(attendance.student_id)
              );

              return `
                <div class="history-row">

                  <span>
                    ${
                      student
                        ? escapeHtml(
                            `${student.nom} ${student.prenom}`
                          )
                        : escapeHtml(
                            attendance.student_identifier ||
                            "Étudiant"
                          )
                    }
                  </span>

                  <strong>
                    Présent
                  </strong>

                </div>
              `;

            }).join("")}
          </div>
        `
        : `
          <div class="empty-state">
            ${
              completed
                ? "Aucun étudiant n'a validé sa présence."
                : "Non validé"
            }
          </div>
        `
    }
  `;
}

/* =========================================================
   CLASSEMENT
   ========================================================= */

function renderRanking() {
  const container = $("rankingContainer");

  if (!container) return;

  const completedSessions = sessions.filter(
    session =>
      session.status === "FERMEE" ||
      session.status === "EXPIREE"
  );

  if (!completedSessions.length) {
    container.innerHTML = `
      <div class="empty-state">
        Le classement apparaîtra après les premières séances terminées.
      </div>
    `;
    return;
  }

  loadRankingData(container, completedSessions);
}

async function loadRankingData(container, completedSessions) {
  const sessionIds = completedSessions.map(
    session => session.id
  );

  if (!sessionIds.length) return;

  const { data, error } = await sb
    .from("attendances")
    .select("student_id, session_id")
    .in("session_id", sessionIds);

  if (error) {
    console.error(error);

    container.innerHTML = `
      <div class="empty-state">
        Impossible de charger le classement.
      </div>
    `;

    return;
  }

  const rows = students.map(student => {
    const studentAttendances = (data || []).filter(
      attendance =>
        String(attendance.student_id) ===
        String(student.id)
    );

    const presence = studentAttendances.length;
    const total = completedSessions.length;
    const absence = Math.max(total - presence, 0);
    const rate = total
      ? (presence / total) * 100
      : 0;

    return {
      student,
      presence,
      absence,
      total,
      rate
    };
  });

  const analyse = rows
    .filter(
      row =>
        row.student.parcours ===
        "Analyse économique"
    )
    .sort(compareRanking);

  const econometrie = rows
    .filter(
      row =>
        row.student.parcours ===
        "Économétrie appliquée"
    )
    .sort(compareRanking);

  container.innerHTML = `
    <section class="ranking-group">

      <h3>
        Analyse économique
      </h3>

      ${renderRankingTable(analyse)}

    </section>

    <section class="ranking-group">

      <h3>
        Économétrie appliquée
      </h3>

      ${renderRankingTable(econometrie)}

    </section>
  `;
}

function compareRanking(a, b) {
  if (b.rate !== a.rate) {
    return b.rate - a.rate;
  }

  if (b.presence !== a.presence) {
    return b.presence - a.presence;
  }

  return `${a.student.nom} ${a.student.prenom}`.localeCompare(
    `${b.student.nom} ${b.student.prenom}`,
    "fr"
  );
}

function renderRankingTable(rows) {
  if (!rows.length) {
    return `
      <div class="empty-state">
        Aucun étudiant.
      </div>
    `;
  }

  return `
    <div class="table-wrapper">

      <table>

        <thead>
          <tr>
            <th>#</th>
            <th>Nom</th>
            <th>Prénom</th>
            <th>Code Apogée</th>
            <th>Sessions</th>
            <th>Présences</th>
            <th>Absences</th>
            <th>Taux</th>
          </tr>
        </thead>

        <tbody>

          ${rows.map((row, index) => `
            <tr>

              <td>
                ${index + 1}
              </td>

              <td>
                ${escapeHtml(row.student.nom)}
              </td>

              <td>
                ${escapeHtml(row.student.prenom)}
              </td>

              <td>
                ${escapeHtml(
                  row.student.student_identifier
                )}
              </td>

              <td>
                ${row.total}
              </td>

              <td>
                ${row.presence}
              </td>

              <td>
                ${row.absence}
              </td>

              <td>
                ${row.rate.toFixed(1)}%
              </td>

            </tr>
          `).join("")}

        </tbody>

      </table>

    </div>
  `;
}

/* =========================================================
   RECHERCHE / FILTRES
   ========================================================= */

function setupSearchAndFilters() {
  const search = $("studentSearch");

  if (search) {
    search.addEventListener("input", renderStudents);
  }

  const filter = $("studentParcoursFilter");

  if (filter) {
    filter.addEventListener("change", renderStudents);
  }
}

/* =========================================================
   RAFRAÎCHISSEMENT
   ========================================================= */

async function refreshDashboard() {
  try {
    await expireSessions();

    await loadStudents();
    await loadSessions();
    await loadCurrentSession();

    renderStudents();
    renderSessions();
    renderRanking();

    showMessage(
      "Données actualisées.",
      "success"
    );
  } catch (error) {
    console.error(error);

    showMessage(
      "Impossible d'actualiser les données.",
      "error"
    );
  }
}

/* =========================================================
   ÉVÉNEMENTS
   ========================================================= */

function setupEvents() {

  /* Connexion */

  const loginForm = $("loginForm");

  if (loginForm) {
    loginForm.addEventListener("submit", async event => {
      event.preventDefault();

      const email = $("email")?.value.trim();
      const password = $("password")?.value;

      if (!email || !password) {
        showMessage(
          "Veuillez remplir les deux champs.",
          "error"
        );
        return;
      }

      await login(email, password);
    });
  }

  /* Déconnexion */

  const logoutBtn = $("logoutBtn");

  if (logoutBtn) {
    logoutBtn.addEventListener("click", logout);
  }

  /* Nouvelle session */

  const openSessionBtn = $("openSessionBtn");

  if (openSessionBtn) {
    openSessionBtn.addEventListener(
      "click",
      openNewSession
    );
  }

  /* Fermer session */

  const closeSessionBtn = $("closeSessionBtn");

  if (closeSessionBtn) {
    closeSessionBtn.addEventListener(
      "click",
      closeCurrentSession
    );
  }

  /* Rafraîchir */

  const refreshBtn = $("refreshBtn");

  if (refreshBtn) {
    refreshBtn.addEventListener(
      "click",
      refreshDashboard
    );
  }

  const refreshSessionBtn = $("refreshSessionBtn");

  if (refreshSessionBtn) {
    refreshSessionBtn.addEventListener(
      "click",
      refreshDashboard
    );
  }

  /* Ajouter étudiant */

  const addStudentBtn = $("addStudentBtn");

  if (addStudentBtn) {
    addStudentBtn.addEventListener(
      "click",
      openAddStudentModal
    );
  }

  /* Formulaire étudiant */

  const studentForm = $("studentForm");

  if (studentForm) {
    studentForm.addEventListener(
      "submit",
      async event => {
        event.preventDefault();
        await addStudent();
      }
    );
  }

  /* Modifier étudiant */

  const updateStudentBtn = $("updateStudentBtn");

  if (updateStudentBtn) {
    updateStudentBtn.addEventListener(
      "click",
      updateStudent
    );
  }

  /* Recherche */

  setupSearchAndFilters();

  /* Modales */

  setupModalClosing();
}

/* =========================================================
   INITIALISATION
   ========================================================= */

document.addEventListener("DOMContentLoaded", async () => {

  closeAllModals();

  setupEvents();

  await checkAuthentication();

});