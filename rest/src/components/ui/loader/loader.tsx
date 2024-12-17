import { HashLoader } from "react-spinners";
import cn from "classnames";

interface Props {
  className?: string;
  text?: string;
  showText?: boolean;
  simple?: boolean;
}

const Loader = (props: Props) => {
  const { className, showText = true, text = "Loading...", simple } = props;
  
  return (
    <>
      {simple ? (
        <div className={cn(className, styles.simple_loading)} />
      ) : (
        <div
          className={cn(
            "w-full flex flex-col items-center justify-center",
            className
          )}
          style={{ height: "calc(100vh - 200px)" }}
        >
          <HashLoader color="#36d7b7" size={50} />

          {showText && (
            <h1 className="text-lg font-semibold text-body italic"></h1>
          )}
        </div>
      )}
    </>
  );
};

export default Loader;
