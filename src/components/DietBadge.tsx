import { dietBadgeLabel } from "@/lib/dietary";

export function DietBadge({
  diet_class,
  dietary_modifiers,
  className = "",
}: {
  diet_class?: string;
  dietary_modifiers?: string[];
  className?: string;
}) {
  const label = dietBadgeLabel(diet_class, dietary_modifiers);
  if (!label) return null;
  const tone =
    label === "Non-Veg"
      ? "bg-rose-100 text-rose-900 border-rose-200"
      : label === "Vegan" || label === "Jain"
        ? "bg-emerald-100 text-emerald-900 border-emerald-200"
        : "bg-amber-50 text-amber-900 border-amber-200";
  return (
    <span
      className={`inline-flex items-center px-1.5 py-0.5 rounded-sm border text-[9px] uppercase tracking-wider font-semibold ${tone} ${className}`}
    >
      {label}
    </span>
  );
}
