# BIST / KAP takip sistemi

**Yayinda:** https://bist-lynch.netlify.app
(Netlify projesi `bist-lynch`, hesap `mem`/Free)

BIST hisseleri icin KAP bildirimlerini ve fiyat verisini toplayan arac.

```bash
./bist.mjs bugun --gunler 2 --min 4    # son 2 gun, onemli bildirimler
./bist.mjs hisse THYAO                 # fiyat + o hisseye ait bildirimler
./bist.mjs fiyat THYAO GARAN XU100     # hizli fiyat
./bist.mjs bugun --llm                 # bildirimleri LLM ile okuyup puanla
```

## KAP API'si — tersine muhendislikle cikarildi

KAP'in resmi bir API dokumani yok. Eski JSON uclari (`/tr/api/disclosure/list/main`
GET vb.) kapali; site Next.js'e gecmis. Asil istek tarayici trafigi yakalanarak
bulundu (Chrome DevTools Protocol).

### Bildirim listesi

```
POST https://www.kap.org.tr/tr/api/disclosure/list/main
Accept-Language: tr
Content-Type: application/json

{"fromDate":"04.09.2026","toDate":"04.09.2026","memberTypes":["IGS","DDK"]}
```

**Tuzaklar:**
- Tarih bicimi `GG.AA.YYYY` — ISO kabul edilmiyor.
- Alan adi **`memberTypes`** (cogul, dizi). Sayfanin JS paketinde gorunen
  22 alanli sema (`memberType` tekil dahil) *gelismis arama formuna* ait ve
  ana listede HTTP 400 veriyor. Bu ayrim epey vakit kaybettirir.
- `GET` ayni yolda 405 doner — POST sart.

Yanit: `[{disclosureBasic:{...}, disclosureDetail:{...}}]`

Ise yarayan alanlar: `disclosureIndex`, `title`, `relatedStocks`,
`companyTitle`, `publishDate`, `disclosureClass`, `summary`, `attachmentCount`.

**Onemli:** `relatedStocks` kayitlarin ~%64'unde bos. Bu durumda
`companyTitle` kullanilmali — Finansal Rapor ve Sermaye Artirimi gibi en
degerli bildirimler tam da hisse kodu bos olanlar arasinda.

### Bildirim detayi

```
GET https://www.kap.org.tr/tr/Bildirim/{disclosureIndex}
```

Detay sayfasi ayri API cagirmiyor; icerik sunucuda basiliyor ve RSC yukunun
icinde **kacisli** HTML olarak duruyor. Kacislari cozdukten sonra ic ice
uc bicim var:

1. **Serbest metin** — `<td class="...taxonomy-context-value-summernote...content-tr">`
   Ozel Durum Aciklamalari boyle. (`content-en` ayni icerigin Ingilizcesi;
   alinirsa metin iki katina cikar.)
2. **Yapilandirilmis tablo** — `<div class="gwt-Label ... content-tr">`
   Finansal Rapor'lar boyle (eski GWT tablosu). Bilanco kalemleri buradan cikiyor.
3. **Sadece PDF** — Sermaye Artirimi gibi bildirimlerde sayfada hic govde yok.

**Ekler** RSC yukunde: `"objId":"<32 hex>","fileName":"..."`
Indirme adresi:

```
GET https://www.kap.org.tr/tr/api/file/download/{objId}   -> application/pdf
```

**Hisse kodu kurtarma:** Liste API'si `relatedStocks`i cogu kayitta bos
donuyor ama detay sayfasinda kod var — `/tr/sirket-bilgileri/ozet/`
baglantisindan sonraki ilk `"children":"XXXX"`. KLYPV, BRLSM, DUNYH gibi
kodlar ancak boyle bulunuyor.

## Gurultu orani

Gercek bir gunun verisinde (451 kayit): **%66'si kural ile elenebiliyor.**

| Baslik | Adet | Deger |
|---|---|---|
| Pay Bazinda Devre Kesici | 186 | yok — mekanik |
| Pay Disinda Sermaye Piyasasi Araci | 68 | hisse icin yok |
| Ozel Durum Aciklamasi (Genel) | 40 | **yuksek** |
| Pay Alim Satim Bildirimi | 31 | **yuksek** |
| Paylarin Geri Alinmasi | 11 | orta |
| Sermaye Artirimi - Azaltimi | 5 | **yuksek** |
| Finansal Rapor | 8 | **yuksek** |

