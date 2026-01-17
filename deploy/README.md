# UCPtools Hetzner Deployment

This directory contains deployment configurations for the Hetzner VPS.

## Server Details

- **IP:** `188.245.240.175`
- **Hostname:** ubuntu-4gb-nbg1-3
- **User:** root
- **Deploy path:** `/opt/ucptools`

## Initial Setup

### 1. SSH to server

```bash
ssh root@188.245.240.175
```

### 2. Create deployment directory

```bash
mkdir -p /opt/ucptools
cd /opt/ucptools
```

### 3. Create environment file

```bash
cp deploy/.env.example .env.production
nano .env.production  # Fill in actual values
```

### 4. Generate secure passwords

```bash
# Generate Postgres password
openssl rand -base64 32

# Generate Auth secret
openssl rand -base64 32
```

### 5. Set up Nginx

Add UCPtools to existing Nginx container:

```bash
# Copy nginx config
docker cp deploy/nginx/ucptools.conf riskrazr-nginx:/etc/nginx/conf.d/ucptools.conf

# Get SSL certificate
docker run --rm \
  -v /etc/letsencrypt:/etc/letsencrypt \
  -v /var/www/certbot:/var/www/certbot \
  certbot/certbot certonly \
  --webroot -w /var/www/certbot \
  -d api.ucptools.dev \
  --email your@email.com \
  --agree-tos \
  --non-interactive

# Reload Nginx
docker exec riskrazr-nginx nginx -s reload
```

### 6. Connect networks

UCPtools needs to be on the same Docker network as Nginx:

```bash
# Create network if not exists
docker network create ucptools-network

# Connect Nginx to UCPtools network
docker network connect ucptools-network riskrazr-nginx
```

### 7. Start UCPtools

```bash
cd /opt/ucptools
docker compose up -d
```

### 8. Verify deployment

```bash
# Check containers
docker compose ps

# Check logs
docker compose logs -f ucptools-api

# Test health endpoint
curl http://localhost:3001/health

# Test via Nginx
curl https://api.ucptools.dev/health
```

## GitHub Actions Setup

### Required Secrets

Add these secrets to GitHub repository settings:

| Secret | Description |
|--------|-------------|
| `HETZNER_SSH_KEY` | Private SSH key for deployment |

### Generate deployment key

```bash
# On your local machine
ssh-keygen -t ed25519 -C "github-deploy" -f ~/.ssh/ucptools-deploy

# Copy public key to server
ssh-copy-id -i ~/.ssh/ucptools-deploy.pub root@188.245.240.175

# Add private key to GitHub secrets
cat ~/.ssh/ucptools-deploy
```

## Manual Deployment

If GitHub Actions isn't set up yet:

```bash
# From local machine
rsync -avz --exclude 'node_modules' --exclude '.git' \
  ./ root@188.245.240.175:/opt/ucptools/

# SSH to server and deploy
ssh root@188.245.240.175
cd /opt/ucptools
docker compose build
docker compose up -d
```

## Monitoring

### View logs

```bash
# All containers
docker compose logs -f

# Just API
docker compose logs -f ucptools-api

# Just database
docker compose logs -f ucptools-postgres
```

### Check resource usage

```bash
docker stats
```

### Database backup

```bash
# Manual backup
docker exec ucptools-postgres pg_dump -U ucptools ucptools > backup.sql

# Restore
cat backup.sql | docker exec -i ucptools-postgres psql -U ucptools ucptools
```

## Cron Jobs

Add to server's crontab for weekly monitoring:

```bash
crontab -e

# Add:
# Weekly monitoring job (every Monday at 6am)
0 6 * * 1 cd /opt/ucptools && docker compose exec -T ucptools-api node dist/jobs/weekly-monitor.js

# Database backup (daily at 2am)
0 2 * * * docker exec ucptools-postgres pg_dump -U ucptools ucptools | gzip > /opt/backups/ucptools-$(date +\%Y\%m\%d).sql.gz

# Cleanup old backups (keep last 7 days)
0 3 * * * find /opt/backups -name "ucptools-*.sql.gz" -mtime +7 -delete
```

## Troubleshooting

### Container won't start

```bash
docker compose logs ucptools-api
docker compose down
docker compose up -d
```

### Database connection issues

```bash
# Check if postgres is healthy
docker compose ps ucptools-postgres

# Connect to database
docker exec -it ucptools-postgres psql -U ucptools ucptools
```

### Nginx issues

```bash
# Check nginx logs
docker logs riskrazr-nginx

# Test nginx config
docker exec riskrazr-nginx nginx -t

# Reload nginx
docker exec riskrazr-nginx nginx -s reload
```

## Architecture

```
Internet
    │
    ▼
┌─────────────────┐
│  Nginx (:443)   │  ← SSL termination
│  riskrazr-nginx │
└────────┬────────┘
         │
    ┌────┴────┐
    ▼         ▼
┌────────┐ ┌────────┐
│UCPtools│ │riskrazr│
│  :3001 │ │  :2368 │
└────┬───┘ └────────┘
     │
┌────┴────┐
▼         ▼
┌──────┐ ┌──────┐
│Postgr│ │Redis │
│  :5432│ │:6379 │
└──────┘ └──────┘
```
