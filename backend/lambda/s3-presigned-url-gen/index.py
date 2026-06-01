"""Pre-signed S3 URL generator for file uploads and downloads."""

import json
import os
import logging
import boto3
from botocore.exceptions import ClientError

logger = logging.getLogger()
logger.setLevel(logging.INFO)

s3_client = boto3.client('s3')

UPLOADS_BUCKET = os.environ.get('UPLOADS_BUCKET', '')
PDF_UPLOAD_TIMEOUT = int(os.environ.get('PDF_UPLOAD_TIMEOUT', '120'))
PRESENTATION_TIMEOUT = int(os.environ.get('PRESENTATION_TIMEOUT', '1200'))
JSON_UPLOAD_TIMEOUT = int(os.environ.get('JSON_UPLOAD_TIMEOUT', '60'))
MULTIPART_PART_URL_TIMEOUT = int(os.environ.get('MULTIPART_PART_URL_TIMEOUT', '300'))
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
        'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS',
    }


def lambda_handler(event, context):
    """Generate pre-signed URLs for S3 upload/download operations."""
    http_method = event.get('httpMethod', '')
    headers = get_cors_headers(event)

    try:
        if http_method == 'GET':
            return handle_get_url(event, headers)
        elif http_method == 'POST':
            return handle_post_url(event, headers)
        else:
            return response(405, {'error': f'Method {http_method} not allowed'}, headers)
    except Exception as e:
        logger.error(f'Error: {e}')
        return response(500, {'error': 'Internal server error'}, headers)


def handle_get_url(event, headers):
    """Generate a pre-signed GET URL for downloading a file."""
    params = event.get('queryStringParameters') or {}
    s3_key = params.get('key')

    if not s3_key:
        return response(400, {'error': 'Missing required parameter: key'}, headers)

    try:
        url = s3_client.generate_presigned_url(
            'get_object',
            Params={'Bucket': UPLOADS_BUCKET, 'Key': s3_key},
            ExpiresIn=300,
        )
        return response(200, {'url': url}, headers)
    except ClientError as e:
        logger.error(f'S3 error: {e}')
        return response(500, {'error': 'Failed to generate download URL'}, headers)


def handle_post_url(event, headers):
    """Generate a pre-signed PUT URL for uploading a file."""
    body = json.loads(event.get('body', '{}'))
    file_name = body.get('fileName')
    file_type = body.get('fileType', 'application/octet-stream')
    upload_type = body.get('uploadType', 'document')
    user_id = get_user_id(event)
    session_id = body.get('sessionId', 'default')

    if not file_name:
        return response(400, {'error': 'Missing required field: fileName'}, headers)

    # Determine timeout based on upload type
    timeout_map = {
        'document': PDF_UPLOAD_TIMEOUT,
        'presentation': PRESENTATION_TIMEOUT,
        'json': JSON_UPLOAD_TIMEOUT,
        'multipart': MULTIPART_PART_URL_TIMEOUT,
    }
    timeout = timeout_map.get(upload_type, PDF_UPLOAD_TIMEOUT)

    # Build S3 key: {user_id}/{session_id}/{file_name}
    s3_key = f'{user_id}/{session_id}/{file_name}'

    try:
        url = s3_client.generate_presigned_url(
            'put_object',
            Params={
                'Bucket': UPLOADS_BUCKET,
                'Key': s3_key,
                'ContentType': file_type,
            },
            ExpiresIn=timeout,
        )
        return response(200, {'url': url, 's3Key': s3_key}, headers)
    except ClientError as e:
        logger.error(f'S3 error: {e}')
        return response(500, {'error': 'Failed to generate upload URL'}, headers)


def get_user_id(event):
    """Extract user ID from Cognito authorizer claims."""
    claims = event.get('requestContext', {}).get('authorizer', {}).get('claims', {})
    return claims.get('sub', 'anonymous')


def response(status_code, body, headers):
    """Build API Gateway response."""
    return {
        'statusCode': status_code,
        'headers': headers,
        'body': json.dumps(body),
    }
