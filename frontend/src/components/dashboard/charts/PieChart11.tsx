import { ChartPieInteractive } from "../../ui/shadcn-io/pie-chart-11"
import { ExternalChartPieInteractive } from "../../ui/shadcn-io/pie-chart-11/indexExternal";

function PieChart11({ userType }: { userType: string }) {
  if (userType === "internal") return <ChartPieInteractive />;
  return <ExternalChartPieInteractive />;
}

export default PieChart11