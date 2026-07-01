#!/usr/bin/env node
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
const VOICEBOX_URL = getArg('--voicebox-url', 'http://127.0.0.1:17493').replace(/\/$/, '');
const MODEL_SIZE = getArg('--model-size', '0.6B');
const LIMIT = Number(getArg('--limit', '0'));
const START = Number(getArg('--start', '0'));
const FORCE = hasArg('--force');
const DRY_RUN = hasArg('--dry-run');
const OUTPUT_FORMAT = getArg('--format', 'mp3');
const OUTPUT_DIR = join(ROOT, 'audio', 'voicebox-mandarin-male');
const WAV_DIR = getArg('--wav-cache-dir', join(dirname(ROOT), '知识点提炼-voicebox-wav-cache'));
const MANIFEST_PATH = join(ROOT, 'audio-manifest.js');
const PROFILE_NAME = '哥飞知识点普通话男声';
const PROFILE_PROMPT = '一位自然、清晰、有耐心的中文普通话男性讲解者，语速适中，语气温和，适合朗读教程文章。';
const INSTRUCT = '请用自然、清晰、有耐心的中文普通话男声朗读，像教程讲解一样，语速适中，重点处略有停顿。';

function hasArg(name) {
  return process.argv.includes(name);
}

function getArg(name, fallback = '') {
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

function loadManifest() {
  if (!existsSync(MANIFEST_PATH)) {
    return { version: 'voicebox-mandarin-male-v1', generatedAt: '', engine: 'voicebox', voice: '普通话男声', format: OUTPUT_FORMAT, items: {} };
  }
  return loadWindowFile('audio-manifest.js', 'KB_AUDIO_MANIFEST', { items: {} });
}

function saveManifest(manifest) {
  manifest.generatedAt = new Date().toISOString();
  manifest.engine = 'voicebox';
  manifest.voice = '普通话男声';
  manifest.format = OUTPUT_FORMAT;
  writeFileSync(MANIFEST_PATH, `window.KB_AUDIO_MANIFEST = ${JSON.stringify(manifest, null, 2)};\n`);
}

function htmlToText(html) {
  return String(html || '')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<details[\s\S]*?<\/details>/gi, ' ')
    .replace(/<figure[\s\S]*?<\/figure>/gi, ' ')
    .replace(/<figcaption[\s\S]*?<\/figcaption>/gi, ' ')
    .replace(/<img\b[^>]*>/gi, ' ')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|li|h[1-6]|tr|section|article|div|table|ol|ul)>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

function cleanSpeechText(value) {
  return String(value || '')
    .replace(/https?:\/\/[^\s<>"')，。；、]+|www\.[^\s<>"')，。；、]+|[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)+(?:\/[^\s<>"')，。；、]*)?/g, ' ')
    .replace(/来源：\s*/g, ' ')
    .replace(/原文完整长截图|原文完整截图|展开原文完整截图|原始 OCR\/正文摘录|展开原始 OCR\/正文摘录/g, ' ')
    .replace(/配图与截图\s*(?:(?:[^（）\n]{0,90})[（(]\s*\d+\s*[x×]\s*\d+\s*[）)]\s*)+/gi, '这里有配图，可在页面中查看。')
    .replace(/(?:image\.(?:png|jpg|jpeg|webp)|Head Image|图片)\s*[（(]\s*\d+\s*[x×]\s*\d+\s*[）)]/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function speechTextForItem(item, context, learningPath) {
  const sectionById = new Map((learningPath.sections || []).map(section => [section.id, section]));
  const stageById = new Map((learningPath.stages || []).map(stage => [stage.id, stage]));
  const pathSection = sectionById.get(learningPath.itemSection?.[item.id]);
  const pathStage = pathSection ? stageById.get(pathSection.stage) : null;
  const pathText = pathSection ? `上站路径：${pathStage?.title || ''}，${pathSection.title}。` : '';
  const articleText = cleanSpeechText(htmlToText(context?.html || '') || context?.text || item?.text || '');
  const imageCount = context?.imageCount || item?.imageCount || 0;
  const imageText = imageCount ? `本文有 ${imageCount} 张配图，可在页面中查看。` : '';
  return cleanSpeechText(`${item.title}。${pathText}${articleText}。${imageText}`);
}

function textHash(text) {
  return createHash('sha256').update(text).digest('hex').slice(0, 16);
}

async function jsonFetch(url, options = {}) {
  const response = await fetch(url, {
    ...options,
    headers: {
      ...(options.body ? { 'Content-Type': 'application/json' } : {}),
      ...(options.headers || {})
    }
  });
  if (!response.ok) {
    const text = await response.text().catch(() => '');
    throw new Error(`${response.status} ${response.statusText} ${text}`.trim());
  }
  return response.json();
}

function parseStatusPayload(text) {
  const trimmed = String(text || '').trim();
  const dataLine = trimmed.split('\n').find(line => line.startsWith('data: '));
  return JSON.parse((dataLine ? dataLine.slice(6) : trimmed) || '{}');
}

async function statusFetch(id) {
  const response = await fetch(`${VOICEBOX_URL}/generate/${encodeURIComponent(id)}/status`);
  if (!response.ok) throw new Error(`status ${response.status}`);
  return parseStatusPayload(await response.text());
}

async function waitForVoicebox() {
  const health = await jsonFetch(`${VOICEBOX_URL}/health`);
  if (health.status !== 'healthy') throw new Error(`Voicebox health is ${health.status}`);
}

async function ensureProfile() {
  const profiles = await jsonFetch(`${VOICEBOX_URL}/profiles`);
  const existing = profiles.find(profile => profile.name === PROFILE_NAME);
  if (existing) return existing;
  return jsonFetch(`${VOICEBOX_URL}/profiles`, {
    method: 'POST',
    body: JSON.stringify({
      name: PROFILE_NAME,
      description: '哥飞知识点文章播报专用中文普通话男声',
      language: 'zh',
      voice_type: 'designed',
      design_prompt: PROFILE_PROMPT,
      default_engine: 'qwen'
    })
  });
}

async function ensureModelLoaded() {
  const status = await jsonFetch(`${VOICEBOX_URL}/models/status`);
  const target = status.models?.find(model => model.model_name === `qwen-tts-${MODEL_SIZE}`);
  if (target?.loaded) return;
  await jsonFetch(`${VOICEBOX_URL}/models/load?model_size=${encodeURIComponent(MODEL_SIZE)}`, { method: 'POST' });
}

async function generateWav(profileId, item, text, wavPath) {
  const request = await jsonFetch(`${VOICEBOX_URL}/generate`, {
    method: 'POST',
    body: JSON.stringify({
      profile_id: profileId,
      text,
      language: 'zh',
      model_size: MODEL_SIZE,
      engine: 'qwen',
      instruct: INSTRUCT,
      max_chunk_chars: 800,
      normalize: true
    })
  });
  const generationId = request.id;
  for (;;) {
    await new Promise(resolve => setTimeout(resolve, 2500));
    const status = await statusFetch(generationId);
    process.stdout.write(`  ${item.id} ${status.status}${status.duration ? ` ${status.duration}s` : ''}\r`);
    if (status.status === 'completed') break;
    if (status.status === 'failed' || status.error) throw new Error(status.error || `Voicebox generation failed: ${status.status}`);
  }
  process.stdout.write('\n');
  const audioResponse = await fetch(`${VOICEBOX_URL}/audio/${encodeURIComponent(generationId)}`);
  if (!audioResponse.ok) throw new Error(`audio ${audioResponse.status}`);
  writeFileSync(wavPath, Buffer.from(await audioResponse.arrayBuffer()));
  return generationId;
}

function convertAudio(wavPath, outputPath) {
  if (OUTPUT_FORMAT === 'wav') {
    renameSync(wavPath, outputPath);
    return;
  }
  execFileSync('ffmpeg', ['-y', '-hide_banner', '-loglevel', 'error', '-i', wavPath, '-ac', '1', '-codec:a', 'libmp3lame', '-b:a', '48k', outputPath], { stdio: 'inherit' });
}

function audioDurationSeconds(filePath) {
  try {
    const output = execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'default=nw=1:nk=1', filePath], { encoding: 'utf8' });
    return Math.round(Number(output.trim()) * 100) / 100;
  } catch {
    return null;
  }
}

