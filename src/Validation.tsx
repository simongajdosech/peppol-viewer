import { useId, useState } from 'react';
import type { Translation } from './i18n';
import { errorsIn, type Finding } from './validate';

/**
 * The pass/fail badge in the preview toolbar, and the panel it opens. The rules
 * themselves live in `validate.ts`; this only decides how to say what they found.
 */
export function ValidationBadge({
  findings,
  currency,
  t,
}: {
  findings: Finding[];
  currency: string;
  t: Translation;
}) {
  const [open, setOpen] = useState(false);
  const panelId = useId();

  const errors = errorsIn(findings);
  const warnings = findings.length - errors.length;
  const state = errors.length > 0 ? 'fail' : warnings > 0 ? 'warn' : 'pass';

  const label =
    errors.length > 0
      ? t.checksFailed(errors.length)
      : warnings > 0
        ? t.checksAdvisory(warnings)
        : t.checksPassed;

  if (findings.length === 0) {
    return (
      <span className={`badge ${state}`} title={t.checks}>
        {label}
      </span>
    );
  }

  return (
    <div className="validation">
      <button
        type="button"
        className={`badge ${state}`}
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-controls={panelId}
      >
        {label}
      </button>

      {open && (
        <ul className="findings" id={panelId}>
          {findings.map((finding, index) => (
            <li key={`${finding.rule}-${index}`} className={finding.severity}>
              <span className="rule-id">{finding.rule}</span>
              <span className="rule-text">
                {t.rules[finding.key] ?? finding.key}
                {finding.vat && (
                  <em>
                    {' '}
                    {t.vatCategory(finding.vat.category)}
                    {finding.vat.percent ? ` ${t.percent(finding.vat.percent)}` : ''}
                  </em>
                )}
              </span>
              {finding.expected !== undefined && finding.found !== undefined && (
                <span className="rule-numbers">
                  {t.ruleExpected} {t.money(finding.expected, currency)} · {t.ruleStated}{' '}
                  {t.money(finding.found, currency)}
                </span>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
