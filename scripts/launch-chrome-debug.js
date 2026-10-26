import { spawn } from 'child_process';

const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const chrome = spawn(chromePath, [
  '--headless=new',
  '--remote-debugging-port=9222',
  '--user-data-dir=C:\\Users\\jorge\\AppData\\Local\\Temp\\chrome_debug_profile_test',
  '--disable-gpu',
  '--no-sandbox',
  'about:blank'
], { stdio: 'pipe' });

chrome.stdout.on('data', (d) => console.log('STDOUT:', d.toString()));
chrome.stderr.on('data', (d) => console.log('STDERR:', d.toString()));

setTimeout(async () => {
  try {
    const res = await fetch('http://127.0.0.1:9222/json/version');
    const json = await res.json();
    console.log('SUCCESS:', json);
  } catch (err) {
    console.error('FETCH ERROR:', err.message);
  }
  chrome.kill();
}, 3000);
