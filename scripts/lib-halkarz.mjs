// halkarz.com sayfalarından halka arz arşivi, taslak arzlar ve şirket takvimi okur.
// Tarayıcıda test edilen ayrıştırıcıların Node (linkedom) sürümü.
import { parseHTML } from 'linkedom';

const UA = { 'User-Agent': 'Mozilla/5.0 (compatible; IPOTrackBot/1.0; +https://berkaytemel.github.io/ipotrack-privacy/)' };
export const sleep = ms => new Promise(r => setTimeout(r, ms));

export async function getDoc(url) {
  for (let i = 0; i < 3; i++) {
    try {
      const r = await fetch(url, { headers: UA });
      if (r.status === 404) return null;
      if (r.ok) return parseHTML(await r.text()).document;
    } catch {}
    await sleep(1500 * (i + 1));
  }
  return null;
}

const num = s => {
  if (s === null || s === undefined) return null;
  const m = String(s).replace(/\./g, '').replace(',', '.').match(/-?\d+(\.\d+)?/);
  return m ? Number(m[0]) : null;
};
const TRM = { ocak: 1, 'şubat': 2, mart: 3, nisan: 4, 'mayıs': 5, haziran: 6, temmuz: 7, 'ağustos': 8, 'eylül': 9, ekim: 10, 'kasım': 11, 'aralık': 12 };
const trIso = s => {
  if (!s) return null;
  const m = s.toLocaleLowerCase('tr-TR').match(/(\d{1,2})\s+([a-zçğıöşü]+)\s+(\d{4})/);
  if (!m || !TRM[m[2]]) return null;
  return `${m[3]}-${String(TRM[m[2]]).padStart(2, '0')}-${m[1].padStart(2, '0')}`;
};
// "06.11.2026" → "2026-11-06"
const dotIso = s => { const m = (s || '').match(/(\d{2})\.(\d{2})\.(\d{4})/); return m ? `${m[3]}-${m[2]}-${m[1]}` : null; };
const slugOf = url => (url || '').replace(/\/+$/, '').split('/').pop();

// Liste sayfası: /k/halka-arz/2026/ ya da /k/taslak/ (sayfalı)
export async function listPages(base, maxPages = 20) {
  const out = [];
  for (let p = 1; p <= maxPages; p++) {
    const doc = await getDoc(base + (p > 1 ? `page/${p}/` : ''));
    if (!doc) break;
    const items = [...doc.querySelectorAll('.il-content')].map(c => {
      const a = c.querySelector('.il-halka-arz-sirket a');
      return { code: (c.querySelector('.il-bist-kod')?.textContent || '').trim() || null, name: (a?.textContent || '').trim(), url: a?.getAttribute('href'), slug: slugOf(a?.getAttribute('href')) };
    }).filter(x => x.url);
    if (!items.length) break;
    out.push(...items);
    if (items.length < 20) break;
    await sleep(300);
  }
  return out;
}

