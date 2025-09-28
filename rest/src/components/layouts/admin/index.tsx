import Navbar from "@components/layouts/navigation/top-navbar";
import { Fragment } from "react";
import MobileNavigation from "@components/layouts/navigation/mobile-navigation";
import { siteSettings } from "@settings/site.settings";
import { useTranslation } from "next-i18next";
import SidebarItem from "@components/layouts/navigation/sidebar-item";

const AdminLayout: React.FC = ({ children }) => {
  const { t } = useTranslation();

  const SidebarItemMap = () => (
    <Fragment>
      {siteSettings.sidebarLinks.admin.map(({ href, label, icon }) => (
        <SidebarItem href={href} label={t(label)} icon={icon} key={href} />
      ))}
    </Fragment>
  );

  return (
    <div className="min-h-screen bg-gray-100 flex flex-col transition-colors duration-150">
      <Navbar />
      <MobileNavigation>
        <SidebarItemMap />
      </MobileNavigation>

      <div className="flex flex-1 pt-20">
        {/* Sidebar luôn to */}
        <aside className="shadow overflow-y-auto bg-white fixed start-0 bottom-0 h-full pt-22 w-48 xl:w-76 px-4 hidden lg:block">
          <div className="flex items-center justify-center pb-6 flex-row">
            <a href={siteSettings.logo.href}>
              <img
                src={siteSettings.logo.url}
                alt={siteSettings.logo.alt}
                width={40}
                height={40}
              />
            </a>
            <span className="font-bold text-gray-900 ml-2">IDREAMSHIRT</span>
          </div>
          <div className="flex flex-col space-y-6 py-3">
            <SidebarItemMap />
          </div>
        </aside>

        {/* Main luôn cách sidebar đủ */}
        <main className="w-full transition-all duration-300 lg:ps-48 xl:ps-76">
          <div className="p-5 md:p-8 overflow-y-auto h-full">{children}</div>
        </main>
      </div>
    </div>
  );
};

export default AdminLayout;
