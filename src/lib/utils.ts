import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Maps any error (including raw Supabase/Postgrest errors) to a safe,
 * user-friendly Portuguese message. Logs the raw error to the console
 * so devs can still debug, but never leaks schema/constraint names to UI.
 */
export function friendlyErrorMessage(
  e: unknown,
  fallback = "Algo deu errado. Tente novamente.",
): string {
  // Zod errors carry user-facing validation messages - safe to show.
  // We avoid importing zod here to keep utils light; check by shape.
  if (
    e &&
    typeof e === "object" &&
    "issues" in e &&
    Array.isArray((e as { issues: unknown[] }).issues)
  ) {
    const first = (e as { issues: Array<{ message?: string }> }).issues[0];
    if (first?.message) return first.message;
  }
  // Anything that looks like a Postgrest/Supabase error → log + generic message.
  if (e && typeof e === "object" && ("code" in e || "details" in e || "hint" in e)) {
    console.error("[supabase error]", e);
    return fallback;
  }
  if (e instanceof Error) {
    console.error(e);
    return fallback;
  }
  console.error(e);
  return fallback;
}
