import * as en from '../translations/en.json';
import * as de from '../translations/de.json';
import * as es from '../translations/es.json';
import * as fr from '../translations/fr.json';
import * as it from '../translations/it.json';
import * as nl from '../translations/nl.json';
import * as pt from '../translations/pt.json';
import * as ru from '../translations/ru.json';
import * as zh from '../translations/zh.json';
import * as he from '../translations/he.json';

const languages: Record<string, any> = { en, de, es, fr, it, nl, pt, ru, zh, he };
const DEFAULT_LANG = 'en';

function getTranslatedString(key: string, lang: string): string | undefined {
  try { return key.split('.').reduce((o, i) => (o as Record<string, unknown>)[i], languages[lang]) as string; } catch { return undefined; }
}

let _localize: ((key: string) => string) | undefined = undefined;

export function setupLocalize(hass?: any): void {
  let lang = DEFAULT_LANG;
  if (hass?.locale?.language) lang = hass.locale.language;
  else if (hass?.language) lang = hass.language;
  else if (navigator.language) lang = navigator.language.split('-')[0];
  if (!languages[lang]) lang = DEFAULT_LANG;
  _localize = (key: string) => getTranslatedString(key, lang) ?? getTranslatedString(key, DEFAULT_LANG) ?? key;
}

export function localize(key: string): string {
  if (!_localize) return key;
  return _localize(key);
}
