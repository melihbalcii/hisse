// GET /api/skorla?index=1658712
// TEK bildirimi puanlar (~3-5sn) — 10sn sinirina sigsin diye parca parca calisiyor.
// Sonuc kalicidir: ayni bildirim bir daha modele gonderilmez.
import { oku, yaz } from '../../src/onbellek.mjs';
import { bildirimDetay } from '../../src/kap.mjs';
import { skorla } from '../../src/analiz.mjs';

export default async req => {
  const index = new URL(req.url).searchParams.get('index');
  if (!index) return Response.json({ hata: 'index parametresi gerekli' }, { status: 400 });

  const anahtar = `skor-${index}`;
  const onbellek = await oku(anahtar);
  if (onbellek) return Response.json({ ...onbellek, onbellek: true });

  try {
    const d = await bildirimDetay(index);
    let sonuc;
    if (d.metin.length < 80)
      sonuc = { skor: null, gerekce: 'metin sayfada yok, ek belgeye bakilmali', hisse: d.hisse, ekler: d.ekler };
    else
      sonuc = { ...(await skorla({ baslik: '', hisse: d.hisse, sirket: '' }, d.metin)), hisse: d.hisse, ekler: d.ekler };

    await yaz(anahtar, sonuc);
    return Response.json({ ...sonuc, onbellek: false });
  } catch (e) {
    // Kota bitmesi (403) gecici degil — istemci bunu ayirt edebilsin
    const kota = /403/.test(e.message);
    return Response.json({ hata: e.message, kota }, { status: kota ? 402 : 500 });
  }
};

export const config = { path: '/api/skorla' };
