import { LOCALES, type Locale } from './i18n';
import { SAMPLES } from './samples';

/**
 * The part of the view a link can carry: which sample is open, and in which language.
 *
 * It lives in the URL hash rather than the query string because the app is a static
 * build that may be served from a subdirectory — the hash never reaches the server and
 * so cannot confuse whatever is doing the serving.
 *
 * Both halves are validated against what actually exists. A hash is something anyone
 * can type or edit, so an unknown sample name has to fall back rather than leave the
 * app fetching a file that is not there.
 */
export type ViewState = {
  /** A file name from `SAMPLES`, or '' for a document the reader opened themselves. */
  sample: string;
  locale: Locale;
};

const isSample = (name: string) => SAMPLES.some((sample) => sample.file === name);
const isLocale = (code: string): code is Locale =>
  LOCALES.some((locale) => locale.code === code);

/** Reads `#sample=…&locale=…`, keeping `fallback` for anything missing or unknown. */
export function readViewState(hash: string, fallback: ViewState): ViewState {
  const params = new URLSearchParams(hash.replace(/^#/, ''));
  const sample = params.get('sample') ?? '';
  const locale = params.get('locale') ?? '';

  return {
    sample: isSample(sample) ? sample : fallback.sample,
    locale: isLocale(locale) ? locale : fallback.locale,
  };
}

/**
 * The hash for a view, `#` included.
 *
 * A reader's own file is left out: the name would mean nothing to whoever opened the
 * link, and a hash naming a sample that is not on screen would be a lie. The locale
 * still travels, so the link at least opens in the language it was shared in.
 */
export function viewStateHash(state: ViewState): string {
  const params = new URLSearchParams();
  if (isSample(state.sample)) params.set('sample', state.sample);
  params.set('locale', state.locale);

  return `#${params}`;
}
