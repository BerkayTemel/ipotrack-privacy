// IPOTrack — günlük hisse istatistikleri (1 hafta / 1 ay / 3 ay / 1 yıl değişim)
// GitHub Actions her iş günü akşamı çalıştırır, data/stats.json dosyasını yazar.
// Ek hisse eklemek için data/extra-symbols.txt dosyasına boşlukla ayrılmış kod yazın.
import { writeFileSync, readFileSync, existsSync, mkdirSync } from 'node:fs';

const BASE = 'A1CAP A1YEN AAGYO ACSEL ADEL ADESE ADGYO AEFES AFYON AGESA AGHOL AGROT AGYO AHGAZ AHSGY AKBNK AKCNS AKENR AKFGY AKFIS AKFYE AKGRT AKHAN AKMGY AKSA AKSEN AKSGY AKSUE AKYHO ALARK ALBRK ALBTN ALCAR ALCTL ALFAS ALGYO ALKA ALKIM ALKLC ALTNY ALVES ANELE ANGEN ANHYT ANSGR ARASE ARCLK ARDYZ ARENA ARFYE ARMGD ARSAN ARTMS ARZUM ASELS ASGYO ASTOR ASUZU ATAGY ATAKP ATATP ATATR ATLAS AVGYO AVHOL AVOD AVPGY AVTUR AYCES AYDEM AYEN AYGAZ AZTEK BAGFS BAHKM BAKAB BALAT BALSU BANVT BASCM BASGZ BAYRK BEGYO BERA BESLR BESTE BETAE BEYAZ BFREN BIENY BIGCH BIGEN BIGTK BIMAS BINBN BINHO BIOEN BIZIM BJKAS BKRGY BLCYT BLUME BMSCH BMSTL BNTAS BOBET BORLS BORSK BOSSA BRISA BRKSN BRKVY BRLSM BRSAN BRYAT BSOKE BTCIM BUCIM BULGS BURCE BURVA BVSAN BYDNR CANTE CATES CCOLA CELHA CEMAS CEMTS CEMZY CEOEM CGCAM CIMSA CITAS CLEBI CMBTN CMENT CONSE COSMO CRDFA CRFSA CUSAN CVKMD CWENE DAGI DAPGM DARDL DCTTR DENGE DERHL DERIM DESA DESPC DEVA DGATE DGGYO DGNMO DITAS DMRGD DMSAS DNISI DOAS DOCO DOFER DOFRB DOGUB DOHOL DOKTA DSTKF DUNYH DURDO DURKN DYOBY DZGYO EBEBK ECILC ECOGR ECZYT EDATA EDIP EFOR EGEEN EGEGY EGEPO EGGUB EGPRO EGSER EKDMR EKGYO EKIM EKOS EKSUN ELITE EMKEL EMPAE ENDAE ENERY ENJSA ENKAI ENSRI ENTRA EPLAS ERBOS ERCB EREGL ERSU ESCAR ESCOM ESEN ETILR ETYAT EUKYO EUPWR EUREN EUYO EYGYO FADE FENER FLAP FMIZP FONET FORMT FORTE FRIGO FRMPL FROTO FZLGY GARAN GARFA GEDIK GEDZA GENIL GENKM GENTS GEREL GESAN GIPTA GLBMD GLCVY GLRMK GLRYH GLYHO GMTAS GOKNR GOLDA GOLTS GOODY GOZDE GRNYO GRSEL GRTHO GSDDE GSDHO GSRAY GUBRF GUNDG GWIND GZNMI HALKB HATEK HATSN HDFGS HEDEF HEKTS HKTM HLGYO HOROZ HRKET HTTBT HUBVC HUNER HURGZ ICBCT ICUGS IDGYO IEYHO IHAAS IHEVA IHGZT IHLAS IHLGM IHYAY IMASM INDES INFO INGRM INTEK INTEM INTET INVEO INVES ISBIR ISCTR ISDMR ISFIN ISGSY ISGYO ISKPL ISMEN ISSEN ISVEA ISYAT IZENR IZFAS IZINV IZMDC JANTS KAPLM KARCL KAREL KARSN KARTN KATMR KAYSE KBORU KCAER KCHOL KFEIN KGYO KIMMR KLGYO KLKIM KLMSN KLNMA KLRHO KLSER KLSYN KLYPV KMPUR KNFRT KOCMT KONKA KONYA KOPOL KORDS KOTON KPEKS KRDMD KRGYO KRONT KRPLS KRSTL KRTEK KRVGD KSTUR KTLEV KTSKR KUTPO KUVVA KUYAS KZBGY KZGYO LIDER LIDFA LILAK LINK LKMNH LMKDC LOGO LRSHO LUKSK LXGYO LYDHO LYDYE MAALT MACKO MAGEN MAKIM MAKTK MANAS MARBL MARMR MARTI MASFN MAVI MCARD MEDTR MEGMT MEKAG MEPET MERCN MERIT MERKO METEN METRO MEYSU MGROS MHRGY MIATK MNDRS MNDTR MOBTL MOGAN MOPAS MPARK MRGYO MRSHL MSGYO MTRKS MTRYO MZHLD NATEN NETAS NETCD NETGL NIBAS NTGAZ NTHOL NUGYO NUHCM OBAMS OBASE ODAS ODINE OFSYM ONCSM ONRYT ORCAY ORGE ORMA ORZAX OSMEN OSTIM OTKAR OTTO OYAKC OYAYO OYLUM OYYAT OZATD OZGYO OZKGY OZRDN OZSUB OZYSR PAGYO PAHOL PAMEL PAPIL PARSN PASEU PATEK PCILT PEKGY PENGD PENTA PETKM PETUN PGSUS PINSU PKART PKENT PLTUR PNLSN PNSUT POLHO POLTK PRDGS PRKAB PRKME PRZMA PSDTC PSGYO QUAGR QUICK RAYSG REEDR RGYAS RNPOL RODRG RTALB RUBNS RUZYE RYGYO RYSAS SAFKR SAHOL SAMAT SANEL SANFM SANKO SARAE SARKY SASA SAYAS SDTTR SEGMN SEGYO SEKFK SEKUR SELEC SELVA SERNT SEYKM SILVR SISE SKBNK SKTAS SKYLP SKYMD SMART SMRTG SMRVA SNGYO SNICA SNPAM SOHOE SOKE SOKM SONME SRVGY SSAAT SUMAS SUNTK SURGY SUWEN SVGYO TABGD TARKM TATEN TATGD TAVHL TBORG TCELL TCKRC TDGYO TEHOL TEKTU TEZOL TGSAS THYAO TKFEN TKNKA TKNSA TLMAN TMPOL TMSN TNZTP TOASO TRALT TRCAS TRENJ TRGYO TRHOL TRMET TSGYO TSKB TSPOR TTKOM TTRAK TUCLK TUKAS TUPRS TUREX TURGG TURSG UCAYM UFUK ULAS ULKER ULUFA ULUSE ULUUN UMPAS UNLU USAK USHOL VAKBN VAKFA VAKFN VAKKO VANGD VBTYZ VERTU VERUS VESBE VESTL VEYAS VKFYO VKGYO VKING VRGYO VSNMD YAPRK YATAS YAYLA YEOTK YESIL YGGYO YIGIT YKBNK YKSLN YUNSA YYLGD ZEDUR ZERGY ZGYO ZOREN ZRGYO'.split(' ');
const extra = existsSync('data/extra-symbols.txt')
  ? readFileSync('data/extra-symbols.txt', 'utf8').split(/\s+/).filter(Boolean).map(s => s.toUpperCase())
  : [];
