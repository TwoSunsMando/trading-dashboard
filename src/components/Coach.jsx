import { useState, useRef, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const QUICK_PROMPTS = [
  { label: "Pre-trade checklist", prompt: "Walk me through the pre-trade checklist for a new trade I'm considering." },
  { label: "Explain TA signals", prompt: "Explain what the TradingView technical analysis buy/sell/neutral signals mean in simple terms, and how I should use them with my system rules." },
  { label: "Weekly review", prompt: "Help me do my Saturday weekly review. What should I look at and document?" },
  { label: "Sunday scan", prompt: "Guide me through my Sunday scan routine. How should I build my watchlist for the week?" },
  { label: "Am I following rules?", prompt: "Based on my current portfolio, am I following all system rules? Check R1-R6 and flag any issues." },
  { label: "Risk check", prompt: "Do a risk assessment on my current open positions. Am I overexposed?" },
];

export default function Coach({ portfolio }) {
  const [messages, setMessages] = useState([
    { role: "assistant", content: "I'm your Steiner Trading Coach. I know your system rules inside and out — ask me about technical analysis, pre-trade checklists, weekly routines, or anything about your trading process. I can see your current portfolio stats." }
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const send = async (text) => {
    const msg = text || input.trim();
    if (!msg || loading) return;

    const userMsg = { role: "user", content: msg };
    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    setInput("");
    setLoading(true);

    try {
      // Only send user/assistant messages to the API (skip the initial greeting)
      const apiMessages = newMessages
        .slice(1) // skip initial assistant greeting
        .map(m => ({ role: m.role, content: m.content }));

      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
      const res = await fetch(`${supabaseUrl}/functions/v1/ai-coach`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${supabaseKey}`,
        },
        body: JSON.stringify({ messages: apiMessages, portfolio }),
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
      inputRef.current?.focus();
    }
  };

  return (
    <div>
      <h1 className="text-2xl font-bold mb-1">Trading Coach</h1>
      <p className="text-muted-foreground text-xs mb-6">AI-powered coaching based on the Steiner Swing System. Knows your rules and sees your portfolio.</p>

      {/* Quick prompts */}
      <div className="flex flex-wrap gap-2 mb-4">
        {QUICK_PROMPTS.map((q, i) => (
          <Button key={i} variant="outline" size="sm" onClick={() => send(q.prompt)}
            disabled={loading}
            className="text-xs h-7">
            {q.label}
          </Button>
        ))}
      </div>

      {/* Chat area */}
      <Card className="mb-4">
        <CardContent className="p-0">
          <div className="h-[500px] overflow-y-auto p-4 space-y-4">
            {messages.map((m, i) => (
              <div key={i} className={cn("flex", m.role === "user" ? "justify-end" : "justify-start")}>
                <div className={cn(
                  "max-w-[80%] rounded-lg px-4 py-3 text-sm leading-relaxed",
                  m.role === "user"
                    ? "bg-primary text-primary-foreground"
                    : "bg-accent text-foreground"
                )}>
                  {m.role === "assistant" && <div className="text-[10px] text-muted-foreground mb-1 font-semibold tracking-wider uppercase">Coach</div>}
                  <div className="whitespace-pre-wrap">{m.content}</div>
                </div>
              </div>
            ))}
            {loading && (
              <div className="flex justify-start">
                <div className="bg-accent rounded-lg px-4 py-3 text-sm">
                  <div className="text-[10px] text-muted-foreground mb-1 font-semibold tracking-wider uppercase">Coach</div>
                  <div className="text-muted-foreground animate-pulse">Thinking...</div>
                </div>
              </div>
            )}
            <div ref={bottomRef} />
          </div>
        </CardContent>
      </Card>

      {/* Input */}
      <div className="flex gap-2">
        <Input
          ref={inputRef}
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === "Enter" && send()}
          placeholder="Ask about TA signals, pre-trade checklist, weekly routine..."
          disabled={loading}
          className="flex-1"
        />
        <Button onClick={() => send()} disabled={loading || !input.trim()} className="font-bold text-xs px-6">
          SEND
        </Button>
      </div>

      {/* Portfolio context indicator */}
      <div className="mt-3 text-[10px] text-muted-foreground">
        Coach sees: {portfolio.openCount} open positions, ${portfolio.capital?.toLocaleString()} capital, {portfolio.consLoss} consecutive losses, ${portfolio.wkPnL?.toFixed(2)} week P&L
      </div>
    </div>
  );
}
