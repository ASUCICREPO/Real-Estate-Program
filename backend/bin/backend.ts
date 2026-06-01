#!/usr/bin/env node
import * as cdk from 'aws-cdk-lib';
import { RealEstateProgramStack } from '../lib/backend-stack';
import { AgentCoreStack } from '../lib/agentcore-stack';
import { AmplifyHostingStack } from '../lib/amplify-hosting-stack';
import { FrontendConfigStack } from '../lib/frontend-config-stack';

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

// Optional GitHub CI/CD mode
const githubOwner = app.node.tryGetContext('githubOwner') as string | undefined;
const githubRepo = app.node.tryGetContext('githubRepo') as string | undefined;
const githubToken = app.node.tryGetContext('githubToken') as string | undefined;
const useGitHub = !!(githubOwner && githubRepo && githubToken);

// ──────────────────────────────────────────────────────────
// 1. Amplify Hosting — creates Amplify App, gets appId + domain
// ──────────────────────────────────────────────────────────
const amplifyHosting = new AmplifyHostingStack(app, `AmplifyHostingStack-${branchName}`, {
  description: `Amplify App for ${branchName}`,
  branchName,
  githubOwner,
  githubRepo,
  githubToken,
});

// ──────────────────────────────────────────────────────────
// 2. Backend Stack — Cognito, S3, DynamoDB, API Gateway, Lambdas
// ──────────────────────────────────────────────────────────
const amplifyAppUrl = cdk.Fn.join('', [
  'https://',
  branchName,
  '.',
  amplifyHosting.defaultDomain,
]);

const backend = new RealEstateProgramStack(app, `RealEstateProgramStack-${branchName}`, {
  allowedOrigins: ['http://localhost:3000', amplifyAppUrl],
});

// ──────────────────────────────────────────────────────────
// 3. AgentCore Stack — Live Q&A & Negotiation voice agent
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

// ──────────────────────────────────────────────────────────
// 4. Frontend Config — adds branch + env vars to Amplify App
// ──────────────────────────────────────────────────────────
new FrontendConfigStack(app, `FrontendConfigStack-${branchName}`, {
  description: `Frontend branch config for ${branchName}`,
  amplifyAppId: amplifyHosting.appId,
  amplifyDefaultDomain: amplifyHosting.defaultDomain,
  branchName,
  useGitHub,
  apiUrl: backend.apiUrl,
  userPoolId: backend.userPoolId,
  userPoolClientId: backend.userPoolClientId,
  identityPoolId: backend.identityPoolId,
  agentCoreWebSocketUrl: agentCore.webSocketUrl,
});
