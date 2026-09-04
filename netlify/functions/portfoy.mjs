// GET  /api/portfoy                      -> ozet
// POST /api/portfoy {islem:'al'|'sat', kod, adet}
// POST /api/portfoy {islem:'sifirla'}
// POST /api/portfoy {islem:'izle', kodlar:[...]}   -> nobetci izleme listesi
import { ozet, al, sat, sifirla } from '../../src/portfoy.mjs';
import { fiyat } from '../../src/fiyat.mjs';
import { oku, yaz } from '../../src/onbellek.mjs';

export default async req => {
  if (req.method === 'GET') {
    const o = await ozet();
    return Response.json({ ...o, izleme: (await oku('izleme')) ?? [] });
  }
  if (req.method !== 'POST') return Response.json({ hata: 'yontem desteklenmiyor' }, { status: 405 });

  let g;
  try { g = await req.json(); } catch { return Response.json({ hata: 'gecersiz JSON' }, { status: 400 }); }

  try {
    if (g.islem === 'sifirla') { await sifirla(); return Response.json(await ozet()); }

    if (g.islem === 'izle') {
      const kodlar = [...new Set((g.kodlar ?? []).map(k => String(k).toUpperCase().trim()).filter(Boolean))].slice(0, 15);
      await yaz('izleme', kodlar);
      return Response.json({ izleme: kodlar });
    }

    if (g.islem === 'al' || g.islem === 'sat') {
      const f = await fiyat(g.kod);              // islem daima guncel fiyattan
      if (g.islem === 'al') await al(g.kod, g.adet, f.fiyat);
      else await sat(g.kod, g.adet, f.fiyat);
      return Response.json(await ozet());
    }
    return Response.json({ hata: 'bilinmeyen islem' }, { status: 400 });
  } catch (e) {
    return Response.json({ hata: e.message }, { status: 400 });
  }
};

export const config = { path: '/api/portfoy' };
