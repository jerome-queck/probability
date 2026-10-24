import childProcess from 'node:child_process';
import { EventEmitter } from 'node:events';
import { appendFileSync, writeFileSync } from 'node:fs';
import { syncBuiltinESMExports } from 'node:module';
import { join } from 'node:path';
import { chromium } from 'playwright-core';

const directory = process.env.LIFECYCLE_FIXTURE_DIR;
const scenario = process.env.LIFECYCLE_FIXTURE;
const mark = (name, value = {}) =>
  writeFileSync(join(directory, `${name}.json`), JSON.stringify({ pid: process.pid, ...value }));
if (directory && process.argv[1]?.endsWith('/serve-probability.mjs')) {
  mark('server', { args: process.argv });
  console.log('owned fixture server');
  setInterval(() => {}, 1000);
  await new Promise(() => {});
}
if (directory && scenario === 'close-reject') {
  chromium.launch = async () => ({ close: async () => { throw new Error('injected browser close failure'); } });
  const spawn = childProcess.spawn;
  childProcess.spawn = (file, args, options) => {
    if (!args?.[0]?.endsWith('/control-probability.mjs')) return spawn(file, args, options);
    const child = new EventEmitter();
    child.stdout = new EventEmitter();
    child.stderr = new EventEmitter();
    process.nextTick(() => {
      const status = args[1] === 'launch' ? 1 : 0;
      child.stderr.emit('data', Buffer.from(status ? 'injected earlier launch failure' : 'fixture stopped'));
      child.emit('exit', status, null);
      child.emit('close', status, null);
    });
    return child;
  };
  syncBuiltinESMExports();
}
if (directory && scenario === 'interrupt') {
  globalThis.fetch = async () => new Response('Probability', { status: 200 });
  chromium.launch = async () => {
    const keepAlive = setInterval(() => {}, 1000);
    mark('browser', { args: process.argv });
    return {
      newPage: async () => new Promise(() => {}),
      close: async () => { clearInterval(keepAlive); appendFileSync(join(directory, 'closes.txt'), 'close\n'); },
    };
  };
}
