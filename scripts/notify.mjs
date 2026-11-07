// IPOTrack — anlık bildirim görevi (GitHub Actions, 30 dakikada bir)
//  1) Takip edilen SPK başvurusu onay listesinden çıktıysa → takipçilere bildirim
//  2) Favori / portföydeki hissede yeni temettü, bedelsiz ya da bedelli → Pro üyelere bildirim
// Durum Firestore'da (system/notifyState) tutulur; ilk çalıştırmada kimseye bildirim gitmez.
// Gerekli gizli değer: FIREBASE_SERVICE_ACCOUNT (servis hesabı JSON içeriği)
import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { calendar, sleep } from './lib-halkarz.mjs';

const sa = process.env.FIREBASE_SERVICE_ACCOUNT;
if (!sa) { console.log('FIREBASE_SERVICE_ACCOUNT tanımlı değil, bildirim görevi atlandı.'); process.exit(0); }
initializeApp({ credential: cert(JSON.parse(sa)) });
const db = getFirestore();

const UA = { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130 Safari/537.36', 'Accept-Language': 'tr-TR,tr;q=0.9' };

// ── SPK onay bekleyen başvurular (build-ipo-data.mjs ile aynı kaynak) ──────
const SPK = 'https://spk.gov.tr/istatistikler/basvurular/';
const SPK_PAGES = ['ilk-halka-arz-basvurusu', 'gayrimenkul-yatirim-ortakligi-halka-arz-basvurusu', 'girisim-sermayesi-yatirim-ortakligi-halka-arz-basvurusu'];
async function spkNames() {
  const names = new Set();
  for (const slug of SPK_PAGES) {
    let html = '';
    for (let i = 0; i < 3 && !html; i++) {
      try { const r = await fetch(SPK + slug, { headers: UA }); if (r.ok) html = await r.text(); } catch {}
      if (!html) await sleep(1500);
    }
    if (!html) return null; // bir sayfa bile alınamazsa yanlış "listeden çıktı" uyarısı vermemek için dur
    for (const tr of html.split(/<tr[\s>]/i).slice(1)) {
      const cells = [...tr.matchAll(/<td[^>]*>([\s\S]*?)<\/td>/gi)].map(m => m[1].replace(/<[^>]+>/g, ' ').replace(/&amp;/g, '&').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim());
      const date = cells.find(c => /^\d{2}\.\d{2}\.\d{4}$/.test(c));
      const name = cells.find(c => c.length > 3 && !/^\d+$/.test(c) && c !== date);
      if (name && date) names.add(name);
    }
    await sleep(500);
  }
  return names;
}

// ── Expo push ──────────────────────────────────────────────────────────────
async function sendPush(messages) {
  const valid = messages.filter(m => typeof m.to === 'string' && m.to.startsWith('ExponentPushToken'));
  for (let i = 0; i < valid.length; i += 100) {
    const batch = valid.slice(i, i + 100);
    try {
      const r = await fetch('https://exp.host/--/api/v2/push/send', {
        method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json' }, body: JSON.stringify(batch),
      });
      console.log('push', batch.length, r.status);
    } catch (e) { console.error('push hatası', e.message); }
  }
  return valid.length;
}

const isPro = u => u.isPremium === true || u.subscriptionActive === true;
const wants = (u, key) => (u.notificationPrefs?.[key] ?? true) !== false;

async function usersByIds(ids) {
  const out = [];
  const list = [...new Set(ids)];
  for (let i = 0; i < list.length; i += 100) {
    const refs = list.slice(i, i + 100).map(id => db.collection('users').doc(id));
    if (refs.length) out.push(...(await db.getAll(...refs)).filter(s => s.exists).map(s => ({ id: s.id, ...s.data() })));
  }
  return out;
}

// Bir hisseyi takip eden (favori ya da portföyde açık pozisyonu olan) kullanıcılar
async function followersOf(code) {
  const ids = new Set();
  const fav = await db.collection('users').where('favoriteStocks', 'array-contains', code).get();
  fav.forEach(d => ids.add(d.id));
  const port = await db.collection('portfolios').where('ticker', '==', code).get();
  port.forEach(d => { const p = d.data(); if ((p.lots ?? 0) > 0 && p.userId) ids.add(p.userId); });
  return usersByIds([...ids]);
}

// ── Çalıştır ───────────────────────────────────────────────────────────────
const stateRef = db.collection('system').doc('notifyState');
const state = (await stateRef.get()).data() || {};
const firstRun = !state.initialized;
const messages = [];
const notified = { drafts: 0, corporate: 0 };

// 1) SPK başvuruları
const names = await spkNames();
if (names && names.size > 20) {
  const before = new Set(state.spkNames || []);
  const gone = [...before].filter(n => !names.has(n));
  if (!firstRun) {
    for (const name of gone) {
      const snap = await db.collection('users').where('draftFollows', 'array-contains', name).get();
      snap.forEach(d => {
        const u = d.data();
        if (!u.fcmToken || !wants(u, 'newIPO')) return;
        messages.push({
          to: u.fcmToken, sound: 'default', channelId: 'ipo-reminders',
          title: '📣 Takip ettiğin başvuruda gelişme',
          body: `${name} SPK'nın onay bekleyenler listesinden çıktı. Halka arz onayı almış olabilir.`,
          data: { type: 'draft', name },
        });
        db.collection('users').doc(d.id).update({ notifiedDrafts: FieldValue.arrayUnion(name) }).catch(() => {});
        notified.drafts++;
      });
    }
  }
  state.spkNames = [...names];
}

// 2) Temettü / bedelsiz / bedelli (favori ya da portföydeki hisseler, Pro)
let cal = null;
try { cal = await calendar(); } catch (e) { console.error('takvim alınamadı', e.message); }
if (cal) {
  const rows = [
    ...cal.dividends.map(d => ({ key: `div|${d.code}|${d.date}`, code: d.code, title: `💰 ${d.code} temettü`, body: `${d.code} hisse başına ${d.amount} net temettü ödeyecek${d.date ? ` (${d.date.split('-').reverse().join('.')})` : ''}.` })),
    ...cal.bonus.map(b => ({ key: `bonus|${b.code}|${b.pct}`, code: b.code, title: `🎁 ${b.code} bedelsiz`, body: `${b.code} için ${b.pct} bedelsiz sermaye artırımı ${b.date ? 'tarihi belli oldu' : 'gündemde'}${b.spk ? ' (SPK onaylı)' : ''}.` })),
    ...cal.rights.map(b => ({ key: `rights|${b.code}|${b.pct}`, code: b.code, title: `📄 ${b.code} bedelli`, body: `${b.code} için ${b.pct} bedelli sermaye artırımı ${b.spk ? 'SPK onayı aldı' : 'gündemde'}.` })),
  ];
  const seen = new Set(state.calendarKeys || []);
  const fresh = rows.filter(r => r.code && !seen.has(r.key));
  if (!firstRun) {
    for (const r of fresh.slice(0, 40)) {
      const users = await followersOf(r.code);
      for (const u of users) {
        if (!u.fcmToken || !isPro(u) || !wants(u, 'priceAlert')) continue;
        messages.push({ to: u.fcmToken, sound: 'default', channelId: 'default', title: r.title, body: r.body, data: { type: 'stock', code: r.code } });
        notified.corporate++;
      }
    }
  }
  state.calendarKeys = [...new Set([...rows.map(r => r.key), ...(state.calendarKeys || [])])].slice(0, 1500);
}

const sent = messages.length ? await sendPush(messages) : 0;
await stateRef.set({ ...state, initialized: true, lastRun: new Date().toISOString() });
// Uygulamanın okuyabileceği durum: sunucu bildirimleri çalışıyorsa yerel kontroller kapanır
await db.collection('system').doc('public').set({ pushActive: true, lastRun: new Date().toISOString() }, { merge: true });
console.log(firstRun ? 'İlk çalıştırma: durum kaydedildi, bildirim gönderilmedi.' : `Gönderilen bildirim: ${sent} (başvuru ${notified.drafts}, şirket ${notified.corporate})`);
