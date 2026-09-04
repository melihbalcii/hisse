'use strict';
const $ = s => document.querySelector(s);
const TAKIP = ['XU100','THYAO','GARAN','ASELS','TUPRS'];
const esc = t => String(t ?? '').replace(/[<>&]/g, c => ({'<':'&lt;','>':'&gt;','&':'&amp;'}[c]));
const say = (v,n=1) => v == null ? '–' : v.toFixed(n);
const yuzde = (v,n=0) => v == null ? '–' : (v>0?'+':'') + v.toFixed(n) + '%';
const mlr = v => v == null ? '–' : (v/1e9).toFixed(1);
const para = v => v == null ? '–' : v.toLocaleString('tr',{maximumFractionDigits:0});
const renk = v => v > 0 ? 'var(--arti)' : v < 0 ? 'var(--eksi)' : 'var(--notr)';
const SINYAL_RENK = { AL:'var(--arti)', BEKLE:'var(--sari)', 'KAÇIN':'var(--eksi)' };

/* ═════════ SEKMELER ═════════ */
$('#sekmeler').querySelectorAll('button').forEach(b => b.onclick = () => {
  $('#sekmeler').querySelectorAll('button').forEach(x => x.classList.toggle('aktif', x === b));
  document.querySelectorAll('.sayfa').forEach(p => p.classList.toggle('aktif', p.id === 's-' + b.dataset.s));
  if (b.dataset.s === 'portfoy') portfoyYukle();
  if (b.dataset.s === 'simulasyon') simYukle();
});

/* ═════════ TARAMA ═════════ */
let hisseler = [], sirala = { alan:'puan', ters:true }, acikSatir = null;
const KUCUK_IYI = new Set(['fk','peg','pd','borcOzkaynak']);
const SUTUN = [['kod','Hisse','sol'],['fiyat','Fiyat',''],['puan','Puan',''],['sinyal','Sinyal','sol'],
  ['fk','F/K',''],['buyume','Büyüme',''],['peg','PEG',''],['pd','PD/DD',''],['borcOzkaynak','Borç/Özk',''],
  ['roe','ROE',''],['piyasaDegeri','Piy.Değ (mlr)',''],['hacim','Hacim (mn/gün)',''],
  ['kategori','Kategori','sol'],['egilim','Eğilim','sol']];
const HAZIR = { al:{fSinyal:'AL',fHacim:20}, lynch:{fPeg:1,fBorc:0.5,fBuyume:10},
                ucuz:{fPeg:0.7,fFk:15}, saglam:{fBorc:0.3,fBuyume:0}, buyuk:{fPd:50}, tumu:{} };
const ALANLAR = ['fAra','fSinyal','fKat','fPuan','fFk','fPeg','fBorc','fBuyume','fPd','fHacim'];

function suzulmus() {
  const g = k => $('#'+k).value.trim(), n = k => parseFloat($('#'+k).value);
  const ara = g('fAra').toLocaleUpperCase('tr'), sin = g('fSinyal'), kat = g('fKat');
  const [puan,fk,peg,borc,buy,pd,hac] = ['fPuan','fFk','fPeg','fBorc','fBuyume','fPd','fHacim'].map(n);
  return hisseler.filter(h => {
    if (ara && !(h.kod.includes(ara) || (h.ad??'').toLocaleUpperCase('tr').includes(ara))) return false;
    if (sin && h.sinyal !== sin) return false;
    if (kat && h.kategori !== kat) return false;
    if (!isNaN(puan) && h.puan < puan) return false;
    // Bir olcute sinir konduysa, o degeri OLMAYAN hisse elenir
    if (!isNaN(fk)   && !(h.fk != null && h.fk <= fk)) return false;
    if (!isNaN(peg)  && !(h.peg != null && h.peg <= peg)) return false;
    if (!isNaN(borc) && !(h.borcOzkaynak != null && h.borcOzkaynak <= borc)) return false;
    if (!isNaN(buy)  && !(h.buyume != null && h.buyume >= buy)) return false;
    if (!isNaN(pd)   && !(h.piyasaDegeri != null && h.piyasaDegeri/1e9 >= pd)) return false;
    if (!isNaN(hac)  && !(h.hacim != null && h.hacim/1e6 >= hac)) return false;
    return true;
  }).sort((a,b) => {
    const x = a[sirala.alan], y = b[sirala.alan];
    if (x == null && y == null) return 0;
    if (x == null) return 1; if (y == null) return -1;
    const k = typeof x === 'string' ? x.localeCompare(y,'tr') : x - y;
    return sirala.ters ? -k : k;
  });
}

