const $=s=>document.querySelector(s);
const params=new URLSearchParams(location.search);
const token=params.get("session");
let student=null;

function message(t,type=""){const e=$("#studentMsg");e.textContent=t;e.className="message "+type}
async function init(){
  if(!token){$("#sessionBadge").textContent="QR manquant";$("#sessionBadge").className="badge badge-closed";$("#validateBtn").disabled=true;message("Cette page doit être ouverte depuis le QR projeté par le professeur.","error");return}
  const {data,error}=await sb.rpc("get_session_by_qr_token",{p_qr_token:token});
  if(error||!data||!data.length){$("#sessionBadge").textContent="Séance invalide ou terminée";$("#sessionBadge").className="badge badge-closed";$("#validateBtn").disabled=true;message("Le QR code n'est plus valide.","error");return}
  $("#sessionBadge").textContent="Séance active · Macroéconomie 3";$("#sessionBadge").className="badge badge-active";
  const saved=localStorage.getItem("macro_student_identifier");if(saved)$("#identifier").value=saved;
}
async function findStudent(){
 const id=$("#identifier").value.trim();if(!id){message("Entre ton identifiant.","error");return}
 const {data,error}=await sb.rpc("get_student_by_identifier",{p_identifier:id});
 if(error){message(error.message,"error");return}
 if(!data||!data.length){student=null;$("#identityCard").classList.add("hidden");message("Identifiant introuvable. Vérifie le numéro.","error");return}
 student=data[0];localStorage.setItem("macro_student_identifier",student.student_identifier);
 $("#identityCard").innerHTML=`<div class="identity-name">${student.nom} ${student.prenom}</div><div class="identity-track">${student.student_identifier} · ${student.parcours}</div>`;
 $("#identityCard").classList.remove("hidden");message("Identité reconnue.","success");
}
async function validate(e){
 e.preventDefault();if(!student){await findStudent();if(!student)return}
 const code=$("#confirmationCode").value.trim().toUpperCase();
 if(code.length!==3){message("Le code doit comporter 3 caractères.","error");return}
 $("#validateBtn").disabled=true;message("Validation…");
 const {data,error}=await sb.rpc("validate_attendance",{p_identifier:student.student_identifier,p_qr_token:token,p_confirmation_code:code});
 $("#validateBtn").disabled=false;
 if(error){message(error.message,"error");return}
 if(!data?.success){message(data?.message||"Validation refusée.","error");return}
 message(`✓ ${data.message} — ${student.nom} ${student.prenom}`,"success");
 $("#confirmationCode").disabled=true;$("#identifier").disabled=true;$("#findStudentBtn").disabled=true;$("#validateBtn").disabled=true;
}
$("#findStudentBtn").onclick=findStudent;$("#attendanceForm").onsubmit=validate;
init();
