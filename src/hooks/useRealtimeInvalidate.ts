import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

/**
 * Subscribe to Postgres changes on `table` and invalidate every query
 * whose queryKey starts with one of `queryKeys` when any change fires.
 */
export function useRealtimeInvalidate(table: string, queryKeys: string[]) {
  const qc = useQueryClient();
  useEffect(() => {
    if (typeof window === "undefined") return;
    const channel = supabase
      .channel(`rt-${table}-${Math.random().toString(36).slice(2, 8)}`)
      .on("postgres_changes", { event: "*", schema: "public", table }, () => {
        for (const key of queryKeys) qc.invalidateQueries({ queryKey: [key] });
      })
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [table, queryKeys.join("|")]);
}