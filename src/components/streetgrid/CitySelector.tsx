import { CITIES, type CityId } from "@/lib/streetgrid/data";

type Props = {
  value: CityId;
  onChange: (id: CityId) => void;
};

function cityLabel(id: CityId, name: string, short: string) {
  if (id === "all") {
    return <span>ЭСТОНИЯ</span>;
  }

  return (
    <>
      <span className="sg-city__btn-code">{short}</span>
      <span>{name.toUpperCase()}</span>
    </>
  );
}

export function CitySelector({ value, onChange }: Props) {
  return (
    <div
      className="sg-city city-tabs-row"
      role="toolbar"
      aria-label="City selector"
      style={{ position: "relative", zIndex: 2, background: "#0a0a14" }}
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
              {cityLabel(c.id, c.name, c.short)}
            </button>
          );
        })}
      </div>
    </div>
  );
}
