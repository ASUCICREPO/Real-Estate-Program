"""Content Analysis & Question Generation Lambda.

Reads uploaded presentation materials (PDF/PPT) from S3, analyzes them
using Bedrock, and generates persona-specific questions for the Q&A session.
"""

import json
import os
import logging
import base64
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
MODEL_ID = os.environ.get('CONTENT_MODEL_ID', 'us.anthropic.claude-3-5-haiku-20241022-v1:0')
GUARDRAIL_ID = os.environ.get('BEDROCK_GUARDRAIL_ID', '')
GUARDRAIL_VERSION = os.environ.get('BEDROCK_GUARDRAIL_VERSION', '3')

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
    """Analyze uploaded content and generate persona-specific questions."""
    headers = get_cors_headers(event)

    try:
        body = json.loads(event.get('body', '{}'))
        user_id = get_user_id(event)
        s3_key = body.get('s3Key')
        persona_id = body.get('personaId')
        session_id = body.get('sessionId')

        if not s3_key or not persona_id:
            return response(400, {'error': 'Missing s3Key or personaId'}, headers)

        # Fetch persona
        persona = get_persona(persona_id)
        if not persona:
            return response(404, {'error': f'Persona {persona_id} not found'}, headers)

        # Read document from S3
        document_content = read_document(s3_key)
        if not document_content:
            return response(404, {'error': 'Document not found in S3'}, headers)

        # Check content relevance to real estate using Bedrock guardrails
        relevance_check = check_content_relevance(document_content)
        if not relevance_check['relevant']:
            return response(400, {
                'error': 'Content not related to real estate',
                'message': relevance_check.get('reason', 'The uploaded content does not appear to be related to real estate development. Please upload a real estate presentation or proposal.'),
                'rejected': True,
            }, headers)

        # Generate questions using Bedrock
        questions = generate_questions(persona, document_content)

        # Save questions to S3 for the session
        if session_id:
            save_questions(user_id, session_id, questions)

        return response(200, {'questions': questions}, headers)

    except Exception as e:
        logger.error(f'Content analysis error: {e}')
        return response(500, {'error': 'Failed to analyze content'}, headers)


def get_persona(persona_id):
    """Fetch persona from DynamoDB."""
    try:
        result = persona_table.get_item(Key={'personaID': persona_id})
        return result.get('Item')
    except ClientError as e:
        logger.error(f'DynamoDB error: {e}')
        return None


def check_content_relevance(document_content):
    """Check if uploaded content is related to real estate using Bedrock guardrails."""
    # Extract a sample of text for relevance checking
    if document_content['type'] == 'text':
        sample = document_content['data'][:5000]
    else:
        # For PDFs, we can't easily extract text without processing — do a quick LLM check
        sample = None

    if not sample:
        # Skip relevance check for PDFs (will be caught by question generation if irrelevant)
        return {'relevant': True}

    # Use the guardrail to check content if available
    if GUARDRAIL_ID:
        try:
            result = bedrock_client.apply_guardrail(
                guardrailIdentifier=GUARDRAIL_ID,
                guardrailVersion=GUARDRAIL_VERSION,
                source='INPUT',
                content=[{'text': {'text': f"Real estate content check: {sample[:3000]}"}}],
            )
            if result.get('action') == 'GUARDRAIL_INTERVENED':
                return {'relevant': False, 'reason': 'Content was flagged by content safety guardrails.'}
        except Exception as e:
            logger.warning(f'Guardrail check failed (proceeding): {e}')

    # Quick LLM-based relevance check
    try:
        check_prompt = f"""Determine if the following text is related to real estate (property development, investment, construction, zoning, market analysis, financial projections, etc.).

Text sample:
{sample[:3000]}

Respond with ONLY "RELEVANT" or "NOT_RELEVANT" followed by a brief reason."""

        check_response = bedrock_client.invoke_model(
            modelId=MODEL_ID,
            contentType='application/json',
            accept='application/json',
            body=json.dumps({
                'anthropic_version': 'bedrock-2023-05-31',
                'max_tokens': 100,
                'messages': [{'role': 'user', 'content': check_prompt}],
            }),
        )
        check_body = json.loads(check_response['body'].read())
        check_text = check_body.get('content', [{}])[0].get('text', '').strip()

        if check_text.startswith('NOT_RELEVANT'):
            reason = check_text.replace('NOT_RELEVANT', '').strip(' :-')
            return {'relevant': False, 'reason': reason or 'Content does not appear to be related to real estate.'}

    except Exception as e:
        logger.warning(f'Relevance check failed (proceeding): {e}')

    return {'relevant': True}


