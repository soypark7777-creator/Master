import clsx from "clsx";

type StatusBadgeProps = {
  label: string;
  value: string;
  tone?: "gold" | "white" | "red";
};

const tones = {
  gold: "border-gold-300/40 bg-gold-300/10 text-gold-100",
  white: "border-white/15 bg-white/5 text-white",
  red: "border-rose-400/30 bg-rose-400/10 text-rose-100"
};

export function StatusBadge({
  label,
  value,
  tone = "white"
}: StatusBadgeProps) {
  return (
    <div
      className={clsx(
        "rounded-2xl border px-4 py-3 shadow-neon backdrop-blur",
        tones[tone]
      )}
    >
      <p className="text-[10px] uppercase tracking-[0.32em] text-white/55">
        {label}
      </p>
      <p className="mt-2 text-sm font-medium">{value}</p>
    </div>
  );
}
