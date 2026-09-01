import { ar } from "./ar";
import { en } from "./en";
import type { Language } from "../../types";

export const translations = {
  ar,
  en,
};

export const getTranslation = (lang: Language) => translations[lang] || translations.ar;
