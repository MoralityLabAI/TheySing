#!/usr/bin/env node

const fs = require('node:fs');
const path = require('node:path');
const { spawn } = require('node:child_process');
const WebSocket = require('ws');

const ROOT = path.resolve(__dirname, '..');
const DEFAULT_URL = 'https://they-sing.vercel.app/';
const DEFAULT_TIMEOUT_MS = 45_000;

main().catch((error) => {
  console.error(error?.stack || String(error));
  process.exitCode = 1;
});

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const browserPath = resolveBrowserPath(options.browserPath);
  const outputDir = path.resolve(options.outputDir || defaultOutputDir());
  const profileDir = path.join(outputDir, '.chrome-profile');
  fs.mkdirSync(outputDir, { recursive: true });
  await removeDirectoryWithRetry(profileDir);
  fs.mkdirSync(profileDir, { recursive: true });

  const browser = spawn(browserPath, browserArgs(profileDir, options.headed), {
    stdio: ['ignore', 'ignore', 'pipe'],
    windowsHide: !options.headed
  });
  let browserStderr = '';
  browser.stderr.on('data', (chunk) => {
    browserStderr = `${browserStderr}${chunk}`.slice(-16_000);
  });

  let client = null;
  let captureCompleted = false;
  const runtimeFindings = {
    consoleErrors: [],
    exceptions: [],
    networkFailures: []
  };

  try {
    const endpoint = await waitForDevTools(profileDir, browser, options.timeoutMs);
    const target = await createTarget(endpoint.port, 'about:blank');
    client = await CdpClient.connect(target.webSocketDebuggerUrl, options.timeoutMs);
    attachRuntimeFindings(client, runtimeFindings);
    await Promise.all([
      client.send('Page.enable'),
      client.send('Runtime.enable'),
      client.send('Network.enable'),
      client.send('Log.enable')
    ]);
    await client.send('Emulation.setEmulatedMedia', {
      media: 'screen',
      features: [{ name: 'prefers-reduced-motion', value: 'reduce' }]
    });
    await client.send('Page.addScriptToEvaluateOnNewDocument', {
      source: `
        window.__theysingVisualQa = { ready: false };
        window.addEventListener('theysing:ready', () => {
          window.__theysingVisualQa.ready = true;
        }, { once: true });
      `
    });
    await client.send('Page.navigate', { url: options.url });
    await waitForExpression(
      client,
      `Boolean(window.__theysingVisualQa?.ready && document.querySelector('.obs-shell') && /^Turn \\d+/.test(document.querySelector('[data-role="turn"]')?.textContent || ''))`,
      options.timeoutMs,
      'observatory readiness'
    );
    await injectDeterministicStyles(client);

    const replayProbe = await inspectReplaySource(options.url);
    await setReplayIndex(client, replayProbe.densestIndex);
    const version = await client.send('Browser.getVersion');
    const states = [];

    await setViewport(client, 1440, 1000, false);
    await setReplayIndex(client, replayProbe.densestIndex);
    await resetCamera(client);
    await setView(client, 'globe');
    states.push(await captureState(client, outputDir, 'desktop-globe', 1440, 1000));

    await setView(client, 'evidence');
    await setEvidenceTab(client, 'now');
    await resetScrollPositions(client);
    states.push(await captureState(client, outputDir, 'desktop-evidence-now', 1440, 1000));

    if (!options.quick) {
      await setReplayIndex(client, replayProbe.protocolIndex);
      await setEvidenceTab(client, 'protocol');
      await resetScrollPositions(client);
      states.push(await captureState(client, outputDir, 'desktop-evidence-protocol', 1440, 1000));

      await setReplayIndex(client, replayProbe.diaryIndex);
      await setView(client, 'diary');
      await resetScrollPositions(client);
      states.push(await captureState(client, outputDir, 'desktop-diary', 1440, 1000));

      await setReplayIndex(client, replayProbe.protocolIndex);
      await setView(client, 'all');
      await setEvidenceTab(client, 'protocol');
      await resetScrollPositions(client);
      states.push(await captureState(client, outputDir, 'desktop-all', 1440, 1000));
    }

    await setReplayIndex(client, replayProbe.densestIndex);
    const desktopFocus = await openEvidenceDetail(client);
    states.push(await captureState(client, outputDir, 'desktop-selected-evidence', 1440, 1000, { focusLifecycle: desktopFocus }));
    const desktopRestore = await dismissEvidenceDetail(client);
    states.at(-1).focusLifecycle.afterDismiss = desktopRestore;

    await setViewport(client, 390, 844, true);
    await setReplayIndex(client, replayProbe.densestIndex);
    await resetCamera(client);
    await setView(client, 'globe');
    states.push(await captureState(client, outputDir, 'mobile-globe', 390, 844));

    if (!options.quick) {
      await setView(client, 'evidence');
      await setEvidenceTab(client, 'now');
      await resetScrollPositions(client);
      states.push(await captureState(client, outputDir, 'mobile-evidence-now', 390, 844));

      await setReplayIndex(client, replayProbe.diaryIndex);
      await setView(client, 'diary');
      await resetScrollPositions(client);
      states.push(await captureState(client, outputDir, 'mobile-diary', 390, 844));
    }

    await setReplayIndex(client, replayProbe.densestIndex);
    const mobileFocus = await openEvidenceDetail(client);
    states.push(await captureState(client, outputDir, 'mobile-selected-evidence', 390, 844, { focusLifecycle: mobileFocus }));
    const mobileRestore = await dismissEvidenceDetail(client);
    states.at(-1).focusLifecycle.afterDismiss = mobileRestore;

    const manifest = {
      schema: 'theysing.uxVisualCapture.v1',
      capturedAt: new Date().toISOString(),
      url: options.url,
      browser: {
        executable: browserPath,
        product: version.product,
        userAgent: version.userAgent,
        protocolVersion: version.protocolVersion
      },
      replayProbe,
      captureMode: options.quick ? 'quick' : 'full',
      states,
      runtimeFindings,
      summary: summarizeStates(states, runtimeFindings)
    };
    fs.writeFileSync(path.join(outputDir, 'visual_capture_manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`);
    fs.writeFileSync(path.join(outputDir, 'visual_capture_report.md'), renderReport(manifest));
    captureCompleted = true;
    console.log(`Visual capture complete: ${outputDir}`);
    console.log(`Screenshots: ${states.length}`);
    console.log(`Warnings: ${manifest.summary.warningCount}`);
    console.log(`Manifest: ${path.join(outputDir, 'visual_capture_manifest.json')}`);
  } finally {
    if (client) {
      await Promise.race([
        client.send('Browser.close').catch(() => {}),
        delay(2_000)
      ]);
      client.close();
    }
    await stopBrowser(browser);
    try {
      await removeDirectoryWithRetry(profileDir);
    } catch (error) {
      console.warn(`Chrome profile cleanup deferred: ${error.message}`);
    }
    if (!captureCompleted && browserStderr.trim()) {
      console.error(browserStderr.trim());
    }
  }
}

function parseArgs(args) {
  const options = {
    url: DEFAULT_URL,
    outputDir: '',
    browserPath: '',
    timeoutMs: DEFAULT_TIMEOUT_MS,
    headed: false,
    quick: false
  };
  for (let index = 0; index < args.length; index += 1) {
    const argument = args[index];
    if (argument.startsWith('--url=')) options.url = argument.slice('--url='.length);
    else if (argument.startsWith('--output-dir=')) options.outputDir = argument.slice('--output-dir='.length);
    else if (argument.startsWith('--browser=')) options.browserPath = argument.slice('--browser='.length);
    else if (argument.startsWith('--timeout-ms=')) options.timeoutMs = Number(argument.slice('--timeout-ms='.length));
    else if (argument === '--url') options.url = requireValue(args, ++index, '--url');
    else if (argument === '--output-dir') options.outputDir = requireValue(args, ++index, '--output-dir');
    else if (argument === '--browser') options.browserPath = requireValue(args, ++index, '--browser');
    else if (argument === '--timeout-ms') options.timeoutMs = Number(requireValue(args, ++index, '--timeout-ms'));
    else if (argument === '--headed') options.headed = true;
    else if (argument === '--quick') options.quick = true;
    else if (argument === '--help' || argument === '-h') {
      console.log([
        'Usage: node scripts/capture-observatory-ux.cjs [options]',
        '',
        '  --url URL             Observatory URL (default: production)',
        '  --output-dir PATH     Capture destination',
        '  --browser PATH        Chrome or Edge executable',
        '  --timeout-ms NUMBER   Readiness timeout (default: 45000)',
        '  --headed              Show the controlled browser window',
        '  --quick               Capture five core states instead of all ten'
      ].join('\n'));
      process.exit(0);
    } else {
      throw new Error(`Unknown argument: ${argument}`);
    }
  }
  if (!Number.isFinite(options.timeoutMs) || options.timeoutMs < 1_000) {
    throw new Error('--timeout-ms must be at least 1000');
  }
  options.url = new URL(options.url).toString();
  return options;
}

function requireValue(args, index, name) {
  const value = args[index];
  if (!value || value.startsWith('--')) throw new Error(`${name} requires a value`);
  return value;
}

function defaultOutputDir() {
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const externalRoot = 'D:\\they-sing-results\\ux-visual-captures';
  const root = fs.existsSync('D:\\') ? externalRoot : path.join(ROOT, 'results', 'ux-visual-captures');
  return path.join(root, stamp);
}

function resolveBrowserPath(explicitPath) {
  const candidates = [
    explicitPath,
    process.env.CHROME_PATH,
    path.join(process.env.PROGRAMFILES || '', 'Google', 'Chrome', 'Application', 'chrome.exe'),
    path.join(process.env['PROGRAMFILES(X86)'] || '', 'Microsoft', 'Edge', 'Application', 'msedge.exe'),
    path.join(process.env.LOCALAPPDATA || '', 'Google', 'Chrome', 'Application', 'chrome.exe')
  ].filter(Boolean);
  const match = candidates.find((candidate) => fs.existsSync(candidate));
  if (!match) throw new Error('Chrome or Edge was not found. Pass --browser PATH.');
  return path.resolve(match);
}

function browserArgs(profileDir, headed) {
  return [
    ...(headed ? [] : ['--headless=new']),
    '--remote-debugging-port=0',
    '--remote-allow-origins=*',
    `--user-data-dir=${profileDir}`,
    '--no-first-run',
    '--no-default-browser-check',
    '--disable-background-networking',
    '--disable-component-update',
    '--disable-breakpad',
    '--disable-crashpad',
    '--disable-crash-reporter',
    '--disable-default-apps',
    '--disable-extensions',
    '--disable-features=Translate,OptimizationHints,MediaRouter',
    '--disable-popup-blocking',
    '--disable-sync',
    '--enable-unsafe-swiftshader',
    '--use-angle=swiftshader',
    '--force-device-scale-factor=1',
    '--window-size=1440,1000',
    'about:blank'
  ];
}

async function waitForDevTools(profileDir, browser, timeoutMs) {
  const activePortPath = path.join(profileDir, 'DevToolsActivePort');
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (browser.exitCode !== null) throw new Error(`Browser exited before DevTools started (${browser.exitCode})`);
    if (fs.existsSync(activePortPath)) {
      const [portLine, websocketPath] = fs.readFileSync(activePortPath, 'utf8').trim().split(/\r?\n/);
      const port = Number(portLine);
      if (Number.isInteger(port) && websocketPath) return { port, websocketPath };
    }
    await delay(100);
  }
  throw new Error(`Timed out waiting for Chrome DevTools after ${timeoutMs}ms`);
}

