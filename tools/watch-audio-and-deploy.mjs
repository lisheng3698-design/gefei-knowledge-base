#!/usr/bin/env node
import { closeSync, existsSync, openSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { execFileSync, spawn, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
const INTERVAL_MS = Number(arg('--interval-ms', '300000'));
const ONCE = hasArg('--once');
const DRY_RUN = hasArg('--dry-run');
const MODEL_SIZE = arg('--model-size', '0.6B');
const SITE_URL = arg('--site-url', process.env.SITE_URL || process.env.PUBLIC_SITE_URL || '').replace(/\/$/, '');
const STATUS_PATH = join(ROOT, 'audio-deploy-watch-status.json');
const AUDIO_LOG_PATH = join(ROOT, 'voicebox-audio-generation.log');
const DEPLOY_FILES = [
  '.gitignore',
  '.netlifyignore',
  '.nojekyll',
  'app-icon.svg',
  'app.js',
  'assets',
  'audio-manifest.js',
  'audio/voicebox-mandarin-male',
  'index.html',
  'kb-data.js',
  'learning-path.js',
  'manifest.webmanifest',
  'service-worker.js',
  'styles.css',
  'tools/generate-voicebox-audio.mjs',
  'tools/watch-audio-and-deploy.mjs',
  '哥飞-知识点提炼.md'
];

function hasArg(name) {
  return process.argv.includes(name);
}

function arg(name, fallback = '') {
  const index = process.argv.indexOf(name);
  if (index === -1 || index + 1 >= process.argv.length) return fallback;
  return process.argv[index + 1];
}

function loadWindowFile(fileName, globalName, fallback) {
  const code = readFileSync(join(ROOT, fileName), 'utf8');
  const context = { window: {} };
  vm.createContext(context);
  vm.runInContext(code, context);
  return context.window[globalName] || fallback;
}

function runGit(args, options = {}) {
  return execFileSync('git', args, {
    cwd: ROOT,
    encoding: 'utf8',
    env: { ...process.env, GIT_TERMINAL_PROMPT: '0' },
    ...options
  }).trim();
}

function commandOk(command, args) {
  const result = spawnSync(command, args, { cwd: ROOT, stdio: 'ignore', env: { ...process.env, GIT_TERMINAL_PROMPT: '0' } });
  return result.status === 0;
}

function processIsRunning(marker) {
  try {
    const output = execFileSync('ps', ['-axo', 'command='], { cwd: ROOT, encoding: 'utf8' });
    return output.split('\n').some(line => line.includes(marker) && !line.includes('watch-audio-and-deploy.mjs'));
  } catch {
    return false;
  }
}

function currentState() {
  const data = loadWindowFile('kb-data.js', 'KB_DATA', { items: [] });
  const manifest = loadWindowFile('audio-manifest.js', 'KB_AUDIO_MANIFEST', { items: {} });
  const items = data.items || [];
  const itemIds = new Set(items.map(item => item.id));
  const audioIds = Object.keys(manifest.items || {}).filter(id => itemIds.has(id));
  const missing = items.filter(item => !manifest.items?.[item.id]).map(item => item.id);
  const firstMissingIndex = items.findIndex(item => !manifest.items?.[item.id]);
  const missingFiles = audioIds
    .map(id => manifest.items[id]?.src)
    .filter(Boolean)
    .filter(src => !existsSync(join(ROOT, src)));
  return {
    total: items.length,
    generated: audioIds.length,
    missing,
    missingFiles,
    firstMissingIndex,
    complete: items.length > 0 && missing.length === 0 && missingFiles.length === 0,
    manifestGeneratedAt: manifest.generatedAt || '',
    checkedAt: new Date().toISOString()
  };
}

function writeStatus(state, extra = {}) {
  writeFileSync(STATUS_PATH, `${JSON.stringify({ ...state, ...extra }, null, 2)}\n`);
}

function verifyBeforeDeploy() {
  execFileSync('node', ['--check', 'app.js'], { cwd: ROOT, stdio: 'inherit' });
  const state = currentState();
  if (!state.complete) {
    throw new Error(`音频还未全部生成：${state.generated}/${state.total}`);
  }
}

function stageDeployFiles() {
  const files = DEPLOY_FILES.filter(file => existsSync(join(ROOT, file)));
  runGit(['add', ...files], { stdio: 'inherit' });
}

function appendAudioLog(message) {
  writeFileSync(AUDIO_LOG_PATH, `${message}\n`, { flag: 'a' });
}

function ensureGenerationRunning(state) {
  if (state.complete || processIsRunning('generate-voicebox-audio.mjs')) return null;
  if (!state.missing.length) return null;
  const logFd = openSync(AUDIO_LOG_PATH, 'a');
  appendAudioLog(`[${new Date().toISOString()}] 监控发现生成进程未运行，从 ${state.missing[0]} 继续生成。`);
  const child = spawn(process.execPath, [
    'tools/generate-voicebox-audio.mjs',
    '--ids',
    state.missing.join(','),
    '--model-size',
    MODEL_SIZE
  ], {
    cwd: ROOT,
    detached: true,
    stdio: ['ignore', logFd, logFd]
  });
  child.unref();
  closeSync(logFd);
  return child.pid;
}

async function fetchText(url) {
  const response = await fetch(url, { cache: 'no-store' });
  if (!response.ok) throw new Error(`${url} 返回 ${response.status}`);
  return response.text();
}

function parseOnlineManifest(code) {
  const context = { window: {} };
  vm.createContext(context);
  vm.runInContext(code, context);
  return context.window.KB_AUDIO_MANIFEST || { items: {} };
}

async function verifyOnline(state) {
  if (!SITE_URL) return { skipped: true, reason: '未配置 SITE_URL，已完成推送但未做线上页面验证。' };
  const deadline = Date.now() + 10 * 60 * 1000;
  let lastError = '';
  while (Date.now() < deadline) {
    try {
      const html = await fetchText(`${SITE_URL}/`);
      if (!html.includes('哥飞知识点全文库')) throw new Error('首页标题未匹配');
      if (html.includes('voiceModal') || html.includes('readerVoiceButton')) throw new Error('线上首页仍包含旧语音设置入口');
      const manifest = parseOnlineManifest(await fetchText(`${SITE_URL}/audio-manifest.js`));
      const audioCount = Object.keys(manifest.items || {}).length;
      if (audioCount !== state.total) throw new Error(`线上音频清单仍是 ${audioCount}/${state.total}`);
      return { skipped: false, ok: true, siteUrl: SITE_URL, audioCount };
    } catch (error) {
      lastError = String(error?.message || error);
      await new Promise(resolve => setTimeout(resolve, 30000));
    }
  }
  throw new Error(`线上验证未通过：${lastError}`);
}

async function deployWhenComplete(state) {
  verifyBeforeDeploy();
  stageDeployFiles();
  const staged = runGit(['diff', '--cached', '--name-only']);
  if (!staged) {
    writeStatus(state, { deployed: true, deployMessage: '没有新的变更需要上线。' });
    return;
  }
  const message = `Update generated article audio (${state.generated}/${state.total})`;
  runGit(['commit', '-m', message], { stdio: 'inherit' });
  runGit(['-c', 'http.version=HTTP/1.1', '-c', 'http.lowSpeedLimit=1', '-c', 'http.lowSpeedTime=10', 'push', 'origin', 'main'], { stdio: 'inherit' });
  const commit = runGit(['rev-parse', '--short', 'HEAD']);
  const online = await verifyOnline(state);
  writeStatus(state, { deployed: true, commit, deployMessage: message, online });
}

async function main() {
  for (;;) {
    const state = currentState();
    writeStatus(state, { deployed: false });
    console.log(`[${state.checkedAt}] 音频进度 ${state.generated}/${state.total}，缺失 ${state.missing.length}`);
    if (state.complete) {
      if (DRY_RUN) {
        console.log('音频已全部生成。dry-run 模式不提交上线。');
        writeStatus(state, { deployed: false, dryRun: true });
        return;
      }
      try {
        if (!commandOk('git', ['ls-remote', '--heads', 'origin', 'main'])) {
          throw new Error('无法访问 GitHub origin/main。将继续重试自动上线。');
        }
        await deployWhenComplete(state);
        console.log('音频已全部生成并已推送上线。');
        return;
      } catch (error) {
        console.error(error);
        writeStatus(state, {
          deployed: false,
          deployRetry: true,
          error: String(error?.message || error),
          failedAt: new Date().toISOString()
        });
        if (ONCE) throw error;
      }
    } else {
      const restartedPid = ensureGenerationRunning(state);
      if (restartedPid) {
        console.log(`已自动续跑音频生成进程：${restartedPid}`);
        writeStatus(state, { deployed: false, generationRestarted: true, generationPid: restartedPid });
      }
    }
    if (ONCE) return;
    await new Promise(resolve => setTimeout(resolve, INTERVAL_MS));
  }
}

main().catch(error => {
  const state = existsSync(join(ROOT, 'audio-manifest.js')) ? currentState() : {};
  writeStatus(state, { deployed: false, error: String(error?.message || error), failedAt: new Date().toISOString() });
  console.error(error);
  process.exit(1);
});
