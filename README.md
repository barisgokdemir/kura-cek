# Kura Çek

Ücretsiz, reklamsız, kayıtsız, Türkçe ve **adil olduğunu kanıtlayan** rastgelelik uygulaması. Gerçek 3D animasyonlar, sunucu yok.

**Canlı:** https://barisgokdemir.github.io/kura-cek/

## Modüller (MVP)

| Modül | Özellikler |
| --- | --- |
| 🪙 Yazı-Tura | 3D para; dokun, yukarı kaydır veya salla (Android). 1–10 para, 3'te 2 / 5'te 3 seri, özel yüz etiketleri, oturum istatistiği |
| 🎲 Zar | 1–6 zar; d4, d6, d8, d10, d12, d20. Toplam, zar tutup kalanları yeniden atma, tavla modu (Şeşbeş, Düşeş…) |
| 🥢 Kısa Çubuk | İsim ya da kişi sayısı, N kısa çubuk, "hepsini birden" ve "elden ele" (sonuç sona kadar gizli) modları |
| 📝 Custom Liste | Çark (tek sonuç), N sonuç (tekrarsız), tümünü sırala; favoriler ve şablonlar (Ne yesek?, Kim hesabı öder? …) |

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

- **v2:** eleme modu, ağırlık, link paylaşımı (LZ-string), parmak seçici, takım kurucu, İsim-Şehir harfi
- **v3:** hediyeleşme kurası, tombala, sayışmaca tekerlemesi, slot/torba görünümleri, İngilizce

## Lisans

MIT
