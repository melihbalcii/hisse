// KAP (Kamuyu Aydinlatma Platformu) veri katmani.
// Uc noktalar tarayici trafigi yakalanarak cikarildi (resmi dokuman yok).
const LIST = 'https://www.kap.org.tr/tr/api/disclosure/list/main';
const DETAY = i => `https://www.kap.org.tr/tr/Bildirim/${i}`;
const H = {
  'Content-Type': 'application/json',
  'Accept-Language': 'tr',
  'User-Agent': 'Mozilla/5.0',
};

// KAP tarihleri GG.AA.YYYY istiyor
export const kapTarih = d => {
  const t = d instanceof Date ? d : new Date(d);
  return `${String(t.getDate()).padStart(2,'0')}.${String(t.getMonth()+1).padStart(2,'0')}.${t.getFullYear()}`;
};

// Bilgi degeri olmayan, kural ile elenebilen bildirimler.
// 448 kayitlik ornekte bunlar %55'ini olusturuyordu — LLM'e gitmeden elenmeleri sart.
const GURULTU = [
  'Pay Bazinda Devre Kesici',           // tek basina %42
  'Pay Bazında Devre Kesici',
  'Pay Dışında Sermaye Piyasası Aracı',
  'Yatırım Kuruluşu Varant',
  'Piyasa Yapıcılığı Kapsamında',
  'Şirket Genel Bilgi Formu',
  'Kurumsal Yönetim İlkelerine Uyum Derecelendirmesi',
  'Hak Kullanım Süreç İptal',
];

const gurultuMu = baslik => GURULTU.some(g => baslik.includes(g));

/** Tarih araligindaki bildirimleri getirir. */
export async function bildirimler(fromDate, toDate = fromDate, { hepsi = false } = {}) {
  const r = await fetch(LIST, {
    method: 'POST',
    headers: H,
    signal: AbortSignal.timeout(45000),
    body: JSON.stringify({
      fromDate: kapTarih(fromDate),
      toDate: kapTarih(toDate),
      memberTypes: ['IGS', 'DDK'],   // ihracci sirketler + digerleri
    }),
  });
  if (!r.ok) throw new Error(`KAP listesi alinamadi: HTTP ${r.status}`);
  const ham = await r.json();

  const kayitlar = ham.map(x => {
    const b = x.disclosureBasic ?? {};
    return {
      index: b.disclosureIndex,
      baslik: (b.title ?? '').trim(),
      hisse: b.relatedStocks || null,
      sirket: b.companyTitle ?? '',
      tarih: b.publishDate ?? '',
      sinif: b.disclosureClass ?? '',
      ozet: (b.summary ?? '').trim(),
      ekSayisi: b.attachmentCount ?? 0,
      url: DETAY(b.disclosureIndex),
    };
  });

  return hepsi ? kayitlar : kayitlar.filter(k => !gurultuMu(k.baslik));
}

const EK = o => `https://www.kap.org.tr/tr/api/file/download/${o}`;

/** Detay sayfasindan metin, hisse kodu ve ekleri cikarir. */
export async function bildirimDetay(index) {
  const r = await fetch(DETAY(index), { headers: { 'User-Agent': H['User-Agent'] }, signal: AbortSignal.timeout(30000) });
  if (!r.ok) throw new Error(`Bildirim ${index} alinamadi: HTTP ${r.status}`);
  let s = await r.text();

  // Icerik RSC yukunun icinde kacisli HTML olarak duruyor
  s = s.replace(/\\u003c/g, '<').replace(/\\u003e/g, '>')
       .replace(/\\u0026/g, '&').replace(/\\"/g, '"').replace(/\\n/g, ' ');

  // 1) Serbest metin: Turkce summernote hucreleri (Ozel Durum Aciklamasi vb)
  let bloklar = [...s.matchAll(
    /<td[^>]*taxonomy-context-value-summernote[^>]*content-tr[^>]*>([\s\S]*?)<\/td>/g
  )].map(m => m[1]);

  // 2) Bulunamazsa eski GWT tablosunun etiket/deger cesmeleri
  if (!bloklar.length) {
    const L = [...s.matchAll(/<div class="gwt-Label[^"]*content-tr[^"]*"[^>]*>([^<]{2,})<\/div>/g)].map(m => m[1]);
    bloklar = L.length ? [L.join(' | ')] : [];
  }

  const metin = bloklar
    .map(h => h.replace(/<br\s*\/?>/gi, '\n').replace(/<[^>]+>/g, ' '))
    .join('\n')
    .replace(/&#160;|&nbsp;/g, ' ')
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/[ \t]+/g, ' ').replace(/\n{3,}/g, '\n\n').trim();

  // Hisse kodu: liste API'sinde cogu zaman bos, detay sayfasinda var
  const sonra = s.slice(s.indexOf('/tr/sirket-bilgileri/ozet/'));
  const hisse = sonra.match(/"children":"([A-Z]{3,6})"/)?.[1] ?? null;

  // Ekler: gercek icerik cogu yapilandirilmis bildirimde PDF'te
  const ekler = [...s.matchAll(/"objId":"([a-f0-9]{32})","fileName":"([^"]+)"/g)]
    .map(m => ({ ad: m[2], url: EK(m[1]) }));

  return { metin, hisse, ekler };
}

/** Geriye donuk uyum: sadece metin. */
export const bildirimMetni = async i => (await bildirimDetay(i)).metin;