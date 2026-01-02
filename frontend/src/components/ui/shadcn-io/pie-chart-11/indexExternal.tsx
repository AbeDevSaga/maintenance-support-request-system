"use client";

import * as React from "react";
import { Pie, PieChart, Label, Cell } from "recharts";

import {
  ChartConfig,
  ChartContainer,
  ChartStyle,
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

export const description =
  "Raised maintenance requests by priority filtered by project and branch";

/* =========================
   COMPONENT
   ========================= */
export function ExternalChartPieInteractive() {
  const id = "pie-project-priority";

  // Get dashboard data
  const { data: dashboardData, isLoading, isError } = useGetDashboardStatsQuery();

  // State for filters
  const [selectedProjectId, setSelectedProjectId] = React.useState<string>("all");
  const [selectedBranchId, setSelectedBranchId] = React.useState<string | null>(null);

  // Get all projects
  const projects = React.useMemo(() => {
    if (!dashboardData?.data?.institute?.projects) return [];
    return dashboardData.data.institute.projects;
  }, [dashboardData]);

  // Get all unique branches across selected project(s)
  const availableBranches = React.useMemo(() => {
    if (!dashboardData?.data?.institute?.projects) return [];

    const instituteProjects = dashboardData.data.institute.projects;

    // If no project selected, get all branches from all projects
    const targetProjects = selectedProjectId === "all"
      ? instituteProjects
      : instituteProjects.filter((p: any) => p.project_id === selectedProjectId);

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

  // Transform data for chart - Group by priority
  const { chartData, chartConfig, totalRaised } = React.useMemo(() => {
    if (!dashboardData?.data?.institute?.projects) {
      return { chartData: [], chartConfig: {}, totalRaised: 0 };
    }

    const institute = dashboardData.data.institute;

    // Filter projects if a specific project is selected
    const targetProjects = selectedProjectId === "all"
      ? institute.projects
      : institute.projects.filter((p: any) => p.project_id === selectedProjectId);

    // Collect all issues and group by priority
    const priorityMap = new Map();

    targetProjects.forEach((project: any) => {
      project.hierarchies?.forEach((hierarchy: any) => {
        // Filter by branch if selected
        if (selectedBranchId && hierarchy.hierarchy_node_id !== selectedBranchId) {
          return;
        }

        hierarchy.issues?.forEach((issue: any) => {
          if (!issue.priority) return; // Skip issues without priority

          const priorityId = issue.priority_id;
          const priorityName = issue.priority.name;
          const priorityColor = issue.priority.color_value || "#cccccc"; // Default gray

          if (!priorityMap.has(priorityId)) {
            priorityMap.set(priorityId, {
              priorityId,
              name: priorityName,
              value: 0,
              color: priorityColor,
              description: issue.priority.description || ""
            });
          }

          priorityMap.get(priorityId).value += 1;
        });
      });
    });

    // Convert map to array and sort by count descending
    const chartDataArray = Array.from(priorityMap.values())
      .map(item => ({
        ...item,
        status: item.name.toLowerCase().replace(/\s+/g, '_') // Create a status key from priority name
      }))
      .sort((a, b) => b.value - a.value);

    // Create dynamic chart config based on priorities
    const dynamicChartConfig: ChartConfig = {
      value: {
        label: "Requests",
      },
    };

    // Add each priority to chart config
    chartDataArray.forEach(item => {
      dynamicChartConfig[item.status] = {
        label: item.name,
        color: item.color,
      };
    });

    // Calculate total
    const total = chartDataArray.reduce((sum, item) => sum + item.value, 0);

    return {
      chartData: chartDataArray,
      chartConfig: dynamicChartConfig,
      totalRaised: total,
    };
  }, [dashboardData, selectedProjectId, selectedBranchId]);

  const exportData = React.useMemo(() => {
    if (!dashboardData?.data?.institute?.projects || chartData.length === 0) {
      return [];
    }

    const institute = dashboardData.data.institute;

    return chartData.map((item) => ({
      Institute: institute.name,
      Project: selectedProjectId === "all"
        ? "All Projects"
        : institute.projects.find((p: any) => p.project_id === selectedProjectId)?.name || "All Projects",
      Branch: selectedBranchId
        ? availableBranches.find((b: any) => b.hierarchy_node_id === selectedBranchId)?.name || "All Branches"
        : "All Branches",
      Priority: item.name,
      Requests: item.value,
      "Priority Color": item.color,
    }));
  }, [dashboardData, selectedProjectId, selectedBranchId, chartData, availableBranches]);

  if (isLoading) {
    return (
      <Card
        data-chart={id}
        className="hover:shadow-lg transition-all duration-300 w-full h-full flex flex-col space-y-4 p-6"
      >
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-2"></div>
            <p className="text-sm text-muted-foreground">Loading priority data...</p>
          </div>
        </div>
      </Card>
    );
  }

  if (isError || !dashboardData?.data?.institute?.projects?.length) {
    return (
      <Card
        data-chart={id}
        className="hover:shadow-lg transition-all duration-300 w-full h-full flex flex-col space-y-4 p-6"
      >
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

  const institute = dashboardData.data.institute;

  return (
    <Card
      data-chart={id}
      className="hover:shadow-lg transition-all duration-300 w-full h-full flex flex-col space-y-4 p-6"
    >
      <ChartStyle id={id} config={chartConfig} />

      {/* Header */}
      <div className="flex flex-col 3xl:flex-row items-start gap-3 justify-between ">
        <div className="grid gap-1">
          <h3 className="text-lg font-semibold">
            Maintenance Support Requests
          </h3>
          <p className="text-sm text-muted-foreground">
            Raised requests by priority
          </p>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap gap-2">
          <Button
            onClick={() =>
              exportToCSV(
                exportData,
                `requests_by_priority_${selectedProjectId === "all" ? "all" : "project"}_${selectedBranchId || "all"}.csv`
              )
            }
            disabled={!exportData.length}
            className="h-7 rounded-lg border px-3 text-xs font-medium
             hover:bg-muted disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Export CSV
          </Button>

          {/* Project Filter */}
          <Select
            value={selectedProjectId}
            onValueChange={(value) => {
              setSelectedProjectId(value);
              setSelectedBranchId(null); // Reset branch when project changes
            }}
          >
            <SelectTrigger
              className="h-7 w-[160px] rounded-lg pl-2.5 bg-white"
              aria-label="Select project"
            >
              <SelectValue placeholder="Select project" />
            </SelectTrigger>
            <SelectContent align="end" className="rounded-xl bg-white">
              <SelectItem value="all" className="rounded-lg">
                <div className="flex flex-col">
                  <span className="text-sm font-medium">All Projects</span>
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

          {/* Branch Filter */}
          <Select
            value={selectedBranchId || "all"}
            onValueChange={(value) => {
              setSelectedBranchId(value === "all" ? null : value);
            }}
            disabled={availableBranches.length === 0}
          >
            <SelectTrigger
              className="h-7 w-[160px] rounded-lg pl-2.5 bg-white"
              aria-label="Select branch"
            >
              <SelectValue placeholder="Select branch" />
            </SelectTrigger>
            <SelectContent align="end" className="rounded-xl bg-white">
              <SelectItem value="all" className="rounded-lg">
                <div className="flex flex-col">
                  <span className="text-sm font-medium">All Branches</span>
                  <span className="text-xs text-muted-foreground">
                    {availableBranches.length} branches
                  </span>
                </div>
              </SelectItem>
              {availableBranches.map((branch: any) => (
                <SelectItem
                  key={branch.hierarchy_node_id}
                  value={branch.hierarchy_node_id}
                  className="rounded-lg"
                >
                  <div className="flex flex-col">
                    <span className="text-sm font-medium">{branch.name}</span>
                    <span className="text-xs text-muted-foreground">
                      {branch.total_issues} issues • {branch.project_name}
                    </span>
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Chart + Priority Legend */}
      <div className="flex justify-center items-center space-x-2">
        {chartData.length > 0 ? (
          <>
            <ChartContainer
              id={id}
              config={chartConfig}
              className="mx-auto aspect-square w-full max-w-[300px]"
            >
              <PieChart>
                <ChartTooltip
                  cursor={false}
                  content={<ChartTooltipContent hideLabel />}
                />
                <Pie
                  data={chartData}
                  dataKey="value"
                  nameKey="name"
                  innerRadius={60}
                  strokeWidth={5}
                >
                  {chartData.map((entry) => (
                    <Cell
                      key={entry.priorityId}
                      fill={entry.color}
                    />
                  ))}

                  <Label
                    content={({ viewBox }) => {
                      if (viewBox && "cx" in viewBox && "cy" in viewBox) {
                        return (
                          <text
                            x={viewBox.cx}
                            y={viewBox.cy}
                            textAnchor="middle"
                            dominantBaseline="middle"
                          >
                            <tspan
                              x={viewBox.cx}
                              y={viewBox.cy}
                              className="fill-foreground text-3xl font-bold"
                            >
                              {totalRaised}
                            </tspan>
                            <tspan
                              x={viewBox.cx}
                              y={(viewBox.cy || 0) + 24}
                              className="fill-muted-foreground"
                            >
                              Total Issues
                            </tspan>
                          </text>
                        );
                      }
                    }}
                  />
                </Pie>
              </PieChart>
            </ChartContainer>

            {/* Priority Legend */}
            <div className="mx-auto aspect-square w-full max-w-[300px] flex items-center">
              <div className="rounded-xl">
                {chartData.map((item) => (
                  <div
                    key={item.priorityId}
                    className="rounded-lg [&_span]:flex mt-4"
                  >
                    <div className="flex items-center gap-2 text-xs">
                      <span
                        className="flex h-3 w-3 shrink-0 rounded-xs"
                        style={{ backgroundColor: item.color }}
                      />
                      <span className="font-medium">{item.name}</span>
                      <span className="text-muted-foreground ml-1">
                        ({item.value})
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </>
        ) : (
          <div className="flex items-center justify-center w-full h-64">
            <p className="text-sm text-muted-foreground">
              No priority data available for selected filters
            </p>
          </div>
        )}
      </div>

      {/* Summary Stats */}
      {chartData.length > 0 && (
        <div className="flex flex-wrap gap-4 mt-3 text-xs justify-center">
          <div className="flex items-center gap-1">
            <span className="font-medium">Total Issues:</span>
            <span className="text-muted-foreground">{totalRaised}</span>
          </div>
          <div className="flex items-center gap-1">
            <span className="font-medium">Priorities:</span>
            <span className="text-muted-foreground">{chartData.length}</span>
          </div>
          <div className="flex items-center gap-1">
            <span className="font-medium">Top Priority:</span>
            <span className="text-muted-foreground">
              {chartData.length > 0 ? chartData[0].name : "None"}
            </span>
          </div>
          <div className="flex items-center gap-1">
            <span className="font-medium">Selected:</span>
            <span className="text-muted-foreground">
              {selectedProjectId === "all" ? "All Projects" :
                projects.find((p: any) => p.project_id === selectedProjectId)?.name}
              {selectedBranchId && ` • ${availableBranches.find((b: any) => b.hierarchy_node_id === selectedBranchId)?.name
                }`}
            </span>
          </div>
        </div>
      )}
    </Card>
  );
}