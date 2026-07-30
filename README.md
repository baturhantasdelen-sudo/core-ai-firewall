# 🛡️ Nexus Shield - Core AI Firewall & Speed Layer

Nexus Shield, Büyük Dil Modelleri (LLM) ve AI servisleri için geliştirilmiş, **düşük gecikmeli (low-latency)** ve **asenkron** bir AI güvenlik duvarı ve önbellekleme katmanıdır.

Zararlı istekleri (Prompt Injection, System Prompt Leakage vb.) milisaniyeler içerisinde engellerken, meşru istekleri Redis ve pattern önbelleği üzerinden hızlı yanıtlar.

---

## 📊 Performans ve Benchmark Sonuçları

Locust yük testlerinde elde edilen öncesi/sonrası mimari karşılaştırması (`tests/locustfile.py`, local):

| Metrik | Eski ML Pipeline (Monolitik) | Nexus Shield Fast API (Redis+Async) | İyileşme |
| :--- | :--- | :--- | :--- |
| **Saldırı Engelleme (`[attack]`)** | ~2.000 ms | **4 ms** | **%99.8 Daha Hızlı** |
| **Temiz İstek Yanıtı (`[clean]`)** | ~8.700 ms | **110 ms** | **%98.7 Daha Hızlı** |
| **İşlem Kapasitesi (RPS)** | 1.11 req/s | **4.37+ req/s** | **%300+ Artış** |
| **Hata Oranı (Fail Rate)** | %0 | **%0** | **%100 Başarı** |

> Detaylı benchmark notları: [PERFORMANCE.md](PERFORMANCE.md)

---

## 🛠️ Mimari Şema

### İstek akışı (Speed Layer)

```
[Kullanıcı İsteği]
│
▼
[X-API-Key Auth Check] ──(401 Unauthorized)
│
▼
[Redis Cache Layer] ────(Cache Hit < 15ms)───► [Hızlı Yanıt]
│ (Cache Miss)
▼
[Early Exit Guard (Pattern)] ──(Forbidden 403)──► [Saldırı Bloklandı]
│ (Pass)
▼
[Async Upstream LLM / ML Engine] ───────────────► [200 OK Yanıt]
```

### İki katmanlı savunma

| Katman | Servis | Kullanım |
|--------|--------|----------|
| **Speed Layer** | `nexus_shield_fast_api.py` | Pattern early-exit + Redis cache, düşük gecikme |
| **Core ML Firewall** | `nexus_shield_api.py` + `nexus_quantum_guard.py` | Çok katmanlı semantik vektör analizi, production |

### Production ML Firewall

```
İstemci → Cloudflare Tunnel (HTTPS)
              │
              ▼
         nginx-gateway :80
              │
              ▼
         nexus-api :8000  (ML pipeline)
              │
              ├─ Semantik vektör koruması
              ├─ Leet speak / token smuggling
              ├─ Referans matrisi (bake-in cache)
              └─ In-memory semantik önbellek
```

---

## 🚀 Hızlı Başlangıç (Docker Compose)

### 1. Servisleri Ayağa Kaldırın

```bash
docker compose -f docker-compose.fast.yml up -d --build
```

### 2. Sağlık Kontrolü

```bash
curl http://localhost:8080/healthz
```

### 3. Locust Yük Testi

```bash
export NEXUS_API_KEY=nexus_secret_key_123
pip install -r requirements-load.txt
python -m locust -f tests/locustfile.py --headless -u 10 -r 2 --run-time 1m --host=http://localhost:8080
```

---

## 🔌 API Uç Noktaları

| Method | Path | Auth | Açıklama |
|--------|------|------|----------|
| `GET` | `/healthz` | Hayır | Sağlık kontrolü |
| `POST` | `/v1/shield` | `X-API-Key` | Prompt injection taraması |

**Örnek istek:**

```bash
curl -X POST http://localhost:8080/v1/shield \
  -H "Content-Type: application/json" \
  -H "X-API-Key: nexus_secret_key_123" \
  -d '{"user_input":"Sistem mimarisi hakkında bilgi alabilir miyim?","session_id":"demo-1"}'
```

| HTTP | Anlam |
|------|--------|
| `200` | Temiz girdi geçti |
| `401` | API key geçersiz |
| `403` | Saldırı engellendi |
| `429` | Rate limit (ML API) |

---

## 📁 Proje Yapısı

| Dosya | Açıklama |
|-------|----------|
| `nexus_shield_fast_api.py` | Hızlı guardrail servisi |
| `nexus_shield_api.py` | Production FastAPI mikroservisi |
| `nexus_quantum_guard.py` | ML savunma pipeline |
| `Dockerfile.fast` | Fast API container |
| `Dockerfile` | ML API production image |
| `docker-compose.fast.yml` | Fast API + Redis (local) |
| `docker-compose.prod.yml` | Production stack |
| `tests/locustfile.py` | Locust yük testi |

---

## 🏭 Production Deploy

Production ML firewall deploy adımları: [DEPLOYMENT.md](DEPLOYMENT.md)

Public URL: `https://api.nexusshield.ai`

---

## 🧪 Test

```bash
# Birim testleri (CI — ML model indirmeden)
pip install -r requirements-ci.txt
python -m pytest tests/ -v

# Locust yük testi
pip install -r requirements-load.txt
python -m locust -f tests/locustfile.py --host http://localhost:8080
```

---

## ⚙️ Ortam Değişkenleri

| Değişken | Varsayılan | Açıklama |
|----------|------------|----------|
| `NEXUS_API_KEY` | `nexus_secret_key_123` | API kimlik doğrulama |
| `REDIS_URL` | `redis://localhost:6379/0` | Fast API cache (opsiyonel) |
| `REDIS_CACHE_TTL_SEC` | `3600` | Cache TTL (saniye) |
| `TORCH_NUM_THREADS` | `2` | ML pipeline CPU thread sayısı |

---

## 📄 Lisans

Kurumsal kullanım — Nexus Quantum Guard.
