"""Persona CRUD Lambda — GET, POST, PUT, DELETE /personas."""

import json
import os
import logging
import uuid
import boto3
from botocore.exceptions import ClientError

logger = logging.getLogger()
logger.setLevel(logging.INFO)

dynamodb = boto3.resource('dynamodb')
PERSONA_TABLE_NAME = os.environ.get('PERSONA_TABLE_NAME', '')
MAX_ITEMS_PER_PAGE = int(os.environ.get('MAX_ITEMS_PER_PAGE', '20'))
ALLOWED_ORIGINS = os.environ.get('ALLOWED_ORIGINS', 'http://localhost:3000').split(',')

table = dynamodb.Table(PERSONA_TABLE_NAME)


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
    """Route requests to the appropriate persona operation."""
    http_method = event.get('httpMethod', '')
    path_params = event.get('pathParameters') or {}
    persona_id = path_params.get('personaID')
    headers = get_cors_headers(event)

    logger.info(json.dumps({
        'action': 'persona_request',
        'method': http_method,
        'personaId': persona_id,
    }))

    try:
        if http_method == 'GET' and persona_id:
            return get_persona(persona_id, headers)
        elif http_method == 'GET':
            return list_personas(headers)
        elif http_method == 'POST':
            return create_persona(event, headers)
        elif http_method == 'PUT' and persona_id:
            return update_persona(persona_id, event, headers)
        elif http_method == 'DELETE' and persona_id:
            return delete_persona(persona_id, headers)
        else:
            return response(405, {'error': f'Method {http_method} not allowed'}, headers)
    except Exception as e:
        logger.error(f'Persona handler error: {e}')
        return response(500, {'error': 'Internal server error'}, headers)


def list_personas(headers):
    """Return all personas (excluding personaPrompt for list view)."""
    try:
        result = table.scan(Limit=MAX_ITEMS_PER_PAGE)
        items = result.get('Items', [])
        # Strip personaPrompt from list view for brevity
        for item in items:
            item.pop('personaPrompt', None)
        return response(200, {'personas': items}, headers)
    except ClientError as e:
        logger.error(f'DynamoDB error: {e}')
        return response(500, {'error': 'Failed to list personas'}, headers)


def get_persona(persona_id, headers):
    """Return a single persona by ID (includes personaPrompt)."""
    try:
        result = table.get_item(Key={'personaID': persona_id})
        item = result.get('Item')
        if not item:
            return response(404, {'error': f'Persona {persona_id} not found'}, headers)
        return response(200, item, headers)
    except ClientError as e:
        logger.error(f'DynamoDB error: {e}')
        return response(500, {'error': 'Failed to get persona'}, headers)


def create_persona(event, headers):
    """Create a new persona."""
    body = json.loads(event.get('body', '{}'))

    # Validate required fields
    required_fields = ['name', 'description', 'personaPrompt', 'keyPriorities']
    missing = [f for f in required_fields if f not in body]
    if missing:
        return response(400, {'error': f'Missing required fields: {missing}'}, headers)

    persona_id = str(uuid.uuid4())
    item = {
        'personaID': persona_id,
        'name': body.get('name'),
        'description': body.get('description'),
        'icon': body.get('icon', 'person'),
        'expertise': body.get('expertise', 'Intermediate'),
        'communicationStyle': body.get('communicationStyle', ''),
        'keyPriorities': body.get('keyPriorities', []),
        'personaPrompt': body.get('personaPrompt', ''),
        'presentationTime': body.get('presentationTime', '10 minutes'),
        'timeLimitSec': body.get('timeLimitSec', 600),
        'qaTimeLimitSec': body.get('qaTimeLimitSec', 600),
        'bestPractices': body.get('bestPractices', {}),
        'scoringWeights': body.get('scoringWeights', {}),
    }

    try:
        table.put_item(Item=item)
        return response(201, item, headers)
    except ClientError as e:
        logger.error(f'DynamoDB error: {e}')
        return response(500, {'error': 'Failed to create persona'}, headers)


def update_persona(persona_id, event, headers):
    """Update an existing persona."""
    body = json.loads(event.get('body', '{}'))

    # Check persona exists
    existing = table.get_item(Key={'personaID': persona_id}).get('Item')
    if not existing:
        return response(404, {'error': f'Persona {persona_id} not found'}, headers)

    # Merge updates
    updatable_fields = [
        'name', 'description', 'icon', 'expertise', 'communicationStyle',
        'keyPriorities', 'personaPrompt', 'presentationTime', 'timeLimitSec',
        'qaTimeLimitSec', 'bestPractices', 'scoringWeights',
    ]

    update_expr_parts = []
    expr_attr_values = {}
    expr_attr_names = {}

    for field in updatable_fields:
        if field in body:
            placeholder = f':val_{field}'
            name_placeholder = f'#attr_{field}'
            update_expr_parts.append(f'{name_placeholder} = {placeholder}')
            expr_attr_values[placeholder] = body[field]
            expr_attr_names[name_placeholder] = field

    if not update_expr_parts:
        return response(400, {'error': 'No fields to update'}, headers)

    try:
        result = table.update_item(
            Key={'personaID': persona_id},
            UpdateExpression='SET ' + ', '.join(update_expr_parts),
            ExpressionAttributeValues=expr_attr_values,
            ExpressionAttributeNames=expr_attr_names,
            ReturnValues='ALL_NEW',
        )
        return response(200, result.get('Attributes', {}), headers)
    except ClientError as e:
        logger.error(f'DynamoDB error: {e}')
        return response(500, {'error': 'Failed to update persona'}, headers)


def delete_persona(persona_id, headers):
    """Delete a persona by ID."""
    try:
        # Check exists first
        existing = table.get_item(Key={'personaID': persona_id}).get('Item')
        if not existing:
            return response(404, {'error': f'Persona {persona_id} not found'}, headers)

        table.delete_item(Key={'personaID': persona_id})
        return response(200, {'message': f'Persona {persona_id} deleted'}, headers)
    except ClientError as e:
        logger.error(f'DynamoDB error: {e}')
        return response(500, {'error': 'Failed to delete persona'}, headers)


def response(status_code, body, headers):
    """Build API Gateway response."""
    return {
        'statusCode': status_code,
        'headers': headers,
        'body': json.dumps(body, default=str),
    }
