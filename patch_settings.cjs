const fs = require('fs');
const f = 'src/components/mobile/MobileSettingsView.tsx';
let c = fs.readFileSync(f, 'utf8').replace(/\r\n/g, '\n');

// ---- 1. Remove the "Sesión y Conexión de Spotify" section (sp_dc input + QR button) ----
// This section starts with the comment and a div, ending after the closing div.
const sessionStart = '\n\n        {/* Sesión y Conexión de Spotify */}';
const sessionEnd = '        )}\n\n        {/* Motor de Audio (Paridad PC) */}';
const si = c.indexOf(sessionStart);
const se = c.indexOf(sessionEnd);
if (si !== -1 && se !== -1) {
  // Remove from sessionStart up to (but not including) sessionEnd
  c = c.slice(0, si) + '\n' + c.slice(se);
  console.log('Removed "Sesión y Conexión" section');
} else {
  console.log('WARNING: session section not found. si=', si, 'se=', se);
}

// ---- 2. Improve "Tu Cuenta Spotifree" section ----
const oldSpotifreeBlock = `        {/* Tu Cuenta Spotifree en la Nube (Sincronización Móvil y PC) */}
        <div className="space-y-3">
          <h3 className="text-xs font-bold text-[#b3b3b3] uppercase tracking-wider">
            Tu Cuenta Spotifree
          </h3>
          <SpotifreeAuthCard />
        </div>`;

const newSpotifreeBlock = `        {/* Tu Cuenta Spotifree */}
        <div className="space-y-2">
          <div className="flex items-center justify-between px-1 mb-1">
            <span className="text-xs font-bold text-[#b3b3b3] uppercase tracking-wider">Cuenta Spotifree</span>
            <span className="text-[10px] text-[#1ed760] font-bold uppercase tracking-wider">SINCRONIZACIÓN ACTIVADA</span>
          </div>
          <div className="rounded-2xl overflow-hidden border border-white/[0.06] bg-[#181818]">
            <div className="px-4 pt-4 pb-2">
              <p className="text-xs text-[#b3b3b3] leading-relaxed">
                Guarda tus playlists, canciones favoritas, historial y ajustes. Accede desde cualquier dispositivo con tu correo y contraseña.
              </p>
            </div>
            <div className="px-4 pb-4">
              <SpotifreeAuthCard />
            </div>
          </div>
        </div>`;

if (c.includes(oldSpotifreeBlock)) {
  c = c.replace(oldSpotifreeBlock, newSpotifreeBlock);
  console.log('Improved Spotifree block');
} else {
  console.log('WARNING: Spotifree block not found, searching for partial...');
  // Try partial match
  const partial = '        {/* Tu Cuenta Spotifree en la Nube';
  const pIdx = c.indexOf(partial);
  console.log('Partial idx:', pIdx);
}

fs.writeFileSync(f, c);
console.log('done');