async function createTarget(port, url) {
  const endpoint = `http://127.0.0.1:${port}/json/new?${encodeURIComponent(url)}`;
  const response = await fetch(endpoint, { method: 'PUT' });
  if (!response.ok) throw new Error(`Unable to create DevTools target: HTTP ${response.status}`);
  return response.json();
}

class CdpClient {
  constructor(websocket, timeoutMs) {
    this.websocket = websocket;
    this.timeoutMs = timeoutMs;
    this.nextId = 1;
    this.pending = new Map();
    this.listeners = new Map();
    websocket.on('message', (raw) => this.handleMessage(raw));
    websocket.on('error', (error) => this.rejectPending(error));
    websocket.on('close', () => this.rejectPending(new Error('DevTools websocket closed')));
  }

  static connect(url, timeoutMs) {
    return new Promise((resolve, reject) => {
      const websocket = new WebSocket(url);
      const timer = setTimeout(() => {
        websocket.terminate();
        reject(new Error(`Timed out connecting to DevTools after ${timeoutMs}ms`));
      }, timeoutMs);
      websocket.once('open', () => {
        clearTimeout(timer);
        resolve(new CdpClient(websocket, timeoutMs));
      });
      websocket.once('error', (error) => {
        clearTimeout(timer);
        reject(error);
      });
    });
  }

