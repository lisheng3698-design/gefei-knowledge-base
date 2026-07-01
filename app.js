const DATA = window.KB_DATA;
const LEARNING_PATH = window.KB_LEARNING_PATH || { stages: [], sections: [], itemSection: {} };
const AUDIO_MANIFEST = window.KB_AUDIO_MANIFEST || { items: {} };
const state = { view: 'docs', docId: 'all', pathId: 'all', query: '', sort: 'source', activeId: null };

const docList = document.getElementById('docList');
const docModeButton = document.getElementById('docModeButton');
const pathModeButton = document.getElementById('pathModeButton');
const railStats = document.getElementById('railStats');
const resultList = document.getElementById('resultList');
const resultCount = document.getElementById('resultCount');
const reader = document.getElementById('reader');
const searchInput = document.getElementById('searchInput');
const sortSelect = document.getElementById('sortSelect');
const clearFilters = document.getElementById('clearFilters');
const copyLink = document.getElementById('copyLink');
const syncButton = document.getElementById('syncButton');
const mobileDocSelect = document.getElementById('mobileDocSelect');
const mobileItemSelect = document.getElementById('mobileItemSelect');
const readerTopButton = document.getElementById('readerTopButton');
const markLearnedButton = document.getElementById('markLearnedButton');
const readerSpeechButton = document.getElementById('readerSpeechButton');
const lightbox = document.getElementById('lightbox');
const lightboxImage = document.getElementById('lightboxImage');
const lightboxCaption = document.getElementById('lightboxCaption');
const lightboxClose = document.getElementById('lightboxClose');
const syncModal = document.getElementById('syncModal');
const syncClose = document.getElementById('syncClose');
const syncForm = document.getElementById('syncForm');
const syncGistId = document.getElementById('syncGistId');
const syncToken = document.getElementById('syncToken');
const syncFileName = document.getElementById('syncFileName');
const syncNow = document.getElementById('syncNow');
const syncForget = document.getElementById('syncForget');
const syncStatus = document.getElementById('syncStatus');

const itemById = new Map(DATA.items.map(item => [item.id, item]));
const contextById = new Map(DATA.contexts.map(context => [context.id, context]));
const pathSectionById = new Map((LEARNING_PATH.sections || []).map(section => [section.id, section]));
const pathStageById = new Map((LEARNING_PATH.stages || []).map(stage => [stage.id, stage]));
const pathOrderIds = (LEARNING_PATH.sections || []).flatMap(section => section.itemIds || []);
const pathOrderById = new Map(pathOrderIds.map((id, index) => [id, index]));
const searchMetaById = new Map();
const searchIndexById = new Map();
const customSelectById = new Map();
const LEARNED_STORAGE_KEY = 'gefeiLearnedItems';
const LEARNED_COOKIE_KEY = 'gefei_learned_items';
const LEARNED_SYNC_STORAGE_KEY = 'gefeiLearnedSyncConfig';
const DEFAULT_SYNC_FILE = 'gefei-learned.json';
const GIST_API_ROOT = 'https://api.github.com/gists';
const syncState = { config: readSyncConfig(), syncing: false, pending: false };
const speechState = {
  mode: null,
  itemId: null,
  chunks: [],
  index: 0,
  playing: false,
  paused: false,
  utterance: null,
  audio: null,
  session: 0
};
const preGeneratedAudio = new Audio();
preGeneratedAudio.preload = 'metadata';
const learnedIds = readLearnedIds();
const SEARCH_SYNONYM_GROUPS = [
  { keys: ['adsense', '广告联盟', '谷歌联盟', '广告审核', '过审'], terms: ['adsense', 'google adsense', '网站审核', '申请审核', 'ads.txt', '广告代码', 'pin码', 'ecpm', 'rpm'] },
  { keys: ['google ads', '谷歌广告', '投流', '投放', '买量'], terms: ['google ads', '广告投放', 'mcc', 'campaign', '关键词规划师', '广告账户', 'ads api'] },
  { keys: ['gsc', 'search console', '站长工具', '谷歌收录', '收录', '索引'], terms: ['google search console', 'gsc', 'webmaster', '收录', '索引', 'sitemap', 'canonical', '备用网页'] },
  { keys: ['外链', '反链', 'backlink', '导航站', '目录站'], terms: ['外链建设', '反向链接', 'backlink', 'dofollow', 'nofollow', 'directory submission', '导航站提交', '博客评论'] },
  { keys: ['内链', '内部链接'], terms: ['内链建设', '内部链接', 'see also', '语义内链', '词条页', '分类页'] },
  { keys: ['关键词', '找词', '挖词', '需求', '选题'], terms: ['关键词', '需求挖掘', '搜索意图', 'semrush', 'ahrefs', 'similarweb', 'google trends', 'kd', 'cpc', 'volume'] },
  { keys: ['不会编程', '没有编程', '不会代码', '零基础', '新手', '小白'], terms: ['编程基础', 'html', 'css', 'javascript', '前端', '原生 js', '新手入门'] },
  { keys: ['部署', '上线', '发布网站'], terms: ['部署上线', 'vercel', 'cloudflare', 'github', 'dokploy', '域名解析', '服务器'] },
  { keys: ['r2', 'cloudflare r2', '对象存储'], terms: ['cloudflare r2', 'r2 存储', '图片存储', 'bucket', 'cors policy', 'api key'] },
  { keys: ['turnstile', '人机检测', '验证码'], terms: ['cloudflare turnstile', '人机检测', 'widget', 'site key', 'secret key'] },
  { keys: ['supabase', '数据库', '登录'], terms: ['supabase', '数据库配置', 'auth', '登录', 'github 登录', 'google 登录', '环境变量'] },
  { keys: ['支付', '收款', '提现', '订阅'], terms: ['stripe', 'creem', 'paypal', 'paddle', '收款', '提现', 'webhook', '订阅'] },
  { keys: ['域名', '邮箱', '邮件'], terms: ['域名解析', '域名邮箱', 'cloudflare email', 'resend', 'gmail', 'dns'] },
  { keys: ['图片', '截图', '配图', 'favicon', 'logo'], terms: ['图片', '截图', '配图', 'image', 'png', 'jpg', 'favicon', 'logo', 'alt'] },
  { keys: ['游戏站', '小游戏', '在线游戏'], terms: ['游戏站', '小游戏站', 'online game', 'iframe', 'scratch', 'game site', '广告收入'] },
  { keys: ['工具站', 'saas', '独立站'], terms: ['工具站', 'web product', 'saas', '落地页', '功能页', '内容页', '工具页'] },
  { keys: ['多语言', '翻译', '国际化'], terms: ['多语言', 'i18n', '子目录', 'hreflang', '英文站', '本地语言'] },
  { keys: ['ai编程', 'vibe coding', 'windsurf', 'cursor', 'claude code'], terms: ['ai编程', 'vibe coding', 'windsurf', 'cursor', 'claude code', '提示词'] },
  { keys: ['香港开户', '开卡', '银行卡', '中银', '汇丰', '工亚'], terms: ['香港开户', '中银香港', '汇丰', '工亚', 'vtm', '提款卡', '港澳通行证'] },
  { keys: ['怎么过', '如何过', '通过审核'], terms: ['通过', '审核', '过审', '申请', '流程', '注意事项'] },
  { keys: ['赚钱', '收入', '变现', '月入'], terms: ['赚钱', '收入', '变现', 'adsense', '广告收入', '订阅', '收款', 'rpm', 'ecpm'] }
];