Eleme `src/kap.mjs` icindeki `GURULTU` listesinde. LLM'e gitmeden once
uygulanmasi kritik: 451 bildirimi modele okutmak yerine 154'unu okutuyoruz.

## Toplu tarama

```bash
./bist.mjs tarama --es 10        # tum BIST (~700 sirket), ~1 dakika
./bist.mjs tarama --adet 100     # ilk 100 ile sinirla
```

Sonuc `public/veri/tarama.json` dosyasina yazilir; web arayuzu bu STATIK
dosyayi okur ve filtrelemeyi tamamen tarayicida yapar. Boylece Netlify'in
10 saniyelik fonksiyon siniri tabloyu hic ilgilendirmez.

Sirket listesi KAP'in `/tr/bist-sirketler` sayfasindan cikarilir (acik API yok,
veri RSC yukune gomulu). `veri/sirketler.json` olarak onbellege alinir.

**Gercek sayilar** (4 Eylul 2026 taramasi):

| | |
|---|---|
| Listede sirket | 702 |
| Mali tablosu okunabilen | 572 |
| F/K hesaplanabilen | 294 |
| Lynch olcutlerine uyan (PEG<1, borc<0.5, buyume>%10) | 38 |

Eksik olanlar cogunlukla fon, VKS ve GYO gibi standart XI_29 tablosu
vermeyen kurumlar — bunlar sessizce atlanir.

## Peter Lynch puanlamasi

```bash
./bist.mjs lynch THYAO ASELS TUPRS --detay
```

Tamamen mekanik — LLM yok, yorum yok, NVIDIA kotasi harcamaz. Alti olcut:
degerleme (PEG ya da PD/DD), borc/ozkaynak, buyume hizi (%20-25 ideal aralik),
uc yillik kar egilimi, net nakit, stok/satis uyarisi. En yuksek puan 9.

### 5 Eylul 2026 revizyonu — olculen kusurlar ve duzeltmeleri

Backtest, YUKSEK puanli kovanin DUSUK puanli kovadan daha kotu getirdigini
gosterdi. Nedeni arastirildi; dordu de olcum hatasi cikti.

**1. Buyume 20 aya kadar bayatti.** Buyume iki TAM YIL karsilastirmasindan
geliyordu (2026 Eylul'unde 2025 ile 2024'u kiyasliyordu) — oysa TTM elde hazirdi.
EREGL'de eski yontem -%97 gosteriyordu, gercek son-12-ay degisimi -%17'ydi.
Duzeltme: ikinci bir istekle `[y-2,p]`, `[y-3,12]`, `[y-3,p]`, `[y-4,12]` cekilip
uc ardisik 12 aylik pencere kuruldu; ucune de ayni formul uygulaniyor.
Uc EN FAZLA 4 donem donduruyor (olculdu: 5. deger gelmiyor), o yuzden iki istek
paralel atiliyor — zaman maliyeti yok, istek sayisi iki katina cikiyor.

**2. Negatif tabana bolme.** `yuzdeDegisim` tabanin negatif olmasini
denetlemiyordu. Zarardan (-50) kara (+100) gecen sirket "-%300 buyume"
gosteriyordu — yani Lynch'in en degerli sinyali TERS ISARETLE giriyordu.
Duzeltme: taban <= 0 iken yuzde uretilmiyor; bunun yerine `karDurumu()`
isaret degisimini okuyor (`zarardan kara` +2, `kardan zarara` -2, `zararda` -2).
Bu duzeltme piyasanin gercek halini acti: BIST'in %46'si (255/557 sirket)
son 12 ayda zararda ya da zarara gecmis. Eski algoritma bunlarin yarisini
anlamsiz bir `toparlanma` kovasina dolduruyordu (282 hisse).

