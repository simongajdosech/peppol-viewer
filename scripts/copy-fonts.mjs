/**
 * Stages the typefaces for publication.
 *
 * The demo serves them out of `public/fonts`, which is where Vite expects static files to
 * live, but a consumer copying them into their own app wants them at a path they can
 * point `cp` at — `node_modules/peppol-viewer/fonts/`. So the published tarball gets its
 * own copy, made here and listed in `files`. `fonts/` is generated, and git-ignored.
 */
import { copyFileSync, mkdirSync, readdirSync } from 'node:fs';

const FROM = 'public/fonts';
const TO = 'fonts';

mkdirSync(TO, { recursive: true });

const copied = readdirSync(FROM).filter((name) => /\.(ttf|txt)$/.test(name));
for (const name of copied) {
  copyFileSync(`${FROM}/${name}`, `${TO}/${name}`);
}

console.log(`fonts: staged ${copied.length} files into ${TO}/`);
