import { Construct } from 'constructs';
import * as path from 'path';
import * as cdk from 'aws-cdk-lib';
import * as cognito from 'aws-cdk-lib/aws-cognito';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as apigateway from 'aws-cdk-lib/aws-apigateway';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as bedrock from 'aws-cdk-lib/aws-bedrock';
import { Aspects } from 'aws-cdk-lib';
import { AwsSolutionsChecks, NagSuppressions } from 'cdk-nag';

export interface RealEstateProgramStackProps extends cdk.StackProps {
  /** CORS origins for S3 and API Gateway. */
  allowedOrigins: string[];
}

export class RealEstateProgramStack extends cdk.Stack {
  public readonly userPoolId: string;
  public readonly userPoolClientId: string;
  public readonly identityPoolId: string;
  public readonly apiUrl: string;

  public readonly userPool: cognito.UserPool;
  public readonly userPoolClient: cognito.UserPoolClient;
  public readonly authenticatedRole: iam.Role;
  public readonly personasTable: dynamodb.TableV2;
  public readonly uploadsBucket: s3.Bucket;
  public readonly guardrailId: string;
  public readonly guardrailVersion: string;
  public readonly guardrailArn: string;

  constructor(scope: Construct, id: string, props: RealEstateProgramStackProps) {
    super(scope, id, props);

    // cdk-nag security checks
    Aspects.of(this).add(new AwsSolutionsChecks({ verbose: true }));

    const allowedOrigins = props.allowedOrigins;

    // ──────────────────────────────────────────────
    // S3 bucket for uploads and session data
    // ──────────────────────────────────────────────
    const accessLogsBucket = new s3.Bucket(this, 'AccessLogsBucket', {
      enforceSSL: true,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      autoDeleteObjects: true,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
    });

    const uploadsBucket = new s3.Bucket(this, 'RealEstateUploads', {
      enforceSSL: true,
      serverAccessLogsBucket: accessLogsBucket,
      serverAccessLogsPrefix: 'uploads-access-logs/',
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      autoDeleteObjects: true,
      cors: [
        {
          allowedOrigins: allowedOrigins,
          allowedMethods: [s3.HttpMethods.GET, s3.HttpMethods.PUT, s3.HttpMethods.POST],
          allowedHeaders: ['*'],
          exposedHeaders: ['ETag'],
        },
      ],
      lifecycleRules: [
        {
          id: 'AbortIncompleteMultipartUploads',
          abortIncompleteMultipartUploadAfter: cdk.Duration.days(1),
        },
        {
          id: 'ExpireSessionFilesAfter30Days',
          expiration: cdk.Duration.days(30),
        },
      ],
    });

    // ──────────────────────────────────────────────
    // Cognito User Pool
    // ──────────────────────────────────────────────
    const userPool = new cognito.UserPool(this, 'UserPool', {
      selfSignUpEnabled: true,
      signInAliases: {
        email: true,
        username: false,
      },
      autoVerify: {
        email: true,
      },
      passwordPolicy: {
        minLength: 8,
        requireLowercase: true,
        requireUppercase: true,
        requireDigits: true,
        requireSymbols: true,
      },
      accountRecovery: cognito.AccountRecovery.EMAIL_ONLY,
      signInCaseSensitive: false,
    });

    const userPoolClient = new cognito.UserPoolClient(this, 'UserPoolClient', {
      userPool,
      authFlows: {
        userSrp: true,
        userPassword: true,
      },
      generateSecret: false,
      oAuth: {
        flows: {
          implicitCodeGrant: true,
        },
        scopes: [
          cognito.OAuthScope.OPENID,
          cognito.OAuthScope.EMAIL,
          cognito.OAuthScope.PROFILE,
        ],
      },
    });

    // ──────────────────────────────────────────────
    // Cognito Identity Pool
    // ──────────────────────────────────────────────
    const identityPool = new cognito.CfnIdentityPool(this, 'IdentityPool', {
      allowUnauthenticatedIdentities: false,
      cognitoIdentityProviders: [
        {
          clientId: userPoolClient.userPoolClientId,
          providerName: userPool.userPoolProviderName,
        },
      ],
    });

    // ──────────────────────────────────────────────
    // IAM Role for authenticated users
    // ──────────────────────────────────────────────
    const authenticatedRole = new iam.Role(this, 'CognitoAuthenticatedRole', {
      assumedBy: new iam.FederatedPrincipal(
        'cognito-identity.amazonaws.com',
        {
          StringEquals: {
            'cognito-identity.amazonaws.com:aud': identityPool.ref,
          },
          'ForAnyValue:StringLike': {
            'cognito-identity.amazonaws.com:amr': 'authenticated',
          },
        },
        'sts:AssumeRoleWithWebIdentity',
      ),
      description: 'Role assumed by authenticated Cognito Identity Pool users',
    });

    // Grant Transcribe streaming permissions for real-time speech-to-text
    authenticatedRole.addToPolicy(
      new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        actions: [
          'transcribe:StartStreamTranscriptionWebSocket',
          'transcribe:StartStreamTranscription',
        ],
        resources: ['*'],
      }),
    );

    // Attach role to Identity Pool
    new cognito.CfnIdentityPoolRoleAttachment(this, 'IdentityPoolRoleAttachment', {
      identityPoolId: identityPool.ref,
      roles: {
        authenticated: authenticatedRole.roleArn,
      },
    });

    // Admin group for faculty
    new cognito.CfnUserPoolGroup(this, 'AdminGroup', {
      groupName: 'Admin',
      userPoolId: userPool.userPoolId,
      description: 'Faculty administrators who can manage personas and system configuration.',
    });

    // ──────────────────────────────────────────────
    // DynamoDB: Personas Table
    // ──────────────────────────────────────────────
    const personasTable = new dynamodb.TableV2(this, 'PersonasTable', {
      partitionKey: {
        name: 'personaID',
        type: dynamodb.AttributeType.STRING,
      },
      billing: dynamodb.Billing.onDemand(),
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    // ──────────────────────────────────────────────
    // Lambda: Pre-signed S3 URLs
    // ──────────────────────────────────────────────
    const s3UrlLambda = new lambda.Function(this, 'S3UrlLambda', {
      runtime: lambda.Runtime.PYTHON_3_13,
      handler: 'index.lambda_handler',
      code: lambda.Code.fromAsset(path.join(__dirname, '..', 'lambda', 's3-presigned-url-gen')),
      timeout: cdk.Duration.seconds(20),
      role: new iam.Role(this, 'S3UrlLambdaRole', {
        assumedBy: new iam.ServicePrincipal('lambda.amazonaws.com'),
        managedPolicies: [
          iam.ManagedPolicy.fromAwsManagedPolicyName('service-role/AWSLambdaBasicExecutionRole'),
        ],
      }),
      environment: {
        'UPLOADS_BUCKET': uploadsBucket.bucketName,
        'PDF_UPLOAD_TIMEOUT': '120',
        'PRESENTATION_TIMEOUT': '1200',
        'JSON_UPLOAD_TIMEOUT': '60',
        'MULTIPART_PART_URL_TIMEOUT': '300',
        'ALLOWED_ORIGINS': cdk.Fn.join(',', allowedOrigins),
      },
    });

    uploadsBucket.grantReadWrite(s3UrlLambda);

    // ──────────────────────────────────────────────
    // Lambda: Persona CRUD
    // ──────────────────────────────────────────────
    const personaCrudLambda = new lambda.Function(this, 'PersonaCrudLambda', {
      runtime: lambda.Runtime.PYTHON_3_13,
      handler: 'index.lambda_handler',
      code: lambda.Code.fromAsset(path.join(__dirname, '..', 'lambda', 'persona-crud')),
      timeout: cdk.Duration.seconds(20),
      role: new iam.Role(this, 'PersonaCrudLambdaRole', {
        assumedBy: new iam.ServicePrincipal('lambda.amazonaws.com'),
        managedPolicies: [
          iam.ManagedPolicy.fromAwsManagedPolicyName('service-role/AWSLambdaBasicExecutionRole'),
        ],
      }),
      environment: {
        'PERSONA_TABLE_NAME': personasTable.tableName,
        'MAX_ITEMS_PER_PAGE': '20',
        'ALLOWED_ORIGINS': cdk.Fn.join(',', allowedOrigins),
      },
    });

    personasTable.grantReadWriteData(personaCrudLambda);

    // ──────────────────────────────────────────────
    // Lambda: Post Meeting Analytics
    // ──────────────────────────────────────────────
    const boto3Layer = new lambda.LayerVersion(this, 'Boto3LatestLayer', {
      code: lambda.Code.fromAsset(path.join(__dirname, '..', 'lambda', 'layers', 'boto3-latest'), {
        bundling: {
          image: lambda.Runtime.PYTHON_3_13.bundlingImage,
          command: [
            'bash', '-c',
            'pip install -r requirements.txt -t /asset-output/python && cp -au . /asset-output/',
          ],
          local: {
            tryBundle(outputDir: string) {
              try {
                const { execSync } = require('child_process');
                execSync('pip3 --version');
                execSync(
                  `pip3 install -r ${path.join(__dirname, '..', 'lambda', 'layers', 'boto3-latest', 'requirements.txt')} -t ${path.join(outputDir, 'python')}`,
                  { stdio: 'inherit' },
                );
                return true;
              } catch {
                return false;
              }
            },
          },
        },
      }),
      compatibleRuntimes: [lambda.Runtime.PYTHON_3_13],
      description: 'Latest boto3/botocore for Bedrock structured outputs support',
    });

    const postMeetingAnalyticsLambda = new lambda.Function(this, 'PostMeetingAnalyticsLambda', {
      runtime: lambda.Runtime.PYTHON_3_13,
      handler: 'index.lambda_handler',
      code: lambda.Code.fromAsset(path.join(__dirname, '..', 'lambda', 'post-meeting-analytics')),
      timeout: cdk.Duration.seconds(120),
      layers: [boto3Layer],
      role: new iam.Role(this, 'PostMeetingAnalyticsLambdaRole', {
        assumedBy: new iam.ServicePrincipal('lambda.amazonaws.com'),
        managedPolicies: [
          iam.ManagedPolicy.fromAwsManagedPolicyName('service-role/AWSLambdaBasicExecutionRole'),
        ],
      }),
      environment: {
        'UPLOADS_BUCKET': uploadsBucket.bucketName,
        'PERSONA_TABLE_NAME': personasTable.tableName,
        'ALLOWED_ORIGINS': cdk.Fn.join(',', allowedOrigins),
      },
    });

    uploadsBucket.grantReadWrite(postMeetingAnalyticsLambda);
    personasTable.grantReadData(postMeetingAnalyticsLambda);

    postMeetingAnalyticsLambda.addToRolePolicy(new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: ['bedrock:InvokeModel'],
      resources: [
        'arn:aws:bedrock:*::foundation-model/*',
        `arn:aws:bedrock:*:${this.account}:inference-profile/*`,
      ],
    }));

    // ──────────────────────────────────────────────
    // Lambda: Content Analysis & Question Generation
    // ──────────────────────────────────────────────
    const contentAnalysisLambda = new lambda.Function(this, 'ContentAnalysisLambda', {
      runtime: lambda.Runtime.PYTHON_3_13,
      handler: 'index.lambda_handler',
      code: lambda.Code.fromAsset(path.join(__dirname, '..', 'lambda', 'content-analysis')),
      timeout: cdk.Duration.seconds(120),
      layers: [boto3Layer],
      role: new iam.Role(this, 'ContentAnalysisLambdaRole', {
        assumedBy: new iam.ServicePrincipal('lambda.amazonaws.com'),
        managedPolicies: [
          iam.ManagedPolicy.fromAwsManagedPolicyName('service-role/AWSLambdaBasicExecutionRole'),
        ],
      }),
      environment: {
        'UPLOADS_BUCKET': uploadsBucket.bucketName,
        'PERSONA_TABLE_NAME': personasTable.tableName,
        'ALLOWED_ORIGINS': cdk.Fn.join(',', allowedOrigins),
      },
    });

    uploadsBucket.grantRead(contentAnalysisLambda);
    personasTable.grantReadData(contentAnalysisLambda);

    contentAnalysisLambda.addToRolePolicy(new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: ['bedrock:InvokeModel'],
      resources: [
        'arn:aws:bedrock:*::foundation-model/*',
        `arn:aws:bedrock:*:${this.account}:inference-profile/*`,
      ],
    }));

    // ──────────────────────────────────────────────
    // Bedrock Guardrail
    // ──────────────────────────────────────────────
    const suffix = cdk.Names.uniqueId(this).slice(-8);

    const guardrail = new bedrock.CfnGuardrail(this, 'ContentGuardrail', {
      name: `RealEstateGuardrail-${suffix}`,
      description: 'Content safety guardrail for AI interactions — filters harmful content, PII, and prompt injection.',
      blockedInputMessaging: 'Your input was flagged by our safety filters. Please rephrase and try again.',
      blockedOutputsMessaging: 'The AI response was blocked by safety filters. Please modify your request.',
      contentPolicyConfig: {
        filtersConfig: [
          { type: 'HATE', inputStrength: 'HIGH', outputStrength: 'HIGH' },
          { type: 'INSULTS', inputStrength: 'HIGH', outputStrength: 'HIGH' },
          { type: 'SEXUAL', inputStrength: 'HIGH', outputStrength: 'HIGH' },
          { type: 'VIOLENCE', inputStrength: 'HIGH', outputStrength: 'HIGH' },
          { type: 'MISCONDUCT', inputStrength: 'HIGH', outputStrength: 'HIGH' },
          { type: 'PROMPT_ATTACK', inputStrength: 'HIGH', outputStrength: 'NONE' },
        ],
      },
      sensitiveInformationPolicyConfig: {
        piiEntitiesConfig: [
          { type: 'EMAIL', action: 'ANONYMIZE' },
          { type: 'PHONE', action: 'ANONYMIZE' },
          { type: 'CREDIT_DEBIT_CARD_NUMBER', action: 'BLOCK' },
          { type: 'US_SOCIAL_SECURITY_NUMBER', action: 'BLOCK' },
          { type: 'ADDRESS', action: 'ANONYMIZE' },
          { type: 'NAME', action: 'ANONYMIZE' },
        ],
      },
    });

    const guardrailVersion = new bedrock.CfnGuardrailVersion(this, 'ContentGuardrailVersion', {
      guardrailIdentifier: guardrail.attrGuardrailId,
      description: 'Initial version',
    });

    // Pass guardrail IDs to lambdas that call Bedrock
    s3UrlLambda.addEnvironment('GUARDRAIL_ID', guardrail.attrGuardrailId);
    s3UrlLambda.addEnvironment('GUARDRAIL_VERSION', guardrailVersion.attrVersion);
    s3UrlLambda.addToRolePolicy(new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: ['bedrock:ApplyGuardrail'],
      resources: [guardrail.attrGuardrailArn],
    }));

    // ──────────────────────────────────────────────
    // API Gateway
    // ──────────────────────────────────────────────
    const apiGatewayLogRole = new iam.Role(this, 'ApiGatewayCloudWatchRole', {
      assumedBy: new iam.ServicePrincipal('apigateway.amazonaws.com'),
      managedPolicies: [
        iam.ManagedPolicy.fromAwsManagedPolicyName('service-role/AmazonAPIGatewayPushToCloudWatchLogs'),
      ],
    });

    const apiGatewayAccount = new apigateway.CfnAccount(this, 'ApiGatewayAccount', {
      cloudWatchRoleArn: apiGatewayLogRole.roleArn,
    });

    const apiLogGroup = new cdk.aws_logs.LogGroup(this, 'ApiGatewayAccessLogs', {
      retention: cdk.aws_logs.RetentionDays.ONE_MONTH,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    const api = new apigateway.LambdaRestApi(this, 'RealEstateApi', {
      handler: s3UrlLambda,
      proxy: false,
      deployOptions: {
        accessLogDestination: new apigateway.LogGroupLogDestination(apiLogGroup),
        accessLogFormat: apigateway.AccessLogFormat.jsonWithStandardFields(),
        loggingLevel: apigateway.MethodLoggingLevel.INFO,
      },
      defaultCorsPreflightOptions: {
        allowOrigins: allowedOrigins,
        allowMethods: apigateway.Cors.ALL_METHODS,
        allowHeaders: ['Content-Type', 'Authorization'],
      },
    });

    api.deploymentStage.node.addDependency(apiGatewayAccount);

    // CORS on error responses
    const gatewayResponseOrigin = cdk.Fn.join('', ["'", cdk.Fn.select(0, allowedOrigins), "'"]);
    api.addGatewayResponse('Default4XX', {
      type: apigateway.ResponseType.DEFAULT_4XX,
      responseHeaders: {
        'Access-Control-Allow-Origin': gatewayResponseOrigin,
        'Access-Control-Allow-Headers': "'Content-Type,Authorization'",
        'Access-Control-Allow-Methods': "'GET,POST,PUT,DELETE,OPTIONS'",
      },
    });
    api.addGatewayResponse('Default5XX', {
      type: apigateway.ResponseType.DEFAULT_5XX,
      responseHeaders: {
        'Access-Control-Allow-Origin': gatewayResponseOrigin,
        'Access-Control-Allow-Headers': "'Content-Type,Authorization'",
        'Access-Control-Allow-Methods': "'GET,POST,PUT,DELETE,OPTIONS'",
      },
    });

    // Cognito Authorizer
    const authorizer = new apigateway.CognitoUserPoolsAuthorizer(this, 'CognitoAuthorizer', {
      cognitoUserPools: [userPool],
    });

    // --- API Routes ---

    // /s3_urls
    const s3UrlsResource = api.root.addResource('s3_urls');
    s3UrlsResource.addMethod('GET', new apigateway.LambdaIntegration(s3UrlLambda), {
      authorizer,
      authorizationType: apigateway.AuthorizationType.COGNITO,
    });
    s3UrlsResource.addMethod('POST', new apigateway.LambdaIntegration(s3UrlLambda), {
      authorizer,
      authorizationType: apigateway.AuthorizationType.COGNITO,
    });

    // /personas
    const personasResource = api.root.addResource('personas');
    personasResource.addMethod('GET', new apigateway.LambdaIntegration(personaCrudLambda), {
      authorizer,
      authorizationType: apigateway.AuthorizationType.COGNITO,
    });
    personasResource.addMethod('POST', new apigateway.LambdaIntegration(personaCrudLambda), {
      authorizer,
      authorizationType: apigateway.AuthorizationType.COGNITO,
    });

    const personaIdResource = personasResource.addResource('{personaID}');
    personaIdResource.addMethod('GET', new apigateway.LambdaIntegration(personaCrudLambda), {
      authorizer,
      authorizationType: apigateway.AuthorizationType.COGNITO,
    });
    personaIdResource.addMethod('PUT', new apigateway.LambdaIntegration(personaCrudLambda), {
      authorizer,
      authorizationType: apigateway.AuthorizationType.COGNITO,
    });
    personaIdResource.addMethod('DELETE', new apigateway.LambdaIntegration(personaCrudLambda), {
      authorizer,
      authorizationType: apigateway.AuthorizationType.COGNITO,
    });

    // /analytics
    const analyticsResource = api.root.addResource('analytics');
    analyticsResource.addMethod('GET', new apigateway.LambdaIntegration(postMeetingAnalyticsLambda), {
      authorizer,
      authorizationType: apigateway.AuthorizationType.COGNITO,
    });

    // /content
    const contentResource = api.root.addResource('content');
    contentResource.addMethod('POST', new apigateway.LambdaIntegration(contentAnalysisLambda), {
      authorizer,
      authorizationType: apigateway.AuthorizationType.COGNITO,
    });

    // ──────────────────────────────────────────────
    // Expose values for cross-stack references
    // ──────────────────────────────────────────────
    this.userPoolId = userPool.userPoolId;
    this.userPoolClientId = userPoolClient.userPoolClientId;
    this.identityPoolId = identityPool.ref;
    this.apiUrl = api.url;
    this.userPool = userPool;
    this.userPoolClient = userPoolClient;
    this.authenticatedRole = authenticatedRole;
    this.personasTable = personasTable;
    this.uploadsBucket = uploadsBucket;
    this.guardrailId = guardrail.attrGuardrailId;
    this.guardrailVersion = guardrailVersion.attrVersion;
    this.guardrailArn = guardrail.attrGuardrailArn;

    // ──────────────────────────────────────────────
    // Stack Outputs
    // ──────────────────────────────────────────────
    new cdk.CfnOutput(this, 'UserPoolId', { value: userPool.userPoolId });
    new cdk.CfnOutput(this, 'UserPoolClientId', { value: userPoolClient.userPoolClientId });
    new cdk.CfnOutput(this, 'IdentityPoolId', { value: identityPool.ref });
    new cdk.CfnOutput(this, 'Region', { value: this.region });
    new cdk.CfnOutput(this, 'ApiUrl', { value: api.url });
    new cdk.CfnOutput(this, 'UploadsBucketName', { value: uploadsBucket.bucketName });
    new cdk.CfnOutput(this, 'PersonasTableName', { value: personasTable.tableName });

    // ──────────────────────────────────────────────
    // cdk-nag suppressions
    // ──────────────────────────────────────────────
    NagSuppressions.addResourceSuppressions(s3UrlLambda.role!, [
      { id: 'AwsSolutions-IAM4', reason: 'AWSLambdaBasicExecutionRole is required for CloudWatch Logs.' },
      { id: 'AwsSolutions-IAM5', reason: 'S3 wildcard actions generated by CDK grantReadWrite(), scoped to uploads bucket.' },
    ], true);
    NagSuppressions.addResourceSuppressions(personaCrudLambda.role!, [
      { id: 'AwsSolutions-IAM4', reason: 'AWSLambdaBasicExecutionRole is required for CloudWatch Logs.' },
      { id: 'AwsSolutions-IAM5', reason: 'DynamoDB wildcard actions generated by CDK grantReadWriteData().' },
    ], true);
    NagSuppressions.addResourceSuppressions(postMeetingAnalyticsLambda.role!, [
      { id: 'AwsSolutions-IAM4', reason: 'AWSLambdaBasicExecutionRole is required for CloudWatch Logs.' },
      { id: 'AwsSolutions-IAM5', reason: 'Bedrock and S3 wildcards required for model access and session data.' },
    ], true);
    NagSuppressions.addResourceSuppressions(contentAnalysisLambda.role!, [
      { id: 'AwsSolutions-IAM4', reason: 'AWSLambdaBasicExecutionRole is required for CloudWatch Logs.' },
      { id: 'AwsSolutions-IAM5', reason: 'Bedrock and S3 wildcards required for model access and content reading.' },
    ], true);
    NagSuppressions.addResourceSuppressions(apiGatewayLogRole, [
      { id: 'AwsSolutions-IAM4', reason: 'AmazonAPIGatewayPushToCloudWatchLogs is AWS-required for API Gateway logging.' },
    ]);
    NagSuppressions.addResourceSuppressions(authenticatedRole, [
      { id: 'AwsSolutions-IAM5', reason: 'Transcribe streaming APIs do not support resource-level ARNs.' },
    ], true);
    NagSuppressions.addResourceSuppressions(userPool, [
      { id: 'AwsSolutions-COG2', reason: 'MFA not required for student-facing tool to reduce onboarding friction.' },
      { id: 'AwsSolutions-COG3', reason: 'Threat Protection requires PLUS tier — not needed for POC.' },
      { id: 'AwsSolutions-COG8', reason: 'Plus tier not required for POC — ESSENTIALS tier sufficient for student-facing tool.' },
    ]);
    NagSuppressions.addResourceSuppressions(api, [
      { id: 'AwsSolutions-APIG2', reason: 'Request validation handled in Lambda handlers.' },
    ]);
    NagSuppressions.addResourceSuppressions(api.deploymentStage, [
      { id: 'AwsSolutions-APIG3', reason: 'WAFv2 not attached — POC scope, not production.' },
    ]);
    NagSuppressions.addStackSuppressions(this, [
      { id: 'AwsSolutions-L1', reason: 'Python 3.13 is the latest stable Lambda runtime.' },
      { id: 'AwsSolutions-IAM5', reason: 'POC: Auto-delete objects custom resource requires wildcard permissions.' },
      { id: 'AwsSolutions-IAM4', reason: 'POC: Auto-delete objects custom resource uses AWS managed policy.' },
    ]);
  }
}
