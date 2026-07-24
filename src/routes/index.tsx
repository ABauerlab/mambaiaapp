import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import {
  Camera,
  Users,
  Sparkles,
  Building2,
  Calendar,
  MessageCircle,
  MapPin,
  Clock,
  Instagram,
  ArrowRight,
  Check,
  Menu,
  X,
  Home as HomeIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { maskPhoneInput, isValidPhoneBR, onlyDigits } from "@/lib/phone";
import { toast } from "sonner";
import logo from "@/assets/logo-mambaia.svg";
import estudio1 from "@/assets/studio/estudio-1.asset.json";
import estudio2 from "@/assets/studio/estudio-2.asset.json";
import estudio3 from "@/assets/studio/estudio-3.asset.json";
import estudio4 from "@/assets/studio/estudio-4.asset.json";
import estudio5 from "@/assets/studio/estudio-5.asset.json";

const SITE = "https://mambaiabh.com.br";
const WA_NUM = "553132232356";
const WA_MSG = encodeURIComponent(
  "Oi Mambaia! Vim pelo site e queria reservar um horário no estúdio.",
);
const WA_LINK = `https://wa.me/${WA_NUM}?text=${WA_MSG}`;
const ENDERECO = "R. Rio de Janeiro, 462 - Sl 2217 - Centro, Belo Horizonte - MG";
const MAPS_LINK =
  "https://www.google.com/maps/search/?api=1&query=" +
  encodeURIComponent(
    "Mambaia Estúdio, R. Rio de Janeiro, 462, Sala 2217, Centro, Belo Horizonte - MG",
  );
const MAPS_EMBED =
  "https://www.google.com/maps?q=" +
  encodeURIComponent("R. Rio de Janeiro, 462 - Sala 2217, Centro, Belo Horizonte - MG") +
  "&output=embed";
const INSTA = "https://instagram.com/mambaiabh";

const TITLE = "Mambaia | Estúdio criativo na Praça Sete, Belo Horizonte";
const DESC =
  "Estúdio fotográfico com ciclorama, coworking e espaço para eventos no Centro de BH. Reserve online por hora, com sinal via PIX. R. Rio de Janeiro, 462 - Sala 2217.";
const OG_IMAGE = `${SITE}${estudio4.url}`;

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: TITLE },
      { name: "description", content: DESC },
      {
        name: "keywords",
        content:
          "estúdio fotográfico BH, aluguel de estúdio Belo Horizonte, coworking BH, espaço para eventos BH, Mambaia, Praça Sete",
      },
      { property: "og:title", content: TITLE },
      { property: "og:description", content: DESC },
      { property: "og:type", content: "website" },
      { property: "og:url", content: SITE },
      { property: "og:image", content: OG_IMAGE },
      { property: "og:image:width", content: "1200" },
      { property: "og:image:height", content: "800" },
      {
        property: "og:image:alt",
        content: "Interior do estúdio Mambaia com vista para o Centro de Belo Horizonte",
      },
      { property: "og:locale", content: "pt_BR" },
      { property: "og:site_name", content: "Mambaia" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: TITLE },
      { name: "twitter:description", content: DESC },
      { name: "twitter:image", content: OG_IMAGE },
    ],
    links: [{ rel: "canonical", href: SITE }],
    scripts: [
      {
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "LocalBusiness",
          "@id": SITE,
          name: "Mambaia - Estúdio Fotográfico e Espaço Criativo",
          image: [OG_IMAGE, `${SITE}${estudio1.url}`, `${SITE}${estudio5.url}`],
          logo: `${SITE}/icon-512.png`,
          url: SITE,
          telephone: "+55 31 3223-2356",
          priceRange: "R$ 50 - R$ 350",
          address: {
            "@type": "PostalAddress",
            streetAddress: "R. Rio de Janeiro, 462 - Sala 2217",
            addressLocality: "Belo Horizonte",
            addressRegion: "MG",
            postalCode: "30160-041",
            addressCountry: "BR",
          },
          geo: { "@type": "GeoCoordinates", latitude: -19.9184, longitude: -43.9411 },
          openingHoursSpecification: [
            {
              "@type": "OpeningHoursSpecification",
              dayOfWeek: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"],
              opens: "09:00",
              closes: "19:00",
            },
            {
              "@type": "OpeningHoursSpecification",
              dayOfWeek: "Saturday",
              opens: "10:00",
              closes: "17:00",
            },
          ],
          sameAs: [INSTA, WA_LINK],
        }),
      },
    ],
  }),
  component: Landing,
});

