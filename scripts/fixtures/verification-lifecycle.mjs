import childProcess from 'node:child_process';
import { EventEmitter } from 'node:events';
import fs from 'node:fs';
import { syncBuiltinESMExports } from 'node:module';
import net from 'node:net';
import { dirname, join } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright-core';

const directory = process.env.LIFECYCLE_FIXTURE_DIR;
const scenario = process.env.LIFECYCLE_FIXTURE;
const mark = (name, value = {}) =>
  fs.writeFileSync(
    join(directory, `${name}.json`),
    JSON.stringify({ pid: process.pid, ...value }),
  );
const gate = async (name) => {
  while (!fs.existsSync(join(directory, name))) await delay(10);
};
if (directory) {
  if (
    scenario === 'repeat-signals' &&
    /(?:control-probability|verify-journeys|probability)\.mjs$/.test(
      process.argv[1] ?? '',
    )
  ) {
    for (const signal of ['SIGINT', 'SIGTERM'])
      process.on(signal, () =>
        fs.appendFileSync(
          join(directory, `signals-${process.pid}.txt`),
          `${signal}\n`,
        ),
      );
  }
  const rename = fs.renameSync;
  fs.renameSync = (from, to) => {
    if (String(to).endsWith('/result.json'))
      fs.appendFileSync(join(directory, 'receipts.txt'), `${to}\n`);
    return rename(from, to);
  };
}
if (
  directory &&
  process.argv[1]?.endsWith('/serve-probability.mjs') &&
  !scenario.startsWith('real-')
) {
  process.removeAllListeners('SIGINT');
  process.removeAllListeners('SIGTERM');
  if (scenario === 'stop-refuse')
    fs.appendFileSync(
      join(directory, 'servers.jsonl'),
      `${JSON.stringify({ pid: process.pid, args: process.argv })}\n`,
    );
  mark('server', { args: process.argv });
  console.log('owned fixture server');
  if (
    ['resist-term', 'stop-esrch-kill', 'stop-eperm', 'public-stop'].includes(
      scenario,
    )
  )
    process.on('SIGTERM', () => mark('server-term'));
  setInterval(() => {}, 1000);
  await new Promise(() => {});
}
if (
  directory &&
  ['stop-esrch-term', 'stop-esrch-kill', 'stop-eperm'].includes(scenario) &&
  process.argv[1]?.endsWith('/control-probability.mjs') &&
  process.argv[2] === 'stop'
) {
  const kill = process.kill.bind(process);
  process.kill = (pid, signal) => {
    const target = scenario === 'stop-esrch-kill' ? 'SIGKILL' : 'SIGTERM';
    if (pid >= 0 || signal !== target) return kill(pid, signal);
    if (scenario === 'stop-eperm') {
      mark('signal-error', { group: -pid, signal, code: 'EPERM' });
      throw Object.assign(new Error('injected kill EPERM'), { code: 'EPERM' });
    }
    kill(pid, 'SIGKILL');
    const end = Date.now() + 3000;
    for (;;) {
      try {
        kill(pid, 0);
      } catch (error) {
        if (error.code !== 'ESRCH') throw error;
        break;
      }
      if (Date.now() > end)
        throw new Error('fixture group did not disappear before ESRCH');
      Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 10);
    }
    mark('signal-error', {
      group: -pid,
      signal,
      code: 'ESRCH',
      kernelGroupAbsent: true,
    });
    return kill(pid, signal);
  };
}
if (directory && !scenario.startsWith('real-')) {
  const built = fileURLToPath(
    new URL('../../dist/server/wrangler.json', import.meta.url),
  );
  const exists = fs.existsSync;
  const read = fs.readFileSync;
  fs.existsSync = (path) => String(path) === built || exists(path);
  fs.readFileSync = (path, ...options) => {
    if (String(path) === built)
      return JSON.stringify({
        name: 'lifecycle-fixture',
        compatibility_date: '2026-10-24',
        d1_databases:
          scenario === 'migration-gate' ? [{ binding: 'FIXTURE_DB' }] : [],
      });
    if (
      scenario === 'stop-refuse' &&
      process.argv[2] === 'stop' &&
      String(path).endsWith('/state.json') &&
      !exists(join(directory, 'refused.json'))
    ) {
      const state = JSON.parse(read(path, 'utf8'));
      mark('refused', { state, dataDir: dirname(String(path)) });
      return JSON.stringify({
        ...state,
        token: '00000000-0000-0000-0000-000000000000',
      });
    }
    return read(path, ...options);
  };
  const spawn = childProcess.spawn;
  childProcess.spawn = (file, args, options) => {
    const child = spawn(file, args, options);
    if (args?.[0]?.endsWith('/serve-probability.mjs'))
      mark('server-process', { serverPid: child.pid, args });
    return child;
  };
}
if (directory && scenario === 'close-reject') {
  chromium.launch = async () => ({
    close: async () => {
      throw new Error('injected browser close failure');
    },
  });
  const spawn = childProcess.spawn;
  childProcess.spawn = (file, args, options) => {
    if (!args?.[0]?.endsWith('/control-probability.mjs'))
      return spawn(file, args, options);
    const child = new EventEmitter();
    child.stdout = new EventEmitter();
    child.stderr = new EventEmitter();
    process.nextTick(() => {
      const status = args[1] === 'launch' ? 1 : 0;
      child.stderr.emit(
        'data',
        Buffer.from(
          status ? 'injected earlier launch failure' : 'fixture stopped',
        ),
      );
      child.emit('exit', status, null);
      child.emit('close', status, null);
    });
    return child;
  };
}
if (directory && scenario === 'port-gate') {
  const createServer = net.createServer;
  net.createServer = (...args) => {
    const server = createServer(...args);
    const listen = server.listen;
    let cancelled = false;
    const close = server.close;
    server.close = (callback) => {
      cancelled = true;
      if (server.listening) return close.call(server, callback);
      callback?.();
      return server;
    };
    server.listen = (...options) => {
      mark('port');
      void gate('release-port').then(() => {
        if (!cancelled) listen.apply(server, options);
      });
      return server;
    };
    return server;
  };
}
if (directory && scenario === 'state-fail') {
  const write = fs.writeFileSync;
  fs.writeFileSync = (path, ...args) => {
    if (String(path).endsWith('/state.json'))
      throw new Error('injected state publication failure');
    return write(path, ...args);
  };
}
if (directory && scenario === 'migration-gate') {
  const spawn = childProcess.spawn;
  childProcess.spawn = (file, args, options) => {
    if (args?.includes('migrations') && args?.includes('apply')) {
      return spawn(
        file,
        [
          '-e',
          `require('node:fs').writeFileSync(${JSON.stringify(join(directory, 'migration.json'))}, JSON.stringify({pid:process.pid}));setInterval(()=>{},1000)`,
        ],
        options,
      );
    }
    return spawn(file, args, options);
  };
}
if (directory && !scenario.startsWith('real-')) {
  globalThis.fetch = async (_url, options) => {
    if (scenario === 'readiness-gate') {
      mark('readiness');
      const timer = setInterval(() => {}, 1000);
      await new Promise((_, reject) =>
        options.signal.addEventListener(
          'abort',
          () => {
            clearInterval(timer);
            reject(options.signal.reason);
          },
          { once: true },
        ),
      );
    }
    return new Response('Probability', { status: 200 });
  };
  if (scenario !== 'close-reject')
    chromium.launch = async () => {
      const keepAlive = setInterval(() => {}, 1000);
      mark('browser', { args: process.argv });
      if (scenario === 'late-browser') await gate('release-browser');
      return {
        newPage: async () => {
          mark('ui');
          await new Promise(() => {});
        },
        close: async () => {
          fs.appendFileSync(join(directory, 'closes.txt'), 'close\n');
          if (scenario === 'repeat-signals') {
            mark('closing');
            await gate('release-close');
          }
          clearInterval(keepAlive);
        },
      };
    };
}
if (directory && scenario.startsWith('real-')) {
  const spawn = childProcess.spawn;
  childProcess.spawn = (file, args, options) => {
    const child = spawn(file, args, options);
    if (args?.includes('--remote-debugging-pipe'))
      mark('browser-process', { browserPid: child.pid, args });
    if (args?.[0]?.endsWith('/serve-probability.mjs'))
      mark('server-process', { serverPid: child.pid, args });
    return child;
  };
  const launch = chromium.launch.bind(chromium);
  chromium.launch = async (options) => {
    const browser = await launch(options);
    mark('browser', { args: process.argv });
    const close = browser.close.bind(browser);
    browser.close = async () => {
      fs.appendFileSync(join(directory, 'closes.txt'), 'close\n');
      if (scenario === 'real-stall-close') {
        mark('closing');
        await new Promise(() => {});
      }
      return close();
    };
    if (scenario === 'real-late-browser') await gate('release-browser');
    const holdPage = (page) => {
      const goto = page.goto.bind(page);
      page.goto = async (...args) => {
        const result = await goto(...args);
        mark('active', { url: page.url() });
        await new Promise(() => {});
        return result;
      };
      return page;
    };
    const page = browser.newPage.bind(browser);
    browser.newPage = async (...args) => holdPage(await page(...args));
    const context = browser.newContext.bind(browser);
    browser.newContext = async (...args) => {
      const acquired = await context(...args);
      const page = acquired.newPage.bind(acquired);
      acquired.newPage = async (...args) => holdPage(await page(...args));
      return acquired;
    };
    return browser;
  };
}
if (directory && scenario === 'stop-refuse') {
  const page = () => ({
    on() {},
    goto: async () => {
      throw new Error('injected journey action failure');
    },
    locator() {
      throw new Error('inert capture unavailable');
    },
    close: async () => {},
  });
  chromium.launch = async () => ({
    newContext: async () => ({
      newPage: async () => page(),
      close: async () => {},
    }),
    newPage: async () => page(),
    close: async () => {},
  });
}
syncBuiltinESMExports();

