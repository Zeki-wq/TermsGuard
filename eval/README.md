# TermsGuard — Gerçek Hukuki Belge Değerlendirme Paketi (Evaluation Suite)

Bu dizin, TermsGuard'ın gerçek dünyada kullanılan 5 farklı yasal sözleşme (Kullanım Koşulları, Gizlilik ve Abonelik Sözleşmeleri) üzerindeki performansını, alıntı doğruluğunu ve prompt-injection direncini deterministik ve tekrarlanabilir bir şekilde test etmek için tasarlanmıştır.

## 1. Dahil Edilen Belgeler ve Kaynakları

| No | Servis | Belge Türü | Resmi Kaynak URL | Erişim Tarihi |
| :---: | :--- | :--- | :--- | :---: |
| 1 | **Discord** | Terms of Service | [discord.com/terms](https://discord.com/terms) | 2026-03-01 |
| 2 | **OpenAI** | Terms of Use | [openai.com/policies/terms-of-use/](https://openai.com/policies/terms-of-use/) | 2026-02-15 |
| 3 | **Spotify** | Subscription & End User Agreement | [spotify.com/legal/end-user-agreement/](https://www.spotify.com/us/legal/end-user-agreement/) | 2026-01-20 |
| 4 | **GitHub** | Terms of Service | [docs.github.com/.../github-terms-of-service](https://docs.github.com/en/site-policy/github-terms/github-terms-of-service) | 2026-02-10 |
| 5 | **X (Twitter)**| Terms of Service | [x.com/en/tos](https://x.com/en/tos) | 2026-01-15 |

Telif haklarına saygı gereği belgelerin tümü yerine analize konu olan kritik bölümleri (tahkim, tek taraflı değişiklik, sorumluluk sınırlandırması, toplu dava feragati, telif devri) fixture olarak kaydedilmiştir.

## 2. Dizin Yapısı

- `fixtures/`: Orijinal belgelerden derlenmiş doğrulanabilir metin alıntıları (`.json`).
- `gold/`: Hukukçu bakış açısıyla gözden geçirilmiş altın standart etiketlemeleri (kategori, risk seviyesi, harfi harfine alıntı, gerekçe).
- `run-eval.ts`: Değerlendirme motoru. Tahminleri altın standartlarla eşleştirir; Precision, Recall, F1 ve Alıntı Doğruluk oranlarını hesaplar.
- `results.json`: Yapılandırılmış değerlendirme sonuçları.
- `REPORT.md`: Otomatik oluşturulan detaylı analiz raporu.

## 3. Eşleştirme Politikası (Matching Policy)

Bir model bulgusu aşağıdaki şartları sağladığında altın standart ile eşleşmiş (True Positive) kabul edilir:
1. **Kategori Eşleşmesi:** Bulgunun risk kategorisi altın standarttaki kategoriyle veya doğrudan ilişkili üst kategoriyle örtüşmelidir.
2. **Metin Örtüşmesi:** Modelin sunduğu `originalQuote` ile altın standarttaki `exactQuote` arasında karakter düzeyinde doğrudan alt dize (substring) veya %50'den yüksek kelime kesişimi bulunmalıdır.

## 4. Değerlendirmeyi Çalıştırma

Tüm değerlendirme paketini tek bir komutla çalıştırabilirsiniz:

```bash
npm run eval
```

Canlı bir OpenAI uyumlu sağlayıcı ile çalıştırmak isterseniz ortam değişkenlerini tanımlayabilirsiniz:

```bash
$env:OPENAI_API_KEY="sk-..."
$env:OPENAI_BASE_URL="https://api.openai.com/v1"
$env:OPENAI_MODEL="gpt-4o-mini"
npm run eval
```
