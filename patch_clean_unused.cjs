const fs = require('fs');
const f = 'src/components/mobile/MobileSettingsView.tsx';
let c = fs.readFileSync(f, 'utf8').replace(/\r\n/g, '\n');

// Remove unused state variables declared at top of component
const removals = [
  // savedAccounts state
  `\n  const [savedAccounts, setSavedAccounts] = useState<SavedAccount[]>(() => getSavedAccounts());`,
  // cookieInput state
  `\n  const [cookieInput, setCookieInput] = useState('');`,
  // cookieStatus state  
  `\n  const [cookieStatus, setCookieStatus] = useState<string | null>(null);`,
  // isVerifyingCookie state
  `\n  const [isVerifyingCookie, setIsVerifyingCookie] = useState(false);`,
];

for (const r of removals) {
  if (c.includes(r)) {
    c = c.replace(r, '');
    console.log('Removed:', r.trim().slice(0, 60));
  } else {
    console.log('NOT FOUND:', r.trim().slice(0, 60));
  }
}

// Remove handleApplyCookie function (from "const handleApplyCookie" to its closing "};")
const hStart = '\n  const handleApplyCookie = async () => {';
const hEnd = '\n  };\n\n  const handleSwitchAccount';
const si = c.indexOf(hStart);
const se = c.indexOf(hEnd);
if (si !== -1 && se !== -1) {
  c = c.slice(0, si) + '\n\n  const handleSwitchAccount' + c.slice(se + hEnd.length);
  console.log('Removed handleApplyCookie');
} else {
  console.log('handleApplyCookie not found. si:', si, 'se:', se);
}

// Remove handleSwitchAccount function
const swStart = '\n\n  const handleSwitchAccount = (acc: SavedAccount) => {';
const swEnd = '\n  };\n\n  const handleDeleteAccount';
const swi = c.indexOf(swStart);
const swe = c.indexOf(swEnd);
if (swi !== -1 && swe !== -1) {
  c = c.slice(0, swi) + '\n\n  const handleDeleteAccount' + c.slice(swe + swEnd.length);
  console.log('Removed handleSwitchAccount');
} else {
  console.log('handleSwitchAccount not found. swi:', swi, 'swe:', swe);
}

// Remove handleDeleteAccount function
const dStart = '\n\n  const handleDeleteAccount = (id: string, e: React.MouseEvent) => {';
const dEnd = '\n  };\n\n  // Audio & Playback';
const di = c.indexOf(dStart);
const de = c.indexOf(dEnd);
if (di !== -1 && de !== -1) {
  c = c.slice(0, di) + '\n\n  // Audio & Playback' + c.slice(de + dEnd.length);
  console.log('Removed handleDeleteAccount');
} else {
  console.log('handleDeleteAccount not found. di:', di, 'de:', de);
}

fs.writeFileSync(f, c);
console.log('done');
