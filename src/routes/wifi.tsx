import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Star, Instagram, Wifi, Copy, Check, ArrowRight } from "lucide-react";
import { toast } from "sonner";
import logo from "@/assets/logo-mambaia.svg";
import { Button } from "@/components/ui/button";

const STORAGE_KEY = "mambaia_wifi_v1";
const REVIEW_URL = "https://g.page/r/CWoCkyZFVLHiEBM/review";
const REVIEW_URL_ANDROID_APP = "intent://g.page/r/CWoCkyZFVLHiEBM/review#Intent;scheme=https;package=com.google.android.apps.maps;end";
const INSTAGRAM_URL = "https://instagram.com/mambaiabh";
const INSTAGRAM_APP = "instagram://user?username=mambaiabh";
const WIFI_SSID = "MAMBAIA";
const WIFI_PASSWORD = "Mambaia*22";
const UNLOCK_DELAY_MS = 3000;

const UPSELL_INSTAS = [
  { handle: "kriyastudio.co", desc: "Estúdio criativo" },
  { handle: "vistakodara",    desc: "Slow fashion" },
  { handle: "use.asari",      desc: "Acessórios" },
  { handle: "abauerlab",      desc: "Estética & beleza" },
];

type Step = "intro" | "google" | "instagram" | "done";

export const Route = createFileRoute("/wifi")({
  head: () => ({
    meta: [
      { title: "Wi-Fi Mambaia" },
      { name: "description", content: "Conecte-se ao Wi-Fi da Mambaia." },
      { name: "theme-color", content: "#1F3D2B" },
      { name: "viewport", content: "width=device-width, initial-scale=1, viewport-fit=cover" },
    ],
  }),
  component: WifiPage,
});

