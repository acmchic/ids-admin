import Link from "@components/ui/link";
import { getIcon } from "@utils/get-icon";
import * as sidebarIcons from "@components/icons/sidebar";

const SidebarItem = ({ href, icon, label, collapsed = false }: any) => {
  return (
    <Link
      href={href}
      className={`flex w-full items-center text-base text-body-dark text-start focus:text-accent ${
        collapsed ? "justify-center" : ""
      }`}
      title={label}
    >
      {getIcon({
        iconList: sidebarIcons,
        iconName: icon,
        className: collapsed ? "w-5 h-5" : "w-5 h-5 me-4",
      })}
      {!collapsed && <span>{label}</span>}
    </Link>
  );
};

export default SidebarItem;
