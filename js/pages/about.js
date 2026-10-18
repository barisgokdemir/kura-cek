import { h, pageHeader } from '../ui.js';

export function mount(root) {
  root.append(
    pageHeader('Hakkında', 'Kura Çek nasıl adil kalır?'),
    h(
      'article',
      { class: 'prose', html: `
<h2>Hileli mod yok</h2>
<p>Bazı uygulamalar sonucu önceden ayarlayıp rastgeleymiş gibi gösteren gizli modlar sunar. <b>Kura Çek bunu yapmaz ve yapmayacak.</b> Kod açık kaynak; kendin inceleyebilirsin.</p>

<h2>Rastgelelik nereden geliyor?</h2>
<ul>
  <li>Her sonuç tarayıcının kriptografik üreteci <code>crypto.getRandomValues()</code> ile üretilir. <code>Math.random()</code> kullanılmaz.</li>
  <li>Sayılar <b>rejection sampling</b> ile seçilir: basit <code>% n</code> işlemi bazı sonuçları çok az da olsa daha olası kılar; bu sapma atılarak giderilir.</li>
  <li>Sıralama ve tekrarsız seçimler <b>Fisher–Yates</b> karıştırması ile yapılır; her sıralama eşit olasılıklıdır.</li>
</ul>

<h2>Önce sonuç, sonra animasyon</h2>
<p>Sonuç animasyon başlamadan önce belirlenir; para, zar ve çark yalnızca o sonuca iner. Animasyondaki fizik süslemedir, sonucu etkilemez.</p>

<h2>Doğrulama kodu ne kanıtlar?</h2>
<p>Her sonuç; modül, girdiler, sonuç, zaman damgası ve rastgele bir nonce ile birlikte kaydedilir. Kod, bu kaydın SHA-256 parmak izinin ilk 48 bitidir. Koda dokunarak parmak izini yeniden hesaplayabilirsin: kayıt sonradan değiştirildiyse kod tutmaz.</p>
<p>Kısa Çubuk'ta çubukların dizilişi çekilişten <b>önce</b> mühürlenir ve kodu baştan gösterilir; çekilişten sonra aynı kodun tuttuğunu görebilirsin.</p>
<p>Dürüst olalım: kod kaydın bütünlüğünü kanıtlar, rastgeleliğin kendisini değil. Rastgeleliğin güvencesi kriptografik üreteç ve açık kaynak koddur.</p>

<h2>Gizlilik</h2>
<p>Hesap yok, sunucu yok, reklam ve izleme yok. Listelerin, ayarların ve geçmişin yalnızca bu cihazda, tarayıcının yerel deposunda durur. İstersen Ayarlar'dan JSON olarak dışa aktarabilirsin.</p>
` },
    ),
  );
}
