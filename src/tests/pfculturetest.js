// Prep for AI Writer: add the reviewed synonyms to the model's culture (linguisticMetadata) through TMDL view
const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 1250, height: 900 } }); const errs = [];
  p.on('pageerror', e => errs.push(e.message));
  await p.goto('http://localhost:8765/prep-for-ai-writer.html'); await p.evaluate(() => localStorage.clear()); await p.reload(); await p.waitForTimeout(300);
  console.log('example:', await p.textContent('#cultMsg'));
  const meta = async () => p.evaluate(() => { const s = state.out.cult; const l = s.split('\n').find(x => /linguisticMetadata =/.test(x)); return { head: s.split('\n').slice(0, 3).join(' | '), json: JSON.parse(l.replace(/^\s*linguisticMetadata = /, '')) }; });
  let m = await meta();
  console.log('script starts', m.head);
  const terms = k => (m.json.Entities[k] || { Terms: [] }).Terms.map(t => Object.keys(t)[0] + (Object.values(t)[0].State ? ':' + Object.values(t)[0].State : '')).join(', ');
  console.log('region', terms('customer.region'), '(expect territory without State, area added)');
  console.log('total sales', terms('entity__measure.total_sales'), '(expect revenue, turnover, sales amount added)');
  console.log('new entries', Object.keys(m.json.Entities).filter(k => !['customer.region', 'entity__measure.total_sales', 'product.category'].includes(k)).join(', '));
  // synonyms the model already has are left out, and the prompt lists the ones someone added
  console.log('category row:', await p.textContent('#synBody tr:has-text("Category")'), '(expect department left out)');
  console.log('prompt lists existing', (await p.textContent('#insPromptView')).includes("'Product'[Category] = department"), '(expect true)');
  // untick a synonym row: its terms leave the script
  await p.uncheck('#synBody tr:first-child [data-act=on]'); await p.waitForTimeout(150); m = await meta();
  console.log('after unticking Total Sales', terms('entity__measure.total_sales'), '(expect only total sales, sales)');
  // a reply with nothing new: the field shows In model, unticked, and the culture step says nothing to apply
  await p.fill('#insReply', '```\n@@@ INSTRUCTIONS @@@\nBusiness context\n- Sales.\n@@@ END @@@\n@@@ SYNONYMS @@@\n\'Product\'[Category] = department\n@@@ END @@@\n```'); await p.waitForTimeout(200);
  console.log('nothing new:', await p.textContent('#synBody'), '| ticked', await p.isChecked('#synBody [data-act=on]'), '| count', await p.textContent('#synCount'));
  console.log('culture step:', await p.textContent('#cultMsg'));
  // a PBIP culture file (no createOrReplace) gets wrapped; a table script is refused
  await p.fill('#cultIn', 'cultureInfo en-US\n\n\tlinguisticMetadata = {"Version":"4.1.0","Language":"en-US","Entities":{}}\n\t\tcontentType: json\n'); await p.waitForTimeout(150); m = await meta();
  console.log('pbip file ->', m.head, '| entities', Object.keys(m.json.Entities).length);
  await p.fill('#cultIn', 'createOrReplace\n\n\ttable Sales\n\t\tcolumn Region'); await p.waitForTimeout(150);
  console.log('table script ->', await p.textContent('#cultMsg'));
  await p.fill('#cultIn', 'createOrReplace\n\n\tcultureInfo en-US\n\n\t\tlinguisticMetadata = {"Version":"4.1.0","Entities":{'); await p.waitForTimeout(150);
  console.log('cut short ->', await p.textContent('#cultMsg'));
  await p.reload(); await p.waitForTimeout(300);
  console.log('kept after reload', (await p.inputValue('#cultIn')).slice(0, 40));
  console.log('errors', errs); await b.close();
})();
