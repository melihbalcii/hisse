// Nobetci cekirdegi: izlenen hisselerin alim sinyalini yeniden hesaplar,
// DEGISENLERI Telegram'a bildirir. Hem zamanlanmis hem elle tetiklenen
// fonksiyon bunu cagirir (Netlify'da bir fonksiyon hem schedule hem path olamaz).
import { oku, yaz } from './onbellek.mjs';
import { lynch, sinyal } from './lynch.mjs';
import { getir } from './portfoy.mjs';
import { gonder, yapilandirilmis } from './telegram.mjs';

// Netlify Free'de fonksiyon siniri 10sn; hisse basina ~0.35sn.
// Tum BIST taramasi burada YAPILMAZ (1 dakika surer) — o is `bist.mjs tarama`.
const SINIR = 15;
const SIMGE = { AL: '🟢', BEKLE: '🟡', 'KAÇIN': '🔴' };

export async function nobet() {
  const izleme = (await oku('izleme')) ?? [];
  const portfoy = await getir();
  const kodlar = [...new Set([...Object.keys(portfoy.pozisyonlar), ...izleme])].slice(0, SINIR);
  if (!kodlar.length) return { izlenen: 0, degisen: 0, degisenler: [], telegram: { gonderildi: false, sebep: 'izlenecek hisse yok' } };

  const onceki = (await oku('sinyaller')) ?? {};
  const simdi = {};
  const degisenler = [];

  await Promise.all(kodlar.map(async kod => {
    try {
      const h = await lynch(kod);
      const s = sinyal(h);
      simdi[kod] = { sinyal: s, puan: h.puan };
      const o = onceki[kod];
      if (o && o.sinyal !== s)
        degisenler.push({ kod, eski: o.sinyal, yeni: s, puan: h.puan, eskiPuan: o.puan });
    } catch { /* verisi gelmeyen hisse atlanir; eski sinyali korunur */ }
  }));

  await yaz('sinyaller', { ...onceki, ...simdi });   // degismeyenlerin kaydi silinmesin

  let bildirim = { gonderildi: false, sebep: 'degisiklik yok' };
  if (degisenler.length) {
    const satirlar = degisenler.map(d =>
      `${SIMGE[d.yeni] ?? ''} <b>${d.kod}</b>  ${d.eski} → <b>${d.yeni}</b>  (puan ${d.eskiPuan} → ${d.puan})`).join('\n');
    const portfoydekiler = degisenler.filter(d => portfoy.pozisyonlar[d.kod]).map(d => d.kod);
    bildirim = await gonder(
      `<b>BIST · alım sinyali değişti</b>\n\n${satirlar}` +
      (portfoydekiler.length ? `\n\n⚠️ Portföyünde olan: ${portfoydekiler.join(', ')}` : ''));
  }
  if (!yapilandirilmis()) bildirim = { gonderildi: false, sebep: 'Telegram yapilandirilmamis' };

  return { izlenen: kodlar.length, degisen: degisenler.length, degisenler, telegram: bildirim };
}
