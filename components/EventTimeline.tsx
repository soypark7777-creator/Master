import clsx from "clsx";
import { TimelineEvent } from "@/lib/types";

type EventTimelineProps = {
  events: TimelineEvent[];
};

const styles = {
  laser: "border-sky-300/25 bg-sky-400/10 text-sky-100",
  pyro: "border-amber-300/25 bg-amber-400/10 text-amber-100",
  flash: "border-white/20 bg-white/10 text-white"
};

export function EventTimeline({ events }: EventTimelineProps) {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.3em] text-white/45">
            FX Timeline
          </p>
          <h2 className="mt-2 text-xl font-semibold text-white">
            Event Accumulation
          </h2>
        </div>
        <div className="rounded-full border border-white/10 bg-white/5 px-3 py-2 text-xs text-white/65">
          {events.length} logs
        </div>
      </div>

      <div className="space-y-3">
        {events.length === 0 ? (
          <div className="rounded-[1.5rem] border border-dashed border-white/12 bg-white/[0.02] p-6 text-sm text-white/45">
            레이저/폭죽 이벤트가 감지되면 타임라인 카드가 누적됩니다.
          </div>
        ) : (
          events.map((event) => (
            <article
              key={event.id}
              className={clsx(
                "rounded-[1.35rem] border p-4 shadow-neon backdrop-blur",
                styles[event.type]
              )}
            >
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-[11px] uppercase tracking-[0.28em] text-white/55">
                    {event.timestamp}
                  </p>
                  <p className="mt-2 text-sm font-medium">{event.label}</p>
                </div>
                <span className="rounded-full border border-current/20 px-3 py-1 text-[10px] uppercase tracking-[0.24em]">
                  {event.type}
                </span>
              </div>
            </article>
          ))
        )}
      </div>
    </div>
  );
}