async function main() {
  const data = loadWindowFile('kb-data.js', 'KB_DATA', { items: [], contexts: [] });
  const learningPath = existsSync(join(ROOT, 'learning-path.js'))
    ? loadWindowFile('learning-path.js', 'KB_LEARNING_PATH', { sections: [], stages: [], itemSection: {} })
    : { sections: [], stages: [], itemSection: {} };
  const manifest = loadManifest();
  manifest.items ||= {};
  mkdirSync(OUTPUT_DIR, { recursive: true });
  mkdirSync(WAV_DIR, { recursive: true });

  const itemIds = new Set(String(getArg('--ids', '')).split(',').map(x => x.trim()).filter(Boolean));
  let items = data.items || [];
  if (itemIds.size) items = items.filter(item => itemIds.has(item.id));
  if (START > 0) items = items.slice(START);
  if (LIMIT > 0) items = items.slice(0, LIMIT);

  const contexts = new Map((data.contexts || []).map(context => [context.id, context]));
  const plan = items.map(item => {
    const context = contexts.get(item.contextId);
    const text = speechTextForItem(item, context, learningPath);
    const hash = textHash(text);
    const baseName = `${String(item.number).padStart(4, '0')}-${item.id}-${hash}`;
    const fileName = `${baseName}.${OUTPUT_FORMAT}`;
    const src = `audio/voicebox-mandarin-male/${fileName}`;
    const outputPath = join(OUTPUT_DIR, fileName);
    return { item, text, hash, src, outputPath, wavPath: join(WAV_DIR, `${baseName}.wav`) };
  });

  console.log(`准备生成 ${plan.length} 篇知识点音频，模型 ${MODEL_SIZE}，格式 ${OUTPUT_FORMAT}`);
  if (DRY_RUN) {
    for (const row of plan.slice(0, 20)) console.log(`${row.item.id}\t${row.text.length}\t${row.item.title}`);
    return;
  }

  await waitForVoicebox();
  const profile = await ensureProfile();
  await ensureModelLoaded();
  saveManifest(manifest);

  for (const row of plan) {
    const previous = manifest.items[row.item.id];
    if (!FORCE && previous?.hash === row.hash && existsSync(row.outputPath)) {
      console.log(`跳过 ${row.item.id}：已存在音频`);
      continue;
    }
    if (!row.text) {
      console.log(`跳过 ${row.item.id}：没有可朗读文本`);
      continue;
    }
    console.log(`生成 ${row.item.id}：${row.item.title}（${row.text.length} 字）`);
    const generationId = await generateWav(profile.id, row.item, row.text, row.wavPath);
    convertAudio(row.wavPath, row.outputPath);
    const duration = audioDurationSeconds(row.outputPath);
    manifest.items[row.item.id] = {
      src: row.src,
      title: row.item.title,
      hash: row.hash,
      chars: row.text.length,
      duration,
      modelSize: MODEL_SIZE,
      voice: '普通话男声',
      generationId,
      generatedAt: new Date().toISOString()
    };
    saveManifest(manifest);
  }

  console.log('音频生成完成。');
}

main().catch(error => {
  console.error(error);
  process.exit(1);
});
