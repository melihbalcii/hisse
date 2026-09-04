// BIST fiyat verisi — Yahoo Finance (bedava, anahtarsiz, ~15dk gecikmeli).
const CHART = s => `https://query1.finance.yahoo.com/v8/finance/chart/${s}`;
const UA = { 'User-Agent': 'Mozilla/5.0' };

/** BIST sembolunu Yahoo bicimine cevirir: THYAO -> THYAO.IS */
// BIST kodlarina .IS eklenir; doviz (USDTRY=X) ve endeks (^GSPC) sembolleri oldugu gibi gecer
export const sembol = k => (/[.=^]/.test(k) ? k : `${k.toUpperCase()}.IS`);

/** Gunluk/dakikalik mum verisi + anlik ozet. */
export async function fiyat(kod, { range = '1mo', interval = '1d' } = {}) {
  const u = `${CHART(sembol(kod))}?range=${range}&interval=${interval}`;
  const r = await fetch(u, { headers: UA, signal: AbortSignal.timeout(20000) });
  if (!r.ok) throw new Error(`${kod}: HTTP ${r.status}`);
  const j = await r.json();
  const res = j.chart?.result?.[0];
  if (!res) throw new Error(`${kod}: veri yok`);
  const m = res.meta, q = res.indicators?.quote?.[0] ?? {};
  return {
    kod: kod.toUpperCase(),
    ad: m.longName ?? m.shortName ?? '',
    fiyat: m.regularMarketPrice,
    degisimYuzde: m.regularMarketChangePercent,
    oncekiKapanis: m.chartPreviousClose,
    gunDusuk: m.regularMarketDayLow,
    gunYuksek: m.regularMarketDayHigh,
    hacim: m.regularMarketVolume,
    yil52Dusuk: m.fiftyTwoWeekLow,
    yil52Yuksek: m.fiftyTwoWeekHigh,
    paraBirimi: m.currency,
    mumlar: (res.timestamp ?? []).map((t, i) => ({
      t: new Date(t * 1000),
      a: q.open?.[i], y: q.high?.[i], d: q.low?.[i], k: q.close?.[i], h: q.volume?.[i],
    })).filter(c => c.k != null),
  };
}

/** Birden fazla hisseyi paralel ceker; basarisizlari atlar. */
export async function fiyatlar(kodlar, opt) {
  const out = await Promise.all(kodlar.map(k => fiyat(k, opt).catch(e => ({ kod: k, hata: e.message }))));
  return out;
}

/** Basit hareketli ortalama. */
export const sma = (mumlar, n) => {
  if (mumlar.length < n) return null;
  const son = mumlar.slice(-n);
  return son.reduce((a, c) => a + c.k, 0) / n;
};
