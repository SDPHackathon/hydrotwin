"use client";

import { useStoredValue } from "@/lib/useStoredValue";

export type Language = "en" | "bm";

export function useLanguage(scope?: string) {
  const key = scope ? `hydrotwin_language_${scope}` : "hydrotwin_language";
  const [stored, setStored] = useStoredValue(key);
  const language: Language = stored === "bm" ? "bm" : "en";

  const setLanguage = (next: Language) => {
    setStored(next);
  };

  const toggleLanguage = () => {
    setLanguage(language === "en" ? "bm" : "en");
  };

  return {
    language,
    setLanguage,
    toggleLanguage,
    ready: true,
  };
}
