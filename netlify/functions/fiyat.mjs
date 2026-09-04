// GET /api/fiyat?kod=THYAO,GARAN,XU100
import { fiyatlar, sma } from '../../src/fiyat.mjs';

export default async req => {
  const kod = new URL(req.url).searchParams.get('kod');
  if (!kod) return Response.json({ hata: 'kod parametresi gerekli' }, { status: 400 });

  const liste = kod.split(',').map(s => s.trim()).filter(Boolean).slice(0, 12);
  const out = (await fiyatlar(liste)).map(f =>
    f.hata ? f : { ...f, sma20: sma(f.mumlar, 20), mumlar: undefined },
  );
  return Response.json(out, { headers: { 'cache-control': 'public, max-age=300' } });
};

export const config = { path: '/api/fiyat' };
