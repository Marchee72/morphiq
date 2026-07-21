#!/bin/bash
set -e

# Create PostgreSQL user and database
sudo -u postgres psql <<'PSQL'
DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'morphiq') THEN
    CREATE USER morphiq WITH PASSWORD 'morphiq_secret_2024';
  END IF;
END
$$;
CREATE DATABASE morphiq OWNER morphiq;
GRANT ALL PRIVILEGES ON DATABASE morphiq TO morphiq;
\connect morphiq
GRANT ALL ON SCHEMA public TO morphiq;
PSQL

echo "✅ PostgreSQL user and database ready."

# Create app directory
mkdir -p /home/marche/morphiq-server

# Install dependencies
cd /home/marche/morphiq-server
npm install --omit=dev 2>/dev/null || true

# Create systemd service
cat > /tmp/morphiq-server.service <<'SERVICE'
[Unit]
Description=MorphIQ API Server
After=network.target postgresql.service
Requires=postgresql.service

[Service]
Type=simple
User=marche
WorkingDirectory=/home/marche/morphiq-server
ExecStart=/usr/bin/node index.js
Restart=always
RestartSec=5
Environment=NODE_ENV=production

[Install]
WantedBy=multi-user.target
SERVICE

sudo mv /tmp/morphiq-server.service /etc/systemd/system/morphiq-server.service
sudo systemctl daemon-reload
sudo systemctl enable morphiq-server
echo "✅ systemd service registered."
