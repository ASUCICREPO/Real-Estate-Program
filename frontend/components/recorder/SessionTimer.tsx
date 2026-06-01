"use client";

interface Props {
    elapsed: number;
}

export default function SessionTimer({ elapsed }: Props) {
    const minutes = Math.floor(elapsed / 60);
    const seconds = elapsed % 60;
    const formatted = `${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`;

    return (
        <span className="font-mono text-lg tabular-nums">{formatted}</span>
    );
}
