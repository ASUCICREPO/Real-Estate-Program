import { Construct } from 'constructs';
import * as path from 'path';
import * as crypto from 'crypto';
import * as cdk from 'aws-cdk-lib';
import * as cognito from 'aws-cdk-lib/aws-cognito';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as ecrAssets from 'aws-cdk-lib/aws-ecr-assets';
import * as bedrockl1 from 'aws-cdk-lib/aws-bedrock';
import { NagSuppressions } from 'cdk-nag';
import * as agentcore from '@aws-cdk/aws-bedrock-agentcore-alpha';

export interface AgentCoreStackProps extends cdk.StackProps {
    userPool: cognito.UserPool;
    userPoolClient: cognito.UserPoolClient;
    authenticatedRole: iam.Role;
    personasTable: dynamodb.TableV2;
    uploadsBucket: s3.Bucket;
    guardrailId: string;
    guardrailVersion: string;
    guardrailArn: string;
}

export class AgentCoreStack extends cdk.Stack {
    public readonly webSocketUrl: string;

    constructor(scope: Construct, id: string, props: AgentCoreStackProps) {
        super(scope, id, props);

        // ── AgentCore Docker image ──────────────────────────────────────
        const agentCoreImage = new ecrAssets.DockerImageAsset(this, 'AgentCoreImage', {
            directory: path.join(__dirname, '..', 'agentcore'),
            platform: ecrAssets.Platform.LINUX_ARM64,
        });

        // ── AgentCore Runtime ───────────────────────────────────────────
        const agentCoreRuntime: agentcore.Runtime = new agentcore.Runtime(this, 'LiveQAAgentRuntime', {
            description: 'Bidirectional voice agent for real estate Q&A and negotiation sessions',
            agentRuntimeArtifact: agentcore.AgentRuntimeArtifact.fromEcrRepository(
                agentCoreImage.repository,
                agentCoreImage.imageTag,
            ),
            authorizerConfiguration: agentcore.RuntimeAuthorizerConfiguration.usingIAM(),
            environmentVariables: {
                'VOICE_ID': 'matthew',
                'MODEL_ID': 'amazon.nova-2-sonic-v1:0',
                'QA_ANALYTICS_MODEL_ID': 'global.amazon.nova-2-lite-v1:0',
                'PERSONA_TABLE_NAME': props.personasTable.tableName,
                'UPLOADS_BUCKET': props.uploadsBucket.bucketName,
                'AGENT_RUNTIME_NAME': cdk.Lazy.string({
                    produce: () => agentCoreRuntime.agentRuntimeName,
                }),
                'BEDROCK_GUARDRAIL_ID': '',
                'BEDROCK_GUARDRAIL_VERSION': '',
                'GUARDRAIL_DISABLED': 'true',
            },
            lifecycleConfiguration: {
                idleRuntimeSessionTimeout: cdk.Duration.minutes(10),
                maxLifetime: cdk.Duration.hours(1),
            },
        });

        // Grant permissions
        props.personasTable.grantReadData(agentCoreRuntime);
        props.uploadsBucket.grantReadWrite(agentCoreRuntime);

        agentCoreRuntime.addToRolePolicy(new iam.PolicyStatement({
            effect: iam.Effect.ALLOW,
            actions: ['bedrock:InvokeModel', 'bedrock:InvokeModelWithResponseStream', 'bedrock:ApplyGuardrail'],
            resources: [
                'arn:aws:bedrock:*::foundation-model/amazon.nova-2-sonic-v1:0',
                'arn:aws:bedrock:*::foundation-model/*',
                `arn:aws:bedrock:*:${this.account}:inference-profile/*`,
                props.guardrailArn,
            ],
        }));

        agentCoreRuntime.addToRolePolicy(new iam.PolicyStatement({
            effect: iam.Effect.ALLOW,
            actions: ['bedrock:Converse'],
            resources: [
                'arn:aws:bedrock:*::foundation-model/*',
                `arn:aws:bedrock:*:${this.account}:inference-profile/*`,
            ],
        }));

        // Grant authenticated users permission to invoke the AgentCore WebSocket
        const authRolePolicy = new iam.CfnManagedPolicy(this, 'AuthRoleAgentCorePolicy', {
            managedPolicyName: `AgentCoreInvokeWebSocket-${this.stackName}`,
            policyDocument: {
                Version: '2012-10-17',
                Statement: [{
                    Effect: 'Allow',
                    Action: ['bedrock-agentcore:InvokeAgentRuntimeWithWebSocketStream'],
                    Resource: [
                        agentCoreRuntime.agentRuntimeArn,
                        cdk.Fn.join('', [agentCoreRuntime.agentRuntimeArn, '/*']),
                    ],
                }],
            },
            roles: [props.authenticatedRole.roleName],
        });

        this.webSocketUrl = `wss://bedrock-agentcore.${this.region}.amazonaws.com/runtimes/${agentCoreRuntime.agentRuntimeArn}/ws`;

        // ── Stack Outputs ───────────────────────────────────────────────
        new cdk.CfnOutput(this, 'AgentCoreRuntimeArn', {
            value: agentCoreRuntime.agentRuntimeArn,
            description: 'AgentCore Runtime ARN',
        });
        new cdk.CfnOutput(this, 'AgentCoreWebSocketUrl', {
            value: this.webSocketUrl,
            description: 'WebSocket URL for Q&A sessions',
        });

        // ── cdk-nag suppressions ────────────────────────────────────────
        NagSuppressions.addResourceSuppressions(agentCoreRuntime.role, [
            { id: 'AwsSolutions-IAM5', reason: 'AgentCore requires wildcard for CloudWatch log groups, ECR, and workload identity.' },
        ], true);
        NagSuppressions.addResourceSuppressionsByPath(this, `${this.stackName}/AuthRoleAgentCorePolicy`, [
            { id: 'AwsSolutions-IAM5', reason: 'AgentCore WebSocket invocation requires wildcard for runtime endpoint sub-resources.' },
        ]);
        NagSuppressions.addStackSuppressions(this, [
            { id: 'AwsSolutions-IAM4', reason: 'AgentCore managed policies required for container execution.' },
            { id: 'AwsSolutions-IAM5', reason: 'AgentCore requires wildcards for S3, DynamoDB, and Bedrock access.' },
        ]);
    }
}
