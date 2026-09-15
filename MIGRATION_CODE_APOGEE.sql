-- MIGRATION : Code Apogée fourni par le professeur
-- À exécuter une seule fois dans Supabase > SQL Editor.
-- Le champ interne student_identifier est conservé pour éviter de casser les présences existantes.

create or replace function public.register_student(
  p_nom varchar,
  p_prenom varchar,
  p_code_apogee varchar,
  p_parcours varchar
)
returns public.students
language plpgsql
security definer
set search_path = public
as $$
declare
  v_student public.students;
begin
  if not public.is_professor() then
    raise exception 'Accès professeur requis';
  end if;

  if nullif(trim(p_nom), '') is null then
    raise exception 'Nom requis';
  end if;
  if nullif(trim(p_prenom), '') is null then
    raise exception 'Prénom requis';
  end if;
  if nullif(trim(p_code_apogee), '') is null then
    raise exception 'Code Apogée requis';
  end if;
  if p_parcours not in ('Analyse économique', 'Économétrie appliquée') then
    raise exception 'Parcours invalide';
  end if;

  insert into public.students(student_identifier, nom, prenom, parcours)
  values (trim(p_code_apogee), trim(p_nom), trim(p_prenom), p_parcours)
  returning * into v_student;

  return v_student;
exception
  when unique_violation then
    raise exception 'Ce Code Apogée existe déjà.';
end;
$$;

-- Le Code Apogée devient l'identifiant saisi par l'étudiant.
-- On conserve volontairement les noms internes student_identifier / p_identifier
-- afin de préserver les données et les fonctions de validation déjà en place.