function ciz() {
  const liste = suzulmus();
  $('#sayac').textContent = `${liste.length} hisse gösteriliyor (${hisseler.length} taranmış içinden)`;
  if (!liste.length) { $('#tablo').innerHTML = '<tbody><tr><td class="bos">Ölçütlere uyan hisse yok.</td></tr></tbody>'; return; }
  const ok = a => sirala.alan === a ? (sirala.ters ? ' ↓' : ' ↑') : '';
  $('#tablo').innerHTML =
    '<thead><tr>' + SUTUN.map(([a,ad,c]) => `<th class="${c}" data-a="${a}">${ad}${ok(a)}</th>`).join('') + '</tr></thead><tbody>' +
    liste.map(h => {
      const d = acikSatir === h.kod ? `<tr class="detay"><td colspan="${SUTUN.length}">
        <ul>${h.kalemler.map(([n,ad,ac]) => `<li><b style="color:${renk(n)}">${n>0?'+'+n:n}</b> ${esc(ad)} — ${esc(ac)}</li>`).join('')}</ul>
        <div>Dönem ${esc(h.donem)} · fiyat ${h.fiyat} TL
          <button class="dugme dolu kucuk" style="margin-left:10px" onclick="hizliAl('${h.kod}')">Sanal portföye al</button></div></td></tr>` : '';
      return `<tr class="${acikSatir===h.kod?'acik':''}" data-kod="${h.kod}">
        <td class="sol"><span class="kod">${esc(h.kod)}</span><br><span class="ad">${esc((h.ad??'').slice(0,26))}</span></td>
        <td${h.canli?' style="font-weight:650" title="canlı fiyat"':''}>${say(h.fiyat,2)}${h.canli?' •':''}</td>
        <td class="puan" style="color:${renk(h.puan)}">${h.puan>0?'+':''}${h.puan}</td>
        <td class="sol"><span class="rozet" style="color:${SINYAL_RENK[h.sinyal]??'var(--notr)'}">${esc(h.sinyal??'–')}</span></td>
        <td>${say(h.fk)}</td><td>${yuzde(h.buyume)}</td><td>${say(h.peg,2)}</td>
        <td>${say(h.pd,2)}</td><td>${say(h.borcOzkaynak,2)}</td><td>${yuzde(h.roe)}</td><td>${mlr(h.piyasaDegeri)}</td>
        <td${h.hacim!=null&&h.hacim<20e6?' style="color:var(--eksi)" title="düşük işlem hacmi"':''}>${h.hacim==null?'–':(h.hacim/1e6).toFixed(0)}</td>
        <td class="sol kat">${esc(h.kategori)}</td>
        <td class="sol kat" style="opacity:.85">${esc(h.egilim ?? '–')}</td></tr>${d}`;
    }).join('') + '</tbody>';
  $('#tablo').querySelectorAll('th[data-a]').forEach(th => th.onclick = () => {
    const a = th.dataset.a;
    const ilkYon = !(KUCUK_IYI.has(a) || ['kod','kategori','sinyal','egilim'].includes(a));
    sirala = { alan:a, ters: sirala.alan === a ? !sirala.ters : ilkYon }; ciz();
  });
  $('#tablo').querySelectorAll('tbody tr[data-kod]').forEach(tr => tr.onclick = e => {
    if (e.target.tagName === 'BUTTON') return;
    acikSatir = acikSatir === tr.dataset.kod ? null : tr.dataset.kod; ciz();
  });
}

