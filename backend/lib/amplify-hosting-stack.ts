import { Construct } from 'constructs';
import * as cdk from 'aws-cdk-lib';
import * as codebuild from 'aws-cdk-lib/aws-codebuild';
import * as secretsmanager from 'aws-cdk-lib/aws-secretsmanager';
import * as amplify from '@aws-cdk/aws-amplify-alpha';
import { NagSuppressions } from 'cdk-nag';

export interface AmplifyHostingStackProps extends cdk.StackProps {
    branchName: string;
    githubOwner?: string;
    githubRepo?: string;
    githubToken?: string;
}

export class AmplifyHostingStack extends cdk.Stack {
    public readonly appId: string;
    public readonly defaultDomain: string;

    constructor(scope: Construct, id: string, props: AmplifyHostingStackProps) {
        super(scope, id, props);

        const { branchName, githubOwner, githubRepo, githubToken } = props;
        const useGitHub = !!(githubOwner && githubRepo && githubToken);

        let amplifyApp: amplify.App;

        if (useGitHub) {
            const githubTokenSecret = new secretsmanager.Secret(this, 'GitHubToken', {
                description: 'GitHub Personal Access Token for Amplify',
                secretStringValue: cdk.SecretValue.unsafePlainText(githubToken!),
            });

            NagSuppressions.addResourceSuppressions(githubTokenSecret, [
                { id: 'AwsSolutions-SMG4', reason: 'GitHub PATs cannot be auto-rotated by Secrets Manager.' },
            ]);

            amplifyApp = new amplify.App(this, 'FrontendApp', {
                appName: `real-estate-program-${branchName}`,
                description: `Real Estate Program frontend (${branchName})`,
                platform: amplify.Platform.WEB,
                sourceCodeProvider: new amplify.GitHubSourceCodeProvider({
                    owner: githubOwner!,
                    repository: githubRepo!,
                    oauthToken: githubTokenSecret.secretValue,
                }),
                customRules: [
                    // Serve static files directly (JS, CSS, images, etc.)
                    { source: '/<*>.js', target: '/<*>.js', status: amplify.RedirectStatus.REWRITE },
                    { source: '/<*>.css', target: '/<*>.css', status: amplify.RedirectStatus.REWRITE },
                    { source: '/<*>.png', target: '/<*>.png', status: amplify.RedirectStatus.REWRITE },
                    { source: '/<*>.ico', target: '/<*>.ico', status: amplify.RedirectStatus.REWRITE },
                    { source: '/<*>.woff2', target: '/<*>.woff2', status: amplify.RedirectStatus.REWRITE },
                    // SPA fallback — all other routes serve index.html
                    { source: '</^[^.]+$|\.(?!(js|css|png|ico|woff2|json|txt|map)$)([^.]+$)/>', target: '/index.html', status: amplify.RedirectStatus.REWRITE },
                ],
                buildSpec: codebuild.BuildSpec.fromObjectToYaml({
                    version: '1.0',
                    applications: [
                        {
                            appRoot: 'frontend',
                            frontend: {
                                phases: {
                                    preBuild: { commands: ['npm ci'] },
                                    build: { commands: ['npm run build'] },
                                },
                                artifacts: {
                                    baseDirectory: 'out',
                                    files: ['**/*'],
                                },
                                cache: {
                                    paths: ['node_modules/**/*', '.next/cache/**/*'],
                                },
                            },
                        },
                    ],
                }),
            });
        } else {
            amplifyApp = new amplify.App(this, 'FrontendApp', {
                appName: `real-estate-program-${branchName}`,
                description: `Real Estate Program frontend (${branchName}) — manual deploy`,
                platform: amplify.Platform.WEB,
                customRules: [
                    // Serve static files directly (JS, CSS, images, etc.)
                    { source: '/<*>.js', target: '/<*>.js', status: amplify.RedirectStatus.REWRITE },
                    { source: '/<*>.css', target: '/<*>.css', status: amplify.RedirectStatus.REWRITE },
                    { source: '/<*>.png', target: '/<*>.png', status: amplify.RedirectStatus.REWRITE },
                    { source: '/<*>.ico', target: '/<*>.ico', status: amplify.RedirectStatus.REWRITE },
                    { source: '/<*>.woff2', target: '/<*>.woff2', status: amplify.RedirectStatus.REWRITE },
                    // SPA fallback — all other routes serve index.html
                    { source: '</^[^.]+$|\.(?!(js|css|png|ico|woff2|json|txt|map)$)([^.]+$)/>', target: '/index.html', status: amplify.RedirectStatus.REWRITE },
                ],
            });
        }

        this.appId = amplifyApp.appId;
        this.defaultDomain = amplifyApp.defaultDomain;

        new cdk.CfnOutput(this, 'AmplifyAppId', { value: amplifyApp.appId });
        new cdk.CfnOutput(this, 'AmplifyDefaultDomain', { value: amplifyApp.defaultDomain });

        NagSuppressions.addResourceSuppressions(amplifyApp, [
            { id: 'AwsSolutions-IAM5', reason: 'Amplify auto-generates a service role with wildcards scoped to this app.' },
            { id: 'AwsSolutions-IAM4', reason: 'Amplify service role uses AWS-managed policies required for build/deploy.' },
        ], true);
    }
}
