const $ = s => document.querySelector(s);
const params = new URLSearchParams(location.search);
const token = params.get("session");
let student = null;

function message(t, type = "") {
  const e = $("#studentMsg");
  if (!e) return;
  e.textContent = t;
  e.className = "message " + type;
  if (t) {
    e.classList.remove("hidden");
  } else {
    e.classList.add("hidden");
  }
}

async function init() {
  if (!token) {
    $("#sessionBadge").textContent = "QR manquant";
    $("#sessionBadge").className = "badge badge-closed";
    $("#validateBtn").disabled = true;
    message("Veuillez scanner le QR Code fourni par le professeur.", "error");
    return;
  }

  const { data, error } = await sb.rpc("get_session_by_qr_token", { p_qr_token: token });
  
  // Prise en charge si Supabase renvoie un tableau ou un objet unique
  const session = Array.isArray(data) ? data[0] : data;

  if (error || !session) {
    $("#sessionBadge").textContent = "Séance invalide ou terminée";
    $("#sessionBadge").className = "badge badge-closed";
    $("#validateBtn").disabled = true;
    message("Le QR Code n'est plus valide ou la séance est fermée.", "error");
    return;
  }

  $("#sessionBadge").textContent = "Séance active · Macroéconomie 3";
  $("#sessionBadge").className = "badge badge-active";

  const saved = localStorage.getItem("macro_student_identifier");
  if (saved) {
    $("#identifier").value = saved;
  }
}

async function findStudent() {
  const id = $("#identifier").value.trim();
  if (!id) {
    message("Entre ton Code Apogée.", "error");
    return;
  }

  const { data, error } = await sb.rpc("get_student_by_identifier", { p_identifier: id });
  
  if (error) {
    message(error.message, "error");
    return;
  }

  const result = Array.isArray(data) ? data[0] : data;

  if (!result) {
    student = null;
    $("#identityCard").classList.add("hidden");
    message("Code Apogée introuvable. Vérifie le numéro.", "error");
    return;
  }

  student = result;
  localStorage.setItem("macro_student_identifier", student.student_identifier);
  
  $("#identityCard").innerHTML = `
    <div class="identity-name">${student.nom} ${student.prenom}</div>
    <div class="identity-track">Apogée : ${student.student_identifier} · ${student.parcours}</div>
  `;
  $("#identityCard").classList.remove("hidden");
  message("Identité reconnue.", "success");
}

async function validate(e) {
  e.preventDefault();

  if (!student) {
    await findStudent();
    if (!student) return;
  }

  const code = $("#confirmationCode").value.trim();

  // Le code de confirmation généré par Supabase est à 4 chiffres
  if (code.length !== 4) {
    message("Le code de confirmation doit comporter exactement 4 chiffres.", "error");
    return;
  }

  $("#validateBtn").disabled = true;
  message("Validation en cours…");

  const { data, error } = await sb.rpc("validate_attendance", {
    p_identifier: student.student_identifier,
    p_qr_token: token,
    p_confirmation_code: code
  });

  $("#validateBtn").disabled = false;

  if (error) {
    message(error.message, "error");
    return;
  }

  const res = Array.isArray(data) ? data[0] : data;

  if (!res?.success) {
    message(res?.message || "Validation refusée.", "error");
    return;
  }

  message(`✓ ${res.message} — ${student.nom} ${student.prenom}`, "success");

  // Désactivation des champs après succès
  $("#confirmationCode").disabled = true;
  $("#identifier").disabled = true;
  $("#findStudentBtn").disabled = true;
  $("#validateBtn").disabled = true;
}

$("#findStudentBtn").onclick = findStudent;
$("#attendanceForm").onsubmit = validate;

init();