async function canliGuncelle() {
  const b = $('#bCanli');
  const liste = suzulmus().slice(0,36).filter(h => h.hisseAdedi && h.ttmKar > 0);
  if (!liste.length) { b.textContent = 'güncellenecek satır yok'; return; }
  b.disabled = true; b.textContent = 'güncelleniyor…';
  try {
    const parcalar = [];
    for (let i = 0; i < liste.length; i += 12) parcalar.push(liste.slice(i, i+12));
    const cevaplar = await Promise.all(parcalar.map(p =>
      fetch(`/api/fiyat?kod=${p.map(x=>x.kod).join(',')}`).then(r => r.json())));
    const fm = new Map(cevaplar.flat().filter(f => !f.hata).map(f => [f.kod, f.fiyat]));
    let n = 0;
    for (const h of liste) {
      const y = fm.get(h.kod);
      if (y == null || y <= 0) continue;
      h.fiyat = y; h.piyasaDegeri = h.hisseAdedi * y;
      h.fk = h.ttmKar > 0 ? h.piyasaDegeri / h.ttmKar : null;   // zararda F/K tanimsiz
      h.peg = (h.tabanSaglam && h.buyume > 0 && h.fk != null) ? h.fk / h.buyume : null;
      h.pd  = h.ozkaynak > 0 ? h.piyasaDegeri / h.ozkaynak : null;
      h.canli = true; n++;
    }
    ciz(); b.textContent = `${n} satır güncellendi`;
  } catch { b.textContent = 'güncellenemedi'; }
  finally { b.disabled = false; setTimeout(() => b.textContent = 'Canlı fiyatla güncelle', 4000); }
}

window.hizliAl = kod => {
  $('#iKod').value = kod;
  $('#sekmeler').querySelector('[data-s="portfoy"]').click();
  $('#iAdet').focus(); maliyetGoster();
};

function hazirUygula(ad) {
  ALANLAR.forEach(k => $('#'+k).value = '');
  for (const [k,v] of Object.entries(HAZIR[ad] ?? {})) $('#'+k).value = v;
  $('#hazir').querySelectorAll('button[data-h]').forEach(b => b.classList.toggle('aktif', b.dataset.h === ad));
  ciz();
}

async function taramaYukle() {
  try {
    const d = await (await fetch('/veri/tarama.json')).json();
    hisseler = d.hisseler;
    $('#ustBilgi').textContent = `${d.hisseler.length} hisse · tarama ${new Date(d.tarih).toLocaleString('tr')}`;
    $('#fKat').innerHTML = '<option value="">hepsi</option>' +
      [...new Set(hisseler.map(h => h.kategori))].sort().map(k => `<option>${esc(k)}</option>`).join('');
    $('#hisseListesi').innerHTML = hisseler.map(h => `<option value="${h.kod}">${esc(h.ad??'')}</option>`).join('');
    $('#taramaDipnot').innerHTML =
      'Sütunların ne anlama geldiği <b>“Nasıl okunur?”</b> sekmesinde. ' +
      'Kırmızı hacim = günde 20 mn TL altı, likidite riski. <b>•</b> = canlı fiyatla güncellendi. ' +
      'Bankalar listede yoktur (farklı mali tablo formatı).';
    ciz();
  } catch {
    $('#tablo').innerHTML = '<tbody><tr><td class="bos">Tarama verisi yok.</td></tr></tbody>';
  }
}