  send(method, params = {}) {
    const id = this.nextId++;
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(id);
        reject(new Error(`DevTools command timed out: ${method}`));
      }, this.timeoutMs);
      this.pending.set(id, { method, resolve, reject, timer });
      this.websocket.send(JSON.stringify({ id, method, params }), (error) => {
        if (!error) return;
        clearTimeout(timer);
        this.pending.delete(id);
        reject(error);
      });
    });
  }

  on(method, listener) {
    const listeners = this.listeners.get(method) || [];
    listeners.push(listener);
    this.listeners.set(method, listeners);
  }

  handleMessage(raw) {
    let message;
    try {
      message = JSON.parse(raw.toString());
    } catch {
      return;
    }
    if (message.id) {
      const pending = this.pending.get(message.id);
      if (!pending) return;
      clearTimeout(pending.timer);
      this.pending.delete(message.id);
      if (message.error) pending.reject(new Error(`${pending.method}: ${message.error.message}`));
      else pending.resolve(message.result || {});
      return;
    }
    for (const listener of this.listeners.get(message.method) || []) listener(message.params || {});
  }

  rejectPending(error) {
    for (const pending of this.pending.values()) {
      clearTimeout(pending.timer);
      pending.reject(error);
    }
    this.pending.clear();
  }

  close() {
    if (this.websocket.readyState === WebSocket.OPEN) this.websocket.close();
  }
}

