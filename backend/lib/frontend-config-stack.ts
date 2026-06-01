import { Construct } from 'constructs';
import * as cdk from 'aws-cdk-lib';
import * as amplify_cfn from 'aws-cdk-lib/aws-amplify';
import { AwsCustomResource, AwsCustomResourcePolicy, PhysicalResourceId } from 'aws-cdk-lib/custom-resources';
import { NagSuppressions } from 'cdk-nag';

export interface FrontendConfigStackProps extends cdk.StackProps {
    amplifyAppId: string;
    amplifyDefaultDomain: string;
    branchName: string;
    useGitHub: boolean;
    apiUrl: string;
    userPoolId: string;
    userPoolClientId: string;
    identityPoolId: string;
    agentCoreWebSocketUrl: string;
}

export class FrontendConfigStack extends cdk.Stack {
    constructor(scope: Construct, id: string, props: FrontendConfigStackProps) {
        super(scope, id, props);

        const {
            amplifyAppId,
            amplifyDefaultDomain,
            branchName,
            useGitHub,
            apiUrl,
            userPoolId,
            userPoolClientId,
            identityPoolId,
            agentCoreWebSocketUrl,
        } = props;

        const envVars: amplify_cfn.CfnBranch.EnvironmentVariableProperty[] = useGitHub
            ? [
                { name: 'NEXT_PUBLIC_API_BASE_URL', value: apiUrl },
                { name: 'NEXT_PUBLIC_COGNITO_USER_POOL_ID', value: userPoolId },
                { name: 'NEXT_PUBLIC_COGNITO_USER_POOL_CLIENT_ID', value: userPoolClientId },
                { name: 'NEXT_PUBLIC_COGNITO_IDENTITY_POOL_ID', value: identityPoolId },
                { name: 'NEXT_PUBLIC_COGNITO_REGION', value: cdk.Stack.of(this).region },
                { name: 'NEXT_PUBLIC_WEBSOCKET_API_URL', value: agentCoreWebSocketUrl },
            ]
            : [];

        const branch = new amplify_cfn.CfnBranch(this, 'Branch', {
            appId: amplifyAppId,
            branchName,
            stage: 'PRODUCTION',
            enableAutoBuild: useGitHub,
            ...(envVars.length > 0 && { environmentVariables: envVars }),
        });

        if (useGitHub) {
            const trigger = new AwsCustomResource(this, 'TriggerAmplifyBuild', {
                onCreate: {
                    service: 'Amplify',
                    action: 'startJob',
                    parameters: { appId: amplifyAppId, branchName, jobType: 'RELEASE' },
                    physicalResourceId: PhysicalResourceId.of(`${amplifyAppId}-${branchName}-initial`),
                },
                policy: AwsCustomResourcePolicy.fromSdkCalls({
                    resources: [
                        `arn:aws:amplify:${this.region}:${this.account}:apps/${amplifyAppId}`,
                        `arn:aws:amplify:${this.region}:${this.account}:apps/${amplifyAppId}/branches/${branchName}/jobs/*`,
                    ],
                }),
            });
            trigger.node.addDependency(branch);

            const stackName = this.stackName;
            NagSuppressions.addResourceSuppressionsByPath(this, `/${stackName}/TriggerAmplifyBuild/CustomResourcePolicy/Resource`, [
                { id: 'AwsSolutions-IAM5', reason: 'Amplify startJob creates dynamic job IDs — wildcard on jobs/* is narrowest scope.' },
            ]);
            NagSuppressions.addResourceSuppressionsByPath(this, `/${stackName}/AWS679f53fac002430cb0da5b7982bd2287/ServiceRole/Resource`, [
                { id: 'AwsSolutions-IAM4', reason: 'CDK AwsCustomResource internal Lambda uses AWS managed policy.' },
            ], true);
            NagSuppressions.addResourceSuppressionsByPath(this, `/${stackName}/AWS679f53fac002430cb0da5b7982bd2287/Resource`, [
                { id: 'AwsSolutions-L1', reason: 'CDK AwsCustomResource Lambda runtime managed internally.' },
            ]);
        }

        new cdk.CfnOutput(this, 'AmplifyAppUrl', {
            value: `https://${branchName}.${amplifyDefaultDomain}`,
            description: `Amplify frontend URL (${branchName})`,
        });
    }
}
