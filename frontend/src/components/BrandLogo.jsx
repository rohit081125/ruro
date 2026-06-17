import rurologo from "../assets/rurologo.png";

const sizeClasses = {
  sm: "w-[124px] h-9",
  md: "w-[152px] h-11",
  lg: "w-[184px] h-14",
};

const BrandLogo = ({ size = "md", className = "" }) => {
  return (
    <div
      className={`${sizeClasses[size]} ${className} rounded-xl bg-white shadow-lg shadow-violet-950/20 ring-1 ring-white/10 overflow-hidden flex items-center justify-center`}
    >
      <img
        src={rurologo}
        alt="RURO"
        className="w-full h-full object-cover object-center"
      />
    </div>
  );
};

export default BrandLogo;
