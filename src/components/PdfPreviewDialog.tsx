import { useEffect, useMemo, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Download, Share2, MessageCircle, Loader2 } from "lucide-react";
import { gerarReservaPDFBlob, type ReservaPDFInput } from "@/lib/reserva-pdf";
import { waMambaia } from "@/lib/whatsapp";

type Props = {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  reserva: ReservaPDFInput | null;
};

export function PdfPreviewDialog({ open, onOpenChange, reserva }: Props) {
  const [pdf, setPdf] = useState<{ blob: Blob; url: string; filename: string } | null>(null);
  const [sharing, setSharing] = useState(false);

  useEffect(() => {
    if (open && reserva) {
      const gen = gerarReservaPDFBlob(reserva);
      setPdf(gen);
      return () => { URL.revokeObjectURL(gen.url); };
    } else {
      setPdf(null);
    }
  }, [open, reserva]);

  const canShare = useMemo(() => {
    if (typeof navigator === "undefined" || !pdf) return false;
    try {
      const file = new File([pdf.blob], pdf.filename, { type: "application/pdf" });
      return typeof navigator.canShare === "function" && navigator.canShare({ files: [file] });
    } catch { return false; }
  }, [pdf]);

  const baixar = () => {
    if (!pdf) return;
    const a = document.createElement("a");
    a.href = pdf.url; a.download = pdf.filename;
    document.body.appendChild(a); a.click(); a.remove();
  };

  const compartilhar = async () => {
    if (!pdf) return;
    setSharing(true);
    try {
      const file = new File([pdf.blob], pdf.filename, { type: "application/pdf" });
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (navigator as any).share({
        title: "Proposta Mambaia",
        text: "Sua proposta comercial da Mambaia.",
        files: [file],
      });
    } catch { /* usuário cancelou */ }
    finally { setSharing(false); }
  };

  const whatsappHref = reserva
    ? waMambaia(`Segue minha proposta comercial nº ${String(reserva.numeroProposta).padStart(4, "0")} da Mambaia.`)
    : "#";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl w-[95vw] max-h-[90vh] p-0 gap-0 overflow-hidden flex flex-col">
        <DialogHeader className="px-4 sm:px-6 py-3 border-b">
          <DialogTitle className="text-base sm:text-lg">Sua proposta comercial</DialogTitle>
        </DialogHeader>
        <div className="flex-1 bg-muted min-h-[50vh] overflow-hidden">
          {pdf ? (
            <iframe
              src={pdf.url}
              title="Pré-visualização da proposta"
              className="w-full h-full min-h-[50vh]"
            />
          ) : (
            <div className="flex items-center justify-center h-full text-muted-foreground">
              <Loader2 className="w-5 h-5 animate-spin" />
            </div>
          )}
        </div>
        <div className="px-4 sm:px-6 py-3 border-t bg-background grid grid-cols-1 sm:grid-cols-3 gap-2">
          <Button onClick={baixar} disabled={!pdf} className="w-full">
            <Download className="w-4 h-4" /> Baixar PDF
          </Button>
          {canShare ? (
            <Button onClick={compartilhar} disabled={!pdf || sharing} variant="outline" className="w-full">
              {sharing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Share2 className="w-4 h-4" />}
              Compartilhar
            </Button>
          ) : (
            <span className="hidden sm:block" />
          )}
          <a href={whatsappHref} target="_blank" rel="noreferrer" className="w-full">
            <Button variant="outline" className="w-full bg-[#25D366]/10 hover:bg-[#25D366]/20 border-[#25D366]/30">
              <MessageCircle className="w-4 h-4 text-[#25D366]" /> WhatsApp
            </Button>
          </a>
        </div>
      </DialogContent>
    </Dialog>
  );
}