/* ═════════ PORTFOY ═════════ */
function portfoyCiz(p) {
  const k = p.karYuzde;
  $('#pDeger').textContent = para(p.toplam) + ' ₺';
  $('#pKar').innerHTML = `<span style="color:${renk(p.kar)}">${p.kar>0?'+':''}${para(p.kar)} ₺ &nbsp;(${yuzde(k,2)})</span>`;

  if (p.endeks) {
    const fark = k - p.endeks.getiriYuzde;
    $('#pKiyas').innerHTML =
      `<div><span class="et">XU100 aynı dönem</span><div class="d" style="font-weight:650">${yuzde(p.endeks.getiriYuzde,2)}</div></div>
       <div style="margin-left:auto;text-align:right"><span class="et">Endekse göre</span>
         <div class="d" style="font-weight:700;color:${renk(fark)}">${fark>0?'+':''}${fark.toFixed(2)} puan</div></div>`;
  }

  const hisseOran = p.toplam ? (p.hisseDegeri / p.toplam) * 100 : 0;
  $('#pMini').innerHTML = `
    <div><span class="et">Nakit</span><div class="d">${para(p.nakit)} ₺</div></div>
    <div><span class="et">Hissede</span><div class="d">${para(p.hisseDegeri)} ₺</div>
      <div class="cubuk" style="width:96px"><i style="width:${hisseOran.toFixed(0)}%"></i></div></div>
    <div><span class="et">Pozisyon</span><div class="d">${p.pozisyonlar.length}</div></div>
    <div><span class="et">Gün</span><div class="d">${p.gun}</div></div>`;

  $('#pTablo').innerHTML = p.pozisyonlar.length
    ? '<thead><tr><th class="sol">Hisse</th><th>Adet</th><th>Ort.maliyet</th><th>Fiyat</th><th>Günlük</th><th>Değer</th><th>Ağırlık</th><th>K/Z</th><th>K/Z %</th><th></th></tr></thead><tbody>' +
      p.pozisyonlar.map(s => {
        const agirlik = p.hisseDegeri ? (s.deger / p.hisseDegeri) * 100 : 0;
        return `<tr><td class="sol kod">${esc(s.kod)}</td><td>${s.adet}</td>
        <td>${say(s.ortMaliyet,2)}</td><td>${say(s.fiyat,2)}</td>
        <td style="color:${renk(s.gunlukDegisim)}">${yuzde(s.gunlukDegisim,2)}</td>
        <td>${para(s.deger)}</td>
        <td>${agirlik.toFixed(0)}%<div class="cubuk"><i style="width:${agirlik.toFixed(0)}%"></i></div></td>
        <td style="color:${renk(s.kar)}">${s.kar==null?'–':(s.kar>0?'+':'')+para(s.kar)}</td>
        <td style="color:${renk(s.kar)};font-weight:650">${yuzde(s.karYuzde,1)}</td>
        <td><button class="dugme kucuk" onclick="hepsiniSat('${s.kod}',${s.adet})">Sat</button></td></tr>`;
      }).join('') + '</tbody>'
    : '<tbody><tr><td class="bos">Henüz pozisyon yok. Yukarıdaki kutudan hisse alabilirsin.</td></tr></tbody>';

  $('#pIslem').innerHTML = p.islemler.length
    ? '<thead><tr><th class="sol">Tarih</th><th class="sol">İşlem</th><th class="sol">Hisse</th><th>Adet</th><th>Fiyat</th><th>Tutar</th><th>K/Z</th></tr></thead><tbody>' +
      p.islemler.map(i => `<tr><td class="sol">${new Date(i.tarih).toLocaleString('tr')}</td>
        <td class="sol" style="color:${i.tip==='AL'?'var(--vurgu)':'var(--sari)'};font-weight:650">${i.tip}</td>
        <td class="sol kod">${esc(i.kod)}</td><td>${i.adet}</td><td>${say(i.fiyat,2)}</td><td>${para(i.tutar)}</td>
        <td style="color:${renk(i.kar)}">${i.kar==null?'–':(i.kar>0?'+':'')+para(i.kar)}</td></tr>`).join('') + '</tbody>'
    : '<tbody><tr><td class="bos">İşlem yok.</td></tr></tbody>';

  if (p.izleme) $('#iIzleme').value = p.izleme.join(',');
}

window.hepsiniSat = (kod, adet) => { $('#iKod').value = kod; $('#iAdet').value = adet; islem('sat'); };

async function maliyetGoster() {
  const kod = $('#iKod').value.trim().toUpperCase(), adet = Number($('#iAdet').value);
  if (!kod || !adet) { $('#iMaliyet').textContent = ''; return; }
  const h = hisseler.find(x => x.kod === kod);
  if (!h?.fiyat) { $('#iMaliyet').textContent = ''; return; }
  const tutar = adet * h.fiyat;
  $('#iMaliyet').innerHTML =
    `${adet} × ${h.fiyat.toFixed(2)} ₺ = <b>${para(tutar)} ₺</b> <span style="color:var(--soluk)">(+ %0.02 komisyon)</span>`;
}

async function portfoyYukle() {
  try { portfoyCiz(await (await fetch('/api/portfoy')).json()); }
  catch { $('#pUyari').innerHTML = '<div class="uyari">Portföy okunamadı.</div>'; }
}

async function islem(tip) {
  const kod = $('#iKod').value.trim().toUpperCase(), adet = $('#iAdet').value;
  if (!kod || !adet) { $('#pUyari').innerHTML = '<div class="uyari">Hisse kodu ve adet gerekli.</div>'; return; }
  $('#pUyari').innerHTML = '';
  $('#bAl').disabled = $('#bSat').disabled = true;
  try {
    const d = await (await fetch('/api/portfoy', { method:'POST', headers:{'Content-Type':'application/json'},
      body: JSON.stringify({ islem:tip, kod, adet:Number(adet) }) })).json();
    if (d.hata) { $('#pUyari').innerHTML = `<div class="uyari">${esc(d.hata)}</div>`; return; }
    $('#iAdet').value = ''; $('#iMaliyet').textContent = ''; portfoyCiz(d);
  } finally { $('#bAl').disabled = $('#bSat').disabled = false; }
}

