import { useState } from "react";
import { Calendar as CalIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import type { DateRange } from "react-day-picker";

export type DateRangeValue = { from: Date; to: Date };

function startOfDay(d: Date) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}
function endOfDay(d: Date) {
  const x = new Date(d);
  x.setHours(23, 59, 59, 999);
  return x;
}

export function rangePresets() {
  const today = new Date();
  const ini = (n: number) => {
    const d = new Date();
    d.setDate(d.getDate() - n);
    return startOfDay(d);
  };
  const mesAtualIni = new Date(today.getFullYear(), today.getMonth(), 1);
  const mesAtualFim = new Date(today.getFullYear(), today.getMonth() + 1, 0);
  const mesPassadoIni = new Date(today.getFullYear(), today.getMonth() - 1, 1);
  const mesPassadoFim = new Date(today.getFullYear(), today.getMonth(), 0);
  return {
    hoje: { from: startOfDay(today), to: endOfDay(today) },
    sete: { from: ini(6), to: endOfDay(today) },
    trinta: { from: ini(29), to: endOfDay(today) },
    mesAtual: { from: mesAtualIni, to: endOfDay(mesAtualFim) },
    mesPassado: { from: mesPassadoIni, to: endOfDay(mesPassadoFim) },
    ano: { from: new Date(today.getFullYear(), 0, 1), to: endOfDay(today) },
  } as Record<string, DateRangeValue>;
}

export function defaultMonthRange(): DateRangeValue {
  return rangePresets().mesAtual;
}

export function isInRange(dateStr: string, r: DateRangeValue): boolean {
  // dateStr "YYYY-MM-DD"
  const d = new Date(dateStr + "T12:00:00");
  return d >= r.from && d <= r.to;
}

export function formatRange(r: DateRangeValue): string {
  const f = (d: Date) => d.toLocaleDateString("pt-BR", { day: "2-digit", month: "short" });
  if (r.from.toDateString() === r.to.toDateString()) return f(r.from);
  return `${f(r.from)} - ${f(r.to)}`;
}

export function DateRangeFilter({
  value,
  onChange,
  className,
}: {
  value: DateRangeValue;
  onChange: (r: DateRangeValue) => void;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const presets = rangePresets();
  const [tmp, setTmp] = useState<DateRange | undefined>({ from: value.from, to: value.to });

  function apply(r: DateRangeValue) {
    onChange(r);
    setOpen(false);
  }

  return (
    <Popover
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (o) setTmp({ from: value.from, to: value.to });
      }}
    >
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className={cn("h-9", className)}>
          <CalIcon className="w-4 h-4 mr-2" />
          {formatRange(value)}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-auto p-0">
        <div className="flex">
          <div className="flex flex-col gap-1 p-2 border-r min-w-[140px]">
            <PresetBtn onClick={() => apply(presets.hoje)}>Hoje</PresetBtn>
            <PresetBtn onClick={() => apply(presets.sete)}>Últimos 7 dias</PresetBtn>
            <PresetBtn onClick={() => apply(presets.trinta)}>Últimos 30 dias</PresetBtn>
            <PresetBtn onClick={() => apply(presets.mesAtual)}>Mês atual</PresetBtn>
            <PresetBtn onClick={() => apply(presets.mesPassado)}>Mês passado</PresetBtn>
            <PresetBtn onClick={() => apply(presets.ano)}>Este ano</PresetBtn>
          </div>
          <div className="p-2">
            <Calendar
              mode="range"
              selected={tmp}
              onSelect={(r) => setTmp(r)}
              numberOfMonths={1}
              className={cn("p-2 pointer-events-auto")}
            />
            <div className="flex justify-end gap-2 px-2 pb-2">
              <Button size="sm" variant="ghost" onClick={() => setOpen(false)}>
                Cancelar
              </Button>
              <Button
                size="sm"
                disabled={!tmp?.from || !tmp?.to}
                onClick={() => {
                  if (tmp?.from && tmp?.to)
                    apply({ from: startOfDay(tmp.from), to: endOfDay(tmp.to) });
                }}
              >
                Aplicar
              </Button>
            </div>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}

function PresetBtn({ onClick, children }: { onClick: () => void; children: React.ReactNode }) {
  return (
    <button onClick={onClick} className="text-left text-sm px-3 py-1.5 rounded hover:bg-accent">
      {children}
    </button>
  );
}
