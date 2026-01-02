"use client";
import {
  RadialBarChart,
  RadialBar,
  PolarGrid,
  PolarRadiusAxis,
  Label,
} from "recharts";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../../ui/select";

import { Card, CardContent, CardHeader, CardTitle } from "../../ui/card";
import { ChartContainer, ChartConfig } from "../../ui/chart";
import { ArrowDownRight, ArrowUpRight } from "lucide-react";
import { Badge } from "../../ui/badge";
import React from "react";
import { useGetDashboardStatsQuery } from "../../../redux/services/dashboardApi";
import { exportToCSV } from "../../../utils/dashboardHelper";
import { Button } from "../../ui/cn/button";

// Helper functions
export const normalizeStatus = (status: string) => {
  if (status === "resolved" || status === "closed") return "resolved";
  if (status === "rejected") return "rejected";
  return "pending";
};

export const isWithinRange = (date: string, range: "90d" | "30d" | "7d") => {
  const now = new Date();
  const created = new Date(date);

  const diffDays = (now.getTime() - created.getTime()) / (1000 * 60 * 60 * 24);

  if (range === "7d") return diffDays <= 7;
  if (range === "30d") return diffDays <= 30;
  return diffDays <= 90;
};

export type TimeRange = "90d" | "30d" | "7d";

