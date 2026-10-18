// Modül kaydı: ana sayfa kartları, renkler ve geçmiş etiketleri buradan beslenir.
// Sıra ana sayfadaki sıradır.

export const MODULES = [
  { route: 'yazi-tura', title: 'Yazı-Tura', icon: 'coin', color: 'var(--amber)', desc: "3D para. Çoklu para, 3'te 2 ve 5'te 3 seri, özel yüz etiketleri." },
  { route: 'zar', title: 'Zar', icon: 'dice', color: 'var(--cyan)', desc: "d4'ten d20'ye 3D zarlar. Zar tut, kalanları at; tavla modu." },
  { route: 'kisa-cubuk', title: 'Kısa Çubuk', icon: 'sticks', color: 'var(--pink)', desc: 'Kötü iş kime? Elden ele modunda sonuç sona kadar gizli.' },
  { route: 'liste', title: 'Custom Liste', icon: 'wheel', color: 'var(--green)', desc: 'Çark çevir, N sonuç seç ya da tüm listeyi karıştır.' },
  { route: 'sise-cevirme', title: 'Şişe Çevirme', icon: 'bottle', color: 'var(--purple)', desc: '3D şişe masada döner, kimi gösterirse sıra onda.' },
  { route: 'tombala', title: 'Tombala', icon: 'bingo', color: 'var(--red)', desc: '1–90 torba, sesli okuma, otomatik çekiliş ve yazdırılabilir kartlar.' },
  { route: 'parmak-secici', title: 'Parmak Seçici', icon: 'finger', color: 'var(--orange)', desc: 'Herkes parmağını ekrana koysun; biri seçilsin ya da takımlara bölünsün.' },
  { route: 'takim-kurucu', title: 'Takım Kurucu', icon: 'team', color: 'var(--sky)', desc: 'Halı saha için adil takımlar. İstersen seviye ver, dengeli dağıtsın.' },
  { route: 'isim-sehir', title: 'İsim-Şehir', icon: 'letter', color: 'var(--lime)', desc: 'Türk alfabesinden harf çek, zor harfleri çıkar, süreyi başlat.' },
  { route: 'hediyelesme', title: 'Hediyeleşme', icon: 'gift', color: 'var(--indigo)', desc: 'Yılbaşı kurası: elden ele ya da kişiye özel linkle gizli eşleşme.' },
  { route: 'tas-kagit-makas', title: 'Taş-Kağıt-Makas', icon: 'rps', color: 'var(--fuchsia)', desc: 'Uygulamaya karşı ya da iki kişi aynı ekranda. Uygulama hamlesini önceden mühürler.' },
  { route: 'sihirli-kure', title: 'Sihirli Küre', icon: 'orb', color: 'var(--teal)', desc: 'Sorunu sor, küreyi salla. Klasik 20 cevap ya da Evet/Hayır/Belki.' },
  { route: 'rastgele-sayi', title: 'Rastgele Sayı', icon: 'hash', color: 'var(--mint)', desc: 'Aralık seç, kaç sayı istediğini yaz. Tekrarsız, sıralı, loto kalıpları.' },
  { route: 'kazi-kazan', title: 'Kazı Kazan', icon: 'ticket', color: 'var(--gold)', desc: 'Ödülleri yaz, kartları oluştur; herkes kendi telefonunda kazısın.' },
  { route: 'iskambil', title: 'İskambil Kartı', icon: 'cards', color: 'var(--azure)', desc: 'Karıştırılmış desteden kart çek ya da herkes çeksin, yüksek kart kazansın.' },
  { route: 'nobet-sirasi', title: 'Nöbet Sırası', icon: 'calendar', color: 'var(--coral)', desc: 'Nöbet, temizlik, çay sırası: herkese eşit gün, tarihlere dağıtılmış.' },
  { route: 'oturma-plani', title: 'Oturma Planı', icon: 'seats', color: 'var(--violet)', desc: 'Sınıf sıraları ya da masalar; yan yana oturmasın dediklerini ayırır.' },
  { route: 'sayismaca', title: 'Sayışmaca', icon: 'chant', color: 'var(--candy)', desc: 'Portakalı soydum, o piti piti… Tekerleme hece hece sayar, ebe çıkar.' },
];

export const SOON = [];

export const COLORS = Object.fromEntries(MODULES.map((m) => [m.route, m.color]));
COLORS['evet-hayir'] = 'var(--purple)';

export const NAMES = Object.fromEntries(MODULES.map((m) => [m.route, m.title]));
NAMES['evet-hayir'] = 'Evet/Hayır';
