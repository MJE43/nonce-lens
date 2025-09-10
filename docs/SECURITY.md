# Security Configuration Guide

This document outlines the security features and configuration options for the Pump Analyzer Web application, particularly for the Live Streams functionality.

## Overview

The application implements several security measures to protect against unauthorized access and abuse:

- **Token-based authentication** for ingestion endpoints
- **Local-only binding** by default (127.0.0.1)
- **Rate limiting** to prevent abuse
- **CORS configuration** for cross-origin protection

## Configuration Options

### Environment Variables

All security settings are configured via environment variables in the `.env` file:

```bash
# Live Streams Security Configuration
# X-Ingest-Token for authenticating ingestion requests (leave empty to disable)
INGEST_TOKEN=your-secret-token-here

# API server binding configuration (127.0.0.1 for local-only access)
API_HOST=127.0.0.1
API_PORT=8000

# Rate limiting for ingestion endpoint (requests per minute)
INGEST_RATE_LIMIT=60

# CORS configuration for frontend
API_CORS_ORIGINS=http://localhost:5173
```

### Ingestion Token Authentication

The `INGEST_TOKEN` setting controls access to the live streams ingestion endpoint:

- **Empty/unset**: Allows unrestricted access to `/live/ingest`
- **Set to a value**: Requires `X-Ingest-Token` header with matching value

**Example usage:**
```bash
# Generate a secure token
INGEST_TOKEN=$(openssl rand -hex 32)

# Or use a custom token
INGEST_TOKEN=my-secret-ingestion-token
```

**API Request:**
```bash
curl -X POST http://localhost:8000/live/ingest \
  -H "Content-Type: application/json" \
  -H "X-Ingest-Token: my-secret-ingestion-token" \
  -d '{"id": "bet123", "nonce": 1, ...}'
```

### Local-Only Binding

By default, the API server binds to `127.0.0.1` (localhost only) for security:

```bash
# Local-only access (default)
API_HOST=127.0.0.1

# Allow access from any interface (less secure)
API_HOST=0.0.0.0
```

**Security implications:**
- `127.0.0.1`: Only accessible from the local machine
- `0.0.0.0`: Accessible from any network interface (use with caution)

### Rate Limiting

The ingestion endpoint is protected by rate limiting to prevent abuse:

```bash
# Allow 60 requests per minute per IP (default)
INGEST_RATE_LIMIT=60

# More restrictive: 30 requests per minute
INGEST_RATE_LIMIT=30

# More permissive: 120 requests per minute
INGEST_RATE_LIMIT=120
```

**Rate limit headers:**
- `X-RateLimit-Limit`: Maximum requests per minute
- `X-RateLimit-Remaining`: Requests remaining in current window
- `X-RateLimit-Reset`: Unix timestamp when limit resets
- `Retry-After`: Seconds to wait before retrying (when rate limited)

### CORS Configuration

Cross-Origin Resource Sharing (CORS) is configured to allow specific origins:

```bash
# Single origin (default)
API_CORS_ORIGINS=http://localhost:5173

# Multiple origins (comma-separated)
API_CORS_ORIGINS=http://localhost:5173,http://localhost:3000

# Development with different ports
API_CORS_ORIGINS=http://localhost:5173,http://127.0.0.1:5173
```

**Allowed headers include:**
- Standard headers (Content-Type, Authorization, etc.)
- `X-Ingest-Token` for live streams authentication
- Rate limiting headers are exposed to clients

## Starting the Server

### Using the Startup Script

The recommended way to start the server with security configuration:

```bash
cd pump-api
python start_server.py
```

This script will:
- Load configuration from environment variables
- Display current security settings
- Start the server with configured host/port binding

### Manual Startup

You can also start the server manually with uvicorn:

```bash
cd pump-api
uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload
```

## Security Best Practices

### For Development

1. **Use local-only binding**: Keep `API_HOST=127.0.0.1`
2. **Set an ingestion token**: Protect the ingestion endpoint
3. **Use HTTPS in production**: Configure TLS certificates
4. **Monitor rate limits**: Adjust based on expected traffic

### For Production Deployment

1. **Generate strong tokens**: Use cryptographically secure random tokens
2. **Configure firewall rules**: Restrict network access
3. **Enable logging**: Monitor access patterns and failed attempts
4. **Regular token rotation**: Change ingestion tokens periodically

### Token Generation

Generate secure tokens using system tools:

```bash
# Using openssl (32-byte hex)
openssl rand -hex 32

# Using Python
python -c "import secrets; print(secrets.token_hex(32))"

# Using Node.js
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

## Monitoring and Logging

The application logs security-related events:

- **Authentication failures**: Invalid or missing tokens
- **Rate limit violations**: Requests exceeding limits
- **CORS violations**: Requests from unauthorized origins

Monitor these logs for potential security issues:

```bash
# View server logs
tail -f server.log | grep -E "(401|429|CORS)"
```

## Troubleshooting

### Common Issues

**403 Forbidden / 401 Unauthorized**
- Check that `X-Ingest-Token` header matches `INGEST_TOKEN` setting
- Verify token is not empty or contains special characters

**429 Too Many Requests**
- Increase `INGEST_RATE_LIMIT` if legitimate traffic is being blocked
- Check for automated scripts making too many requests

**CORS Errors**
- Ensure frontend origin is listed in `API_CORS_ORIGINS`
- Check for typos in protocol (http vs https) or port numbers

**Connection Refused**
- Verify `API_HOST` and `API_PORT` settings
- Check if server is running and bound to correct interface

### Testing Security Configuration

Test ingestion endpoint security:

```bash
# Test without token (should fail if token is configured)
curl -X POST http://localhost:8000/live/ingest \
  -H "Content-Type: application/json" \
  -d '{"id": "test", "nonce": 1}'

# Test with correct token (should succeed)
curl -X POST http://localhost:8000/live/ingest \
  -H "Content-Type: application/json" \
  -H "X-Ingest-Token: your-token-here" \
  -d '{"id": "test", "nonce": 1}'

# Test rate limiting (make multiple rapid requests)
for i in {1..70}; do
  curl -X POST http://localhost:8000/live/ingest \
    -H "X-Ingest-Token: your-token-here" \
    -d '{"id": "test'$i'", "nonce": '$i'}'
done
```

## Security Updates

Keep the application and dependencies updated:

```bash
# Update Python dependencies
cd pump-api
pip install --upgrade -r requirements.txt

# Update Node.js dependencies
cd pump-frontend
npm update
```

Regular security audits and dependency updates help maintain a secure application.