# Kura Çek

Ücretsiz, reklamsız, kayıtsız, Türkçe ve **adil olduğunu kanıtlayan** rastgelelik uygulaması. Gerçek 3D animasyonlar, sunucu yok.

**Canlı:** https://barisgokdemir.github.io/kura-cek/

## Modüller

| Modül | Özellikler |
| --- | --- |
| Yazı-Tura | 3D para; dokun, yukarı kaydır veya salla (Android). 1–10 para, 3'te 2 / 5'te 3 seri, özel yüz etiketleri |
| Zar | 1–6 zar; d4–d20. Toplam, zar tutma, tavla modu (Şeşbeş, Düşeş…) |
| Kısa Çubuk | İsim ya da kişi sayısı, N kısa çubuk, "hepsini birden" ve "elden ele" modları |
| Custom Liste | Çark, N sonuç (tekrarsız), tümünü sırala; favoriler ve şablonlar |
| Şişe Çevirme | 3D şişe, isimler masanın çevresinde; şişe önceden seçilen kişiye döner |
| Tombala | 1–90 torba sırası baştan mühürlenir; sesli okuma, otomatik çekiliş, tahta, yazdırılabilir kartlar; her karta link — oyuncu kendi telefonunda işaretler, çinko/tombala otomatik algılanır |
| Parmak Seçici | Çoklu dokunma; kazanan seç ya da takımlara böl (masaüstünde tıklayarak) |
| Takım Kurucu | N takım; seviye verilirse yılan sırasıyla dengeli dağıtım |
| İsim-Şehir | Türk alfabesi, zor harfleri çıkarma, tekrar etmeme, geri sayım |
| Hediyeleşme | Kısıtlı eşleşme (kendini/eşini çekmeme); elden ele ya da kişiye özel link |
| Taş-Kağıt-Makas | Uygulamaya karşı (uygulamanın hamlesi oyuncu seçmeden önce mühürlenir) ya da iki kişi aynı ekranda |
| Sihirli Küre | Küre içindeki 3D tamburda cevaplar döner ve önceden seçilene iner; klasik 20 cevap ya da Evet/Hayır/Belki |
| Rastgele Sayı | Aralık, adet, tekrarsız, sıralı; 1–6, 1–100, loto kalıpları |
| Kazı Kazan | Ödüller kartlara karıştırılır; her kişi kendi linkini açıp parmağıyla kazır |
| İskambil Kartı | Mühürlü karıştırılmış deste (isteğe bağlı joker); kart çek ya da herkes çeksin, yüksek kart kazansın |
| Nöbet Sırası | Her gün / hafta içi / haftalık; herkese eşit nöbet, tarihlere dağıtılmış, yazdırılabilir |
| Oturma Planı | Sınıf sıraları (ikişerli) ya da masalar; yan yana oturmaması gerekenleri ayırır |
| Sayışmaca | 22 geleneksel tekerleme hece hece sayar; son hece ebe ya da eleme; başlangıç kişisi rastgele ve mühürlü |

Tüm ikonlar SVG; emoji kullanılmaz, her cihazda aynı görünür.

Ortak: hızlı Evet/Hayır, son 50 sonucun geçmişi, ses, titreşim, konfeti, paylaşım, açık/koyu tema, `prefers-reduced-motion` ile 2D'ye düşme, JSON dışa/içe aktarma, PWA (internetsiz çalışır).

## Adillik

- Tüm sonuçlar `crypto.getRandomValues()` ile üretilir; `Math.random()` sonuç için kullanılmaz.
- Mod sapmasına karşı **rejection sampling**, sıralama için **Fisher–Yates** (`js/rng.js`).
- **Önce sonuç, sonra animasyon:** para, zar ve çark önceden belirlenen sonuca iner.
- Her sonuç; modül, girdi, sonuç, zaman damgası ve nonce ile SHA-256 parmak izi alınarak mühürlenir. Kısa Çubuk'ta diziliş çekilişten önce mühürlenir ve kodu baştan gösterilir.
- Hileli mod yok.

## Geliştirme

Derleme adımı yok; saf HTML + CSS + ES modules.

```sh
npm install        # yalnızca testler ve three.js paketlemesi için
npm start          # http://localhost:5173
npm test           # RNG testleri (dağılım ki-kare testleri dahil)
npm run build:three  # vendor/three.min.js'i yeniden üret (yalnızca kullanılan parçalar)
```

Three.js yalnızca 3D modül açıldığında yüklenir. Bir dosya değiştiğinde `sw.js` içindeki `VERSION`'ı arttırın.

```
index.html  css/  icons/  vendor/three.min.js  sw.js  manifest.webmanifest
js/app.js         hash yönlendirme (#/zar, #/yazi-tura …)
js/rng.js         kripto RNG motoru + mühür/doğrulama
js/store.js       localStorage
js/ui.js          sonuç kartı, konfeti, ses, titreşim
js/three/stage.js 3D sahne (lazy-load)
js/pages/*.js     sayfalar
```

## Yol haritası

- Eleme modu ve ağırlık (Custom Liste), liste link paylaşımı, İngilizce

## Lisans

MIT
