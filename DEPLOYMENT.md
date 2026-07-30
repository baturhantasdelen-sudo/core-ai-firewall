# Nexus Quantum Guard — Production Canlıya Geçiş

Bu belge GCP VM üzerinde Docker Compose ile production deploy adımlarını özetler.

## Mimari

```
İstemci → Cloudflare Tunnel (HTTPS) → nginx-gateway:80 → index.html (/) + nexus-shield-api:8080 (/v1/shield)
                                              ↓
                                    nexus-api:8000 (ML pipeline, internal only)
```

- **cloudflared** `network_mode: host` ile çalışır; tunnel origin **http://127.0.0.1:80** olmalı (asla `:8000` değil).

- **nexus-api** konteyneri `nexus_quantum_guard:app` (FastAPI) çalıştırır.
- Model warm-up startup sırasında otomatik yapılır.
- `/healthz` API Key gerektirmez (K8s/load balancer probe).

## 1. Ön koşullar

| Gereksinim | Not |
|------------|-----|
| GCP VM | Örn. `35.246.212.11`, deploy path: `/opt/nexus-core-firewall` |
| Docker + Compose | Sunucuda kurulu |
| GitHub Secrets | Aşağıdaki tablo |
| Disk | En az 10 GB (model image ~2 GB); önerilen 20 GB |

## 2. Ortam değişkenleri

`.env.example` dosyasını kopyalayın:

```bash
cp .env.example .env
```

| Değişken | Zorunlu | Varsayılan | Açıklama |
|----------|---------|------------|----------|
| `DOCKER_IMAGE` | Evet | — | Docker Hub image tag |
| `API_KEY_SECRET` | Evet (prod) | `nexus-dev-test-key` (kod) | `X-API-Key` header değeri |
| `RATE_LIMIT_REQUESTS` | Hayır | `60` | Pencere başına max istek |
| `RATE_LIMIT_WINDOW_SECONDS` | Hayır | `60` | Rate limit penceresi (sn) |
| `CLOUDFLARE_TUNNEL_TOKEN` | Hayır | — | HTTPS tunnel (cloudflared profili) |
| `PROD_PUBLIC_URL` | Hayır | — | Entegrasyon testleri için public URL |

**Güçlü API key üretimi:**

```bash
openssl rand -hex 32
```

## 3. GitHub Secrets

`.secrets.local.json` doldurup senkronize edin:

```powershell
Copy-Item .secrets.local.json.example .secrets.local.json
# API_KEY_SECRET ve diğer alanları doldurun
.\run_setup_github_secrets_auto.ps1
python check_github_secrets.py
```

Kritik secret'lar: `DOCKER_USERNAME`, `DOCKER_PASSWORD`, `PROD_SERVER_IP`, `PROD_SERVER_USER`, `PROD_SSH_PRIVATE_KEY`, **`API_KEY_SECRET`**, `CLOUDFLARE_TUNNEL_TOKEN`, `PROD_PUBLIC_URL`.

## 4. Otomatik deploy (GitHub Actions)

`main` branch'e push → test → Docker build → SSH deploy:

1. `docker-compose.prod.yml` ve `nginx.conf` SCP ile sunucuya kopyalanır.
2. Sunucuda `.env` oluşturulur (`DOCKER_IMAGE`, `API_KEY_SECRET`, rate limit değerleri).
3. `docker compose -f docker-compose.prod.yml pull && up -d`
4. `CLOUDFLARE_TUNNEL_TOKEN` doluysa `--profile cloudflare` ile cloudflared başlar.

## 5. Manuel deploy (sunucuda)

```bash
cd /opt/nexus-core-firewall

cat > .env <<EOF
DOCKER_IMAGE=your-user/nexus-quantum-guard:latest
API_KEY_SECRET=$(openssl rand -hex 32)
RATE_LIMIT_REQUESTS=60
RATE_LIMIT_WINDOW_SECONDS=60
CLOUDFLARE_TUNNEL_TOKEN=your-tunnel-token
EOF

docker compose --env-file .env -f docker-compose.prod.yml pull
docker compose --env-file .env --profile cloudflare -f docker-compose.prod.yml up -d --remove-orphans
```

## 5.1 Stack yenileme ve cloudflared restart

Production sunucusunda (`/opt/nexus-core-firewall`) **genel compose komutları yerine** aşağıdaki formu kullanın. `cloudflared` servisi `profiles: ["cloudflare"]` altında tanımlıdır; bu yüzden `--profile cloudflare` gerekir.

**Sadece Cloudflare tunnel'ı yenile:**

```bash
cd /opt/nexus-core-firewall

docker compose --env-file .env --profile cloudflare -f docker-compose.prod.yml down cloudflared
docker compose --env-file .env --profile cloudflare -f docker-compose.prod.yml up -d cloudflared

docker logs --tail 50 cloudflared-prod
```

**Tüm konteynerları güncel image ile yenile:**

```bash
cd /opt/nexus-core-firewall

docker compose --env-file .env -f docker-compose.prod.yml pull
docker compose --env-file .env --profile cloudflare -f docker-compose.prod.yml up -d --remove-orphans
```

**Yerel geliştirme** (`docker-compose.yml`, profil yok):

```bash
docker compose down cloudflared
docker compose up -d cloudflared

# veya tam yenileme:
docker compose pull && docker compose up -d --remove-orphans
```

