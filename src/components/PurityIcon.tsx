import { Leaf, Sprout, Wheat } from "lucide-react";

const map = {
  sovereign: { Icon: Leaf, label: "Good for you" },
  conscious: { Icon: Sprout, label: "Natural" },
  satellite: { Icon: Wheat, label: "Standard" },
} as const;

export const PurityIcon = ({ tier, size = 14 }: { tier: string; size?: number }) => {
  const entry = map[(tier as keyof typeof map)] ?? map.satellite;
  const { Icon, label } = entry;
  return (
    <span title={label} aria-label={`Purity: ${label}`} className="inline-flex items-center text-gold">
      <Icon size={size} />
    </span>
  );
};
