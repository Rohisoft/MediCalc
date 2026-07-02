// Generates 192x192 and 512x512 app icons — green bg + white medical cross
const PNG  = require('pngjs').PNG;
const fs   = require('fs');
const path = require('path');

function makeIcon(size) {
  const png = new PNG({ width: size, height: size });
  const cx = size / 2;
  const cy = size / 2;
  const arm = size * 0.28;   // half-length of cross arm
  const thick = size * 0.14; // half-thickness of cross arm
  const radius = size * 0.18; // corner rounding radius

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const idx = (size * y + x) * 4;

      // Rounded square background mask
      const dx = Math.abs(x - cx) - (size / 2 - radius);
      const dy = Math.abs(y - cy) - (size / 2 - radius);
      const inBg = (dx <= 0 || dy <= 0)
        ? true
        : Math.sqrt(dx * dx + dy * dy) <= radius;

      // White medical cross
      const inCross =
        (Math.abs(x - cx) <= thick && Math.abs(y - cy) <= arm) ||
        (Math.abs(y - cy) <= thick && Math.abs(x - cx) <= arm);

      if (!inBg) {
        // Transparent outside rounded square
        png.data[idx]   = 0;
        png.data[idx+1] = 0;
        png.data[idx+2] = 0;
        png.data[idx+3] = 0;
      } else if (inCross) {
        // White cross
        png.data[idx]   = 255;
        png.data[idx+1] = 255;
        png.data[idx+2] = 255;
        png.data[idx+3] = 255;
      } else {
        // Green background #1a6b3a
        png.data[idx]   = 26;
        png.data[idx+1] = 107;
        png.data[idx+2] = 58;
        png.data[idx+3] = 255;
      }
    }
  }
  return PNG.sync.write(png);
}

const outDir = path.join(__dirname, '..', 'public');
fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(path.join(outDir, 'icon-192.png'), makeIcon(192));
fs.writeFileSync(path.join(outDir, 'icon-512.png'), makeIcon(512));
console.log('Icons generated: icon-192.png, icon-512.png');
