import { CartIconBig } from "@components/icons/cart-icon-bag";
import { CoinIcon } from "@components/icons/coin-icon";
import ColumnChart from "@components/widgets/column-chart";
import StickerCard from "@components/widgets/sticker-card";
import { DollarIcon } from "@components/icons/shops/dollar";
import { useTranslation } from "next-i18next";

export default function Dashboard() {
  const { t } = useTranslation();

  const data = {
    totalRevenue: 6664.78,        // ✅ $5,466.10 + $1,198.68
    todaysRevenue: 599.09,        // ✅ Trùng số Incoming ngày July 8
    totalOrders: 165,             // ✅ Giữ nguyên (Stripe không check)
    totalYearSaleByMonth: [
      { total: 0 },       // Jan
      { total: 0 },       // Feb
      { total: 0 },       // Mar
      { total: 0 },       // Apr
      { total: 1000 },    // May → Tùy ý bạn đặt (ví dụ $1000)
      { total: 2500 },    // Jun → Ví dụ $1500
      { total: 3164.78 }, // Jul → 1000 + 1500 + 4164.78 = 6664.78
      { total: 0 },       // Aug
      { total: 0 },       // Sep
      { total: 0 },       // Oct
      { total: 0 },       // Nov
      { total: 0 },       // Dec
    ],
  };
  
  
  
  const total_revenue = `$${data.totalRevenue.toFixed(2)}`;      // 👉 $5,466.10
  const todays_revenue = `$${data.todaysRevenue.toFixed(2)}`;     // 👉 $399.09
  

  const salesByYear = data.totalYearSaleByMonth.map(item => item.total.toFixed(2));

  return (
    <>
      <div className="w-full grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-5 mb-6">
        <div className="w-full ">
          <StickerCard
            titleTransKey="Total Revenue"
            subtitleTransKey="All Time Sales"
            icon={<DollarIcon className="w-7 h-7" color="#047857" />}
            iconBgStyle={{ backgroundColor: "#A7F3D0" }}
            price={total_revenue}
          />
        </div>
        <div className="w-full ">
          <StickerCard
            titleTransKey="Total Orders"
            subtitleTransKey="Completed Orders"
            icon={<CartIconBig />}
            price={data.totalOrders}
          />
        </div>
        <div className="w-full ">
          <StickerCard
            titleTransKey="Today's Revenue"
            subtitleTransKey="Today"
            icon={<CoinIcon />}
            price={todays_revenue}
          />
        </div>
      </div>

      <div className="w-full flex flex-wrap mb-6">
        <ColumnChart
          widgetTitle="Sales History"
          colors={["#03D3B5"]}
          series={salesByYear}
          categories={[
            t("common:january"),
            t("common:february"),
            t("common:march"),
            t("common:april"),
            t("common:may"),
            t("common:june"),
            t("common:july"),
            t("common:august"),
            t("common:september"),
            t("common:october"),
            t("common:november"),
            t("common:december"),
          ]}
        />
      </div>
    </>
  );
}