function attachRuntimeFindings(client, findings) {
  client.on('Runtime.consoleAPICalled', (params) => {
    if (!['error', 'assert'].includes(params.type)) return;
    findings.consoleErrors.push({
      type: params.type,
      text: (params.args || []).map(remoteValue).join(' '),
      timestamp: params.timestamp
    });
  });
  client.on('Runtime.exceptionThrown', (params) => {
    findings.exceptions.push({
      text: params.exceptionDetails?.text || 'Runtime exception',
      description: params.exceptionDetails?.exception?.description || '',
      url: params.exceptionDetails?.url || '',
      lineNumber: params.exceptionDetails?.lineNumber
    });
  });
  client.on('Log.entryAdded', (params) => {
    if (params.entry?.level !== 'error') return;
    findings.consoleErrors.push({
      type: params.entry.source || 'log',
      text: params.entry.text || '',
      url: params.entry.url || ''
    });
  });
  client.on('Network.loadingFailed', (params) => {
    if (params.canceled) return;
    findings.networkFailures.push({
      requestId: params.requestId,
      errorText: params.errorText,
      blockedReason: params.blockedReason || ''
    });
  });
}

function remoteValue(argument) {
  if (Object.hasOwn(argument, 'value')) return String(argument.value);
  return argument.description || argument.type || '';
}

async function evaluate(client, expression) {
  const response = await client.send('Runtime.evaluate', {
    expression,
    awaitPromise: true,
    returnByValue: true,
    userGesture: true
  });
  if (response.exceptionDetails) {
    throw new Error(response.exceptionDetails.exception?.description || response.exceptionDetails.text || 'Evaluation failed');
  }
  return response.result?.value;
}

async function waitForExpression(client, expression, timeoutMs, label) {
  const deadline = Date.now() + timeoutMs;
  let lastError = null;
  while (Date.now() < deadline) {
    try {
      if (await evaluate(client, expression)) return;
    } catch (error) {
      lastError = error;
    }
    await delay(125);
  }
  throw new Error(`Timed out waiting for ${label}${lastError ? `: ${lastError.message}` : ''}`);
}

async function injectDeterministicStyles(client) {
  await evaluate(client, `(() => {
    const style = document.createElement('style');
    style.id = 'theysing-visual-qa-style';
    style.textContent = ` + JSON.stringify(`
      *, *::before, *::after {
        animation-delay: 0ms !important;
        animation-duration: 1ms !important;
        transition-delay: 0ms !important;
        transition-duration: 1ms !important;
        caret-color: transparent !important;
      }
    `) + `;
    document.head.appendChild(style);
    return true;
  })()`);
}

async function inspectReplaySource(pageUrl) {
  const replayUrl = new URL('/observatory_replay.json', pageUrl).toString();
  const response = await fetch(replayUrl);
  if (!response.ok) throw new Error(`Replay probe failed: HTTP ${response.status} ${replayUrl}`);
  const replay = await response.json();
  const turns = Array.isArray(replay.turns) ? replay.turns : [];
  let densestIndex = 0;
  let densestSignals = -1;
  let protocolIndex = 0;
  let protocolRecords = -1;
  let diaryIndex = 0;
  let diaryRecords = -1;
  for (const [index, turn] of turns.entries()) {
    const signalCount = Array.isArray(turn.sceneEvents) ? turn.sceneEvents.length : 0;
    if (signalCount > densestSignals) {
      densestSignals = signalCount;
      densestIndex = index;
    }
    const protocolCount = Object.values(turn.protocolEvidence || {})
      .reduce((sum, entries) => sum + (Array.isArray(entries) ? entries.length : 0), 0);
    if (protocolCount > protocolRecords) {
      protocolRecords = protocolCount;
      protocolIndex = index;
    }
    const diaryCount = (Array.isArray(turn.messages) ? turn.messages.length : 0)
      + (Array.isArray(turn.diaries) ? turn.diaries.length : 0);
    if (diaryCount > diaryRecords) {
      diaryRecords = diaryCount;
      diaryIndex = index;
    }
  }
  const target = turns[densestIndex] || {};
  const protocolTarget = turns[protocolIndex] || {};
  const diaryTarget = turns[diaryIndex] || {};
  return {
    replayUrl,
    phaseCount: turns.length,
    densestIndex,
    densestSignals: Math.max(0, densestSignals),
    turn: target.turn ?? null,
    phase: target.phase || null,
    protocolIndex,
    protocolRecords: Math.max(0, protocolRecords),
    protocolTurn: protocolTarget.turn ?? null,
    protocolPhase: protocolTarget.phase || null,
    diaryIndex,
    diaryRecords: Math.max(0, diaryRecords),
    diaryTurn: diaryTarget.turn ?? null,
    diaryPhase: diaryTarget.phase || null
  };
}

