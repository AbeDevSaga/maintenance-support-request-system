import { ChartBarMixed } from "../../ui/shadcn-io/bar-chart-08";
import { ExternalChartBarMixed } from "../../ui/shadcn-io/bar-chart-08/indexExternal";

function BarChart08({ userType }: { userType: string }) {
  if (userType === "internal") return <ChartBarMixed />;
  return <ExternalChartBarMixed />;
}

export default BarChart08;
