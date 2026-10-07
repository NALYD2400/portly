const { chromium } = require('playwright');
const fs = require('node:fs');
const path = require('node:path');
let base;
const projects = [
  {
    id: 'project1',
    name: 'Projet avec un nom très long pour vérifier les limites de mise en page',
    root: 'D:/Workspace/Projet',
    framework: 'React',
    branch: 'codex/une-branche-de-developpement-longue',
    servers: [
      {
        id: 'server1',
        name: 'Interface de développement avec un nom long',
        command: 'npm run dev -- --host 0.0.0.0',
        port: 3000,
        state: 'running',
        env: {},
      },
      {
        id: 'server2',
        name: 'API de développement',
        command: 'npm run api',
        port: 3001,
        state: 'running',
        env: {},
      },
      {
        id: 'server3',
        name: 'Serveur arrêté',
        command: 'npm run start',
        port: 3002,
        state: 'stopped',
        env: {},
      },
    ],
  },
];
projects[0].servers.push(
  ...Array.from({ length: 9 }, (_, index) => ({
    id: 'extra' + index,
    name: 'Serveur de test ' + index,
    command: 'npm run dev',
    state: 'stopped',
    port: 3010 + index,
    env: {},
  })),
);
const entry = `import { mockIPC, mockWindows } from '/node_modules/@tauri-apps/api/mocks.js';
import { emit } from '/node_modules/@tauri-apps/api/event.js';
window.__layoutCommands = []; window.__commands = []; window.__emit = emit; window.__failSave = false; window.__trayActivity = 0;
window.__toasts = [];
window.addEventListener('portly-toast', event => window.__toasts.push(event.detail));
mockIPC((cmd, args) => {
  if (cmd === 'stop_server_cmd' && window.__failStop) throw new Error('Test: arrêt impossible');
  window.__layoutCommands.push(cmd); window.__commands.push({cmd,args}); if (cmd === "save_projects_cmd" && window.__failSave) throw new Error("Test: disque indisponible"); if (cmd === "get_tray_state_cmd") return {projects: [{"id":"p1","name":"SR Editer","servers":[{"id":"s1","name":"Application desktop","port":4313,"state":"running"},{"id":"s2","name":"Site web local","port":3000,"state":"stopped"}]},{"id":"p2","name":"SiteStudio","servers":[{"id":"s3","name":"Web Dev Server","port":5173,"state":"running"},{"id":"s4","name":"Tauri Desktop","port":0,"state":"stopped"}]}],running_count:2,activity:window.__trayActivity};
  if (cmd === 'get_projects_cmd') return ${JSON.stringify(projects)};
  if (cmd === 'get_ports_cmd') return [{ port: 3000, pid: 1234, process_name: 'node.exe', protocol: 'TCP', state: 'LISTEN', local_address: '127.0.0.1' }];
  if (cmd === 'ping_port_cmd') return true;
  if (cmd === 'get_local_ip_cmd') return '192.168.1.5';
  if (cmd === 'get_settings_cmd') return null;
  if (cmd === 'plugin:dialog|open') return 'D:/Workspace/Projet';
  if (cmd === 'detect_stack_cmd') return {framework: 'React', default_dev_cmd: 'npm run dev', package_manager: 'npm'};
  if (cmd === 'list_env_files_cmd') return ['.env','.env.local'];
  if (cmd === 'read_env_file') return 'PORT=3000\\nTEST_LAYOUT=fixture';
  if (cmd.includes('zoom')) throw new Error('Exercise CSS zoom fallback');
  return null;
}, { shouldMockEvents: true });
mockWindows('main');
await import('/src/main.jsx');
setInterval(() => emit('system-metrics', { cpu_usage: 20, ram_total_mb: 16000, ram_used_mb: 8000, managed_cpu_pct: 12, managed_ram_mb: 256, active_servers_count: 2, server_metrics: {} }), 200);
`;