/* ═════════ SIMULASYON ═════════ */
let simVeri = null, simSecili = '1 yıl', simOlcut = 'altin', simLikit = true;
const LIKIT_ESIK = 50e6;   // gunluk TL islem hacmi — altindakine gercekten girilemezdi
const OLCUT_AD = { tufe:'TÜFE', dolar:'Dolar', altin:'Altın' };

// Nominal getiriyi secilen olcute gore reel getiriye cevirir.
// %26 kazanc, altin %45 arttiysa -> alim gucun AZALMIS demektir.
const reel = (nominal, olcut) =>
  nominal == null || olcut == null ? null : ((1 + nominal/100) / (1 + olcut/100) - 1) * 100;

function simCiz() {
  if (!simVeri) return;
  const kaynak = simLikit && simVeri.ozetLikit ? simVeri.ozetLikit : simVeri.ozet;
  const oz = kaynak.find(o => o.donem === simSecili);
  const olc = simVeri.olcutler[oz.gun] ?? {};
  const e = olc[simOlcut];

  $('#simOzet').innerHTML =
    '<thead><tr><th class="sol">O zamanki puan</th><th>Hisse</th><th>Nominal ort.</th><th>Nominal medyan</th>' +
    '<th>REEL ort.</th><th>REEL medyan</th></tr></thead><tbody>' +
    oz.kovalar.map(k => `<tr>
      <td class="sol"><b>${esc(k.ad)}</b></td><td>${k.adet}</td>
      <td style="color:${renk(k.ortalama)}">${yuzde(k.ortalama,1)}</td>
      <td style="color:${renk(k.medyan)}">${yuzde(k.medyan,1)}</td>
      <td style="color:${renk(reel(k.ortalama,e))};font-weight:650">${yuzde(reel(k.ortalama,e),1)}</td>
      <td style="color:${renk(reel(k.medyan,e))};font-weight:650">${yuzde(reel(k.medyan,e),1)}</td></tr>`).join('') +
    `<tr style="border-top:2px solid var(--cizgi)"><td class="sol" style="color:var(--soluk)">Tüm hisseler</td>
      <td>–</td><td style="color:${renk(oz.tumu)}">${yuzde(oz.tumu,1)}</td><td>–</td>
      <td style="color:${renk(reel(oz.tumu,e))};font-weight:650">${yuzde(reel(oz.tumu,e),1)}</td><td>–</td></tr></tbody>`;

  const hepsi = ['dolar','altin','tufe'].filter(k => olc[k] != null)
    .map(k => OLCUT_AD[k] + ' %' + olc[k].toFixed(1)).join(' · ');
  $('#simYorum').innerHTML =
    '<div class="uyari" style="margin:11px 0"><b>Bu dönemde: ' + hepsi + '</b><br>' +
    'Nominal getirin bu oranın altındaysa <b>alım gücün azalmış</b> demektir — kâğıt üzerinde ' +
    'kazanmış görünsen bile. Asıl bakılacak sütun <b>REEL</b> olanıdır.' +
    (olc.tufe == null ? '<br><span style="opacity:.85">TÜFE için TCMB EVDS anahtarı gerekiyor; ' +
      'eklenirse resmi enflasyona göre de hesaplanır.</span>' : '') + '</div>' +
    '<div>Ortalama ile medyan farkı önemli: birkaç aşırı yükselen hisse ortalamayı şişirir. ' +
    '<b>Medyan</b> tipik hisseyi gösterir, ortalamadan daha güvenilirdir.</div>' +
    (simLikit
      ? '<div style="margin-top:6px;opacity:.85">Yalnızca o tarihte günde <b>50 mn TL üstü</b> işlem gören ' +
        'hisseler sayılıyor. Bu filtre olmadan sonuçlar, o gün birkaç milyon TL işlem gören ' +
        've gerçekte alınamayacak mikro hisselerin aşırı getirileriyle şişer.</div>'
      : '<div style="margin-top:6px;color:var(--sari)">Filtresiz görünüm: listedeki bazı hisselere ' +
        'o tarihte likidite yetersizliğinden <b>gerçekte girilemezdi</b>; getirileri kâğıt üzerindedir.</div>') +
    (oz.gun >= 730
      ? '<div style="margin-top:6px;color:var(--sari)"><b>' + simSecili + ' geriye bakıldığında hayatta kalma yanlılığı büyür:</b> ' +
        'bu evren <b>bugün işlem gören</b> şirketlerden oluşuyor. O tarihte var olup sonradan ' +
        'borsadan çıkan, birleşen ya da batan şirketler burada yok — yani tüm kovaların getirisi ' +
        'gerçekte olduğundan iyimserdir.</div>'
      : '');

  const g = $('#simAra').value.trim().toLocaleUpperCase('tr');
  const sin = $('#simSinyal').value, minPuan = parseFloat($('#simPuan').value);
  const satirlar = simVeri.hisseler.flatMap(h => {
    const d = h.donemler.find(x => x.ad === simSecili);
    return d ? [{ ...d, kod: h.kod, ad: h.ad, fiyatSimdi: h.fiyat }] : [];
  }).filter(r => {
    if (g && !(r.kod.includes(g) || (r.ad??'').toLocaleUpperCase('tr').includes(g))) return false;
    if (sin && r.sinyal !== sin) return false;
    if (!isNaN(minPuan) && r.puan < minPuan) return false;
    if (simLikit && !(r.hacim >= LIKIT_ESIK)) return false;
    return true;
  }).sort((a,b) => b.getiri - a.getiri);

  $('#simSayac').textContent = `${satirlar.length} hisse · ${simSecili} önce alsaydım`;
  $('#simTablo').innerHTML = satirlar.length
    ? '<thead><tr><th class="sol">Hisse</th><th class="sol">Tarih</th><th class="sol">Bilanço</th>' +
      '<th>O zamanki puan</th><th class="sol">Sinyal</th><th>F/K</th><th>PEG</th>' +
      '<th>O zamanki fiyat</th><th>Bugün</th><th>Nominal</th><th>REEL</th></tr></thead><tbody>' +
      satirlar.map(r => `<tr>
        <td class="sol"><span class="kod">${esc(r.kod)}</span><br><span class="ad">${esc((r.ad??'').slice(0,24))}</span></td>
        <td class="sol">${esc(r.tarih)}</td><td class="sol" style="color:var(--soluk)">${esc(r.donem)}</td>
        <td class="puan" style="color:${renk(r.puan)}">${r.puan>0?'+':''}${r.puan}</td>
        <td class="sol"><span class="rozet" style="color:${SINYAL_RENK[r.sinyal]??'var(--notr)'}">${esc(r.sinyal)}</span></td>
        <td>${say(r.fk)}</td><td>${say(r.peg,2)}</td>
        <td>${say(r.fiyatOZaman,2)}</td><td>${say(r.fiyatSimdi,2)}</td>
        <td style="color:${renk(r.getiri)}">${yuzde(r.getiri,1)}</td>
        <td style="color:${renk(reel(r.getiri,e))};font-weight:700">${yuzde(reel(r.getiri,e),1)}</td></tr>`).join('') + '</tbody>'
    : '<tbody><tr><td class="bos">Kayıt yok.</td></tr></tbody>';
}

