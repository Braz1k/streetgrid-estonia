import { CITIES, type CityId } from "@/lib/streetgrid/data";

type Props = {
  value: CityId;
  onChange: (id: CityId) => void;
};

export function CitySelector({ value, onChange }: Props) {
  return (
    <div
      className="sg-city"
      role="toolbar"
      aria-label="City selector"
    >
      <div className="sg-city__track">
        {CITIES.map((c) => {
          const active = c.id === value;
          return (
            <button
              key={c.id}
              type="button"
              onClick={() => onChange(c.id)}
              className={`sg-city__btn${active ? " sg-city__btn--active" : ""}`}
              aria-pressed={active}
            >
              {c.name}
            </button>
          );
        })}
      </div>
    </div>
  );
}
