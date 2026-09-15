/* =========================================================
   MACROÉCONOMIE 3 — STUDENT
   Validation de présence par Code Apogée + code oral
   ========================================================= */

const params = new URLSearchParams(window.location.search);
const qrToken = params.get("session");

/* =========================================================
   ÉLÉMENTS HTML
   ========================================================= */

const sessionInfo = document.getElementById("sessionInfo");
const sessionDate = document.getElementById("sessionDate");

const message = document.getElementById("message");

const identifierStep = document.getElementById("identifierStep");
const identityStep = document.getElementById("identityStep");
const successStep = document.getElementById("successStep");

const identifierForm = document.getElementById("identifierForm");
const codeApogeeInput = document.getElementById("codeApogee");
const verifyBtn = document.getElementById("verifyBtn");

const studentNom = document.getElementById("studentNom");
const studentPrenom = document.getElementById("studentPrenom");
const studentParcours = document.getElementById("studentParcours");
const studentCodeApogee = document.getElementById("studentCodeApogee");

const oralCodeInput = document.getElementById("oralCode");
const validateAttendanceBtn =
  document.getElementById("validateAttendanceBtn");

const changeStudentBtn =
  document.getElementById("changeStudentBtn");

const successNom = document.getElementById("successNom");
const successPrenom = document.getElementById("successPrenom");
const successParcours = document.getElementById("successParcours");


/* =========================================================
   ÉTAT
   ========================================================= */

let currentSession = null;
let currentStudent = null;


/* =========================================================
   OUTILS
   ========================================================= */

function show(element) {
  if (element) {
    element.classList.remove("hidden");
  }
}

function hide(element) {
  if (element) {
    element.classList.add("hidden");
  }
}

function setMessage(text, type = "info") {
  if (!message) return;

  message.textContent = text;
  message.className = "message";

  if (type) {
    message.classList.add(type);
  }

  show(message);
}

function clearMessage() {
  if (!message) return;

  message.textContent = "";
  message.className = "message hidden";
}

function normalizeApogee(value) {
  return String(value || "")
    .trim()
    .toUpperCase();
}

function normalizeOralCode(value) {
  return String(value || "")
    .trim()
    .toUpperCase();
}

function setButtonLoading(button, loading, loadingText) {
  if (!button) return;

  if (loading) {
    button.dataset.originalText = button.textContent;
    button.textContent = loadingText;
    button.disabled = true;
  } else {
    button.textContent =
      button.dataset.originalText || button.textContent;
    button.disabled = false;
  }
}


/* =========================================================
   REDIRECTION SI PAS DE SESSION
   ========================================================= */

if (!qrToken) {
  setMessage(
    "Session invalide. Veuillez scanner le QR code affiché par le professeur.",
    "error"
  );

  if (identifierStep) {
    hide(identifierStep);
  }

  if (sessionInfo) {
    sessionInfo.innerHTML =
      "<div class='session-info-title'>Aucune session</div>";
  }
}


/* =========================================================
   RÉCUPÉRATION DE LA SESSION
   ========================================================= */

async function loadSession() {
  if (!qrToken) return false;

  try {
    const { data, error } = await sb.rpc(
      "get_session_by_qr_token",
      {
        p_qr_token: qrToken
      }
    );

    if (error) {
      console.error("Erreur session :", error);
      setMessage(
        "Impossible de vérifier la session.",
        "error"
      );
      return false;
    }

    if (!data) {
      setMessage(
        "Cette session n'existe pas ou n'est plus disponible.",
        "error"
      );

      hide(identifierStep);
      return false;
    }

    currentSession = Array.isArray(data)
      ? data[0]
      : data;

    if (!currentSession) {
      setMessage(
        "Cette session n'existe pas ou n'est plus disponible.",
        "error"
      );

      hide(identifierStep);
      return false;
    }

    displaySession();

    return true;

  } catch (error) {
    console.error(error);

    setMessage(
      "Une erreur est survenue lors de la vérification de la session.",
      "error"
    );

    return false;
  }
}


/* =========================================================
   AFFICHAGE SESSION
   ========================================================= */

function displaySession() {
  if (!currentSession) return;

  const status =
    currentSession.status ||
    currentSession.session_status ||
    "";

  const sessionDateValue =
    currentSession.session_date || "";

  const startTime =
    currentSession.start_time || "";

  const endTime =
    currentSession.end_time || "";

  if (sessionInfo) {
    sessionInfo.innerHTML = "";

    const title = document.createElement("div");
    title.className = "session-info-title";
    title.textContent = "Session de Macroéconomie 3";

    const date = document.createElement("div");

    let text = "";

    if (sessionDateValue) {
      text += formatDate(sessionDateValue);
    }

    if (startTime) {
      text += ` • ${formatTime(startTime)}`;
    }

    if (endTime) {
      text += ` – ${formatTime(endTime)}`;
    }

    if (text) {
      date.textContent = text;
    } else {
      date.textContent = "Session en cours";
    }

    sessionInfo.appendChild(title);
    sessionInfo.appendChild(date);
  }

  if (status && status !== "ACTIVE") {
    hide(identifierStep);

    if (status === "FERMEE") {
      setMessage(
        "Cette session a été fermée par le professeur.",
        "error"
      );
    } else if (status === "EXPIREE") {
      setMessage(
        "Cette session est expirée.",
        "error"
      );
    } else if (status === "PROGRAMMEE") {
      setMessage(
        "Cette session n'est pas encore ouverte.",
        "error"
      );
    } else {
      setMessage(
        "Cette session n'est pas disponible.",
        "error"
      );
    }
  }
}


