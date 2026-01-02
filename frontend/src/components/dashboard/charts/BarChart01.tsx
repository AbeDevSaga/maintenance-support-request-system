import { ChartBarInteractive } from "../../ui/shadcn-io/bar-chart-01"
import { ExternalChartBarInteractive } from "../../ui/shadcn-io/bar-chart-01/indexExternal";

function BarChart01({ userType }: { userType: string }) {
  if (userType === "internal") return <ChartBarInteractive />;
  return <ExternalChartBarInteractive />;
}

export default BarChart01