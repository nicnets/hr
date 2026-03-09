# HR Portal - Deployment Guide

This guide covers deploying the HR Portal to a DigitalOcean Droplet using Docker.

## Prerequisites

- DigitalOcean account
- Domain name (pointed to your droplet)
- SSH key pair

## Step 1: Create DigitalOcean Droplet

1. Log in to DigitalOcean
2. Create a new Droplet:
   - **OS**: Ubuntu 22.04 (LTS) x64
   - **Plan**: Basic (Regular Intel/AMD with SSD)
   - **Size**: $12/month (1 GB RAM / 1 vCPU / 25 GB SSD)
   - **Datacenter**: Closest to your location
   - **Authentication**: SSH keys (recommended)
3. Note the Droplet IP address

## Step 2: Configure DNS

Point your domain to the Droplet IP:
```
A record: yourdomain.com -> DROPLET_IP
A record: www.yourdomain.com -> DROPLET_IP
```

## Step 3: Server Setup

SSH into your droplet and run the setup script:

```bash
ssh root@DROPLET_IP

# Download and run setup script
curl -o droplet-setup.sh https://raw.githubusercontent.com/your-username/hr-portal/main/scripts/droplet-setup.sh
chmod +x droplet-setup.sh
./droplet-setup.sh

# Log out and back in for docker permissions
exit
ssh root@DROPLET_IP
```

## Step 4: Clone Repository

```bash
cd /var/www
git clone https://github.com/your-username/hr-portal.git
cd hr-portal
```

## Step 5: Configure Environment

```bash
# Copy example environment file
cp .env.example .env

# Edit with your values
nano .env
```

Required variables to set:
- `NEXTAUTH_URL`: https://yourdomain.com
- `NEXTAUTH_SECRET`: Generate with `openssl rand -base64 32`
- `SMTP_*`: Your SMTP credentials
- `CRON_SECRET`: Generate with `openssl rand -base64 32`

## Step 6: Deploy

```bash
./scripts/deploy.sh
```

## Step 7: Setup SSL (HTTPS)

```bash
./scripts/setup-ssl.sh yourdomain.com admin@yourdomain.com
```

## Step 8: Setup Automated Backups

Add to crontab:
```bash
sudo crontab -e

# Add this line for daily backups at 2 AM
0 2 * * * /var/www/hr-portal/scripts/backup.sh >> /var/log/hr-portal-backup.log 2>&1
```

## CI/CD Setup (GitHub Actions)

1. Go to GitHub repository settings
2. Navigate to Secrets and Variables → Actions
3. Add the following secrets:
   - `DROPLET_IP`: Your droplet IP address
   - `DROPLET_USER`: Usually "root"
   - `DROPLET_SSH_KEY`: Your SSH private key

Push to main branch will automatically deploy.

## Manual Deployment

If not using CI/CD:

```bash
ssh root@DROPLET_IP
cd /var/www/hr-portal
git pull origin main
docker-compose down
docker-compose build --no-cache
docker-compose up -d
docker image prune -f
```

## Monitoring

### Check container status:
```bash
docker-compose ps
docker-compose logs -f app
```

### Health check:
```bash
curl http://localhost:3000/api/health
```

### View logs:
```bash
docker-compose logs -f app
```

## Backup & Restore

### Manual backup:
```bash
./scripts/backup.sh
```

### Restore from backup:
```bash
# Stop containers
docker-compose down

# Restore database
gunzip -c backups/db_YYYYMMDD_HHMMSS.backup.gz > data/hr-portal.db

# Start containers
docker-compose up -d
```

## Troubleshooting

### Container won't start:
```bash
docker-compose logs app
```

### Database issues:
```bash
# Check database
docker exec -it hr-portal sqlite3 /app/data/hr-portal.db ".tables"

# Fix permissions
sudo chown -R 1001:1001 data/
```

### SSL issues:
```bash
# Renew certificates manually
docker-compose run --rm certbot renew
```

## Updating

### Update application:
```bash
cd /var/www/hr-portal
git pull origin main
docker-compose down
docker-compose up -d --build
```

### Update server packages:
```bash
sudo apt update && sudo apt upgrade -y
docker-compose pull
docker-compose up -d
```

## Security Checklist

- [ ] Changed default NEXTAUTH_SECRET
- [ ] Changed default CRON_SECRET
- [ ] SMTP credentials configured
- [ ] Firewall enabled (UFW)
- [ ] SSL certificate installed
- [ ] Regular backups configured
- [ ] SSH key authentication only
- [ ] Regular security updates

## Support

For issues or questions, check:
1. Application logs: `docker-compose logs app`
2. Nginx logs: `docker-compose logs nginx`
3. System logs: `journalctl -u docker`
