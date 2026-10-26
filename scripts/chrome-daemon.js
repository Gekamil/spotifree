import { spawn } from 'child_process';

const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';

const args = [
  '--remote-debugging-port=9222',
  '--remote-allow-origins=*',
  '--user-data-dir=C:\\Users\\jorge\\AppData\\Local\\Temp\\chrome_debug_profile_visible',
  '--disable-gpu',
  '--no-first-run',
  '--no-default-browser-check',
  '--start-maximized',
  'https://open.spotify.com/'
];

console.log('Launching visible Chrome with remote debugging on port 9222...');
const chrome = spawn(chromePath, args, { stdio: 'inherit' });

chrome.on('exit', (code) => {
  console.log('Chrome exited with code:', code);
  process.exit(code || 0);
});

process.on('SIGINT', () => {
  chrome.kill();
  process.exit(0);
});
process.on('SIGTERM', () => {
  chrome.kill();
  process.exit(0);
});
