#!/usr/bin/env node
// bist — BIST/KAP takip araci
import { bildirimler, bildirimDetay } from './src/kap.mjs';
import { fiyat, sma } from './src/fiyat.mjs';
import { lynch, lynchCoklu, sinyal } from './src/lynch.mjs';
import { sirketler } from './src/liste.mjs';
import { gecmis, ozetle, enflasyon, DONEMLER } from './src/gecmis.mjs';
import { writeFileSync, mkdirSync, readFileSync } from 'node:fs';

import { onem, etiket } from './src/onem.mjs';
const YILDIZ = n => '*'.repeat(n).padEnd(5);

const argv = process.argv.slice(2);
const cmd = argv.shift();
const flags = {};
const rest = [];
for (let i = 0; i < argv.length; i++) {
  const a = argv[i];
  if (a === '--gun') flags.gun = argv[++i];
  else if (a === '--gunler') flags.gunler = Number(argv[++i]);
  else if (a === '--llm') flags.llm = true;
  else if (a === '--tum') flags.tum = true;
  else if (a === '--min') flags.min = Number(argv[++i]);
  else if (a === '--detay') flags.detay = true;
  else if (a === '--adet') flags.adet = Number(argv[++i]);
  else if (a === '--es') flags.es = Number(argv[++i]);
  else if (a === '--tazele') flags.tazele = true;
  else rest.push(a);
}

const bugun = () => new Date().toISOString().slice(0, 10);
const gunOnce = n => new Date(Date.now() - n * 864e5).toISOString().slice(0, 10);

const HELP = `bist — BIST / KAP takip araci

  bist bugun                 bugunun bildirimleri, oneme gore sirali
  bist bugun --gunler 3      son 3 gun
  bist bugun --gun 2026-09-03    belirli gun
  bist hisse THYAO           fiyat + o hisseye ait bildirimler
  bist fiyat THYAO GARAN     sadece fiyat
  bist lynch THYAO ASELS     Peter Lynch olcutleriyle puanla
  bist tarama                tum BIST'i tara, public/veri/tarama.json yaz
  bist gecmis                "o zaman alsaydim?" simulasyonu (--adet N, varsayilan 120)
                             (--adet N sinirla, --es N es zamanlilik)

Bayraklar:
  --min <1-5>   en dusuk onem seviyesi (varsayilan 3)
  --tum         gurultu bildirimlerini de goster
  --llm         bildirimleri LLM ile okuyup puanla (NVIDIA kotasi gerekir)`;

async function llmSkorla(liste) {
  const { skorla, paralel } = await import('./src/analiz.mjs');
  process.stderr.write(`${liste.length} bildirim LLM ile okunuyor...\n`);
  let uyari = null;
  const out = await paralel(liste, async k => {
    try {
      const d = await bildirimDetay(k.index).catch(() => ({ metin: '', hisse: null, ekler: [] }));
      // liste API'si hisse kodunu cogu kayitta bos donuyor; detay sayfasinda var
      const zengin = { ...k, hisse: k.hisse ?? d.hisse, ekler: d.ekler };
      if (d.metin.length < 80)   // icerik yalniz PDF ekinde — baslikla puanlamak yaniltir
        return { ...zengin, gerekce: 'metin sayfada yok, ek belgeye bakilmali' };
      return { ...zengin, ...(await skorla(zengin, d.metin)) };
    } catch (e) { uyari ??= e.message; return { ...k }; }   // kaydi koru, puanlamayi atla
  }, 4);
  if (uyari) process.stderr.write(`UYARI: puanlama yapilamadi — ${uyari}\n`);
  return out;
}

function yazdir(liste) {
  let hisse = null;
  for (const k of liste) {
    const e = etiket(k);
    if (e !== hisse) { hisse = e; console.log(`\n${e}`); }
    const skor = k.skor != null ? ` [${k.skor > 0 ? '+' : ''}${k.skor}]` : '';
    console.log(`  ${YILDIZ(k.onem)} ${k.tarih.slice(11, 16)}  ${k.baslik.slice(0, 52)}${skor}`);
    if (k.gerekce) console.log(`         ${k.gerekce}`);
    console.log(`         ${k.url}`);
    for (const e of k.ekler ?? []) console.log(`         ek: ${e.ad}  ${e.url}`);
  }
}

