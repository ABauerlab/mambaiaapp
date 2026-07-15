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

export function gerarReservaPDF(r: ReservaPDFInput): jsPDF {
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const W = doc.internal.pageSize.getWidth();
  const H = doc.internal.pageSize.getHeight();

  // Fundo verde escuro no topo
  doc.setFillColor(BRAND_DARK);
  doc.rect(0, 0, W, 160, "F");

  // Título
  doc.setTextColor(BRAND_CREAM);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(28);
  doc.text("MAMBAIA", 40, 60);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(11);
  doc.text("Estudio criativo · Praca Sete · Belo Horizonte", 40, 82);

  // Badge de confirmação
  doc.setFillColor(BRAND_LIME);
  doc.roundedRect(W - 220, 40, 180, 50, 10, 10, "F");
  doc.setTextColor(BRAND_DARK);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.text("RESERVA CONFIRMADA", W - 210, 65);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.text("Comprovante de pagamento", W - 210, 80);

  // Corpo
  let y = 200;
  doc.setTextColor(30, 30, 30);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.text("Ola, " + r.cliente + "!", 40, y);
  y += 22;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(11);
  doc.text("Seu horario no estudio Mambaia esta garantido. Guarde este comprovante.", 40, y);
  y += 30;

  // Bloco "Sua reserva"
  doc.setFillColor(244, 239, 225);
  doc.roundedRect(40, y, W - 80, 130, 8, 8, "F");
  doc.setTextColor(BRAND_DARK);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.text("SUA RESERVA", 60, y + 24);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.text(formatDataBR(r.data), 60, y + 50);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(12);
  doc.text("Inicio: " + r.horaInicio + "  ·  Duracao: " + formatDuracao(r.duracaoMinutos), 60, y + 70);
  doc.text("Cliente: " + r.cliente, 60, y + 90);
  doc.text("WhatsApp: " + formatPhoneBR(r.whatsapp), 60, y + 108);
  y += 150;

  // Bloco pagamento
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

  // Combinados
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(BRAND_DARK);
  doc.text("COMBINADOS IMPORTANTES", 40, y);
  y += 16;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(60, 60, 60);
  const bullets = [
    "Cheque o horario reservado - chegue com alguns minutos de folga.",
    "Fracao adicional cobrada a cada 30 minutos: R$ 50.",
    "Se precisar de mais tempo no dia, alinhe com a equipe pelo WhatsApp.",
    "Deixe o ambiente limpo e organizado, exatamente como estava ao chegar.",
    "Cuide dos equipamentos e do espaco - a Mambaia e casa nossa e sua.",
    "Em caso de imprevisto, avise com antecedencia para reagendarmos.",
  ];
  for (const b of bullets) {
    const lines = doc.splitTextToSize("• " + b, W - 80);
    doc.text(lines, 40, y);
    y += lines.length * 14;
  }

  // Rodapé
  doc.setDrawColor(200, 200, 200);
  doc.line(40, H - 60, W - 40, H - 60);
  doc.setFontSize(9);
  doc.setTextColor(120, 120, 120);
  doc.text("Mambaia - Praca Sete, Belo Horizonte · WhatsApp (31) 9 9802-1169", 40, H - 40);
  doc.text("Codigo da reserva: " + r.slug, 40, H - 25);

  return doc;
}

export function baixarReservaPDF(r: ReservaPDFInput) {
  const doc = gerarReservaPDF(r);
  doc.save(`reserva-mambaia-${r.data}-${r.slug}.pdf`);
}