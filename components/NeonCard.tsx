import clsx from "clsx";

type NeonCardProps = {
  children: React.ReactNode;
  className?: string;
};

export function NeonCard({ children, className }: NeonCardProps) {
  return (
    <div
      className={clsx(
        "rounded-[1.75rem] border border-white/10 bg-white/[0.045] p-5 shadow-stage backdrop-blur-xl",
        className
      )}
    >
      {children}
    </div>
  );
}