try {
  switch (cmd) {
    case 'bugun': {
      const bas = flags.gun ?? (flags.gunler ? gunOnce(flags.gunler - 1) : bugun());
      const bit = flags.gun ?? bugun();
      let liste = (await bildirimler(bas, bit, { hepsi: flags.tum }))
        .map(k => ({ ...k, onem: onem(k.baslik) }));
      const min = flags.min ?? 3;
      const toplam = liste.length;
      liste = liste.filter(k => k.onem >= min);
      liste.sort((a, b) => b.onem - a.onem || etiket(a).localeCompare(etiket(b), 'tr'));
      if (flags.llm) liste = await llmSkorla(liste);
      yazdir(liste);
      console.log(`\n${toplam} bildirim, onem>=${min} olan ${liste.length} tanesi gosterildi.`);
      break;
    }
    case 'hisse': {
      const kod = (rest[0] ?? '').toUpperCase();
      if (!kod) { console.error(HELP); process.exit(1); }
      const [f, hepsi] = await Promise.all([
        fiyat(kod),
        bildirimler(gunOnce(flags.gunler ?? 7), bugun()),
      ]);
      const yon = f.degisimYuzde >= 0 ? '+' : '';
      console.log(`\n${f.kod}  ${f.ad}`);
      console.log(`${f.fiyat} ${f.paraBirimi}  (${yon}${f.degisimYuzde?.toFixed(2)}%)   gun ${f.gunDusuk}-${f.gunYuksek}   52h ${f.yil52Dusuk}-${f.yil52Yuksek}`);
      const s20 = sma(f.mumlar, 20);
      if (s20) console.log(`SMA20 ${s20.toFixed(2)}  ->  fiyat ortalamanin %${((f.fiyat / s20 - 1) * 100).toFixed(1)} ${f.fiyat >= s20 ? 'ustunde' : 'altinda'}`);
      let ilgili = hepsi.filter(k => (k.hisse ?? '').split(',').map(s => s.trim()).includes(kod))
        .map(k => ({ ...k, onem: onem(k.baslik) }));
      if (flags.llm && ilgili.length) ilgili = await llmSkorla(ilgili);
      console.log(`\n--- son ${flags.gunler ?? 7} gunun bildirimleri (${ilgili.length}) ---`);
      ilgili.length ? yazdir(ilgili) : console.log('  (yok)');
      break;
    }
    case 'lynch': {
      if (!rest.length) { console.error(HELP); process.exit(1); }
      const sonuc = (await lynchCoklu(rest)).sort((a, b2) => (b2.puan ?? -99) - (a.puan ?? -99));
      const s = (v, n = 1) => v == null ? '-' : v.toFixed(n);
      console.log('');
      console.log('KOD      PUAN   F/K    BÜYÜME    PEG   BORÇ/ÖZK   ROE    KATEGORİ');
      console.log('-'.repeat(74));
      for (const r of sonuc) {
        if (r.hata) { console.log(`${r.kod.padEnd(8)} HATA: ${r.hata}`); continue; }
        console.log(
          r.kod.padEnd(8) +
          `${r.puan >= 0 ? '+' : ''}${r.puan}/${r.enYuksek}`.padStart(5) +
          s(r.fk).padStart(7) +
          (r.buyume == null ? '-' : '%' + r.buyume.toFixed(0)).padStart(10) +
          s(r.peg, 2).padStart(7) +
          s(r.borcOzkaynak, 2).padStart(11) +
          (r.roe == null ? '-' : '%' + r.roe.toFixed(0)).padStart(7) +
          '   ' + r.kategori);
      }
      if (flags.detay) for (const r of sonuc.filter(x => !x.hata)) {
        console.log(`\n${r.kod}  (${r.donem})`);
        for (const [n, ad, aciklama] of r.kalemler)
          console.log(`   ${(n > 0 ? '+' + n : String(n)).padStart(2)}  ${ad.padEnd(8)} ${aciklama}`);
      }
      console.log('\nNot: buyume nominal TL uzerinden — enflasyon duzeltmesi yapilmamistir.');
      break;
    }
    case 'tarama': {
      const hepsi = await sirketler({ tazele: flags.tazele });
      const kodlar = hepsi.slice(0, flags.adet ?? hepsi.length);
      const es = flags.es ?? 8;
      console.error(`${kodlar.length} hisse taraniyor (es zamanlilik ${es})...`);

      const sonuc = []; let i = 0, bitti = 0;
      const t0 = Date.now();
      const isci = async () => {
        while (i < kodlar.length) {
          const { kod, ad } = kodlar[i++];
          try {
            const r = await lynch(kod);
            // sinyal burada hesaplanir ki arayuz ile kural ayni yerden gelsin
            if (r.fk != null || r.buyume != null || r.pd != null) sonuc.push({ ...r, ad, sinyal: sinyal(r) });
          } catch { /* mali tablosu olmayan (fon, VKS) atlanir */ }
          if (++bitti % 25 === 0) {
            const gecen = (Date.now() - t0) / 1000;
            const kalan = (gecen / bitti) * (kodlar.length - bitti);
            console.error(`  ${bitti}/${kodlar.length}  bulunan: ${sonuc.length}  kalan ~${Math.round(kalan / 60)} dk`);
          }
        }
      };
      await Promise.all(Array.from({ length: es }, isci));

      sonuc.sort((a, b2) => (b2.piyasaDegeri ?? 0) - (a.piyasaDegeri ?? 0));
      const paket = { tarih: new Date().toISOString(), tarandi: kodlar.length, hisseler: sonuc };
      mkdirSync('public/veri', { recursive: true });
      writeFileSync('public/veri/tarama.json', JSON.stringify(paket));
      console.error(`\nbitti: ${sonuc.length} hisse, ${((Date.now() - t0) / 1000 / 60).toFixed(1)} dk -> public/veri/tarama.json`);
      break;
    }
    case 'gecmis': {
      // Evren: mevcut taramadan piyasa degerine gore en buyuk N hisse
      const tarama = JSON.parse(readFileSync('public/veri/tarama.json', 'utf8'));
      const evren = tarama.hisseler
        .filter(h => h.piyasaDegeri != null)
        .sort((a, b2) => b2.piyasaDegeri - a.piyasaDegeri)
        .slice(0, flags.adet ?? 120);
      const es = flags.es ?? 8;
      console.error(`${evren.length} hisse icin gecmis hesaplaniyor (es zamanlilik ${es})...`);

      const enf = await enflasyon(DONEMLER.map(d => d.gun));
      console.error(`  enflasyon olcutu: ${enf[365].tufe != null ? "TUFE" : "dolar"} (1 yil: %${(enf[365].tufe ?? enf[365].dolar)?.toFixed(1)})`);
      const sonuc = []; let i = 0, bitti = 0;
      const t0 = Date.now();
      const isci = async () => {
        while (i < evren.length) {
          const h = evren[i++];
          try { sonuc.push({ ...(await gecmis(h.kod)), ad: h.ad, piyasaDegeri: h.piyasaDegeri }); }
          catch { /* gecmisi olmayan hisse atlanir */ }
          if (++bitti % 20 === 0) {
            const g = (Date.now() - t0) / 1000;
            console.error(`  ${bitti}/${evren.length}  bulunan: ${sonuc.length}  kalan ~${Math.round((g / bitti) * (evren.length - bitti) / 60)} dk`);
          }
        }
      };
      await Promise.all(Array.from({ length: es }, isci));

      const paket = { tarih: new Date().toISOString(), hisseler: sonuc, ozet: ozetle(sonuc), ozetLikit: ozetle(sonuc, 50e6), olcutler: enf };
      mkdirSync('public/veri', { recursive: true });
      writeFileSync('public/veri/gecmis.json', JSON.stringify(paket));
      console.error(`\nbitti: ${sonuc.length} hisse, ${((Date.now() - t0) / 1000 / 60).toFixed(1)} dk -> public/veri/gecmis.json`);
      const yaz = (baslik, ozet) => {
        console.error(`\n${'='.repeat(66)}\n${baslik}\n${'='.repeat(66)}`);
        for (const d of ozet) {
          const o = enf[d.gun];
          console.error(`\n${d.donem} (n=${d.adet}) — ölçütler: dolar %${o.dolar?.toFixed(0)} · altın %${o.altin?.toFixed(0)}${o.tufe!=null?` · TÜFE %${o.tufe.toFixed(0)}`:''}`);
          for (const k of d.kovalar) {
            const rm = k.medyan != null && o.altin != null ? ((1+k.medyan/100)/(1+o.altin/100)-1)*100 : null;
            console.error(`   ${k.ad.padEnd(12)} n=${String(k.adet).padStart(4)}  medyan %${(k.medyan?.toFixed(0) ?? '-').padStart(6)}  ort %${(k.ortalama?.toFixed(0) ?? '-').padStart(6)}  → altına göre reel medyan %${(rm?.toFixed(0) ?? '-').padStart(5)}`);
          }
        }
      };
      yaz('TUM HISSELER', paket.ozet);
      yaz('SADECE ISLEM GOREBILIR (gunluk >= 50 mn TL hacim)', ozetle(sonuc, 50e6));
      break;
    }
    case 'fiyat': {
      if (!rest.length) { console.error(HELP); process.exit(1); }
      for (const kod of rest) {
        try {
          const f = await fiyat(kod);
          const yon = f.degisimYuzde >= 0 ? '+' : '';
          console.log(`${f.kod.padEnd(8)} ${String(f.fiyat).padStart(9)} ${f.paraBirimi}  ${(yon + f.degisimYuzde?.toFixed(2) + '%').padStart(8)}   ${f.ad.slice(0, 40)}`);
        } catch (e) { console.log(`${kod.padEnd(8)} HATA: ${e.message}`); }
      }
      break;
    }
    default:
      console.error(HELP);
      process.exit(cmd ? 1 : 0);
  }
} catch (e) {
  console.error('HATA: ' + e.message);
  process.exit(1);
}
