/**
 * Cognito / Amplify configuration from environment variables.
 */
export const amplifyConfig = {
    region: process.env.NEXT_PUBLIC_COGNITO_REGION || "us-east-1",
    userPoolId: process.env.NEXT_PUBLIC_COGNITO_USER_POOL_ID || "",
    userPoolClientId: process.env.NEXT_PUBLIC_COGNITO_USER_POOL_CLIENT_ID || "",
    identityPoolId: process.env.NEXT_PUBLIC_COGNITO_IDENTITY_POOL_ID || "",
};

export const apiConfig = {
    baseUrl: process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:3001",
};

export const websocketConfig = {
    url: process.env.NEXT_PUBLIC_WEBSOCKET_API_URL || "",
};
