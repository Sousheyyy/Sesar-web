const { chromium } = require('playwright');

async function testScraper() {
  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
    viewport: { width: 1920, height: 1080 },
  });

  const page = await context.newPage();

  try {
    console.log('Navigating to TikTok music page...');
    await page.goto('https://www.tiktok.com/music/Taca-Nela-7545291575900702721', {
      waitUntil: 'domcontentloaded',
      timeout: 30000,
    });

    await page.waitForTimeout(5000);

    console.log('\n=== EXTRACTING PAGE DATA ===\n');

    // Get all h1 elements
    const h1s = await page.$$eval('h1', elements => 
      elements.map(el => ({
        text: el.textContent?.trim(),
        className: el.className,
        dataE2e: el.getAttribute('data-e2e'),
        html: el.outerHTML.substring(0, 200)
      }))
    );
    console.log('H1 elements:', JSON.stringify(h1s, null, 2));

    // Get all h2 elements
    const h2s = await page.$$eval('h2', elements => 
      elements.map(el => ({
        text: el.textContent?.trim(),
        className: el.className,
        dataE2e: el.getAttribute('data-e2e'),
        html: el.outerHTML.substring(0, 200)
      }))
    );
    console.log('\nH2 elements:', JSON.stringify(h2s, null, 2));

    // Try to find cover image
    const images = await page.$$eval('img', elements =>
      elements.slice(0, 10).map(el => ({
        src: el.src,
        alt: el.alt,
        className: el.className,
        dataE2e: el.getAttribute('data-e2e'),
      }))
    );
    console.log('\nFirst 10 images:', JSON.stringify(images, null, 2));

    // Try to extract from specific parent div
    const musicInfo = await page.evaluate(() => {
      // Try to find the main music container
      const container = document.querySelector('[class*="music-info"]') || 
                       document.querySelector('[class*="MusicInfo"]') ||
                       document.querySelector('[data-e2e*="music"]');
      
      if (container) {
        return {
          innerHTML: container.innerHTML.substring(0, 500),
          className: container.className
        };
      }
      return null;
    });
    console.log('\nMusic container:', JSON.stringify(musicInfo, null, 2));

    console.log('\n=== PAGE TITLE ===');
    console.log(await page.title());

    await page.pause();

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await context.close();
    await browser.close();
  }
}

testScraper();
