"use client";

import { useState, useMemo, useEffect } from "react";
import { Eye } from "lucide-react";
import { Link } from "react-router-dom";

import { useGetCurrentUserQuery } from "../../../redux/services/authApi";
import { Button } from "../../ui/cn/button";
import { PageLayout } from "../../common/PageLayout";
import { DataTable } from "../../common/CommonTable";
import { FilterField } from "../../../types/layout";

import { useIssuesQuery } from "../../../hooks/useIssueQuery";
import { formatStatus } from "../../../utils/statusFormatter";

const TaskTableColumns = [
  {
    accessorKey: "ticket_number",
    header: "Ticket Number",
    cell: ({ row }: any) => <div>{row.original.ticket_number || "N/A"}</div>,
  },
  {
    accessorKey: "priority.name",
    header: "Priority",
    cell: ({ row }: any) => row.original.priority?.name || "N/A",
  },
  {
    accessorKey: "category.name",
    header: "Category",
    cell: ({ row }: any) => row.original.category?.name || "N/A",
  },
  {
    accessorKey: "reporter.full_name",
    header: "Created By",
    cell: ({ row }: any) => row.original.reporter?.full_name || "N/A",
  },
  {
    accessorKey: "hierarchyNode.name",
    header: "Structure",
    cell: ({ row }: any) => row.original.hierarchyNode?.name || "N/A",
  },
  {
    accessorKey: "project.name",
    header: "Project",
    cell: ({ row }: any) => row.original.project?.name || "N/A",
  },
  {
    accessorKey: "issue_occured_time",
    header: "Occurred Time",
    cell: ({ row }: any) =>
      row.original.issue_occured_time
        ? new Date(row.original.issue_occured_time).toLocaleString()
        : "N/A",
  },
  {
    accessorKey: "status",
    header: "Status",
    cell: ({ row }: any) => {
      const status = row.getValue("status");
      let bgClass = "bg-gray-100 text-gray-800";
      if (status === "pending") bgClass = "bg-yellow-100 text-yellow-800";
      else if (status === "resolved") bgClass = "bg-green-100 text-green-800";
      else if (status === "closed") bgClass = "bg-red-100 text-red-800";

      return (
        <span
          className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${bgClass}`}
        >
          {formatStatus(status) || "N/A"}
        </span>
      );
    },
  },
  {
    id: "actions",
    header: "Actions",
    cell: ({ row }: any) => {
      const issue = row.original;
      return (
        <div className="flex items-center space-x-2">
          <Button variant="outline" size="sm" className="h-8 w-8 p-0" asChild>
            <Link to={`/task_list/${issue.issue_id}`}>
              <Eye className="h-4 w-4" />
            </Link>
          </Button>
        </div>
      );
    },
  },
];

export default function InternalTaskList() {
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [pagination, setPagination] = useState({
    pageIndex: 0,
    pageCount: 1,
    pageSize: 10,
    total: 0,
  });

  const { data: loggedUser, isLoading: userLoading } = useGetCurrentUserQuery();

  const userId =
    loggedUser?.user?.user_id ||
    loggedUser?.user_id ||
    loggedUser?.data?.user_id;

  const internalRoles =
    loggedUser?.user?.internal_project_roles ||
    loggedUser?.internal_project_roles ||
    loggedUser?.data?.internal_project_roles ||
    [];

  const userInternalNode = internalRoles?.[0]?.internal_node;

  // Use the hook with pagination
  const {
    data: issuesData,
    isLoading: issuesLoading,
    isError,
    error: errors,
  } = useIssuesQuery(
    userId,
    userInternalNode,
    pagination.pageIndex + 1,
    pagination.pageSize,
  );

  // Debug logs to see the actual structure
  useEffect(() => {
    if (issuesData) {
      console.log("🔍 issuesData received:", issuesData);
      console.log("🔍 issuesData keys:", Object.keys(issuesData));
      console.log("🔍 issuesData.data:", issuesData.data);
      console.log("🔍 issuesData.meta:", issuesData.meta);
    }
  }, [issuesData]);

  // Extract issues - handle different possible structures
  const issues = useMemo(() => {
    if (!issuesData) return [];

    // If issuesData has a data property that's an array
    if (issuesData.data && Array.isArray(issuesData.data)) {
      console.log("✅ Using issuesData.data, length:", issuesData.data.length);
      return issuesData.data;
    }

    // If issuesData itself is an array
    if (Array.isArray(issuesData)) {
      console.log("✅ Using issuesData as array, length:", issuesData.length);
      return issuesData;
    }

    // If issuesData has an issues property
    if (issuesData.issues && Array.isArray(issuesData.issues)) {
      console.log(
        "✅ Using issuesData.issues, length:",
        issuesData.issues.length,
      );
      return issuesData.issues;
    }

    console.log("❌ Could not extract issues from:", issuesData);
    return [];
  }, [issuesData]);

  // Update pagination from response
  useEffect(() => {
    if (issuesData?.meta) {
      console.log("📊 Updating pagination from meta:", issuesData.meta);
      setPagination((prev) => ({
        ...prev,
        pageCount: issuesData.meta.totalPages || 1,
        total: issuesData.meta.total || 0,
      }));
    }
  }, [issuesData]);

  // Filter issues by status (client-side filtering)
  const filteredIssues = useMemo(() => {
    if (!issues.length) return [];

    if (statusFilter === "all") return issues;

    return issues.filter((issue) => issue.status === statusFilter);
  }, [issues, statusFilter]);

  const handlePagination = (index: number, size: number) => {
    console.log("📄 Pagination change:", { index, size });
    setPagination({
      ...pagination,
      pageIndex: index,
      pageSize: size,
    });
  };

  const handleStatusChange = (value: string | string[]) => {
    const newStatus = Array.isArray(value) ? value[0] : value;
    setStatusFilter(newStatus);
    // Reset to first page when filter changes
    setPagination({
      ...pagination,
      pageIndex: 0,
    });
  };

  const filterFields: FilterField[] = [
    {
      key: "status",
      label: "Status",
      type: "multiselect",
      options: [
        { label: "All", value: "all" },
        { label: "Pending", value: "pending" },
        { label: "Resolved", value: "resolved" },
        { label: "Closed", value: "closed" },
      ],
      value: statusFilter,
      onChange: handleStatusChange,
    },
  ];

  // Show loading state
  if (userLoading || issuesLoading) {
    return (
      <PageLayout>
        <div className="flex justify-center items-center h-64">
          <div>Loading tasks...</div>
        </div>
      </PageLayout>
    );
  }

  // Show error state
  if (isError) {
    return (
      <PageLayout>
        <div className="flex justify-center items-center h-64">
          <div className="text-red-600">
            Error loading tasks. Please try again.
            {errors && (
              <div className="text-sm text-gray-600 mt-2">
                Error details: {JSON.stringify(errors)}
              </div>
            )}
          </div>
        </div>
      </PageLayout>
    );
  }

  return (
    <PageLayout
      filters={filterFields}
      filterColumnsPerRow={1}
      title="Internal Task List"
      description="List of all internal tasks"
    >
      <DataTable
        columns={TaskTableColumns}
        data={filteredIssues}
        handlePagination={handlePagination}
        tablePageSize={pagination.pageSize}
        totalPageCount={pagination.pageCount}
        currentIndex={pagination.pageIndex}
        isLoading={issuesLoading}
      />

      {/* Debug info */}
    </PageLayout>
  );
}