type NavLink = { label: string; href: string };
const menu: NavLink[] = [
  { label: "Estúdio", href: "#servicos" },
  { label: "Galeria", href: "#galeria" },
  { label: "Sobre", href: "#sobre" },
  { label: "Contato", href: "#contato" },
];

function Header() {
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);
  return (
    <header
      className={cn(
        "fixed top-0 inset-x-0 z-50 transition-all duration-300",
        scrolled ? "bg-[#0D2E24]/85 backdrop-blur-md border-b border-white/10" : "bg-transparent",
      )}
    >
      <div className="max-w-7xl mx-auto px-5 md:px-8 h-16 flex items-center justify-between gap-4">
        <a href="#top" className="flex items-center gap-2 text-white">
          <img src={logo} alt="Mambaia" className="w-9 h-9 rounded-md" />
          <span className="font-semibold tracking-wide">MAMBAIA</span>
        </a>
        <nav className="hidden md:flex items-center gap-8 text-sm text-white/85">
          {menu.map((m) => (
            <a key={m.href} href={m.href} className="hover:text-[#E5C72A] transition-colors">
              {m.label}
            </a>
          ))}
        </nav>
        <div className="flex items-center gap-2">
          <a
            href="/agendar"
            className="hidden sm:inline-flex items-center gap-2 rounded-lg bg-[#E5C72A] text-[#0D2E24] px-4 py-2 text-sm font-semibold hover:brightness-95 transition"
          >
            Agendar estúdio
          </a>
          <button
            className="md:hidden text-white p-2"
            aria-label="Menu"
            onClick={() => setOpen((v) => !v)}
          >
            {open ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
        </div>
      </div>
      {open && (
        <div className="md:hidden bg-[#0D2E24] border-t border-white/10">
          <nav className="px-5 py-4 flex flex-col gap-3 text-white/90">
            {menu.map((m) => (
              <a
                key={m.href}
                href={m.href}
                onClick={() => setOpen(false)}
                className="py-2 border-b border-white/5"
              >
                {m.label}
              </a>
            ))}
            <a
              href="/agendar"
              onClick={() => setOpen(false)}
              className="mt-2 inline-flex justify-center rounded-lg bg-[#E5C72A] text-[#0D2E24] px-4 py-3 font-semibold"
            >
              Agendar estúdio
            </a>
          </nav>
        </div>
      )}
    </header>
  );
}

