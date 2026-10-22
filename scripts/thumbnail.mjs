// Export public/thumbnail.jpg from the source art in art/thumbnail-source.png.
// RUN requires exactly 512x512; we keep it under ~150 KB. Usage: npm run thumbnail
import { execFileSync } from 'node:child_process';
import { statSync } from 'node:fs';

const SRC = 'art/thumbnail-source.png';
const OUT = 'public/thumbnail.jpg';
const LIMIT_KB = 150;

// Resize with PIL (Lanczos), then step JPEG quality down until it fits the size budget.
execFileSync(
  'python3',
  [
    '-I',
    '-c',
    `
import sys, io
from PIL import Image
src, out, limit = sys.argv[1], sys.argv[2], int(sys.argv[3]) * 1024
im = Image.open(src).convert('RGB')
w, h = im.size
side = min(w, h)
im = im.crop(((w - side) // 2, (h - side) // 2, (w + side) // 2, (h + side) // 2))
im = im.resize((512, 512), Image.LANCZOS)
for q in range(88, 60, -2):
    buf = io.BytesIO()
    im.save(buf, 'JPEG', quality=q, optimize=True, progressive=True, subsampling=2)
    if buf.tell() <= limit:
        break
open(out, 'wb').write(buf.getvalue())
print(f'quality {q}')
`,
    SRC,
    OUT,
    String(LIMIT_KB),
  ],
  { stdio: 'inherit' },
);

const kb = statSync(OUT).size / 1024;
console.log(`${OUT} written (${kb.toFixed(1)} KB)`);
if (kb > LIMIT_KB) {
  console.error(`thumbnail is over ${LIMIT_KB} KB`);
  process.exit(1);
}
