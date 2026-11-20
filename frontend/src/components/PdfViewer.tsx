import { useState } from 'react';
import {
  FileText,
  Download,
  ExternalLink,
  Maximize2,
  Minimize2,
  AlertTriangle,
} from 'lucide-react';
import { api } from '../api/client';

interface PdfViewerProps {
  resourceId: number;
  title: string;
  filename: string;
  mimeType?: string;
}

export function PdfViewer({
  resourceId,
  title,
  filename,
  mimeType = 'application/pdf',
}: PdfViewerProps) {
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [loadError, setLoadError] = useState(false);

  const previewUrl = api.getPreviewUrl(resourceId);
  const downloadUrl = api.getDownloadUrl(resourceId);

  return (
    <div
      className={`bg-[#103831] rounded-xl overflow-hidden shadow-lg border border-[#164A41] transition-all ${
        isFullscreen
          ? 'fixed inset-4 z-50 flex flex-col bg-[#103831]/95 backdrop-blur-md'
          : 'flex flex-col h-[650px] sm:h-[750px]'
      }`}
    >
      {/* Viewer Header */}
      <div className="px-4 py-3 bg-[#164A41] border-b border-[#103831] flex flex-wrap items-center justify-between gap-3 text-white text-xs">
        <div className="flex items-center gap-2 min-w-0">
          <FileText className="w-4 h-4 text-[#CBDAD0] shrink-0" />
          <span className="font-semibold truncate max-w-xs sm:max-w-md" title={title}>
            {filename}
          </span>
          <span className="hidden sm:inline-block px-2 py-0.5 rounded-md bg-[#103831] text-[#E5EEE8] text-[10px] uppercase font-bold border border-[#205C52]">
            {mimeType.split('/')[1] || 'PDF'}
          </span>
        </div>

        <div className="flex items-center gap-2">
          {/* Open in New Window */}
          <a
            href={previewUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-[#E5EEE8] hover:text-white transition-colors border border-white/10"
            title="Open in standalone tab"
          >
            <ExternalLink className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">New Tab</span>
          </a>

          {/* Download */}
          <a
            href={downloadUrl}
            download={filename}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#C26B3D] hover:bg-[#A5552D] text-white font-semibold transition-colors shadow-2xs"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Download</span>
          </a>

          {/* Fullscreen Toggle */}
          <button
            type="button"
            onClick={() => setIsFullscreen(!isFullscreen)}
            className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-[#E5EEE8] hover:text-white transition-colors border border-white/10"
            title={isFullscreen ? 'Exit fullscreen' : 'Expand preview'}
            aria-label={isFullscreen ? 'Exit fullscreen' : 'Expand preview'}
          >
            {isFullscreen ? (
              <Minimize2 className="w-4 h-4" />
            ) : (
              <Maximize2 className="w-4 h-4" />
            )}
          </button>
        </div>
      </div>

      {/* Mobile Notice Bar */}
      <div className="sm:hidden px-3 py-1.5 bg-[#103831] text-[#E5EEE8] text-[11px] flex items-center justify-between border-b border-[#164A41]">
        <span>Previewing in mobile mode.</span>
        <a
          href={previewUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="underline font-semibold text-[#CBDAD0]"
        >
          Open Fullscreen
        </a>
      </div>

      {/* Viewer Body */}
      <div className="flex-1 relative bg-slate-950 flex items-center justify-center overflow-hidden">
        {loadError ? (
          <div className="p-8 text-center text-slate-300 max-w-md">
            <AlertTriangle className="w-10 h-10 text-amber-400 mx-auto mb-3" />
            <h4 className="font-bold text-white text-base mb-1">
              Inline Preview Unavailable
            </h4>
            <p className="text-xs text-slate-400 mb-4 leading-relaxed">
              Your browser could not render this PDF inline. You can open the file in a new tab or download it directly to view it.
            </p>
            <div className="inline-flex items-center gap-3">
              <a
                href={previewUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-lg text-xs font-semibold"
              >
                Open in Browser
              </a>
              <a
                href={downloadUrl}
                download={filename}
                className="px-3.5 py-2 bg-[#C26B3D] hover:bg-[#A5552D] text-white rounded-lg text-xs font-semibold"
              >
                Download Document
              </a>
            </div>
          </div>
        ) : (
          <object
            data={previewUrl}
            type={mimeType}
            className="w-full h-full border-none"
            title={`Preview of ${title}`}
            onError={() => setLoadError(true)}
          >
            {/* Fallback if <object> cannot render */}
            <div className="p-8 text-center text-slate-300 max-w-md">
              <FileText className="w-12 h-12 text-[#CBDAD0] mx-auto mb-3 opacity-80" />
              <h4 className="font-bold text-white text-base mb-1">
                Embedded Document Preview
              </h4>
              <p className="text-xs text-slate-400 mb-5 leading-relaxed">
                If the document does not display automatically in your browser, click below to open or download it.
              </p>
              <div className="flex items-center justify-center gap-3">
                <a
                  href={previewUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-lg text-xs font-semibold inline-flex items-center gap-1.5"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  Open Preview
                </a>
                <a
                  href={downloadUrl}
                  download={filename}
                  className="px-4 py-2 bg-[#C26B3D] hover:bg-[#A5552D] text-white rounded-lg text-xs font-semibold inline-flex items-center gap-1.5"
                >
                  <Download className="w-3.5 h-3.5" />
                  Download
                </a>
              </div>
            </div>
          </object>
        )}
      </div>
    </div>
  );
}
