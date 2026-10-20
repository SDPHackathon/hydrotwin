"use client";

import { useEffect, useState } from "react";

export type Language = "en" | "bm";

const LANGUAGE_KEY = "hydrotwin_language";

export function useLanguage() {
  const [language, setLanguage] = useState<Language>("en");
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem(LANGUAGE_KEY);

    if (saved === "en" || saved === "bm") {
      setLanguage(saved);
    }

    setReady(true);
  }, []);

  useEffect(() => {
    if (ready) {
      localStorage.setItem(LANGUAGE_KEY, language);
    }
  }, [language, ready]);

  const toggleLanguage = () => {
    setLanguage((current) => (current === "en" ? "bm" : "en"));
  };

  return {
    language,
    setLanguage,
    toggleLanguage,
    ready,
  };
}
