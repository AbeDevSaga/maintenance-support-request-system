import { InternalChartAreaInteractive } from "../../ui/shadcn-io/area-chart-01";
import { ExternalChartAreaInteractive } from "../../ui/shadcn-io/area-chart-01/indexInternal";

function AreaChart01({
  userType,
}: {
  userType: string;
}) {
  if (userType === "internal") return <InternalChartAreaInteractive />;
  return <ExternalChartAreaInteractive />;
}

export default AreaChart01;
