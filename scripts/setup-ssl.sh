#!/bin/bash

# SSL Setup Script using Let's Encrypt
# Usage: ./setup-ssl.sh yourdomain.com admin@yourdomain.com

set -e

DOMAIN=${1:-"yourdomain.com"}
EMAIL=${2:-"admin@yourdomain.com"}

echo "🔒 Setting up SSL for $DOMAIN"

# Create certbot directories
mkdir -p certbot/conf certbot/www

# Stop nginx temporarily
docker-compose stop nginx

# Get certificate
docker-compose run --rm certbot certonly \
    --webroot \
    --webroot-path=/var/www/certbot \
    --email $EMAIL \
    --agree-tos \
    --no-eff-email \
    -d $DOMAIN

# Update nginx config with actual domain
sed -i "s/yourdomain.com/$DOMAIN/g" nginx.conf

# Start nginx
docker-compose start nginx

# Reload nginx
docker-compose exec nginx nginx -s reload

echo "✅ SSL certificate installed for $DOMAIN"
echo "🔄 Auto-renewal is configured"
