# Nexus Shield — Enterprise, Go-to-Market & Operations Guide

Bu doküman; kurumsal satış, yayınlama stratejisi, müşteri iletişim kanalları ve satış sonrası teslimat sürecini kapsar.

---

## 🏢 1. Enterprise & Licensing

Nexus Shield offers self-hosted enterprise deployment models and custom guardrail integrations for financial, healthcare, and high-throughput LLM workloads.

| Channel | Details |
|---------|---------|
| **Email** | [baturhantasdelen@gmail.com](mailto:baturhantasdelen@gmail.com) |
| **Security inquiries** | [security@nexusshield.ai](mailto:security@nexusshield.ai) |
| **Website / Demo** | [nexusshield.ai](https://nexusshield.ai) |
| **Schedule a Call** | [Cal.com — Technical Architecture Demo](https://cal.com/baturhantasdelen/nexus-shield-demo) |

### Deployment models

| Model | Best for | Data residency |
|-------|----------|----------------|
| **Managed Hosted API (SaaS)** | Startups, fast integration | Requests processed on Nexus Shield infrastructure (`api.nexusshield.ai`) |
| **On-Premise / Private Cloud** | Fintech, healthcare, regulated workloads | Prompts never leave customer VPC |

---

## 📢 2. Yayınlama ve Pazarlama Kanalları

Projeyi GitHub'da güncellemek tek başına müşteri getirmez. Aşağıdaki platformlarda şu stratejiyle yayın yapın:

### LinkedIn (B2B karar vericiler)

**Metin örneği:**

> LLM projelerinde güvenlik duvarı eklemek yanıt sürelerini 8 saniyeye çıkarıyordu. Geliştirdiğimiz Nexus Shield ile bunu asenkron mimari ve Redis caching sayesinde 4 ms'ye düşürdük! Test sonuçlarımız ve açık kaynak mimarimiz profilimde.

**Görsel:** Locust test sonuçlarının ekran görüntüsü + README mimari şeması.

### Medium / Dev.to (teknik içerik pazarlaması)

**Başlık önerisi:** *"How We Reduced AI Guardrail Latency from 8.7s to 4ms"*

İçerik: Early-exit regex engine, Redis cache layer, Locust benchmark metodolojisi, open-source repo linki.

### Hacker News (Show HN) & Reddit

**Hedef topluluklar:** r/LocalLLM, r/MachineLearning, r/netsec

Yalnızca teknik veriyi öne çıkaran, satıcı dili içermeyen doğrudan mühendislik paylaşımı yapın. Benchmark tablosu + GitHub linki yeterli.

---

## 📬 3. Müşteri İletişim Kanalları

Potansiyel kurumsal müşterilerin (Fintech, SaaS, müşteri hizmetleri botu işletenler) doğrudan ulaşabilmesi için 3 temel kanal:

### 1. Toplantı takvimi (Cal.com / Calendly)

README ve web sitesine **[Schedule a 15-min Technical Architecture Demo](https://cal.com/baturhantasdelen/nexus-shield-demo)** butonu ekleyin.

Kurulum rehberi: [CALCOM_SETUP.md](CALCOM_SETUP.md)

Önerilen slot süresi: 15 dakika (teknik demo) · 45 dakika (POC / entegrasyon planlama).

### 2. Kurumsal iletişim formu (Typeform / Tally.so)

Formda sorulacak alanlar:

- Günlük / aylık istek hacmi (RPS)
- Kullanılan LLM sağlayıcıları (OpenAI, Anthropic, Llama, vb.)
- Veri gizliliği gereksinimleri (on-prem zorunlu mu?)
- Sektöre özel pattern ihtiyaçları (PII, PCI, HIPAA)

### 3. Özel iletişim e-postası

- Genel: `baturhantasdelen@gmail.com`
- Güvenlik / uyumluluk: `security@nexusshield.ai`

---

## 🤝 4. Müşteri Onayı Sonrası Operasyon Rehberi

Müşteri sistemi test etti, performansını ve güvenlik yeteneğini beğendi ve **"Aboneliğe / satın almaya geçelim"** dedi. İzlenecek adım adım teslimat süreci:

### Adım 1 — Kullanım modelinin belirlenmesi

**A) Managed Hosted API (SaaS)**

- Müşteri kendi sunucularına bir şey kurmak istemez.
- `https://api.nexusshield.ai` adresine `X-API-Key` ile istek atar.
- Rate limit ve aylık kota sizin tarafınızda yönetilir.

**B) On-Premise / Private Cloud (kurumsal — önerilen)**

- Müşteri verisi (prompt'lar) dışarı çıkamaz.
- Siz müşterinin AWS / GCP / Azure hesabına veya kendi sunucusuna kurulum yaparsınız.
- Bkz. [DEPLOYMENT.md](DEPLOYMENT.md)

### Adım 2 — Sözleşme ve API key / lisans üretimi

| Model | Teslim |
|-------|--------|
| **SaaS** | Müşteriye özel `API_KEY` (örn. `nx_live_9f8a...`) + aylık istek limiti |
| **On-Premise** | NDA + Yazılım Lisans Sözleşmesi (SLA) imzası + lisans anahtarı |

### Adım 3 — Teknik entegrasyon ve özel kural katmanı

```
[Müşteri Kullanıcısı] ──► [Müşteri Backend] ──► [Nexus Shield] ──► [OpenAI / Anthropic API]
```

1. **Müşteriye özel pattern tanımlama:** Sektöre özel hassas veriler (TCKN, şirket sırları, kredi kartı desenleri) `PROMPT_INJECTION_PATTERNS` / `quick_security_scan` listesine eklenir (`nexus_shield_fast_api.py` veya ML pipeline).
2. **Environment ayarları:** Müşteri backend'deki LLM endpoint'ini Nexus Shield'a yönlendirir (`NEXUS_API_KEY`, `REDIS_URL`, upstream LLM URL).

**Örnek entegrasyon (curl):**

```bash
curl -X POST https://api.nexusshield.ai/v1/shield \
  -H "X-API-Key: nx_live_<customer_key>" \
  -H "Content-Type: application/json" \
  -d '{"user_input": "...", "session_id": "..."}'
```

### Adım 4 — Canlıya geçiş (Go-Live) ve monitoring

| Faz | Süre | Davranış |
|-----|------|----------|
| **Shadow Mode (pilot)** | İlk 3 gün | İstekler geçer, engelleme yapılmaz, yalnızca log |
| **Active blocking** | Onay sonrası | Early Exit + ML pipeline bloklama aktif |
| **Dashboard teslimatı** | Go-live + 1 hafta | Grafana: engellenen saldırılar, latency, Redis hit rate |

Mevcut stack: `prometheus_container` + `grafana_container` (bkz. `docker-compose` / prod deploy).

### Adım 5 — Faturalandırma ve bakım

| Plan | Fiyatlandırma (örnek) | Dahil |
|------|------------------------|-------|
| **SaaS Starter** | $499/ay — 5M istek | Hosted API, e-posta destek |
| **SaaS Growth** | $1,499/ay — 25M istek | Öncelikli destek, custom patterns (5 adet) |
| **Enterprise On-Prem** | $2,000/ay (yıllık sözleşme) | Kurulum, SLA, güncelleme, sınırsız özel pattern |

---

## 📋 Checklist — Yeni kurumsal müşteri

- [ ] Demo / POC tamamlandı
- [ ] SaaS vs On-Prem model seçildi
- [ ] NDA / SLA imzalandı (on-prem ise)
- [ ] `nx_live_*` API key veya on-prem lisans üretildi
- [ ] Özel regex / ML pattern pack eklendi
- [ ] Shadow mode 3 gün çalıştırıldı
- [ ] False positive oranı müşteri ile onaylandı
- [ ] Grafana dashboard erişimi verildi
- [ ] Faturalandırma döngüsü başlatıldı

---

## 🔗 İlgili dokümanlar

| Doküman | İçerik |
|---------|--------|
| [README.md](README.md) | Genel bakış, benchmark, quick start |
| [DEPLOYMENT.md](DEPLOYMENT.md) | Production deploy (GCP, nginx, Docker) |
| [PERFORMANCE.md](PERFORMANCE.md) | Locust benchmark metodolojisi |
| [CALCOM_SETUP.md](CALCOM_SETUP.md) | Cal.com demo booking kurulumu |

**İletişim:** [baturhantasdelen@gmail.com](mailto:baturhantasdelen@gmail.com)
