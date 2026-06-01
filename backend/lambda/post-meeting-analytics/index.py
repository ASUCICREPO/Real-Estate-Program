"""Post Meeting Analytics Lambda — generates separate presentation and Q&A analytics."""

import json
import os
import logging
import boto3
from botocore.exceptions import ClientError

logger = logging.getLogger()
logger.setLevel(logging.INFO)

s3_client = boto3.client('s3')
dynamodb = boto3.resource('dynamodb')
bedrock_client = boto3.client('bedrock-runtime')

UPLOADS_BUCKET = os.environ.get('UPLOADS_BUCKET', '')
PERSONA_TABLE_NAME = os.environ.get('PERSONA_TABLE_NAME', '')
ALLOWED_ORIGINS = os.environ.get('ALLOWED_ORIGINS', 'http://localhost:3000').split(',')
MODEL_ID = os.environ.get('ANALYTICS_MODEL_ID', 'us.anthropic.claude-3-5-haiku-20241022-v1:0')

persona_table = dynamodb.Table(PERSONA_TABLE_NAME)


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
    """Generate post-meeting analytics for a session."""
    headers = get_cors_headers(event)

    try:
        params = event.get('queryStringParameters') or {}
        user_id = get_user_id(event)
        session_id = params.get('sessionId')
        persona_id = params.get('personaId')

        if not session_id or not persona_id:
            return response(400, {'error': 'Missing sessionId or personaId'}, headers)

        # Fetch persona details
        persona = get_persona(persona_id)
        if not persona:
            return response(404, {'error': f'Persona {persona_id} not found'}, headers)

        # Fetch session data from S3
        presentation_metrics = get_session_data(user_id, session_id, 'presentation_metrics.json')
        qa_metrics = get_session_data(user_id, session_id, 'qa_metrics.json')
        presentation_transcript = get_session_data(user_id, session_id, 'presentation_transcript.json')
        qa_transcript = get_session_data(user_id, session_id, 'qa_transcript.json')

        # Generate separate analytics for presentation and Q&A
        presentation_analytics = generate_analytics(
            persona, presentation_metrics, presentation_transcript, 'presentation'
        )
        qa_analytics = generate_analytics(
            persona, qa_metrics, qa_transcript, 'qa'
        )

        result = {
            'sessionId': session_id,
            'personaId': persona_id,
            'personaName': persona.get('name', ''),
            'presentationAnalytics': presentation_analytics,
            'qaAnalytics': qa_analytics,
        }

        # Save analytics to S3
        save_analytics(user_id, session_id, result)

        return response(200, result, headers)

    except Exception as e:
        logger.error(f'Analytics error: {e}')
        return response(500, {'error': 'Failed to generate analytics'}, headers)


def get_persona(persona_id):
    """Fetch persona from DynamoDB."""
    try:
        result = persona_table.get_item(Key={'personaID': persona_id})
        return result.get('Item')
    except ClientError as e:
        logger.error(f'DynamoDB error: {e}')
        return None


def get_session_data(user_id, session_id, filename):
    """Fetch session data file from S3."""
    key = f'{user_id}/{session_id}/{filename}'
    try:
        obj = s3_client.get_object(Bucket=UPLOADS_BUCKET, Key=key)
        return json.loads(obj['Body'].read().decode('utf-8'))
    except ClientError:
        logger.info(f'Session data not found: {key}')
        return None


def generate_analytics(persona, metrics, transcript, phase):
    """Generate AI-powered analytics for a session phase (presentation or Q&A)."""
    if not metrics and not transcript:
        return {
            'overallScore': 0,
            'metricScores': [],
            'recommendations': [],
            'summary': f'No {phase} data available for analysis.',
        }

    # Build prompt for Bedrock
    persona_name = persona.get('name', 'Unknown')
    key_priorities = persona.get('keyPriorities', [])
    best_practices = persona.get('bestPractices', {})
    scoring_weights = persona.get('scoringWeights', {})

    prompt = f"""You are an expert presentation coach analyzing a student's {phase} performance.
The student presented to a "{persona_name}" persona with these priorities: {json.dumps(key_priorities)}.

Best practice thresholds: {json.dumps(best_practices)}
Scoring weights: {json.dumps(scoring_weights)}

Session metrics: {json.dumps(metrics) if metrics else 'No metrics captured'}
Transcript excerpt: {json.dumps(transcript[:5000]) if transcript else 'No transcript available'}

Provide analysis in this JSON format:
{{
  "overallScore": <0-100>,
  "metricScores": [
    {{"name": "<metric>", "score": <0-100>, "weight": <0-1>, "details": "<explanation>"}}
  ],
  "recommendations": ["<actionable recommendation 1>", "<actionable recommendation 2>", ...],
  "summary": "<2-3 sentence summary of performance>"
}}

Focus on persona-specific feedback. For the {phase} phase, evaluate:
{"delivery, structure, clarity, and engagement" if phase == "presentation" else "response quality, composure under pressure, relevance to questions, and confidence"}.
"""

    try:
        bedrock_response = bedrock_client.invoke_model(
            modelId=MODEL_ID,
            contentType='application/json',
            accept='application/json',
            body=json.dumps({
                'anthropic_version': 'bedrock-2023-05-31',
                'max_tokens': 2000,
                'messages': [{'role': 'user', 'content': prompt}],
            }),
        )

        response_body = json.loads(bedrock_response['body'].read())
        content = response_body.get('content', [{}])[0].get('text', '{}')

        # Parse the JSON from the model response
        analytics = json.loads(content)
        return analytics

    except (ClientError, json.JSONDecodeError, KeyError) as e:
        logger.error(f'Bedrock analytics error: {e}')
        return {
            'overallScore': 0,
            'metricScores': [],
            'recommendations': ['Unable to generate AI feedback. Please try again.'],
            'summary': f'Analytics generation failed for {phase} phase.',
        }


def save_analytics(user_id, session_id, analytics):
    """Save analytics results to S3."""
    key = f'{user_id}/{session_id}/analytics_report.json'
    try:
        s3_client.put_object(
            Bucket=UPLOADS_BUCKET,
            Key=key,
            Body=json.dumps(analytics, default=str),
            ContentType='application/json',
        )
    except ClientError as e:
        logger.error(f'Failed to save analytics: {e}')


def get_user_id(event):
    """Extract user ID from Cognito authorizer claims."""
    claims = event.get('requestContext', {}).get('authorizer', {}).get('claims', {})
    return claims.get('sub', 'anonymous')


def response(status_code, body, headers):
    """Build API Gateway response."""
    return {
        'statusCode': status_code,
        'headers': headers,
        'body': json.dumps(body, default=str),
    }
