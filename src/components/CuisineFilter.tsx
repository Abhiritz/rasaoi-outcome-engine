// Categorical cuisine selector — chips, not a dial (a dial implies an ordered axis).
// "All" is the default; selecting a cuisine narrows the outcome set without retraining the engine.

interface Props {
  value: string | null;
  options: string[];
  onChange: (cuisine: string | null) => void;
}

export const CuisineFilter = ({ value, options, onChange }: Props) => {
  const isActive = (c: string | null) => value === c;

  const baseClass =
    "text-[11px] uppercase tracking-[0.2em] px-3.5 py-1.5 rounded-sm border transition-elegant whitespace-nowrap font-medium";
  const active = "bg-primary text-card border-primary shadow-sm";
  const idle = "bg-card text-foreground/70 border-border/60 hover:border-gold/60 hover:text-primary";

  return (
    <section className="space-y-2">
      <div className="flex items-baseline justify-between">
        <label className="text-[10px] uppercase tracking-[0.25em] text-muted-foreground font-semibold">
          Cuisine
        </label>
        <span className="text-[10px] text-muted-foreground italic">
          {value ? `Filtering · ${value}` : "Showing all cuisines"}
        </span>
      </div>
      <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1 snap-x">
        <button
          onClick={() => onChange(null)}
          className={`${baseClass} ${isActive(null) ? active : idle}`}
        >
          All
        </button>
        {options.map((c) => (
          <button
            key={c}
            onClick={() => onChange(isActive(c) ? null : c)}
            className={`${baseClass} ${isActive(c) ? active : idle}`}
          >
            {c}
          </button>
        ))}
      </div>
    </section>
  );
};
