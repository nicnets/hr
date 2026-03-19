# Portainer Deployment Guide

This guide explains how to set up GitHub Actions to auto-deploy to Portainer.

## Setup Steps

### 1. Configure Portainer Stack

In Portainer, create a new Stack with these settings:

**Method 1: Git Repository (Recommended)**
- Go to **Stacks** → **Add Stack**
- **Name**: `hr-portal`
- **Build method**: Git repository
- **Repository URL**: `https://github.com/nicnets/hr.git`
- **Repository reference**: `refs/heads/main`
- **Compose path**: `docker-compose.yml`
- **Authentication**: (none needed for public repo, or add GitHub token)
- **Enable Automatic Updates**: Toggle ON for webhook-based updates

**Method 2: Web Editor**
- Copy contents of `docker-compose.yml`
- Paste into Web Editor
- Set environment variables in Portainer UI

### 2. Configure Environment Variables in Portainer

Add these environment variables to your stack:

```
NEXTAUTH_URL=https://yourdomain.com
NEXTAUTH_SECRET=your-secret-here
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password
SMTP_FROM=your-email@gmail.com
CRON_SECRET=your-cron-secret
COMPANY_NAME=Your Company
```

### 3. Add GitHub Secrets

Go to your GitHub repo → **Settings** → **Secrets and Variables** → **Actions** → **New repository secret**

#### Option A: Webhook URL (Easiest)

1. In Portainer, go to your Stack → **Settings** → **Enable Webhook**
2. Copy the webhook URL
3. Add to GitHub secrets:
   - Name: `PORTAINER_WEBHOOK_URL`
   - Value: `https://your-portainer.com/api/stacks/webhook/xxxxxxx`

#### Option B: Portainer API

Add these secrets to GitHub:

| Secret Name | Value |
|-------------|-------|
| `PORTAINER_URL` | `https://your-portainer.com` |
| `PORTAINER_API_KEY` | Your Portainer API key |
| `PORTAINER_STACK_ID` | Stack ID number (see below) |
| `PORTAINER_ENDPOINT_ID` | Usually `1` for local |

**How to get Portainer API Key:**
1. Go to Portainer → **My Account** → **API Keys**
2. **Add API Key** → Copy the key

**How to get Stack ID:**
1. Open your stack in Portainer
2. Look at the URL: `https://portainer.example.com/#!/1/docker/stacks/123` 
3. The stack ID is `123`

### 4. Update docker-compose.yml for Portainer

For Portainer, modify the `docker-compose.yml` to use a pre-built image instead of building locally:

```yaml
version: '3.8'

services:
  app:
    image: ghcr.io/nicnets/hr:latest  # Use pre-built image
    container_name: hr-portal
    restart: unless-stopped
    ports:
      - "3000:3000"
    environment:
      - NODE_ENV=production
      - DATABASE_URL=file:./data/hr-portal.db
      - NEXTAUTH_URL=${NEXTAUTH_URL}
      - NEXTAUTH_SECRET=${NEXTAUTH_SECRET}
      - SMTP_HOST=${SMTP_HOST}
      - SMTP_PORT=${SMTP_PORT}
      - SMTP_USER=${SMTP_USER}
      - SMTP_PASS=${SMTP_PASS}
      - SMTP_FROM=${SMTP_FROM}
      - CRON_SECRET=${CRON_SECRET}
      - COMPANY_NAME=${COMPANY_NAME}
    volumes:
      - hr-portal-data:/app/data
      - hr-portal-backups:/app/backups
    networks:
      - hr-portal-network
    healthcheck:
      test: ["CMD", "wget", "--no-verbose", "--tries=1", "--spider", "http://localhost:3000/api/health"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 40s

networks:
  hr-portal-network:
    driver: bridge

volumes:
  hr-portal-data:
  hr-portal-backups:
```

> Note: Remove the `nginx` and `certbot` services if using Portainer's built-in reverse proxy or a separate proxy manager.

### 5. Optional: Use Nginx Proxy Manager

If you want SSL/HTTPS, deploy **Nginx Proxy Manager** as a separate stack in Portainer:

```yaml
version: '3.8'
services:
  npm:
    image: jc21/nginx-proxy-manager:latest
    ports:
      - "80:80"
      - "81:81"
      - "443:443"
    volumes:
      - npm-data:/data
      - npm-letsencrypt:/etc/letsencrypt
    restart: unless-stopped

volumes:
  npm-data:
  npm-letsencrypt:
```

Then in NPM UI:
1. Add Proxy Host
2. Domain: `yourdomain.com`
3. Forward Hostname/IP: `hr-portal-app` (container name)
4. Forward Port: `3000`
5. Enable SSL

### 6. Test Deployment

Push to main branch:
```bash
git add .
git commit -m "test: trigger portainer deployment"
git push origin main
```

Check GitHub Actions tab for deployment status.

## Troubleshooting

### Webhook not working
- Verify webhook URL is correct
- Check if Portainer is publicly accessible
- Check GitHub Actions logs for errors

### Container not updating
- Ensure image tag is `latest` or specific SHA
- Enable "Pull latest image version" in Portainer stack settings
- Check Portainer logs: **Containers** → **hr-portal** → **Logs**

### Database persistence issues
- Ensure named volumes are used (not bind mounts)
- Check volume is correctly mounted: `docker exec hr-portal ls -la /app/data`

## Alternative: Simple SSH Deployment

If you prefer SSH instead of Portainer webhooks, use the existing `.github/workflows/deploy.yml` and update secrets:
- `DROPLET_IP`: Your server IP
- `DROPLET_USER`: SSH username
- `DROPLET_SSH_KEY`: Private SSH key
