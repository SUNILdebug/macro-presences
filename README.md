# Macroéconomie 3 — Gestion des présences

## Structure

- `index.html` : accueil
- `professor.html` : interface professeur
- `student.html` : interface étudiant
- `css/style.css` : design responsive
- `js/config.js` : configuration Supabase
- `js/professor.js` : tableau de bord professeur
- `js/student.js` : validation étudiant

## Configuration

Dans `js/config.js`, remplacer :

- `COLLE_ICI_TON_PROJECT_URL`
- `COLLE_ICI_TA_CLE_ANON`

par les valeurs de Supabase > Project Settings > API.

Utiliser uniquement la clé **anon / publishable**. Ne jamais mettre `service_role`.

## Important

Le site utilise les RPC Supabase suivantes :

- `get_student_by_identifier`
- `validate_attendance`
- `get_session_by_qr_token`
- `expire_sessions`
- `open_session`
- `close_session`
- `register_student`

Les trois dernières fonctions de gestion professeur doivent être ajoutées au SQL avant utilisation du tableau de bord.

Le QR contient une URL vers `student.html?session=<qr_token>`. Ainsi, le téléphone peut ouvrir directement la page après scan avec l'appareil photo, sans application supplémentaire.

## Déploiement

Le projet est compatible avec un hébergement statique comme GitHub Pages une fois `config.js` configuré.
