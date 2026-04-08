import { useState, useRef, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const QUICK_PROMPTS = [
  { label: "Is this a valid setup?", prompt: "Is this stock a valid setup right now per my system rules? Check E1-E6 against the live data." },
  { label: "What setup type?", prompt: "What setup type would this be — breakout, pullback, or bounce? Why?" },
  { label: "Suggest stop & target", prompt: "Based on the current chart, where would you place a stop and target? Calculate the R:R." },
  { label: "Should I skip?", prompt: "Should I skip this trade? What's the strongest reason to NOT take it?" },
];

export default function ChartCoach({ ticker, portfolio }) {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef(null);

  // Reset chat when ticker changes
  useEffect(() => {
    setMessages([]);
    setInput("");
  }, [ticker]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const send = async (text) => {
    const msg = text || input.trim();
    if (!msg || loading || !ticker) return;

    const userMsg = { role: "user", content: msg };
    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    setInput("");
    setLoading(true);

    try {
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
      const res = await fetch(`${supabaseUrl}/functions/v1/ai-coach`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${supabaseKey}`,
        },
        body: JSON.stringify({
          messages: newMessages.map(m => ({ role: m.role, content: m.content })),
          portfolio,
          chartTicker: ticker,
        }),
      });

      if (!res.ok) {
        const errBody = await res.text();
        throw new Error(`${res.status}: ${errBody}`);
      }
      const data = await res.json();
      if (!data || !data.response) throw new Error("Empty response from coach");
      setMessages(prev => [...prev, { role: "assistant", content: data.response }]);
    } catch (err) {
      setMessages(prev => [...prev, { role: "assistant", content: `Error: ${err.message}` }]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center gap-2 mb-3">
          <span className="text-xs text-primary tracking-wider uppercase font-semibold">✦ Coach — analyzing {ticker}</span>
          <span className="text-[10px] text-muted-foreground">live market data</span>
        </div>

        {/* Quick prompts */}
        <div className="flex flex-wrap gap-1.5 mb-3">
          {QUICK_PROMPTS.map((q, i) => (
            <Button key={i} variant="outline" size="sm" onClick={() => send(q.prompt)}
              disabled={loading} className="text-[10px] h-7">
              {q.label}
            </Button>
          ))}
        </div>

        {/* Messages */}
        {messages.length > 0 && (
          <div className="max-h-[300px] overflow-y-auto mb-3 space-y-2 p-2 bg-accent/30 rounded-lg">
            {messages.map((m, i) => (
              <div key={i} className={cn("flex", m.role === "user" ? "justify-end" : "justify-start")}>
                <div className={cn(
                  "max-w-[90%] rounded-md px-3 py-2 text-xs leading-relaxed",
                  m.role === "user" ? "bg-primary text-primary-foreground" : "bg-card text-foreground border border-border"
                )}>
                  <div className="whitespace-pre-wrap">{m.content}</div>
                </div>
              </div>
            ))}
            {loading && (
              <div className="flex justify-start">
                <div className="bg-card border border-border rounded-md px-3 py-2 text-xs text-muted-foreground animate-pulse">Analyzing chart…</div>
              </div>
            )}
            <div ref={bottomRef} />
          </div>
        )}

        {/* Input */}
        <div className="flex gap-2">
          <Input
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key === "Enter" && send()}
            placeholder={`Ask about ${ticker}...`}
            disabled={loading}
            className="flex-1 h-8 text-xs"
          />
          <Button size="sm" onClick={() => send()} disabled={loading || !input.trim()} className="h-8 text-xs font-bold">ASK</Button>
        </div>
      </CardContent>
    </Card>
  );
}