async function simYukle() {
  if (simVeri) return;
  try {
    simVeri = await (await fetch('/veri/gecmis.json')).json();
    $('#simDonem').innerHTML = simVeri.ozet.map(o =>
      `<button data-d="${esc(o.donem)}"${o.donem===simSecili?' class="aktif"':''}>${esc(o.donem)} önce</button>`).join('');
    $('#simDonem').querySelectorAll('button').forEach(b => b.onclick = () => {
      simSecili = b.dataset.d;
      $('#simDonem').querySelectorAll('button').forEach(x => x.classList.toggle('aktif', x === b));
      simCiz();
    });
    const varOlan = ['dolar','altin','tufe'].filter(k => simVeri.olcutler[365]?.[k] != null);
    $('#simOlcut').innerHTML = varOlan.map(k =>
      '<button data-o="' + k + '"' + (k===simOlcut?' class="aktif"':'') + '>' + OLCUT_AD[k] + '</button>').join('');
    $('#simLikit').innerHTML =
      '<button data-l="1"' + (simLikit ? ' class="aktif"' : '') + '>İşlem görebilir (≥50 mn/gün)</button>' +
      '<button data-l="0"' + (simLikit ? '' : ' class="aktif"') + '>Tümü</button>';
    $('#simLikit').querySelectorAll('button').forEach(b => b.onclick = () => {
      simLikit = b.dataset.l === '1';
      $('#simLikit').querySelectorAll('button').forEach(x => x.classList.toggle('aktif', x === b));
      simCiz();
    });
    $('#simOlcut').querySelectorAll('button').forEach(b => b.onclick = () => {
      simOlcut = b.dataset.o;
      $('#simOlcut').querySelectorAll('button').forEach(x => x.classList.toggle('aktif', x === b));
      simCiz();
    });
    simCiz();
  } catch {
    $('#simOzet').innerHTML = '<tbody><tr><td class="bos">Simülasyon verisi yok.</td></tr></tbody>';
  }
}

