# Cal.com — Nexus Shield Demo Booking Kurulumu

Cal.com bir **toplantı rezervasyon** aracıdır; GitHub dokümanlarını barındırmaz. Tüm teknik dokümantasyon bu repoda kalır (`README.md`, `ENTERPRISE.md`, `DEPLOYMENT.md`).

**Hedef booking linki (dokümanlarda kullanılan):**

```
https://cal.com/baturhantasdelen/nexus-shield-demo
```

Bu linkin çalışması için aşağıdaki adımları **sizin** tamamlamanız gerekir (~5 dakika).

---

## Adım 1 — Hesap oluştur

1. [https://cal.com/signup](https://cal.com/signup) adresine gidin.
2. **Continue with Google** → `baturhantasdelen@gmail.com` ile giriş yapın.
3. **Username:** `baturhantasdelen` (dokümanlardaki URL ile aynı olmalı).
4. Ücretsiz plan yeterli — kredi kartı gerekmez.

---

## Adım 2 — Event type oluştur

1. Dashboard → **Event Types** → **+ New**
2. Aşağıdaki değerleri girin:

| Alan | Değer |
|------|--------|
| **Title** | Nexus Shield — 15-min Technical Architecture Demo |
| **URL slug** | `nexus-shield-demo` |
| **Duration** | 15 minutes |
| **Description** | Ultra-low latency AI firewall demo. Locust benchmarks, Early-Exit pattern engine, Redis cache, on-prem vs SaaS deployment options. |

3. **Location:** Google Meet veya Zoom (tercihinize göre).
4. **Availability:** Hafta içi mesai saatlerinizi ayarlayın (örn. 10:00–18:00 TR).
5. **Save**.

Doğrulama: Tarayıcıda açın → `https://cal.com/baturhantasdelen/nexus-shield-demo`

---

## Adım 3 — README’ye embed (opsiyonel)

GitHub profilinize veya web sitenize ekleyebileceğiniz buton:

```markdown
[![Book a Demo](https://img.shields.io/badge/Book%20a%20Demo-Cal.com-blue)](https://cal.com/baturhantasdelen/nexus-shield-demo)
```

---

## Adım 4 — Toplantı öncesi hazırlık

Demo sırasında göstermek için:

- Locust benchmark ekran görüntüsü
- `curl` ile 403 attack block demo
- Mimari diyagram (`README.md`)
- Müşteri sektörüne göre custom pattern örneği

---

## Sorun giderme

| Sorun | Çözüm |
|-------|--------|
| Username alınamıyor | Kısa isimler premium olabilir; `baturhantasdelen` veya `baturhan-t` deneyin, dokümanlardaki URL’yi buna göre güncelleyin |
| Link 404 | Event slug’ın `nexus-shield-demo` olduğundan emin olun |
| Farklı slug kullandım | `README.md` ve `ENTERPRISE.md` içindeki Cal.com URL’lerini güncelleyin |

**İletişim:** [baturhantasdelen@gmail.com](mailto:baturhantasdelen@gmail.com)
