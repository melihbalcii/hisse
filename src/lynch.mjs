// Peter Lynch olcutleriyle mekanik puanlama. LLM yok, yorum yok — sadece formul.
// Esik degerleri Lynch'in "One Up on Wall Street" kitabinda tarif ettigi kurallardir.
import { temel } from './temel.mjs';
import { fiyat } from './fiyat.mjs';

/**
 * Taban donem guvenilir mi? Sifira yakin tabandan cikan %500 gibi oranlar
 * aritmetik olarak dogru, analitik olarak anlamsizdir. Lynch boyle bir sirketi
 * "hizli buyuyen" degil AYRI bir kategori (turnaround) sayar ve ona PEG uygulamaz.
 */
export const tabanSaglam = (yeni, eski) => {
  if (eski == null || eski <= 0 || yeni == null) return false;
  return (yeni / eski - 1) * 100 <= 100;   // kar ikiye katlandiysa taban dusuktu
};

// Taban negatifse yuzde degisim ANLAMSIZDIR: zarardan (-50) kara (+100) gecen
// sirket "-%300 buyume" gosterir — Lynch'in en degerli sinyali ters isaretle girer.
// Bu durumlar yuzdeyle degil, ISARET DEGISIMIYLE ele alinir (bkz. karDurumu).
export const yuzdeDegisim = (yeni, eski) =>
  yeni == null || eski == null || eski <= 0 ? null : (yeni / eski - 1) * 100;

/** Kar/zarar gecisleri — turnaround analizinin cekirdegi. */
export function karDurumu(simdi, gecen) {
  if (simdi == null || gecen == null) return null;
  if (simdi > 0 && gecen > 0) return 'kârlı';
  if (simdi > 0 && gecen <= 0) return 'zarardan kâra';
  if (simdi <= 0 && gecen > 0) return 'kârdan zarara';
  return 'zararda';
}

/**
 * Uc ardisik 12 aylik pencereden kar egilimi. Lynch istikrari onemser:
 * duzenli buyuyen sirketi dalgalanana tercih eder, ve DIPTEN DONEN sirketi
 * (turnaround) ayri bir firsat sayar — sistemin eskiden goremedigi sey buydu.
 */
export function egilim({ simdi, gecen, onceki }) {
  if (simdi == null || gecen == null || onceki == null) return null;
  if (simdi > gecen && gecen > onceki) return 'istikrarlı büyüme';
  if (simdi < gecen && gecen < onceki) return 'istikrarlı daralma';
  if (gecen < onceki && simdi > gecen) return 'toparlanıyor';     // dipten donus
  if (gecen > onceki && simdi < gecen) return 'ivme kaybı';
  return 'dalgalı';
}

/** Lynch'in sirket siniflandirmasi — buyume hizina gore. */
export function kategori(buyume, saglam, durum) {
  if (durum === 'zarardan kâra') return 'toparlanma';   // Lynch'in klasik turnaround'u
  if (durum === 'kârdan zarara') return 'zarara geçen';
  if (durum === 'zararda') return 'zararda';
  if (buyume == null) return 'belirsiz';
  if (!saglam) return 'toparlanma';        // Lynch'in ayri kategorisi: turnaround
  if (buyume < 0) return 'zayıflayan';
  if (buyume < 10) return 'yavaş büyüyen';
  if (buyume < 20) return 'sağlam';
  if (buyume <= 50) return 'hızlı büyüyen';
  return 'aşırı hızlı';
}

