// Sample Data Maker surveys: each survey's tables, keys that match, scores in range, NPS on Responses matching the
// NPS answer, comments with sentiment, partial responses, and the TMDL (functions, relationships, measures).
const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch(); const p = await b.newPage(); const errs = [];
  p.on('pageerror', e => errs.push(e.message));
  await p.goto('http://localhost:8765/sample-data-maker.html'); await p.evaluate(() => localStorage.clear()); await p.reload(); await p.waitForTimeout(600);
  for (const id of ['svyhealth', 'svyretail', 'svyservice']) {
    const r = await p.evaluate(id => {
      const m = SD_IND.combine([id]), args = { start_date: SD.serial(2024, 1, 1), end_date: SD.serial(2025, 12, 31), seed: 1 };
      m.sizes.forEach(s => { args[s[0]] = s[0] === 'num_responses' ? 1500 : s[2]; });
      const env = { p: args, seed: 1 }, T = {}; m.tables.forEach(t => { T[t.name] = SD.tableRows(t, env); });
      const q = {}; T.Questions.forEach(x => { q[x.QuestionKey] = x; });
      const resp = {}; T.Responses.forEach(x => { resp[x.ResponseKey] = x; });
      const npsQ = T.Questions.find(x => x['Question Type'] === 'NPS').QuestionKey;
      let bad = 0, npsMis = 0, overAns = 0; const avg = {}, cnt = {}, sent = {};
      T.Answers.forEach(a => {
        const t = q[a.QuestionKey]['Question Type'], s = a.Score, rr = resp[a.ResponseKey];
        if (!rr) bad++;
        if (a.QuestionKey > rr['Questions Answered']) overAns++;
        if (t === 'NPS' && s !== rr['NPS Score']) npsMis++;
        const ok = t === 'Comment' ? s === null && !!a.Answer && !!a.Sentiment : t === 'NPS' ? s >= 0 && s <= 10 : t === 'Yes/No' ? (s === 1 || s === 0) : s >= 1 && s <= 5 && !!a.Answer;
        if (!ok) bad++;
        if (t === 'Comment') sent[a.Sentiment] = (sent[a.Sentiment] || 0) + 1;
        else if (t !== 'NPS' && t !== 'Yes/No') { avg[q[a.QuestionKey]['Short Name']] = (avg[q[a.QuestionKey]['Short Name']] || 0) + s; cnt[q[a.QuestionKey]['Short Name']] = (cnt[q[a.QuestionKey]['Short Name']] || 0) + 1; }
      });
      const nps = T.Responses.filter(x => x['NPS Score'] !== null), pro = nps.filter(x => x['NPS Group'] === 'Promoter').length, det = nps.filter(x => x['NPS Group'] === 'Detractor').length;
      const tm = SD.script(m, { mode: 'udf', args, measures: true, measureTable: 'new' }), inl = SD.script(m, { mode: 'inline', args, measures: true, measureTable: 'new' });
      return { tables: m.tables.map(t => t.name + ' ' + T[t.name].length).join(', '), bad, npsMis, overAns,
        respondentsOk: T.Responses.every(x => x.RespondentKey >= 1 && x.RespondentKey <= args.num_respondents),
        complete: Math.round(100 * T.Responses.filter(x => x.Completed).length / T.Responses.length),
        nps: Math.round(100 * (pro - det) / nps.length), avg: Object.keys(avg).map(k => k + ' ' + (avg[k] / cnt[k]).toFixed(2)).join(', '),
        sent: JSON.stringify(sent), sample: T.Answers.find(a => q[a.QuestionKey]['Question Type'] === 'Comment').Answer,
        fns: (tm.match(/^\tfunction /gm) || []).length, rels: (tm.match(/^\trelationship /gm) || []).length, measures: (tm.match(/^\t\tmeasure /gm) || []).length,
        inlineFns: (inl.match(/^\tfunction /gm) || []).length };
    }, id);
    console.log(id, '|', r.tables);
    console.log('  bad answers', r.bad, '(expect 0) | NPS answer differs from Responses', r.npsMis, '(expect 0) | answers past where they stopped', r.overAns, '(expect 0) | respondent keys ok', r.respondentsOk);
    console.log('  completed', r.complete + '% (expect about 88) | NPS', r.nps, '| comment sentiment', r.sent);
    console.log('  averages', r.avg); console.log('  a comment:', r.sample);
    console.log('  TMDL functions', r.fns, '| relationships', r.rels, '(expect 4) | measures', r.measures, '| plain tables functions', r.inlineFns, '(expect 0)');
  }
  // all three in one model: one Date, the later surveys' tables renamed
  const all = await p.evaluate(() => { const m = SD_IND.combine(['svyhealth', 'svyretail', 'svyservice']); return { t: m.tables.map(t => t.name).join(', '), s: m.sizes.map(s => s[0]).join(', '), mx: (m.measures['Retail Survey Answers'] || []).find(x => x.n === 'Retail Survey Average Score').x }; });
  console.log('all three:', all.t); console.log('  sizes', all.s); console.log('  renamed measure', all.mx);
  // the page: pick the healthcare survey card
  await p.click('label.mode:has(input[value=make])'); await p.waitForTimeout(200);
  await p.click('[data-ind="svyhealth"]'); await p.click('[data-ind="retail"]'); await p.waitForTimeout(200);
  console.log('page: picked', await p.evaluate(() => indsOf(state.make).join('+')), '| tabs', await p.$$eval('#makeTabs [data-tab]', x => x.map(b => b.dataset.tab).join(',')), '| preview rows', await p.$$eval('#makePreview tbody tr', x => x.length));
  console.log('errors', errs); await b.close();
})();
