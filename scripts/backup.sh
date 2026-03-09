#!/bin/bash

# Database Backup Script
# Usage: ./backup.sh
# Add to crontab: 0 2 * * * /var/www/hr-portal/scripts/backup.sh

set -e

APP_DIR="/var/www/hr-portal"
BACKUP_DIR="$APP_DIR/backups"
DATE=$(date +%Y%m%d_%H%M%S)
CONTAINER_NAME="hr-portal"

# Create backup directory
mkdir -p $BACKUP_DIR

echo "💾 Starting backup at $(date)"

# Create database backup
docker exec $CONTAINER_NAME sqlite3 /app/data/hr-portal.db ".backup '/app/backups/db_$DATE.backup'"

# Copy from container to host
docker cp $CONTAINER_NAME:/app/backups/db_$DATE.backup $BACKUP_DIR/

# Compress backup
gzip $BACKUP_DIR/db_$DATE.backup

# Keep only last 30 backups
cd $BACKUP_DIR
ls -t *.gz | tail -n +31 | xargs rm -f 2>/dev/null || true

# Optional: Upload to DigitalOcean Spaces
# if [ -f ".env" ]; then
#     source .env
#     if [ ! -z "$DO_SPACES_KEY" ]; then
#         s3cmd put $BACKUP_DIR/db_$DATE.backup.gz s3://$DO_SPACES_BUCKET/hr-portal/
#     fi
# fi

echo "✅ Backup completed: db_$DATE.backup.gz"
echo "📊 Total backups: $(ls -1 $BACKUP_DIR/*.gz 2>/dev/null | wc -l)"
