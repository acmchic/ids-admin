import Link from "@components/ui/link";
import { getIcon } from "@utils/get-icon";
import * as sidebarIcons from "@components/icons/sidebar";
import { useUI } from "@contexts/ui.context";

const SidebarItem = ({ href, icon, label }: any) => {
  const { closeSidebar, displayDesktopSidebar } = useUI();
  return (
    <Link
      href={href}
      className="flex w-full items-center text-base text-body-dark text-start focus:text-accent"
      title={!displayDesktopSidebar ? label : undefined}
    >
      {getIcon({
        iconList: sidebarIcons,
        iconName: icon,
        className: `w-5 h-5 ${displayDesktopSidebar ? 'me-4' : 'mx-auto'}`,
      })}
      {displayDesktopSidebar && (
        <span onClick={() => closeSidebar()}>{label}</span>
      )}
    </Link>
  );
};

export default SidebarItem;