// Halka arz detay sayfası
export async function ipoDetail(item, year) {
  const doc = await getDoc(item.url);
  if (!doc) return null;
  const kv = {};
  doc.querySelectorAll('tr').forEach(tr => {
    const em = tr.querySelector('em');
    const td = tr.querySelectorAll('td');
    if (em && td.length >= 2) kv[em.textContent.replace(':', '').trim()] = td[1].textContent.trim().replace(/\s+/g, ' ');
  });
  const t = (doc.body?.textContent || '').replace(/\s+/g, ' ');
  // Sonuç tablosu (Yatırımcı Grubu | Kişi | Lot | Oran)
  let retail = null, total = null;
  const res = [...doc.querySelectorAll('details')].find(d => /Sonuçları/.test(d.querySelector('summary')?.textContent || ''));
  if (res) {
    const rows = [...res.querySelectorAll('tr')].map(tr => [...tr.querySelectorAll('td,th')].map(c => c.textContent.trim()));
    const rr = rows.find(r => /Bireysel/i.test(r[0] || ''));
    if (rr) retail = { people: num(rr[1]), lots: num(rr[2]) };
    const tt = rows.find(r => /Toplam/i.test(r[0] || ''));
    if (tt) total = { people: num(tt[1]), lots: num(tt[2]) };
  }
  const dist = t.match(/([\d.]+)\s*katılım\s*~\s*([\d.,]+)\s*Lot/i);
  const dates = kv['Halka Arz Tarihi'] || '';
  const last = dates.match(/(\d{1,2})\s+([A-Za-zÇĞİÖŞÜçğıöşü]+)\s+(\d{4})\s*$/);
  const fp = (kv['Fiili Dolaşımdaki Pay Oranı (%)'] || '').replace('%', '').replace(',', '.');
  return {
    code: (kv['Bist Kodu'] || item.code || '').trim() || null,
    name: item.name, slug: item.slug, year,
    dates, endDate: trIso(last ? last[0] : dates), listDate: trIso(kv['Bist İlk İşlem Tarihi']),
    price: num(kv['Halka Arz Fiyatı/Aralığı']),
    method: kv['Dağıtım Yöntemi'] || null,
    lots: num(kv['Pay']),
    retailLots: retail?.lots ?? null,
    broker: (kv['Aracı Kurum'] || '').replace(/\s*(Yatırım\s+)?Menkul\s+Değerler\s*A\.?Ş\.?$/i, '').replace(/\s*A\.?Ş\.?$/i, '').trim() || null,
    market: kv['Pazar'] || null,
    floatPct: fp ? parseFloat(fp) : null,
    participants: dist ? num(dist[1]) : retail?.people ?? null,
    lotsPerPerson: dist ? num(dist[2]) : null,
    totalParticipants: total?.people ?? null,
    katilim: /Katılım Endeksine uygun değil/i.test(t) ? false : /Katılım Endeksine uygun/i.test(t) ? true : null,
    size: (t.match(/Halka Arz Büyüklüğü\s*[～~]?\s*([\d.,]+\s*(Milyar|Milyon)\s*TL)/i) || [])[1] || null,
    discount: num((t.match(/Halka Arz İskontosu\s*-?\s*%\s*([\d.,]+)/i) || [])[1]),
    retailPct: num((t.match(/Lot\s*\(%\s*(\d+)\)\s*Yurt İçi Bireysel/i) || [])[1]),
  };
}

// Tablolu takvim sayfaları: ilk sütun "KOD Şirket adı"
function tableRows(table) {
  return [...table.querySelectorAll('tr')].slice(1).map(tr => [...tr.children].map(c => c.textContent.trim().replace(/\s+/g, ' ')))
    .filter(r => r.length > 1 && r[0] && !/^\.\.\./.test(r[0]))
    .map(r => { const m = r[0].match(/^([A-Z0-9]{3,6})\s+(.*)$/); return { code: m ? m[1] : r[0], name: m ? m[2] : '', cells: r.slice(1) }; });
}

export async function calendar() {
  const out = { dividends: [], bonus: [], rights: [], earnings: [] };
  const dv = await getDoc('https://halkarz.com/temettu-takvimi/');
  const dvTable = dv?.querySelector('table');
  if (dvTable) out.dividends = tableRows(dvTable).map(r => ({ code: r.code, name: r.name, amount: r.cells[0], pct: num((r.cells[1] || '').replace('%', '').replace('.', ',')), date: dotIso(r.cells[2]) }));
  await sleep(400);
  const sa = await getDoc('https://halkarz.com/sermaye-artirimi/');
  const saTables = sa ? [...sa.querySelectorAll('table')] : [];
  // 1: Bedelsiz, 2: Bedelli, 3: Tahsisli bedelli
  const mapSa = (table, type) => tableRows(table).map(r => {
    // Sütunlar: Yüzde | Tutar | (Rüçhan) | YKK | SPK Onay | Tarih — tarih olanları sırayla al
    const dates = r.cells.slice(2).map(dotIso).filter(Boolean);
    const lastCell = dotIso(r.cells[r.cells.length - 1]);
    return { code: r.code, name: r.name, type, pct: r.cells[0], amount: r.cells[1], ykk: dates[0] || null, spk: dates[1] || null, date: lastCell };
  });
  if (saTables[0]) out.bonus = mapSa(saTables[0], 'bedelsiz');
  if (saTables[1]) out.rights = mapSa(saTables[1], 'bedelli');
  await sleep(400);
  const bl = await getDoc('https://halkarz.com/bilanco-takvimi/');
  const blTable = bl?.querySelector('table');
  if (blTable) out.earnings = tableRows(blTable).map(r => ({ code: r.code, name: r.name, date: dotIso(r.cells[0]) })).filter(x => x.date);
  return out;
}
