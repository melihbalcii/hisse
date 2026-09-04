// Zamanlanmis: derleme kancasini tetikler -> Netlify siteyi yeniden kurar ->
// derleme sirasinda `bist.mjs tarama` calisir -> tarama.json tazelenir.
//
// Neden boyle: tam tarama ~1 dakika suruyor, fonksiyon siniri ise 10 saniye.
// Derlemede boyle bir sinir yok. Bu, Netlify'in kendi onerdigi kalip.
const KANCA = () => process.env.BUILD_HOOK_URL;

export default async () => {
  const url = KANCA();
  if (!url) return new Response('BUILD_HOOK_URL tanimli degil — tarama yenilenmedi', { status: 200 });
  try {
    const r = await fetch(url, { method: 'POST', signal: AbortSignal.timeout(12000) });
    return new Response(r.ok ? 'yeniden kurulum tetiklendi' : `kanca hatasi: HTTP ${r.status}`);
  } catch (e) {
    return new Response(`kanca cagrilamadi: ${e.message}`, { status: 200 });
  }
};

// Hafta ici 05:30 UTC (TSI 08:30) — seans acilmadan once taze veri
export const config = { schedule: '30 5 * * 1-5' };
