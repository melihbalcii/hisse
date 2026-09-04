// Bildirim onem siralamasi — hem CLI hem web fonksiyonlari kullanir.
// Siralamalar 451 kayitlik gercek gun verisi incelenerek belirlendi.
const KURALLAR = [
  [5, /Finansal Rapor|Sermaye Artırımı|Birleşme|Devralma|Bölünme|Pay Satın Alma/i],
  [4, /Özel Durum Açıklaması/i],
  [3, /Pay Alım Satım|Geri Alın|Kredi Derecelendirme|Temettü|Kar Payı/i],
  [2, /Genel Kurul|Kurumsal Yönetim|Yönetim Kurulu/i],
];

export const onem = baslik => (KURALLAR.find(([, re]) => re.test(baslik)) ?? [1])[0];

/** relatedStocks cogu kayitta bos; o zaman sirket adiyla etiketlenir. */
export const etiket = k => k.hisse || k.sirket?.replace(/\s+A\.Ş\.$/, '') || '(bilinmiyor)';
