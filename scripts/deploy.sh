#!/bin/bash

# HR Portal Deployment Script for DigitalOcean Droplet
# Usage: ./deploy.sh

set -e

APP_DIR="/var/www/hr-portal"
REPO_URL="git@github.com:your-username/hr-portal.git"
DOMAIN="yourdomain.com"
EMAIL="admin@yourdomain.com"

echo "🚀 Starting HR Portal Deployment"

# Create app directory if not exists
if [ ! -d "$APP_DIR" ]; then
    echo "📁 Creating app directory..."
    sudo mkdir -p $APP_DIR
    sudo chown $USER:$USER $APP_DIR
fi

cd $APP_DIR

# Clone or pull repository
if [ ! -d ".git" ]; then
    echo "📥 Cloning repository..."
    git clone $REPO_URL $APP_DIR
else
    echo "📥 Pulling latest changes..."
    git pull origin main
fi

# Create .env file if not exists
if [ ! -f ".env" ]; then
    echo "⚙️  Creating .env file..."
    cat > .env << 'EOF'
NODE_ENV=production
NEXTAUTH_URL=https://yourdomain.com
NEXTAUTH_SECRET=CHANGE_ME_TO_A_RANDOM_SECRET
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password
SMTP_FROM=hr@yourdomain.com
CRON_SECRET=CHANGE_ME_TO_A_RANDOM_SECRET
COMPANY_NAME=ForceFriction AI
EOF
    echo "⚠️  Please edit .env file with your actual values!"
    exit 1
fi

# Create necessary directories
echo "📁 Creating directories..."
mkdir -p data backups certbot/conf certbot/www

# Build and start containers
echo "🐳 Building and starting containers..."
docker-compose down 2>/dev/null || true
docker-compose build --no-cache
docker-compose up -d

# Clean up old images
echo "🧹 Cleaning up..."
docker image prune -f

# Show status
echo "📊 Container status:"
docker-compose ps

echo ""
echo "✅ Deployment complete!"
echo "🌐 App should be accessible at: https://$DOMAIN"
echo ""
echo "Next steps:"
echo "1. Configure DNS to point to this server"
echo "2. Run: ./scripts/setup-ssl.sh to setup SSL"
echo "3. Setup automated backups"
