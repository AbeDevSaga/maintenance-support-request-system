// components/EscalationsSection.tsx
import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronUp, ChevronDown, FileText } from "lucide-react";
import FileCard from "./FileCard";
import { getFileUrl, getFileType } from "../../utils/fileUrl";

interface EscalationsSectionProps {
  escalations: any[];
  formatDate: (date: string) => string;
  openFileViewer: (files: any[], index: number) => void;
}

const EscalationsSection = ({ 
  escalations, 
  formatDate, 
  openFileViewer 
}: EscalationsSectionProps) => {
  const [expandedEscalations, setExpandedEscalations] = useState<string[]>([]);
  const [expandedSections, setExpandedSections] = useState({
    escalations: true,
  });

  const toggleSection = () => {
    setExpandedSections((prev) => ({
      ...prev,
      escalations: !prev.escalations,
    }));
  };

  const toggleEscalation = (escalationId: string) => {
    setExpandedEscalations((prev) =>
      prev.includes(escalationId)
        ? prev.filter((id) => id !== escalationId)
        : [...prev, escalationId]
    );
  };

  const toggleAllEscalations = () => {
    if (expandedEscalations.length === escalations.length) {
      setExpandedEscalations([]);
    } else {
      setExpandedEscalations(escalations.map((esc: any) => esc.escalation_id));
    }
  };

  return (
    <div className="mb-6">
      <div className="flex items-center justify-between mb-4 p-3 bg-gradient-to-r from-purple-50 to-indigo-50 rounded-lg border border-purple-200">
        <div className="flex items-center gap-3">
          <div className="w-2 h-8 bg-[#6D28D9] rounded-full"></div>
          <div>
            <h3 className="text-[#1E516A] font-bold text-lg">
              Escalations ({escalations.length})
            </h3>
            <p className="text-sm text-gray-600">Track all escalation paths</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            className="border border-[#6D28D9] text-[#6D28D9] text-xs px-3 py-1 rounded-md hover:bg-purple-50"
            onClick={toggleAllEscalations}
          >
            {expandedEscalations.length === escalations.length
              ? "Collapse All"
              : "Expand All"}
          </button>
          <button
            onClick={toggleSection}
            className="p-2 hover:bg-white rounded-lg transition-colors"
          >
            {expandedSections.escalations ? (
              <ChevronUp className="w-5 h-5 text-[#6D28D9]" />
            ) : (
              <ChevronDown className="w-5 h-5 text-[#6D28D9]" />
            )}
          </button>
        </div>
      </div>

      <AnimatePresence>
        {expandedSections.escalations && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.3 }}
            className="space-y-4"
          >
            {escalations.map((escalation: any, escalationIndex: number) => {
              const isExpanded = expandedEscalations.includes(
                escalation.escalation_id
              );
              const escalationFiles =
                escalation.attachments?.map((attachment: any) => ({
                  url: getFileUrl(attachment.attachment.file_path),
                  name: attachment.attachment.file_name,
                  path: attachment.attachment.file_path,
                  type: getFileType(attachment.attachment.file_name),
                  uploadedAt: attachment.attachment.created_at,
                })) || [];

              return (
                <div
                  key={escalation.escalation_id}
                  className="border border-[#BFD7EA] rounded-lg overflow-hidden"
                >
                  <div
                    className="p-4 cursor-pointer hover:bg-purple-50 transition-colors flex items-center justify-between"
                    onClick={() => toggleEscalation(escalation.escalation_id)}
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-purple-100 flex items-center justify-center">
                        <span className="font-bold text-purple-700">
                          {escalationIndex + 1}
                        </span>
                      </div>
                      <div>
                        <h4 className="font-semibold text-[#1E516A]">
                          {escalation.fromTierNode?.name || "Unknown"} →{" "}
                          {escalation.toTierNode?.name || "EAII"}
                        </h4>
                        <div className="flex items-center gap-4 text-sm text-gray-600 mt-1">
                          <span>
                            By: {escalation.escalator?.full_name || "N/A"}
                          </span>
                          <span>On: {formatDate(escalation.escalated_at)}</span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      {escalationFiles.length > 0 && (
                        <span className="text-sm text-gray-500 flex items-center gap-1">
                          <FileText className="w-4 h-4" />
                          {escalationFiles.length}
                        </span>
                      )}
                      {isExpanded ? (
                        <ChevronUp className="w-5 h-5 text-[#6D28D9]" />
                      ) : (
                        <ChevronDown className="w-5 h-5 text-[#6D28D9]" />
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
                        <div className="mt-1 grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div className="bg-[#094C810D] border border-[#BFD7EA] rounded-md p-3 text-gray-700">
                            <p className="font-semibold text-[#1E516A] text-sm mb-1">
                              Escalation Reason
                            </p>
                            {escalation.reason || "No reason provided"}
                          </div>
                          <div className="bg-[#094C810D] border border-[#BFD7EA] rounded-md p-3 text-gray-700">
                            <p className="font-semibold text-[#1E516A] text-sm mb-1">
                              Reporter Contact
                            </p>
                            <p className="text-gray-600">
                              {escalation?.escalator?.full_name || "N/A"}
                            </p>
                            <p className="text-gray-500 text-xs mt-1">
                              {escalation?.escalator?.phone_number ||
                                "No phone number"}
                            </p>
                          </div>
                        </div>

                        {escalationFiles.length > 0 && (
                          <div className="mt-4">
                            <h5 className="font-semibold text-[#1E516A] mb-3">
                              Attachments ({escalationFiles.length})
                            </h5>
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                              {escalationFiles.map((file: any, idx: number) => (
                                <FileCard
                                  key={`${escalation.escalation_id}-${idx}`}
                                  file={file}
                                  onOpen={() => openFileViewer(escalationFiles, idx)}
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

export default EscalationsSection;