async function setReplayIndex(client, index) {
  await evaluate(client, `(() => {
    const scrubber = document.querySelector('[data-role="scrubber"]');
    if (!scrubber) return false;
    scrubber.value = ${JSON.stringify(String(index))};
    scrubber.dispatchEvent(new Event('input', { bubbles: true }));
    return true;
  })()`);
  await settle(client);
}

async function setViewport(client, width, height, mobile) {
  const previousTimeOrigin = await evaluate(client, 'performance.timeOrigin');
  await client.send('Emulation.setDeviceMetricsOverride', {
    width,
    height,
    deviceScaleFactor: 1,
    mobile,
    screenWidth: width,
    screenHeight: height,
    positionX: 0,
    positionY: 0,
    dontSetVisibleSize: false
  });
  await client.send('Emulation.setTouchEmulationEnabled', {
    enabled: mobile,
    maxTouchPoints: mobile ? 5 : 1
  });
  await client.send('Page.reload', { ignoreCache: true });
  await waitForExpression(
    client,
    `(() => {
      if (performance.timeOrigin === ${JSON.stringify(previousTimeOrigin)} || !window.__theysingVisualQa?.ready) return false;
      const canvas = document.querySelector('canvas');
      const scene = document.querySelector('[data-role="scene"]');
      if (!canvas || !scene) return false;
      const canvasRect = canvas.getBoundingClientRect();
      const sceneRect = scene.getBoundingClientRect();
      return Math.abs(canvasRect.width - sceneRect.width) <= 2
        && Math.abs(canvasRect.height - sceneRect.height) <= 2
        && Math.abs(sceneRect.width - innerWidth) <= 2
        && Math.abs(sceneRect.height - innerHeight) <= 2;
    })()`,
    15_000,
    `${width}x${height} canvas resize`
  );
  await injectDeterministicStyles(client);
  await settle(client);
}

async function resetCamera(client) {
  await evaluate(client, `(() => {
    const button = document.querySelector('[data-role="reset-camera"]');
    if (!button) return false;
    button.click();
    return true;
  })()`);
  await settle(client);
}

async function resetScrollPositions(client) {
  await evaluate(client, `(() => {
    for (const element of document.querySelectorAll('.obs-evidence-section, .obs-transcript, .obs-moves, .obs-eval-claims, .obs-detail')) {
      element.scrollTop = 0;
      element.scrollLeft = 0;
    }
    return true;
  })()`);
  await settle(client);
}

async function setView(client, mode) {
  await evaluate(client, `(() => {
    const button = document.querySelector('[data-view-mode=${JSON.stringify(mode)}]');
    if (!button) return false;
    button.click();
    return true;
  })()`);
  await waitForExpression(client, `document.querySelector('.obs-shell')?.classList.contains('obs-view-${mode}')`, 5_000, `${mode} view`);
  await settle(client);
}

async function setEvidenceTab(client, tab) {
  await evaluate(client, `(() => {
    const button = document.querySelector('[data-evidence-tab=${JSON.stringify(tab)}]');
    if (!button) return false;
    button.click();
    return true;
  })()`);
  await waitForExpression(client, `document.querySelector('[data-evidence-tab=${JSON.stringify(tab)}]')?.getAttribute('aria-selected') === 'true'`, 5_000, `${tab} evidence tab`);
  await settle(client);
}

async function openEvidenceDetail(client) {
  await setView(client, 'evidence');
  await setEvidenceTab(client, 'now');
  const focusLifecycle = await evaluate(client, `(() => {
    const candidates = [
      '[data-role="events"] button',
      '[data-role="diffs"] button',
      '[data-role="moments"] button',
      '[data-role="board-state"] button'
    ];
    const selector = candidates.find((candidate) => document.querySelector(candidate));
    const trigger = selector ? document.querySelector(selector) : null;
    if (!trigger) return { opened: false, reason: 'No evidence trigger found' };
    trigger.dataset.visualQaTrigger = 'true';
    trigger.focus();
    const beforeOpen = describeFocus(document.activeElement);
    trigger.click();
    return {
      opened: true,
      triggerSelector: selector,
      beforeOpen,
      afterOpen: describeFocus(document.activeElement)
    };

    function describeFocus(element) {
      if (!element) return null;
      return {
        tag: element.tagName,
        text: (element.textContent || '').trim().replace(/\\s+/g, ' ').slice(0, 100),
        role: element.getAttribute('role'),
        dataRole: element.getAttribute('data-role'),
        ariaLabel: element.getAttribute('aria-label')
      };
    }
  })()`);
  if (!focusLifecycle.opened) throw new Error(focusLifecycle.reason);
  await waitForExpression(client, `document.querySelector('[data-role="detail"]')?.classList.contains('obs-detail-open')`, 5_000, 'Selected Evidence detail');
  await settle(client);
  focusLifecycle.afterOpen = await describeActiveElement(client);
  return focusLifecycle;
}

