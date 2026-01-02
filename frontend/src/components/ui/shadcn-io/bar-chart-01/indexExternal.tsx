"use client";

import * as React from "react";
import { Bar, BarChart, CartesianGrid, XAxis } from "recharts";

import {
  ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "../../chart";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../../select";
import { Card } from "../../card";
import { useGetDashboardStatsQuery } from "../../../../redux/services/dashboardApi";
import { Button } from "../../cn/button";
import { exportToCSV } from "../../../../utils/dashboardHelper";

export const description = "Branch Issue Counts";

/* =========================
   COMPONENT
   ========================= */
export function ExternalChartBarInteractive() {
  const { data: dashboardData, isLoading, isError } = useGetDashboardStatsQuery();

  // State for selected project
  const [selectedProjectId, setSelectedProjectId] = React.useState<string>("all");

  // Get all projects
  const projects = React.useMemo(() => {
    if (!dashboardData?.data?.institute?.projects) return [];
    return dashboardData.data.institute.projects;
  }, [dashboardData]);

  // Transform data for chart - Show branch issue counts
  const chartData = React.useMemo(() => {
    if (!dashboardData?.data?.institute?.projects) return [];

    const institute = dashboardData.data.institute;

    // Filter projects if a specific project is selected
    const targetProjects = selectedProjectId === "all"
      ? institute.projects
      : institute.projects.filter((p: any) => p.project_id === selectedProjectId);

    // Collect all branches with their issue counts
    const branchData: Record<string, {
      branchName: string;
      issueCount: number;
      projectNames: Set<string>;
      hierarchies: any[]
    }> = {};

    targetProjects.forEach((project: any) => {
      project.hierarchies?.forEach((hierarchy: any) => {
        const branchKey = hierarchy.hierarchy_node_id;
        const issueCount = hierarchy.issues?.length || 0;

        if (!branchData[branchKey]) {
          branchData[branchKey] = {
            branchName: hierarchy.name,
            issueCount: 0,
            projectNames: new Set<string>(),
            hierarchies: []
          };
        }

        branchData[branchKey].issueCount += issueCount;
        branchData[branchKey].projectNames.add(project.name);
        branchData[branchKey].hierarchies.push({
          ...hierarchy,
          projectName: project.name
        });
      });
    });

    // Convert to array format for chart
    return Object.values(branchData)
      .filter(branch => branch.issueCount > 0) // Only show branches with issues
      .map(branch => ({
        name: branch.branchName,
        issues: branch.issueCount,
        projects: Array.from(branch.projectNames).join(', '),
        projectCount: branch.projectNames.size,
        hierarchyCount: branch.hierarchies.length,
        branchId: branch.hierarchies[0]?.hierarchy_node_id || '',
        level: branch.hierarchies[0]?.level || 0
      }))
      .sort((a, b) => b.issues - a.issues); // Sort by issue count descending
  }, [dashboardData, selectedProjectId]);

  // Calculate totals
  const totals = React.useMemo(() => {
    const totalIssues = chartData.reduce((sum, branch) => sum + branch.issues, 0);
    const totalBranches = chartData.length;
    const totalProjects = selectedProjectId === "all"
      ? (dashboardData?.data?.institute?.projects?.length || 0)
      : 1;

    return {
      totalIssues,
      totalBranches,
      totalProjects
    };
  }, [chartData, dashboardData, selectedProjectId]);

  // Chart configuration
  const chartConfig = {
    issues: {
      label: "Number of Issues",
      color: "hsl(var(--chart-1))",
    },
  } satisfies ChartConfig;

  const exportData = React.useMemo(() => {
    if (!chartData.length) return [];

    return chartData.map((branch) => ({
      "Branch Name": branch.name,
      "Projects": branch.projects,
      "Issue Count": branch.issues,
      "Projects Count": branch.projectCount,
      "Hierarchy Level": branch.level,
      "Branch ID": branch.branchId
    }));
  }, [chartData]);

  if (isLoading) {
    return (
      <Card className="hover:shadow-lg transition-all duration-300 w-full h-full flex flex-col p-6">
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-2"></div>
            <p className="text-sm text-muted-foreground">Loading branch data...</p>
          </div>
        </div>
      </Card>
    );
  }

  if (isError) {
    return (
      <Card className="hover:shadow-lg transition-all duration-300 w-full h-full flex flex-col p-6">
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <p className="text-sm text-red-500 mb-2">Error loading chart data</p>
            <button
              onClick={() => window.location.reload()}
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
      <Card className="hover:shadow-lg transition-all duration-300 w-full h-full flex flex-col p-6">
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <p className="text-sm text-muted-foreground">No data available</p>
          </div>
        </div>
      </Card>
    );
  }

  const institute = dashboardData.data.institute;

  return (
    <Card className="hover:shadow-lg transition-all duration-300 w-full h-full flex flex-col p-6">
      {/* Header */}
      <div className="flex flex-col items-stretch border-b pb-4 mb-4 sm:flex-row">
        <div className="flex flex-1 flex-col justify-center gap-1">
          <h3 className="text-lg font-semibold">Branch Issue Counts</h3>
          <p className="text-sm text-muted-foreground">
            {selectedProjectId === "all"
              ? "Number of issues across all branches and projects"
              : `Issues by branch for selected project`}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            onClick={() =>
              exportToCSV(
                exportData,
                `branch_issues_${selectedProjectId === "all" ? "all_projects" : "selected_project"}.csv`
              )
            }
            disabled={!exportData.length}
            className="h-8 rounded-lg border px-3 text-xs font-medium
             hover:bg-muted disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Export CSV
          </Button>

          {/* Project Filter */}
          <Select
            value={selectedProjectId}
            onValueChange={setSelectedProjectId}
          >
            <SelectTrigger className="w-[180px] rounded-lg bg-white">
              <SelectValue placeholder="Select Project" />
            </SelectTrigger>

            <SelectContent className="rounded-xl bg-white">
              <SelectItem value="all" className="rounded-lg">
                <div className="flex flex-col">
                  <span className="text-sm font-medium">All Projects</span>
                  {/* <span className="text-xs text-muted-foreground">
                    {institute.projects.length} projects
                  </span> */}
                </div>
              </SelectItem>

              {projects.map((project: any) => (
                <SelectItem
                  key={project.project_id}
                  value={project.project_id}
                  className="rounded-lg"
                >
                  <div className="flex flex-col">
                    <span className="text-sm font-medium">{project.name}</span>
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Chart */}
      <div className="flex-1 flex items-center justify-center min-h-0">
        {chartData.length > 0 ? (
          <ChartContainer config={chartConfig} className="h-[250px] w-full">
            <BarChart
              accessibilityLayer
              data={chartData}
              margin={{
                left: 12,
                right: 12,
                top: 12,
                bottom: 12,
              }}
            >
              <CartesianGrid vertical={false} strokeDasharray="3 3" />
              <XAxis
                dataKey="name"
                tickLine={false}
                axisLine={false}
                tickMargin={8}
                minTickGap={10}
                interval={0}
                angle={-45}
                textAnchor="end"
                height={60}
                tickFormatter={(value) => {
                  // Truncate long branch names
                  if (value.length > 12) {
                    return value.substring(0, 12) + '...';
                  }
                  return value;
                }}
              />
              <ChartTooltip
                content={
                  <ChartTooltipContent
                    className="w-[250px]"
                    nameKey="issues"
                    labelFormatter={(value) => {
                      const branch = chartData.find(branch => branch.name === value);
                      return branch?.name || value;
                    }}
                    formatter={(value, name) => [
                      `${value} issue${value === 1 ? '' : 's'}`,
                      'Issue Count'
                    ]}
                    labelClassName="font-semibold"
                    indicator="dot"
                    extras={({ payload }) => {
                      if (!payload || !payload.length) return null;

                      const data = payload[0]?.payload;
                      if (!data) return null;

                      return (
                        <div className="flex flex-col gap-1 mt-2 pt-2 border-t">
                          <div className="flex items-center justify-between">
                            <span className="text-xs text-muted-foreground">Projects:</span>
                            <span className="text-xs font-medium">{data.projects}</span>
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="text-xs text-muted-foreground">Level:</span>
                            <span className="text-xs font-medium">{data.level}</span>
                          </div>
                        </div>
                      );
                    }}
                  />
                }
              />
              <Bar
                dataKey="issues"
                fill={`var(--color-issues)`}
                radius={[4, 4, 0, 0]}
                barSize={40}
              />
            </BarChart>
          </ChartContainer>
        ) : (
          <div className="flex items-center justify-center h-64 w-full">
            <p className="text-sm text-muted-foreground">
              {selectedProjectId === "all"
                ? "No issues found in any branch"
                : `No issues found in branches for the selected project`}
            </p>
          </div>
        )}
      </div>

      {/* Footer with summary stats */}
      {chartData.length > 0 && (
        <div className="flex flex-col items-start gap-2 text-sm pt-4 border-t">
          <div className="flex items-center gap-2 leading-none font-medium">
            <span>
              {selectedProjectId === "all"
                ? `${institute.name} - All Projects`
                : `Project: ${projects.find((p: any) => p.project_id === selectedProjectId)?.name}`}
            </span>
          </div>

          {/* Summary Stats */}
          <div className="flex flex-wrap gap-4 mt-1 text-xs">
            <div className="flex items-center gap-1">
              <span className="font-medium">Total Issues:</span>
              <span className="text-muted-foreground">{totals.totalIssues}</span>
            </div>
            <div className="flex items-center gap-1">
              <span className="font-medium">Branches:</span>
              <span className="text-muted-foreground">{totals.totalBranches}</span>
            </div>
            <div className="flex items-center gap-1">
              <span className="font-medium">Projects:</span>
              <span className="text-muted-foreground">{totals.totalProjects}</span>
            </div>
            <div className="flex items-center gap-1">
              <span className="font-medium">Avg Issues/Branch:</span>
              <span className="text-muted-foreground">
                {totals.totalBranches > 0
                  ? (totals.totalIssues / totals.totalBranches).toFixed(1)
                  : "0.0"}
              </span>
            </div>
          </div>

          {/* Branch with most issues */}
          {chartData.length > 0 && (
            <div className="flex items-center gap-1 text-xs mt-2">
              <span className="font-medium">Most Issues:</span>
              <span className="text-muted-foreground">
                {chartData[0].name} ({chartData[0].issues} issues)
              </span>
            </div>
          )}
        </div>
      )}
    </Card>
  );
}