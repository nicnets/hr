#!/bin/bash

# Server Setup Script for DigitalOcean Droplet
# Run this on a fresh Ubuntu 22.04 droplet

set -e

APP_DIR="/var/www/hr-portal"

echo "🚀 Setting up HR Portal Server"

# Update system
echo "📦 Updating system packages..."
sudo apt update && sudo apt upgrade -y

# Install Docker
echo "🐳 Installing Docker..."
sudo apt install -y apt-transport-https ca-certificates curl software-properties-common
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo apt-key add -
sudo add-apt-repository "deb [arch=amd64] https://download.docker.com/linux/ubuntu $(lsb_release -cs) stable"
sudo apt update
sudo apt install -y docker-ce

# Install Docker Compose
echo "🐳 Installing Docker Compose..."
sudo curl -L "https://github.com/docker/compose/releases/download/v2.24.0/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
sudo chmod +x /usr/local/bin/docker-compose

# Add user to docker group
sudo usermod -aG docker ${USER}

# Install Git
echo "📦 Installing Git..."
sudo apt install -y git

# Install SQLite (for backups)
echo "📦 Installing SQLite..."
sudo apt install -y sqlite3

# Setup firewall
echo "🛡️  Configuring firewall..."
sudo ufw allow OpenSSH
sudo ufw allow 'Nginx Full'
sudo ufw --force enable

# Create app directory
echo "📁 Creating app directory..."
sudo mkdir -p $APP_DIR
sudo chown $USER:$USER $APP_DIR

# Install certbot (for SSL)
echo "🔒 Installing Certbot..."
sudo apt install -y certbot

echo ""
echo "✅ Server setup complete!"
echo ""
echo "Next steps:"
echo "1. Log out and log back in for docker permissions"
echo "2. Clone your repository to $APP_DIR"
echo "3. Run: ./scripts/deploy.sh"
echo "4. Run: ./scripts/setup-ssl.sh yourdomain.com your@email.com"
echo ""
echo "📧 Configure SMTP in .env for email notifications"
