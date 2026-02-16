// Updated InternalTaskDetail.tsx
import { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { useTranslation } from "react-i18next";
import PageMeta from "../../components/common/PageMeta";
import { X, ChevronLeft, ChevronRight } from "lucide-react";
import {
  useAcceptIssueMutation,
  useGetIssueByIdQuery,
} from "../../redux/services/issueApi";
import { getFileType, getFileUrl } from "../../utils/fileUrl";
import { useGetCurrentUserQuery } from "../../redux/services/authApi";
import {
  getUserCurrentNode,
  isUserAtLeafNode,
} from "../../utils/hierarchUtils";
import {
  canAssign,
  canEscalate,
  canInternallyMarkInProgress,
  canInternallyResolve,
} from "../../utils/taskHelper";
import TimelineOpener from "../../components/common/TimelineOpener";
import IssueHistoryLog from "../../pages/userTasks/IssueHistoryLog";
import ResolutionPreview from "../../pages/userTasks/ResolutionPreview";
import AssignmentPreview from "./AssignmentPreview";
import {
  useGetUserInternalNodesByProjectQuery,
  useGetInternalNodesQuery,
} from "../../redux/services/internalNodeApi";
import { toast } from "sonner";
import { formatStatus } from "../../utils/statusFormatter";
import DetailHeader from "../../components/common/DetailHeader";
import { useBreadcrumbTitleEffect } from "../../hooks/useBreadcrumbTitleEffect";

// Import components
import FileCard from "./FileCard";
import ActionButton from "./ActionButton";
import EscalationsSection from "./EscalationsSection";
import ResolutionsSection from "./ResolutionsSection";
import FileViewerModal from "./FileViewerModal";

export default function InternalTaskDetail() {
  const { id } = useParams<{ id: string }>();
  const { data: issue, isLoading, isError } = useGetIssueByIdQuery(id!);
  const { t } = useTranslation();
  const [selectedAction, setSelectedAction] = useState<string | null>(null);
  const [modalImageIndex, setModalImageIndex] = useState<number | null>(null);
  const [acceptIssue, { isLoading: isAccepting }] = useAcceptIssueMutation();
  const [escalateIssue, setEscalateIssue] = useState(false);
  const [assignIssue, setAssignIssue] = useState(false);
  const [resolveIssue, setResolveIssue] = useState(false);
  const [markIssue, setMarkIssue] = useState(false);
  const [openTimeline, setOpenTimeline] = useState(false);
  const [project_id, setProjectId] = useState("");
  const [internal_node_id, setInternalNodeId] = useState("");
  const [fileViewerState, setFileViewerState] = useState<{
    files: any[];
    index: number;
  } | null>(null);

  // State for user's position
  const [userAtLeafNode, setUserAtLeafNode] = useState(false);
  const [userNode, setUserNode] = useState<any>(null);

  const { data: loggedUser, isLoading: userLoading } = useGetCurrentUserQuery();
  const userId = loggedUser?.user?.user_id || "";

  // Get user's project assignments
  const {
    data: userProjectNode,
    isLoading: isLoadingNode,
    isError: nodeError,
  } = useGetUserInternalNodesByProjectQuery(project_id, {
    skip: !project_id,
  });

  // Get ALL internal nodes for hierarchy analysis
  const { data: allInternalNodesData, isLoading: loadingAllNodes } =
    useGetInternalNodesQuery({
      search: "",
      page: 1,
      pageSize: 1000, // Get all nodes
    });

  const allNodes = useMemo(() => {
    if (!allInternalNodesData) return [];
    return Array.isArray(allInternalNodesData)
      ? allInternalNodesData
      : allInternalNodesData.data || [];
  }, [allInternalNodesData]);

  // Effects for determining user's position
  useEffect(() => {
    if (userProjectNode && allNodes.length > 0) {
      const currentNode = getUserCurrentNode(userProjectNode);
      setUserNode(currentNode);

      // Check if user is at leaf node
      const isLeaf = isUserAtLeafNode(userProjectNode, allNodes);
      setUserAtLeafNode(isLeaf);

      if (currentNode) {
        setInternalNodeId(currentNode.internal_node_id);
      }
    }
  }, [userProjectNode, allNodes]);

  // Original permission effects
  useEffect(() => {
    setEscalateIssue(canEscalate(userId, issue?.status, issue));
  }, [userId, issue?.status, issue]);

  useEffect(() => {
    // IMPORTANT: If user is at leaf node, they CANNOT assign
    if (userAtLeafNode) {
      setAssignIssue(false);
    } else {
      setAssignIssue(canAssign(userId, issue?.status, issue));
    }
  }, [userId, issue?.status, issue, userAtLeafNode]);

  useEffect(() => {
    setResolveIssue(canInternallyResolve(userId, issue?.status, issue));
  }, [userId, issue?.status, issue]);

  useEffect(() => {
    setMarkIssue(canInternallyMarkInProgress(userId, issue?.status, issue));
  }, [userId, issue?.status, issue]);

  useEffect(() => {
    setProjectId(issue?.project_id);
  }, [issue?.project_id, issue]);

  // Debug logging
  useEffect(() => {
    console.log("User at leaf node:", userAtLeafNode);
    console.log("User node:", userNode);
    console.log("Can assign:", assignIssue);
  }, [userAtLeafNode, userNode, assignIssue]);

  // Helper functions (same as before)
  const issueFiles = useMemo(
    () =>
      issue?.attachments?.map((attachment) => ({
        url: getFileUrl(attachment.attachment.file_path),
        name: attachment.attachment.file_name,
        path: attachment.attachment.file_path,
        type: getFileType(attachment.attachment.file_name),
        uploadedAt: attachment.attachment.created_at,
      })) || [],
    [issue?.attachments],
  );

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const openFileViewer = (files: any[], index: number) =>
    setFileViewerState({ files, index });

  const closeFileViewer = () => setFileViewerState(null);

  const handleFileViewerPrevious = () => {
    if (!fileViewerState) return;
    setFileViewerState({
      ...fileViewerState,
      index:
        (fileViewerState.index - 1 + fileViewerState.files.length) %
        fileViewerState.files.length,
    });
  };

  const handleFileViewerNext = () => {
    if (!fileViewerState) return;
    setFileViewerState({
      ...fileViewerState,
      index: (fileViewerState.index + 1) % fileViewerState.files.length,
    });
  };

  const prevImage = () => {
    if (modalImageIndex !== null) {
      setModalImageIndex(
        (modalImageIndex - 1 + issueFiles.length) % issueFiles.length,
      );
    }
  };

  const nextImage = () => {
    if (modalImageIndex !== null) {
      setModalImageIndex((modalImageIndex + 1) % issueFiles.length);
    }
  };

  const closeModal = () => setModalImageIndex(null);

  const handleMarkAsInProgress = async () => {
    if (!id) return;
    try {
      const res = await acceptIssue({ issue_id: id }).unwrap();
      toast.success(res.message || "Status updated to In Progress!");
    } catch (error: any) {
      toast.error(error?.data?.message || "Error updating status.");
      console.error(error);
    }
  };

  const handleActions = async (value: string) => {
    setOpenTimeline(false);
    setSelectedAction(value);
  };

  // Dynamic action buttons based on user's position
  const actionButtons = useMemo(() => {
    // Base buttons that everyone can see (if permissions allow)
    const baseButtons = [
      {
        key: "mark_as_inprogress",
        label: "Mark as Inprogress",
        desc: markIssue
          ? 'Start working on this support request. It will update the status to "In progress"'
          : "Cannot mark in progress - support request is already in progress or you have escalated it",
        color: "#c2b56cff",
        bg: "#E7F3FF",
        border: "#BFD7EA",
        enabled: markIssue,
        onClick: () => {
          if (markIssue) {
            handleMarkAsInProgress();
          }
        },
      },
      {
        key: "resolve",
        label: "Resolve Request",
        desc: resolveIssue
          ? "You have fixed the support request. Provide resolution detail to close the support request."
          : "Cannot resolve - only the user who last accepted this support request can resolve it",
        color: "#1E516A",
        bg: "#E7F3FF",
        border: "#BFD7EA",
        enabled: resolveIssue,
        onClick: () => resolveIssue && handleActions("resolve"),
      },
    ];

    // If user is NOT at leaf node, they can assign
    if (!userAtLeafNode && assignIssue) {
      return [
        ...baseButtons,
        {
          key: "assign",
          label: "Assign Request",
          desc: "Assign this support request to the next responsible user in the workflow.",
          color: "#1E516A",
          bg: "#E6F3F9",
          border: "#BFD7EA",
          enabled: assignIssue,
          onClick: () => assignIssue && handleActions("assign"),
        },
      ];
    }

    // If user is at leaf node, they ONLY get base buttons (no assign, no transfer)
    return baseButtons;
  }, [markIssue, resolveIssue, assignIssue, userAtLeafNode]);

  useBreadcrumbTitleEffect(issue?.ticket_number, issue?.ticket_number);

  if (isLoading || userLoading || isLoadingNode || loadingAllNodes) {
    return <div>Loading...</div>;
  }

  if (isError || !issue) {
    return <div>Error loading support request details</div>;
  }

  return (
    <>
      <DetailHeader
        breadcrumbs={[
          { title: "Task List", link: "" },
          { title: "Task Detail", link: "" },
        ]}
      />
      <PageMeta
        title={"Task Details"}
        description={"Review task details and take appropriate action"}
      />
      <div className="min-h-screen bg-[#F9FBFC] py-6 pb-24 flex flex-col items-start">
        <div
          className={`w-full mx-auto bg-white shadow-md rounded-xl border-dashed border-[#BFD7EA] p-6 relative overflow-hidden`}
        >
          {/* User Position Indicator (Optional - for debugging) */}
          {userNode && (
            <div
              className={`mb-4 p-3 rounded-lg border ${
                userAtLeafNode
                  ? "bg-yellow-50 border-yellow-200"
                  : "bg-blue-50 border-blue-200"
              }`}
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium">
                    <span
                      className={
                        userAtLeafNode ? "text-yellow-800" : "text-blue-800"
                      }
                    >
                      Your Position:{" "}
                      <span className="font-bold">{userNode.name}</span>
                      {userAtLeafNode && " (Final Level)"}
                    </span>
                  </p>
                  <p
                    className={`text-xs mt-1 ${
                      userAtLeafNode ? "text-yellow-600" : "text-blue-600"
                    }`}
                  >
                    {userAtLeafNode
                      ? "You are at the final level. You can only mark in progress and resolve."
                      : "You can assign requests to the next level."}
                  </p>
                </div>
                {userAtLeafNode && (
                  <span className="px-2 py-1 text-xs bg-yellow-100 text-yellow-800 rounded-full">
                    Final Level
                  </span>
                )}
              </div>
            </div>
          )}

          <div
            className={`w-full transition-all duration-500 ease-in-out ${
              selectedAction || openTimeline ? "lg:pr-[360px]" : ""
            }`}
          >
            <div className="flex flex-col w-full">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-4">
                <div>
                  <h2 className="text-[#1E516A] text-xl font-bold mb-1">
                    Support Request Details
                  </h2>
                  <p className="text-gray-600">
                    Review support request details and take appropriate action
                  </p>
                </div>
                <div className="flex items-center gap-20">
                  <span
                    className={`text-base bg-green-100 text-green-900 px-2 py-1 rounded-md ${
                      issue.status === "resolved"
                        ? "text-green-900 "
                        : issue.status === "in_progress"
                          ? "text-blue-500"
                          : issue.status === "closed"
                            ? "text-red-500"
                            : "text-gray-500"
                    }`}
                  >
                    {formatStatus(issue.status)}
                  </span>
                  {!openTimeline && (
                    <TimelineOpener onOpen={() => setOpenTimeline(true)} />
                  )}
                </div>
              </div>

              <div className="border border-[#BFD7EA] rounded-xl p-6 mb-6 bg-white shadow-sm">
                {/* Top Info Grid */}
                <div className="grid grid-cols-1 md:grid-cols-3 text-base lg:grid-cols-5 gap-6">
                  <div>
                    <p className="font-semibold text-[#1E516A] mb-1">System</p>
                    <p className="text-gray-800 text-sm">
                      {issue.project?.name || "N/A"}
                    </p>
                  </div>
                  <div>
                    <p className="font-semibold text-[#1E516A] mb-1">
                      Category
                    </p>
                    <p className="text-gray-800 text-sm">
                      {issue.category?.name || "N/A"}
                    </p>
                  </div>
                  <div>
                    <p className="font-semibold text-[#1E516A] mb-1">
                      Reported By
                    </p>
                    <p className="text-gray-800 text-sm">
                      {issue.reporter?.full_name || "N/A"}
                    </p>
                  </div>
                  <div>
                    <p className="font-semibold text-[#1E516A] mb-1">
                      Reported On
                    </p>
                    <p className="text-gray-800 text-sm">
                      {formatDate(issue.issue_occured_time)}
                    </p>
                  </div>
                  <div>
                    <p className="font-semibold text-[#1E516A] mb-1">
                      Priority Level
                    </p>
                    <span
                      className="font-semibold px-2 py-1 rounded-md text-sm"
                      style={{ color: issue.priority?.color_value || "#000" }}
                    >
                      {issue.priority?.name || "N/A"}
                    </span>
                  </div>
                </div>

                {/* Description + Action Taken */}
                <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="bg-slate-50 border border-[#DCE7F1] rounded-lg p-4">
                    <p className="font-semibold text-[#1E516A] text-sm mb-2">
                      Description
                    </p>
                    <p className="text-gray-700 text-wrap whitespace-pre-line">
                      {issue.description ||
                        issue.title ||
                        "No description provided"}
                    </p>
                  </div>
                  <div className="bg-slate-50 border border-[#DCE7F1] rounded-lg p-4">
                    <p className="font-semibold text-[#1E516A] text-sm mb-2">
                      Action Taken
                    </p>
                    <p className="text-gray-700 text-wrap whitespace-pre-line">
                      {issue.action_taken || "No action taken yet"}
                    </p>
                  </div>
                </div>

                {/* Attachments */}
                {issueFiles.length > 0 && (
                  <div className="bg-white border-[#BFD7EA] rounded-lg py-4">
                    <h4 className="font-semibold text-[#1E516A] mb-3">
                      Support Request Attachments ({issueFiles.length})
                    </h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      {issueFiles.map((file, idx) => (
                        <FileCard
                          key={idx}
                          file={file}
                          onOpen={() => openFileViewer(issueFiles, idx)}
                        />
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Escalations Section */}
              {issue?.escalations && issue.escalations.length > 0 && (
                <EscalationsSection
                  escalations={issue.escalations}
                  formatDate={formatDate}
                  openFileViewer={openFileViewer}
                />
              )}

              {/* Resolutions Section */}
              {issue?.resolutions && issue.resolutions.length > 0 && (
                <ResolutionsSection
                  resolutions={issue.resolutions}
                  formatDate={formatDate}
                  openFileViewer={openFileViewer}
                />
              )}

              {/* Action Buttons */}
              {issue?.status !== "resolved" && actionButtons.length > 0 && (
                <>
                  <h3 className="text-[#1E516A] font-semibold text-lg mt-4 mb-3 flex items-center gap-2">
                    🎯 Select Action
                    {userAtLeafNode && (
                      <span className="text-xs font-normal text-yellow-600 bg-yellow-50 px-2 py-1 rounded-full">
                        Final Level Actions
                      </span>
                    )}
                  </h3>
                  <div className="flex flex-col md:flex-row gap-4 mb-6">
                    {actionButtons.map((action) => (
                      <ActionButton
                        key={action.key}
                        action={action}
                        selectedAction={selectedAction}
                        onSelect={setSelectedAction}
                      />
                    ))}
                  </div>

                  {/* Message for leaf node users */}
                  {userAtLeafNode && (
                    <div className="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                      <p className="text-sm text-yellow-700">
                        <span className="font-medium">Note:</span> As you are at
                        the final level of the workflow, you cannot assign or
                        transfer this request. Your options are to mark it in
                        progress or resolve it once completed.
                      </p>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>

          {/* File Viewer Modal */}
          <FileViewerModal
            fileViewerState={fileViewerState}
            onClose={closeFileViewer}
            onPrevious={handleFileViewerPrevious}
            onNext={handleFileViewerNext}
          />

          {/* Image Gallery Modal */}
          {modalImageIndex !== null && issueFiles.length > 0 && (
            <div
              className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-75"
              onClick={closeModal}
            >
              <div
                className="relative max-w-[90%] max-h-[90%] bg-white rounded-lg overflow-hidden"
                onClick={(e) => e.stopPropagation()}
              >
                <img
                  src={issueFiles[modalImageIndex].url}
                  alt={`Attachment ${modalImageIndex + 1}`}
                  className="max-w-full max-h-full object-contain"
                />
                <button
                  className="absolute top-4 right-4 text-white bg-black bg-opacity-50 rounded-full p-2 hover:bg-opacity-70"
                  onClick={closeModal}
                >
                  <X className="w-5 h-5" />
                </button>
                {issueFiles.length > 1 && (
                  <>
                    <button
                      className="absolute left-4 top-1/2 transform -translate-y-1/2 text-white bg-black bg-opacity-50 rounded-full p-2 hover:bg-opacity-70"
                      onClick={prevImage}
                    >
                      <ChevronLeft className="w-6 h-6" />
                    </button>
                    <button
                      className="absolute right-4 top-1/2 transform -translate-y-1/2 text-white bg-black bg-opacity-50 rounded-full p-2 hover:bg-opacity-70"
                      onClick={nextImage}
                    >
                      <ChevronRight className="w-6 h-6" />
                    </button>
                  </>
                )}
                <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 text-white bg-black bg-opacity-50 rounded-full px-3 py-1 text-sm">
                  {modalImageIndex + 1} / {issueFiles.length}
                </div>
              </div>
            </div>
          )}

          <AnimatePresence>
            {selectedAction === "resolve" && (
              <ResolutionPreview
                issue_id={id || ""}
                resolved_by={userId}
                onClose={() => setSelectedAction("")}
              />
            )}
            {selectedAction === "assign" && (
              <AssignmentPreview
                issue_id={id || ""}
                project_id={project_id || ""}
                internal_node_id={internal_node_id}
                onClose={() => setSelectedAction("")}
                assigned_by={userId}
              />
            )}
            {openTimeline && (
              <IssueHistoryLog
                logs={issue?.history || []}
                onClose={() => setOpenTimeline(false)}
              />
            )}
          </AnimatePresence>
        </div>
      </div>
    </>
  );
}
