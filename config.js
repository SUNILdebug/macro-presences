// ============================================================
// CONFIGURATION SUPABASE
// ============================================================
// 1. Ouvre Supabase > Project Settings > API
// 2. Copie "Project URL" dans SUPABASE_URL
// 3. Copie la clé "anon / publishable" dans SUPABASE_ANON_KEY
//
// Ne mets JAMAIS la clé service_role ici.
// ============================================================

const SUPABASE_URL = "https://tkpdnqnotosedyxhfcek.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_pHxvRlBrvavUsbU4a-3TXQ_VfNhcutQ";

window.sb = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