/* ═════════ FIYAT + KAP ═════════ */
async function fiyatlariYukle() {
  try {
    const r = await (await fetch(`/api/fiyat?kod=${TAKIP.join(',')}`)).json();
    $('#fiyatlar').innerHTML = r.filter(f => !f.hata).map(f => {
      const d = f.degisimYuzde ?? 0;
      return `<div class="fkart"><div class="fkod">${esc(f.kod)}</div><div>${f.fiyat?.toLocaleString('tr')}</div>
        <div style="font-size:12px;color:${renk(d)}">${yuzde(d,2)}</div></div>`;
    }).join('');
  } catch {}
}

async function bildirimleriYukle() {
  $('#bildirimler').innerHTML = '<div class="bos">Yükleniyor…</div>';
  try {
    const d = await (await fetch(`/api/bildirimler?gunler=${$('#gunler').value}&min=${$('#min').value}`)).json();
    $('#bildirimler').innerHTML = d.kayitlar.length ? d.kayitlar.map(k => `<div class="kayit">
      <span class="yildiz">${'★'.repeat(k.onem)}</span> <b>${esc(k.etiket)}</b>
      <span class="saat">${esc(k.tarih)}</span>
      <div style="font-size:13.5px">${esc(k.baslik)}</div>
      <div style="font-size:12px;margin-top:4px"><a href="${k.url}" target="_blank" rel="noopener">KAP'ta aç</a></div>
    </div>`).join('') : '<div class="bos">Bu aralıkta bildirim yok.</div>';
  } catch { $('#bildirimler').innerHTML = '<div class="bos">Bildirimler alınamadı.</div>'; }
}

/* ═════════ BAGLAMALAR ═════════ */
$('#hazir').querySelectorAll('button[data-h]').forEach(b => b.onclick = () => hazirUygula(b.dataset.h));
$('#bCanli').onclick = canliGuncelle;
ALANLAR.forEach(k => $('#'+k).oninput = ciz);
$('#bAl').onclick = () => islem('al');
$('#bSat').onclick = () => islem('sat');
$('#iKod').oninput = maliyetGoster;
$('#iAdet').oninput = maliyetGoster;
$('#bIzle').onclick = async () => {
  const kodlar = $('#iIzleme').value.split(',').map(s => s.trim().toUpperCase()).filter(Boolean);
  const d = await (await fetch('/api/portfoy',{method:'POST',headers:{'Content-Type':'application/json'},
    body:JSON.stringify({islem:'izle',kodlar})})).json();
  $('#nobetSonuc').textContent = `Kaydedildi: ${(d.izleme??[]).join(', ') || '(boş)'}`;
};
$('#bNobet').onclick = async () => {
  $('#nobetSonuc').textContent = 'kontrol ediliyor…';
  try {
    const d = await (await fetch('/api/nobet')).json();
    $('#nobetSonuc').textContent = `${d.izlenen} hisse kontrol edildi · ${d.degisen} sinyal değişikliği` +
      (d.degisen ? ' → ' + d.degisenler.map(x => `${x.kod} ${x.eski}→${x.yeni}`).join(', ') : '') +
      ` · Telegram: ${d.telegram.gonderildi ? 'gönderildi' : d.telegram.sebep}`;
  } catch { $('#nobetSonuc').textContent = 'kontrol başarısız'; }
};
['simAra','simSinyal','simPuan'].forEach(k => $('#'+k).oninput = simCiz);
$('#gunler').onchange = bildirimleriYukle;
$('#min').onchange = bildirimleriYukle;

taramaYukle(); fiyatlariYukle(); bildirimleriYukle();
