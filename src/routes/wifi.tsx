import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { Star, Instagram, Wifi, Copy, Check, ArrowRight } from "lucide-react";
import { toast } from "sonner";
import logo from "@/assets/logo-mambaia.svg";
import { Button } from "@/components/ui/button";

const STORAGE_KEY = "mambaia_wifi_v1";
const REVIEW_URL = "https://g.page/r/CWoCkyZFVLHiEBM/review";
const INSTAGRAM_URL = "https://instagram.com/mambaiabh";
const WIFI_SSID = "MAMBAIA";
const WIFI_PASSWORD = "Mambaia*22";
const MIN_AWAY_MS = 3000;

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
  const awayRef = useRef<{ at: number | null; target: "google" | "instagram" | null }>({ at: null, target: null });

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

  // detect return from external app
  useEffect(() => {
    function onVis() {
      if (document.visibilityState === "hidden") {
        if (step === "google" && !googleConfirmable) awayRef.current = { at: Date.now(), target: "google" };
        if (step === "instagram" && !instaConfirmable) awayRef.current = { at: Date.now(), target: "instagram" };
      } else {
        const a = awayRef.current;
        if (a.at && Date.now() - a.at >= MIN_AWAY_MS) {
          if (a.target === "google") setGoogleConfirmable(true);
          if (a.target === "instagram") setInstaConfirmable(true);
        }
        awayRef.current = { at: null, target: null };
      }
    }
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, [step, googleConfirmable, instaConfirmable]);

  function abrirGoogle() {
    window.open(REVIEW_URL, "_blank", "noopener,noreferrer");
  }
  function abrirInsta() {
    window.open(INSTAGRAM_URL, "_blank", "noopener,noreferrer");
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
          Conecta. Cultiva. Transforma. ✨
        </p>
      </header>

      <main className="flex-1 px-5 pb-10 max-w-md mx-auto w-full">
        {step === "intro" && (
          <div className="bg-white/5 border border-white/10 rounded-2xl p-6 backdrop-blur">
            <h2 className="text-xl font-semibold mb-2">Bem-vinda(o)! 🌱</h2>
            <p className="text-white/80 text-sm leading-relaxed mb-6">
              Pra liberar o Wi-Fi, pedimos só 2 contribuições rapidinhas com a marca:
            </p>
            <ul className="space-y-3 mb-6 text-sm">
              <li className="flex items-start gap-3">
                <Star className="w-5 h-5 text-[color:var(--brand-lime)] flex-shrink-0 mt-0.5" />
                <span>Avaliar a Mambaia no Google com 5 estrelas ⭐</span>
              </li>
              <li className="flex items-start gap-3">
                <Instagram className="w-5 h-5 text-[color:var(--brand-lime)] flex-shrink-0 mt-0.5" />
                <span>Seguir a gente no Instagram <strong>@mambaiabh</strong></span>
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
            description="Toque no botão abaixo, deixe 5 estrelas e volte para esta tela."
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
              {googleConfirmable ? "Já avaliei ✓" : "Avalie primeiro para continuar"}
            </Button>
          </StepCard>
        )}

        {step === "instagram" && (
          <StepCard
            stepNum={2}
            icon={<Instagram className="w-6 h-6" />}
            title="Siga no Instagram"
            description="Abra nosso perfil, toque em Seguir e volte para liberar o Wi-Fi."
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
              {instaConfirmable ? "Já segui ✓" : "Siga primeiro para continuar"}
            </Button>
          </StepCard>
        )}

        {step === "done" && (
          <div className="bg-[color:var(--brand-green)] text-[color:var(--brand-dark)] rounded-2xl p-6 shadow-xl">
            <div className="flex items-center gap-2 mb-4">
              <Wifi className="w-7 h-7" />
              <h2 className="text-xl font-bold">Wi-Fi liberado! 🎉</h2>
            </div>
            <p className="text-sm mb-6 opacity-80">
              Obrigada pelo apoio à Mambaia! Aqui estão os dados da rede:
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

            <p className="text-xs mt-5 opacity-70 text-center">
              Boa estadia! Se algo der errado com a senha, fale com a recepção.
            </p>
          </div>
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
