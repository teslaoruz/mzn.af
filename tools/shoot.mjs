// Real-time page captures for checking the site: node tools/shoot.mjs <url> <out-dir> <w>x<h> [step...]
// A step is "wait:<ms>", "scroll:<css selector>", "y:<px>", "shot:<name>", "eval:<js>" or
// "drag:<x1>,<y>,<x2>" (a real mouse drag in viewport pixels).
// Uses headless Chrome over the DevTools protocol, so CSS transitions and timers run in real time
// (a plain `--screenshot` uses virtual time and catches animations half way).
import { spawn } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
const [url, out, size, ...steps] = process.argv.slice(2);
const [w, h] = size.split('x').map(Number);
mkdirSync(out, { recursive: true });
const port = 9300 + Math.floor(Math.random() * 500);
const chrome = spawn('google-chrome-stable', ['--headless=new', '--no-sandbox', '--hide-scrollbars', `--remote-debugging-port=${port}`, `--window-size=${w},${h}`, '--user-data-dir=' + out + '/.prof', 'about:blank'], { stdio: 'ignore' });
const sleep = ms => new Promise(r => setTimeout(r, ms));
let ws;
for (let i = 0; i < 50 && !ws; i++) { await sleep(200); try { const t = await (await fetch(`http://127.0.0.1:${port}/json`)).json(); const p = t.find(x => x.type === 'page'); if (p) ws = new WebSocket(p.webSocketDebuggerUrl); } catch {} }
await new Promise(r => ws.addEventListener('open', r));
let id = 0; const pend = new Map();
ws.addEventListener('message', m => { const d = JSON.parse(m.data); if (d.id && pend.has(d.id)) { pend.get(d.id)(d); pend.delete(d.id); } });
const send = (method, params = {}) => new Promise(r => { const i = ++id; pend.set(i, r); ws.send(JSON.stringify({ id: i, method, params })); });
await send('Emulation.setDeviceMetricsOverride', { width: w, height: h, deviceScaleFactor: 1, mobile: w < 600 });
await send('Page.enable'); await send('Runtime.enable');
await send('Page.navigate', { url }); await sleep(1500);
for (const s of steps) {
  const [k, ...rest] = s.split(':'); const v = rest.join(':');
  if (k === 'wait') await sleep(+v);
  if (k === 'y') await send('Runtime.evaluate', { expression: `scrollTo({top:${v},behavior:'instant'})` });
  if (k === 'scroll') await send('Runtime.evaluate', { expression: `document.querySelector(${JSON.stringify(v)}).scrollIntoView({block:'start',behavior:'instant'})` });
  if (k === 'eval') { const r = await send('Runtime.evaluate', { expression: v, returnByValue: true }); console.log(JSON.stringify(r.result?.result?.value ?? r.result)); }
  if (k === 'drag') {
    const [x1, y, x2] = v.split(',').map(Number), m = (type, x) => send('Input.dispatchMouseEvent', { type, x, y, button: 'left', buttons: type === 'mouseReleased' ? 0 : 1, clickCount: 1 });
    await m('mousePressed', x1); for (let i = 1; i <= 10; i++) await m('mouseMoved', x1 + (x2 - x1) * i / 10); await m('mouseReleased', x2);
  }
  if (k === 'shot') { const r = await send('Page.captureScreenshot', { format: 'png' }); writeFileSync(`${out}/${v}.png`, Buffer.from(r.result.data, 'base64')); }
}
ws.close(); chrome.kill();
