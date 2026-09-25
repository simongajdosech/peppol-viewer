import { describe, expect, it } from 'vitest';
import { readViewState, viewStateHash, type ViewState } from './viewState';

const FALLBACK: ViewState = { sample: 'base-example.xml', locale: 'en' };

describe('readViewState', () => {
  it('reads both halves of a shared link', () => {
    expect(readViewState('#sample=SK-full-example.xml&locale=sk', FALLBACK)).toEqual({
      sample: 'SK-full-example.xml',
      locale: 'sk',
    });
  });

  it('does not mind whether the hash still has its #', () => {
    expect(readViewState('sample=Norwegian-example-1.xml&locale=en', FALLBACK).sample).toBe(
      'Norwegian-example-1.xml',
    );
  });

  it('keeps the fallback for whichever half is missing', () => {
    expect(readViewState('#locale=sk', FALLBACK)).toEqual({
      sample: 'base-example.xml',
      locale: 'sk',
    });
    expect(readViewState('#sample=broken-example.xml', FALLBACK)).toEqual({
      sample: 'broken-example.xml',
      locale: 'en',
    });
    expect(readViewState('', FALLBACK)).toEqual(FALLBACK);
  });

  it('refuses a sample that does not exist', () => {
    // A hash is something anyone can type. Trusting it would leave the app fetching
    // a file that is not there, or somewhere else entirely.
    expect(readViewState('#sample=../../etc/passwd', FALLBACK).sample).toBe('base-example.xml');
    expect(readViewState('#sample=made-up.xml', FALLBACK).sample).toBe('base-example.xml');
  });

  it('refuses a language the app does not speak', () => {
    expect(readViewState('#locale=de', FALLBACK).locale).toBe('en');
    expect(readViewState('#locale=', FALLBACK).locale).toBe('en');
  });

  it('survives a hash that is not key=value at all', () => {
    expect(readViewState('#just-some-anchor', FALLBACK)).toEqual(FALLBACK);
  });
});

describe('viewStateHash', () => {
  it('writes a link that reproduces the view', () => {
    const state: ViewState = { sample: 'SK-full-example.xml', locale: 'sk' };

    expect(viewStateHash(state)).toBe('#sample=SK-full-example.xml&locale=sk');
    expect(readViewState(viewStateHash(state), FALLBACK)).toEqual(state);
  });

  it(`carries only the locale for a file off the reader's own disk`, () => {
    // '' is what App holds while someone has their own document open; naming it in a
    // link would promise whoever opened it a file they do not have.
    expect(viewStateHash({ sample: '', locale: 'sk' })).toBe('#locale=sk');
  });

  it('round-trips every sample', () => {
    for (const locale of ['en', 'sk'] as const) {
      const state: ViewState = { sample: 'vat-category-E.xml', locale };
      expect(readViewState(viewStateHash(state), FALLBACK)).toEqual(state);
    }
  });
});
