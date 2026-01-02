import AreaChart01 from "../charts/AreaChart01";
import BarChart01 from "../charts/BarChart01";
import BarChart08 from "../charts/BarChart08";
import PieChart11 from "../charts/PieChart11";

const ExternalDashboardLayout = () => {
  return (
    <div className="gap-10 rounded-xl flex flex-col justify-between bg-white">
      <div className="grid grid-cols-5 gap-10">
        <div className="col-span-3  ">
          <AreaChart01 userType="external" />
        </div>
        <div className="col-span-2  ">
          <BarChart08 userType="external" />
        </div>
      </div>
      <div className="grid grid-cols-5 gap-10">
        <div className="col-span-3  ">
          <BarChart01 userType="external" />
        </div>
        <div className="col-span-2  ">
          <PieChart11 userType="external" />
        </div>
      </div>
    </div>
  );
};

export default ExternalDashboardLayout;
