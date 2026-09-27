# Nexus Shield — Kurumsal Sunum ve Mimari Vizyon

**Resmi site:** [https://www.nexusshield.ai/](https://www.nexusshield.ai/)  
**Canlı panel:** [https://nexus-shield-dashboard.vercel.app](https://nexus-shield-dashboard.vercel.app)  
**Belge sınıfı:** CISO / CTO / üst yönetim brifingi · mimari genel bakış  
**PDF üretimi:** `python scripts/generate_enterprise_deck.py --lang tr`

---

## 1. Yönetici Özeti ve Temel Konumlandırma

### Resmi ad

**Nexus Shield — Yapay Zeka Ajanı Eylem Yönetişimi ve Doğrulama Platformu**

### Temel motto

> **Ajanlarınızın ne yapmasına izin verildiğini bilin. Yapmamaları gerekenleri durdurun. Ne olduğunu kanıtlayın.**

### Altyapı taahhüdü

**Sizin yapay zeka ajanlarınız. Sizin altyapınız. Sizin veriniz. Sizin politikalarınız.**

### Konumlandırma dönüşümü

| Eski çerçeve (kullanımdan kalkmış) | Nexus Shield çerçevesi |
|---|---|
| Genel “yapay zeka güvenliği” | Araç yürütme sınırında **ajan eylem yönetişimi** |
| Yalnızca istem (prompt) güvenlik duvarı | Her araç çağrısında **niyet doğrulama + politika kararı** |
| Log saklama | SHA-256 `evidence_hash` ile **Evrensel Eylem Makbuzu (UAR)** |
| Opak engelleme oranları | **Şeffaf Proof Center** — kıyaslama hattı vs üretim UAR defteri |

Üst akış LLM denetimi, KVKK/GDPR kapsamında PII maskeleme ve yönlendirici korkulukları **destekleyici Güvenlik Motorları** olarak kalır. **Birincil ürün nesnesi UAR**’dır — ne denendiği, politikanın ne karar verdiği ve durumun nasıl değiştiğinin kriptografik olarak mühürlü kaydı.

### Yönetici sonuçları

- **Yönet:** Otonom ajanların CRM, veritabanı, ödeme API’leri ve MCP araç yüzeylerinde neleri çalıştırabileceğini tanımlayın.
- **Durdur:** `BLOCK`, uyarlamalı `READ_ONLY`, `REQUIRE_APPROVAL` veya filo **kill switch** uygulayın — yalnızca sohbet loglarından tahmin etmeyin.
- **Kanıtla:** SIEM uyumlu kanıt dışa aktarın, `/verify` üzerinde makbuz doğrulayın; ekran görüntüsü değil, tekrarlanabilir hash ile denetim taleplerini karşılayın.

---

## 2. Evrim ve Gelişim Yolculuğu

### Faz 1 — LLM korkulukları (temel)

Erken çalışmalar **prompt injection**, **PII sızıntısı** ve **temel LLM vekil** desenlerine odaklandı. Sohbet katmanı riski için değerli; ancak ajanlar **araç yürütme** ve **kalıcı kimlik bilgileri** kazandığında yetersiz kaldı.

### Faz 2 — Kurumsal sorun keşfi (ajanik sınır)

Müşteri ve red-team geri bildirimleri farklı bir risk sınıfında birleşti:

- **Araç kötüye kullanımı** ve MCP sunucu ele geçirme (LangChain, CrewAI, özel ajanlar).
- Zincirlenmiş araç çağrılarıyla **yetki yükseltme**.
- **Niyet / eylem sapması** — bildirilen iş hedefi vs yıkıcı veya sızdırma aracı.
- **Operasyonel ikilem:** tüm ajanı kapatmak vs **READ_ONLY düşürme** vs **insan-onaylı döngü**.

Nexus Shield “istemleri filtrele”den **eylemleri yönet**e döndü.

### Faz 3 — Harness vs runtime ayrışması

Açık kaynak **`nexus-harness-benchmark`** (`harness/`) **üretim Action Firewall**’dan açıkça ayrıldı:

- Harness = tekrarlanabilir **skorlar**, CVE tarzı **preset**’ler, MCP-SEC-SCORE lider tabloları.
- Runtime = canlı **yakalama**, kiracı **RBAC**, yerel **UAR defteri**.

Bkz. [BENCHMARK_VS_ACTION_FIREWALL.md](./BENCHMARK_VS_ACTION_FIREWALL.md).

### Faz 4 — Kurumsal olgunluk (kriptografi ve düzlemler)

| Kilometre taşı | Yetenek |
|---|---|
| **`cc20ed6044`** | Veri düzlemi paketleme (Docker / Helm), UAR kanıt zinciri, SIEM uyum JSONL, dağıtım dokümantasyonu |
| **`0d16526309`** | **Yapay Zeka Ajanı Eylem Yönetişimi ve Doğrulama** konumlandırması; [UAR_SCHEMA.md](./UAR_SCHEMA.md) |
| **`4b46946548` / `ef22090ffa`** | Proof Center metin şeffaflığı — kanıt paketleri **değerlendirilen yörünge** adımlarına göre, yalnızca “engellenen eylemler” değil |

Bugün: **veri düzlemi (`nexus`)** varsayılan olarak hava boşluklu çalışır; **kontrol düzlemi (`nexus-control`)** lisans ve imza senkronu için isteğe bağlıdır.

---

## 3. Kurumsal Problem ve Hedef Pazar

### Hedef pazar

| Segment | Nexus Shield gerekçesi |
|---|---|
| **Finans** | Havale, toplu dışa aktarma araçları, SOX / PCI denetim izleri |
| **Sağlık** | Ajan araçları üzerinden PHI erişimi, asgari gerekli ilke |
| **Kurumsal SaaS** | Müşteri CRM / faturalama API’lerine dokunan çok kiracılı ajanlar |
| **Otonom DevOps** | Üretim veritabanı veya bulut kontrol düzlemi araçlarına erişen CI ajanları |

### Çözülen problemler

1. **Yetkisiz araç yürütme** — politika dışı yaz/sil/dışa aktar araçları.
2. **Niyet sapması** — planlayıcı veya enjekte bağlam, bildirilen iş niyetinden ayrılır.
3. **Denetim izi eksikliği** — niyet, araç, karar ve durum arasında kriptografik bağ yok.
4. **İkili olay müdahalesi** — “ajanı kapat” yerine kademeli uygulama (`READ_ONLY`, onay kuyrukları, kapsamlı iptal).
5. **Uyumluluk kanıtı açığı** — SOC 2 / ISO 27001 / KVKK-GDPR talepleri **dışa aktarılabilir, doğrulanabilir** artefaktlar ister.

---

## 4. Depo Ekosistemi (Açık Kaynak ve Kurumsal Yığın)

| Kod adı | Yol / paket | Rol |
|---|---|---|
| **`nexus`** | `enterprise/data_plane_api.py`, politika motoru, `uar_store.py` | **Veri düzlemi** — yönetişim, UAR mühürleme, yerel defter, `POST /v1/intercept` |
| **`nexus-control`** | `enterprise/cloud_panel.py`, `tenant_manager.py` | **Kontrol düzlemi** (isteğe bağlı) — orkestrasyon, RBAC, SIEM, `NEXUS_CLOUD_CONNECT=true` iken lisans |
| **`nexus-agent-sdk-python`** | `packages/python` (`pip install nexus-shield`) | Python SDK — eylem değerlendirme, yetenek haritalama, yakalama |
| **`nexus-agent-sdk-bridge`** | `packages/npm` | Node / Vercel AI SDK köprüsü — MCP ve HTTP vekil desenleri |
| **`nexus-harness-benchmark`** | `harness/` | **Yalnızca değerlendirme** — 500+ MCP saldırı senaryosu, çok ajanlı grafikler |

Destekleyici yüzeyler:

- **`nexus-shield-dashboard/`** — Proof Center arayüzü, Trust Hub, `/demo`, `/verify`, `/scan`.
- **`presets/`** — Deterministik CVE tarzı zafiyet gösterimleri.
- **`deployments/`** — Şirket içi / hava boşluklu Docker Compose ve Helm.

---

## 5. Site Modülleri ve Etkileşimli Hunisi

Paneldeki genel ve kimlik doğrulamalı modüller (`nexus-shield-dashboard/lib/dashboard-nav.ts`):

| Modül | Rota | Amaç |
|---|---|---|
| **Kurulum Rehberi** | `/dashboard` | Onboarding, entegrasyon kontrol listesi |
| **Ücretsiz Tarama** | `/scan` | **Saldır → Kanıtla → Kur → Koru** — ajan uç noktaları, MCP yapılandırmaları, aşırı yetki için GitHub yamaları |
| **Ajanlar** | `/dashboard/agents` | Filo görünürlüğü, yetenek haritaları |
| **Action Firewall** | `/dashboard/actions` | Canlı politika, yakalama geçmişi |
| **Tehdit İstihbaratı** | `/dashboard/threat-intel` | Toplu saldırı kalıpları, bağışıklık hafızası |
| **Red Team** | `/dashboard/simulator` | Sentetik saldırı vektörleri, simülatör |
| **Proof Center** | `/proof-center` | Açık harness metrikleri + metodoloji |
| **Trust Hub** | `/dashboard/trust-hub` | Yönetişim denetim izi, makbuz doğrulama |
| **Uyumluluk** | `/dashboard/compliance` | SOC 2 / ISO raporlama, KVKK/GDPR kanıt dışa aktarımı |
| **Challenge Engine** | `/challenge` (API: `/api/challenge/evaluate`) | **7 seviyeli** saldırı koruması ve topluluk lider tablosu |
| **Tespit ve Göster** | `/demo` | CVE preset’leri, bağımsız `/verify` URL’leri |
| **Yatırımcı metrikleri** | `/investor` | Büyüme ve kıyaslama şeffaflığı |

### Temel runtime API’leri

| Uç nokta | Düzlem | Açıklama |
|---|---|---|
| `POST /api/v1/action/evaluate` | Panel / yönetilen API | Gerçek zamanlı araç değerlendirme → UAR zarfı |
| `POST /v1/intercept` | Self-hosted veri düzlemi (`:8090`) | Müşteri altyapısında aynı yönetişim semantiği |
| `POST /api/v1/agent/trust` | Panel | Yönetilen olay sonrası itibar / MCP-SEC-SCORE |
| `GET /verify` | Genel | Makbuz hash varlık kontrolü (`receipt_hash`, `receipt_id`) |

---

## 6. Dağıtım Mimarisi — Self-Hosted, Hava Boşluklu ve Özel Bulut

### Veri düzlemi vs kontrol düzlemi

```
┌──────────── İsteğe bağlı nexus-control (Nexus Cloud) ────────────┐
│  Lisans · tehdit imzaları · isteğe bağlı telemetri              │
└─────────────────────────┬─────────────────────────────────────────┘
                          │ NEXUS_CLOUD_CONNECT=false (varsayılan)
┌─────────────────────────▼─────────────────────────────────────────┐
│  VERİ DÜZLEMİ (nexus) — müşteri VPC / şirket içi / hava boşluğu   │
│  Politikalar · UAR defteri · SIEM JSONL · kiracı RBAC           │
│  Ajan istemleri ve araç yükleri sınır içinde kalır                │
└───────────────────────────────────────────────────────────────────┘
```

### Hava boşluklu / şirket içi

`deployments/` dizininden:

```bash
cd deployments
NEXUS_AIRGAP=true NEXUS_CLOUD_CONNECT=false docker compose up -d
curl http://localhost:8090/healthz
```

Helm (AWS EKS, Azure AKS, GCP GKE veya özel veri merkezleri):

```bash
helm upgrade --install nexus-shield ./k8s/nexus-shield \
  --set global.airgap=true \
  --set nexusCloud.connect=false
```

| Değişken | Varsayılan | Anlam |
|---|---|---|
| `NEXUS_AIRGAP` | `true` | İsteğe bağlı bulut çıkışını kapat |
| `NEXUS_CLOUD_CONNECT` | `false` | Kontrol düzlemi kapalı — tamamen yerel yönetişim |
| `NEXUS_DATA_PLANE_BOOTSTRAP` | `true` | İlk yakalama için yerel demo kiracısı |

Kanıt birimleri: `nexus-enterprise-data`, `nexus-enterprise-logs`.

### Özel API adresleri ve ağ geçidi entegrasyonu

Kurumlar ajanları **kendi** taban URL’lerine yönlendirir:

- Dahili API ağ geçidi → `https://nexus.internal.sirket.com/v1/intercept`
- Ajan pod’larıyla yan konteyner (Kubernetes)
- MCP vekili: araç sunucularının önünde bridge SDK

Veri düzlemi self-hosted iken `api.nexusshield.ai` zorunlu değildir. LLM yönlendirici + araç yolu için [GATEWAY_INTEGRATION.md](./GATEWAY_INTEGRATION.md).

---

## 7. Evrensel Eylem Makbuzu (UAR) ve Proof Center Şeffaflığı

### Üretim UAR alanları

| Alan | Açıklama |
|---|---|
| `receipt_id` | Kararlı makbuz kimliği (`uar_…`) |
| `agent_id` | Yönetilen ajan |
| `intent` | Bildirilen kullanıcı / iş niyeti (API’de `user_intent`) |
| `proposed_action` | İstenen araç + parametreler |
| `intent_divergence` | `risk_score`, `violations`, sapma metrikleri (ör. %96 uyumsuzluk) |
| `decision` | `ALLOW` · `BLOCK` · `READ_ONLY` · `REQUIRE_APPROVAL` |
| `execution_state` | `before_hash`, `after_hash`, `execution_status` |
| `evidence_hash` | SHA-256 mühür (`evidence_bundle_hash`) |

Yönetilen **her eylem denemesi** UAR alır — yalnızca engellemeler değil.

### Proof Center — iki hat (karıştırmayın)

| Hat | Temsil metrikleri | Anlam |
|---|---|---|
| **Tekrarlanabilir kıyaslama sonuçları** | **127** ajan · **48.291** araç çağrısı / harness kanıt paketi | Açık harness **değerlendirilen yörünge adımları** (tüm karar türleri) |
| **Tehlikeli eylem kıyas alt kümesi** | **3.817 / 3.842** tehlikeli eylem engellendi (**%99,3**) | Saldırı senaryosu **engelleme oranı** — toplam kanıt sayısına eşit değil |
| **Deterministik UAR defteri** | Kiracı başına `uar_receipts.jsonl` | **Sizin** üretim denemeleriniz, kararlarınız, mühürleriniz |

Genel arayüz metni: *“Değerlendirilen her ajan yörüngesi ve yönetilen eylem denemesi, değiştirilemez bir SHA-256 kanıt paketi üretir.”*

---

## 8. Uçtan Uca Demo Senaryoları ve İş Akışları

### İş akışı A — Canlı yakalama (yönetici demosu)

1. **Niyet yakalama** — Operatör niyet bildirir (ör. “Salt okunur fatura özeti”).
2. **Araç çağrısı** — Ajan `export_customer_database` veya MCP eşdeğerini ister.
3. **Yakalama** — `POST /api/v1/action/evaluate` veya self-hosted `POST /v1/intercept`.
4. **Niyet sapması** — Politika motoru risk hesaplar (ör. **%96** sapma, `INTENT_ACTION_DIVERGENCE`).
5. **Politika uygulama** — `BLOCK` veya filo kapatma yerine `READ_ONLY` / `REQUIRE_APPROVAL`.
6. **UAR üretimi** — SHA-256 `evidence_hash`, saklanan makbuz, isteğe bağlı SIEM.
7. **Doğrulama** — `/verify?receipt_hash=…&receipt_id=…` veya `GET /v1/receipts/{id}/verify`.
8. **Güven güncelleme** — `POST /api/v1/agent/trust` itibar / MCP-SEC-SCORE günceller.

### İş akışı B — CVE preset (Tespit ve Göster)

```bash
python scripts/simulate_vulnerability_preset.py --preset cve-2026-critical-zero-day --write-public-json
```

`/demo` ve genel doğrulama linkleri için deterministik kanıt JSON — sorumlu açıklama provası için ideal.

### İş akışı C — Satın alma için hava boşluğu kanıtı

1. Müşteri lab’ında `deployments/docker-compose.yml` dağıtın.
2. `localhost:8090` üzerinde intercept curl çalıştırın.
3. Dış bulut olmadan yerel JSONL defter + uyumluluk denetim logunu gösterin.
4. Yalnızca lisans eşleme için isteğe bağlı `NEXUS_CLOUD_CONNECT=true` ile karşılaştırın.

---

## Ek — Temel dokümantasyon haritası

| Belge | Konu |
|---|---|
| [UAR_SCHEMA.md](./UAR_SCHEMA.md) | Kanonik makbuz alanları |
| [DATA_PLANE_AND_CONTROL_PLANE.md](./DATA_PLANE_AND_CONTROL_PLANE.md) | Hava boşluklu mimari |
| [BENCHMARK_VS_ACTION_FIREWALL.md](./BENCHMARK_VS_ACTION_FIREWALL.md) | Harness vs runtime |
| [GATEWAY_INTEGRATION.md](./GATEWAY_INTEGRATION.md) | Kurumsal ağ geçidi yerleşimi |
| [COMPLIANCE_READINESS.md](./COMPLIANCE_READINESS.md) | SOC 2 / ISO hizalama |
| [DETECT_AND_DEMONSTRATE_PROOF.md](./DETECT_AND_DEMONSTRATE_PROOF.md) | Demo + doğrulama hattı |

**İletişim:** [Demo randevusu](https://cal.com/baturhantasdelen/nexus-shield-demo) · [nexusshield.ai](https://www.nexusshield.ai/)
