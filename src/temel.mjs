// Temel (bilanco/gelir tablosu) verisi — Is Yatirim'in acik ucu, anahtarsiz.
// Turkiye'de mali tablolar KUMULATIFTIR: donem 6 = ilk 6 ay, 12 = tum yil.
// Bu yuzden son 12 ay (TTM) hesabi cikarma gerektirir.
const UC = 'https://www.isyatirim.com.tr/_layouts/15/Isyatirim.Website/Common/Data.aspx/MaliTablo';
const UA = { 'User-Agent': 'Mozilla/5.0' };

const sayi = v => (v == null || v === '' ? null : Number(v));

/** Verilen donemleri tek istekte ceker. Uc EN FAZLA 4 donem donduruyor (olculdu). */
async function tablo(kod, donemler) {
  const q = new URLSearchParams({ companyCode: kod.toUpperCase(), exchange: 'TRY', financialGroup: 'XI_29' });
  donemler.forEach(([y, p], i) => { q.set(`year${i + 1}`, y); q.set(`period${i + 1}`, p); });
  const r = await fetch(`${UC}?${q}`, { headers: UA, signal: AbortSignal.timeout(25000) });
  if (!r.ok) throw new Error(`${kod}: mali tablo HTTP ${r.status}`);
  const j = await r.json();
  if (!j.value?.length) throw new Error(`${kod}: mali tablo bos`);
  const m = new Map(j.value.map(x => [x.itemCode, x]));
  // kalem(kod, kacinciDonem) -> sayi
  return (kalem, i) => sayi(m.get(kalem)?.[`value${i}`]);
}

/** Son yayimlanmis ara donemi bulur (yil, donem). Eylul'de 2026/6 gibi. */
function sonDonem(bugun = new Date()) {
  const y = bugun.getFullYear(), a = bugun.getMonth() + 1;
  if (a >= 11) return [y, 9];        // 3. ceyrek kasimda yayimlanir
  if (a >= 8) return [y, 6];         // yari yil agustosta
  if (a >= 5) return [y, 3];
  return [y - 1, 12];                // yil sonu mart-nisanda
}

/**
 * Bir hissenin Lynch metrikleri icin gereken temel verisi.
 *
 * TTM = cari kumulatif + gecen yil tam - gecen yilin ayni kumulatifi.
 * Ayni formul bir ve iki yil geriye de uygulanir; boylece buyume BAYAT TAM YIL
 * karsilastirmasi yerine gercek son-12-ay/onceki-12-ay olarak olculur.
 *
 * Neden onemli: tam yil karsilastirmasi 20 aya kadar bayat kalabiliyor. EREGL'de
 * eski yontem -%97 gosteriyordu (2025 tam yili cokmustu), gercek TTM buyumesi -%17.
 * Aradaki fark sirketin performansi degil, olcumun gecikmesiydi.
 */
export async function temel(kod, { bugun } = {}) {
  const [y, p] = sonDonem(bugun);
  const gy = y - 1;
  // A: cari kumulatif, gecen yil ayni kumulatif, gecen yil tam, onceki yil tam
  // B: TTM'i bir ve iki yil geriye tasimak icin gereken eski donemler
  const [a, b] = await Promise.all([
    tablo(kod, [[y, p], [gy, p], [gy, 12], [gy - 1, 12]]),
    tablo(kod, [[gy - 1, p], [gy - 2, 12], [gy - 2, p], [gy - 3, 12]])
      .catch(() => null),   // eski veri yoksa sistem calismaya devam eder
  ]);

  // Ucu de "son 12 ay" penceresidir; p=12 iken dogal olarak tam yila esitlenir.
  const ttm = k => {
    const c = a(k, 1), ga = a(k, 2), gt = a(k, 3);
    if (c == null || ga == null || gt == null) return gt;
    return c + gt - ga;
  };
  const ttmGecen = k => {
    if (!b) return null;
    const c = a(k, 2), ga = b(k, 1), gt = a(k, 4);
    return c == null || ga == null || gt == null ? null : c + gt - ga;
  };
  const ttmOnceki = k => {
    if (!b) return null;
    const c = b(k, 1), ga = b(k, 3), gt = b(k, 2);
    return c == null || ga == null || gt == null ? null : c + gt - ga;
  };

  const hisseAdedi = a('2OA', 1);        // odenmis sermaye; nominal 1 TL -> adet
  const borc = (a('2AA', 1) ?? 0) + (a('2BA', 1) ?? 0);   // kisa + uzun finansal borc

  return {
    kod: kod.toUpperCase(),
    donem: `${y}/${p}`,
    hisseAdedi,
    ttmKar: ttm('3Z'),                   // ana ortaklik payi net kar
    ttmSatis: ttm('3C'),
    ozkaynak: a('2N', 1),
    finansalBorc: borc,
    nakit: a('1AA', 1),
    stok: a('1AF', 1),
    // son 12 ay pencereleri — buyume ve tutarlilik bunlardan olculur
    kar12: { simdi: ttm('3Z'), gecen: ttmGecen('3Z'), onceki: ttmOnceki('3Z') },
    satis12: { simdi: ttm('3C'), gecen: ttmGecen('3C'), onceki: ttmOnceki('3C') },
    stokGecen: a('1AF', 3),
    // tam yil karsilastirmalari — TTM hesaplanamazsa yedek olarak kullanilir
    fyKar: { onceki: a('3Z', 3), oncekiOnceki: a('3Z', 4) },
    fySatis: { onceki: a('3C', 3), oncekiOnceki: a('3C', 4) },
    fyStok: { onceki: a('1AF', 3) },
  };
}