function WifiPage() {
  const [step, setStep] = useState<Step>("intro");
  const [googleDone, setGoogleDone] = useState(false);
  const [instaDone, setInstaDone] = useState(false);
  const [googleConfirmable, setGoogleConfirmable] = useState(false);
  const [instaConfirmable, setInstaConfirmable] = useState(false);
  const [copied, setCopied] = useState(false);

  // restore prior progress
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const s = JSON.parse(raw);
        if (s.googleDone) setGoogleDone(true);
        if (s.instaDone) setInstaDone(true);
        if (s.googleDone && s.instaDone) setStep("done");
        else if (s.googleDone) setStep("instagram");
      }
    } catch { /* ignore */ }
  }, []);

  // persist
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ googleDone, instaDone }));
    } catch { /* ignore */ }
  }, [googleDone, instaDone]);

  function abrirNoAppOuBrowser(appUrl: string, webUrl: string) {
    // Tenta abrir o app oficial na MESMA aba (para o cliente voltar com o botão "Voltar")
    // e cai para a URL web caso o esquema do app não seja tratado pelo sistema.
    const ua = typeof navigator !== "undefined" ? navigator.userAgent : "";
    const isMobile = /Android|iPhone|iPad|iPod/i.test(ua);
    if (!isMobile) {
      window.open(webUrl, "_blank", "noopener,noreferrer");
      return;
    }
    const start = Date.now();
    const fallback = window.setTimeout(() => {
      // se o app não abriu em 1.2s, abre a página web normal
      if (Date.now() - start < 2500) window.location.href = webUrl;
    }, 1200);
    try {
      window.location.href = appUrl;
    } catch {
      window.clearTimeout(fallback);
      window.location.href = webUrl;
    }
  }

  function abrirGoogle() {
    const ua = typeof navigator !== "undefined" ? navigator.userAgent : "";
    const appUrl = /Android/i.test(ua) ? REVIEW_URL_ANDROID_APP : REVIEW_URL;
    abrirNoAppOuBrowser(appUrl, REVIEW_URL);
    setTimeout(() => setGoogleConfirmable(true), UNLOCK_DELAY_MS);
  }
  function abrirInsta() {
    abrirNoAppOuBrowser(INSTAGRAM_APP, INSTAGRAM_URL);
    setTimeout(() => setInstaConfirmable(true), UNLOCK_DELAY_MS);
  }

  async function copiarSenha() {
    try {
      await navigator.clipboard.writeText(WIFI_PASSWORD);
      setCopied(true);
      toast.success("Senha copiada!");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Não foi possível copiar. Toque e segure para copiar manualmente.");
    }
  }

  return (
    <div className="min-h-screen bg-[color:var(--brand-dark)] text-white flex flex-col">
      <header className="px-6 pt-10 pb-6 flex flex-col items-center text-center">
        <img src={logo} alt="Mambaia" className="w-20 h-20 rounded-2xl mb-4" />
        <h1 className="text-3xl font-bold tracking-tight">Wi-Fi Mambaia</h1>
        <p className="text-white/70 text-sm mt-2 max-w-xs">
          Conecta. Cultiva. Transforma.
        </p>
      </header>

      <main className="flex-1 px-5 pb-10 max-w-md mx-auto w-full">
        {step === "intro" && (
          <div className="bg-white/5 border border-white/10 rounded-2xl p-6 backdrop-blur">
            <h2 className="text-xl font-semibold mb-2">Bem-vinda à Mambaia</h2>
            <p className="text-white/80 text-sm leading-relaxed mb-6">
              Para liberar o Wi-Fi, pedimos duas contribuições rapidinhas com a marca:
            </p>
            <ul className="space-y-3 mb-6 text-sm">
              <li className="flex items-start gap-3">
                <Star className="w-5 h-5 text-[color:var(--brand-lime)] flex-shrink-0 mt-0.5" />
                <span>Avaliar a Mambaia no Google com 5 estrelas</span>
              </li>
              <li className="flex items-start gap-3">
                <Instagram className="w-5 h-5 text-[color:var(--brand-lime)] flex-shrink-0 mt-0.5" />
                <span>Seguir a Mambaia no Instagram <strong>@mambaiabh</strong></span>
              </li>
            </ul>
            <Button
              onClick={() => setStep(googleDone ? (instaDone ? "done" : "instagram") : "google")}
              className="w-full h-12 text-base bg-[color:var(--brand-green)] text-[color:var(--brand-dark)] hover:bg-[color:var(--brand-green)]/90 font-semibold"
            >
              Vamos lá <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          </div>
        )}

        {step === "google" && (
          <StepCard
            stepNum={1}
            icon={<Star className="w-6 h-6" />}
            title="Avalie no Google"
            description="Toque no botão, deixe 5 estrelas no app do Google e volte para continuar."
          >
            <Button
              onClick={() => { abrirGoogle(); }}
              className="w-full h-12 bg-white text-[color:var(--brand-dark)] hover:bg-white/90 font-semibold"
            >
              <Star className="w-4 h-4 mr-2" /> Abrir Google Reviews
            </Button>
            <Button
              onClick={() => { setGoogleDone(true); setStep("instagram"); setInstaConfirmable(false); }}
              disabled={!googleConfirmable}
              variant="outline"
              className="w-full h-12 mt-3 bg-transparent text-white border-white/30 hover:bg-white/10 hover:text-white disabled:opacity-40"
            >
              {googleConfirmable ? "Já avaliei" : "Aguarde 3s após abrir o Google…"}
            </Button>
          </StepCard>
        )}

        {step === "instagram" && (
          <StepCard
            stepNum={2}
            icon={<Instagram className="w-6 h-6" />}
            title="Siga no Instagram"
            description="Abra o perfil da Mambaia, toque em Seguir (se ainda não segue) e volte para liberar o Wi-Fi."
          >
            <Button
              onClick={() => { abrirInsta(); }}
              className="w-full h-12 bg-white text-[color:var(--brand-dark)] hover:bg-white/90 font-semibold"
            >
              <Instagram className="w-4 h-4 mr-2" /> Abrir @mambaiabh
            </Button>
            <Button
              onClick={() => { setInstaDone(true); setStep("done"); }}
              disabled={!instaConfirmable}
              variant="outline"
              className="w-full h-12 mt-3 bg-transparent text-white border-white/30 hover:bg-white/10 hover:text-white disabled:opacity-40"
            >
              {instaConfirmable ? "Já segui" : "Aguarde 3s após abrir o Instagram…"}
            </Button>
          </StepCard>
        )}

        {step === "done" && (
          <>
            <div className="bg-[color:var(--brand-green)] text-[color:var(--brand-dark)] rounded-2xl p-6 shadow-xl">
              <div className="flex items-center gap-2 mb-4">
                <Wifi className="w-7 h-7" />
                <h2 className="text-xl font-bold">Wi-Fi liberado</h2>
              </div>
              <p className="text-sm mb-6 opacity-80">
                Obrigada por nos visitar! Aqui estão os dados da rede:
              </p>

              <div className="bg-[color:var(--brand-dark)] text-white rounded-xl p-5 space-y-4">
                <div>
                  <div className="text-xs uppercase tracking-wider opacity-60 mb-1">Rede</div>
                  <div className="text-2xl font-bold tracking-wide">{WIFI_SSID}</div>
                </div>
                <div>
                  <div className="text-xs uppercase tracking-wider opacity-60 mb-1">Senha</div>
                  <div className="flex items-center justify-between gap-3">
                    <code className="text-2xl font-mono font-bold select-all break-all">{WIFI_PASSWORD}</code>
                    <Button
                      size="sm"
                      onClick={copiarSenha}
                      className="bg-[color:var(--brand-lime)] text-[color:var(--brand-dark)] hover:bg-[color:var(--brand-lime)]/80 font-semibold flex-shrink-0"
                    >
                      {copied ? <><Check className="w-4 h-4 mr-1" /> Copiado</> : <><Copy className="w-4 h-4 mr-1" /> Copiar</>}
                    </Button>
                  </div>
                </div>
              </div>

              <p className="text-sm mt-5 text-center font-medium">
                Obrigada por nos visitar! Se algo der errado com a senha, fale com nossa equipe.
              </p>
            </div>

            <section className="mt-8">
              <h3 className="text-white text-sm font-semibold mb-3 text-center">
                Conheça também as marcas do nosso ecossistema
              </h3>
              <div className="grid grid-cols-2 gap-3">
                {UPSELL_INSTAS.map((u) => (
                  <a
                    key={u.handle}
                    href={`https://instagram.com/${u.handle}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="bg-white/5 border border-white/10 rounded-xl p-4 hover:bg-white/10 transition flex flex-col gap-1"
                  >
                    <div className="flex items-center gap-2 text-[color:var(--brand-lime)]">
                      <Instagram className="w-4 h-4" />
                      <span className="font-semibold text-sm">@{u.handle}</span>
                    </div>
                    <span className="text-xs text-white/60">{u.desc}</span>
                  </a>
                ))}
              </div>
            </section>
          </>
        )}

        {step !== "intro" && step !== "done" && (
          <button
            onClick={() => setStep("intro")}
            className="block mx-auto mt-6 text-xs text-white/50 hover:text-white"
          >
            ← Voltar
          </button>
        )}
      </main>

      <footer className="text-center text-white/40 text-xs pb-6">
        Mambaia · Belo Horizonte
      </footer>
    </div>
  );
}

function StepCard({
  stepNum,
  icon,
  title,
  description,
  children,
}: {
  stepNum: number;
  icon: React.ReactNode;
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <div className="bg-white/5 border border-white/10 rounded-2xl p-6 backdrop-blur">
      <div className="text-xs text-[color:var(--brand-lime)] font-semibold mb-2">PASSO {stepNum} DE 2</div>
      <div className="flex items-center gap-3 mb-2">
        <div className="w-10 h-10 rounded-full bg-[color:var(--brand-lime)]/20 text-[color:var(--brand-lime)] flex items-center justify-center">
          {icon}
        </div>
        <h2 className="text-xl font-semibold">{title}</h2>
      </div>
      <p className="text-white/70 text-sm mb-5">{description}</p>
      {children}
    </div>
  );
}