async function dismissEvidenceDetail(client) {
  await client.send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27 });
  await client.send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27 });
  await waitForExpression(client, `document.querySelector('[data-role="detail"]')?.getAttribute('aria-hidden') === 'true'`, 5_000, 'Selected Evidence dismissal');
  await settle(client);
  return describeActiveElement(client);
}

async function describeActiveElement(client) {
  return evaluate(client, `(() => {
    const element = document.activeElement;
    if (!element) return null;
    return {
      tag: element.tagName,
      text: (element.textContent || '').trim().replace(/\\s+/g, ' ').slice(0, 100),
      role: element.getAttribute('role'),
      dataRole: element.getAttribute('data-role'),
      ariaLabel: element.getAttribute('aria-label'),
      visualQaTrigger: element.dataset?.visualQaTrigger === 'true'
    };
  })()`);
}

async function captureState(client, outputDir, name, width, height, extra = {}) {
  await settle(client);
  const screenshot = await client.send('Page.captureScreenshot', {
    format: 'png',
    fromSurface: true,
    captureBeyondViewport: false
  });
  const filename = `${name}.png`;
  const screenshotPath = path.join(outputDir, filename);
  const bytes = Buffer.from(screenshot.data, 'base64');
  fs.writeFileSync(screenshotPath, bytes);
  const layout = await collectLayoutReceipt(client);
  return {
    name,
    screenshot: filename,
    screenshotBytes: bytes.length,
    viewport: { width, height },
    ...extra,
    layout
  };
}

