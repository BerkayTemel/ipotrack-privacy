// IPOTrack — halka arz sonuç arşivi ve SPK'da bekleyen başvurular
//  • data/ipos.json   : KAP "Halka Arz Sonuçları" bildirimleri (katılımcı sayısı, fiyat,
//                       büyüklük, aracı kurum) + Yahoo'dan ilk işlem günü, tavan serisi, getiri
//  • data/drafts.json : SPK'nın "İlk Halka Arz", GYO ve GSYO başvuru listeleri
// GitHub Actions her iş günü akşamı çalıştırır.
import { writeFileSync, mkdirSync, existsSync, readFileSync } from 'node:fs';

const UA = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130 Safari/537.36',
  'Accept-Language': 'tr-TR,tr;q=0.9',
};
const sleep = ms => new Promise(r => setTimeout(r, ms));
const N = s => (s == null ? null : Number(String(s).replace(/\./g, '').replace(',', '.')));
const r2 = n => Math.round(n * 100) / 100;
mkdirSync('data', { recursive: true });

async function get(url, opts = {}) {
  for (let i = 0; i < 3; i++) {
    try {
      const r = await fetch(url, { ...opts, headers: { ...UA, ...(opts.headers || {}) } });
      if (r.ok) return r;
      await sleep(1500 * (i + 1));
    } catch { await sleep(1500); }
  }
  return null;
}

// ── KAP: Halka Arz Sonuçları ────────────────────────────────────────────────
const KAP = 'https://www.kap.org.tr';
const SUBJECT_IPO_RESULTS = '4028328d9c4c12ca019c6bf0a40c0518';
// KAP'ta ilişkili hisse kodu bazen aracı kurumun kodu olarak geliyor → düzeltme
const CODE_FIX = { GRM: 'SSAAT', AYX: 'ISVEA' };

async function kapList(from, to, subject) {
  const body = {
    fromDate: from, toDate: to, memberType: '', mkkMemberOidList: [], inactiveMkkMemberOidList: [],
    disclosureClass: '', subjectList: [subject], isLate: '', mainSector: '', sector: '', subSector: '',
    marketOid: '', index: '', bdkReview: '', bdkMemberOidList: [], year: '', term: '', ruleType: '',
    period: '', fromSrc: false, srcCategory: '', disclosureIndexList: [],
  };
  const r = await get(KAP + '/tr/api/disclosure/members/byCriteria', {
    method: 'POST', body: JSON.stringify(body),
    headers: { 'Content-Type': 'application/json', Referer: KAP + '/tr/bildirim-sorgu', Origin: KAP },
  });
  if (!r) return null;
  try { return await r.json(); } catch { return null; }
}