/* =========================================================
   FORMAT DATE / HEURE
   ========================================================= */

function formatDate(value) {
  if (!value) return "";

  try {
    const date = new Date(`${value}T00:00:00`);

    if (Number.isNaN(date.getTime())) {
      return value;
    }

    return new Intl.DateTimeFormat("fr-FR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric"
    }).format(date);

  } catch {
    return value;
  }
}

function formatTime(value) {
  if (!value) return "";

  return String(value).substring(0, 5);
}


/* =========================================================
   VÉRIFICATION DU CODE APOGÉE
   ========================================================= */

async function verifyStudent() {
  clearMessage();

  const codeApogee =
    normalizeApogee(codeApogeeInput.value);

  if (!codeApogee) {
    setMessage(
      "Veuillez saisir votre Code Apogée.",
      "error"
    );

    codeApogeeInput.focus();
    return;
  }

  if (!currentSession) {
    setMessage(
      "La session n'est pas disponible.",
      "error"
    );

    return;
  }

  setButtonLoading(
    verifyBtn,
    true,
    "Vérification..."
  );

  try {

    /*
     * Le serveur vérifie l'existence du Code Apogée.
     * Aucun nom n'est saisi manuellement par l'étudiant.
     */

    const { data, error } = await sb.rpc(
      "get_student_by_identifier",
      {
        p_student_identifier: codeApogee
      }
    );

    if (error) {
      console.error("Erreur étudiant :", error);

      setMessage(
        "Impossible de vérifier votre Code Apogée.",
        "error"
      );

      return;
    }

    const student = Array.isArray(data)
      ? data[0]
      : data;

    if (!student) {
      setMessage(
        "Code Apogée introuvable. Vérifiez votre saisie.",
        "error"
      );

      codeApogeeInput.focus();
      codeApogeeInput.select();

      return;
    }

    currentStudent = student;

    displayStudent();

  } catch (error) {
    console.error(error);

    setMessage(
      "Une erreur est survenue lors de la vérification.",
      "error"
    );

  } finally {
    setButtonLoading(
      verifyBtn,
      false
    );
  }
}


/* =========================================================
   AFFICHAGE IDENTITÉ
   ========================================================= */

function displayStudent() {
  if (!currentStudent) return;

  const nom =
    currentStudent.nom || "";

  const prenom =
    currentStudent.prenom || "";

  const parcours =
    currentStudent.parcours || "";

  const code =
    currentStudent.student_identifier ||
    currentStudent.code_apogee ||
    normalizeApogee(codeApogeeInput.value);

  studentNom.textContent = nom;
  studentPrenom.textContent = prenom;
  studentParcours.textContent = parcours;
  studentCodeApogee.textContent = code;

  hide(identifierStep);
  show(identityStep);

  clearMessage();

  oralCodeInput.value = "";
  oralCodeInput.focus();
}


/* =========================================================
   VALIDATION DE LA PRÉSENCE
   ========================================================= */

async function validateAttendance() {
  clearMessage();

  if (!currentSession) {
    setMessage(
      "La session n'est plus disponible.",
      "error"
    );

    return;
  }

  if (!currentStudent) {
    setMessage(
      "Veuillez d'abord vérifier votre identité.",
      "error"
    );

    return;
  }

  const oralCode =
    normalizeOralCode(oralCodeInput.value);

  if (!oralCode) {
    setMessage(
      "Veuillez saisir le code de confirmation communiqué par le professeur.",
      "error"
    );

    oralCodeInput.focus();
    return;
  }

  if (oralCode.length !== 3) {
    setMessage(
      "Le code de confirmation doit contenir 3 caractères.",
      "error"
    );

    oralCodeInput.focus();
    oralCodeInput.select();

    return;
  }

  setButtonLoading(
    validateAttendanceBtn,
    true,
    "Validation..."
  );

  try {

    const studentIdentifier =
      currentStudent.student_identifier ||
      currentStudent.code_apogee ||
      normalizeApogee(codeApogeeInput.value);

    const sessionId =
      currentSession.id;

    /*
     * Toute la validation importante est effectuée
     * côté serveur :
     *
     * - session active
     * - période autorisée
     * - Code Apogée
     * - code oral
     * - absence de doublon
     */

    const { data, error } = await sb.rpc(
      "validate_attendance",
      {
        p_student_identifier: studentIdentifier,
        p_session_id: sessionId,
        p_confirmation_code: oralCode
      }
    );

    if (error) {
      console.error(
        "Erreur validation présence :",
        error
      );

      handleValidationError(error);
      return;
    }

    const result = Array.isArray(data)
      ? data[0]
      : data;

    /*
     * La fonction SQL peut retourner un objet
     * contenant success/message.
     */

    if (result && result.success === false) {
      setMessage(
        result.message ||
        "La présence n'a pas pu être enregistrée.",
        "error"
      );

      return;
    }

    /*
     * Si Supabase renvoie simplement une valeur
     * ou un objet sans champ success:false,
     * la validation est considérée comme réussie.
     */

    displaySuccess();

  } catch (error) {
    console.error(error);

    handleValidationError(error);

  } finally {
    setButtonLoading(
      validateAttendanceBtn,
      false
    );
  }
}


