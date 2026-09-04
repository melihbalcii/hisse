// Netlify Blobs sarmalayicisi.
// getStore() Netlify baglami disinda hata firlatir; onbellek yoksa sistem
// yavaslar ama calismaya devam etmeli — o yuzden her sey yutulur.
import { getStore } from '@netlify/blobs';

let _depo;
function depo() {
  if (_depo !== undefined) return _depo;
  try { _depo = getStore('bist'); } catch { _depo = null; }
  return _depo;
}

export const varMi = () => depo() !== null;

export async function oku(anahtar) {
  const d = depo();
  if (!d) return null;
  try { return await d.get(anahtar, { type: 'json' }); } catch { return null; }
}

export async function yaz(anahtar, deger) {
  const d = depo();
  if (!d) return false;
  try { await d.setJSON(anahtar, deger); return true; } catch { return false; }
}
