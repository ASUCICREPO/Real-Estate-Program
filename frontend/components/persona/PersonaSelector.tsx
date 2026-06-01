"use client";

import { useState, useEffect } from "react";
import { listPersonas } from "@/lib/api-client";
import type { Persona } from "@/lib/types";

interface Props {
    onSelect: (persona: Persona) => void;
}

export default function PersonaSelector({ onSelect }: Props) {
    const [personas, setPersonas] = useState<Persona[]>([]);
    const [selected, setSelected] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");

    useEffect(() => {
        async function load() {
            try {
                const data = await listPersonas();
                setPersonas(data);
            } catch (err: any) {
                setError(err.message || "Failed to load personas");
            } finally {
                setLoading(false);
            }
        }
        load();
    }, []);

    function handleSelect(persona: Persona) {
        setSelected(persona.personaID);
        onSelect(persona);
    }

    if (loading) return <div className="animate-pulse h-40 bg-gray-100 rounded-lg" />;
    if (error) return <div className="text-red-600 text-sm">{error}</div>;

    return (
        <div>
            <h2 className="text-lg font-semibold text-gray-900 mb-3">Select Persona</h2>
            <p className="text-sm text-gray-500 mb-4">Choose a stakeholder to present to.</p>
            <div className="space-y-3">
                {personas.map((persona) => (
                    <button key={persona.personaID} onClick={() => handleSelect(persona)}
                        className={`w-full text-left p-4 rounded-lg border-2 transition-all ${selected === persona.personaID
                                ? "border-[#8C1D40] bg-[#8C1D40]/5"
                                : "border-gray-200 hover:border-gray-300"
                            }`}>
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-full bg-[#8C1D40]/10 flex items-center justify-center text-[#8C1D40] font-bold text-sm">
                                {persona.name.charAt(0)}
                            </div>
                            <div className="flex-1">
                                <p className="font-medium text-gray-900">{persona.name}</p>
                                <p className="text-xs text-gray-500 line-clamp-1">{persona.description}</p>
                            </div>
                            <span className="text-xs text-gray-400">{persona.presentationTime}</span>
                        </div>
                    </button>
                ))}
            </div>
        </div>
    );
}