(async () => {
  const { createServer } = await import('vite');
  const server = await createServer({
    logLevel: 'silent',
    server: { host: '127.0.0.1', port: 0, strictPort: true },
  });
  await server.listen();
  base = 'http://127.0.0.1:' + server.httpServer.address().port;
  let browser;
  try {
    const channel =
      process.env.SPRINT_BROWSER_CHANNEL || (process.platform === 'win32' ? 'msedge' : undefined);
    browser = await chromium.launch({
      channel,
      headless: true,
      args: ['--disable-features=LocalNetworkAccessChecks'],
    });
    const page = await browser.newPage({ viewport: { width: 1320, height: 860 } });
    let testEntry = entry;
    const errors = [];
    const results = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await page.route(base + '/**', async (route) => {
      const url = new URL(route.request().url());
      if (url.pathname === '/__layout-test-entry.js')
        return route.fulfill({ contentType: 'text/javascript', body: testEntry });
      if (url.pathname === '/') {
        const response = await route.fetch();
        const html = await response.text();
        const mainUrl = html.match(/src="([^"]*main\.jsx[^"]*)"/)[1];
        testEntry = entry.replace(
          "await import('/src/main.jsx');",
          'await import(' + JSON.stringify(mainUrl) + ');',
        );
        const body = html.replace(/src="\/src\/main\.jsx[^"]*"/, 'src="/__layout-test-entry.js"');
        return route.fulfill({ response, body });
      }
      return route.continue();
    });
    await page.route('https://api.github.com/**', (r) =>
      r.fulfill({ json: { tag_name: 'v0.5.2', assets: [] } }),
    );
    await page.route('https://fonts.googleapis.com/**', (r) => r.fulfill({ contentType: 'text/css', body: '' }));
    await page.route('http://localhost:3000/**', (r) =>
      r.fulfill({ contentType: 'text/html', body: '<html><body>Test aperçu</body></html>' }),
    );
    await page.route('http://localhost:3001/**', (r) =>
      r.fulfill({ contentType: 'text/html', body: '<html><body>Test API</body></html>' }),
    );
    await page.addInitScript(() => {
      if (window !== window.top) return;
      window.__canvasDraws = 0;
      const fill = CanvasRenderingContext2D.prototype.fillRect;
      CanvasRenderingContext2D.prototype.fillRect = function (...args) {
        window.__canvasDraws++;
        return fill.apply(this, args);
      };
      localStorage.setItem('portly_cfg_canvas', 'false');
      localStorage.setItem('portly_cfg_notif_windows', 'false');
      localStorage.setItem(
        'sprint_ui_prefs',
        JSON.stringify({
          theme: 'light',
          textSize: 'md',
          reduceMotion: 'on',
          sidebarCollapsed: true,
        }),
      );
    });
    const check = (condition, label) => {
      if (!condition) throw new Error(label);
      results.push(label);
    };
    const cmds = () => page.evaluate(() => window.__commands);
    const emit = (name, payload) =>
      page.evaluate(([name, payload]) => window.__emit(name, payload), [name, payload]);
    const art = path.resolve('test-results');
    fs.mkdirSync(art, { recursive: true });
    await page.goto(base, { waitUntil: 'domcontentloaded' });
    await page.getByRole('heading', { name: 'Tableau de bord', exact: true }).waitFor();

    for (const size of ['md', 'xl']) {
      await page.evaluate(
        (size) =>
          localStorage.setItem(
            'sprint_ui_prefs',
            JSON.stringify({
              theme: 'light',
              textSize: size,
              reduceMotion: 'on',
              sidebarCollapsed: false,
            }),
          ),
        size,
      );
      await page.reload({ waitUntil: 'domcontentloaded' });
      await page.getByRole('heading', { name: 'Tableau de bord', exact: true }).waitFor();
      for (const [width, height] of [
        [1320, 860],
        [960, 620],
      ]) {
        await page.setViewportSize({ width, height });
        for (const key of ['1', '2', '3', '4', '5', ',']) {
          await page.keyboard.press('Control+' + key);
          await page.waitForTimeout(80);
          const fit = await page.evaluate(() => {
            const main = document.querySelector('main'),
              shell = document.querySelector('.app-shell').getBoundingClientRect();
            return (
              main.scrollWidth <= main.clientWidth + 1 &&
              shell.right <= innerWidth + 1 &&
              shell.bottom <= innerHeight + 1
            );
          });
          check(fit, 'layout ' + size + ' ' + width + ' ' + key);
        }
      }
    }
    await page.evaluate(() =>
      localStorage.setItem(
        'sprint_ui_prefs',
        JSON.stringify({
          theme: 'light',
          textSize: 'md',
          reduceMotion: 'on',
          sidebarCollapsed: true,
        }),
      ),
    );
    await page.setViewportSize({ width: 1320, height: 860 });
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.getByRole('heading', { name: 'Tableau de bord', exact: true }).waitFor();
    await page.keyboard.press('Control+,');
    const nav = page.getByRole('navigation', { name: 'Sections des paramètres' });
    const initial = await nav.boundingBox();
    for (const name of await nav.getByRole('button').allTextContents()) {
      await nav.getByRole('button', { name, exact: true }).click();
      const bounds = await nav.boundingBox();
      check(
        Math.abs(bounds.x - initial.x) < 0.5 && Math.abs(bounds.y - initial.y) < 0.5,
        'settings stable ' + name,
      );
      await page.locator('.settings-content').evaluate((el) => (el.scrollTop = el.scrollHeight));
      const after = await nav.boundingBox();
      check(Math.abs(after.y - initial.y) < 0.5, 'settings independent scroll ' + name);
    }
    await nav.getByRole('button', { name: 'Apparence', exact: true }).click();
    await page.getByRole('switch', { name: 'Arrière-plan animé', exact: true }).click();
    await page.waitForTimeout(200);
    const draws = await page.evaluate(() => window.__canvasDraws);
    await page.waitForTimeout(200);
    check(
      (await page.evaluate(() => window.__canvasDraws)) === draws,
      'hidden light-theme canvas does not render continuously',
    );
    await page.evaluate(() => {
      document.documentElement.dataset.theme = 'dark';
      document.documentElement.dataset.motion = 'reduce';
    });
    await page.waitForTimeout(100);
    const reducedDraws = await page.evaluate(() => window.__canvasDraws);
    await page.waitForTimeout(200);
    check(
      (await page.evaluate(() => window.__canvasDraws)) === reducedDraws,
      'reduced-motion canvas does not render continuously',
    );
    await page.evaluate(() => (document.documentElement.dataset.motion = 'full'));
    await page.waitForTimeout(200);
    check(
      (await page.evaluate(() => window.__canvasDraws)) > reducedDraws,
      'canvas resumes when animations are enabled',
    );
    await page.evaluate(() => {
      document.documentElement.dataset.theme = 'light';
      document.documentElement.dataset.motion = 'reduce';
    });
    await page.getByRole('switch', { name: 'Arrière-plan animé', exact: true }).click();
    await page.screenshot({ path: art + '/sprint-settings-stable.png' });
    await nav.getByRole('button', { name: 'Système', exact: true }).click();
    const notification = page.getByRole('switch', { name: 'Notifications dans Sprint' });
    await notification.click();
    await page.waitForTimeout(100);
    const storage = await page.evaluate(() => [
      localStorage.getItem('portly_cfg_notif_app'),
      localStorage.getItem('sprint_cfg_notif_app'),
    ]);
    check(storage[0] === 'false' && storage[1] === 'false', 'notification keys synchronized');
    await nav.getByRole('button', { name: 'Sauvegardes', exact: true }).click();
    let before = (await cmds()).filter((x) => x.cmd === 'save_projects_cmd').length;
    await page
      .getByLabel('Importer une sauvegarde')
      .setInputFiles({
        name: 'backup.json',
        mimeType: 'application/json',
        buffer: Buffer.from(JSON.stringify(projects)),
      });
    await page.getByRole('dialog').waitFor();
    check(
      (await cmds()).filter((x) => x.cmd === 'save_projects_cmd').length === before,
      'import waits for user confirmation',
    );
    await page.getByRole('button', { name: 'Annuler', exact: true }).click();
    check(
      (await cmds()).filter((x) => x.cmd === 'save_projects_cmd').length === before,
      'cancel import does not overwrite projects',
    );
    await page
      .getByLabel('Importer une sauvegarde')
      .setInputFiles({
        name: 'backup.json',
        mimeType: 'application/json',
        buffer: Buffer.from(JSON.stringify(projects)),
      });
    await page.getByRole('button', { name: 'Restaurer les projets', exact: true }).click();
    await page.getByRole('dialog').waitFor({ state: 'hidden' });
    check(
      (await cmds()).filter((x) => x.cmd === 'save_projects_cmd').length === before + 1,
      'confirmed import saves once',
    );
    await page.keyboard.press('Control+2');
    await page.getByRole('button', { name: 'Options du serveur', exact: true }).first().click();
    await page.getByRole('menuitem', { name: 'Modifier le serveur', exact: true }).click();
    await page.evaluate(() => (window.__failSave = true));
    await page.locator('form button[type="submit"]').click();
    await page.waitForTimeout(200);
    check(await page.getByRole('dialog').isVisible(), 'save failure preserves form');
    await page.evaluate(() => (window.__failSave = false));
    await page.locator('form button[type="submit"]').click();
    await page.getByRole('dialog').waitFor({ state: 'hidden' });
    await page.keyboard.press('Control+5');
    check(
      (await page.getByRole('combobox', { name: 'Console 1', exact: true }).count()) === 1,
      'single server selector',
    );
    check((await page.locator('.logs-servers').count()) === 0, 'redundant tab strip removed');
    await emit('server-status-changed', {
      server_id: 'server1',
      state: 'stopped',
      pid: null,
      intentional: true,
    });
    await page.waitForTimeout(100);
    check(
      (await page.getByRole('combobox', { name: 'Console 1', exact: true }).inputValue()) ===
        'server1',
      'stopped console remains selected',
    );
    await page.getByLabel('Inclure les arrêtés').check();
    await page.getByRole('button', { name: 'Deux consoles', exact: true }).click();
    check(
      (await page.getByRole('combobox', { name: 'Console 2', exact: true }).inputValue()) !==
        'server1',
      'split consoles are distinct',
    );
    check(
      await page
        .getByRole('combobox', { name: 'Console 2', exact: true })
        .locator('option[value="server1"]')
        .isDisabled(),
      'duplicate server option disabled',
    );
    await page.evaluate(async () => {
      await Promise.all(
        Array.from({ length: 2100 }, (_, i) =>
          window.__emit('server-log-line', { server_id: 'server1', line: 'line ' + i }),
        ),
      );
    });
    await page.waitForTimeout(250);
    check(
      await page
        .locator('.terminal-panel')
        .first()
        .locator('.terminal-footer')
        .innerText()
        .then((t) => t.includes('2000 lignes')),
      'log buffer capped after large batch',
    );
    check(
      (await page
        .locator('.terminal-panel')
        .first()
        .locator('.terminal-log-screen > div')
        .count()) <= 500,
      'rendered log window capped',
    );
    await page.locator('.log-history-button').click();
    await page.waitForTimeout(100);
    check((await page.locator('.log-resume').count()) === 1, 'older history pauses follow');
    await page.locator('.log-resume').click();
    await page.getByRole('button', { name: 'Effacer les logs', exact: true }).first().click();
    await page.evaluate(async () => {
      await Promise.all(
        Array.from({ length: 5 }, (_, i) =>
          window.__emit('server-log-line', { server_id: 'server1', line: 'pending ' + i }),
        ),
      );
    });
    // Clear pending input in the same event turn through the enabled clear button after one published line.
    await page.waitForTimeout(150);
    await page.getByRole('button', { name: 'Effacer les logs', exact: true }).first().click();
    await page.waitForTimeout(150);
    check(
      await page
        .locator('.terminal-panel')
        .first()
        .locator('.terminal-footer')
        .innerText()
        .then((t) => t.includes('0 lignes')),
      'clear empties log cache',
    );
    await page.setViewportSize({ width: 1320, height: 860 });
    await page.getByRole('button', { name: 'Une console', exact: true }).click();
    await page.screenshot({ path: art + '/sprint-logs-redesign-light.png' });
    await page.evaluate(() => (document.documentElement.dataset.theme = 'dark'));
    await page.screenshot({ path: art + '/sprint-logs-redesign-dark.png' });
    // Dirty .env nested confirmation must own Escape and keyboard focus.
    await page.keyboard.press('Control+2');
    await page.getByRole('button', { name: 'Options du projet', exact: true }).click();
    await page.getByRole('menuitem', { name: /env/i }).click();
    await page.waitForTimeout(100);
    await page.getByRole('button', { name: 'Afficher les secrets en clair', exact: true }).click();
    await page
      .getByRole('textbox', { name: 'Contenu du fichier .env en clair', exact: true })
      .fill('CHANGED=1');
    await page.keyboard.press('Escape');
    await page.waitForTimeout(100);
    check((await page.getByRole('dialog').count()) === 2, 'dirty env opens nested confirmation');
    await page.keyboard.press('Escape');
    await page.waitForTimeout(100);
    check((await page.getByRole('dialog').count()) === 1, 'Escape closes only top confirmation');
    await page.keyboard.press('Control+1');
    check(
      (await page.getByRole('dialog').count()) === 1,
      'navigation shortcut does not replace page behind modal',
    );
    const failedStop = await page.evaluate(async () => {
      window.__failStop = true;
      window.__toasts = [];
      const { stopProject } = await import('/src/services/serverActions.js');
      const stopped = await stopProject({
        name: 'Test',
        servers: [{ id: 'server1', name: 'Dev', state: 'running' }],
      });
      window.__failStop = false;
      return { stopped, toasts: window.__toasts };
    });
    check(
      !failedStop.stopped && !failedStop.toasts.some((toast) => toast.type === 'info'),
      'failed stop never reports success',
    );
    // Tray surface, no real processes involved.
    await page.goto(base + '/?tray=1', { waitUntil: 'domcontentloaded' });
    await page.getByRole('heading', { name: 'Sprint', exact: true }).waitFor();
    await page.setViewportSize({ width: 360, height: 540 });
    await page.screenshot({ path: art + '/sprint-tray-light.png' });
    const overflow = await page.evaluate(
      () =>
        document.documentElement.scrollWidth > innerWidth ||
        document.documentElement.scrollHeight > innerHeight,
    );
    check(!overflow, 'tray panel fits native dimensions');
    await page.getByRole('button', { name: 'Quitter Sprint', exact: true }).click();
    check(
      (await cmds()).filter((x) => x.cmd === 'tray_action_cmd' && x.args.action === 'quit')
        .length === 0,
      'quit with active servers requires confirmation',
    );
    await page.getByRole('button', { name: 'Annuler', exact: true }).click();
    await page.getByRole('button', { name: 'Lancer Site web local', exact: true }).click();
    check(
      (await cmds()).filter(
        (x) =>
          x.cmd === 'tray_action_cmd' &&
          x.args.action === 'toggle-server' &&
          x.args.serverId === 's2',
      ).length === 1,
      'tray toggles only chosen server',
    );
    await page.evaluate(() => (window.__trayActivity = 1));
    await emit('tray-state-changed', null);
    await page.waitForTimeout(100);
    check(
      await page.getByRole('button', { name: 'Tout lancer 2', exact: true }).isDisabled(),
      'tray batch actions disabled during operation',
    );
    check(
      await page.getByRole('button', { name: 'Logs', exact: true }).isEnabled(),
      'logs remain accessible during operation',
    );
    await page.getByRole('button', { name: 'Logs', exact: true }).click();
    check(
      (await cmds()).some((x) => x.cmd === 'tray_action_cmd' && x.args.tab === 'terminal'),
      'tray opens log page',
    );
    await page.evaluate(() => {
      window.__trayActivity = 0;
      localStorage.setItem(
        'sprint_ui_prefs',
        JSON.stringify({ theme: 'dark', textSize: 'xl', reduceMotion: 'on' }),
      );
    });
    await emit('tray-panel-opened', null);
    await page.waitForTimeout(100);
    await page.screenshot({ path: art + '/sprint-tray-dark.png' });
    check(
      (await page.evaluate(() => document.documentElement.style.zoom)) === '',
      'tray keeps fixed text scale independent of main text size',
    );
    console.log(JSON.stringify({ checks: results.length, errors }, null, 2));
    fs.writeFileSync(
      path.join(art, 'ux-regression-report.json'),
      JSON.stringify({ checks: results.length, results, errors }, null, 2),
    );
    check(!errors.length, 'no browser errors');
  } finally {
    await browser?.close();
    await server.close();
  }
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
