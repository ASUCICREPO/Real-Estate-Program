"use client";

import { useState, useEffect, useCallback } from "react";
import {
    CognitoUserPool,
    CognitoUser,
    AuthenticationDetails,
    CognitoUserAttribute,
    CognitoUserSession,
} from "amazon-cognito-identity-js";
import { CognitoIdentityClient, GetIdCommand, GetCredentialsForIdentityCommand } from "@aws-sdk/client-cognito-identity";
import { amplifyConfig } from "@/lib/amplify-config";
import { setTokenProvider } from "@/lib/api-client";
import type { AuthState, AuthUser, AuthTokens, AWSCredentials } from "@/lib/types";

const userPool = new CognitoUserPool({
    UserPoolId: amplifyConfig.userPoolId,
    ClientId: amplifyConfig.userPoolClientId,
});

export function useAuth() {
    const [state, setState] = useState<AuthState>({
        isAuthenticated: false,
        user: null,
        tokens: null,
        awsCredentials: null,
        isLoading: true,
    });

    const getSession = useCallback((): Promise<CognitoUserSession | null> => {
        return new Promise((resolve) => {
            const user = userPool.getCurrentUser();
            if (!user) { resolve(null); return; }
            user.getSession((err: any, session: CognitoUserSession | null) => {
                if (err || !session?.isValid()) { resolve(null); return; }
                resolve(session);
            });
        });
    }, []);

    const getAWSCredentials = useCallback(async (idToken: string): Promise<AWSCredentials | null> => {
        try {
            const client = new CognitoIdentityClient({ region: amplifyConfig.region });
            const providerName = `cognito-idp.${amplifyConfig.region}.amazonaws.com/${amplifyConfig.userPoolId}`;
            const { IdentityId } = await client.send(new GetIdCommand({
                IdentityPoolId: amplifyConfig.identityPoolId,
                Logins: { [providerName]: idToken },
            }));
            const { Credentials } = await client.send(new GetCredentialsForIdentityCommand({
                IdentityId: IdentityId!,
                Logins: { [providerName]: idToken },
            }));
            if (!Credentials) return null;
            return {
                accessKeyId: Credentials.AccessKeyId!,
                secretAccessKey: Credentials.SecretKey!,
                sessionToken: Credentials.SessionToken!,
            };
        } catch { return null; }
    }, []);

    const refreshState = useCallback(async () => {
        const session = await getSession();
        if (!session) {
            setState({ isAuthenticated: false, user: null, tokens: null, awsCredentials: null, isLoading: false });
            setTokenProvider(() => null);
            return;
        }
        const idToken = session.getIdToken().getJwtToken();
        const tokens: AuthTokens = {
            idToken,
            accessToken: session.getAccessToken().getJwtToken(),
            refreshToken: session.getRefreshToken().getToken(),
        };
        const payload = session.getIdToken().payload;
        const user: AuthUser = { email: payload.email as string, userId: payload.sub as string };
        const awsCredentials = await getAWSCredentials(idToken);
        setState({ isAuthenticated: true, user, tokens, awsCredentials, isLoading: false });
        setTokenProvider(() => idToken);
    }, [getSession, getAWSCredentials]);

    useEffect(() => { refreshState(); }, [refreshState]);

    const signIn = async (email: string, password: string) => {
        return new Promise<void>((resolve, reject) => {
            const user = new CognitoUser({ Username: email, Pool: userPool });
            user.authenticateUser(new AuthenticationDetails({ Username: email, Password: password }), {
                onSuccess: async () => { await refreshState(); resolve(); },
                onFailure: (err) => reject(err),
            });
        });
    };

    const signUp = async (email: string, password: string) => {
        return new Promise<void>((resolve, reject) => {
            userPool.signUp(email, password, [new CognitoUserAttribute({ Name: "email", Value: email })], [], (err) => {
                if (err) reject(err); else resolve();
            });
        });
    };

    const confirmSignUp = async (email: string, code: string) => {
        return new Promise<void>((resolve, reject) => {
            const user = new CognitoUser({ Username: email, Pool: userPool });
            user.confirmRegistration(code, true, (err) => {
                if (err) reject(err); else resolve();
            });
        });
    };

    const signOut = () => {
        const user = userPool.getCurrentUser();
        user?.signOut();
        setState({ isAuthenticated: false, user: null, tokens: null, awsCredentials: null, isLoading: false });
        setTokenProvider(() => null);
    };

    return { ...state, signIn, signUp, confirmSignUp, signOut };
}
