import { useState, useEffect, useRef } from "react";
import { INITIAL_CHAT_BY_CITY, getCity, type CityId } from "@/lib/streetgrid/data";
import { useStreetGrid } from "@/lib/streetgrid/store";
import { Send, Siren } from "lucide-react";

type Msg = { user: string; text: string; time: string; me?: boolean; sos?: boolean };

export function ChatPanel({ city }: { city: CityId }) {
  const { profile, chatInjections } = useStreetGrid();
  const cityKey: keyof typeof INITIAL_CHAT_BY_CITY = city === "all" ? "tallinn" : city;
  const [msgs, setMsgs] = useState<Msg[]>(INITIAL_CHAT_BY_CITY[cityKey]);
  const [text, setText] = useState("");
  const endRef = useRef<HTMLDivElement>(null);
  const lastInjTs = useRef(0);

  useEffect(() => {
    setMsgs(INITIAL_CHAT_BY_CITY[cityKey]);
    lastInjTs.current = 0;
  }, [cityKey]);

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth" }); }, [msgs]);

  // Background bot chatter
  useEffect(() => {
    const t = setInterval(() => {
      const samples = INITIAL_CHAT_BY_CITY[cityKey];
      const s = samples[Math.floor(Math.random() * samples.length)];
      setMsgs((m) => [...m, { ...s, time: new Date().toLocaleTimeString("ru", { hour: "2-digit", minute: "2-digit" }) }]);
    }, 25000);
    return () => clearInterval(t);
  }, [cityKey]);

  // Consume injected chat events (SOS etc.)
  useEffect(() => {
    const fresh = chatInjections.filter((c) => c.ts > lastInjTs.current && c.city === cityKey);
    if (!fresh.length) return;
    lastInjTs.current = fresh[fresh.length - 1].ts;
    setMsgs((m) => [...m, ...fresh.map((f) => ({ user: f.user, text: f.text, time: f.time, sos: f.sos }))]);
  }, [chatInjections, cityKey]);

  const send = () => {
    if (!text.trim()) return;
    setMsgs((m) => [...m, { user: profile.handle, text: text.trim(), time: new Date().toLocaleTimeString("ru", { hour: "2-digit", minute: "2-digit" }), me: true }]);
    setText("");
  };

  const cityName = getCity(city).name;

  return (
    <div className="flex flex-col h-[calc(100vh-260px)] pb-24">
      <div className="px-4 pt-4 pb-2 border-b border-white/5">
        <h2 className="font-display text-lg font-black">ЧАТ · {cityName.toUpperCase()}</h2>
        <p className="text-[10px] text-muted-foreground tracking-widest mt-0.5">● {city === "all" ? 612 : 234} ONLINE</p>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-2.5">
        {msgs.map((m, i) => {
          const me = m.user === profile.handle || m.me;
          if (m.sos) {
            return (
              <div key={i} className="flex justify-center animate-float-up">
                <div className="max-w-[92%] rounded-2xl px-3.5 py-2.5 bg-primary/10 border border-primary/40 glow-red">
                  <div className="flex items-center gap-2 text-[10px] font-black tracking-widest text-primary mb-1">
                    <Siren className="h-3.5 w-3.5 animate-pulse" /> SOS · {m.user}
                  </div>
                  <div className="text-sm leading-snug">{m.text}</div>
                  <div className="text-[9px] mt-1 text-muted-foreground text-right">{m.time}</div>
                </div>
              </div>
            );
          }
          return (
            <div key={i} className={`flex ${me ? "justify-end" : "justify-start"} animate-float-up`}>
              <div className={`max-w-[78%] rounded-2xl px-3.5 py-2 ${me ? "bg-primary text-primary-foreground rounded-br-sm" : "glass rounded-bl-sm"}`}>
                {!me && <div className="text-[10px] font-bold tracking-wider text-accent mb-0.5">{m.user}</div>}
                <div className="text-sm leading-snug">{m.text}</div>
                <div className={`text-[9px] mt-1 ${me ? "text-white/60" : "text-muted-foreground"} text-right`}>{m.time}</div>
              </div>
            </div>
          );
        })}
        <div ref={endRef} />
      </div>

      <div className="px-4 py-3 border-t border-white/5 glass-strong">
        <div className="flex items-center gap-2">
          <input
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && send()}
            placeholder={`Написать в чат ${cityName}...`}
            className="flex-1 h-11 bg-white/5 border border-white/10 rounded-xl px-4 text-sm outline-none focus:border-primary/50 focus:bg-white/10 transition"
          />
          <button
            onClick={send}
            className="h-11 w-11 rounded-xl bg-primary grid place-items-center glow-red active:scale-95 transition"
          >
            <Send className="h-4 w-4 text-primary-foreground" />
          </button>
        </div>
      </div>
    </div>
  );
}
