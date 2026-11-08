/**
 * Live interface translation.
 *
 * Most of the UI was written with the Spanish text inline, so instead of threading `t()`
 * through ~90 components, this module watches the rendered DOM and swaps every known
 * Spanish UI text (text nodes + placeholder/title/aria-label) for its English version
 * while the language is English. It remembers the original text of every node, so going
 * back to Spanish restores it, and whatever React renders later is translated as it lands.
 *
 * Only exact UI phrases from the dictionary (and a few number patterns) are touched: song
 * titles, artists, lyrics and the user's own playlist names are left as they are. Elements
 * (or ancestors) with translate="no" / class "notranslate" are skipped.
 */
import { EN_DICTIONARY } from './i18nDictionary';
import { EN_DICTIONARY_EXTRA } from './i18nDictionaryExtra';
import { TRANSLATIONS, useLanguageStore, type Language } from './i18n';

type Pattern = { re: RegExp; to: string };

const exact = new Map<string, string>();
const patterns: Pattern[] = [];
let built = false;

function escapeRe(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function addEntry(es: string, en: string) {
  const k = es.replace(/\s+/g, ' ').trim();
  if (!k || !en) return;
  if (/\{\d\}/.test(k)) {
    const re = new RegExp('^' + escapeRe(k).replace(/\\\{(\d)\\\}/g, '(.+?)') + '$');
    // placeholders appear in order {0},{1}...; map group i -> {i}
    patterns.push({ re, to: en });
  } else if (!exact.has(k)) {
    exact.set(k, en);
  }
}

function build() {
  if (built) return;
  built = true;
  for (const [es, en] of Object.entries(EN_DICTIONARY)) addEntry(es, en);
  for (const [es, en] of Object.entries(EN_DICTIONARY_EXTRA)) addEntry(es, en);
  // Keys of the small i18n table too (same texts, used by t())
  const es = TRANSLATIONS.es as Record<string, string>;
  const en = TRANSLATIONS.en as Record<string, string>;
  for (const k of Object.keys(es)) if (en[k]) addEntry(es[k], en[k]);
  // Generic number / time patterns
  patterns.push(
    { re: /^(\d[\d.,]*) canciones$/, to: '{0} songs' },
    { re: /^(\d[\d.,]*) canción$/, to: '{0} song' },
    { re: /^(\d[\d.,]*) canciones, (.+)$/, to: '{0} songs, {1}' },
    { re: /^(\d[\d.,]*) oyentes mensuales$/, to: '{0} monthly listeners' },
    { re: /^(\d[\d.,]*) seguidores$/, to: '{0} followers' },
    { re: /^(\d[\d.,]*) me gusta$/i, to: '{0} likes' },
    { re: /^(\d+) h (\d+) min$/, to: '{0} hr {1} min' },
    { re: /^(\d+) min (\d+) s$/, to: '{0} min {1} sec' },
    { re: /^aprox\. (.+)$/, to: 'about {0}' },
    { re: /^(.+) ocupados en «(.+)»$/, to: '{0} used in “{1}”' },
    { re: /^Hace (\d+) (minutos?|horas?|días?|semanas?|meses|mes)$/i, to: '{0} {1} ago' },
    { re: /^hace (\d+) (minutos?|horas?|días?|semanas?|meses|mes)$/i, to: '{0} {1} ago' },
    { re: /^(\d+) (minutos?|horas?|días?|semanas?) restantes?$/, to: '{0} {1} left' },
  );
}

const UNIT_EN: Record<string, string> = {
  minuto: 'minute', minutos: 'minutes', hora: 'hour', horas: 'hours', día: 'day', días: 'days',
  semana: 'week', semanas: 'weeks', mes: 'month', meses: 'months',
};

/** English for a Spanish UI string, or null when it is not a known UI text. */
export function translateToEnglish(text: string): string | null {
  build();
  const m = /^(\s*)([\s\S]*?)(\s*)$/.exec(text);
  if (!m) return null;
  const core = m[2].replace(/\s+/g, ' ');
  if (!core || core.length > 400 || !/[A-Za-zÁÉÍÓÚáéíóúñÑ]/.test(core)) return null;
  let out = exact.get(core);
  if (out === undefined) {
    for (const p of patterns) {
      const mm = p.re.exec(core);
      if (!mm) continue;
      out = p.to.replace(/\{(\d)\}/g, (_, i) => {
        const v = mm[Number(i) + 1] ?? '';
        const unit = UNIT_EN[v.toLowerCase()];
        if (unit) return unit;
        return exact.get(v) ?? v;
      });
      break;
    }
  }
  if (out === undefined) {
    // Composite labels ("Playlist • 12 canciones", "Lista • Hecha para Ana"): translate each part
    for (const sep of [' • ', ' · ', ' | ']) {
      if (!core.includes(sep)) continue;
      const parts = core.split(sep);
      let changed = false;
      const tr = parts.map((p) => {
        const t = translateToEnglish(p);
        if (t !== null && t !== p) {
          changed = true;
          return t;
        }
        return p;
      });
      if (changed) {
        out = tr.join(sep);
        break;
      }
    }
  }
  if (out === undefined) return null;
  return m[1] + out + m[3];
}

// ---------------------------------------------------------------------------
// DOM layer
// ---------------------------------------------------------------------------
const ATTRS = ['placeholder', 'title', 'aria-label'] as const;
const textOrig = new WeakMap<Text, string>();
const textSet = new WeakMap<Text, string>();
const attrOrig = new WeakMap<Element, Map<string, string>>();
const attrSet = new WeakMap<Element, Map<string, string>>();
let lang: Language = 'es';
let observer: MutationObserver | null = null;
let originalTitle: string | null = null;

function skipElement(el: Element | null): boolean {
  for (let e = el; e; e = e.parentElement) {
    const tag = e.tagName;
    if (tag === 'SCRIPT' || tag === 'STYLE' || tag === 'TEXTAREA' || tag === 'CODE' || tag === 'PRE') return true;
    if (e.getAttribute('translate') === 'no' || e.classList?.contains('notranslate')) return true;
    if ((e as HTMLElement).isContentEditable && e.getAttribute('contenteditable') === 'true') return true;
  }
  return false;
}

function processText(n: Text) {
  if (lang !== 'en') return;
  const cur = n.data;
  if (textSet.get(n) === cur) return; // our own write
  textOrig.set(n, cur);
  textSet.delete(n);
  if (lang !== 'en') return;
  if (skipElement(n.parentElement)) return;
  const tr = translateToEnglish(cur);
  if (tr !== null && tr !== cur) {
    textSet.set(n, tr);
    n.data = tr;
  }
}

function processAttrs(el: Element) {
  if (lang !== 'en') return;
  for (const a of ATTRS) {
    const cur = el.getAttribute(a);
    if (cur === null) continue;
    const set = attrSet.get(el);
    if (set?.get(a) === cur) continue;
    let orig = attrOrig.get(el);
    if (!orig) attrOrig.set(el, (orig = new Map()));
    orig.set(a, cur);
    set?.delete(a);
    if (lang !== 'en' || skipElement(el)) continue;
    const tr = translateToEnglish(cur);
    if (tr !== null && tr !== cur) {
      let s = attrSet.get(el);
      if (!s) attrSet.set(el, (s = new Map()));
      s.set(a, tr);
      el.setAttribute(a, tr);
    }
  }
}

function walk(root: Node) {
  if (root.nodeType === Node.TEXT_NODE) {
    processText(root as Text);
    return;
  }
  if (root.nodeType !== Node.ELEMENT_NODE && root.nodeType !== Node.DOCUMENT_FRAGMENT_NODE) return;
  if (root.nodeType === Node.ELEMENT_NODE) processAttrs(root as Element);
  const tw = document.createTreeWalker(root, NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT);
  let n = tw.nextNode();
  while (n) {
    if (n.nodeType === Node.TEXT_NODE) processText(n as Text);
    else processAttrs(n as Element);
    n = tw.nextNode();
  }
}

function restoreAll() {
  const tw = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT);
  let n = tw.nextNode();
  while (n) {
    if (n.nodeType === Node.TEXT_NODE) {
      const t = n as Text;
      const o = textOrig.get(t);
      if (o !== undefined && textSet.get(t) === t.data) {
        textSet.delete(t);
        t.data = o;
      }
    } else {
      const el = n as Element;
      const o = attrOrig.get(el);
      const s = attrSet.get(el);
      if (o && s) {
        for (const [a, v] of s) if (el.getAttribute(a) === v && o.has(a)) el.setAttribute(a, o.get(a)!);
        s.clear();
      }
    }
    n = tw.nextNode();
  }
}

