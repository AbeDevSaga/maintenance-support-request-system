"use client";

import React, { useState } from "react";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { FileUploadField } from "../../components/common/FileUploadField";
import { useReRaiseIssueMutation } from "../../redux/services/issueReRaiseApi";

interface ReRaisePreviewProps {
  issue_id: string;
  re_raised_by: string;
  onClose?: () => void;
  onSuccess?: () => void;
}

export default function ReRaisePreview({
  issue_id,
  re_raised_by,
  onClose,
  onSuccess,
}: ReRaisePreviewProps) {
  const [reason, setReason] = useState("");
  const [attachmentIds, setAttachmentIds] = useState<string[]>([]);

  const [reRaiseIssue, { isLoading }] = useReRaiseIssueMutation();

  const handleSubmit = async () => {
    if (!reason.trim()) {
      return toast.error("Please provide a reason for re-raising the issue.");
    }

    try {
      await reRaiseIssue({
        issue_id,
        reason,
        re_raised_by,
        attachment_ids: attachmentIds.length > 0 ? attachmentIds : undefined,
      }).unwrap();

      toast.success("Issue re-raised successfully!");

      // Reset form
      setReason("");
      setAttachmentIds([]);

      // Call success callback if provided
      onSuccess?.();

      // Close the preview
      onClose?.();
    } catch (error: any) {
      console.error("Failed to re-raise issue:", error);
      toast.error(
        error?.data?.message ||
          error?.data?.error ||
          "Failed to re-raise issue. Please try again."
      );
    }
  };

  const handleCancel = () => {
    // Reset form
    setReason("");
    setAttachmentIds([]);

    // Close the preview
    onClose?.();
  };

  return (
    <motion.div
      initial={{ opacity: 0, x: 100 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 100 }}
      transition={{ duration: 0.35, ease: "easeInOut" }}
      className="absolute top-0 right-0 w-full lg:w-[360px] bg-white border-l border-[#D5E3EC] h-full rounded-r-lg flex flex-col gap-4 shadow-lg"
    >
      <div className="p-6 border-b border-[#D5E3EC] bg-gradient-to-r from-[#B23B3B] to-[#E04F4F]">
        <h2 className="text-xl font-bold text-white">Re-Raise Issue</h2>
        <p className="text-white text-sm mt-1">
          Provide details for re-raising this issue
        </p>
      </div>

      <div className="flex flex-col px-6 gap-4 overflow-y-auto flex-grow">
        <div className="mt-2">
          <h4 className="font-semibold text-[#1E516A] mb-2">
            Reason for Re-Raising
          </h4>
          <textarea
            className="w-full border border-[#BFD7EA] rounded-lg p-3 text-sm h-40 focus:outline-none focus:ring-2 focus:ring-[#1E516A] resize-none"
            placeholder="Explain why this issue needs to be re-raised"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            disabled={isLoading}
          />
          <p className="text-xs text-gray-500 mt-1">
            Provide clear details to help understand why this issue needs
            attention again.
          </p>
        </div>

        <div className="mt-2">
          <FileUploadField
            className="flex flex-col gap-2"
            id="re_raise_attachments"
            label="Supporting Documents (Optional)"
            value={attachmentIds}
            onChange={setAttachmentIds}
            accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.txt"
            multiple={true}
            labelClass="text-sm font-semibold text-[#1E516A]"
          />
        </div>
      </div>

      <div className="p-6 border-t border-[#D5E3EC] bg-gray-50">
        <div className="w-full flex justify-end gap-3">
          <button
            onClick={handleCancel}
            disabled={isLoading}
            className="px-5 py-2.5 rounded-lg bg-gray-200 border border-gray-300 text-gray-700 font-semibold text-sm hover:bg-gray-300 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={isLoading || !reason.trim()}
            className="px-5 py-2.5 rounded-lg bg-gradient-to-r from-[#B23B3B] to-[#E04F4F] text-white font-semibold text-sm hover:from-[#9C3434] hover:to-[#C94545] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isLoading ? (
              <span className="flex items-center gap-2">
                <svg
                  className="animate-spin h-4 w-4 text-white"
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                >
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                  ></circle>
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                  ></path>
                </svg>
                Re-Raising...
              </span>
            ) : (
              "Confirm Re-Raise"
            )}
          </button>
        </div>
      </div>
    </motion.div>
  );
}