> **Not:** `.env` içinde `CLOUDFLARE_TUNNEL_TOKEN` boşsa `cloudflared` başlamaz. Token'ı kontrol edin: `grep CLOUDFLARE_TUNNEL_TOKEN .env`

## 5.2 Manuel cloudflared (yeni token ile `docker run`)

Compose yerine hızlı token değişimi veya geçici tünel için. **Önce eski konteynerları durdurun** (compose adı `cloudflared-prod`, manuel denemeler `cloudflared` / `cloudflared-quick` olabilir):

```bash
# Eski cloudflared konteynerlarini durdur ve sil
docker stop cloudflared-prod cloudflared cloudflared-quick 2>/dev/null || true
docker rm   cloudflared-prod cloudflared cloudflared-quick 2>/dev/null || true

# Compose ile yonetilen cloudflared varsa onu da kaldir
cd /opt/nexus-core-firewall
docker compose --env-file .env --profile cloudflare -f docker-compose.prod.yml down cloudflared 2>/dev/null || true
```

**Yeni token ile tüneli başlat** (nginx host port 80'de dinlediği için `--network host`):

```bash
export CLOUDFLARE_TUNNEL_TOKEN="eyJhIjoi...your-new-token..."

docker run -d \
  --name cloudflared-prod \
  --restart always \
  --network host \
  cloudflare/cloudflared:latest \
  tunnel --no-autoupdate run --token "$CLOUDFLARE_TUNNEL_TOKEN"

docker logs --tail 30 -f cloudflared-prod
```

Cloudflare Zero Trust panelinde tunnel **origin** adresinin `http://127.0.0.1:80` (veya `http://localhost:80`) olduğundan emin olun — nginx-gateway bu portta dinler. **Asla** `http://localhost:8000` kullanmayın (ML API, `/` rotası yok → 404 JSON).

Hızli onarim (sunucuda):

```bash
cd /opt/nexus-core-firewall
sudo bash scripts/fix-cloudflare-tunnel-origin.sh
```

`.env` icinde `CLOUDFLARE_TUNNEL_TOKEN` olmali; yoksa cloudflared baslamaz:

```bash
grep CLOUDFLARE_TUNNEL_TOKEN .env || echo 'CLOUDFLARE_TUNNEL_TOKEN=<token>' >> .env
docker rm -f cloudflared-prod 2>/dev/null || true
docker compose --env-file .env --profile cloudflare -f docker-compose.prod.yml up -d cloudflared
```

**Kalıcı compose yönetimine geri dönmek için:**

```bash
docker stop cloudflared-prod && docker rm cloudflared-prod

cd /opt/nexus-core-firewall
# .env icinde CLOUDFLARE_TUNNEL_TOKEN guncel olmali
docker compose --env-file .env --profile cloudflare -f docker-compose.prod.yml up -d cloudflared
```

> **Uyarı:** Aynı anda hem `docker run` hem `docker compose` cloudflared çalıştırmayın; port/ bağlantı çakışması olur.

## 6. Doğrulama

**Health (public — API Key gerekmez):**

```bash
curl -fsS http://SERVER_IP/healthz
# {"status":"HEALTHY","cache_size":0}
```

**Shield (korumalı — API Key gerekli):**

```bash
curl -X POST http://SERVER_IP/v1/shield \
  -H "Content-Type: application/json" \
  -H "X-API-Key: YOUR_API_KEY_SECRET" \
  -d '{"session_id":"deploy-check","user_input":"Merhaba"}'
```

**Entegrasyon testi (lokal):**

```powershell
$env:BASE_URL = "https://your-public-url.example.com"
$env:API_KEY_SECRET = "your-production-key"
python test_integration.py
```

**Production sunucu doğrulama:**

```powershell
.\verify_production_server.ps1 -ServerIp "35.246.212.11" -PublicUrl "https://your-url.example.com"
```

## 7. Beklenen yanıt kodları

| Endpoint | Key | Başarı | Hata |
|----------|-----|--------|------|
| `GET /healthz` | Hayır | 200 | 503 (servis hazır değil) |
| `POST /v1/shield` | Evet | 200 / 403 | 401 (key yok), 429 (rate limit) |
| `POST /v1/shield/validate-chat` | Evet | 204 / 403 | 401, 429 |

## 8. Sorun giderme

| Belirti | Olası neden | Çözüm |
|---------|-------------|-------|
| `401 Unauthorized` | Eksik/yanlış `X-API-Key` | `.env` içindeki `API_KEY_SECRET` ile eşleştirin |
| `429 Too Many Requests` | Rate limit aşıldı | `RATE_LIMIT_*` değerlerini artırın veya bekleyin |
| `503 UNHEALTHY` | Warm-up başarısız / model yüklenemedi | `docker logs nexus-api-prod` inceleyin |
| Deploy disk hatası | Root disk dolu | GCP Console'dan disk genişletin, `growpart` + `resize2fs` |
| cloudflared başlamıyor | Boş `CLOUDFLARE_TUNNEL_TOKEN` | GitHub Secret veya `.env` güncelleyin |

## 9. Güvenlik notları

- Production'da `API_KEY_SECRET` için **asla** `nexus-dev-test-key` kullanmayın.
- `.env` dosyası git'e eklenmez (`.gitignore`).
- Rate limiting in-memory'dir; `--workers 1` ile tek process'te tutarlı çalışır.
- Nginx istemci `X-API-Key` header'ını backend'e iletir; gateway tarafında ek injection yapılmaz.
