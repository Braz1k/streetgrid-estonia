import { X } from "lucide-react";
import type { SosSignal } from "@/lib/streetgrid/data";

type Props = {
  signal: SosSignal | null;
  ownerHandle: string;
  onClose: () => void;
  onRoute: (coords: [number, number], name: string) => void;
  onCancel: (id: string) => void;
  onResolve: (id: string) => void;
};

export function SosAlertCard({
  signal,
  ownerHandle,
  onClose,
  onRoute,
  onCancel,
  onResolve,
}: Props) {
  if (!signal) return null;

  const note = signal.note?.trim();
  const isOwner = signal.user === ownerHandle;

  return (
    <div className="sg-sos-alert" role="dialog" aria-label="SOS сигнал">
      <div className="sg-sos-alert__head">
        <span className="sg-sos-alert__led" aria-hidden />
        <div className="sg-sos-alert__kicker">SOS</div>
        {isOwner ? <span className="sg-sos-alert__role">ВАШ СИГНАЛ</span> : null}
        <button
          type="button"
          className="sg-sos-alert__close"
          onClick={onClose}
          aria-label="Закрыть"
        >
          <X className="sg-sos-alert__close-icon" />
        </button>
      </div>

      <div className="sg-sos-alert__title">{signal.label}</div>
      {note ? <p className="sg-sos-alert__note">{note}</p> : null}
      <div className="sg-sos-alert__meta">
        {signal.user} · {signal.time}
      </div>

      {isOwner ? (
        <div className="sg-sos-alert__actions">
          <button
            type="button"
            className="sg-sos-alert__chip"
            onClick={() => onCancel(signal.id)}
          >
            ОТМЕНИТЬ СИГНАЛ
          </button>
          <button
            type="button"
            className="sg-sos-alert__chip sg-sos-alert__chip--ok"
            onClick={() => onResolve(signal.id)}
          >
            ПОМОЩЬ ОКАЗАНА
          </button>
        </div>
      ) : (
        <button
          type="button"
          className="sg-sos-alert__chip sg-sos-alert__chip--go"
          onClick={() => onRoute(signal.coords, "SOS · " + signal.label)}
        >
          ПОЕХАЛИ
        </button>
      )}
    </div>
  );
}
