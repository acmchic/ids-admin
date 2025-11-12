import Navbar from "@components/layouts/navigation/top-navbar";
import { Fragment, useMemo, useState } from "react";
import MobileNavigation from "@components/layouts/navigation/mobile-navigation";
import { siteSettings } from "@settings/site.settings";
import { useTranslation } from "next-i18next";
import SidebarItem from "@components/layouts/navigation/sidebar-item";

const AdminLayout: React.FC = ({ children }) => {
  const { t } = useTranslation();
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(true);

  const SidebarLinks = ({ collapsed }: { collapsed: boolean }) => (
    <Fragment>
      {siteSettings.sidebarLinks.admin.map(({ href, label, icon }) => (
        <SidebarItem href={href} label={t(label)} icon={icon} key={href} collapsed={collapsed} />
      ))}
    </Fragment>
  );

  const sidebarWidthClass = useMemo(
    () => (isSidebarCollapsed ? "lg:w-16 xl:w-16" : "lg:w-8 xl:w-8"),
    [isSidebarCollapsed]
  );

  const sidebarPaddingClass = useMemo(
    () => (isSidebarCollapsed ? "px-2" : "px-2"),
    [isSidebarCollapsed]
  );

  const mainPaddingClass = useMemo(
    () => (isSidebarCollapsed ? "lg:ps-16 xl:ps-16" : "lg:ps-16 xl:ps-16"),
    [isSidebarCollapsed]
  );

  return (
    <div className="min-h-screen bg-gray-100 flex flex-col transition-colors duration-150">
      <Navbar />
      <MobileNavigation>
        <SidebarLinks collapsed={false} />
      </MobileNavigation>

      <div className="flex flex-1 pt-20">
        {/* Sidebar */}
        <aside
          className={`shadow overflow-y-auto bg-white fixed start-0 bottom-0 h-full pt-22 hidden lg:block transition-all duration-300 ${sidebarWidthClass} ${sidebarPaddingClass}`}
        >
          <div className={`flex items-center ${isSidebarCollapsed ? "justify-center" : "justify-start"} pb-6`}>
            <button
              onClick={() => setIsSidebarCollapsed((prev) => !prev)}
              className={`flex items-center w-full rounded-lg focus:outline-none focus:ring-2 focus:ring-accent transition-colors ${
                isSidebarCollapsed ? "justify-center" : "justify-start px-2 hover:bg-gray-100"
              }`}
              aria-label={isSidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
            >
              <img
                src={siteSettings.logo.url}
                alt={siteSettings.logo.alt}
                width={isSidebarCollapsed ? 36 : 40}
                height={isSidebarCollapsed ? 36 : 40}
              />
              {!isSidebarCollapsed && (
                <span className="font-bold text-gray-900 ml-2">IDREAMSHIRT</span>
              )}
            </button>
          </div>
          <div className="flex flex-col space-y-6 py-3">
            <SidebarLinks collapsed={isSidebarCollapsed} />
          </div>
        </aside>

        {/* Main content */}
        <main className={`w-full transition-all duration-300 ${mainPaddingClass}`}>
          <div className="p-5 md:p-8 overflow-y-auto h-full">{children}</div>
        </main>
      </div>
    </div>
  );
};

export default AdminLayout;