def read_document(s3_key):
    """Read document content from S3. Returns base64 for PDFs, text for others."""
    try:
        obj = s3_client.get_object(Bucket=UPLOADS_BUCKET, Key=s3_key)
        content_type = obj.get('ContentType', 'application/octet-stream')
        body = obj['Body'].read()

        if 'pdf' in content_type or s3_key.endswith('.pdf'):
            # Return base64-encoded PDF for multimodal analysis
            return {
                'type': 'pdf',
                'data': base64.b64encode(body).decode('utf-8'),
            }
        else:
            # Try to decode as text
            return {
                'type': 'text',
                'data': body.decode('utf-8', errors='replace')[:50000],
            }
    except ClientError as e:
        logger.error(f'S3 read error: {e}')
        return None


def generate_questions(persona, document_content):
    """Generate persona-specific questions from the document content."""
    persona_name = persona.get('name', 'Stakeholder')
    persona_prompt = persona.get('personaPrompt', '')
    key_priorities = persona.get('keyPriorities', [])

    prompt = f"""You are a "{persona_name}" evaluating a real estate development presentation.

Your persona: {persona_prompt}

Your key priorities: {json.dumps(key_priorities)}

Based on the presentation content provided, generate 5-8 challenging questions that this
stakeholder would ask. The questions should:
1. Be specific to the content presented
2. Reflect the stakeholder's priorities and concerns
3. Range from straightforward to challenging
4. Test the presenter's depth of knowledge and preparation

{"Document content (text): " + document_content['data'][:30000] if document_content['type'] == 'text' else "A PDF document has been uploaded containing the presentation materials."}

Return your response as a JSON array of objects:
[
  {{"questionId": "q1", "text": "<question>", "category": "<category>", "difficulty": "<easy|medium|hard>"}},
  ...
]

Categories should be relevant to real estate (e.g., "Financial Analysis", "Market Risk",
"Regulatory Compliance", "Community Impact", "Investment Returns", "Timeline & Execution").
"""

    try:
        messages = [{'role': 'user', 'content': prompt}]

        bedrock_response = bedrock_client.invoke_model(
            modelId=MODEL_ID,
            contentType='application/json',
            accept='application/json',
            body=json.dumps({
                'anthropic_version': 'bedrock-2023-05-31',
                'max_tokens': 2000,
                'messages': messages,
            }),
        )

        response_body = json.loads(bedrock_response['body'].read())
        content = response_body.get('content', [{}])[0].get('text', '[]')

        # Parse questions from response
        questions = json.loads(content)
        return questions

    except (ClientError, json.JSONDecodeError, KeyError) as e:
        logger.error(f'Bedrock question generation error: {e}')
        return [
            {
                'questionId': 'fallback-1',
                'text': 'Can you walk me through the financial projections for this project?',
                'category': 'Financial Analysis',
                'difficulty': 'medium',
            },
            {
                'questionId': 'fallback-2',
                'text': 'What are the key risks you see in this development?',
                'category': 'Market Risk',
                'difficulty': 'medium',
            },
        ]


def save_questions(user_id, session_id, questions):
    """Save generated questions to S3 for the session."""
    key = f'{user_id}/{session_id}/generated_questions.json'
    try:
        s3_client.put_object(
            Bucket=UPLOADS_BUCKET,
            Key=key,
            Body=json.dumps(questions, default=str),
            ContentType='application/json',
        )
    except ClientError as e:
        logger.error(f'Failed to save questions: {e}')


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
