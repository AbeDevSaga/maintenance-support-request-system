// components/FileViewerModal.tsx
import { X, ChevronLeft, ChevronRight } from "lucide-react";
import FileViewer from "../../components/common/FileView";

interface FileViewerModalProps {
  fileViewerState: {
    files: any[];
    index: number;
  } | null;
  onClose: () => void;
  onPrevious: () => void;
  onNext: () => void;
}

const FileViewerModal = ({ 
  fileViewerState, 
  onClose, 
  onPrevious, 
  onNext 
}: FileViewerModalProps) => {
  if (!fileViewerState) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 bg-opacity-75 p-4">
      <div className="bg-white rounded-lg w-full max-w-6xl h-[90vh] flex flex-col">
        <div className="flex justify-between items-center p-4 border-b">
          <h3 className="text-lg font-semibold text-[#1E516A]">
            File Preview{" "}
            <span className="text-xs text-gray-500">
              ({fileViewerState.files[fileViewerState.index].name})
            </span>
          </h3>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-full"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="flex-1 p-4 flex flex-col">
          <div className="flex-1">
            <FileViewer
              fileUrl={fileViewerState.files[fileViewerState.index].url}
            />
          </div>
          {fileViewerState.files.length > 1 && (
            <div className="mt-4 flex items-center justify-between">
              <button
                className="flex items-center gap-1 px-3 py-1 rounded-md border border-gray-300 text-sm text-gray-700 hover:bg-gray-100"
                onClick={onPrevious}
              >
                <ChevronLeft className="w-4 h-4" />
                Previous
              </button>
              <span className="text-xs text-gray-500">
                {fileViewerState.index + 1} / {fileViewerState.files.length}
              </span>
              <button
                className="flex items-center gap-1 px-3 py-1 rounded-md border border-gray-300 text-sm text-gray-700 hover:bg-gray-100"
                onClick={onNext}
              >
                Next
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default FileViewerModal;