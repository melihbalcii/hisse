// GET /api/bildirimler?gunler=2&min=3
// Bildirim listesi. Hizli (KAP listesi ~0.5s) — 10sn sinirina rahat siger.
import { oku, yaz } from '../../src/onbellek.mjs';
import { bildirimler } from '../../src/kap.mjs';
import { onem, etiket } from '../../src/onem.mjs';

const gunOnce = n => new Date(Date.now() - n * 864e5).toISOString().slice(0, 10);
const bugun = () => new Date().toISOString().slice(0, 10);
const TAZE_MS = 10 * 60 * 1000;   // bugunun verisi 10 dk sonra bayatlar

export default async req => {
  const q = new URL(req.url).searchParams;
  const gunler = Math.min(Number(q.get('gunler') ?? 1), 7);
  const min = Number(q.get('min') ?? 3);
  const bas = gunOnce(gunler - 1), bit = bugun();
  const anahtar = `liste-${bas}-${bit}`;

  let paket = await oku(anahtar);

  if (!paket || Date.now() - paket.zaman > TAZE_MS) {
    const ham = await bildirimler(bas, bit);
    paket = {
      zaman: Date.now(),
      kayitlar: ham.map(k => ({ ...k, onem: onem(k.baslik), etiket: etiket(k) })),
    };
    await yaz(anahtar, paket);   // onbellek yazilamazsa is durmasin
  }

  const kayitlar = paket.kayitlar
    .filter(k => k.onem >= min)
    .sort((a, b) => b.onem - a.onem || b.tarih.localeCompare(a.tarih));

  return Response.json(
    { guncelleme: paket.zaman, toplam: paket.kayitlar.length, kayitlar },
    { headers: { 'cache-control': 'public, max-age=60' } },
  );
};

export const config = { path: '/api/bildirimler' };
