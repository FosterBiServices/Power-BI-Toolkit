const { chromium } = require('playwright'); const fs = require('fs');
(async () => {
  const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 1250, height: 900 } }); const errs = [];
  p.on('pageerror', e => errs.push(e.message));
  await p.goto('http://localhost:8765/field-parameter-builder.html'); await p.evaluate(() => localStorage.clear()); await p.reload();
  console.log('banner', await p.locator('#exampleBanner').isVisible(), '| sel', await p.locator('#sel li').count(), '| checks:', await p.locator('#checks').innerText());
  await p.screenshot({ path: 'fp_1.png', fullPage: true });
  // switch type
  await p.click('#typeSwitch'); console.log('switch checks:', await p.locator('#checks').innerText().then(t => t.slice(0, 100)), '| tmdl has formatStringDefinition:', (await p.locator('#tmdlView').innerText()).includes('formatStringDefinition'));
  // reorder & remove
  await p.locator('#sel li').nth(1).locator('[data-act=up]').click();
  console.log('first now:', await p.locator('#sel li').nth(0).locator('.sref').innerText());
  await p.locator('#sel li').nth(0).locator('[data-act=rm]').click(); console.log('after rm', await p.locator('#sel li').count());
  // columns in switch not offered; switch back to field and add column
  await p.click('#typeField'); await p.selectOption('#kindFilter', 'column'); await p.fill('#search', 'Region'); await p.locator('#avail .mrow2').first().click();
  console.log('field + column checks:', await p.locator('#checks').innerText());
  await p.click('#typeSwitch'); console.log('switch w/ column:', await p.locator('#checks').innerText(), '| out hidden', await p.locator('#outBox').isHidden());
  await p.click('#typeField');
  // duplicate table name
  await p.fill('#tName', 'Sales'); console.log('table clash:', (await p.locator('#checks').innerText()).slice(0, 90)); await p.fill('#tName', 'Metric Picker');
  // label edit updates tmdl
  await p.locator('#sel li').nth(0).locator('[data-f=label]').fill('Revenue "net"');
  console.log('tmdl label:', (await p.locator('#tmdlView').innerText()).includes('"Revenue ""net"""'));
  // saved export from home replaces example
  await p.goto('http://localhost:8765/index.html'); await p.fill('#exportInput', fs.readFileSync('ex_export.tsv', 'utf8')); await p.waitForTimeout(200);
  await p.goto('http://localhost:8765/field-parameter-builder.html');
  console.log('after home export: bar', (await p.locator('.suite-bar').innerText()).slice(0, 60), '| sel', await p.locator('#sel li').count(), '| stats', (await p.locator('#modelStats').innerText()).replace(/\n/g, ' '));
  // clear & mobile
  await p.click('#clearEntries'); await p.click('#clearYes'); console.log('cleared: model empty', (await p.locator('#modelInput').inputValue()) === '');
  await p.evaluate(() => localStorage.clear()); await p.setViewportSize({ width: 375, height: 800 }); await p.reload();
  console.log('mobile hscroll', await p.evaluate(() => document.documentElement.scrollWidth > innerWidth)); await p.screenshot({ path: 'fp_m.png', fullPage: true });
  console.log('errors', errs); await b.close();
})();