/** Her olcut icin puan ve gerekce — esikler Lynch'in kendi kurallari. */
export function puanla(m) {
  const p = [];

  // 1. DEGERLEME — tek yuva, kategoriye gore dogru olcut.
  //    Buyuyen sirkette PEG (Lynch'in merkezi olcutu: "F/K buyume oranina esitse adil").
  //    Buyumeyen/dipten donen sirkette PEG tanimsizdir; Lynch boyle sirketleri
  //    DEFTER DEGERI uzerinden degerlendirirdi. Eskiden negatif buyume hem burada
  //    hem Buyume olcutunde cezalandiriliyordu — ayni bilgi iki kez sayiliyordu.
  if (m.peg != null) {
    if (m.peg < 0.5) p.push([3, 'PEG', `${m.peg.toFixed(2)} — çok ucuz`]);
    else if (m.peg < 1.0) p.push([2, 'PEG', `${m.peg.toFixed(2)} — ucuz`]);
    else if (m.peg < 1.5) p.push([1, 'PEG', `${m.peg.toFixed(2)} — makul`]);
    else if (m.peg < 2.0) p.push([0, 'PEG', `${m.peg.toFixed(2)} — pahalı`]);
    else p.push([-1, 'PEG', `${m.peg.toFixed(2)} — çok pahalı`]);
  } else if (m.pd != null) {
    if (m.pd < 1.0) p.push([2, 'PD/DD', `${m.pd.toFixed(2)} — defter değerinin altında`]);
    else if (m.pd < 1.5) p.push([1, 'PD/DD', `${m.pd.toFixed(2)} — ucuz`]);
    else if (m.pd < 3.0) p.push([0, 'PD/DD', `${m.pd.toFixed(2)} — makul`]);
    else p.push([-1, 'PD/DD', `${m.pd.toFixed(2)} — pahalı`]);
  } else p.push([0, 'Değerleme', 'hesaplanamadı']);

  // 2. Borc/Ozkaynak — Lynch dusuk borcu sart kosar; turnaround'da HAYATTA KALMA testi
  const b = m.borcOzkaynak;
  if (b == null) p.push([0, 'Borç', 'veri yok']);
  else if (b < 0.25) p.push([2, 'Borç', `${b.toFixed(2)} — çok düşük`]);
  else if (b < 0.50) p.push([1, 'Borç', `${b.toFixed(2)} — düşük`]);
  else if (b < 1.00) p.push([0, 'Borç', `${b.toFixed(2)} — orta`]);
  else if (b < 2.00) p.push([-1, 'Borç', `${b.toFixed(2)} — yüksek`]);
  else p.push([-2, 'Borç', `${b.toFixed(2)} — çok yüksek`]);

  // 3. Buyume — %20-25 Lynch'in ideal araligi, %50 ustu surdurulemez sayilir.
  //    Kar dusuyorsa ceza borca gore ayarlanir: borcsuz sirket toparlanabilir,
  //    borclu sirket icin ayni dusus varolussal tehdittir.
  const g = m.buyume;
  if (m.karDurumu === 'zarardan kâra') p.push([2, 'Büyüme', 'zarardan kâra geçmiş']);
  else if (m.karDurumu === 'kârdan zarara') p.push([-2, 'Büyüme', 'kârdan zarara geçmiş']);
  else if (m.karDurumu === 'zararda') p.push([-2, 'Büyüme', 'son 12 ay zararda']);
  else if (g == null) p.push([0, 'Büyüme', 'veri yok']);
  else if (!m.tabanSaglam) p.push([0, 'Büyüme', `%${g.toFixed(0)} — düşük tabandan, ölçülemez`]);
  else if (g < 0) p.push(m.netNakit > 0
    ? [-1, 'Büyüme', `%${g.toFixed(0)} — kâr düşüyor, ama net nakit var`]
    : [-2, 'Büyüme', `%${g.toFixed(0)} — kâr düşüyor`]);
  else if (g < 10) p.push([0, 'Büyüme', `%${g.toFixed(0)} — yavaş`]);
  else if (g < 20) p.push([1, 'Büyüme', `%${g.toFixed(0)} — sağlam`]);
  else if (g <= 25) p.push([2, 'Büyüme', `%${g.toFixed(0)} — ideal aralık`]);
  else if (g <= 50) p.push([1, 'Büyüme', `%${g.toFixed(0)} — hızlı`]);
  else p.push([0, 'Büyüme', `%${g.toFixed(0)} — sürdürülebilirlik şüpheli`]);

  // 4. Egilim — uc yillik kar izi. Dipten donusu odullendirir (Lynch'in turnaround'u).
  if (m.egilim === 'istikrarlı büyüme') p.push([1, 'Eğilim', '3 yıldır kâr artıyor']);
  else if (m.egilim === 'toparlanıyor') p.push([1, 'Eğilim', 'dipten dönüş başlamış']);
  else if (m.egilim === 'istikrarlı daralma') p.push([-1, 'Eğilim', '3 yıldır kâr azalıyor']);
  else if (m.egilim) p.push([0, 'Eğilim', m.egilim]);

  // 5. Net nakit — Lynch nakiti fazla sirketi sever
  if (m.netNakit != null && m.piyasaDegeri > 0) {
    const oran = m.netNakit / m.piyasaDegeri;
    p.push(oran > 0.20
      ? [1, 'Nakit', `net nakit piyasa değerinin %${(oran * 100).toFixed(0)}'i — alım fiyatını düşürür`]
      : [0, 'Nakit', m.netNakit > 0 ? 'net nakit var ama küçük' : 'net borçlu']);
  }

  // 6. Stok uyarisi — stok satistan hizli buyuyorsa Lynch bunu kotu isaret sayar
  if (m.stokBuyume != null && m.satisBuyume != null)
    p.push(m.stokBuyume > m.satisBuyume + 5
      ? [-1, 'Stok', `stok %${m.stokBuyume.toFixed(0)} > satış %${m.satisBuyume.toFixed(0)}`]
      : [0, 'Stok', 'normal']);

  return p;
}

const EN_YUKSEK = 9;   // 3 (PEG) + 2 (borc) + 2 (buyume) + 1 (egilim) + 1 (nakit)