function scrollPaneToTop(element) {
  if (element) element.scrollTop = 0;
}
function lockHorizontalScroll() {
  document.documentElement.scrollLeft = 0;
  document.body.scrollLeft = 0;
  if (reader) reader.scrollLeft = 0;
}
const URL_TEXT_PATTERN = /(https?:\/\/[^\s<>"')，。；、]+|www\.[^\s<>"')，。；、]+|[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)+(?:\/[^\s<>"')，。；、]*)?)/g;
function addUrlBreaks(text) {
  return String(text || '')
    .replace(/([/.?&=#:_-])/g, '$1\u200b')
    .replace(/([A-Za-z0-9]{8})(?=[A-Za-z0-9])/g, '$1\u200b');
}
function applyReadableBreaks(root) {
  if (!root) return;
  root.querySelectorAll('a').forEach(link => {
    const text = link.textContent || '';
    if (/https?:\/\/|www\.|[a-z0-9-]+\.[a-z]{2,}/i.test(text) && text.length > 24) {
      link.textContent = addUrlBreaks(text);
    }
  });
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
    acceptNode(node) {
      const parent = node.parentElement;
      if (!parent || /^(A|PRE|SCRIPT|STYLE|TEXTAREA|INPUT)$/i.test(parent.tagName)) {
        return NodeFilter.FILTER_REJECT;
      }
      const text = node.nodeValue || '';
      URL_TEXT_PATTERN.lastIndex = 0;
      return URL_TEXT_PATTERN.test(text) ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT;
    }
  });
  const textNodes = [];
  while (walker.nextNode()) textNodes.push(walker.currentNode);
  textNodes.forEach(node => {
    node.nodeValue = node.nodeValue.replace(URL_TEXT_PATTERN, match => addUrlBreaks(match));
  });
}
function parseLearnedValue(value) {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value);
    if (Array.isArray(parsed)) return parsed;
  } catch {}
  return value.split(',').map(id => id.trim()).filter(Boolean);
}
function readLearnedIds() {
  const ids = new Set();
  try {
    parseLearnedValue(localStorage.getItem(LEARNED_STORAGE_KEY)).forEach(id => ids.add(id));
  } catch {}
  try {
    const cookie = document.cookie.split('; ').find(row => row.startsWith(`${LEARNED_COOKIE_KEY}=`));
    if (cookie) parseLearnedValue(decodeURIComponent(cookie.split('=').slice(1).join('='))).forEach(id => ids.add(id));
  } catch {}
  return new Set([...ids].filter(id => itemById.has(id)));
}
function saveLearnedIds() {
  const ids = [...learnedIds].filter(id => itemById.has(id)).sort();
  try { localStorage.setItem(LEARNED_STORAGE_KEY, JSON.stringify(ids)); } catch {}
  try {
    document.cookie = `${LEARNED_COOKIE_KEY}=${encodeURIComponent(ids.join(','))}; max-age=157680000; path=/; SameSite=Lax`;
  } catch {}
}
function learnedIdList() {
  return [...learnedIds].filter(id => itemById.has(id)).sort();
}
function isLearned(id) {
  return !!id && learnedIds.has(id);
}
function audioEntryForItem(id = state.activeId) {
  const entry = id ? AUDIO_MANIFEST.items?.[id] : null;
  if (!entry || !entry.src) return null;
  return entry;
}
function hasPreGeneratedAudio(id = state.activeId) {
  return !!audioEntryForItem(id);
}
function formatDuration(seconds) {
  const value = Number(seconds);
  if (!Number.isFinite(value) || value <= 0) return '';
  const minutes = Math.floor(value / 60);
  const rest = Math.round(value % 60);
  return `${minutes}:${String(rest).padStart(2, '0')}`;
}
function isReaderAudioElement(audio) {
  return !!audio?.classList?.contains('reader-audio-player');
}
function currentReaderAudioPlayer(id = state.activeId) {
  const entry = audioEntryForItem(id);
  if (!entry || !reader) return null;
  const player = reader.querySelector('.reader-audio-player');
  if (!player) return null;
  const src = player.getAttribute('src') || '';
  return src === entry.src || player.currentSrc.endsWith(entry.src) ? player : null;
}
function focusReaderAudioPlayer(id = state.activeId) {
  const player = currentReaderAudioPlayer(id);
  const panel = player?.closest('.reader-audio-panel');
  if (!player || !panel) return;
  panel.scrollIntoView({ block: 'center', behavior: 'smooth' });
  panel.classList.add('audio-panel-focus');
  player.focus({ preventScroll: true });
  window.setTimeout(() => panel.classList.remove('audio-panel-focus'), 1800);
}
function updateLearnedButton(id = state.activeId) {
  if (!markLearnedButton) return;
  const active = isLearned(id);
  markLearnedButton.disabled = !id;
  markLearnedButton.classList.toggle('active', active);
  markLearnedButton.setAttribute('aria-pressed', String(active));
  markLearnedButton.setAttribute('title', active ? '已标记为已学' : '标记为已学');
  markLearnedButton.setAttribute('aria-label', active ? '当前知识点已学' : '标记当前知识点为已学');
}
function updateSpeechButton(id = state.activeId) {
  if (!readerSpeechButton) return;
  readerSpeechButton.classList.remove('playing', 'paused', 'unsupported');
  const hasAudio = hasPreGeneratedAudio(id);
  if (!id || !hasAudio) {
    readerSpeechButton.textContent = id ? '生成中' : '播放';
    readerSpeechButton.disabled = true;
    readerSpeechButton.classList.add('unsupported');
    readerSpeechButton.setAttribute('aria-label', id ? '当前知识点音频正在生成中' : '请选择知识点后播放音频');
    readerSpeechButton.setAttribute('title', id ? '音频正在生成中，稍后刷新后可播放' : '请选择知识点后播放音频');
    return;
  }
  readerSpeechButton.disabled = false;
  const current = id && speechState.itemId === id && (speechState.playing || speechState.paused);
  if (!current) {
    readerSpeechButton.textContent = '播放';
    readerSpeechButton.setAttribute('aria-label', '播放当前知识点音频');
    readerSpeechButton.setAttribute('title', '播放预生成音频');
  } else if (speechState.paused) {
    readerSpeechButton.textContent = '继续';
    readerSpeechButton.classList.add('paused');
    readerSpeechButton.setAttribute('aria-label', '继续播放当前知识点音频');
    readerSpeechButton.setAttribute('title', '继续播放，长按停止');
  } else {
    readerSpeechButton.textContent = '暂停';
    readerSpeechButton.classList.add('playing');
    readerSpeechButton.setAttribute('aria-label', '暂停当前知识点音频');
    readerSpeechButton.setAttribute('title', '暂停播放，长按停止');
  }
}
function readSyncConfig() {
  try {
    const saved = JSON.parse(localStorage.getItem(LEARNED_SYNC_STORAGE_KEY) || 'null');
    if (!saved || typeof saved !== 'object') return null;
    const gistId = String(saved.gistId || '').trim();
    const token = String(saved.token || '').trim();
    const fileName = String(saved.fileName || DEFAULT_SYNC_FILE).trim() || DEFAULT_SYNC_FILE;
    if (!gistId || !token) return null;
    return { gistId, token, fileName };
  } catch {
    return null;
  }
}
function isLikelyAutoplayBlock(error) {
  return ['NotAllowedError', 'AbortError'].includes(error?.name);
}
function saveSyncConfig(config) {
  syncState.config = config;
  try { localStorage.setItem(LEARNED_SYNC_STORAGE_KEY, JSON.stringify(config)); } catch {}
  updateSyncState('ready');
}
function hasSyncConfig() {
  return !!(syncState.config?.gistId && syncState.config?.token);
}
function setSyncStatus(message, mode = 'neutral') {
  if (syncStatus) syncStatus.textContent = message;
  if (!syncButton) return;
  syncButton.classList.toggle('configured', hasSyncConfig());
  syncButton.classList.toggle('syncing', mode === 'syncing');
  syncButton.classList.toggle('error', mode === 'error');
  syncButton.setAttribute('title', message || '已学云同步');
}
function updateSyncState(mode = 'neutral') {
  if (!hasSyncConfig()) {
    setSyncStatus('未配置云同步', 'neutral');
    return;
  }
  if (mode === 'syncing') setSyncStatus('正在同步...', 'syncing');
  else if (mode === 'error') setSyncStatus('同步失败，请检查配置', 'error');
  else setSyncStatus(`云同步已配置：${syncState.config.fileName}`, 'ready');
}
function openSyncModal() {
  if (!syncModal) return;
  const config = syncState.config || {};
  syncGistId.value = config.gistId || '';
  syncToken.value = config.token || '';
  syncFileName.value = config.fileName || DEFAULT_SYNC_FILE;
  updateSyncState(hasSyncConfig() ? 'ready' : 'neutral');
  syncModal.classList.add('open');
  syncModal.setAttribute('aria-hidden', 'false');
  syncGistId.focus();
}
function closeSyncModal() {
  if (!syncModal) return;
  syncModal.classList.remove('open');
  syncModal.setAttribute('aria-hidden', 'true');
}
function stopSpeech() {
  speechState.session += 1;
  if (speechState.audio) {
    speechState.audio.pause();
    if (speechState.audio === preGeneratedAudio) {
      speechState.audio.removeAttribute('src');
      speechState.audio.load();
    }
  }
  speechState.mode = null;
  speechState.itemId = null;
  speechState.chunks = [];
  speechState.index = 0;
  speechState.playing = false;
  speechState.paused = false;
  speechState.utterance = null;
  speechState.audio = null;
  updateSpeechButton();
}
function pauseSpeech() {
  if (!speechState.playing) return;
  if (speechState.mode === 'audio' && speechState.audio) {
    speechState.audio.pause();
  }
  speechState.playing = false;
  speechState.paused = true;
  updateSpeechButton();
}
function resumeSpeech() {
  if (!speechState.paused) return;
  if (speechState.mode === 'audio' && speechState.audio) {
    speechState.audio.play().catch(() => {
      stopSpeech();
      window.alert('音频播放失败，请稍后再试。');
    });
  }
  speechState.playing = true;
  speechState.paused = false;
  updateSpeechButton();
}
function startPreGeneratedAudio(item, entry) {
  const readerAudio = currentReaderAudioPlayer(item.id);
  stopSpeech();
  speechState.session += 1;
  speechState.mode = 'audio';
  speechState.itemId = item.id;
  speechState.audio = readerAudio || preGeneratedAudio;
  speechState.playing = true;
  speechState.paused = false;
  if (speechState.audio === preGeneratedAudio) {
    preGeneratedAudio.src = entry.src;
  }
  if (speechState.audio.ended || speechState.audio.currentTime > 0.2) {
    speechState.audio.currentTime = 0;
  }
  const playAttempt = speechState.audio.play();
  if (!playAttempt || typeof playAttempt.catch !== 'function') {
    updateSpeechButton(item.id);
    return;
  }
  playAttempt.catch(error => {
    stopSpeech();
    focusReaderAudioPlayer(item.id);
    const detail = isLikelyAutoplayBlock(error) ? '浏览器阻止了这次播放，请直接点击文章音频播放器。' : '请检查音频文件是否已生成，或直接点击文章音频播放器。';
    window.alert(`音频播放失败，${detail}`);
  });
  updateSpeechButton(item.id);
}
function startSpeech(item) {
  const entry = audioEntryForItem(item?.id);
  if (item && entry) {
    startPreGeneratedAudio(item, entry);
    return;
  }
  if (item) {
    focusReaderAudioPlayer(item.id);
    window.alert('当前知识点音频正在生成中，生成完成并更新后即可播放。');
  }
  updateSpeechButton(item?.id || null);
}
function toggleSpeech() {
  const item = state.activeId ? itemById.get(state.activeId) : null;
  if (!item) return;
  if (speechState.itemId !== item.id || (!speechState.playing && !speechState.paused)) {
    startSpeech(item);
  } else if (speechState.paused) {
    resumeSpeech();
  } else {
    pauseSpeech();
  }
}
function normalizeSyncConfigFromForm() {
  return {
    gistId: String(syncGistId.value || '').trim(),
    token: String(syncToken.value || '').trim(),
    fileName: String(syncFileName.value || DEFAULT_SYNC_FILE).trim() || DEFAULT_SYNC_FILE
  };
}
async function gistRequest(config, method = 'GET', body = null) {
  const response = await fetch(`${GIST_API_ROOT}/${encodeURIComponent(config.gistId)}`, {
    method,
    headers: {
      'Accept': 'application/vnd.github+json',
      'Authorization': `Bearer ${config.token}`,
      'X-GitHub-Api-Version': '2022-11-28',
      ...(body ? { 'Content-Type': 'application/json' } : {})
    },
    body: body ? JSON.stringify(body) : undefined
  });
  if (!response.ok) {
    if (response.status === 401 || response.status === 403) throw new Error('Token 无法访问这个 Gist');
    if (response.status === 404) throw new Error('Gist ID 不存在或无权限');
    throw new Error(`GitHub 返回 ${response.status}`);
  }
  return response.json();
}
function parseRemoteLearnedIds(gist, fileName) {
  const file = gist?.files?.[fileName];
  if (!file?.content) return [];
  try {
    const parsed = JSON.parse(file.content);
    const ids = Array.isArray(parsed) ? parsed : parsed.learnedIds;
    return Array.isArray(ids) ? ids.filter(id => itemById.has(id)) : [];
  } catch {
    return [];
  }
}
function mergeLearnedIds(ids) {
  const before = learnedIdList().join(',');
  ids.filter(id => itemById.has(id)).forEach(id => learnedIds.add(id));
  const after = learnedIdList().join(',');
  if (before !== after) saveLearnedIds();
  return before !== after;
}
function refreshLearnedViews(scrollTop = reader.scrollTop) {
  const items = getFilteredItems();
  renderResults(items);
  renderMobileNav(items);
  renderReader(state.activeId ? itemById.get(state.activeId) : null);
  reader.scrollTop = scrollTop;
}
async function syncLearned() {
  if (!hasSyncConfig()) {
    updateSyncState('neutral');
    return false;
  }
  if (syncState.syncing) {
    syncState.pending = true;
    return false;
  }
  syncState.syncing = true;
  updateSyncState('syncing');
  try {
    const config = syncState.config;
    const gist = await gistRequest(config);
    const remoteIds = parseRemoteLearnedIds(gist, config.fileName);
    const changedLocal = mergeLearnedIds(remoteIds);
    const ids = learnedIdList();
    await gistRequest(config, 'PATCH', {
      files: {
        [config.fileName]: {
          content: JSON.stringify({
            version: 1,
            updatedAt: new Date().toISOString(),
            learnedIds: ids
          }, null, 2)
        }
      }
    });
    if (changedLocal) refreshLearnedViews();
    setSyncStatus(`已同步 ${ids.length} 条已学`, 'ready');
    return true;
  } catch (error) {
    setSyncStatus(error.message || '同步失败', 'error');
    return false;
  } finally {
    syncState.syncing = false;
    if (syncState.pending) {
      syncState.pending = false;
      setTimeout(syncLearned, 300);
    }
  }
}
function queueLearnedSync() {
  if (hasSyncConfig()) setTimeout(syncLearned, 0);
}
function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
}
function highlight(text, query) {
  const safe = escapeHtml(text);
  if (!query) return safe;
  const words = highlightTerms(query);
  if (!words.length) return safe;
  const pattern = new RegExp(`(${words.map(w => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})`, 'gi');
  return safe.replace(pattern, '<mark>$1</mark>');
}
function normalizeText(value) {
  return String(value ?? '')
    .normalize('NFKC')
    .toLowerCase()
    .replace(/[’‘]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/\s+/g, ' ')
    .trim();
}
function normalizeSearch(value) {
  return normalizeText(value).replace(/[\s\p{P}\p{S}]+/gu, '');
}
function uniqueByCompact(terms) {
  const seen = new Set();
  return terms.filter(term => {
    const compact = term.compact || normalizeSearch(term.term);
    if (!compact || seen.has(compact)) return false;
    seen.add(compact);
    term.compact = compact;
    return true;
  });
}
function addSearchTerm(list, term, options = {}) {
  const normalized = normalizeText(term);
  const compact = normalizeSearch(normalized);
  if (!compact) return;
  list.push({
    term: normalized,
    compact,
    weight: options.weight || 1,
    source: options.source || 'query',
    primary: options.primary !== false
  });
}
function addChineseSearchTerms(list, chunk, source = 'query') {
  const clean = normalizeText(chunk);
  if (!clean) return;
  if (clean.length <= 2) {
    addSearchTerm(list, clean, { source, weight: 1.15 });
    return;
  }
  if (clean.length <= 10) addSearchTerm(list, clean, { source, weight: 1.2 });
  for (let size = 3; size >= 2; size--) {
    if (clean.length < size) continue;
    for (let i = 0; i <= clean.length - size; i++) {
      addSearchTerm(list, clean.slice(i, i + size), {
        source: 'ngram',
        weight: size === 3 ? 0.82 : 0.72,
        primary: true
      });
    }
  }
}
function analyzeQuery(query) {
  const normal = normalizeText(query);
  const compact = normalizeSearch(query);
  const terms = [];
  if (!compact) return { normal, compact, terms: [], primaryTerms: [], highlight: [] };

  for (const match of normal.matchAll(/[a-z0-9]+(?:[.+#-][a-z0-9]+)*/g)) {
    addSearchTerm(terms, match[0], { weight: match[0].length > 2 ? 1.1 : 0.9 });
  }
  for (const match of normal.matchAll(/\p{Script=Han}+/gu)) {
    addChineseSearchTerms(terms, match[0]);
  }
  for (const part of normal.split(/[\s,，;；、/|]+/).filter(Boolean)) {
    if (/[a-z0-9]/i.test(part) || /\p{Script=Han}/u.test(part)) {
      addSearchTerm(terms, part, { weight: part.length > 2 ? 1.05 : 0.85 });
    }
  }

  for (const group of SEARCH_SYNONYM_GROUPS) {
    const shouldExpand = group.keys.some(key => {
      const keyNormal = normalizeText(key);
      const keyCompact = normalizeSearch(key);
      return normal.includes(keyNormal) || compact.includes(keyCompact);
    });
    if (!shouldExpand) continue;
    for (const term of group.terms) addSearchTerm(terms, term, { source: 'synonym', weight: 0.42, primary: false });
  }

  const uniqueTerms = uniqueByCompact(terms)
    .filter(term => term.compact.length > 1 || compact.length === 1)
    .sort((a, b) => b.weight - a.weight || b.compact.length - a.compact.length);
  const primaryTerms = uniqueTerms.filter(term => term.primary && term.compact.length > 1).slice(0, 14);
  const highlight = uniqueTerms
    .filter(term => term.compact.length > 1 && term.source !== 'ngram')
    .sort((a, b) => b.compact.length - a.compact.length)
    .slice(0, 12)
    .map(term => term.term);
  return { normal, compact, terms: uniqueTerms, primaryTerms, highlight };
}
function highlightTerms(query) {
  const analysis = analyzeQuery(query);
  return analysis.highlight.length ? analysis.highlight : query.split(/\s+/).filter(Boolean).slice(0, 4);
}
function itemImageText(item, context) {
  const paired = item.pairedImages || [];
  const contextImages = context?.images || [];
  return [...paired, ...contextImages].map(img => `${img.alt || ''} ${img.src || ''} ${img.original || ''}`).join(' ');
}
function itemSearchText(item, context) {
  return [
    item.title,
    item.sub,
    item.contextTitle,
    item.sourceSection,
    item.docTitle,
    item.sourceFile,
    context?.title || '',
    context?.text || '',
    itemImageText(item, context)
  ].join(' ');
}
function fieldIndex(text) {
  const normal = normalizeText(text);
  return { text: String(text || ''), normal, compact: normalizeSearch(normal) };
}
function getSearchIndex(item, context) {
  if (searchIndexById.has(item.id)) return searchIndexById.get(item.id);
  const index = {
    title: fieldIndex([item.title, item.contextTitle].join(' ')),
    doc: fieldIndex([item.docTitle, item.sourceFile].join(' ')),
    body: fieldIndex([context?.title || '', context?.text || '', item.text || ''].join(' ')),
    image: fieldIndex(itemImageText(item, context))
  };
  searchIndexById.set(item.id, index);
  return index;
}
function termHitsField(field, term) {
  if (!term.compact) return false;
  if (field.normal.includes(term.term)) return true;
  return term.compact.length > 1 && field.compact.includes(term.compact);
}
function fieldLabel(name) {
  return { title: '标题命中', body: '内容命中', image: '图片命中', doc: '文档命中' }[name] || '命中';
}
function matchItem(item, context, query) {
  const analysis = analyzeQuery(query);
  if (!analysis.compact) {
    return { score: 1, labels: [], matchedTerms: [], snippet: makeSnippet(item, context, '') };
  }

  const index = getSearchIndex(item, context);
  const fields = [
    ['title', index.title, 120],
    ['doc', index.doc, 42],
    ['body', index.body, 18],
    ['image', index.image, 14]
  ];
  let score = 0;
  let phraseMatched = false;
  const matchedPrimary = new Set();
  const matchedTerms = new Set();
  const labels = new Set();
  const fieldHits = new Set();

  for (const [name, field, weight] of fields) {
    if (analysis.compact.length > 1 && field.compact.includes(analysis.compact)) {
      phraseMatched = true;
      score += weight * 3.2;
      labels.add(fieldLabel(name));
      fieldHits.add(name);
    }
  }

  for (const term of analysis.terms) {
    for (const [name, field, weight] of fields) {
      if (!termHitsField(field, term)) continue;
      const lengthBoost = Math.min(1.8, Math.max(0.65, term.compact.length / 4));
      const sourceDamp = term.source === 'synonym' ? 0.48 : (term.source === 'ngram' ? 0.78 : 1);
      score += weight * term.weight * lengthBoost * sourceDamp;
      matchedTerms.add(term.term);
      labels.add(fieldLabel(name));
      fieldHits.add(name);
      if (term.primary) matchedPrimary.add(term.compact);
    }
  }

  const primaryCount = Math.max(1, analysis.primaryTerms.length);
  const coverage = matchedPrimary.size / primaryCount;
  const accepted = phraseMatched ||
    score >= 58 ||
    (analysis.primaryTerms.length <= 1 && matchedPrimary.size > 0) ||
    (analysis.primaryTerms.length > 1 && (coverage >= 0.34 || matchedPrimary.size >= 2));

  if (!accepted) return null;
  return {
    score,
    labels: [...labels],
    matchedTerms: [...matchedTerms],
    fieldHits: [...fieldHits],
    snippet: makeSnippet(item, context, query, { analysis, fieldHits })
  };
}
function itemScore(item, context, query) {
  return matchItem(item, context, query)?.score || 0;
}
function makeSnippet(item, context, query, meta = null) {
  const imageText = itemImageText(item, context);
  const source = meta?.fieldHits?.has?.('image') && !meta?.fieldHits?.has?.('body')
    ? `图片：${imageText}`
    : (context?.text || item.text || item.contextTitle || item.title);
  const clean = String(source || '').replace(/\s+/g, ' ').trim();
  if (!clean) return item.contextTitle || '';
  const analysis = meta?.analysis || analyzeQuery(query);
  const terms = analysis.terms?.map(term => term.term).filter(Boolean) || [];
  let index = -1;
  const lower = normalizeText(clean);
  for (const term of terms) {
    index = lower.indexOf(term);
    if (index >= 0) break;
  }
  if (index < 0) index = lower.indexOf(normalizeText(String(item.title || '').slice(0, 12)));
  if (index < 0) return clean.slice(0, 210);
  const start = Math.max(0, index - 72);
  const end = Math.min(clean.length, index + 160);
  return `${start > 0 ? '...' : ''}${clean.slice(start, end)}${end < clean.length ? '...' : ''}`;
}
function mobileOptionText(text, max = 34) {
  const clean = String(text || '').replace(/\s+/g, ' ').trim();
  return clean.length > max ? `${clean.slice(0, max - 1)}...` : clean;
}
function closeCustomSelects(except = null) {
  customSelectById.forEach(control => {
    if (control.root !== except) {
      control.root.classList.remove('open');
      control.button.setAttribute('aria-expanded', 'false');
    }
  });
}
function syncCustomSelect(select) {
  const control = customSelectById.get(select.id);
  if (!control) return;
  const selected = select.selectedOptions[0] || select.options[0];
  control.button.disabled = select.disabled;
  control.button.querySelector('.custom-select-value').textContent = selected?.textContent || '';
  control.menu.innerHTML = [...select.options].map(option => `
    <button type="button" class="custom-select-option${option.selected ? ' selected' : ''}" data-value="${escapeHtml(option.value)}" ${option.disabled ? 'disabled' : ''}>
      ${escapeHtml(option.textContent || '')}
    </button>`).join('');
  control.menu.querySelectorAll('.custom-select-option').forEach(optionButton => {
    optionButton.addEventListener('click', () => {
      select.value = optionButton.dataset.value;
      select.dispatchEvent(new Event('change', { bubbles: true }));
      closeCustomSelects();
      syncCustomSelect(select);
    });
  });
}
function setupCustomSelect(select) {
  if (!select || customSelectById.has(select.id)) return;
  select.classList.add('native-select-source');
  select.setAttribute('aria-hidden', 'true');
  select.tabIndex = -1;
  const root = document.createElement('div');
  root.className = 'custom-select';
  root.dataset.selectId = select.id;
  root.innerHTML = `
    <button type="button" class="custom-select-button" aria-haspopup="listbox" aria-expanded="false">
      <span class="custom-select-value"></span>
      <span class="custom-select-chevron" aria-hidden="true"></span>
    </button>
    <div class="custom-select-menu" role="listbox"></div>`;
  select.insertAdjacentElement('afterend', root);
  const button = root.querySelector('.custom-select-button');
  const menu = root.querySelector('.custom-select-menu');
  customSelectById.set(select.id, { root, button, menu });
  button.addEventListener('click', event => {
    event.stopPropagation();
    const willOpen = !root.classList.contains('open');
    closeCustomSelects(root);
    root.classList.toggle('open', willOpen);
    button.setAttribute('aria-expanded', String(willOpen));
  });
  select.addEventListener('change', () => syncCustomSelect(select));
  syncCustomSelect(select);
}
function setupCustomSelects() {
  [sortSelect, mobileDocSelect, mobileItemSelect].forEach(setupCustomSelect);
}
function cleanSummaryText(value) {
  return String(value || '')
    .replace(/\s+/g, ' ')
    .replace(/原文完整长截图|展开原文完整截图 \/ 原图/g, '')
    .trim();
}
function limitSummaryText(value, max = 230) {
  const text = cleanSummaryText(value);
  if (text.length <= max) return text;
  const cut = text.slice(0, max);
  const stops = ['。', '；', '！', '？', '.'];
  const lastStop = Math.max(...stops.map(stop => cut.lastIndexOf(stop)));
  if (lastStop >= 80) return cut.slice(0, lastStop + 1);
  return `${cut.replace(/[，,、:：;；\s]+$/, '')}...`;
}
function contextFragment(context) {
  const template = document.createElement('template');
  template.innerHTML = context?.html || '';
  template.content.querySelectorAll('script, style, details, figure, img').forEach(node => node.remove());
  return template.content;
}
function nodeSummaryText(node) {
  if (!node) return '';
  if (node.matches?.('p, blockquote')) return cleanSummaryText(node.textContent);
  if (node.matches?.('ul, ol')) {
    return [...node.querySelectorAll(':scope > li')]
      .slice(0, 5)
      .map(li => cleanSummaryText(li.textContent))
      .filter(Boolean)
      .join('；');
  }
  if (node.matches?.('table')) {
    return [...node.querySelectorAll('tbody tr, tr')]
      .slice(0, 4)
      .map(row => [...row.querySelectorAll('th, td')].map(cell => cleanSummaryText(cell.textContent)).filter(Boolean).join('：'))
      .filter(Boolean)
      .join('；');
  }
  return cleanSummaryText(node.textContent);
}
function textAfterPreferredHeading(fragment) {
  const preferred = /核心结论|核心观点|一句话|总体|总览|方法论|复盘|使用建议|可执行清单|实操过程|关键动作|操作步骤/;
  const heading = [...fragment.querySelectorAll('h2, h3, h4')].find(node => preferred.test(cleanSummaryText(node.textContent)));
  if (!heading) return '';
  const chunks = [];
  let node = heading.nextElementSibling;
  while (node && !/^H[2-4]$/.test(node.tagName) && chunks.join('').length < 420) {
    const text = nodeSummaryText(node);
    if (text) chunks.push(text);
    node = node.nextElementSibling;
  }
  return chunks.join(' ');
}
function contextOverview(context) {
  const fragment = contextFragment(context);
  const headingText = [...fragment.querySelectorAll('h2, h3, h4')]
    .map(node => cleanSummaryText(node.textContent))
    .filter(text => text && !/截图|原文|来源/.test(text));
  const headline = limitSummaryText(
    textAfterPreferredHeading(fragment) ||
    [...fragment.querySelectorAll('p, blockquote')].map(node => cleanSummaryText(node.textContent)).find(text => text.length >= 18) ||
    context?.text ||
    '',
    260
  );
  const listPoints = [...fragment.querySelectorAll('ol > li, ul > li')]
    .map(node => cleanSummaryText(node.textContent))
    .filter(text => text && !/截图|来源/.test(text));
  const tablePoints = [...fragment.querySelectorAll('tbody tr, tr')]
    .map(row => [...row.querySelectorAll('th, td')].map(cell => cleanSummaryText(cell.textContent)).filter(Boolean).join('：'))
    .filter(text => text && text.length >= 8);
  const points = [...new Set([...listPoints, ...tablePoints])]
    .filter(text => text !== headline)
    .slice(0, 5)
    .map(text => limitSummaryText(text, 120));
  return {
    headline,
    headings: [...new Set(headingText)].slice(0, 8),
    points
  };
}
function renderSummaryOverview(item) {
  if (item.type !== 'summary') return '';
  const related = DATA.items.filter(other => other.docId === item.docId && other.type !== 'summary');
  if (!related.length) return '';
  const cards = related.map((section, index) => {
    const context = contextById.get(section.contextId);
    const overview = contextOverview(context);
    const image = (section.pairedImages || [])[0] || (context?.images || [])[0];
    const thumb = image ? `
      <button class="summary-thumb-button" data-lightbox-src="${escapeHtml(image.src)}" data-lightbox-caption="${escapeHtml(image.alt || section.title)}">
        <img src="${escapeHtml(image.src)}" alt="${escapeHtml(image.alt || section.title)}" loading="lazy">
      </button>` : '<div class="summary-thumb-empty">无配图</div>';
    const headings = overview.headings.length
      ? `<div class="summary-mini-headings">${overview.headings.map(text => `<span>${escapeHtml(text)}</span>`).join('')}</div>`
      : '';
    const points = overview.points.length
      ? `<ul class="summary-points">${overview.points.map(text => `<li>${escapeHtml(text)}</li>`).join('')}</ul>`
      : '';
    return `
      <article class="summary-card">
        <div class="summary-thumb">${thumb}</div>
        <div class="summary-card-copy">
          <div class="summary-card-index">知识点 ${index + 1}</div>
          <h4>${escapeHtml(section.title)}</h4>
          <p>${escapeHtml(overview.headline || '该知识点主要保留原文标题下的完整内容，可点击进入查看全文。')}</p>
          ${points}
          ${headings}
          <button class="summary-open" data-id="${section.id}">查看完整知识点</button>
        </div>
      </article>`;
  }).join('');
  return `
    <section class="summary-overview">
      <div class="summary-overview-head">
        <h3>本篇知识点展开速览</h3>
        <p>这里把同一文档下的知识点逐条展开：先看核心结论，再看操作要点、小节结构和配图；需要看完整步骤时，点击卡片里的按钮即可跳到对应知识点全文。</p>
      </div>
      <div class="summary-cards">${cards}</div>
    </section>`;
}
function renderStats() {
  railStats.innerHTML = `
    <div class="stat-card"><b>${DATA.stats.docCount}</b><span>源文档</span></div>
    <div class="stat-card"><b>${DATA.stats.itemCount}</b><span>标题知识点</span></div>
    <div class="stat-card"><b>${LEARNING_PATH.sections?.length || 0}</b><span>上站分类</span></div>
    <div class="stat-card"><b>${DATA.stats.uniqueReferencedImages}</b><span>直接配图</span></div>`;
}
function renderModeSwitch() {
  if (!docModeButton || !pathModeButton) return;
  docModeButton.classList.toggle('active', state.view === 'docs');
  pathModeButton.classList.toggle('active', state.view === 'path');
  docModeButton.setAttribute('aria-pressed', String(state.view === 'docs'));
  pathModeButton.setAttribute('aria-pressed', String(state.view === 'path'));
}
function renderDocs() {
  renderModeSwitch();
  if (state.view === 'path') {
    renderPathNav();
    return;
  }
  docList.innerHTML = `<button class="doc-button${state.docId === 'all' ? ' active' : ''}" data-doc="all"><strong>全部文档</strong><span>${DATA.items.length} 个标题知识点</span></button>` +
    DATA.docs.map(doc => `<button class="doc-button${state.docId === doc.id ? ' active' : ''}" data-doc="${doc.id}"><strong>${escapeHtml(doc.title)}</strong><span>${doc.count} 个标题知识点</span></button>`).join('');
  docList.querySelectorAll('button[data-doc]').forEach(button => {
    button.addEventListener('click', () => {
      selectDoc(button.dataset.doc);
    });
  });
}
function renderPathNav() {
  const stages = LEARNING_PATH.stages || [];
  const sections = LEARNING_PATH.sections || [];
  const parts = [
    `<button class="doc-button path-button${state.pathId === 'all' ? ' active' : ''}" data-path="all">
      <strong>完整上站路径</strong>
      <span>按准备、建站、维护、数据、收益排列 · ${DATA.items.length} 个知识点</span>
    </button>`
  ];
  stages.forEach(stage => {
    const stageSections = sections.filter(section => section.stage === stage.id);
    const stageCount = stageSections.reduce((total, section) => total + (section.itemIds || []).length, 0);
    parts.push(`<div class="path-stage-label"><span>${escapeHtml(stage.title)}</span><em>${stageCount} 个</em></div>`);
    stageSections.forEach(section => {
      parts.push(`
        <button class="doc-button path-button${state.pathId === section.id ? ' active' : ''}" data-path="${escapeHtml(section.id)}">
          <strong>${escapeHtml(section.title)}</strong>
          <span>${(section.itemIds || []).length} 个知识点 · ${escapeHtml(section.description || '')}</span>
        </button>`);
    });
  });
  docList.innerHTML = parts.join('');
  docList.querySelectorAll('button[data-path]').forEach(button => {
    button.addEventListener('click', () => {
      selectPath(button.dataset.path);
    });
  });
}
function switchView(view) {
  state.view = view === 'path' ? 'path' : 'docs';
  state.activeId = null;
  updateHash();
  render();
  scrollPaneToTop(docList);
  scrollPaneToTop(resultList);
  scrollPaneToTop(reader);
}
function renderMobileNav(items) {
  if (!mobileDocSelect || !mobileItemSelect) return;
  const docOptions = [
    `<option value="docs:all">文档目录 · 全部文档 · ${DATA.items.length} 个</option>`,
    ...DATA.docs.map(doc => `<option value="docs:${escapeHtml(doc.id)}">文档目录 · ${escapeHtml(mobileOptionText(doc.title))} · ${doc.count} 个</option>`)
  ];
  const pathOptions = [
    `<option value="path:all">上站路径 · 完整路径 · ${DATA.items.length} 个</option>`,
    ...(LEARNING_PATH.sections || []).map(section => {
      const stage = pathStageById.get(section.stage);
      const stageName = stage ? stage.title.replace(/^\d+\.\s*/, '') : '上站路径';
      return `<option value="path:${escapeHtml(section.id)}">上站路径 · ${escapeHtml(stageName)} · ${escapeHtml(mobileOptionText(section.title, 24))} · ${(section.itemIds || []).length} 个</option>`;
    })
  ];
  mobileDocSelect.innerHTML = [...docOptions, ...pathOptions].join('');
  mobileDocSelect.value = state.view === 'path' ? `path:${state.pathId}` : `docs:${state.docId}`;

  if (!items.length) {
    mobileItemSelect.innerHTML = '<option value="">无匹配知识点</option>';
    mobileItemSelect.disabled = true;
    syncCustomSelect(mobileDocSelect);
    syncCustomSelect(mobileItemSelect);
    return;
  }

  mobileItemSelect.disabled = false;
  mobileItemSelect.innerHTML = items.map(item => {
    const section = pathSectionById.get(LEARNING_PATH.itemSection?.[item.id]);
    const prefix = state.view === 'path' && section ? section.title : (item.type === 'summary' ? '总结' : `KP-${String(item.number).padStart(4, '0')}`);
    return `<option value="${escapeHtml(item.id)}">${escapeHtml(prefix)} · ${escapeHtml(mobileOptionText(item.title, 42))}</option>`;
  }).join('');
  mobileItemSelect.value = state.activeId || items[0].id;
  syncCustomSelect(mobileDocSelect);
  syncCustomSelect(mobileItemSelect);
}
function selectDoc(docId) {
  state.view = 'docs';
  state.docId = docId || 'all';
  state.activeId = null;
  updateHash();
  render();
  scrollPaneToTop(resultList);
  scrollPaneToTop(reader);
  if (window.matchMedia('(max-width: 760px)').matches) window.scrollTo(0, 0);
}
function selectPath(pathId) {
  state.view = 'path';
  state.pathId = pathId || 'all';
  state.sort = 'path';
  if (sortSelect) {
    sortSelect.value = 'path';
    syncCustomSelect(sortSelect);
  }
  state.activeId = null;
  updateHash();
  render();
  scrollPaneToTop(resultList);
  scrollPaneToTop(reader);
  if (window.matchMedia('(max-width: 760px)').matches) window.scrollTo(0, 0);
}
function compareByPath(a, b) {
  return (pathOrderById.get(a.id) ?? a.number + 100000) - (pathOrderById.get(b.id) ?? b.number + 100000) || a.number - b.number;
}
function getFilteredItems() {
  searchMetaById.clear();
  let items = DATA.items;
  if (state.view === 'path') {
    const section = pathSectionById.get(state.pathId);
    const allowedIds = section ? new Set(section.itemIds || []) : null;
    if (allowedIds) items = items.filter(item => allowedIds.has(item.id));
  } else if (state.docId !== 'all') {
    items = items.filter(item => item.docId === state.docId);
  }
  const q = state.query.trim();
  if (q) {
    items = items.map(item => {
      const context = contextById.get(item.contextId);
      const meta = matchItem(item, context, q);
      if (meta) searchMetaById.set(item.id, meta);
      return { item, score: meta?.score || 0 };
    }).filter(row => row.score > 0).sort((a, b) => b.score - a.score || (state.view === 'path' ? compareByPath(a.item, b.item) : a.item.number - b.item.number)).map(row => row.item);
  }
  if (state.sort === 'path' || (state.view === 'path' && !q)) items = [...items].sort(compareByPath);
  if (state.sort === 'long') items = [...items].sort((a, b) => b.charCount - a.charCount || (state.view === 'path' ? compareByPath(a, b) : a.number - b.number));
  if (state.sort === 'images') items = [...items].sort((a, b) => b.imageCount - a.imageCount || (state.view === 'path' ? compareByPath(a, b) : a.number - b.number));
  return items;
}
function renderResults(items) {
  resultCount.textContent = `${items.length} 条`;
  if (state.activeId && !items.some(item => item.id === state.activeId)) state.activeId = items[0]?.id || null;
  if (!state.activeId && items[0]) state.activeId = items[0].id;
  let lastSectionId = null;
  resultList.innerHTML = items.map(item => {
    const context = contextById.get(item.contextId);
    const searchMeta = searchMetaById.get(item.id);
    const image = (item.pairedImages || [])[0] || (context?.images || [])[0];
    const thumb = image ? `<img src="${escapeHtml(image.src)}" alt="${escapeHtml(image.alt || item.title)}" loading="lazy">` : `<span>无图</span>`;
    const snippet = searchMeta?.snippet || makeSnippet(item, context, state.query);
    const learned = isLearned(item.id);
    const hasAudio = hasPreGeneratedAudio(item.id);
    const section = pathSectionById.get(LEARNING_PATH.itemSection?.[item.id]);
    const stage = section ? pathStageById.get(section.stage) : null;
    const groupHeader = state.view === 'path' && section && section.id !== lastSectionId
      ? `<div class="path-result-group">
          <div class="path-result-stage">${escapeHtml(stage?.title || '上站路径')}</div>
          <strong>${escapeHtml(section.title)}</strong>
          <p>${escapeHtml(section.description || '')}</p>
        </div>`
      : '';
    if (state.view === 'path' && section) lastSectionId = section.id;
    const matchTags = state.query.trim() && searchMeta?.labels?.length
      ? `<div class="match-tags">${searchMeta.labels.slice(0, 3).map(label => `<span>${escapeHtml(label)}</span>`).join('')}</div>`
      : '';
    return `${groupHeader}
    <button class="result-card${item.id === state.activeId ? ' active' : ''}${learned ? ' learned' : ''}" data-id="${item.id}">
      <div class="result-thumb">${thumb}</div>
      <div class="result-copy">
        <h3>${highlight(item.title, state.query)}</h3>
        <p>${highlight(snippet, state.query)}</p>
        ${matchTags}
        <div class="card-meta">
          <span class="pill">${escapeHtml(item.docTitle)}</span>
          ${item.type === 'summary' ? '<span class="pill">文档总结</span>' : ''}
          ${state.view === 'path' && section ? `<span class="pill path-pill">${escapeHtml(section.title)}</span>` : ''}
          <span class="pill">第 ${item.sourceLine} 行</span>
          <span class="pill">正文 ${item.charCount} 字</span>
          <span class="pill">配图 ${(item.pairedImages || []).length}</span>
          ${hasAudio ? '<span class="pill audio-pill">有音频</span>' : ''}
          ${learned ? '<span class="pill learned-pill">已学</span>' : ''}
        </div>
      </div>
    </button>`;
  }).join('');
  resultList.querySelectorAll('.result-card').forEach(card => card.addEventListener('click', () => selectItem(card.dataset.id)));
}
function selectItem(id) {
  if (speechState.itemId && speechState.itemId !== id) stopSpeech();
  state.activeId = id;
  updateHash();
  const items = getFilteredItems();
  renderResults(items);
  renderMobileNav(items);
  renderReader(itemById.get(id));
  scrollPaneToTop(reader);
}
function renderReader(item) {
  updateLearnedButton(item?.id || null);
  updateSpeechButton(item?.id || null);
  if (!item) {
    reader.innerHTML = `<div class="empty-state"><h2>没有匹配的知识点</h2><p>换一个关键词，或者清除筛选后再看。</p></div>`;
    return;
  }
  const context = contextById.get(item.contextId);
  if (!context) {
    reader.innerHTML = `<div class="empty-state"><h2>详情没有找到</h2><p>这个知识点没有映射到原文详情块。</p></div>`;
    return;
  }
  const meta = context.meta.length ? `<div class="reader-source">${context.meta.map(x => `<span class="pill">${escapeHtml(x)}</span>`).join('')}</div>` : '';
  const summaryOverview = renderSummaryOverview(item);
  const learnedPill = isLearned(item.id) ? '<span class="pill learned-pill">已学</span>' : '';
  const audioEntry = audioEntryForItem(item.id);
  const audioPanel = audioEntry
    ? `<section class="reader-audio-panel">
        <div>
          <strong>文章音频</strong>
          <span>${escapeHtml(audioEntry.voice || AUDIO_MANIFEST.voice || '普通话男声')}${audioEntry.duration ? ` · ${escapeHtml(formatDuration(audioEntry.duration))}` : ''}</span>
        </div>
        <audio class="reader-audio-player" controls preload="metadata" src="${escapeHtml(audioEntry.src)}"></audio>
      </section>`
    : '';
  const pathSection = pathSectionById.get(LEARNING_PATH.itemSection?.[item.id]);
  const pathStage = pathSection ? pathStageById.get(pathSection.stage) : null;
  const pathPill = pathSection ? `<span class="pill path-pill">上站路径：${escapeHtml(pathStage?.title || '')} / ${escapeHtml(pathSection.title)}</span>` : '';
  reader.innerHTML = `
    <div class="reader-inner">
      <header class="reader-header">
        <div class="eyebrow">KP-${String(item.number).padStart(4, '0')} · ${escapeHtml(item.docTitle)}</div>
        <h2>${escapeHtml(item.title)}</h2>
        <div class="reader-source">
          <span class="pill">当前标题：${escapeHtml(context.title)}</span>
          <span class="pill">来源：<a href="${context.sourceHref}" target="_blank" rel="noreferrer">${escapeHtml(context.sourceFile)}</a></span>
          <span class="pill">标题行号：${item.sourceLine}</span>
          <span class="pill">内容行号：${context.lineStart}-${context.lineEnd}</span>
          <span class="pill">正文：${context.charCount} 字</span>
          <span class="pill">配图：${context.imageCount} 张</span>
          ${pathPill}
          ${learnedPill}
        </div>
        ${meta}
      </header>
      ${audioPanel}
      <section class="article-content">${context.html || '<p>该标题下没有正文内容。</p>'}</section>
      ${summaryOverview}
    </div>`;
  reader.querySelectorAll('.article-content img').forEach(img => {
    img.addEventListener('click', () => openLightbox(img.currentSrc || img.src, img.alt || item.title));
  });
  reader.querySelectorAll('.reader-audio-player').forEach(audio => {
    audio.addEventListener('play', () => {
      if (speechState.audio !== audio) stopSpeech();
      speechState.session += 1;
      speechState.mode = 'audio';
      speechState.itemId = item.id;
      speechState.audio = audio;
      speechState.playing = true;
      speechState.paused = false;
      updateSpeechButton(item.id);
    });
    audio.addEventListener('pause', () => {
      if (speechState.mode !== 'audio' || speechState.audio !== audio || audio.ended) return;
      speechState.playing = false;
      speechState.paused = true;
      updateSpeechButton(item.id);
    });
    audio.addEventListener('ended', () => {
      if (speechState.mode === 'audio' && speechState.audio === audio) stopSpeech();
    });
    audio.addEventListener('error', () => {
      if (speechState.mode !== 'audio' || speechState.audio !== audio) return;
      stopSpeech();
      window.alert('音频播放失败，请检查文件是否已生成，或刷新页面后再试。');
    });
  });
  applyReadableBreaks(reader.querySelector('.article-content'));
  reader.querySelectorAll('.summary-open').forEach(button => {
    button.addEventListener('click', () => selectItem(button.dataset.id));
  });
  reader.querySelectorAll('.summary-thumb-button').forEach(button => {
    button.addEventListener('click', () => openLightbox(button.dataset.lightboxSrc, button.dataset.lightboxCaption));
  });
}
function openLightbox(src, caption) {
  lightboxImage.src = src;
  lightboxImage.alt = caption || '放大查看的截图';
  lightboxCaption.textContent = caption || '';
  lightbox.classList.add('open');
  lightbox.setAttribute('aria-hidden', 'false');
}
function closeLightbox() { lightbox.classList.remove('open'); lightbox.setAttribute('aria-hidden', 'true'); lightboxImage.src = ''; }
lightboxClose.addEventListener('click', closeLightbox);
lightbox.addEventListener('click', event => { if (event.target === lightbox) closeLightbox(); });
document.addEventListener('keydown', event => { if (event.key === 'Escape') closeLightbox(); });
function updateHash() {
  const params = new URLSearchParams();
  if (state.view === 'path') {
    params.set('view', 'path');
    if (state.pathId !== 'all') params.set('path', state.pathId);
  } else if (state.docId !== 'all') {
    params.set('doc', state.docId);
  }
  if (state.query) params.set('q', state.query);
  if (state.sort !== 'source') params.set('sort', state.sort);
  if (state.activeId) params.set('id', state.activeId);
  history.replaceState(null, '', `${location.pathname}#${params.toString()}`);
}
function readHash() {
  const params = new URLSearchParams(location.hash.replace(/^#/, ''));
  state.view = params.get('view') === 'path' ? 'path' : 'docs';
  state.docId = params.get('doc') || 'all';
  state.pathId = params.get('path') || 'all';
  state.query = params.get('q') || '';
  state.sort = params.get('sort') || (state.view === 'path' ? 'path' : 'source');
  state.activeId = params.get('id');
  searchInput.value = state.query;
  if (sortSelect) sortSelect.value = state.sort;
}
function render() {
  renderDocs();
  const items = getFilteredItems();
  renderResults(items);
  renderMobileNav(items);
  renderReader(state.activeId ? itemById.get(state.activeId) : null);
}
searchInput.addEventListener('input', () => {
  stopSpeech();
  state.query = searchInput.value;
  if (state.view === 'path') state.pathId = 'all';
  else state.docId = 'all';
  state.activeId = null;
  updateHash();
  render();
  scrollPaneToTop(resultList);
  scrollPaneToTop(reader);
});
sortSelect.addEventListener('change', () => {
  state.sort = sortSelect.value;
  render();
  scrollPaneToTop(resultList);
  scrollPaneToTop(reader);
});
if (docModeButton) {
  docModeButton.addEventListener('click', () => {
    state.sort = 'source';
    if (sortSelect) {
      sortSelect.value = 'source';
      syncCustomSelect(sortSelect);
    }
    switchView('docs');
  });
}
if (pathModeButton) {
  pathModeButton.addEventListener('click', () => {
    state.sort = 'path';
    if (sortSelect) {
      sortSelect.value = 'path';
      syncCustomSelect(sortSelect);
    }
    switchView('path');
  });
}
mobileDocSelect.addEventListener('change', () => {
  const [view, id = 'all'] = mobileDocSelect.value.split(':');
  if (view === 'path') selectPath(id);
  else selectDoc(id);
});
mobileItemSelect.addEventListener('change', () => {
  if (mobileItemSelect.value) selectItem(mobileItemSelect.value);
});
clearFilters.addEventListener('click', () => {
  const currentView = state.view;
  state.view = currentView;
  state.docId = 'all';
  state.pathId = 'all';
  state.query = '';
  state.sort = currentView === 'path' ? 'path' : 'source';
  state.activeId = null;
  searchInput.value = '';
  sortSelect.value = state.sort;
  updateHash();
  render();
  syncCustomSelect(sortSelect);
  scrollPaneToTop(resultList);
  scrollPaneToTop(reader);
});
copyLink.addEventListener('click', async () => {
  updateHash();
  try {
    await navigator.clipboard.writeText(location.href);
    copyLink.classList.add('copied');
    copyLink.setAttribute('aria-label', '已复制当前链接');
    copyLink.setAttribute('title', '已复制');
    setTimeout(() => {
      copyLink.classList.remove('copied');
      copyLink.setAttribute('aria-label', '复制当前链接');
      copyLink.setAttribute('title', '复制当前链接');
    }, 1200);
  } catch {
    copyLink.setAttribute('aria-label', '复制失败');
    copyLink.setAttribute('title', '复制失败');
    setTimeout(() => {
      copyLink.setAttribute('aria-label', '复制当前链接');
      copyLink.setAttribute('title', '复制当前链接');
    }, 1200);
  }
});
if (syncButton) {
  syncButton.addEventListener('click', event => {
    event.stopPropagation();
    openSyncModal();
  });
}
if (syncClose) syncClose.addEventListener('click', closeSyncModal);
if (syncModal) {
  syncModal.addEventListener('click', event => {
    if (event.target === syncModal) closeSyncModal();
  });
}
if (syncForm) {
  syncForm.addEventListener('submit', async event => {
    event.preventDefault();
    const config = normalizeSyncConfigFromForm();
    if (!config.gistId || !config.token) {
      setSyncStatus('请填写 Gist ID 和 GitHub Token', 'error');
      return;
    }
    saveSyncConfig(config);
    await syncLearned();
  });
}
if (syncNow) {
  syncNow.addEventListener('click', () => {
    const config = normalizeSyncConfigFromForm();
    if (config.gistId && config.token) saveSyncConfig(config);
    syncLearned();
  });
}
if (syncForget) {
  syncForget.addEventListener('click', () => {
    syncState.config = null;
    try { localStorage.removeItem(LEARNED_SYNC_STORAGE_KEY); } catch {}
    syncGistId.value = '';
    syncToken.value = '';
    syncFileName.value = DEFAULT_SYNC_FILE;
    updateSyncState('neutral');
  });
}
if (readerTopButton) {
  readerTopButton.addEventListener('click', () => {
    scrollPaneToTop(reader);
  });
}
if (readerSpeechButton) {
  let speechLongPressStopped = false;
  let speechPointerHandled = false;
  readerSpeechButton.addEventListener('click', () => {
    if (speechLongPressStopped) {
      speechLongPressStopped = false;
      return;
    }
    if (speechPointerHandled) {
      speechPointerHandled = false;
      return;
    }
    toggleSpeech();
  });
  readerSpeechButton.addEventListener('contextmenu', event => {
    event.preventDefault();
    stopSpeech();
  });
  let speechHoldTimer = null;
  readerSpeechButton.addEventListener('pointerdown', event => {
    if (event.button != null && event.button !== 0) return;
    speechLongPressStopped = false;
    speechPointerHandled = true;
    toggleSpeech();
    speechHoldTimer = window.setTimeout(() => {
      stopSpeech();
      speechLongPressStopped = true;
      speechHoldTimer = null;
    }, 650);
  });
  ['pointerup', 'pointerleave', 'pointercancel'].forEach(type => {
    readerSpeechButton.addEventListener(type, () => {
      if (speechHoldTimer) {
        window.clearTimeout(speechHoldTimer);
        speechHoldTimer = null;
      }
    });
  });
}
if (markLearnedButton) {
  markLearnedButton.addEventListener('click', () => {
    if (!state.activeId) return;
    learnedIds.add(state.activeId);
    saveLearnedIds();
    const scrollTop = reader.scrollTop;
    const items = getFilteredItems();
    renderResults(items);
    renderMobileNav(items);
    renderReader(itemById.get(state.activeId));
    reader.scrollTop = scrollTop;
    queueLearnedSync();
  });
}
document.addEventListener('click', () => closeCustomSelects());
document.addEventListener('keydown', event => {
  if (event.key === 'Escape') closeCustomSelects();
  if (event.key === 'Escape') closeSyncModal();
});
preGeneratedAudio.addEventListener('ended', () => {
  if (speechState.mode === 'audio') stopSpeech();
});
preGeneratedAudio.addEventListener('error', () => {
  if (speechState.mode !== 'audio') return;
  stopSpeech();
  window.alert('音频播放失败，请检查文件是否已生成。');
});
readHash();
setupCustomSelects();
renderStats();
render();
updateSyncState();
queueLearnedSync();
setInterval(() => {
  if (hasSyncConfig()) syncLearned();
}, 60000);
if ('serviceWorker' in navigator && location.protocol !== 'file:') {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./service-worker.js').catch(() => null);
  });
}
window.addEventListener('scroll', lockHorizontalScroll, { passive: true });
if (reader) reader.addEventListener('scroll', lockHorizontalScroll, { passive: true });
window.addEventListener('resize', lockHorizontalScroll);
lockHorizontalScroll();