function Hero() {
  return (
    <section
      id="top"
      className="relative min-h-[85vh] md:min-h-[90vh] flex items-center overflow-hidden"
    >
      <img
        src={estudio4.url}
        alt="Estúdio Mambaia com vista para Belo Horizonte"
        className="absolute inset-0 w-full h-full object-cover"
        loading="eager"
        decoding="async"
        // @ts-expect-error fetchpriority is a valid HTML hint but not typed in React yet
        fetchpriority="high"
        width={1920}
        height={1280}
        sizes="100vw"
      />
      <div className="absolute inset-0 bg-gradient-to-b from-[#0D2E24]/90 via-[#0D2E24]/70 to-[#0D2E24]/95" />
      <div className="absolute inset-0 bg-black/25" />
      <div className="relative z-10 max-w-4xl mx-auto px-5 md:px-8 text-center text-white pt-24 pb-16">
        <span className="inline-flex items-center gap-2 rounded-full bg-white/10 backdrop-blur border border-white/20 px-4 py-1.5 text-xs md:text-sm font-medium mb-6 animate-fade-in">
          <MapPin className="w-3.5 h-3.5 text-[#E5C72A]" />
          Centro de Belo Horizonte · Praça Sete
        </span>
        <h1 className="text-4xl md:text-6xl lg:text-7xl font-light tracking-tight leading-[1.05] animate-fade-in">
          A criatividade
          <br />
          <span className="font-semibold text-[#E5C72A]">encontra espaço.</span>
        </h1>
        <p className="mt-6 text-base md:text-xl text-white/85 max-w-2xl mx-auto font-light leading-relaxed animate-fade-in">
          Estúdio fotográfico, coworking e espaço para eventos no coração de Belo Horizonte. Reserve
          online, do jeito que combina com você.
        </p>
        <div className="mt-9 flex flex-col sm:flex-row gap-3 justify-center animate-fade-in">
          <a
            href="/agendar"
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-[#E5C72A] text-[#0D2E24] px-7 py-3.5 font-semibold text-base hover:brightness-95 transition shadow-lg shadow-black/20"
          >
            Agendar estúdio
            <ArrowRight className="w-4 h-4" />
          </a>
          <a
            href="#galeria"
            className="inline-flex items-center justify-center gap-2 rounded-lg border border-white/40 text-white px-7 py-3.5 font-medium hover:bg-white/10 transition"
          >
            Conhecer o espaço
          </a>
        </div>
        <div className="mt-10 flex flex-wrap justify-center gap-x-6 gap-y-2 text-xs md:text-sm text-white/80">
          {["Estúdio profissional", "Coworking", "Eventos", "Pacote marcas"].map((t) => (
            <span key={t} className="inline-flex items-center gap-1.5">
              <Check className="w-4 h-4 text-[#E5C72A]" /> {t}
            </span>
          ))}
        </div>
      </div>
    </section>
  );
}

type Servico = {
  icon: typeof Camera;
  title: string;
  desc: string;
  img: string;
  href: string;
  cta: string;
};
const servicos: Servico[] = [
  {
    icon: Camera,
    title: "Estúdio fotográfico",
    desc: "Ciclorama branco, iluminação profissional, mesa still e vista aberta da cidade. Aluguel por hora a partir de R$ 100, com sinal via PIX.",
    img: estudio5.url,
    href: "/agendar",
    cta: "Agendar sessão",
  },
  {
    icon: Users,
    title: "Coworking criativo",
    desc: "Ambiente inspirador para trabalhar, editar ou reunir a equipe. Café, Wi-Fi e vista da cidade no coração do Centro.",
    img: estudio3.url,
    href: "/agendar",
    cta: "Reservar horário",
  },
  {
    icon: Sparkles,
    title: "Eventos e encontros",
    desc: "Espaço versátil para workshops, lançamentos, gravações e ativações de marca no Centro de BH.",
    img: estudio2.url,
    href: "/agendar",
    cta: "Agendar evento",
  },
  {
    icon: Building2,
    title: "Pacote marcas / brechó",
    desc: "Produção fotográfica completa: R$ 350 por marca, com 1h de estúdio para cada. Ideal para catálogos e brechós.",
    img: estudio1.url,
    href: "/pacote-marcas",
    cta: "Solicitar pacote",
  },
];

function Servicos() {
  return (
    <section id="servicos" className="py-20 md:py-28 bg-white">
      <div className="max-w-7xl mx-auto px-5 md:px-8">
        <div className="max-w-2xl mb-14">
          <span className="text-xs font-semibold tracking-widest text-[#5F6B2D] uppercase">
            O que oferecemos
          </span>
          <h2 className="mt-3 text-3xl md:text-5xl font-light tracking-tight text-[#0D2E24]">
            Um espaço, várias possibilidades.
          </h2>
          <p className="mt-4 text-[#1A1A1A]/70 leading-relaxed">
            Reserve o Mambaia para o que a sua criatividade pedir hoje - fotografia, trabalho,
            evento ou produção de marca.
          </p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-8">
          {servicos.map((s) => {
            const Icon = s.icon;
            return (
              <article
                key={s.title}
                className="group bg-white rounded-2xl border border-black/5 overflow-hidden shadow-[0_4px_20px_rgba(0,0,0,0.04)] hover:shadow-[0_12px_40px_rgba(0,0,0,0.10)] hover:-translate-y-1 transition-all duration-300"
              >
                <div className="p-6 md:p-7">
                  <div className="flex items-center gap-3 mb-3">
                    <span className="grid place-items-center w-10 h-10 rounded-lg bg-[#0D2E24] text-[#E5C72A]">
                      <Icon className="w-5 h-5" />
                    </span>
                    <h3 className="text-xl font-medium text-[#0D2E24]">{s.title}</h3>
                  </div>
                  <p className="text-[#1A1A1A]/70 leading-relaxed text-sm md:text-base">{s.desc}</p>
                  <a
                    href={s.href}
                    className="mt-5 inline-flex items-center gap-2 text-sm font-semibold text-[#0D2E24] hover:text-[#5F6B2D] transition"
                  >
                    {s.cta}
                    <ArrowRight className="w-4 h-4" />
                  </a>
                </div>
              </article>
            );
          })}
        </div>
      </div>
    </section>
  );
}

function Galeria() {
  const shots = [estudio1, estudio2, estudio3, estudio4, estudio5, estudio4];
  return (
    <section id="galeria" className="py-20 md:py-28 bg-[#F5F5F5]">
      <div className="max-w-7xl mx-auto px-5 md:px-8">
        <div className="flex items-end justify-between flex-wrap gap-4 mb-10">
          <div className="max-w-xl">
            <span className="text-xs font-semibold tracking-widest text-[#5F6B2D] uppercase">
              Nosso espaço
            </span>
            <h2 className="mt-3 text-3xl md:text-5xl font-light tracking-tight text-[#0D2E24]">
              Feito para criar.
            </h2>
          </div>
          <a
            href={INSTA}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-2 text-sm font-medium text-[#0D2E24] hover:text-[#5F6B2D]"
          >
            <Instagram className="w-4 h-4" />
            Ver mais no Instagram
          </a>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3 md:gap-4">
          {shots.map((s, i) => (
            <div
              key={i}
              className={cn(
                "relative overflow-hidden rounded-xl group",
                i === 0 && "md:col-span-2 md:row-span-2 aspect-square md:aspect-auto",
                i !== 0 && "aspect-square",
              )}
            >
              <img
                src={s.url}
                alt={`Mambaia estúdio ${i + 1}`}
                loading="lazy"
                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700"
              />
              <div className="absolute inset-0 bg-[#0D2E24]/0 group-hover:bg-[#0D2E24]/20 transition-colors" />
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function Sobre() {
  const valores = [
    "Criatividade",
    "Conexão",
    "Autenticidade",
    "Natureza",
    "Colaboração",
    "Liberdade",
    "Sofisticação",
  ];
  return (
    <section id="sobre" className="py-20 md:py-28 bg-white">
      <div className="max-w-7xl mx-auto px-5 md:px-8 grid md:grid-cols-2 gap-12 items-center">
        <div className="border-l-4 border-[#5F6B2D] pl-6 md:pl-10">
          <span className="text-xs font-semibold tracking-widest text-[#5F6B2D] uppercase">
            Sobre o Mambaia
          </span>
          <h2 className="mt-3 text-3xl md:text-5xl font-light tracking-tight text-[#0D2E24]">
            Muito mais do que um estúdio.
          </h2>
          <p className="mt-5 text-[#1A1A1A]/75 leading-relaxed">
            O Mambaia nasceu no coração de Belo Horizonte com um propósito simples: dar espaço para
            quem cria. Aqui, a luz da Praça Sete encontra ambientes pensados para fotografia,
            trabalho, encontros e ideias que precisam de um lugar para acontecer.
          </p>
          <div className="mt-6 flex flex-wrap gap-2">
            {valores.map((v) => (
              <span
                key={v}
                className="text-xs font-medium px-3 py-1.5 rounded-full bg-[#0D2E24]/5 text-[#0D2E24] border border-[#0D2E24]/10"
              >
                {v}
              </span>
            ))}
          </div>
          <a
            href="#galeria"
            className="mt-7 inline-flex items-center gap-2 text-sm font-semibold text-[#0D2E24] hover:text-[#5F6B2D]"
          >
            Explorar o espaço <ArrowRight className="w-4 h-4" />
          </a>
        </div>
        <div className="relative aspect-[4/5] md:aspect-[4/5] rounded-2xl overflow-hidden shadow-xl">
          <img
            src={estudio3.url}
            alt="Ambiente interno do estúdio Mambaia"
            loading="lazy"
            className="w-full h-full object-cover"
          />
        </div>
      </div>
    </section>
  );
}

function Steps() {
  const steps = [
    {
      icon: Sparkles,
      title: "Escolha o serviço",
      desc: "Estúdio, coworking, evento ou pacote de marcas.",
    },
    {
      icon: Calendar,
      title: "Reserve online",
      desc: "Selecione data, horário e pague o sinal via PIX.",
    },
    {
      icon: Camera,
      title: "Venha criar",
      desc: "Chegue no dia marcado e aproveite o espaço.",
    },
  ];
  return (
    <section className="py-20 md:py-28 bg-[#0D2E24] text-white">
      <div className="max-w-6xl mx-auto px-5 md:px-8">
        <div className="text-center max-w-2xl mx-auto mb-14">
          <span className="text-xs font-semibold tracking-widest text-[#E5C72A] uppercase">
            Como funciona
          </span>
          <h2 className="mt-3 text-3xl md:text-5xl font-light tracking-tight">
            Reserve em três passos.
          </h2>
        </div>
        <div className="grid md:grid-cols-3 gap-6 md:gap-8">
          {steps.map((s, i) => {
            const Icon = s.icon;
            return (
              <div
                key={s.title}
                className="relative rounded-2xl bg-white/5 border border-white/10 backdrop-blur p-7 hover:bg-white/10 transition"
              >
                <div className="flex items-center gap-3 mb-4">
                  <span className="text-5xl font-light text-[#E5C72A] leading-none">
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <Icon className="w-6 h-6 text-white/80 ml-auto" />
                </div>
                <h3 className="text-xl font-medium">{s.title}</h3>
                <p className="mt-2 text-white/70 text-sm leading-relaxed">{s.desc}</p>
              </div>
            );
          })}
        </div>
        <div className="mt-12 text-center">
          <a
            href="/agendar"
            className="inline-flex items-center gap-2 rounded-lg bg-[#E5C72A] text-[#0D2E24] px-7 py-3.5 font-semibold hover:brightness-95 transition"
          >
            Ver horários disponíveis
            <ArrowRight className="w-4 h-4" />
          </a>
        </div>
      </div>
    </section>
  );
}

function Localizacao() {
  return (
    <section id="contato" className="py-20 md:py-28 bg-white">
      <div className="max-w-7xl mx-auto px-5 md:px-8 grid md:grid-cols-2 gap-10 items-stretch">
        <div className="rounded-2xl overflow-hidden shadow-lg border border-black/5 min-h-[320px]">
          <iframe
            src={MAPS_EMBED}
            title="Mapa do Mambaia"
            className="w-full h-full min-h-[320px]"
            loading="lazy"
            referrerPolicy="no-referrer-when-downgrade"
          />
        </div>
        <div>
          <span className="text-xs font-semibold tracking-widest text-[#5F6B2D] uppercase">
            Onde estamos
          </span>
          <h2 className="mt-3 text-3xl md:text-5xl font-light tracking-tight text-[#0D2E24]">
            Nos encontre.
          </h2>
          <ul className="mt-6 space-y-4 text-[#1A1A1A]/80">
            <li className="flex gap-3">
              <MapPin className="w-5 h-5 text-[#5F6B2D] shrink-0 mt-0.5" />
              <span>
                R. Rio de Janeiro, 462 - Sala 2217
                <br />
                Centro, Belo Horizonte - MG
              </span>
            </li>
            <li className="flex gap-3">
              <Clock className="w-5 h-5 text-[#5F6B2D] shrink-0 mt-0.5" />
              <span>
                Seg à Sex: 09h - 19h
                <br />
                Sáb: 10h - 17h
              </span>
            </li>
            <li className="flex gap-3">
              <MessageCircle className="w-5 h-5 text-[#5F6B2D] shrink-0 mt-0.5" />
              <span>WhatsApp (31) 3223-2356</span>
            </li>
          </ul>
          <div className="mt-8 flex flex-col sm:flex-row gap-3">
            <a
              href={MAPS_LINK}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center justify-center gap-2 rounded-lg bg-[#0D2E24] text-white px-6 py-3 font-medium hover:bg-[#0D2E24]/90 transition"
            >
              <MapPin className="w-4 h-4" /> Como chegar
            </a>
            <a
              href={WA_LINK}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center justify-center gap-2 rounded-lg border border-[#0D2E24]/20 text-[#0D2E24] px-6 py-3 font-medium hover:bg-[#0D2E24]/5 transition"
            >
              <MessageCircle className="w-4 h-4" /> Falar no WhatsApp
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}

function CtaFinal() {
  return (
    <section className="relative py-24 md:py-32 overflow-hidden">
      <img
        src={estudio1.url}
        alt="Ciclorama do estúdio Mambaia"
        className="absolute inset-0 w-full h-full object-cover"
        loading="lazy"
        decoding="async"
        width={1920}
        height={1280}
        sizes="100vw"
      />
      <div className="absolute inset-0 bg-[#0D2E24]/75" />
      <div className="relative z-10 max-w-3xl mx-auto text-center text-white px-5">
        <h2 className="text-3xl md:text-5xl lg:text-6xl font-light tracking-tight">
          Seu próximo projeto
          <br />
          <span className="font-semibold text-[#E5C72A]">começa aqui.</span>
        </h2>
        <p className="mt-5 text-white/80 max-w-xl mx-auto">
          Reserve online em minutos ou fale direto com a nossa equipe.
        </p>
        <div className="mt-8 flex flex-col sm:flex-row gap-3 justify-center">
          <a
            href="/agendar"
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-[#E5C72A] text-[#0D2E24] px-7 py-3.5 font-semibold hover:brightness-95 transition shadow-lg shadow-black/20"
          >
            Agendar estúdio
            <ArrowRight className="w-4 h-4" />
          </a>
          <a
            href={WA_LINK}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center justify-center gap-2 rounded-lg border border-white/40 text-white px-7 py-3.5 font-medium hover:bg-white/10 transition"
          >
            <MessageCircle className="w-4 h-4" /> WhatsApp
          </a>
        </div>
      </div>
    </section>
  );
}

function Footer() {
  return (
    <footer className="bg-[#0D2E24] text-white/80">
      <div className="max-w-7xl mx-auto px-5 md:px-8 py-14 grid grid-cols-2 md:grid-cols-4 gap-8">
        <div className="col-span-2 md:col-span-1">
          <div className="flex items-center gap-2 text-white">
            <img src={logo} alt="Mambaia" className="w-10 h-10 rounded-md" />
            <span className="font-semibold tracking-wide">MAMBAIA</span>
          </div>
          <p className="mt-4 text-sm text-white/60 leading-relaxed">
            Criatividade encontra espaço. Um estúdio criativo em Belo Horizonte.
          </p>
        </div>
        <div>
          <h4 className="text-white font-semibold text-sm mb-3">Reservas</h4>
          <ul className="space-y-2 text-sm">
            <li>
              <a className="hover:text-[#E5C72A]" href="/agendar">
                Agendar estúdio
              </a>
            </li>
            <li>
              <a className="hover:text-[#E5C72A]" href="/pacote-marcas">
                Pacote marcas
              </a>
            </li>
            <li>
              <a className="hover:text-[#E5C72A]" href="#galeria">
                Galeria
              </a>
            </li>
            <li>
              <a className="hover:text-[#E5C72A]" href="#contato">
                Contato
              </a>
            </li>
          </ul>
        </div>
        <div>
          <h4 className="text-white font-semibold text-sm mb-3">Onde</h4>
          <ul className="space-y-2 text-sm text-white/70">
            <li>R. Rio de Janeiro, 462 - Sala 2217</li>
            <li>Centro, Belo Horizonte - MG</li>
            <li>Seg-Sex: 09h - 19h</li>
            <li>Sáb: 10h - 17h</li>
          </ul>
        </div>
        <div>
          <h4 className="text-white font-semibold text-sm mb-3">Redes</h4>
          <ul className="space-y-2 text-sm">
            <li>
              <a
                className="inline-flex items-center gap-2 hover:text-[#E5C72A]"
                href={INSTA}
                target="_blank"
                rel="noreferrer"
              >
                <Instagram className="w-4 h-4" /> @mambaiabh
              </a>
            </li>
            <li>
              <a
                className="inline-flex items-center gap-2 hover:text-[#E5C72A]"
                href={WA_LINK}
                target="_blank"
                rel="noreferrer"
              >
                <MessageCircle className="w-4 h-4" /> WhatsApp
              </a>
            </li>
            <li>
              <a
                className="inline-flex items-center gap-2 hover:text-[#E5C72A]"
                href={MAPS_LINK}
                target="_blank"
                rel="noreferrer"
              >
                <MapPin className="w-4 h-4" /> Google Maps
              </a>
            </li>
          </ul>
        </div>
      </div>
      <div className="border-t border-white/10">
        <div className="max-w-7xl mx-auto px-5 md:px-8 py-5 text-xs text-white/50 flex flex-wrap gap-2 justify-between">
          <span>© {new Date().getFullYear()} Mambaia Estúdio. Todos os direitos reservados.</span>
          <div className="flex items-center gap-4">
            <span>
              Plataforma desenvolvida por{" "}
              <a
                href="https://bauerlab.com.br/"
                target="_blank"
                rel="noreferrer"
                className="font-semibold text-[#E5C72A] hover:text-white transition"
              >
                BauerLab
              </a>
            </span>
            <Link to="/login" className="hover:text-white/80">
              Acesso interno
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
}

function Medidas() {
  return (
    <section id="medidas" className="py-16 md:py-24 bg-[#F5F5F5]">
      <div className="max-w-6xl mx-auto px-5 md:px-8 grid md:grid-cols-[1.1fr_1fr] gap-10 items-center">
        <div>
          <span className="text-xs font-semibold tracking-widest text-[#5F6B2D] uppercase">
            Medidas do estúdio
          </span>
          <h2 className="mt-3 text-3xl md:text-4xl font-light tracking-tight text-[#0D2E24]">
            Um espaço em <span className="font-semibold">L</span>, feito para caber a sua ideia.
          </h2>
          <p className="mt-4 text-[#1A1A1A]/70 leading-relaxed">
            Formato em L com ciclorama branco, luz natural pela janela e altura generosa para
            iluminação profissional. Ótimo para look book, produto, entrevistas e gravações.
          </p>
          <dl className="mt-6 grid grid-cols-3 gap-3 max-w-md">
            {[
              { label: "Largura", v: "3,00 m" },
              { label: "Profundidade", v: "2,50 m" },
              { label: "Altura", v: "2,96 m" },
            ].map((m) => (
              <div
                key={m.label}
                className="rounded-xl bg-white border border-black/5 p-4 text-center shadow-sm"
              >
                <dt className="text-[10px] uppercase tracking-widest text-[#5F6B2D]">{m.label}</dt>
                <dd className="mt-1 text-lg font-semibold tabular-nums text-[#0D2E24]">{m.v}</dd>
              </div>
            ))}
          </dl>
          <p className="mt-4 text-xs text-[#1A1A1A]/60">
            Dúvidas sobre encaixe de cenário ou equipamento?{" "}
            <a
              href={WA_LINK}
              target="_blank"
              rel="noreferrer"
              className="underline underline-offset-2 font-semibold text-[#0D2E24]"
            >
              Fale com a gente no WhatsApp
            </a>
            .
          </p>
        </div>
        <div className="relative aspect-[4/3] rounded-2xl overflow-hidden shadow-xl border border-black/5">
          <img
            src={estudio5.url}
            alt="Ciclorama branco do estúdio Mambaia com iluminação profissional"
            loading="lazy"
            decoding="async"
            width={1600}
            height={1200}
            sizes="(min-width: 768px) 45vw, 100vw"
            className="w-full h-full object-cover"
          />
        </div>
      </div>
    </section>
  );
}

function MobileBar() {
  return (
    <nav
      className="md:hidden fixed bottom-0 inset-x-0 z-40 bg-white border-t border-black/10 shadow-[0_-4px_20px_rgba(0,0,0,0.05)]"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      <div className="grid grid-cols-3">
        <a
          href="#top"
          className="flex flex-col items-center gap-0.5 py-3 text-[11px] text-[#0D2E24]"
        >
          <HomeIcon className="w-5 h-5" />
          Início
        </a>
        <a
          href="/agendar"
          className="flex flex-col items-center gap-0.5 py-3 text-[11px] font-semibold text-[#0D2E24] bg-[#E5C72A]"
        >
          <Calendar className="w-5 h-5" />
          Agendar
        </a>
        <a
          href={WA_LINK}
          target="_blank"
          rel="noreferrer"
          className="flex flex-col items-center gap-0.5 py-3 text-[11px] text-[#0D2E24]"
        >
          <MessageCircle className="w-5 h-5" />
          WhatsApp
        </a>
      </div>
    </nav>
  );
}

function Landing() {
  return (
    <div className="bg-white text-[#1A1A1A]" style={{ scrollBehavior: "smooth" }}>
      <Header />
      <main style={{ paddingBottom: "env(safe-area-inset-bottom)" }}>
        <Hero />
        <LeadForm />
        <Servicos />
        <Medidas />
        <Galeria />
        <Sobre />
        <Steps />
        <Localizacao />
        <CtaFinal />
      </main>
      <Footer />
      <MobileBar />
      <div className="md:hidden h-16" aria-hidden />
    </div>
  );
}

function LeadForm() {
  const [nome, setNome] = useState("");
  const [wa, setWa] = useState("");
  const [honey, setHoney] = useState(""); // honeypot - bots costumam preencher
  const [mountedAt] = useState(() => Date.now());
  const [confirmed, setConfirmed] = useState<null | { nome: string; wa: string }>(null);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    // Honeypot: campo escondido; humano nunca preenche.
    if (honey.trim().length > 0) return;
    // Tempo mínimo pra evitar bots que enviam o form imediatamente.
    if (Date.now() - mountedAt < 1200) {
      toast.error("Aguarde um instante e tente novamente.");
      return;
    }
    if (nome.trim().length < 2) {
      toast.error("Informe seu nome");
      return;
    }
    if (!isValidPhoneBR(wa)) {
      toast.error("WhatsApp inválido - use DDD + número");
      return;
    }
    // Bloqueio anti-repetição: mesmo par nome+whatsapp em janela curta.
    try {
      const key = "mambaia_lead_last";
      const raw = localStorage.getItem(key);
      const sig = `${nome.trim().toLowerCase()}|${onlyDigits(wa)}`;
      if (raw) {
        const prev = JSON.parse(raw) as { sig: string; ts: number };
        if (prev.sig === sig && Date.now() - prev.ts < 60_000) {
          toast.error("Recebemos seu contato há instantes. Vamos te chamar no WhatsApp.");
          return;
        }
      }
      localStorage.setItem(key, JSON.stringify({ sig, ts: Date.now() }));
    } catch {
      /* ignore storage errors */
    }
    setConfirmed({ nome: nome.trim(), wa });
  };

  const seguir = () => {
    if (!confirmed) return;
    const msg = encodeURIComponent(
      `Oi Mambaia! Meu nome é ${confirmed.nome} (WhatsApp ${confirmed.wa}). Vim pelo site e queria falar sobre uma reserva no estúdio.`,
    );
    window.open(`https://wa.me/${WA_NUM}?text=${msg}`, "_blank", "noopener,noreferrer");
    const q = new URLSearchParams({
      nome: confirmed.nome,
      whatsapp: onlyDigits(confirmed.wa),
    }).toString();
    window.location.href = `/agendar?${q}`;
  };

  return (
    <section id="reservar" className="bg-[#0D2E24] text-white">
      <div className="max-w-5xl mx-auto px-5 md:px-8 py-12 md:py-16 grid md:grid-cols-2 gap-8 items-center">
        <div>
          <span className="text-xs font-semibold tracking-widest text-[#E5C72A] uppercase">
            Comece agora
          </span>
          <h2 className="mt-2 text-2xl md:text-4xl font-light tracking-tight">
            Deixe seu contato e a gente organiza tudo com você.
          </h2>
          <p className="mt-3 text-white/70 text-sm md:text-base">
            Preencha nome e WhatsApp: já abrimos a nossa conversa e te levamos direto para a agenda
            com seus dados prontos.
          </p>
        </div>
        {confirmed ? (
          <div className="bg-white/5 border border-white/10 rounded-2xl p-5 md:p-6 space-y-4 backdrop-blur">
            <div className="flex items-center gap-2 text-[#E5C72A]">
              <Check className="w-5 h-5" />
              <span className="text-sm font-semibold uppercase tracking-widest">
                Confirme seus dados
              </span>
            </div>
            <div className="rounded-lg bg-white/10 p-4 text-sm space-y-1">
              <div>
                <span className="text-white/60">Nome:</span> <strong>{confirmed.nome}</strong>
              </div>
              <div>
                <span className="text-white/60">WhatsApp:</span> <strong>{confirmed.wa}</strong>
              </div>
            </div>
            <p className="text-xs text-white/70">
              Ao continuar vamos abrir a conversa no WhatsApp e te levar para a agenda com esses
              dados prontos.
            </p>
            <div className="flex flex-col sm:flex-row gap-2">
              <button
                type="button"
                onClick={seguir}
                className="flex-1 inline-flex items-center justify-center gap-2 rounded-lg bg-[#E5C72A] text-[#0D2E24] px-5 py-3 font-semibold hover:brightness-95 transition"
              >
                Continuar <ArrowRight className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => setConfirmed(null)}
                className="rounded-lg border border-white/20 text-white px-5 py-3 text-sm hover:bg-white/10 transition"
              >
                Corrigir
              </button>
            </div>
          </div>
        ) : (
          <form
            onSubmit={submit}
            className="bg-white/5 border border-white/10 rounded-2xl p-5 md:p-6 space-y-3 backdrop-blur"
          >
            {/* honeypot: hidden from humans, tempting to bots */}
            <input
              type="text"
              tabIndex={-1}
              autoComplete="off"
              value={honey}
              onChange={(e) => setHoney(e.target.value)}
              name="empresa"
              aria-hidden="true"
              className="hidden"
            />
            <div>
              <label className="text-[11px] uppercase tracking-widest text-white/70">Nome</label>
              <input
                value={nome}
                onChange={(e) => setNome(e.target.value)}
                placeholder="Como podemos te chamar?"
                className="mt-1 w-full rounded-lg bg-white text-[#0D2E24] px-4 py-3 outline-none focus:ring-2 focus:ring-[#E5C72A]"
                autoComplete="name"
                required
                minLength={2}
                maxLength={80}
              />
            </div>
            <div>
              <label className="text-[11px] uppercase tracking-widest text-white/70">
                WhatsApp
              </label>
              <input
                value={wa}
                onChange={(e) => setWa(maskPhoneInput(e.target.value))}
                placeholder="(31) 9 9999-9999"
                inputMode="tel"
                autoComplete="tel"
                required
                className="mt-1 w-full rounded-lg bg-white text-[#0D2E24] px-4 py-3 outline-none focus:ring-2 focus:ring-[#E5C72A]"
              />
            </div>
            <button
              type="submit"
              className="w-full inline-flex items-center justify-center gap-2 rounded-lg bg-[#E5C72A] text-[#0D2E24] px-5 py-3 font-semibold hover:brightness-95 transition"
            >
              Quero reservar <ArrowRight className="w-4 h-4" />
            </button>
            <p className="text-[11px] text-white/60 text-center">
              Sem spam. Usamos seu contato apenas para organizar a reserva.
            </p>
          </form>
        )}
      </div>
    </section>
  );
}
