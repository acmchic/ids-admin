import Navbar from "@components/layouts/navigation/top-navbar";
import { Fragment } from "react";
import MobileNavigation from "@components/layouts/navigation/mobile-navigation";
import { siteSettings } from "@settings/site.settings";
import { useTranslation } from "next-i18next";
import SidebarItem from "@components/layouts/navigation/sidebar-item";
import { useUI } from "@contexts/ui.context";
import { ToggleIcon } from "@components/icons/sidebar";

const AdminLayout: React.FC = ({ children }) => {
  const { t } = useTranslation();
  const { displayDesktopSidebar, toggleDesktopSidebar } = useUI();

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
        <aside className={`shadow overflow-y-auto bg-white fixed start-0 bottom-0 h-full pt-22 transition-all duration-300 ${
          displayDesktopSidebar 
            ? 'w-42 xl:w-76 px-4' 
            : 'w-16 px-2'
        } hidden lg:block`}>
          <div className={`flex items-center justify-center pb-6 ${displayDesktopSidebar ? 'flex-row' : 'flex-col'}`}>
            <a href={siteSettings.logo.href}>
              <img
                src={siteSettings.logo.url}
                alt={siteSettings.logo.alt}
                width={40}
                height={40}
              />
            </a>
            {displayDesktopSidebar && (
              <span className="font-bold text-gray-900 ml-2">IDREAMSHIRT</span>
            )}
          </div>
          <div className="flex flex-col space-y-6 py-3">
            <SidebarItemMap />
          </div>
          <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2">
            <button
              onClick={toggleDesktopSidebar}
              className="p-2 rounded-full bg-gray-100 hover:bg-gray-200 transition-colors duration-200"
              title={displayDesktopSidebar ? "Thu gọn sidebar" : "Mở rộng sidebar"}
            >
              <ToggleIcon 
                className="w-4 h-4 text-gray-600" 
                isOpen={displayDesktopSidebar}
              />
            </button>
          </div>
        </aside>
        <main className={`w-full transition-all duration-300 ${
          displayDesktopSidebar ? 'lg:ps-40 xl:ps-76' : 'lg:ps-16'
        }`}>
          <div className="p-5 md:p-8 overflow-y-auto h-full">{children}</div>
        </main>
      </div>
    </div>
  );
};
export default AdminLayout;
