#!/bin/sh

# Seed admin script - creates default admin account if none exists
# This script runs after MongoDB is ready and before the app starts

set -e

echo "🌱 Starting admin seed script..."

# Run the Node.js seed script (it will handle MongoDB connection and retries)
node /app/scripts/seed-admin.js

echo "✅ Seed script completed"

