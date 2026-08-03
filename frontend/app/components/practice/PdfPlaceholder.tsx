import React from 'react';
import { FileText, Upload } from 'lucide-react';

export default function PdfPlaceholder() {
    return (
        <div className="h-full min-h-[400px] flex items-center justify-center rounded-xl border-2 border-dashed border-gray-300 bg-gray-50 p-8">
            <div className="text-center">
                <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-gray-200 mb-4">
                    <FileText className="h-8 w-8 text-gray-400" />
                </div>
                <h3 className="text-lg font-semibold text-gray-700 mb-2">No Presentation Uploaded</h3>
                <p className="text-sm text-gray-500 max-w-sm mx-auto mb-4">
                    Upload a PDF presentation before starting your practice session to view it here alongside your recording.
                </p>
                <div className="flex items-center justify-center gap-2 text-xs text-gray-400">
                    <Upload className="h-4 w-4" />
                    <span>Upload from the session setup page</span>
                </div>
            </div>
        </div>
    );
}