const CODES = [...new Set([...BASE, ...extra])];
const UA = { 'User-Agent': 'Mozilla/5.0 (compatible; IPOTrackStats/1.0)' };
const sleep = ms => new Promise(r => setTimeout(r, ms));

async function getJson(url) {
  for (let i = 0; i < 3; i++) {
    try {
      const r = await fetch(url, { headers: UA });
      if (r.ok) return await r.json();
      if (r.status === 429) await sleep(3000 * (i + 1));
    } catch { await sleep(1000); }
  }
  return null;
}

// Önce toplu (spark, 20'li), olmazsa tek tek (chart)
async function series(codes) {
  const out = {};
  for (let i = 0; i < codes.length; i += 20) {
    const batch = codes.slice(i, i + 20);
    const syms = batch.map(c => c + '.IS').join(',');
    const j = await getJson('https://query1.finance.yahoo.com/v7/finance/spark?symbols=' + encodeURIComponent(syms) + '&range=1y&interval=1d');
    for (const r of j?.spark?.result ?? []) {
      const resp = r.response?.[0];
      const t = resp?.timestamp, c = resp?.indicators?.quote?.[0]?.close;
      // Son günün kapanışı bazen boş gelir → güncel piyasa fiyatını kullan
      const lastPx = resp?.meta?.regularMarketPrice;
      if (t && c) out[r.symbol.replace('.IS', '')] = t.map((x, k) => [x * 1000, c[k] ?? (k === t.length - 1 ? lastPx : null)]).filter(p => typeof p[1] === 'number');
    }
    await sleep(400);
  }
  for (const code of codes) {
    if (out[code]?.length) continue;
    const j = await getJson('https://query2.finance.yahoo.com/v8/finance/chart/' + code + '.IS?range=1y&interval=1d');
    const r = j?.chart?.result?.[0];
    const t = r?.timestamp, c = r?.indicators?.quote?.[0]?.close;
    if (t && c) out[code] = t.map((x, k) => [x * 1000, c[k]]).filter(p => typeof p[1] === 'number');
    await sleep(250);
  }
  return out;
}

const r2 = n => Math.round(n * 100) / 100;
const sig = n => Number(n.toPrecision(5));

function stat(points) {
  if (!points?.length) return null;
  const last = points[points.length - 1][1];
  const now = points[points.length - 1][0];
  const at = days => { const target = now - days * 86400000; let v; for (const [t, c] of points) { if (t <= target) v = c; else break; } return v; };
  const pct = from => (from ? r2((last / from - 1) * 100) : undefined);
  const jan1 = Date.UTC(new Date(now).getUTCFullYear(), 0, 1);
  const ytdBase = points.filter(p => p[0] < jan1).pop()?.[1];
  const closes = points.map(p => p[1]);
  // Devam eden tavan serisi (her gün ≥ %9,5 kapanış)
  let t = 0;
  for (let i = closes.length - 1; i > 0; i--) { if (closes[i] / closes[i - 1] - 1 >= 0.095) t++; else break; }
  return {
    t,
    p: sig(last),
    w: pct(at(7)), m: pct(at(30)), m3: pct(at(91)), y: pct(at(365)), ytd: pct(ytdBase),
    h52: sig(Math.max(...closes)), l52: sig(Math.min(...closes)),
    s: closes.slice(-22).map(sig),
  };
}

const data = await series(CODES);
const stocks = {};
for (const code of CODES) { const s = stat(data[code]); if (s) stocks[code] = s; }
const count = Object.keys(stocks).length;
console.log('hisse:', count, '/', CODES.length);
if (count < CODES.length * 0.5) { console.error('Çok az veri geldi, dosya güncellenmedi.'); process.exit(1); }
mkdirSync('data', { recursive: true });
writeFileSync('data/stats.json', JSON.stringify({ updatedAt: new Date().toISOString(), count, stocks }));
