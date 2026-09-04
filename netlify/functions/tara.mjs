// Zamanlanmis: her sabah 06:30 UTC (TRT 09:30, seans acilisi) listeyi onbellege alir.
// Boylece gunun ilk ziyaretcisi KAP'i beklemez.
import { yaz } from '../../src/onbellek.mjs';
import { bildirimler } from '../../src/kap.mjs';
import { onem, etiket } from '../../src/onem.mjs';

export default async () => {
  const bugun = new Date().toISOString().slice(0, 10);
  const ham = await bildirimler(bugun, bugun);
  const paket = {
    zaman: Date.now(),
    kayitlar: ham.map(k => ({ ...k, onem: onem(k.baslik), etiket: etiket(k) })),
  };
  await yaz(`liste-${bugun}-${bugun}`, paket);
  return new Response(`${paket.kayitlar.length} bildirim onbellege alindi`);
};

export const config = { schedule: '30 6 * * 1-5' };   // hafta ici
