"use client";

import { useAuthContext } from "./AuthProvider";
import { useRouter } from "next/navigation";
import { useEffect, type ReactNode } from "react";

export default function ProtectedRoute({ children }: { children: ReactNode }) {
    const { isAuthenticated, isLoading } = useAuthContext();
    const router = useRouter();

    useEffect(() => {
        if (!isLoading && !isAuthenticated) {
            router.push("/login");
        }
    }, [isAuthenticated, isLoading, router]);

    if (isLoading) {
        return (
            <div className="flex items-center justify-center min-h-screen">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#8C1D40]" />
            </div>
        );
    }

    if (!isAuthenticated) return null;
    return <>{children}</>;
}
