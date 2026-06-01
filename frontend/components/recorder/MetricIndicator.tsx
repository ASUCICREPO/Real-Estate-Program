"use client";

interface Props {
    label: string;
    value: number;
    unit: string;
    target: { min?: number; max?: number };
}

export default function MetricIndicator({ label, value, unit, target }: Props) {
    let status: "green" | "yellow" | "red" = "green";

    if (target.min !== undefined && target.max !== undefined) {
        if (value < target.min || value > target.max) status = "red";
        else if (value < target.min * 1.1 || value > target.max * 0.9) status = "yellow";
    } else if (target.min !== undefined) {
        if (value < target.min) status = "red";
        else if (value < target.min * 1.1) status = "yellow";
    } else if (target.max !== undefined) {
        if (value > target.max) status = "red";
        else if (value > target.max * 0.8) status = "yellow";
    }

    const colors = {
        green: "bg-green-100 text-green-700 border-green-200",
        yellow: "bg-yellow-100 text-yellow-700 border-yellow-200",
        red: "bg-red-100 text-red-700 border-red-200",
    };

    const dotColors = { green: "bg-green-500", yellow: "bg-yellow-500", red: "bg-red-500" };

    return (
        <div className={`flex items-center justify-between p-2.5 rounded-lg border ${colors[status]}`}>
            <div className="flex items-center gap-2">
                <span className={`w-2 h-2 rounded-full ${dotColors[status]}`} />
                <span className="text-sm font-medium">{label}</span>
            </div>
            <span className="text-sm font-mono">
                {value}{unit}
            </span>
        </div>
    );
}
