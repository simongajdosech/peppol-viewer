import { lazy, Suspense, useEffect, useMemo, useState } from 'react';
import { AttachmentList } from './AttachmentList';
import { SAMPLES } from './samples';
import { parseUbl, type UblDocument } from './ubl';
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

export default function App() {
  const [selected, setSelected] = useState(SAMPLES[0].file);
  const [locale, setLocale] = useState<Locale>('en');
  const [source, setSource] = useState<Source | null>(null);
  const [invoice, setInvoice] = useState<UblDocument | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showXml, setShowXml] = useState(false);

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

  async function onFile(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    setSelected('');
    load(file.name, await file.text());
    event.target.value = '';
  }

  return (
    <div className="app">
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