if (
  directory &&
  ['layer-gate', 'early-leader', 'parent-loss'].includes(scenario)
) {
  const spawn = childProcess.spawn;
  childProcess.spawn = (file, args, options) => {
    if (file !== 'npm') return spawn(file, args, options);
    const selected = process.env.LIFECYCLE_LAYER ?? 'source';
    const layer =
      args[1] === 'verify:source'
        ? 'source'
        : args[1] === 'verify:browser'
          ? 'browser'
          : 'build';
    const hold = scenario !== 'layer-gate' || selected === layer;
    const code = hold
      ? `
      const fs=require('node:fs'), cp=require('node:child_process');
      const dir=${JSON.stringify(directory)}, layer=${JSON.stringify(layer)};
      fs.appendFileSync(dir+'/layers.txt',layer+'\\n');
      console.log('layer '+layer+' started');
      if (${JSON.stringify(scenario)} === 'early-leader') {
        const child=cp.spawn(process.execPath,['-e',\`const fs=require('node:fs');fs.writeFileSync(\\\`\${dir}/leaf.json\\\`,JSON.stringify({pid:process.pid}));const timer=setInterval(()=>{if(fs.existsSync(\\\`\${dir}/release-leaf\\\`))process.exit(0)},10)\`],{stdio:'ignore'});
        child.unref();process.exit(0);
      } else {
        fs.writeFileSync(dir+'/layer.json',JSON.stringify({pid:process.pid}));
        setInterval(()=>{},1000);
      }
    `
      : `require('node:fs').appendFileSync(${JSON.stringify(join(directory, 'layers.txt'))},${JSON.stringify(`${layer}\n`)});`;
    return spawn(process.execPath, ['-e', code], options);
  };
}
syncBuiltinESMExports();