/**
 * Temel veri + fiyattan Lynch olcutlerini uretir.
 * Hem guncel (lynch) hem gecmis (gecmis.mjs) hesaplamalari bunu kullanir —
 * tek kaynak, iki yerde ayri ayri hesaplanmaz.
 */
export function olcutler(t, fiyat, hacim = null) {
  const piyasaDegeri = t.hisseAdedi && fiyat ? t.hisseAdedi * fiyat : null;
  const fk = piyasaDegeri && t.ttmKar > 0 ? piyasaDegeri / t.ttmKar : null;
  const pd = piyasaDegeri && t.ozkaynak > 0 ? piyasaDegeri / t.ozkaynak : null;

  // Buyume: gercek son-12-ay / onceki-12-ay. Eski veri cekilemezse tam yila duser.
  const ttmVar = t.kar12?.simdi != null && t.kar12?.gecen != null;
  const buyume = ttmVar
    ? yuzdeDegisim(t.kar12.simdi, t.kar12.gecen)
    : yuzdeDegisim(t.fyKar?.onceki, t.fyKar?.oncekiOnceki);
  const saglam = ttmVar
    ? tabanSaglam(t.kar12.simdi, t.kar12.gecen)
    : tabanSaglam(t.fyKar?.onceki, t.fyKar?.oncekiOnceki);
  const satisBuyume = t.satis12?.gecen != null
    ? yuzdeDegisim(t.satis12.simdi, t.satis12.gecen)
    : yuzdeDegisim(t.fySatis?.onceki, t.fySatis?.oncekiOnceki);

  const m = {
    kod: t.kod, donem: t.donem, fiyat, piyasaDegeri, fk, pd, buyume, hacim, satisBuyume,
    ttmKar: t.ttmKar, hisseAdedi: t.hisseAdedi, ozkaynak: t.ozkaynak,
    buyumeKaynak: ttmVar ? 'ttm' : 'tamyıl',
    karDurumu: ttmVar
      ? karDurumu(t.kar12.simdi, t.kar12.gecen)
      : karDurumu(t.fyKar?.onceki, t.fyKar?.oncekiOnceki),
    tabanSaglam: saglam,
    egilim: t.kar12 ? egilim(t.kar12) : null,
    peg: fk != null && buyume > 0 && saglam ? fk / buyume : null,
    borcOzkaynak: t.ozkaynak > 0 ? t.finansalBorc / t.ozkaynak : null,
    netNakit: t.nakit != null ? t.nakit - t.finansalBorc : null,
    roe: t.ozkaynak > 0 && t.ttmKar != null ? (t.ttmKar / t.ozkaynak) * 100 : null,
    stokBuyume: yuzdeDegisim(t.stok, t.stokGecen ?? t.fyStok?.onceki),
  };
  const kalemler = puanla(m);
  return { ...m, kategori: kategori(buyume, saglam, m.karDurumu), kalemler,
           puan: kalemler.reduce((a, [n]) => a + n, 0), enYuksek: EN_YUKSEK };
}

export async function lynch(kod) {
  const [t, f] = await Promise.all([temel(kod), fiyat(kod)]);

  // Likidite: son 20 gunun ortalama gunluk TL islem hacmi.
  // Yuksek puanli ama gunde birkac milyon TL islem goren hisse tuzaktir —
  // puana katilmaz, kullanici sussun diye ayri alan olarak verilir.
  const son20 = f.mumlar.slice(-20).filter(c => c.h != null && c.k != null);
  const hacim = son20.length ? son20.reduce((a, c) => a + c.h * c.k, 0) / son20.length : null;

  return { ...olcutler(t, f.fiyat, hacim), ad: f.ad };
}

/** Birden fazla hisse; basarisizlar atlanmaz, isaretlenir. */
export const lynchCoklu = kodlar =>
  Promise.all(kodlar.map(k => lynch(k).catch(e => ({ kod: k.toUpperCase(), hata: e.message }))));

/**
 * Uc durumlu alim sinyali. "Alim sekli degisti" uyarilari bu durumun
 * degismesiyle tetiklenir; esikler Lynch'in kendi olcutlerine dayanir.
 *   AL    : puan >= 4 VE son 12 ay KARLI VE deger olcutu ucuz VE borc/ozkaynak < 0.5
 *   KACIN : puan <= -3 (olcutlerin cogunda takilmis)
 *   BEKLE : arasi
 */
export function sinyal(h) {
  if (h?.puan == null) return 'VERİ YOK';
  const ucuz = (h.peg != null && h.peg < 1) || (h.peg == null && h.pd != null && h.pd < 1);
  const karli = h.ttmKar != null && h.ttmKar > 0;   // zarar eden sirkete AL denmez
  if (h.puan >= 4 && karli && ucuz && h.borcOzkaynak != null && h.borcOzkaynak < 0.5) return 'AL';
  if (h.puan <= -3) return 'KAÇIN';
  return 'BEKLE';
}
