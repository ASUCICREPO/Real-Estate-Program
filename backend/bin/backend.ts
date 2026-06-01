#!/usr/bin/env node
import * as cdk from 'aws-cdk-lib';
import { RealEstateProgramStack } from '../lib/backend-stack';

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
// Backend Stack — Cognito, S3, DynamoDB, API Gateway, Lambdas
// ──────────────────────────────────────────────────────────
new RealEstateProgramStack(app, `RealEstateProgramStack-${branchName}`, {
  allowedOrigins: ['http://localhost:3000'],
});
