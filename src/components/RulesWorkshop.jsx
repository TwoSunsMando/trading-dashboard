import { useEffect, useMemo, useState, useCallback } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { tb } from "@/lib/tradingBot";

const MARKETS = ["crypto", "stocks"];

export default function RulesWorkshop({ toast }) {
  const [market, setMarket] = useState("crypto");
  const [activeData, setActiveData] = useState(null);  // { active: row|null, default: rules[] }
  const [versions, setVersions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [reviewing, setReviewing] = useState(false);
  const [review, setReview] = useState(null);

  // Editor state — bound to the rule set the user is currently working on.
  const [editorRules, setEditorRules] = useState([]);
  const [editorName, setEditorName] = useState("");
  const [editorNotes, setEditorNotes] = useState("");
  const [editorDirty, setEditorDirty] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const [a, v] = await Promise.all([tb.activeRules(market), tb.listRules(market)]);
      setActiveData(a);
      setVersions(v.versions || []);
      // When market changes, reset the editor to whatever's currently active
      // (or the in-code default if no DB version exists yet for this market).
      const seed = (a.active && a.active.rules) || a.default || [];
      setEditorRules(seed.map((r) => ({ ...r })));
      setEditorName(a.active ? `${a.active.name} (edit)` : `${market} v1`);
      setEditorNotes("");
      setEditorDirty(false);
      setReview(null);
    } catch (e) {
      toast?.(`Load failed: ${e.message}`, "error");
    } finally {
      setLoading(false);
    }
  }, [market, toast]);

  useEffect(() => { refresh(); }, [refresh]);

  // ----- Actions -----

  const updateRule = (idx, field, value) => {
    setEditorRules((rs) => rs.map((r, i) => (i === idx ? { ...r, [field]: value } : r)));
    setEditorDirty(true);
  };
  const addRule = () => {
    const nextId = `R${editorRules.length + 1}`;
    setEditorRules((rs) => [...rs, { id: nextId, category: "risk", title: "", body: "", check_hint: "" }]);
    setEditorDirty(true);
  };
  const deleteRule = (idx) => {
    setEditorRules((rs) => rs.filter((_, i) => i !== idx));
    setEditorDirty(true);
  };
  const resetToActive = () => {
    if (!activeData) return;
    const seed = (activeData.active && activeData.active.rules) || activeData.default || [];
    setEditorRules(seed.map((r) => ({ ...r })));
    setEditorDirty(false);
  };

  const runReview = async () => {
    setReviewing(true);
    setReview(null);
    try {
      const r = await tb.reviewRules(market, 20);
      setReview(r);
    } catch (e) {
      toast?.(`Review failed: ${e.message}`, "error");
    } finally {
      setReviewing(false);
    }
  };

  const applySuggestion = (s) => {
    // s = {rule_id, field, current, proposed}
    setEditorRules((rs) =>
      rs.map((r) => (r.id === s.rule_id ? { ...r, [s.field]: s.proposed } : r)),
    );
    setEditorDirty(true);
    toast?.(`Applied suggestion to ${s.rule_id}.${s.field}`);
  };

  const applyAddition = (a) => {
    setEditorRules((rs) => [...rs, { ...a }]);
    setEditorDirty(true);
    toast?.(`Added rule ${a.id}`);
  };

  const applyRemoval = (rule_id) => {
    setEditorRules((rs) => rs.filter((r) => r.id !== rule_id));
    setEditorDirty(true);
    toast?.(`Removed ${rule_id}`);
  };

  const saveAndActivate = async (activate) => {
    if (!editorName.trim()) return toast?.("Version name is required", "error");
    if (!editorRules.length) return toast?.("At least one rule is required", "error");
    setLoading(true);
    try {
      const payload = {
        market_type: market,
        name: editorName.trim(),
        rules: editorRules.map((r) => ({
          id: r.id,
          category: r.category,
          title: r.title || "",
          body: r.body || "",
          check_hint: r.check_hint || "",
        })),
        notes: editorNotes || null,
        author: "human",
        activate,
      };
      await tb.createRulesVersion(payload);
      toast?.(activate ? "Version created and activated" : "Version saved (inactive)");
      await refresh();
    } catch (e) {
      toast?.(`Save failed: ${e.message}`, "error");
    } finally {
      setLoading(false);
    }
  };

  const activateExisting = async (id) => {
    setLoading(true);
    try {
      await tb.activateRulesVersion(id);
      toast?.("Version activated");
      await refresh();
    } catch (e) {
      toast?.(`Activate failed: ${e.message}`, "error");
    } finally {
      setLoading(false);
    }
  };

  // ----- Render -----

  const activeRules = useMemo(
    () => (activeData?.active?.rules) || activeData?.default || [],
    [activeData],
  );
  const isUsingDefault = activeData && !activeData.active;

  return (
    <div>
      <div className="flex items-center justify-between mb-1 flex-wrap gap-2">
        <h1 className="text-2xl font-bold">Rules Workshop</h1>
        <div className="flex gap-1">
          {MARKETS.map((m) => (
            <button
              key={m}
              onClick={() => setMarket(m)}
              className={cn(
                "px-3 py-1 rounded-md text-xs font-bold tracking-wider uppercase",
                market === m ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground border border-border",
              )}
            >
              {m}
            </button>
          ))}
        </div>
      </div>
      <p className="text-muted-foreground text-xs mb-6">
        Review, edit, and version the rule set Claude evaluates against. Changes are NEVER auto-applied —
        you create new versions and explicitly activate them.
      </p>

      {/* Active version + version history */}
      <div className="flex gap-3 flex-wrap mb-6">
        <Card className="flex-1 min-w-[300px]">
          <CardContent className="p-5">
            <div className="text-xs text-muted-foreground tracking-wider uppercase mb-3">◆ Active version</div>
            {activeData ? (
              <div>
                <div className="flex items-center gap-2 flex-wrap mb-2">
                  <Badge variant={isUsingDefault ? "secondary" : "default"}>
                    {isUsingDefault ? "in-code default" : `v${activeData.active.version}`}
                  </Badge>
                  <span className="font-bold">
                    {isUsingDefault ? `${market} default (no version saved yet)` : activeData.active.name}
                  </span>
                </div>
                {activeData.active?.notes && (
                  <p className="text-xs text-muted-foreground">{activeData.active.notes}</p>
                )}
                <div className="text-xs text-muted-foreground mt-2">
                  {activeRules.length} rules · seeded from {isUsingDefault ? "code" : "DB"}
                </div>
              </div>
            ) : (
              <div className="text-xs text-muted-foreground">{loading ? "Loading…" : "No active version."}</div>
            )}
          </CardContent>
        </Card>

        <Card className="flex-1 min-w-[300px]">
          <CardContent className="p-5">
            <div className="text-xs text-muted-foreground tracking-wider uppercase mb-3">◎ Version History</div>
            {versions.length === 0 ? (
              <div className="text-xs text-muted-foreground">No saved versions yet for {market}.</div>
            ) : (
              <div className="space-y-1.5">
                {versions.map((v) => (
                  <div key={v.id} className="flex items-center justify-between gap-2 text-xs">
                    <div className="flex items-center gap-2 flex-1 min-w-0">
                      <Badge variant={v.is_active ? "default" : "outline"} className="text-[9px]">v{v.version}</Badge>
                      <span className="truncate">{v.name}</span>
                      <span className="text-muted-foreground text-[10px] hidden md:inline">{v.author}</span>
                    </div>
                    {!v.is_active && (
                      <Button size="sm" variant="outline" onClick={() => activateExisting(v.id)}
                        className="h-6 text-[10px] px-2">
                        Activate
                      </Button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Claude review */}
      <Card className="mb-6">
        <CardContent className="p-5">
          <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
            <div className="text-xs text-muted-foreground tracking-wider uppercase">✦ Claude review</div>
            <Button onClick={runReview} disabled={reviewing} className="text-xs font-bold">
              {reviewing ? "REVIEWING..." : "✦ ASK CLAUDE TO REVIEW"}
            </Button>
          </div>
          {!review && (
            <p className="text-xs text-muted-foreground">
              Sends the active rule set + last 20 analyses for {market} to Claude for critique. Suggestions appear here — none are auto-applied.
            </p>
          )}
          {review && (
            <div>
              <p className="text-sm mb-3">{review.summary}</p>

              {review.findings?.length > 0 && (
                <div className="mb-4">
                  <div className="text-[10px] tracking-wider uppercase text-amber mb-1">Findings</div>
                  <ul className="text-xs space-y-1 list-disc pl-5">
                    {review.findings.map((f, i) => (
                      <li key={i}>
                        <span className="font-bold">{f.rule_id}</span> ({f.severity}): {f.issue}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {review.suggested_edits?.length > 0 && (
                <div className="mb-4">
                  <div className="text-[10px] tracking-wider uppercase text-info mb-1">Suggested edits</div>
                  {review.suggested_edits.map((s, i) => (
                    <div key={i} className="border-l-2 border-info pl-3 mb-2 text-xs">
                      <div className="flex items-center justify-between gap-2 mb-1">
                        <span className="font-bold">{s.rule_id}.{s.field}</span>
                        <Button size="sm" variant="outline" onClick={() => applySuggestion(s)} className="h-6 text-[10px] px-2">
                          Apply →
                        </Button>
                      </div>
                      <div className="text-muted-foreground line-through">{s.current}</div>
                      <div className="text-info">{s.proposed}</div>
                    </div>
                  ))}
                </div>
              )}

              {review.suggested_additions?.length > 0 && (
                <div className="mb-4">
                  <div className="text-[10px] tracking-wider uppercase text-profit mb-1">Suggested additions</div>
                  {review.suggested_additions.map((a, i) => (
                    <div key={i} className="border-l-2 border-profit pl-3 mb-2 text-xs">
                      <div className="flex items-center justify-between gap-2 mb-1">
                        <span className="font-bold">{a.id} ({a.category}): {a.title}</span>
                        <Button size="sm" variant="outline" onClick={() => applyAddition(a)} className="h-6 text-[10px] px-2">
                          Add →
                        </Button>
                      </div>
                      <div className="text-foreground">{a.body}</div>
                      <div className="text-muted-foreground italic">Check: {a.check_hint}</div>
                    </div>
                  ))}
                </div>
              )}

              {review.suggested_removals?.length > 0 && (
                <div className="mb-4">
                  <div className="text-[10px] tracking-wider uppercase text-loss mb-1">Suggested removals</div>
                  <div className="flex flex-wrap gap-1">
                    {review.suggested_removals.map((id) => (
                      <Button key={id} size="sm" variant="outline" onClick={() => applyRemoval(id)} className="h-6 text-[10px] px-2">
                        Remove {id} →
                      </Button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Editor */}
      <Card className="mb-6">
        <CardContent className="p-5">
          <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
            <div className="text-xs text-muted-foreground tracking-wider uppercase">⚙ Editor {editorDirty && <span className="text-amber ml-2">● modified</span>}</div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={resetToActive} disabled={!editorDirty} className="text-xs">Reset</Button>
              <Button variant="outline" size="sm" onClick={addRule} className="text-xs">+ Add Rule</Button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-4">
            <div>
              <div className="text-[10px] text-muted-foreground mb-1">Version name</div>
              <Input value={editorName} onChange={(e) => { setEditorName(e.target.value); setEditorDirty(true); }} className="h-8 text-sm" />
            </div>
            <div>
              <div className="text-[10px] text-muted-foreground mb-1">Notes</div>
              <Input value={editorNotes} onChange={(e) => { setEditorNotes(e.target.value); setEditorDirty(true); }} placeholder="Why this version exists" className="h-8 text-sm" />
            </div>
          </div>

          <div className="space-y-2">
            {editorRules.map((r, idx) => (
              <RuleEditor key={`${r.id}-${idx}`} rule={r} onChange={(field, value) => updateRule(idx, field, value)} onDelete={() => deleteRule(idx)} />
            ))}
          </div>

          <div className="flex gap-2 mt-4 flex-wrap">
            <Button onClick={() => saveAndActivate(false)} disabled={loading || !editorDirty} variant="outline" className="text-xs font-bold">
              SAVE AS DRAFT
            </Button>
            <Button onClick={() => saveAndActivate(true)} disabled={loading || !editorDirty} className="text-xs font-bold">
              ✓ SAVE & ACTIVATE
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}


function RuleEditor({ rule, onChange, onDelete }) {
  return (
    <div className="border border-border rounded-md p-3 space-y-2">
      <div className="flex gap-2 flex-wrap">
        <Input value={rule.id} onChange={(e) => onChange("id", e.target.value)} placeholder="ID (R1, E3, X5...)"
          className="h-8 text-xs w-24 font-bold" />
        <select
          value={rule.category}
          onChange={(e) => onChange("category", e.target.value)}
          className="h-8 text-xs bg-background border border-border rounded-md px-2"
        >
          <option value="risk">risk</option>
          <option value="entry">entry</option>
          <option value="exit">exit</option>
        </select>
        <Input value={rule.title} onChange={(e) => onChange("title", e.target.value)} placeholder="Short title"
          className="h-8 text-xs flex-1 min-w-[180px]" />
        <Button size="sm" variant="outline" onClick={onDelete} className="h-8 text-[10px] text-loss hover:text-loss">×</Button>
      </div>
      <textarea
        value={rule.body}
        onChange={(e) => onChange("body", e.target.value)}
        placeholder="Rule body — what the trader (and Claude) reads"
        rows={2}
        className="w-full bg-background border border-border rounded-md p-2 text-xs focus:border-primary outline-none"
      />
      <textarea
        value={rule.check_hint}
        onChange={(e) => onChange("check_hint", e.target.value)}
        placeholder="Check hint — how Claude should evaluate this rule (PASS/FAIL/WARN/N/A)"
        rows={2}
        className="w-full bg-background border border-border rounded-md p-2 text-xs focus:border-primary outline-none"
      />
    </div>
  );
}
