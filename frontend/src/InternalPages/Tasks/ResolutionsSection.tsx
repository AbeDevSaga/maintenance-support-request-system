// components/ResolutionsSection.tsx
import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronUp, ChevronDown, FileText } from "lucide-react";
import FileCard from "./FileCard";
import { getFileUrl, getFileType } from "../../utils/fileUrl";
import { formatStatus } from "../../utils/statusFormatter";

interface ResolutionsSectionProps {
  resolutions: any[];
  formatDate: (date: string) => string;
  openFileViewer: (files: any[], index: number) => void;
}

const ResolutionsSection = ({ 
  resolutions, 
  formatDate, 
  openFileViewer 
}: ResolutionsSectionProps) => {
  const [expandedResolutions, setExpandedResolutions] = useState<string[]>([]);
  const [expandedSections, setExpandedSections] = useState({
    resolutions: true,
  });

  const toggleSection = () => {
    setExpandedSections((prev) => ({
      ...prev,
      resolutions: !prev.resolutions,
    }));
  };

  const toggleResolution = (resolutionId: string) => {
    setExpandedResolutions((prev) =>
      prev.includes(resolutionId)
        ? prev.filter((id) => id !== resolutionId)
        : [...prev, resolutionId]
    );
  };

  const toggleAllResolutions = () => {
    if (expandedResolutions.length === resolutions.length) {
      setExpandedResolutions([]);
    } else {
      setExpandedResolutions(
        resolutions.map((res: any) => res.resolution_id)
      );
    }
  };

  return (
    <div className="mb-6">
      <div className="flex items-center justify-between mb-4 p-3 bg-gradient-to-r from-green-50 to-emerald-50 rounded-lg border border-green-200">
        <div className="flex items-center gap-3">
          <div className="w-2 h-8 bg-green-600 rounded-full"></div>
          <div>
            <h3 className="text-[#1E516A] font-bold text-lg">
              Resolutions ({resolutions.length})
            </h3>
            <p className="text-sm text-gray-600">All resolution attempts</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            className="border border-green-700 text-green-700 text-xs px-3 py-1 rounded-md hover:bg-green-50"
            onClick={toggleAllResolutions}
          >
            {expandedResolutions.length === resolutions.length
              ? "Collapse All"
              : "Expand All"}
          </button>
          <button
            onClick={toggleSection}
            className="p-2 hover:bg-white rounded-lg transition-colors"
          >
            {expandedSections.resolutions ? (
              <ChevronUp className="w-5 h-5 text-green-700" />
            ) : (
              <ChevronDown className="w-5 h-5 text-green-700" />
            )}
          </button>
        </div>
      </div>

      <AnimatePresence>
        {expandedSections.resolutions && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.3 }}
            className="space-y-4"
          >
            {resolutions.map((resolution: any, resolutionIndex: number) => {
              const isExpanded = expandedResolutions.includes(
                resolution.resolution_id
              );
              const resolutionFiles =
                resolution.attachments?.map((attachment: any) => ({
                  url: getFileUrl(attachment.attachment.file_path),
                  name: attachment.attachment.file_name,
                  path: attachment.attachment.file_path,
                  type: getFileType(attachment.attachment.file_name),
                  uploadedAt: attachment.attachment.created_at,
                })) || [];

              return (
                <div
                  key={resolution.resolution_id}
                  className="border border-[#BFD7EA] rounded-lg overflow-hidden"
                >
                  <div
                    className="p-4 cursor-pointer hover:bg-green-50 transition-colors flex items-center justify-between"
                    onClick={() => toggleResolution(resolution.resolution_id)}
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-green-100 flex items-center justify-center">
                        <span className="font-bold text-green-700">
                          {resolutionIndex + 1}
                        </span>
                      </div>
                      <div>
                        <h4 className="font-semibold text-[#1E516A]">
                          {resolution.resolver?.full_name || "Unknown"}
                        </h4>
                        <div className="flex items-center gap-4 text-sm text-gray-600 mt-1">
                          <span>
                            By {resolution.resolver?.full_name || "N/A"}
                          </span>
                          <span>•</span>
                          <span>On: {formatDate(resolution.resolved_at)}</span>
                          <span className="px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                            {formatStatus(resolution.status) || "resolved"}
                          </span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      {resolutionFiles.length > 0 && (
                        <span className="text-sm text-gray-500 flex items-center gap-1">
                          <FileText className="w-4 h-4" />
                          {resolutionFiles.length}
                        </span>
                      )}
                      {isExpanded ? (
                        <ChevronUp className="w-5 h-5 text-green-700" />
                      ) : (
                        <ChevronDown className="w-5 h-5 text-green-700" />
                      )}
                    </div>
                  </div>

                  <AnimatePresence>
                    {isExpanded && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: "auto" }}
                        exit={{ opacity: 0, height: 0 }}
                        transition={{ duration: 0.2 }}
                        className="p-4 border-t border-[#BFD7EA] bg-white"
                      >
                        <div className="bg-[#094C810D] border border-[#BFD7EA] rounded-md p-4 text-gray-700">
                          <p className="font-semibold text-[#1E516A] text-sm mb-2">
                            Resolution Reason
                          </p>
                          <p className="text-sm leading-relaxed">
                            {resolution.reason || "No resolution reason was provided."}
                          </p>
                        </div>

                        {resolutionFiles.length > 0 && (
                          <div className="mt-5">
                            <h5 className="font-semibold text-[#1E516A] mb-3">
                              Attachments ({resolutionFiles.length})
                            </h5>
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                              {resolutionFiles.map((file: any, idx: number) => (
                                <FileCard
                                  key={`${resolution.resolution_id}-${idx}`}
                                  file={file}
                                  onOpen={() => openFileViewer(resolutionFiles, idx)}
                                />
                              ))}
                            </div>
                          </div>
                        )}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              );
            })}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default ResolutionsSection;