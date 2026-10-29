const fs = require('fs');
const f = 'src/components/mobile/MobileSettingsView.tsx';
let c = fs.readFileSync(f, 'utf8').replace(/\r\n/g, '\n');

// Remove the orphaned ")}" that was left after the session section removal
// It's the closing of the savedAccounts conditional that was cut mid-way
const orphan = '        </div>\n        )}\n\n        {/* Motor de Audio (Paridad PC) */}';
const fixed  = '        </div>\n\n        {/* Motor de Audio (Paridad PC) */}';
if (c.includes(orphan)) {
  c = c.replace(orphan, fixed);
  console.log('Fixed orphaned )}');
} else {
  console.log('Pattern not found');
  // Try to find vicinity
  const idx = c.indexOf('        )}\n\n        {/* Motor de Audio');
  console.log('Alt search idx:', idx, c.slice(idx - 50, idx + 100));
}

fs.writeFileSync(f, c);
console.log('done');
