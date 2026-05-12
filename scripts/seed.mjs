import { createClient } from "@supabase/supabase-js";
const sb = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const users = [
  { email: "joao@mambaia.app", nome: "João Victor" },
  { email: "laura@mambaia.app", nome: "Laura Ottoni" },
  { email: "ed@mambaia.app", nome: "Eduardo Faria" },
];
for (const u of users) {
  const { data, error } = await sb.auth.admin.createUser({
    email: u.email, password: "mambaia2026", email_confirm: true,
    user_metadata: { nome: u.nome },
  });
  if (error && !String(error.message).match(/already|exists|registered/i)) {
    console.error(u.email, error.message); continue;
  }
  console.log(u.email, "ok", data?.user?.id ?? "");
}
