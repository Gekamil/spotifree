const fs = require('fs');
const f = 'src/components/mobile/MobileSettingsView.tsx';
let c = fs.readFileSync(f, 'utf8').replace(/\r\n/g, '\n');

// 1. Replace the import block from userAccounts (only keep what we need - none now)
c = c.replace(
  `import {\n  getSavedAccounts,\n  removeSavedAccount,\n  saveAccount,\n  cleanSpDc,\n  switchActiveAccount,\n  type SavedAccount,\n} from '../../utils/userAccounts';\nimport { validateSpotifyCookie } from '../../services/spotifyCookieService';`,
  ``
);
console.log('Removed unused imports');

// 2. Remove handleSwitchAccount function
// Find it and remove up through the closing };
const swA = '\n\n  const handleSwitchAccount';
const swB = '\n  };\n\n  const handleDeleteAccount';
const si = c.indexOf(swA);
const se = c.indexOf(swB);
if (si !== -1 && se !== -1) {
  c = c.slice(0, si) + c.slice(se);
  console.log('Removed handleSwitchAccount');
} else {
  console.log('handleSwitchAccount bounds:', si, se);
}

// 3. Remove handleDeleteAccount function
const dA = '\n\n  const handleDeleteAccount';
const dB = '\n  };\n\n  const handleClearCache';
const di = c.indexOf(dA);
const de = c.indexOf(dB);
if (di !== -1 && de !== -1) {
  c = c.slice(0, di) + c.slice(de);
  console.log('Removed handleDeleteAccount');
} else {
  console.log('handleDeleteAccount bounds:', di, de);
}

fs.writeFileSync(f, c);
console.log('done');
