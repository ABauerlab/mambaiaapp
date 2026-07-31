import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { sendPushToAll } from "@/lib/push.server";

type Alerta = {
  id: string;
  nome: string;
  observacao: string | null;
  data: string;
  hora: string;
  recorrencia: "unica" | "diaria" | "semanal" | "quinzenal" | "mensal";
  somente_dia_util: boolean;
  ativo: boolean;
  ultimo_disparo_at: string | null;
};

/** Agora em America/Sao_Paulo (sem horario de verao desde 2019). */
function agoraBR() {
  return new Date(Date.now() - 3 * 3600_000);
}

function ymd(d: Date) {
  return d.toISOString().slice(0, 10);
}

function addDays(iso: string, n: number) {
  const d = new Date(iso + "T12:00:00Z");
  d.setUTCDate(d.getUTCDate() + n);
  return ymd(d);
}

function addMonths(iso: string, n: number) {
  const d = new Date(iso + "T12:00:00Z");
  d.setUTCMonth(d.getUTCMonth() + n);
  return ymd(d);
}

/** Empurra para a proxima segunda quando cair em fim de semana. */
function proximoDiaUtil(iso: string) {
  let out = iso;
  for (let i = 0; i < 7; i++) {
    const dow = new Date(out + "T12:00:00Z").getUTCDay();
    if (dow !== 0 && dow !== 6) return out;
    out = addDays(out, 1);
  }
  return out;
}

function proximaData(a: Alerta) {
  switch (a.recorrencia) {
    case "diaria":
      return addDays(a.data, 1);
    case "semanal":
      return addDays(a.data, 7);
    case "quinzenal":
      return addDays(a.data, 14);
    case "mensal":
      return addMonths(a.data, 1);
    default:
      return null;
  }
}

async function jaEnviado(chave: string) {
  const { data } = await supabaseAdmin
    .from("notificacoes_log")
    .select("id")
    .eq("chave", chave)
    .maybeSingle();
  return !!data;
}

async function registrar(chave: string, titulo: string, corpo: string) {
  await supabaseAdmin.from("notificacoes_log").insert({ chave, titulo, corpo });
}

export const Route = createFileRoute("/api/public/hooks/alertas")({
  server: {
    handlers: {
      POST: async () => {
        const now = agoraBR();
        const hoje = ymd(now);
        const minutosAgora = now.getUTCHours() * 60 + now.getUTCMinutes();
        let alertasEnviados = 0;
        let vencimentosEnviados = 0;

        // ---------- Alertas cadastrados ----------
        const { data: alertas, error } = await supabaseAdmin
          .from("alertas")
          .select("*")
          .eq("ativo", true)
          .lte("data", hoje);
        if (error) throw new Error(error.message);

        for (const raw of (alertas ?? []) as unknown as Alerta[]) {
          const alvoData = raw.somente_dia_util ? proximoDiaUtil(raw.data) : raw.data;
          if (alvoData > hoje) continue;
          const [hh, mm] = String(raw.hora).split(":").map(Number);
          const alvoMin = hh * 60 + (mm || 0);
          if (alvoData === hoje && minutosAgora < alvoMin) continue;

          const chave = `alerta-${raw.id}-${alvoData}`;
          if (await jaEnviado(chave)) continue;

          const titulo = `Mambaia • ${raw.nome}`;
          const corpo = raw.observacao?.trim()
            ? raw.observacao.trim()
            : `Lembrete das ${String(raw.hora).slice(0, 5)}`;
          await sendPushToAll({ title: titulo, body: corpo, url: "/alertas", tag: chave });
          await registrar(chave, titulo, corpo);
          alertasEnviados++;

          const prox = proximaData({ ...raw, data: alvoData });
          await supabaseAdmin
            .from("alertas")
            .update(
              prox
                ? { data: prox, ultimo_disparo_at: new Date().toISOString() }
                : { ativo: false, ultimo_disparo_at: new Date().toISOString() },
            )
            .eq("id", raw.id);
        }

        // ---------- Vencimentos de gastos fixos ----------
        if (minutosAgora >= 8 * 60) {
          const dia = now.getUTCDate();
          const dow = now.getUTCDay();
          const { data: fixos } = await supabaseAdmin
            .from("gastos_fixos")
            .select("id,nome,valor,dia_mes,frequencia,dia_semana,mes")
            .eq("ativo", true);

          for (const g of fixos ?? []) {
            const freq = (g as { frequencia?: string }).frequencia ?? "mensal";
            const venceHoje =
              freq === "semanal"
                ? (g as { dia_semana?: number | null }).dia_semana === dow
                : freq === "anual"
                  ? (g as { mes?: number | null }).mes === now.getUTCMonth() + 1 &&
                    g.dia_mes === dia
                  : g.dia_mes === dia;
            if (!venceHoje) continue;

            const chave = `fixo-${g.id}-${hoje}`;
            if (await jaEnviado(chave)) continue;
            const valor = Number(g.valor).toLocaleString("pt-BR", {
              style: "currency",
              currency: "BRL",
            });
            const titulo = `Mambaia • Vencimento hoje`;
            const corpo = `${g.nome} — ${valor}`;
            await sendPushToAll({ title: titulo, body: corpo, url: "/fixos", tag: chave });
            await registrar(chave, titulo, corpo);
            vencimentosEnviados++;
          }
        }

        return Response.json({
          ok: true,
          alertas: alertasEnviados,
          vencimentos: vencimentosEnviados,
        });
      },
    },
  },
});
