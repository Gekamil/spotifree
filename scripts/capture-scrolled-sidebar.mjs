import puppeteer from 'puppeteer-core';
import path from 'path';

const ARTIFACT_DIR = 'C:\\Users\\jorge\\.gemini\\antigravity\\brain\\b7d3ec29-c076-4935-90b5-23f42c286313';

async function captureScrolledSidebar() {
  const browser = await puppeteer.connect({ browserURL: 'http://127.0.0.1:9222' });
  const page = (await browser.pages())[0];

  // Scroll the right sidebar down 350px to reveal lyrics & videos & artist info
  await page.evaluate(() => {
    const scrollContainer = document.querySelector('aside#Desktop_PanelContainer_Id div.overflow-y-auto');
    if (scrollContainer) {
      scrollContainer.scrollTop = 320;
    }
  });

  await new Promise(r => setTimeout(r, 600));

  const screenshotPath = path.join(ARTIFACT_DIR, 'final-right-sidebar-scrolled.png');
  await page.screenshot({ path: screenshotPath });
  console.log('Saved scrolled sidebar screenshot to:', screenshotPath);
}

captureScrolledSidebar().catch(console.error);