/* =========================================================
   GESTION DES ERREURS DE VALIDATION
   ========================================================= */

function handleValidationError(error) {
  const rawMessage =
    String(
      error?.message ||
      error?.details ||
      error?.hint ||
      ""
    );

  const normalized =
    rawMessage.toLowerCase();

  if (
    normalized.includes("already") ||
    normalized.includes("duplicate") ||
    normalized.includes("unique") ||
    normalized.includes("déjà") ||
    normalized.includes("deja")
  ) {
    setMessage(
      "Votre présence a déjà été enregistrée pour cette session.",
      "error"
    );

    return;
  }

  if (
    normalized.includes("code") &&
    (
      normalized.includes("incorrect") ||
      normalized.includes("invalid") ||
      normalized.includes("invalide")
    )
  ) {
    setMessage(
      "Code de confirmation incorrect.",
      "error"
    );

    oralCodeInput.focus();
    oralCodeInput.select();

    return;
  }

  if (
    normalized.includes("expired") ||
    normalized.includes("expire") ||
    normalized.includes("expir")
  ) {
    setMessage(
      "La session est expirée. Votre présence ne peut plus être validée.",
      "error"
    );

    return;
  }

  if (
    normalized.includes("closed") ||
    normalized.includes("fermé") ||
    normalized.includes("ferme")
  ) {
    setMessage(
      "La session a été fermée par le professeur.",
      "error"
    );

    return;
  }

  if (
    normalized.includes("before") ||
    normalized.includes("start") ||
    normalized.includes("commenc")
  ) {
    setMessage(
      "La session n'est pas encore ouverte pour les présences.",
      "error"
    );

    return;
  }

  /*
   * Dans tous les autres cas, afficher le message
   * renvoyé par le serveur lorsqu'il est disponible.
   */

  setMessage(
    rawMessage ||
    "La présence n'a pas pu être enregistrée.",
    "error"
  );
}


/* =========================================================
   SUCCÈS
   ========================================================= */

function displaySuccess() {
  if (!currentStudent) return;

  successNom.textContent =
    currentStudent.nom || "";

  successPrenom.textContent =
    currentStudent.prenom || "";

  successParcours.textContent =
    currentStudent.parcours || "";

  hide(identifierStep);
  hide(identityStep);

  clearMessage();

  show(successStep);
}


/* =========================================================
   CHANGER DE CODE APOGÉE
   ========================================================= */

function resetStudent() {
  currentStudent = null;

  codeApogeeInput.value = "";
  oralCodeInput.value = "";

  hide(identityStep);
  hide(successStep);

  show(identifierStep);

  clearMessage();

  codeApogeeInput.focus();
}


/* =========================================================
   ÉVÉNEMENTS
   ========================================================= */

if (identifierForm) {
  identifierForm.addEventListener(
    "submit",
    function (event) {
      event.preventDefault();
      verifyStudent();
    }
  );
}

if (validateAttendanceBtn) {
  validateAttendanceBtn.addEventListener(
    "click",
    validateAttendance
  );
}

if (changeStudentBtn) {
  changeStudentBtn.addEventListener(
    "click",
    resetStudent
  );
}

if (oralCodeInput) {
  oralCodeInput.addEventListener(
    "input",
    function () {
      this.value = normalizeOralCode(this.value)
        .replace(/[^A-Z0-9]/g, "")
        .substring(0, 3);
    }
  );

  oralCodeInput.addEventListener(
    "keydown",
    function (event) {
      if (event.key === "Enter") {
        event.preventDefault();
        validateAttendance();
      }
    }
  );
}

if (codeApogeeInput) {
  codeApogeeInput.addEventListener(
    "input",
    function () {
      this.value = normalizeApogee(this.value);
    }
  );
}


/* =========================================================
   INITIALISATION
   ========================================================= */

async function initStudentPage() {
  if (!qrToken) {
    return;
  }

  const sessionLoaded = await loadSession();

  if (!sessionLoaded) {
    return;
  }

  /*
   * Si la session est toujours ACTIVE,
   * l'étudiant peut commencer.
   */

  const status =
    currentSession?.status ||
    currentSession?.session_status ||
    "";

  if (status === "ACTIVE") {
    show(identifierStep);
    codeApogeeInput.focus();
  }
}

initStudentPage();