export default function ExternalStatasCard() {
  const {
    data: dashboardData,
    isLoading,
    isError,
    refetch,
  } = useGetDashboardStatsQuery();

  const [timeRange, setTimeRange] = React.useState<TimeRange>("90d");
  const [selectedProjectId, setSelectedProjectId] = React.useState<string | null>(null);
  const [selectedBranchId, setSelectedBranchId] = React.useState<string | null>(null);

  // Get all unique branches across selected project(s)
  const availableBranches = React.useMemo(() => {
    if (!dashboardData?.data?.institute?.projects) return [];

    const projects = dashboardData.data.institute.projects;

    // If no project selected, get all branches from all projects
    const targetProjects = selectedProjectId
      ? projects.filter((p: any) => p.project_id === selectedProjectId)
      : projects;

    const branches: any[] = [];
    targetProjects.forEach((project: any) => {
      project.hierarchies?.forEach((hierarchy: any) => {
        branches.push({
          ...hierarchy,
          project_id: project.project_id,
          project_name: project.name
        });
      });
    });

    return branches;
  }, [dashboardData, selectedProjectId]);

  // Map the data to stat cards
  const currentStats = React.useMemo(() => {
    if (!dashboardData?.data?.institute?.projects) return [];

    const projects = dashboardData.data.institute.projects;

    // Filter projects if a specific project is selected
    const targetProjects = selectedProjectId
      ? projects.filter((p: any) => p.project_id === selectedProjectId)
      : projects;

    // Calculate counts based on time range and status
    let resolved = 0;
    let pending = 0;
    let rejected = 0;

    targetProjects.forEach((project: any) => {
      project.hierarchies?.forEach((hierarchy: any) => {
        // Filter by branch if selected
        if (selectedBranchId && hierarchy.hierarchy_node_id !== selectedBranchId) {
          return;
        }

        hierarchy.issues?.forEach((issue: any) => {
          if (!isWithinRange(issue.created_at, timeRange)) return;

          const bucket = normalizeStatus(issue.status);
          if (bucket === "resolved") resolved++;
          else if (bucket === "rejected") rejected++;
          else pending++;
        });
      });
    });

    const total = resolved + pending + rejected || 1;

    // Map to StatCard format
    return [
      {
        id: "1",
        title: "Resolved Requests",
        value: resolved,
        percent: Math.round((resolved / total) * 100),
        change: "+0%",
        color: "hsl(var(--chart-1))",
        status: "positive",
      },
      {
        id: "2",
        title: "Pending Requests",
        value: pending,
        percent: Math.round((pending / total) * 100),
        change: "+0%",
        color: "hsl(var(--chart-7))",
        status: "positive",
      },
      {
        id: "3",
        title: "Rejected Requests",
        value: rejected,
        percent: Math.round((rejected / total) * 100),
        change: "-0%",
        color: "hsl(var(--chart-2))",
        status: "negative",
      },
    ];
  }, [dashboardData, selectedProjectId, selectedBranchId, timeRange]);

  const getTitleByType = () => {
    if (!dashboardData?.data?.institute) return "Statistics";

    const institute = dashboardData.data.institute;
    let title = `${institute.name} Statistics`;

    if (selectedProjectId) {
      const project = institute.projects.find(
        (p: any) => p.project_id === selectedProjectId
      );
      if (project) {
        title = `${project.name} Statistics`;
      }
    }

    if (selectedBranchId) {
      const branch = availableBranches.find(
        (b: any) => b.hierarchy_node_id === selectedBranchId
      );
      if (branch) {
        title = `${branch.name} Statistics`;
      }
    }

    return title;
  };

  const exportData = React.useMemo(() => {
    if (!dashboardData?.data?.institute?.projects) return [];

    const institute = dashboardData.data.institute;
    const projects = institute.projects;

    const targetProjects = selectedProjectId
      ? projects.filter((p: any) => p.project_id === selectedProjectId)
      : projects;

    const rows: any[] = [];

    targetProjects.forEach((project: any) => {
      project.hierarchies?.forEach((hierarchy: any) => {
        // Filter by branch if selected
        if (selectedBranchId && hierarchy.hierarchy_node_id !== selectedBranchId) {
          return;
        }

        hierarchy.issues?.forEach((issue: any) => {
          if (!isWithinRange(issue.created_at, timeRange)) return;

          const d = new Date(issue.created_at);
          const localDate = new Date(
            d.getFullYear(),
            d.getMonth(),
            d.getDate()
          ).toLocaleDateString();

          rows.push({
            "Institute": institute.name,
            "Project": project.name,
            "Branch": hierarchy.name,
            "Ticket": issue.ticket_number,
            "Status": normalizeStatus(issue.status),
            "Priority": issue.priority?.name || "N/A",
            "Created Date": localDate,
          });
        });
      });
    });

    return rows;
  }, [dashboardData, selectedProjectId, selectedBranchId, timeRange, availableBranches]);

  if (isLoading) {
    return (
      <Card className="hover:shadow-lg transition-all duration-300 border-border/50 p-6">
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-2"></div>
            <p className="text-sm text-muted-foreground">Loading statistics...</p>
          </div>
        </div>
      </Card>
    );
  }

  if (isError) {
    return (
      <Card className="hover:shadow-lg transition-all duration-300 border-border/50 p-6">
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <p className="text-sm text-red-500 mb-2">Error loading statistics</p>
            <button
              onClick={() => refetch()}
              className="text-sm text-primary hover:underline"
            >
              Retry
            </button>
          </div>
        </div>
      </Card>
    );
  }

  if (!dashboardData?.data?.institute?.projects?.length) {
    return (
      <Card className="hover:shadow-lg transition-all duration-300 border-border/50 p-6">
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <p className="text-sm text-muted-foreground">No data available</p>
          </div>
        </div>
      </Card>
    );
  }

  const institute = dashboardData.data.institute;
  const projects = institute.projects;

  return (
    <Card className="hover:shadow-lg transition-all duration-300 border-border/50 p-6">
      <div className="flex flex-col gap-6 mb-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <CardTitle className="text-lg font-semibold">
            {getTitleByType()}
          </CardTitle>
          <div className="flex flex-col sm:flex-row gap-3">
            <Button
              onClick={() =>
                exportToCSV(
                  exportData,
                  `${getTitleByType().replace(/\s+/g, "_")}_${timeRange}.csv`
                )
              }
              disabled={!exportData.length}
              className="rounded-lg border px-4 py-2 text-sm font-medium
             hover:bg-muted disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Export CSV
            </Button>

            {/* Project Selector */}
            <Select
              value={selectedProjectId || "all"}
              onValueChange={(value) => {
                setSelectedProjectId(value === "all" ? null : value);
                setSelectedBranchId(null); // Reset branch when project changes
              }}
            >
              <SelectTrigger
                className="w-full sm:w-[180px] rounded-lg bg-white"
                aria-label="Select project"
              >
                <SelectValue placeholder="Select project" />
              </SelectTrigger>
              <SelectContent className="rounded-xl bg-white">
                <SelectItem value="all" className="rounded-lg">
                  All Projects
                </SelectItem>
                {projects.map((project: any) => (
                  <SelectItem
                    key={project.project_id}
                    value={project.project_id}
                    className="rounded-lg"
                  >
                    {project.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Branch Selector */}
            <Select
              value={selectedBranchId || "all"}
              onValueChange={(value) => {
                setSelectedBranchId(value === "all" ? null : value);
              }}
              disabled={availableBranches.length === 0}
            >
              <SelectTrigger
                className="w-full sm:w-[180px] rounded-lg bg-white"
                aria-label="Select branch"
              >
                <SelectValue placeholder="Select branch" />
              </SelectTrigger>
              <SelectContent className="rounded-xl bg-white">
                <SelectItem value="all" className="rounded-lg">
                  All Branches
                </SelectItem>
                {availableBranches.map((branch: any) => (
                  <SelectItem
                    key={branch.hierarchy_node_id}
                    value={branch.hierarchy_node_id}
                    className="rounded-lg"
                  >
                    {branch.name} ({branch.project_name})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Time Range Selector */}
            <Select value={timeRange} onValueChange={setTimeRange}>
              <SelectTrigger
                className="w-full sm:w-[160px] rounded-lg"
                aria-label="Select time range"
              >
                <SelectValue placeholder="Last 3 months" />
              </SelectTrigger>
              <SelectContent className="rounded-xl bg-white">
                <SelectItem value="90d" className="rounded-lg">
                  Last 3 months
                </SelectItem>
                <SelectItem value="30d" className="rounded-lg">
                  Last 30 days
                </SelectItem>
                <SelectItem value="7d" className="rounded-lg">
                  Last 7 days
                </SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 relative">
        {currentStats.map((item, index) => {
          const chartData = [
            { name: item.title, value: 100, fill: "hsl(var(--muted))" },
            { name: item.title, value: item.percent, fill: item.color },
          ];

          const chartConfig = {
            value: {
              label: item.title,
              color: item.color,
            },
          } satisfies ChartConfig;

          return (
            <React.Fragment key={item.id}>
              <div className="relative">
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-sm font-medium text-secondary">
                      {item.title}
                    </CardTitle>
                  </div>
                </CardHeader>

                <CardContent className="flex items-center justify-between">
                  {/* Text Section */}
                  <div className="flex flex-col space-y-4">
                    <div className="text-3xl text-primary font-bold tracking-tight">
                      {item.value.toLocaleString()}
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge
                        status="outline"
                        className={`rounded-full border-0 ${item.status === "positive"
                          ? "bg-green-50 text-green-700"
                          : "bg-red-50 text-red-700"
                          }`}
                        style={{
                          backgroundColor:
                            item.status === "positive"
                              ? `${item.color
                                .replace("hsl", "hsla")
                                .replace(")", ", 0.1)")}`
                              : `${item.color
                                .replace("hsl", "hsla")
                                .replace(")", ", 0.1)")}`,
                          color: item.color,
                          borderColor: `${item.color
                            .replace("hsl", "hsla")
                            .replace(")", ", 0.2)")}`,
                        }}
                      >
                        {item.status === "positive" ? (
                          <ArrowUpRight
                            className="h-3 w-3"
                            style={{ color: item.color }}
                          />
                        ) : (
                          <ArrowDownRight
                            className="h-3 w-3"
                            style={{ color: item.color }}
                          />
                        )}
                      </Badge>
                      <span
                        className="text-sm font-medium"
                        style={{ color: item.color }}
                      >
                        {item.change}
                      </span>
                    </div>
                  </div>
                  {/* Radial Chart */}
                  <ChartContainer
                    config={chartConfig}
                    className="aspect-square h-[90px]"
                  >
                    <RadialBarChart
                      data={chartData}
                      startAngle={90}
                      endAngle={-270}
                      innerRadius={35}
                      outerRadius={45}
                    >
                      <PolarGrid
                        gridType="circle"
                        radialLines={false}
                        stroke="none"
                      />
                      <RadialBar
                        dataKey="value"
                        background={{ fill: "hsl(var(--muted))" }}
                        cornerRadius={10}
                        stackId="a"
                      />
                      <PolarRadiusAxis tick={false} axisLine={false}>
                        <Label
                          content={({ viewBox }) => {
                            if (!viewBox || !("cx" in viewBox)) return null;
                            return (
                              <text
                                x={viewBox.cx}
                                y={viewBox.cy}
                                textAnchor="middle"
                                dominantBaseline="middle"
                              >
                                <tspan
                                  className="text-sm font-bold"
                                  style={{ fill: item.color }}
                                >
                                  {item.percent}%
                                </tspan>
                              </text>
                            );
                          }}
                        />
                      </PolarRadiusAxis>
                    </RadialBarChart>
                  </ChartContainer>
                </CardContent>
              </div>

              {/* Vertical line separator between cards on desktop */}
              {index < currentStats.length - 1 && (
                <>
                  {/* For lg screens: after 1st and 2nd items in a 3-column layout */}
                  <div
                    className={`hidden lg:block absolute top-1/2 transform -translate-y-1/2 w-[1px] h-4/5 bg-gray-300`}
                    style={{
                      left: `${((index + 1) / currentStats.length) * 100}%`,
                    }}
                  ></div>

                  {/* For md/sm screens: after 1st item in a 2-column layout */}
                  {index === 0 && currentStats.length > 1 && (
                    <div className="hidden sm:block lg:hidden absolute top-1/2 left-1/2 transform -translate-y-1/2 w-[1px] h-4/5 bg-gray-300"></div>
                  )}
                </>
              )}

              {/* Horizontal line separator between cards on mobile */}
              {index < currentStats.length - 1 && (
                <div className="block sm:hidden w-full h-[1px] bg-gray-300 my-4"></div>
              )}
            </React.Fragment>
          );
        })}
      </div>
    </Card>
  );
}