import puppeteer from 'puppeteer-core';

async function extractSpotifyAnimations() {
  const browser = await puppeteer.connect({ browserURL: 'http://127.0.0.1:9222' });
  const pages = await browser.pages();
  const sp = pages.find(p => p.url().includes('open.spotify.com'));
  if (!sp) {
    console.log('No Spotify tab');
    browser.disconnect();
    return;
  }

  const animData = await sp.evaluate(() => {
    // Check computed styles on root and cards
    const root = document.documentElement;
    const rootStyles = window.getComputedStyle(root);
    
    // Find all CSS variables related to motion, animation, duration, easing
    const allStyles = Array.from(document.styleSheets);
    const motionRules = [];
    
    for (const sheet of allStyles) {
      try {
        for (const rule of sheet.cssRules || []) {
          if (rule.cssText && (rule.cssText.includes('transition') || rule.cssText.includes('animation') || rule.cssText.includes('cubic-bezier'))) {
            if (rule.cssText.includes('--encore') || rule.cssText.includes('transition:') || rule.cssText.includes('cubic-bezier')) {
              motionRules.push(rule.cssText.slice(0, 150));
            }
          }
        }
      } catch (e) {
        // Cross-origin stylesheet access blocked
      }
    }

    // Inspect quick access card transition
    const quickCard = document.querySelector('[data-testid="card-click-handler"], [class*="card"]');
    const quickCardStyle = quickCard ? window.getComputedStyle(quickCard) : null;

    // Inspect gradient container transition
    const gradientEl = document.querySelector('[data-testid="background"], div[style*="background"]');
    const gradientStyle = gradientEl ? window.getComputedStyle(gradientEl) : null;

    return {
      quickCardTransition: quickCardStyle?.transition,
      gradientTransition: gradientStyle?.transition,
      sampleRules: motionRules.slice(0, 15)
    };
  });

  console.log('Spotify Animation & Transition Data:', JSON.stringify(animData, null, 2));
  browser.disconnect();
}

extractSpotifyAnimations().catch(console.error);
