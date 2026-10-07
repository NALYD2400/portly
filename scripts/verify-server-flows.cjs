const { chromium } = require('playwright');
const fs = require('node:fs');
const path = require('node:path');
const { entry, projects } = require('./fixtures/ui.cjs');

(async () => {
  const { createServer } = await import('vite');
  const server = await createServer({ logLevel: 'silent', server: { host: '127.0.0.1', port: 0, strictPort: true } });
  await server.listen();
  const base = 'http://127.0.0.1:' + server.httpServer.address().port;
  const art = path.resolve('test-results');
  fs.mkdirSync(art, { recursive: true });
  let browser;
  try {
    browser = await chromium.launch({ channel: process.env.SPRINT_BROWSER_CHANNEL || (process.platform === 'win32' ? 'msedge' : undefined), headless: true });
    const page = await browser.newPage({ viewport: { width: 1320, height: 860 } });
    const errors = [], results = [];
    page.on('pageerror', (error) => errors.push(error.message));
    const check = (condition, label) => { if (!condition) throw new Error(label); results.push(label); };
    await page.route(base + '/**', async (route) => {
      const url = new URL(route.request().url());
      if (url.pathname === '/__flows.js') return route.fulfill({ contentType: 'text/javascript', body: entry });
      if (url.pathname === '/') {
        const response = await route.fetch();
        const html = (await response.text()).replace(/src="\/src\/main\.jsx[^"]*"/, 'src="/__flows.js"');
        return route.fulfill({ response, body: html });
      }
      return route.continue();
    });
    await page.route('https://api.github.com/**', (route) => route.fulfill({ json: { tag_name: 'v0.5.4', assets: [] } }));
    await page.route('https://fonts.googleapis.com/**', (route) => route.fulfill({ contentType: 'text/css', body: '' }));
    await page.route(/^http:\/\/localhost:300[01]\//, (route) => route.fulfill({ contentType: 'text/html', body: '<p>Site de test</p>' }));
    await page.addInitScript(() => {
      localStorage.setItem('portly_cfg_canvas', 'false');
      localStorage.setItem('portly_cfg_notif_windows', 'false');
      localStorage.setItem('sprint_ui_prefs', JSON.stringify({ theme: 'light', textSize: 'md', reduceMotion: 'on', sidebarCollapsed: false }));
      Object.defineProperty(navigator, 'clipboard', { value: { writeText: async (text) => {
        if (window.__failClipboard) throw new Error('Presse-papier indisponible');
        window.__clipboard = text;
      } }, configurable: true });
    });
    const emit = (payload) => page.evaluate((payload) => window.__emit('server-status-changed', payload), payload);
    const commands = () => page.evaluate(() => window.__commands);
    await page.goto(base, { waitUntil: 'domcontentloaded' });
    await page.getByRole('heading', { name: 'Tableau de bord', exact: true }).waitFor();
    await page.keyboard.press('Control+2');
    const stopped = page.locator('[data-server-id="server3"]');
    await page.evaluate(() => { window.__holdStart = true; });
    await stopped.getByRole('button', { name: 'Lancer', exact: true }).evaluate((button) => { button.click(); button.click(); });
    await stopped.getByRole('status').waitFor();
    check((await commands()).filter((item) => item.cmd === 'start_server_cmd' && item.args.serverId === 'server3').length === 1,
      'rapid clicks on a project server start it only once');
    check(await stopped.getByRole('button', { name: 'Démarrage…', exact: true }).isDisabled(), 'pending launch is visible and disabled');
    await page.keyboard.press('Control+5');
    await page.getByRole('checkbox', { name: 'Inclure les arrêtés' }).check();
    await page.getByRole('combobox', { name: 'Console 1', exact: true }).selectOption('server3');
    check(await page.getByRole('button', { name: 'Lancer le serveur · Console 1', exact: true }).isDisabled(),
      'operation remains protected when navigating to logs');
    await page.evaluate(() => { window.__holdStart = false; window.__resolveStart(); });
    await page.getByRole('button', { name: 'Lancer le serveur · Console 1', exact: true }).waitFor({ state: 'visible' });
    await page.keyboard.press('Control+2');
    await stopped.getByRole('button', { name: 'Lancer', exact: true }).waitFor();
    check(await stopped.getByRole('button', { name: 'Lancer', exact: true }).isEnabled(), 'finished operation releases its lock');

    const running = page.locator('[data-server-id="server1"]');
    const beforeRestart = (await commands()).length;
    await page.evaluate(() => { window.__holdStop = true; });
    await running.getByRole('button', { name: /^Redémarrer / }).evaluate((button) => { button.click(); button.click(); });
    await running.getByRole('status').waitFor();
    check(!(await commands()).slice(beforeRestart).some((item) => item.cmd === 'start_server_cmd'), 'restart waits for the stop to finish');
    check(await running.getByRole('button', { name: /^Redémarrer / }).isDisabled(), 'restart prevents duplicate operations');
    await page.evaluate(() => { window.__holdStop = false; window.__resolveStop(); });
    await running.getByRole('status').waitFor({ state: 'hidden' });
    const sequence = (await commands()).slice(beforeRestart).filter((item) => /^(start|stop)_server_cmd$/.test(item.cmd));
    check(sequence.length === 2 && sequence[0].cmd === 'stop_server_cmd' && sequence[1].cmd === 'start_server_cmd',
      'restart performs exactly one stop followed by one start');
    const beforeFailure = (await commands()).length;
    await page.evaluate(() => { window.__failStop = true; });
    await running.getByRole('button', { name: /^Redémarrer / }).click();
    await page.getByText('Redémarrage impossible', { exact: true }).waitFor();
    check(!(await commands()).slice(beforeFailure).some((item) => item.cmd === 'start_server_cmd'), 'failed stop never launches a replacement process');
    check(await running.getByRole('button', { name: /^Redémarrer / }).isEnabled(), 'failed restart can be retried');
    await page.evaluate(() => { window.__failStop = false; });

    await emit({ server_id: 'server2', state: 'stopped', intentional: false, exit_code: 1 });
    const crashed = page.locator('[data-server-id="server2"]');
    await crashed.getByRole('button', { name: /Arrêt inattendu/ }).waitFor();
    check(await crashed.getByRole('button', { name: /Arrêt inattendu/ }).getAttribute('title') === 'Code de sortie 1', 'unexpected exit includes its actual exit code');
    const crashToasts = await page.evaluate(() => window.__toasts.filter((toast) => toast.title === 'Arrêt inattendu').length);
    await emit({ server_id: 'server2', state: 'stopped', intentional: false, exit_code: 1 });
    check(await page.evaluate(() => window.__toasts.filter((toast) => toast.title === 'Arrêt inattendu').length) === crashToasts,
      'repeated stopped events do not duplicate the crash notification');
    check(await crashed.getByRole('button', { name: /Arrêt inattendu/ }).isVisible(), 'duplicate status preserves the crash explanation');
    await crashed.getByRole('button', { name: /Arrêt inattendu/ }).click();
    check(await page.getByRole('combobox', { name: 'Console 1', exact: true }).inputValue() === 'server2', 'crash action opens the matching console');
    await emit({ server_id: 'server1', state: 'stopped', intentional: true, exit_code: null });
    await page.keyboard.press('Control+2');
    check(await running.getByRole('button', { name: /Arrêt inattendu/ }).count() === 0, 'manual stop does not claim a crash');
    await emit({ server_id: 'server1', state: 'running', pid: 1234, intentional: false });
    await page.screenshot({ path: art + '/sprint-server-controls-crash-light.png' });

    await emit({ server_id: 'server2', state: 'running', pid: 1235, intentional: false });
    const beforeAuto = (await commands()).length;
    await page.evaluate(() => { localStorage.setItem('sprint_cfg_autorestart', 'true'); window.__holdStart = true; });
    await emit({ server_id: 'server2', state: 'stopped', intentional: false, exit_code: 2 });
    await crashed.getByRole('status').waitFor();
    check((await commands()).slice(beforeAuto).filter((item) => item.cmd === 'start_server_cmd').length === 1,
      'auto restart uses the same server operation');
    check(await crashed.getByRole('button', { name: 'Démarrage…', exact: true }).isDisabled(),
      'auto restart protects the manual control while starting');
    await page.evaluate(() => {
      localStorage.setItem('sprint_cfg_autorestart', 'false'); window.__holdStart = false; window.__resolveStart();
    });
    await crashed.getByRole('status').waitFor({ state: 'hidden' });

    await page.getByRole('button', { name: 'Options du projet', exact: true }).click();
    await page.getByRole('menuitem', { name: 'Copier le chemin', exact: true }).click();
    check(await page.evaluate(() => window.__clipboard) === projects[0].root, 'copy project path writes the real project directory');
    check(await page.evaluate(() => window.__toasts.some((toast) => toast.title === 'Chemin copié')), 'successful copy gives feedback');
    await page.evaluate(() => { window.__failClipboard = true; });
    await page.getByRole('button', { name: 'Options du projet', exact: true }).click();
    await page.getByRole('menuitem', { name: 'Copier le chemin', exact: true }).click();
    await page.getByText('Copie impossible', { exact: true }).waitFor();
    check(await page.evaluate(() => window.__toasts.at(-1).title) === 'Copie impossible', 'failed clipboard operation reports an error');
    await page.evaluate(() => { window.__failClipboard = false; });

    await page.keyboard.press('Control+3');
    await page.getByRole('combobox', { name: 'Serveur à prévisualiser', exact: true }).selectOption('server1');
    await page.getByRole('button', { name: 'Mobile', exact: true }).click();
    await page.getByRole('combobox', { name: 'Zoom de l’aperçu' }).selectOption('actual');
    await page.getByRole('textbox', { name: 'Adresse de l’aperçu' }).fill('/page-memorisee');
    await page.getByRole('textbox', { name: 'Adresse de l’aperçu' }).press('Enter');
    await page.keyboard.press('Control+2');
    await page.keyboard.press('Control+3');
    check(await page.getByRole('textbox', { name: 'Adresse de l’aperçu' }).inputValue() === 'http://localhost:3000/page-memorisee', 'preview remembers its page after switching views');
    check(await page.getByRole('button', { name: 'Mobile', exact: true }).getAttribute('aria-pressed') === 'true', 'preview remembers its device mode');
    check(await page.getByRole('combobox', { name: 'Zoom de l’aperçu' }).inputValue() === 'actual', 'preview remembers its zoom');
    await page.keyboard.press('Control+2');
    await page.locator('[data-server-id="server2"]').getByRole('button', { name: 'Options du serveur', exact: true }).click();
    await page.getByRole('menuitem', { name: 'Aperçu Web & Devices', exact: true }).click();
    check(await page.getByRole('combobox', { name: 'Serveur à prévisualiser' }).inputValue() === 'server2', 'explicit project action overrides the remembered server');
    check(await page.getByRole('textbox', { name: 'Adresse de l’aperçu' }).inputValue() === 'http://localhost:3001', 'explicit project action opens the requested URL');
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.getByRole('heading', { name: 'Tableau de bord', exact: true }).waitFor();
    await page.keyboard.press('Control+3');
    check(await page.getByRole('combobox', { name: 'Serveur à prévisualiser' }).inputValue() === 'server2', 'preview remembers its server after reload');
    check(await page.getByRole('button', { name: 'Mobile', exact: true }).getAttribute('aria-pressed') === 'true', 'preview remembers its format after reload');
    check(await page.getByRole('textbox', { name: 'Adresse de l’aperçu' }).inputValue() === 'http://localhost:3001/', 'remembered URL is validated when loading');

    const settings = await page.evaluate(async () => {
      const { readStoredSetting, writeStoredSetting } = await import('/src/services/settingsStorage.js');
      localStorage.removeItem('sprint_cfg_cleanansi');
      localStorage.setItem('portly_cfg_cleanansi', 'false');
      const old = readStoredSetting('clean_ansi_logs');
      writeStoredSetting('clean_ansi_logs', true);
      return { old, sprint: localStorage.getItem('sprint_cfg_cleanansi'), portly: localStorage.getItem('portly_cfg_cleanansi') };
    });
    check(settings.old === 'false' && settings.sprint === 'true' && settings.portly === 'true', 'legacy preferences are read and both key generations remain synchronized');
    await page.evaluate(() => localStorage.setItem('sprint_preview_prefs', JSON.stringify({ serverId: 'removed', url: 'javascript:alert(1)', mode: 'unknown', width: -1 })));
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.getByRole('heading', { name: 'Tableau de bord', exact: true }).waitFor();
    await page.keyboard.press('Control+3');
    check(await page.getByRole('combobox', { name: 'Serveur à prévisualiser' }).inputValue() === 'server1', 'removed remembered server falls back to an available server');
    check(await page.getByRole('button', { name: 'Ordinateur', exact: true }).getAttribute('aria-pressed') === 'true', 'invalid remembered format uses the default');
    check(await page.getByRole('textbox', { name: 'Adresse de l’aperçu' }).inputValue() === 'http://localhost:3000', 'invalid remembered URL is never restored');
    check(errors.length === 0, 'no browser errors');
    fs.writeFileSync(path.join(art, 'server-flows-report.json'), JSON.stringify({ checks: results.length, results, errors }, null, 2));
    console.log(JSON.stringify({ checks: results.length, errors }, null, 2));
  } finally {
    await browser?.close();
    await server.close();
  }
})().catch((error) => { console.error(error); process.exit(1); });
