"""Anam AI session token Lambda — exchanges API key for a short-lived session token."""

import json
import os
import logging
import urllib.request
import urllib.error

logger = logging.getLogger()
logger.setLevel(logging.INFO)

ANAM_API_KEY = os.environ.get('ANAM_API_KEY', '')
ALLOWED_ORIGINS = os.environ.get('ALLOWED_ORIGINS', 'http://localhost:3000').split(',')


def get_cors_headers(event):
    """Return CORS headers based on the request origin."""
    origin = event.get('headers', {}).get('origin', '') or event.get('headers', {}).get('Origin', '')
    allowed_origin = ALLOWED_ORIGINS[0]
    if origin in ALLOWED_ORIGINS:
        allowed_origin = origin
    return {
        'Access-Control-Allow-Origin': allowed_origin,
        'Access-Control-Allow-Headers': 'Content-Type,Authorization',
        'Access-Control-Allow-Methods': 'POST,OPTIONS',
    }


def response(status_code, body, headers):
    return {
        'statusCode': status_code,
        'headers': headers,
        'body': json.dumps(body),
    }


def lambda_handler(event, context):
    """Generate an Anam session token for the given persona."""
    headers = get_cors_headers(event)

    # Handle CORS preflight
    if event.get('httpMethod') == 'OPTIONS':
        return response(200, {}, headers)

    if not ANAM_API_KEY:
        return response(500, {'error': 'ANAM_API_KEY not configured'}, headers)

    try:
        body = json.loads(event.get('body', '{}'))
    except (json.JSONDecodeError, TypeError):
        return response(400, {'error': 'Invalid request body'}, headers)

    anam_persona_id = body.get('anamPersonaId', '')
    if not anam_persona_id:
        return response(400, {'error': 'Missing anamPersonaId'}, headers)

    # Request session token from Anam API (with audio passthrough for Nova Sonic lip sync)
    payload = json.dumps({
        'personaConfig': {
            'personaId': anam_persona_id,
            'enableAudioPassthrough': True,
        },
    }).encode('utf-8')

    req = urllib.request.Request(
        'https://api.anam.ai/v1/auth/session-token',
        data=payload,
        headers={
            'Content-Type': 'application/json',
            'Authorization': f'Bearer {ANAM_API_KEY}',
        },
        method='POST',
    )

    try:
        with urllib.request.urlopen(req, timeout=10) as resp:
            data = json.loads(resp.read().decode('utf-8'))
            session_token = data.get('sessionToken', '')
            if not session_token:
                return response(500, {'error': 'No session token in Anam response'}, headers)
            return response(200, {'sessionToken': session_token}, headers)
    except urllib.error.HTTPError as e:
        error_body = e.read().decode('utf-8') if e.fp else ''
        logger.error(f'Anam API error: {e.code} - {error_body}')
        return response(502, {'error': f'Anam API error: {e.code}'}, headers)
    except Exception as e:
        logger.error(f'Failed to get Anam session token: {e}')
        return response(500, {'error': 'Failed to get session token'}, headers)
