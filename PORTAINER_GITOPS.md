# Portainer GitOps Deployment Guide

Deploy the HR Portal using Portainer's built-in Git repository integration.

## Overview

Portainer will:
1. Pull your `docker-compose.portainer.yml` from GitHub
2. Build the Docker image automatically
3. Deploy the stack
4. Auto-redeploy when you push to GitHub (via webhook)

---

## Step 1: Create the Stack in Portainer

1. **Login to Portainer** → Go to your environment → **Stacks**
2. Click **"Add Stack"**
3. **Name**: `hr-portal`
4. **Build method**: Select **"Git repository"**

### Git Repository Settings

| Field | Value |
|-------|-------|
| **Repository URL** | `https://github.com/nicnets/hr.git` |
| **Repository reference** | `refs/heads/main` |
| **Compose path** | `docker-compose.portainer.yml` |
| **Authentication** | (leave off - public repo) |

> If your repo is private, toggle **Authentication** and add a GitHub Personal Access Token

### Automatic Updates (Webhook)

**Enable "Automatic updates"** - This creates a webhook URL for auto-redeploy

| Setting | Value |
|---------|-------|
| **Mechanism** | Webhook |
| **Automatic update** | ✅ Enabled |

Click **"Create the stack"**

---

## Step 2: Configure Environment Variables

After the stack is created, go to **Stacks** → **hr-portal** → **Editor** tab

Add these environment variables in the **Environment variables** section:

```
NEXTAUTH_URL=http://your-server-ip:3000          # Change to your domain if using reverse proxy
NEXTAUTH_SECRET=your-secret-key-here             # Generate: openssl rand -base64 32
SMTP_HOST=smtp.gmail.com                         # Your SMTP server
SMTP_PORT=587                                    # SMTP port
SMTP_USER=your-email@gmail.com                   # SMTP username
SMTP_PASS=your-app-password                      # SMTP password
SMTP_FROM=your-email@gmail.com                   # From email address
CRON_SECRET=your-cron-secret-here                # Generate: openssl rand -base64 32
COMPANY_NAME=Your Company Name                   # Your company name
```

**Click "Update the stack"** to apply

---

## Step 3: Get the Webhook URL

1. Go to **Stacks** → **hr-portal** → **Settings** tab
2. Find the **Webhook** section
3. Copy the webhook URL (looks like):
   ```
   https://your-portainer.com/api/stacks/webhook/abc123-def456-ghi789
   ```

---

## Step 4: Add Webhook to GitHub

1. Go to your GitHub repo → **Settings** → **Webhooks** → **Add webhook**
2. **Payload URL**: Paste the Portainer webhook URL
3. **Content type**: `application/json`
4. **Which events?** → Select **Just the push event**
5. Click **Add webhook**

---

## Step 5: Test Deployment

### Option A: Push to GitHub

```bash
git add .
git commit -m "test: portainer auto-deploy"
git push origin main
```

Check Portainer → **Stacks** → **hr-portal** → **Logs** to see the redeployment

### Option B: Manual Webhook Test

```bash
curl -X POST "https://your-portainer.com/api/stacks/webhook/YOUR-WEBHOOK-TOKEN"
```

---

## Step 6: Add SSL with Nginx Proxy Manager (Optional)

If you want HTTPS, deploy Nginx Proxy Manager as a separate stack:

### Create NPM Stack

In Portainer → **Stacks** → **Add Stack**

**Name**: `nginx-proxy-manager`

**Web editor** - Paste:

```yaml
version: '3.8'
services:
  npm:
    image: jc21/nginx-proxy-manager:latest
    container_name: nginx-proxy-manager
    restart: unless-stopped
    ports:
      - "80:80"
      - "81:81"
      - "443:443"
    volumes:
      - npm-data:/data
      - npm-letsencrypt:/etc/letsencrypt
    networks:
      - npm-network

networks:
  npm-network:
    driver: bridge

volumes:
  npm-data:
  npm-letsencrypt:
```

Click **Deploy the stack**

### Configure NPM

1. Access NPM at `http://your-server-ip:81`
2. Default login: `admin@example.com` / `changeme`
3. **Add Proxy Host**:
   - **Domain Names**: `hr.yourdomain.com`
   - **Scheme**: `http`
   - **Forward Hostname/IP**: `hr-portal` (the container name)
   - **Forward Port**: `3000`
4. **SSL** tab → **Request a new SSL certificate**
5. Save

---

## Updating the Application

Just push to GitHub:

```bash
git push origin main
```

Portainer automatically:
1. Pulls the latest code
2. Rebuilds the image
3. Redeploys the stack

---

## Troubleshooting

### Build fails in Portainer

Check the stack logs in Portainer → **Stacks** → **hr-portal** → **Logs**

Common issues:
- **Out of memory**: Increase Docker memory limit
- **Build context too large**: Add `.dockerignore` file

### Database not persisting

Named volumes should persist. Check:
```bash
docker volume ls
docker volume inspect hr-portal_hr-portal-data
```

### Webhook not triggering

1. Verify webhook URL is correct in GitHub
2. Check GitHub webhook delivery history (Settings → Webhooks → Recent deliveries)
3. Test webhook manually with curl

### "Stack already exists" error

Portainer keeps the stack name. To fully reset:
1. Delete the stack in Portainer
2. Delete volumes if needed: `docker volume rm hr-portal_hr-portal-data`
3. Recreate the stack

---

## Advantages of This Method

✅ **No SSH keys needed** - Portainer pulls directly from GitHub  
✅ **Auto-redeploy on push** - Webhook triggers update  
✅ **Built-in build** - Portainer builds from Dockerfile  
✅ **Version controlled** - Your compose file is in Git  
✅ **Easy rollback** - Revert commit and push  