async function kapText(idx) {
  const r = await get(KAP + '/tr/Bildirim/' + idx);
  if (!r) return '';
  let h = await r.text();
  h = h.replace(/\\u003c/g, '<').replace(/\\u003e/g, '>').replace(/\\u0026/g, '&').replace(/\\"/g, '"').replace(/\\n/g, ' ');
  h = h.replace(/<script[\s\S]*?<\/script>/gi, ' ').replace(/<div[^>]*content-en[^>]*>[\s\S]*?<\/div>/gi, ' ');
  return h.replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ');
}

const field = (t, label) => {
  const m = t.match(new RegExp(label.replace(/[()]/g, '\\$&') + '\\s*([0-9][0-9.]*(?:,[0-9]+)?)'));
  return m ? N(m[1]) : null;
};

// ── Yahoo: ilk işlem günü, tavan serisi, getiri ─────────────────────────────
async function chart(code, fromSec) {
  const to = Math.floor(Date.now() / 1000) + 86400;
  for (const host of ['query1', 'query2']) {
    const r = await get(`https://${host}.finance.yahoo.com/v8/finance/chart/${code}.IS?period1=${fromSec}&period2=${to}&interval=1d`);
    if (!r) continue;
    try {
      const j = await r.json();
      const res = j?.chart?.result?.[0];
      if (!res?.timestamp) continue;
      const c = res.indicators?.quote?.[0]?.close ?? [];
      const pts = res.timestamp.map((t, i) => [t * 1000, c[i]]).filter(p => typeof p[1] === 'number');
      const live = res.meta?.regularMarketPrice;
      if (live && pts.length) pts[pts.length - 1][1] = live;
      return pts;
    } catch {}
  }
  return [];
}

function perf(price, pts) {
  if (!price || !pts.length) return {};
  let ceilings = 0, prev = price;
  for (const [, c] of pts) { if (c / prev - 1 >= 0.095) { ceilings++; prev = c; } else break; }
  const closes = pts.map(p => p[1]);
  const last = closes[closes.length - 1];
  const peak = Math.max(...closes);
  // Şu anki (devam eden) tavan serisi
  let streak = 0;
  for (let i = closes.length - 1; i >= 0; i--) {
    const before = i === 0 ? price : closes[i - 1];
    if (closes[i] / before - 1 >= 0.095) streak++; else break;
  }
  return {
    listDate: new Date(pts[0][0]).toISOString().slice(0, 10),
    firstClose: r2(pts[0][1]),
    ceilings, streak,
    last: r2(last), ret: r2((last / price - 1) * 100),
    peak: r2(peak), peakRet: r2((peak / price - 1) * 100),
    days: pts.length,
  };
}

async function buildIpos() {
  const today = new Date().toISOString().slice(0, 10);
  const list = await kapList('2026-01-01', today, SUBJECT_IPO_RESULTS);
  if (!Array.isArray(list)) { console.error('KAP listesi alınamadı'); return null; }
  const byCode = {};
  // Eskiden yeniye işle, düzeltme bildirimleri öncekinin üzerine yazsın
  for (const d of list.slice().reverse()) {
    const raw = String(d.relatedStocks || '').split(',')[0].trim().toUpperCase();
    if (!raw) continue;
    const code = CODE_FIX[raw] || raw;
    const t = await kapText(d.disclosureIndex);
    await sleep(300);
    const shares = field(t, 'SATIŞA SUNULAN PAY ADEDİ');
    const size = field(t, 'HALKA ARZ BÜYÜKLÜĞÜ (TL)');
    let price = field(t, 'HALKA ARZ FİYATI');
    if (!price && shares && size) price = r2(size / shares);
    const investors = field(t, 'TOPLAM YATIRIMCI SAYISI');
    if (!investors) continue;
    const prevEntry = byCode[code];
    byCode[code] = {
      code,
      title: String(d.summary || '').trim(),
      resultDate: d.publishDate?.slice(0, 10).split('.').reverse().join('-'),
      broker: d.kapTitle,
      kap: d.disclosureIndex,
      shares, size, price, investors,
      retail: field(t, 'Yurt İçi Bireysel Yatırımcı Sayısı') || prevEntry?.retail || null,
      institutional: field(t, 'Yurt İçi Kurumsal Yatırımcı Sayısı') ?? prevEntry?.institutional ?? null,
      foreign: field(t, 'Yurt Dışı Kurumsal Yatırımcı Sayısı') ?? null,
    };
  }
  const items = Object.values(byCode);
  for (const it of items) {
    const from = Math.floor(new Date(it.resultDate + 'T00:00:00Z').getTime() / 1000) - 86400;
    const pts = await chart(it.code, from);
    Object.assign(it, perf(it.price, pts));
    await sleep(300);
  }
  items.sort((a, b) => (b.resultDate || '').localeCompare(a.resultDate || ''));
  return items;
}

// ── SPK: onay bekleyen başvurular ───────────────────────────────────────────
const SPK = 'https://spk.gov.tr/istatistikler/basvurular/';
const SPK_PAGES = [
  ['ilk-halka-arz-basvurusu', 'Halka Arz'],
  ['gayrimenkul-yatirim-ortakligi-halka-arz-basvurusu', 'GYO'],
  ['girisim-sermayesi-yatirim-ortakligi-halka-arz-basvurusu', 'GSYO'],
];

function parseTable(html) {
  const rows = [];
  for (const tr of html.split(/<tr[\s>]/i).slice(1)) {
    const cells = [...tr.matchAll(/<td[^>]*>([\s\S]*?)<\/td>/gi)].map(m => m[1].replace(/<[^>]+>/g, ' ').replace(/&amp;/g, '&').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim());
    const date = cells.find(c => /^\d{2}\.\d{2}\.\d{4}$/.test(c));
    const name = cells.find(c => c.length > 3 && !/^\d+$/.test(c) && c !== date);
    if (name && date) rows.push({ name, appliedAt: date.split('.').reverse().join('-') });
  }
  return rows;
}

async function buildDrafts() {
  const out = [];
  for (const [slug, type] of SPK_PAGES) {
    const r = await get(SPK + slug);
    if (!r) continue;
    for (const row of parseTable(await r.text())) out.push({ ...row, type });
    await sleep(500);
  }
  return out;
}

// ── Çalıştır ────────────────────────────────────────────────────────────────
const prev = (f) => { try { return existsSync(f) ? JSON.parse(readFileSync(f, 'utf8')) : null; } catch { return null; } };
const now = new Date().toISOString();

const ipos = await buildIpos();
if (ipos?.length) {
  writeFileSync('data/ipos.json', JSON.stringify({ updatedAt: now, count: ipos.length, items: ipos }));
  console.log('halka arz sonuçları:', ipos.length);
} else console.error('ipos.json güncellenmedi');

const drafts = await buildDrafts();
if (drafts.length > 20) {
  // Listeden düşenleri (onay alan / geri çekilen) kaydet
  const old = prev('data/drafts.json');
  const names = new Set(drafts.map(d => d.name));
  const removed = (old?.items || []).filter(d => !names.has(d.name)).map(d => ({ ...d, removedAt: now.slice(0, 10) }));
  const history = [...removed, ...(old?.removed || [])].slice(0, 100);
  writeFileSync('data/drafts.json', JSON.stringify({ updatedAt: now, count: drafts.length, items: drafts, removed: history }));
  console.log('SPK başvuruları:', drafts.length, 'listeden çıkan:', removed.length);
} else console.error('drafts.json güncellenmedi (', drafts.length, ')');
