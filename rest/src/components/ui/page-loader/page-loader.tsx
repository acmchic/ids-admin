import { PacmanLoader } from "react-spinners";
import { useTranslation } from "next-i18next";
import cn from "classnames";

const PageLoader = () => {
  const { t } = useTranslation("common");

  return (
    <div
      className={cn(
        "w-full h-screen flex flex-col items-center justify-center"
      )}
    >
      <div className="flex relative">
        <PacmanLoader color="#36d7b7" size={80} />

        <h3 className="text-sm font-semibold text-body italic absolute top-1/2 -mt-2 w-full text-center">
        </h3>
      </div>
    </div>
  );
};

export default PageLoader;
