import React from 'react';
import { FileText } from 'lucide-react';

interface PdfViewerProps {
    pdfUrl: string;
}

export default function PdfViewer({ pdfUrl }: PdfViewerProps) {
    // Add #toolbar=0 to hide the PDF toolbar by default
    const pdfUrlWithParams = pdfUrl.includes('?')
        ? `${pdfUrl}&toolbar=0`
        : `${pdfUrl}#toolbar=0`;

    return (
        <div className="h-full min-h-[400px] rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden">
            <div className="border-b border-gray-200 px-4 py-2 bg-gray-50 flex items-center gap-2">
                <FileText className="w-4 h-4 text-gray-600" />
                <span className="text-sm font-medium text-gray-700">Presentation Slides</span>
            </div>
            <iframe
                src={pdfUrlWithParams}
                className="w-full"
                style={{ height: 'calc(100% - 40px)', minHeight: '360px' }}
                title="Presentation Slides"
            />
        </div>
    );
}