**3. Ayni bilgi iki kez cezalandiriliyordu.** Kar dususu hem PEG olcutunden
(-2, "buyume yok/negatif") hem Buyume olcutunden (-2) puan kaybettiriyordu.
Duzeltme: degerleme tek yuva oldu — PEG yalnizca buyuyen sirkette anlamli
oldugu icin, buyumeyen/dipten donen sirkette yerini **PD/DD**'ye birakiyor
(Lynch turnaround ve varlik oyunlarini defter degeri uzerinden degerlendirirdi).
Ayni sekilde borcsuzluk hem Borc (+2) hem Nakit (+1) olcutunden puan aliyordu;
Nakit artik yalnizca net nakit piyasa degerinin %20'sini asinca puan veriyor
(Lynch'in "gercek F/K" hesabi: fiyattan nakti dus).

**4. Toparlanma gorunmezdi.** Uc pencere elde olunca `egilim()` eklendi:
istikrarli buyume / toparlaniyor / ivme kaybi / dalgali / istikrarli daralma.
Dipten donus +1 aliyor — Lynch'in en cok deger verdigi kategori artik yakalaniyor.

Ayrica **AL sinyali kar sartina baglandi**: defter degerinin altinda + borcsuz
oldugu icin AL alan 9 ZARAR EDEN sirket vardi. Lynch zarar eden sirkete al demezdi.

**Sonuc (ayni evren, ayni donem, eski vs yeni):** 3 ayda sira korelasyonu
0.064 -> 0.191. 1 yilda yuksek/dusuk kova farki 4 puandan 13 puana cikti.
Asil kazanim su: eski algoritmada dusuk puanli kova yuksek puanliyi yeniyordu,
artik uc donemde de dogru sirada. BIMAS eski algoritmada -3 KACIN'di, yeni
algoritmada +6 AL (PEG 0.35, toparlaniyor).

**Durustluk notu:** korelasyonlar hala zayif (0.01-0.27). Istatistiksel olarak
anlamli ayirt etme yalnizca **3 ve 4 yillik** vadelerde cikiyor (p<0.05) —
ki bu Lynch'in kendi tutma vadesidir. Kisa vadede sistem yol gostermiyor.

**Temel veri kaynagi** (Is Yatirim, anahtarsiz):

```
GET isyatirim.com.tr/_layouts/15/Isyatirim.Website/Common/Data.aspx/MaliTablo
    ?companyCode=THYAO&exchange=TRY&financialGroup=XI_29
    &year1=2026&period1=6&year2=2025&period2=6&year3=2025&period3=12&year4=2024&period4=12
```

147 kalem, 4 donem yan yana. Kullanilan kodlar: `3Z` ana ortaklik net kari,
`3C` satis gelirleri, `2N` ozkaynak, `2OA` odenmis sermaye, `2AA`+`2BA`
finansal borc, `1AA` nakit, `1AF` stok.

**Tuzak 1 — kumulatif tablolar.** Turkiye'de donem 6 = ilk 6 ay, 12 = tum yil.
Son 12 ay (TTM) icin cikarma gerekir:
`TTM = cari kumulatif + gecen yil tam − gecen yilin ayni kumulatifi`

**Tuzak 2 — dusuk taban.** KCHOL 2024'te 1.7 mlr, 2025'te 25.9 mlr kar etti;
buyume %1416 cikiyor ve PEG 0.01 oluyor. Aritmetik dogru, analitik anlamsiz.
`tabanSaglam()` bunu yakalayip hisseyi Lynch'in AYRI kategorisine
(`toparlanma` / turnaround) atiyor ve PEG uygulamiyor.

Esik **buyume > %100** olarak konuldu (kar en az ikiye katlanmis demektir).
Ilk denemede esik "taban, cari karin %15'inden kucukse" idi ve yetersiz kaldi:
%511 buyuyen TRALT ile %323 buyuyen ATATP suzgeci gecip PEG 0.06 ve 0.04 ile
listenin basina yerlesti. Bu duzeltmeyle "asiri hizli" kategorisi 76'dan 28'e
dustu; gerisi dogru sekilde `toparlanma`ya gecti.

**Varsayim:** hisse adedi = odenmis sermaye (`2OA`). Turkiye'de nominal deger
neredeyse her zaman 1 TL oldugu icin bu gecerlidir; nominali farkli bir sirkette
piyasa degeri ve F/K yanlis cikar.

**Sinir:** buyume nominal TL uzerinden. Yuksek enflasyonda nominal buyume
gercek buyumeyi abartir; Lynch'in esikleri dusuk enflasyonlu ABD icin yazilmistir.

## Backtest'in durustluk kosullari

`./bist.mjs gecmis --adet 300` — 8 donem (1 ay ... 5 yil), her tarih icin
O GUN yayimlanmis bilancolarla puanlama (look-ahead bias yok).

**Likidite filtresi sart.** Filtresiz calistirildiginda en cok kazandiran
hisseler gunde birkac milyon TL islem goren mikro hisselerdi — o pozisyonlara
gercekte girilemezdi. `ozetle(hisseler, 50e6)` gunluk 50 mn TL esigi uygular;
arayuzde de varsayilan acik.

**Ortalama degil medyan.** Tek bir %1385'lik hisse butun kovanin ortalamasini
kaldiriyor. Kovalar medyanla karsilastirilmali.

**Hayatta kalma yanliligi vadeyle buyur.** Evren BUGUN islem goren sirketlerden
kuruluyor; o tarihte var olup sonradan borsadan cikan/batan sirketler yok.
5 yillik sonuclar bu yuzden tum kovalarda iyimser.

**Olcut secimi sonucu tersine cevirir.** 5 yilda BIST'in medyan hissesi dolara
gore +%6, gram altina gore -%57. Ayni veri, iki farkli hukum. Gram altin
5 yilda 480 TL'den 6.969 TL'ye cikti (+%1352): lira dolara karsi %83 deger
kaybetti VE altin dolar bazinda %149 yukseldi — iki kuvvet carpildi.

## Fiyat verisi

Yahoo Finance, anahtarsiz ve bedava:
`https://query1.finance.yahoo.com/v8/finance/chart/THYAO.IS?range=1mo&interval=1d`

BIST sembolleri `.IS` ekiyle (`THYAO.IS`), endeksler de calisiyor (`XU100.IS`).
15 dakika gecikmeli — tarama ve backtest icin yeterli, anlik islem icin degil.
`quoteSummary` (temel veri) ayrica crumb/cookie istiyor, henuz kullanilmiyor.

## LLM katmani

`src/analiz.mjs`, NVIDIA NIM uzerinden `nvidia/nemotron-3-super-120b-a12b`
kullaniyor (olculdu: ort 1.3s, kati bicim talimatina uyuyor). Anahtari
`~/Desktop/nv/.env` dosyasindan okuyor — tek kaynak.

Model `SKOR|GEREKCE` bicimide tek satir donduruyor; skor -1..+1.

Model `SKOR|GEREKCE` bicimi ile tek satir donduruyor.

**Onemli:** `max_tokens` en az 400 olmali. 120 verildiğinde model dusunme
butcesini tuketip ic muhakemesini cevabin icine tasiyor ve cikti bozuluyor.

Kota biterse tum modeller HTTP 403 doner (`/v1/models` listesi yine acilir).
O durumda sistem baslik tabanli onem siralamasina (1-5 yildiz) dusuyor,
cokmuyor. NIM ara sira 503 veriyor; 3 kez artan beklemeyle yeniden deneniyor.

## Bilinen sinir

Finansal Rapor'larda sayfadan cikan metin bilanco **kalem adlariyla** basliyor,
rakamlar cok sonra geliyor. Modele ilk 3000 karakter gonderildigi icin
"sadece hesap listesi, etkisiz" diyor — ki dogru soyluyor. Finansal
raporlardan gercek sinyal almak icin PDF ayristirmak ya da metnin rakam iceren
bolumunu secmek gerekir. Su an bu bildirimler icin ek PDF baglantisi veriliyor.

## Sanal portfoy

Gercek para yok, emir gonderilmez. Baslangic 100.000 TL, komisyon binde 0.2
(BIST'te tipik oran). Durum Netlify Blobs'ta; alim/satim daima **guncel
fiyattan** yapilir, kullanicidan fiyat alinmaz.

Ortalama maliyet komisyon dahil tutulur; kismi satista maliyet oransal dusulur.
Aciga satis yok — elde olandan fazlasi satilamaz.

## Alim sinyali

`src/lynch.mjs` icindeki `sinyal()` tek tanim; hem tarama hem nobetci
ayni fonksiyonu kullanir (kural iki yerde tekrarlanmaz):

| Sinyal | Kosul |
|---|---|
| **AL** | puan >= 4 **ve** PEG < 1 **ve** borc/ozkaynak < 0.5 |
| **KAÇIN** | puan <= -3 |
| **BEKLE** | arasi |

4 Eylul 2026 taramasinda: 32 AL, 391 BEKLE, 138 KAÇIN.

## Nobetci ve Telegram

`src/nobetci.mjs` izlenen hisselerin sinyalini yeniden hesaplar ve
**degisenleri** Telegram'a yazar. Izlenenler = portfoydeki pozisyonlar +
elle girilen izleme listesi (en cok 15 — 10 saniyelik fonksiyon sinirina
sigmasi icin).

**Netlify'da bir fonksiyon hem `schedule` hem `path` tasiyamaz;** zamanlanmis
fonksiyona HTTP istegi atarsan Netlify reddeder. Bu yuzden ayni cekirdek iki
ince sarmalayicidan cagrilir:

- `nobet.mjs` — zamanlanmis (hafta ici seans icinde 30 dk'da bir)
- `nobet-elle.mjs` — `GET /api/nobet`, arayuzdeki "Simdi kontrol et"

Telegram anahtarlari yoksa sistem calismaya devam eder, sadece bildirim
gonderilmez.

## Veri ne kadar canli

| Katman | Nasil gelir | Gecikme |
|---|---|---|
| Fiyatlar, portfoy K/Z | her istekte Yahoo'dan | 15 dk (Yahoo'nun gecikmesi) |
| KAP bildirimleri | her istekte KAP'tan | gecikme yok, 10 dk onbellek |
| Lynch taramasi | `tarama.json` statik dosya | son derlemeden beri |

**Tarama neden statik:** tam tarama ~1 dakika (574 hisse x 2 dis istek), fonksiyon
siniri ise 10 saniye. Iki mekanizmayla tazelenir:

1. **Derleme sirasinda.** `netlify.toml` build komutu `bist.mjs tarama` calistirir.
   Derlemede 10 saniye siniri yoktur. Basarisiz olursa dagitim durmaz.
2. **Gunluk otomatik — HENUZ ETKIN DEGIL.** `yenile.mjs` (zamanlanmis, hafta ici 05:30 UTC) derleme
   kancasina POST atar -> site yeniden kurulur -> tarama tazelenir.
   `BUILD_HOOK_URL` tanimli degilse sessizce atlanir — su an oyle.
   **Sebep:** derleme kancasi Netlify'in siteyi yeniden kurabilmesini gerektirir,
   bu da bagli bir Git deposu ister. Site CLI ile dogrudan yuklendigi icin
   depo yok. Secenekler: (a) GitHub deposu baglayip kancayi tanimlamak,
   (b) yerelde `bist.mjs tarama` calistirip yeniden yuklemek.

**Canli F/K.** Tarama ham temel veriyi de saklar (`ttmKar`, `hisseAdedi`).
Bunlar ceyreklik degisir, fiyat ise canlidir; arayuzdeki "Canli fiyatla guncelle"
dugmesi gorunen satirlar icin

```
F/K = (hisseAdedi x guncel fiyat) / ttmKar
PEG = F/K / buyume
```

hesabini yeniden yapar; guncellenen satirlar ` • ` ile isaretlenir.
(`/api/fiyat` istek basina 12 kod aldigi icin en cok 36 satir, 3 parca halinde.)

## Netlify dagitimi

```
public/index.html            pano
netlify/functions/
  bildirimler.mjs            GET /api/bildirimler?gunler=2&min=4
  skorla.mjs                 GET /api/skorla?index=N     (tek bildirim, ~3.5sn)
  lynch.mjs                  GET /api/lynch?kod=A,B,C    (12 hisseye kadar, ~0.4sn)
  fiyat.mjs                  GET /api/fiyat?kod=A,B
  tara.mjs                   zamanlanmis, hafta ici 06:30 UTC
```

**Free plan kisiti: fonksiyon zaman asimi 10 saniye** (arka plan fonksiyonlari
Pro istiyor). Tum LLM taramasi ~80sn surdugu icin is parcalanmistir: liste
ayri gelir, puanlama bildirim basina AYRI istekle yapilir (~3.5sn) ve sonuc
Netlify Blobs'a yazilir. Ayni bildirim bir daha modele gonderilmez.

Blobs erisimi `src/onbellek.mjs` uzerinden; Netlify baglami disinda
(yerelde, testte) sessizce devre disi kalir, sistem onbelleksiz calisir.

**Dagitmadan once Netlify panelinde tanimlanacak ortam degiskenleri**
(hicbiri repoda YOKTUR):

| Degisken | Olmazsa ne olur |
|---|---|
| `NVIDIA_API_KEY` | Sadece `/api/skorla` calismaz; liste, Lynch, portfoy etkilenmez |
| `TELEGRAM_BOT_TOKEN` | Nobetci calisir, bildirim gonderilmez |
| `TELEGRAM_CHAT_ID` | Ayni |

## Yapilmadi

- Backtest motoru
- Bildirim gecmisi saklama (her cagri canli cekiyor)
- Otomatik emir — bilincli olarak yok; sinyaller elle degerlendirilir
