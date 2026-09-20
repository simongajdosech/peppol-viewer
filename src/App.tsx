import { useEffect, useMemo, useState } from 'react';
import { pdfjs } from 'react-pdf';
import 'react-pdf/dist/Page/TextLayer.css';
import { SAMPLES } from './samples';
import { parseUbl, type UblDocument } from './ubl';
import { LOCALES, translation, type Locale } from './i18n';
import { InvoicePreview } from './InvoicePreview';
import './App.css';

pdfjs.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs',
  import.meta.url,
).toString();

type Source = { label: string; xml: string };

export default function App() {
  const [selected, setSelected] = useState(SAMPLES[0].file);
  const [locale, setLocale] = useState<Locale>('en');
  const [source, setSource] = useState<Source | null>(null);
  const [invoice, setInvoice] = useState<UblDocument | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showXml, setShowXml] = useState(false);

  const t = useMemo(() => translation(locale), [locale]);

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

        {showXml && source ? (
          <pre className="xml">{source.xml}</pre>
        ) : (
          invoice && (
            <InvoicePreview key={source?.label} invoice={invoice} locale={locale} t={t} />
          )
        )}
      </main>
    </div>
  );
}
