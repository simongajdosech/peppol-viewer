import { lazy, Suspense, useEffect, useMemo, useState } from 'react';
import { AttachmentList } from './AttachmentList';
import { SAMPLES } from './samples';
import { parseUbl, type UblDocument } from './ubl';
import { readViewState, viewStateHash, type ViewState } from './viewState';
import { LOCALES, translation, type Locale } from './i18n';
import './App.css';

/**
 * @react-pdf/renderer and react-pdf together are most of the bundle, and nothing
 * outside the document view needs either — the sidebar, the sample list and the XML
 * view render without them. Keeping them behind a dynamic import lets the shell paint
 * before that chunk has even been fetched.
 */
const loadPreview = () => import('./InvoicePreview');
const InvoicePreview = lazy(() => loadPreview().then((m) => ({ default: m.InvoicePreview })));

type Source = { label: string; xml: string };

const DEFAULT_VIEW: ViewState = { sample: SAMPLES[0].file, locale: 'en' };

/**
 * Puts the URL in step with the view, without a history entry — flicking between
 * languages should not fill the back button with steps nobody wants to retrace.
 * `replaceState` does not raise `hashchange`, so this cannot loop.
 */
function writeHash(state: ViewState) {
  const hash = viewStateHash(state);
  if (hash !== window.location.hash) {
    window.history.replaceState(null, '', hash);
  }
}

export default function App() {
  // The link someone arrived on decides the first view, so it is read before the
  // first render rather than applied afterwards in an effect.
  const [view] = useState(() => readViewState(window.location.hash, DEFAULT_VIEW));
  const [selected, setSelected] = useState(view.sample);
  const [locale, setLocale] = useState<Locale>(view.locale);
  const [source, setSource] = useState<Source | null>(null);
  const [invoice, setInvoice] = useState<UblDocument | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showXml, setShowXml] = useState(false);
  const [dragging, setDragging] = useState(false);

  const t = useMemo(() => translation(locale), [locale]);

  // Start pulling the PDF chunk down as soon as the shell mounts, alongside the fetch
  // of the first sample, so splitting it out costs nothing in time-to-document. React
  // reuses this same module promise when Suspense resolves the lazy component.
  useEffect(() => {
    void loadPreview();
  }, []);

  function load(label: string, xml: string) {
    try {
      setInvoice(parseUbl(xml));
      setSource({ label, xml });
      setError(null);
    } catch (err) {
      setInvoice(null);
      setSource({ label, xml });
      setError(err instanceof Error ? err.message : String(err));
    }
  }

  useEffect(() => {
    // '' means the reader opened their own file, which `openFile` has already loaded.
    // Without this the effect fetched `samples/` with no name on the end, and whatever
    // came back — a directory listing, a 404 page — replaced the document they had
    // just opened with a parse error.
    if (!selected) return;

    let cancelled = false;
    setInvoice(null);
    setSource(null);
    setError(null);

    fetch(`${import.meta.env.BASE_URL}samples/${selected}`)
      .then((res) => {
        if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
        return res.text();
      })
      .then((xml) => {
        if (!cancelled) load(selected, xml);
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(err instanceof Error ? err.message : String(err));
      });

    return () => {
      cancelled = true;
    };
  }, [selected]);

  useEffect(() => {
    writeHash({ sample: selected, locale });
  }, [selected, locale]);

  // The URL is the authority, so an edit to it — or a second link pasted into the same
  // tab — moves the app rather than being silently overwritten on the next render.
  useEffect(() => {
    const onHashChange = () => {
      const next = readViewState(window.location.hash, { sample: selected, locale });
      setSelected(next.sample);
      setLocale(next.locale);
      // When the hash named a sample or a language this app does not have, `next` is
      // what is already on screen, React bails out of both updates and the effect
      // above never runs — so the URL is corrected here instead of being left saying
      // something untrue.
      writeHash(next);
    };

    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  }, [selected, locale]);

  async function openFile(file: File) {
    // A file off the reader's own disk cannot be named in a link, so the hash drops
    // back to carrying the locale alone.
    setSelected('');
    load(file.name, await file.text());
  }

  async function onFile(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    await openFile(file);
    event.target.value = '';
  }

  function onDragOver(event: React.DragEvent) {
    // Without preventDefault on dragover the browser navigates to the file instead of
    // letting the drop through.
    event.preventDefault();
    setDragging(true);
  }

  function onDragLeave(event: React.DragEvent) {
    // Moving between children fires dragleave on the way out of each one; only the
    // pointer actually leaving the app should clear the state.
    if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
      setDragging(false);
    }
  }

  async function onDrop(event: React.DragEvent) {
    event.preventDefault();
    setDragging(false);

    const file = event.dataTransfer.files[0];
    if (file) await openFile(file);
  }

  return (
    <div
      className={dragging ? 'app dragging' : 'app'}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
    >
      {dragging && <div className="drop-hint">{t.dropHint}</div>}

      <aside>
        <h1>Peppol Viewer</h1>
        <p className="tagline">{t.appTagline}</p>

        <div className="locale-switch" role="group" aria-label={t.language}>
          {LOCALES.map((option) => (
            <button
              key={option.code}
              type="button"
              className={option.code === locale ? 'active' : ''}
              onClick={() => setLocale(option.code)}
            >
              {option.label}
            </button>
          ))}
        </div>

        <ul>
          {SAMPLES.map((sample) => (
            <li key={sample.file}>
              <button
                type="button"
                className={sample.file === selected ? 'active' : ''}
                onClick={() => setSelected(sample.file)}
              >
                <strong>{sample.label}</strong>
                <span>{sample.note}</span>
              </button>
            </li>
          ))}
        </ul>

        <label className="file-input">
          {t.openOwnFile}
          <input type="file" accept=".xml,text/xml,application/xml" onChange={onFile} />
        </label>
      </aside>

      <main>
        <header className="main-header">
          <h2>{source?.label ?? '…'}</h2>
          {!!source && (
            <button type="button" className="toggle" onClick={() => setShowXml((v) => !v)}>
              {showXml ? t.showDocument : t.showXml}
            </button>
          )}
        </header>

        {error && <p className="error">{error}</p>}

        {/* Above both views on purpose: a file that came with the document is worth
            reaching whether you are reading the rendered page or the raw XML. */}
        {invoice && <AttachmentList invoice={invoice} t={t} />}

        {showXml && source ? (
          <pre className="xml">{source.xml}</pre>
        ) : (
          invoice && (
            <Suspense fallback={<p className="muted">{t.loadingDocument}</p>}>
              <InvoicePreview key={source?.label} invoice={invoice} locale={locale} t={t} />
            </Suspense>
          )
        )}
      </main>
    </div>
  );
}
