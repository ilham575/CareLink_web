#!/bin/bash

# Direct SQL script to add admin_profile_id column to drug_stores table
# This runs using psql with Cloud SQL Proxy

DB_NAME="${DATABASE_NAME:-carelink_db}"
DB_USER="${DATABASE_USERNAME:-postgres}"
DB_PASSWORD="${DATABASE_PASSWORD}"
CLOUD_SQL_INSTANCE="carelink-web:asia-southeast1:carelink-db"

# Check if column already exists
COLUMN_EXISTS=$(PGPASSWORD="$DB_PASSWORD" psql -h /cloudsql/$CLOUD_SQL_INSTANCE -U "$DB_USER" -d "$DB_NAME" -t -c "SELECT column_name FROM information_schema.columns WHERE table_name='drug_stores' AND column_name='admin_profile_id';" 2>/dev/null)

if [ -n "$COLUMN_EXISTS" ]; then
  echo "✅ Column admin_profile_id already exists in drug_stores table"
  exit 0
fi

# Add the column and foreign key
echo "🔧 Adding admin_profile_id column to drug_stores..."

PGPASSWORD="$DB_PASSWORD" psql -h /cloudsql/$CLOUD_SQL_INSTANCE -U "$DB_USER" -d "$DB_NAME" <<EOF
ALTER TABLE drug_stores ADD COLUMN admin_profile_id INTEGER;

ALTER TABLE drug_stores ADD CONSTRAINT fk_drug_stores_admin_profile
FOREIGN KEY (admin_profile_id) REFERENCES admin_profiles(id) ON DELETE SET NULL ON UPDATE CASCADE;

EOF

if [ $? -eq 0 ]; then
  echo "✅ Successfully added admin_profile_id column to drug_stores"
  exit 0
else
  echo "❌ Failed to add admin_profile_id column"
  exit 1
fi
