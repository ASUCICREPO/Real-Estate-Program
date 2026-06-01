#!/usr/bin/env node
import * as cdk from 'aws-cdk-lib';
import { RealEstateProgramStack } from '../lib/backend-stack';
import { AgentCoreStack } from '../lib/agentcore-stack';

const app = new cdk.App();

// ──────────────────────────────────────────────────────────
// Configuration
// ──────────────────────────────────────────────────────────

function requireContext(key: string): string {
  const value = app.node.tryGetContext(key);
  if (!value) {
    throw new Error(`Missing required context: -c ${key}=<value>`);
  }
  return value as string;
}

const branchName = requireContext('branchName');

// ──────────────────────────────────────────────────────────
// 1. Backend Stack — Cognito, S3, DynamoDB, API Gateway, Lambdas
// ──────────────────────────────────────────────────────────
const backend = new RealEstateProgramStack(app, `RealEstateProgramStack-${branchName}`, {
  allowedOrigins: ['http://localhost:3000'],
});

// ──────────────────────────────────────────────────────────
// 2. AgentCore Stack — Live Q&A & Negotiation voice agent
// ──────────────────────────────────────────────────────────
const agentCore = new AgentCoreStack(app, `AgentCoreStack-${branchName}`, {
  description: `Live Q&A AgentCore runtime for ${branchName}`,
  userPool: backend.userPool,
  userPoolClient: backend.userPoolClient,
  authenticatedRole: backend.authenticatedRole,
  personasTable: backend.personasTable,
  uploadsBucket: backend.uploadsBucket,
  guardrailId: backend.guardrailId,
  guardrailVersion: backend.guardrailVersion,
  guardrailArn: backend.guardrailArn,
});