function applyTitle() {
  if (originalTitle === null) originalTitle = document.title;
  if (lang === 'en') {
    const tr = translateToEnglish(document.title);
    if (tr) document.title = tr;
  } else if (originalTitle) {
    document.title = originalTitle;
  }
}

function setLanguage(next: Language) {
  if (next === lang) return;
  lang = next;
  document.documentElement.lang = next;
  if (next === 'en') walk(document.body);
  else restoreAll();
  applyTitle();
}

/** Starts the live translator (idempotent). */
export function initDomTranslator() {
  if (typeof window === 'undefined' || typeof MutationObserver === 'undefined' || observer) return;
  build();
  observer = new MutationObserver((records) => {
    for (const r of records) {
      if (r.type === 'characterData') processText(r.target as Text);
      else if (r.type === 'attributes') processAttrs(r.target as Element);
      else r.addedNodes.forEach((n) => walk(n));
    }
  });
  const start = () => {
    observer!.observe(document.body, {
      subtree: true,
      childList: true,
      characterData: true,
      attributes: true,
      attributeFilter: ATTRS as unknown as string[],
    });
    lang = 'es';
    setLanguage(useLanguageStore.getState().language);
  };
  if (document.body) start();
  else window.addEventListener('DOMContentLoaded', start, { once: true });
  useLanguageStore.subscribe((s) => setLanguage(s.language));
}