async function collectLayoutReceipt(client) {
  return evaluate(client, `(() => {
    const root = document.querySelector('.obs-shell');
    const selectors = {
      topbar: '.obs-topbar',
      beat: '[data-role="beat"]',
      evaluation: '[data-role="evaluation"]',
      evidence: '.obs-left',
      diary: '.obs-right',
      detail: '[data-role="detail"]',
      footer: '.obs-bottom',
      scene: '[data-role="scene"]'
    };
    const rendered = (element) => {
      if (!element) return false;
      const style = getComputedStyle(element);
      const rect = element.getBoundingClientRect();
      return style.display !== 'none'
        && style.visibility !== 'hidden'
        && Number(style.opacity) !== 0
        && !style.clipPath.includes('inset(50%')
        && rect.width > 0
        && rect.height > 0;
    };
    const visible = (element) => {
      if (!rendered(element)) return false;
      let bounds = element.getBoundingClientRect();
      let left = Math.max(0, bounds.left);
      let top = Math.max(0, bounds.top);
      let right = Math.min(innerWidth, bounds.right);
      let bottom = Math.min(innerHeight, bounds.bottom);
      for (let ancestor = element.parentElement; ancestor && ancestor !== document.body; ancestor = ancestor.parentElement) {
        const style = getComputedStyle(ancestor);
        if (!/(auto|scroll|hidden|clip)/.test(style.overflowX + ' ' + style.overflowY)) continue;
        bounds = ancestor.getBoundingClientRect();
        left = Math.max(left, bounds.left);
        top = Math.max(top, bounds.top);
        right = Math.min(right, bounds.right);
        bottom = Math.min(bottom, bounds.bottom);
      }
      return right - left > 1 && bottom - top > 1;
    };
    const rectOf = (element) => {
      const rect = element.getBoundingClientRect();
      return {
        x: round(rect.x), y: round(rect.y), width: round(rect.width), height: round(rect.height),
        right: round(rect.right), bottom: round(rect.bottom)
      };
    };
    const panels = {};
    for (const [name, selector] of Object.entries(selectors)) {
      const element = document.querySelector(selector);
      panels[name] = { visible: visible(element), rect: element ? rectOf(element) : null };
    }
    const collisions = [];
    const entries = Object.entries(panels).filter(([name, panel]) => name !== 'scene' && panel.visible && panel.rect);
    for (let leftIndex = 0; leftIndex < entries.length; leftIndex += 1) {
      for (let rightIndex = leftIndex + 1; rightIndex < entries.length; rightIndex += 1) {
        const [leftName, left] = entries[leftIndex];
        const [rightName, right] = entries[rightIndex];
        if (leftName === 'evidence' && rightName === 'detail') continue;
        const width = Math.max(0, Math.min(left.rect.right, right.rect.right) - Math.max(left.rect.x, right.rect.x));
        const height = Math.max(0, Math.min(left.rect.bottom, right.rect.bottom) - Math.max(left.rect.y, right.rect.y));
        if (width > 1 && height > 1) collisions.push({ left: leftName, right: rightName, width: round(width), height: round(height) });
      }
    }
    const interactives = Array.from(document.querySelectorAll('button, input, select, textarea, a[href], [role="button"], [role="tab"]')).filter(visible);
    const measuredTargets = interactives.map((element) => ({
      label: controlLabel(element),
      rect: rectOf(element)
    }));
    const smallTargets = measuredTargets.filter((entry) => entry.rect.width < 24 || entry.rect.height < 24);
    const compactTargets = measuredTargets.filter((entry) => entry.rect.width < 44 || entry.rect.height < 44);
    const offViewportControls = interactives.map((element) => ({
      label: controlLabel(element),
      rect: rectOf(element)
    })).filter((entry) => entry.rect.right < 0 || entry.rect.bottom < 0 || entry.rect.x > innerWidth || entry.rect.y > innerHeight);
    const clippedText = Array.from(document.querySelectorAll('.obs-shell *')).filter((element) => {
      if (!visible(element) || element.children.length > 0) return false;
      const style = getComputedStyle(element);
      const clipsX = element.scrollWidth > element.clientWidth + 2 && ['hidden', 'clip'].includes(style.overflowX);
      const clipsY = element.scrollHeight > element.clientHeight + 2 && ['hidden', 'clip'].includes(style.overflowY);
      return clipsX || clipsY;
    }).slice(0, 30).map((element) => ({
      tag: element.tagName,
      className: String(element.className || '').slice(0, 100),
      text: (element.textContent || '').trim().replace(/\\s+/g, ' ').slice(0, 120),
      client: { width: element.clientWidth, height: element.clientHeight },
      scroll: { width: element.scrollWidth, height: element.scrollHeight }
    }));
    const canvas = document.querySelector('canvas');
    const detail = document.querySelector('[data-role="detail"]');
    return {
      title: document.title,
      viewClass: root?.className || '',
      turn: document.querySelector('[data-role="turn"]')?.textContent || '',
      phase: document.querySelector('[data-role="phase"]')?.textContent || '',
      viewport: { width: innerWidth, height: innerHeight, devicePixelRatio },
      documentExtent: {
        width: document.documentElement.scrollWidth,
        height: document.documentElement.scrollHeight,
        horizontalOverflow: Math.max(0, document.documentElement.scrollWidth - innerWidth),
        verticalOverflow: Math.max(0, document.documentElement.scrollHeight - innerHeight)
      },
      panels,
      collisions,
      interactiveCount: interactives.length,
      smallTargets,
      compactTargets,
      offViewportControls,
      clippedText,
      focus: describeFocus(document.activeElement),
      detail: detail ? {
        open: detail.classList.contains('obs-detail-open'),
        ariaHidden: detail.getAttribute('aria-hidden'),
        role: detail.getAttribute('role'),
        labelledBy: detail.getAttribute('aria-labelledby')
      } : null,
      canvas: canvas ? {
        css: rectOf(canvas),
        buffer: { width: canvas.width, height: canvas.height }
      } : null
    };

    function controlLabel(element) {
      return element.getAttribute('aria-label') || element.textContent?.trim().replace(/\\s+/g, ' ').slice(0, 80) || element.getAttribute('data-role') || element.tagName;
    }
    function describeFocus(element) {
      if (!element) return null;
      return {
        tag: element.tagName,
        label: controlLabel(element),
        role: element.getAttribute('role'),
        dataRole: element.getAttribute('data-role')
      };
    }
    function round(value) { return Math.round(value * 10) / 10; }
  })()`);
}

