import { useId, useState } from 'react';
import { ANCHOR_BY_RULE, type AnchorId, type AnchorMap } from './anchors';
import type { Translation } from './i18n';
import { errorsIn, type Finding } from './validate';

/**
 * The pass/fail badge in the preview toolbar, and the panel it opens. The rules
 * themselves live in `validate.ts`; this only decides how to say what they found.
 */
export function ValidationBadge({
  findings,
  currency,
  anchors,
  highlight,
  onHighlight,
  t,
}: {
  findings: Finding[];
  currency: string;
  /** The blocks the rendered document turned out to have, keyed by anchor. */
  anchors: AnchorMap;
  highlight: AnchorId | null;
  onHighlight: (anchor: AnchorId | null) => void;
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
      <span className={`pv-root pv-badge pv-${state}`} title={t.checks}>
        {label}
      </span>
    );
  }

  return (
    <div className="pv-root pv-validation">
      <button
        type="button"
        className={`pv-badge pv-${state}`}
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-controls={panelId}
      >
        {label}
      </button>

      {open && (
        <ul className="pv-findings" id={panelId}>
          {findings.map((finding, index) => {
            /*
              Which block of the page the rule is about — but only one the document
              actually produced. A rule that fired because a whole block is missing has
              nothing to light up, and that row stays a plain row rather than a button
              that would do nothing.
            */
            const target = ANCHOR_BY_RULE[finding.key];
            const anchor = target && anchors[target] ? target : null;

            const detail = (
              <>
                <span className="pv-rule-id">{finding.rule}</span>
                <span className="pv-rule-text">
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
                  <span className="pv-rule-numbers">
                    {t.ruleExpected} {t.money(finding.expected, currency)} · {t.ruleStated}{' '}
                    {t.money(finding.found, currency)}
                  </span>
                )}
              </>
            );

            return (
              <li key={`${finding.rule}-${index}`} className={`pv-${finding.severity}`}>
                {anchor ? (
                  <button
                    type="button"
                    className="pv-finding"
                    onClick={() => {
                      // Pressing the lit row again puts the page back the way it was.
                      onHighlight(highlight === anchor ? null : anchor);
                      // The panel hangs over the document it is pointing into, so it has
                      // to get out of the way of the block the reader just asked to see.
                      // The badge reopens it, with the row they picked still lit.
                      setOpen(false);
                    }}
                    aria-pressed={highlight === anchor}
                    title={t.showOnPage}
                  >
                    {detail}
                  </button>
                ) : (
                  <div className="pv-finding">{detail}</div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
