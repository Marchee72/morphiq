#!/bin/bash
set -e

# Fix password and pg_hba to allow password auth
sudo -u postgres psql -c "ALTER USER morphiq WITH PASSWORD 'morphiq_secret_2024';"

# Add md5 auth rule for morphiq user if not already there
HBA=/etc/postgresql/15/main/pg_hba.conf
LINE="host    morphiq         morphiq         127.0.0.1/32            md5"
if ! sudo grep -qF "morphiq" "$HBA"; then
  echo "$LINE" | sudo tee -a "$HBA"
  echo "Added pg_hba rule for morphiq user."
fi

# Reload postgres to apply changes
sudo systemctl reload postgresql
echo "✅ PostgreSQL auth updated."

# Restart the API server
sudo systemctl restart morphiq-server
sleep 3
sudo systemctl status morphiq-server --no-pager