function summarizeStates(states, runtimeFindings) {
  const warnings = [];
  for (const state of states) {
    const layout = state.layout;
    if (layout.documentExtent.horizontalOverflow > 1) warnings.push(`${state.name}: horizontal document overflow ${layout.documentExtent.horizontalOverflow}px`);
    if (layout.canvas && (Math.abs(layout.canvas.css.width - state.viewport.width) > 2 || Math.abs(layout.canvas.css.height - state.viewport.height) > 2)) {
      warnings.push(`${state.name}: Three.js canvas ${layout.canvas.css.width}x${layout.canvas.css.height} does not match viewport ${state.viewport.width}x${state.viewport.height}`);
    }
    if (layout.offViewportControls.length > 0) warnings.push(`${state.name}: ${layout.offViewportControls.length} visible controls outside the viewport`);
    if (layout.collisions.length > 0) warnings.push(`${state.name}: ${layout.collisions.length} major panel overlaps`);
    if (layout.clippedText.length > 0) warnings.push(`${state.name}: ${layout.clippedText.length} clipped text nodes`);
    if (state.viewport.width <= 500 && layout.smallTargets.length > 0) warnings.push(`${state.name}: ${layout.smallTargets.length} controls below 24px minimum touch size`);
  }
  if (runtimeFindings.consoleErrors.length > 0) warnings.push(`${runtimeFindings.consoleErrors.length} console errors`);
  if (runtimeFindings.exceptions.length > 0) warnings.push(`${runtimeFindings.exceptions.length} runtime exceptions`);
  if (runtimeFindings.networkFailures.length > 0) warnings.push(`${runtimeFindings.networkFailures.length} network failures`);
  return {
    stateCount: states.length,
    screenshotBytes: states.reduce((sum, state) => sum + state.screenshotBytes, 0),
    warningCount: warnings.length,
    warnings
  };
}

function renderReport(manifest) {
  const lines = [
    '# They Sing Visual Capture',
    '',
    `- Captured: ${manifest.capturedAt}`,
    `- URL: ${manifest.url}`,
    `- Browser: ${manifest.browser.product}`,
    `- Replay stress phase: index ${manifest.replayProbe.densestIndex}, turn ${manifest.replayProbe.turn}, ${manifest.replayProbe.phase}, ${manifest.replayProbe.densestSignals} scene signals`,
    `- Protocol phase: index ${manifest.replayProbe.protocolIndex}, turn ${manifest.replayProbe.protocolTurn}, ${manifest.replayProbe.protocolPhase}, ${manifest.replayProbe.protocolRecords} records`,
    `- Diary phase: index ${manifest.replayProbe.diaryIndex}, turn ${manifest.replayProbe.diaryTurn}, ${manifest.replayProbe.diaryPhase}, ${manifest.replayProbe.diaryRecords} messages/diaries`,
    `- Screenshots: ${manifest.summary.stateCount}`,
    `- Automated warnings: ${manifest.summary.warningCount}`,
    '',
    '## States',
    '',
    '| State | Viewport | Horizontal overflow | Panel overlaps | Clipped text | Under 24px targets | Compact targets | Screenshot |',
    '| --- | ---: | ---: | ---: | ---: | ---: | ---: | --- |'
  ];
  for (const state of manifest.states) {
    lines.push(`| ${state.name} | ${state.viewport.width}x${state.viewport.height} | ${state.layout.documentExtent.horizontalOverflow}px | ${state.layout.collisions.length} | ${state.layout.clippedText.length} | ${state.layout.smallTargets.length} | ${state.layout.compactTargets.length} | [PNG](${state.screenshot}) |`);
  }
  lines.push('', '## Warnings', '');
  if (manifest.summary.warnings.length === 0) lines.push('- None from automated geometry/runtime checks.');
  else for (const warning of manifest.summary.warnings) lines.push(`- ${warning}`);
  lines.push('', '## Runtime', '');
  lines.push(`- Console errors: ${manifest.runtimeFindings.consoleErrors.length}`);
  lines.push(`- Runtime exceptions: ${manifest.runtimeFindings.exceptions.length}`);
  lines.push(`- Network failures: ${manifest.runtimeFindings.networkFailures.length}`);
  lines.push('');
  return `${lines.join('\n')}\n`;
}

async function settle(client) {
  await delay(450);
  await client.send('Runtime.evaluate', { expression: 'new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)))', awaitPromise: true });
}

async function stopBrowser(browser) {
  if (browser.exitCode !== null) return;
  if (process.platform === 'win32' && browser.pid) {
    await new Promise((resolve) => {
      const killer = spawn('taskkill', ['/PID', String(browser.pid), '/T', '/F'], {
        stdio: 'ignore',
        windowsHide: true
      });
      const timer = setTimeout(() => {
        killer.kill();
        resolve();
      }, 3_000);
      killer.once('exit', () => {
        clearTimeout(timer);
        resolve();
      });
      killer.once('error', () => {
        clearTimeout(timer);
        resolve();
      });
    });
    await delay(300);
    return;
  }
  browser.kill();
  await Promise.race([
    new Promise((resolve) => browser.once('exit', resolve)),
    delay(3_000).then(() => {
      if (browser.exitCode === null) browser.kill('SIGKILL');
    })
  ]);
}

async function removeDirectoryWithRetry(directoryPath, attempts = 8) {
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    try {
      fs.rmSync(directoryPath, { recursive: true, force: true });
      return;
    } catch (error) {
      if (!['EBUSY', 'ENOTEMPTY', 'EPERM'].includes(error.code) || attempt === attempts - 1) throw error;
      await delay(250 * (attempt + 1));
    }
  }
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
