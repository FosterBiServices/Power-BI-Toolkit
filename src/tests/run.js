// Serves the repo root on http://localhost:8765 and runs the browser checks.
//   cd src/tests && npm install && npx playwright install chromium   (once)
//   node run.js            all checks
//   node run.js srtest     only the ones whose name contains "srtest"
// Each check prints what it saw and ends with "errors [...]"; an empty list means no page errors.
// Screenshots and downloads land in this folder and are git-ignored.
const http = require('http'), fs = require('fs'), path = require('path'), { spawn } = require('child_process');
const ROOT = path.resolve(__dirname, '..', '..');
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.json': 'application/json', '.css': 'text/css', '.svg': 'image/svg+xml', '.png': 'image/png', '.md': 'text/plain; charset=utf-8' };
const server = http.createServer((req, res) => {
  let f = path.join(ROOT, decodeURIComponent(req.url.split('?')[0]));
  if (!f.startsWith(ROOT)) { res.writeHead(403); return res.end(); }
  if (fs.existsSync(f) && fs.statSync(f).isDirectory()) f = path.join(f, 'index.html');
  fs.readFile(f, (err, data) => {
    if (err) { res.writeHead(404); return res.end('not found'); }
    res.writeHead(200, { 'Content-Type': TYPES[path.extname(f)] || 'application/octet-stream' }); res.end(data);
  });
});
// each check runs in its own process; spawn (not spawnSync) keeps this server answering meanwhile
const run = t => new Promise(done => {
  const c = spawn(process.execPath, [t], { cwd: __dirname, stdio: 'inherit' });
  const timer = setTimeout(() => c.kill(), 180000);
  c.on('exit', code => { clearTimeout(timer); done(code); });
});
server.listen(8765, async () => {
  const only = process.argv[2] || '';
  const tests = fs.readdirSync(__dirname).filter(f => /^(?!run\.js$).+\.js$/.test(f) && f.includes(only)).sort();
  let bad = 0;
  for (const t of tests) {
    console.log('\n=== ' + t);
    const code = await run(t);
    if (code !== 0) { bad++; console.log('!!! ' + t + ' exited with ' + code); }
  }
  console.log('\n' + (tests.length - bad) + ' of ' + tests.length + ' checks ran without crashing.');
  server.close(); process.exit(bad ? 1 : 0);
});
