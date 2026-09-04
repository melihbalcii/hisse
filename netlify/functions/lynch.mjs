// GET /api/lynch?kod=THYAO,ASELS,TUPRS
// Peter Lynch olcutleriyle mekanik puanlama. LLM yok — saf hesap, kota tuketmez.
// Her hisse 2 dis istek (mali tablo + fiyat) yapar; 10sn sinirini asmamak icin
// istek basina hisse sayisi sinirlidir ve sonuclar gun boyunca onbellege alinir.
import { oku, yaz } from '../../src/onbellek.mjs';
import { lynch } from '../../src/lynch.mjs';

const SINIR = 12;   // 6 hisse 0.4sn surdu; 12 rahat siger

export default async req => {
  const ham = new URL(req.url).searchParams.get('kod');
  if (!ham) return Response.json({ hata: 'kod parametresi gerekli' }, { status: 400 });

  const kodlar = [...new Set(ham.split(',').map(s => s.trim().toUpperCase()).filter(Boolean))].slice(0, SINIR);
  const gun = new Date().toISOString().slice(0, 10);

  const sonuc = await Promise.all(kodlar.map(async kod => {
    const anahtar = `lynch-${gun}-${kod}`;
    const onbellek = await oku(anahtar);
    if (onbellek) return { ...onbellek, onbellek: true };
    try {
      const r = await lynch(kod);
      await yaz(anahtar, r);
      return { ...r, onbellek: false };
    } catch (e) { return { kod, hata: e.message }; }
  }));

  sonuc.sort((a, b) => (b.puan ?? -99) - (a.puan ?? -99));
  return Response.json(
    { sonuc, not: 'Büyüme nominal TL üzerinden; enflasyon düzeltmesi yapılmamıştır.' },
    { headers: { 'cache-control': 'public, max-age=3600' } },
  );
};

export const config = { path: '/api/lynch' };
