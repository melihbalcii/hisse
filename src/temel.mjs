// Temel (bilanco/gelir tablosu) verisi — Is Yatirim'in acik ucu, anahtarsiz.
// Turkiye'de mali tablolar KUMULATIFTIR: donem 6 = ilk 6 ay, 12 = tum yil.
// Bu yuzden son 12 ay (TTM) hesabi cikarma gerektirir.
const UC = 'https://www.isyatirim.com.tr/_layouts/15/Isyatirim.Website/Common/Data.aspx/MaliTablo';
const UA = { 'User-Agent': 'Mozilla/5.0' };

const sayi = v => (v == null || v === '' ? null : Number(v));

/** Verilen 4 donemi tek istekte ceker. donemler: [[yil,donem],...] */
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
 * TTM = cari yil kumulatif + onceki yil tam + onceki yilin ayni kumulatifi (cikarma).
 */
export async function temel(kod, { bugun } = {}) {
  const [y, p] = sonDonem(bugun);
  const gecenYil = y - 1;
  // 1: cari kumulatif, 2: gecen yil ayni kumulatif, 3: gecen yil tam, 4: onceki yil tam
  const v = await tablo(kod, [[y, p], [gecenYil, p], [gecenYil, 12], [gecenYil - 1, 12]]);

  const ttm = kalem => {
    const cari = v(kalem, 1), gecenAyni = v(kalem, 2), gecenTam = v(kalem, 3);
    if (cari == null || gecenAyni == null || gecenTam == null) return gecenTam;
    return cari + gecenTam - gecenAyni;   // son 12 ay
  };

  const hisseAdedi = v('2OA', 1);        // odenmis sermaye; nominal 1 TL -> adet
  const borc = (v('2AA', 1) ?? 0) + (v('2BA', 1) ?? 0);   // kisa + uzun finansal borc

  return {
    kod: kod.toUpperCase(),
    donem: `${y}/${p}`,
    hisseAdedi,
    ttmKar: ttm('3Z'),                   // ana ortaklik payi net kar
    ttmSatis: ttm('3C'),
    ozkaynak: v('2N', 1),
    finansalBorc: borc,
    nakit: v('1AA', 1),
    stok: v('1AF', 1),
    // tam yil karsilastirmalari (buyume icin)
    fyKar: { onceki: v('3Z', 3), oncekiOnceki: v('3Z', 4) },
    fySatis: { onceki: v('3C', 3), oncekiOnceki: v('3C', 4) },
    fyStok: { onceki: v('1AF', 3) },
  };
}
