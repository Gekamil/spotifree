const fs = require('fs');
const f = 'src/components/mobile/MobileSettingsView.tsx';
let c = fs.readFileSync(f, 'utf8').replace(/\r\n/g, '\n');

// Remove the two orphaned closing braces after displayName definition
const orphan = '  const displayName = user?.display_name || \'Usuario\';\n\n  };\n  };\n\n  const handleClearCache';
const clean  = '  const displayName = user?.display_name || \'Usuario\';\n\n  const handleClearCache';

if (c.includes(orphan)) {
  c = c.replace(orphan, clean);
  console.log('Removed orphaned closing braces');
} else {
  // Try a looser match
  const idx = c.indexOf('  };\n  };\n\n  const handleClearCache');
  if (idx !== -1) {
    c = c.replace('  };\n  };\n\n  const handleClearCache', '  const handleClearCache');
    console.log('Removed via loose match');
  } else {
    console.log('Not found');
  }
}

fs.writeFileSync(f, c);
console.log('done');
