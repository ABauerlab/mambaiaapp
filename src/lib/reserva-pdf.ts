import { jsPDF } from "jspdf";
import { formatBRL } from "./money";
import { formatPhoneBR } from "./phone";

export type ReservaPDFInput = {
  cliente: string;
  whatsapp: string;
  data: string; // yyyy-mm-dd
  horaInicio: string; // HH:MM
  duracaoMinutos: number;
  valorTotal: number;
  valorPago: number;
  tipoPagamento: "integral" | "parcial";
  paidAt: string; // ISO
  slug: string;
  numeroProposta: number;
  tipo?: "locacao" | "pacote_marcas";
  empreendimento?: string | null;
};

const BRAND_DARK = "#1F3D2B";
const BRAND_LIME = "#C7E56A";
const BRAND_CREAM = "#F4EFE1";

function formatDuracao(min: number): string {
  const h = Math.floor(min / 60);
  const m = min % 60;
  if (h && m) return `${h}h${m}`;
  if (h) return `${h}h`;
  return `${m}min`;
}

function formatDataBR(iso: string): string {
  const d = new Date(iso + "T12:00:00");
  return d.toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "long", year: "numeric" });
}

function formatDateTimeBR(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

function slugNome(nome: string): string {
  return nome
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 40);
}

export function nomeArquivoProposta(r: Pick<ReservaPDFInput, "numeroProposta" | "cliente">): string {
  return `proposta-comercial-${r.numeroProposta}-${slugNome(r.cliente)}.pdf`;
}

export function gerarReservaPDF(r: ReservaPDFInput): jsPDF {
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const W = doc.internal.pageSize.getWidth();
  const H = doc.internal.pageSize.getHeight();

  const isPacote = r.tipo === "pacote_marcas";
  const numeroFmt = String(r.numeroProposta).padStart(4, "0");
  const codigo = `PC-${numeroFmt}`;

  // Fundo verde escuro no topo
  doc.setFillColor(BRAND_DARK);
  doc.rect(0, 0, W, 160, "F");

  doc.setTextColor(BRAND_CREAM);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(28);
  doc.text("MAMBAIA", 40, 60);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(11);
  doc.text("Estúdio criativo · Praça Sete · Belo Horizonte", 40, 82);
  doc.setFontSize(10);
  doc.text(`Proposta comercial nº ${numeroFmt}`, 40, 100);

  doc.setFillColor(BRAND_LIME);
  doc.roundedRect(W - 220, 40, 180, 50, 10, 10, "F");
  doc.setTextColor(BRAND_DARK);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.text("PAGAMENTO CONFIRMADO", W - 210, 65);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.text(isPacote ? "Ordem de serviço · Pacote Marcas" : "Ordem de serviço · Locação", W - 210, 80);

  let y = 200;
  doc.setTextColor(30, 30, 30);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.text(`Proposta comercial nº ${numeroFmt} — ${r.cliente}`, 40, y);
  y += 22;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(11);
  doc.text(
    isPacote
      ? "Seu pacote fotográfico no estúdio Mambaia está garantido. Guarde este comprovante."
      : "Seu horário no estúdio Mambaia está garantido. Guarde este comprovante.",
    40, y,
  );
  y += 30;

  doc.setFillColor(244, 239, 225);
  doc.roundedRect(40, y, W - 80, isPacote ? 150 : 130, 8, 8, "F");
  doc.setTextColor(BRAND_DARK);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.text(isPacote ? "SEU PACOTE" : "SUA RESERVA", 60, y + 24);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.text(formatDataBR(r.data), 60, y + 50);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(12);
  doc.text(`Início: ${r.horaInicio}  ·  Duração: ${formatDuracao(r.duracaoMinutos)}`, 60, y + 70);
  doc.text("Cliente: " + r.cliente, 60, y + 90);
  doc.text("WhatsApp: " + formatPhoneBR(r.whatsapp), 60, y + 108);
  if (isPacote && r.empreendimento) {
    doc.text("Empreendimento: " + r.empreendimento, 60, y + 126);
    y += 170;
  } else {
    y += 150;
  }

  doc.setFillColor(240, 245, 235);
  doc.roundedRect(40, y, W - 80, 90, 8, 8, "F");
  doc.setTextColor(BRAND_DARK);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.text("PAGAMENTO", 60, y + 24);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(11);
  const tipo = r.tipoPagamento === "integral" ? "Integral (100%)" : "Sinal parcial (50%)";
  doc.text("Tipo: " + tipo, 60, y + 46);
  doc.text("Valor pago: " + formatBRL(r.valorPago), 60, y + 62);
  doc.text("Valor total: " + formatBRL(r.valorTotal), 260, y + 62);
  doc.text("Recebido em: " + formatDateTimeBR(r.paidAt), 60, y + 78);
  if (r.tipoPagamento === "parcial") {
    doc.setFont("helvetica", "bold");
    doc.text("Restante no dia: " + formatBRL(Math.max(0, r.valorTotal - r.valorPago)), 260, y + 78);
  }
  y += 110;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(BRAND_DARK);
  doc.text("COMBINADOS IMPORTANTES", 40, y);
  y += 16;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(60, 60, 60);
  const bulletsLocacao = [
    "Confira o horário reservado — chegue com alguns minutos de folga.",
    "Fração adicional cobrada a cada 30 minutos: R$ 50.",
    "Se precisar de mais tempo no dia, alinhe com a equipe pelo WhatsApp.",
    "Deixe o ambiente limpo e organizado, exatamente como estava ao chegar.",
    "Cuide dos equipamentos e do espaço — a Mambaia é casa nossa e sua.",
    "Em caso de imprevisto, avise com antecedência para reagendarmos.",
  ];
  const bulletsPacote = [
    "Traga as peças organizadas — quanto mais preparado, mais fotos rendemos na hora.",
    "Pacote de 1h fixa: fotografia, edição e making-of inclusos.",
    "Entrega das fotos editadas em até 5 dias úteis por link privado.",
    "Uso das imagens é livre para catálogo, site e redes do seu empreendimento.",
    "Trate os equipamentos e o espaço com carinho — mantenha o estúdio limpo.",
    "Em caso de imprevisto, avise com antecedência para reagendarmos.",
  ];
  const bullets = isPacote ? bulletsPacote : bulletsLocacao;
  for (const b of bullets) {
    const lines = doc.splitTextToSize("• " + b, W - 80);
    doc.text(lines, 40, y);
    y += lines.length * 14;
  }

  doc.setDrawColor(200, 200, 200);
  doc.line(40, H - 60, W - 40, H - 60);
  doc.setFontSize(9);
  doc.setTextColor(120, 120, 120);
  doc.text("Mambaia · Praça Sete, Belo Horizonte · WhatsApp (31) 9 9802-1169", 40, H - 40);
  doc.text(`Código da proposta: ${codigo}  ·  ref. ${r.slug}`, 40, H - 25);

  return doc;
}

export function baixarReservaPDF(r: ReservaPDFInput) {
  const doc = gerarReservaPDF(r);
  doc.save(nomeArquivoProposta(r));
}

/** Retorna { blob, url, filename } para preview e compartilhamento. */
export function gerarReservaPDFBlob(r: ReservaPDFInput): { blob: Blob; url: string; filename: string } {
  const doc = gerarReservaPDF(r);
  const blob = doc.output("blob");
  const url = URL.createObjectURL(blob);
  return { blob, url, filename: nomeArquivoProposta(r) };
}