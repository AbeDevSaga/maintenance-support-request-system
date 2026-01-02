import ExternalStatasCard from "../../components/dashboard/cards/ExternalStatasCard";
import ExternalDashboardLayout from "../../components/dashboard/layout/ExternalDashboardLayout";

function ExternalDashboard() {
  return (
    <div className="flex flex-col space-y-6">
      <ExternalStatasCard />
      <ExternalDashboardLayout />
    </div>
  );
}

export default ExternalDashboard;
