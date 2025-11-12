#!/bin/bash

# ============================================
# Script để update bảng issues trong database
# ============================================

# Load environment variables from .env file
if [ -f .env ]; then
    export $(cat .env | grep -v '^#' | xargs)
else
    echo "❌ File .env không tồn tại!"
    exit 1
fi

# Database credentials from .env
DB_HOST=${DB_HOST:-localhost}
DB_PORT=${DB_PORT:-3306}
DB_USER=${DB_USER:-root}
DB_PASSWORD=${DB_PASSWORD}
DB_NAME=${DB_NAME:-ids}

echo "📡 Connecting to MySQL at ${DB_HOST}:${DB_PORT}"
echo "📊 Database: ${DB_NAME}"
echo ""

# Check if table exists
echo "🔍 Checking if 'issues' table exists..."
TABLE_EXISTS=$(mysql -h${DB_HOST} -P${DB_PORT} -u${DB_USER} -p${DB_PASSWORD} -D${DB_NAME} -sse "SHOW TABLES LIKE 'issues';")

if [ -z "$TABLE_EXISTS" ]; then
    echo "✅ Table 'issues' does not exist. Creating new table..."
    mysql -h${DB_HOST} -P${DB_PORT} -u${DB_USER} -p${DB_PASSWORD} -D${DB_NAME} << 'EOF'
CREATE TABLE `issues` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `order_id` BIGINT UNSIGNED NOT NULL,
  `issue_type` VARCHAR(191) NOT NULL,
  `status` VARCHAR(191) NOT NULL DEFAULT 'open',
  `old_data` JSON NULL,
  `new_data` JSON NULL,
  `notes` TEXT NULL,
  `created_by` VARCHAR(191) NULL,
  `resolved_at` TIMESTAMP(0) NULL,
  `created_at` TIMESTAMP(0) NULL,
  `updated_at` TIMESTAMP(0) NULL,
  PRIMARY KEY (`id`),
  INDEX `issues_order_id_foreign` (`order_id`),
  INDEX `issues_status_index` (`status`),
  INDEX `issues_issue_type_index` (`issue_type`),
  CONSTRAINT `issues_order_id_foreign` FOREIGN KEY (`order_id`) REFERENCES `orders` (`id`) ON DELETE CASCADE ON UPDATE NO ACTION
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
EOF
    
    if [ $? -eq 0 ]; then
        echo "✅ Table 'issues' created successfully!"
    else
        echo "❌ Failed to create table 'issues'"
        exit 1
    fi
else
    echo "⚠️  Table 'issues' already exists. Checking column types..."
    
    # Check current column types
    ISSUE_TYPE_TYPE=$(mysql -h${DB_HOST} -P${DB_PORT} -u${DB_USER} -p${DB_PASSWORD} -D${DB_NAME} -sse "SELECT DATA_TYPE FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = '${DB_NAME}' AND TABLE_NAME = 'issues' AND COLUMN_NAME = 'issue_type';")
    STATUS_TYPE=$(mysql -h${DB_HOST} -P${DB_PORT} -u${DB_USER} -p${DB_PASSWORD} -D${DB_NAME} -sse "SELECT DATA_TYPE FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = '${DB_NAME}' AND TABLE_NAME = 'issues' AND COLUMN_NAME = 'status';")
    
    echo "Current issue_type type: ${ISSUE_TYPE_TYPE}"
    echo "Current status type: ${STATUS_TYPE}"
    
    if [ "$ISSUE_TYPE_TYPE" = "enum" ] || [ "$STATUS_TYPE" = "enum" ]; then
        echo "🔄 Converting ENUM columns to VARCHAR..."
        
        mysql -h${DB_HOST} -P${DB_PORT} -u${DB_USER} -p${DB_PASSWORD} -D${DB_NAME} << 'EOF'
ALTER TABLE `issues` 
MODIFY COLUMN `issue_type` VARCHAR(191) NOT NULL;

ALTER TABLE `issues` 
MODIFY COLUMN `status` VARCHAR(191) NOT NULL DEFAULT 'open';
EOF
        
        if [ $? -eq 0 ]; then
            echo "✅ Columns converted to VARCHAR successfully!"
        else
            echo "❌ Failed to convert columns"
            exit 1
        fi
    else
        echo "✅ Columns are already VARCHAR. No update needed."
    fi
fi

# Verify final structure
echo ""
echo "📋 Final table structure:"
mysql -h${DB_HOST} -P${DB_PORT} -u${DB_USER} -p${DB_PASSWORD} -D${DB_NAME} -e "SELECT COLUMN_NAME, DATA_TYPE, COLUMN_TYPE, IS_NULLABLE, COLUMN_DEFAULT FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = '${DB_NAME}' AND TABLE_NAME = 'issues' AND COLUMN_NAME IN ('issue_type', 'status');"

echo ""
echo "✅ Done!"





