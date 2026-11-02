import { useState, useEffect, useCallback, Fragment } from 'react'

// ── Types ─────────────────────────────────────────────────────────────────────

type StageState = 'completed' | 'active' | 'locked'

interface Stage {
  id: number
  label: string
  shortLabel: string
}

const STAGES: Stage[] = [
  { id: 1, label: 'Locator', shortLabel: 'Locator' },
  { id: 2, label: 'Fixer', shortLabel: 'Fixer' },
  { id: 3, label: 'Gate', shortLabel: 'Gate' },
  { id: 4, label: 'Approval', shortLabel: 'Approval' },
  { id: 5, label: 'PR Agent', shortLabel: 'PR Agent' },
  { id: 6, label: 'Cost & Ablation', shortLabel: 'Cost' },
]

// Reads a JSON response and turns a server error into a thrown Error, so the
// stage shows the server's message instead of crashing on missing fields.
async function checkJson(res: Response) {
  const body = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(body.error || `Request failed (${res.status})`)
  return body
}

// ── Loading state ─────────────────────────────────────────────────────────────

function LoadingPanel() {
  return (
    <div className="flex flex-col items-center justify-center h-64 gap-4">
      <div className="w-8 h-8 rounded-full border-2 border-[#1e3048] border-t-[#5eead4] spinner" />
      <p className="text-sm text-[#7a87aa]">Processing…</p>
    </div>
  )
}

function ErrorPanel({ message }: { message: string }) {
  return (
    <div className="flex flex-col items-center justify-center h-64 gap-2">
      <p className="text-sm text-[#f87171]">Error: {message}</p>
    </div>
  )
}

// ── Stage content components (each fetches real data from the backend) ────────

interface LocateResponse {
  ticket: { id: string; title: string; description: string; source?: string; url?: string | null }
  files: { file: string; hits: number; relevant: boolean; matches: { line: number; text: string }[] }[]
  resolution?: { targetFile: string; testFile: string; hits: number } | null
  blocked?: string | null
}

function LocatorStage({ ticketId, onBlocked }: { ticketId: string; onBlocked: (blocked: boolean) => void }) {
  const [data, setData] = useState<LocateResponse | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [typed, setTyped] = useState('')

  useEffect(() => {
    setData(null)
    setError(null)
    setTyped('')
    onBlocked(false)
    fetch(`/api/pipeline/${ticketId}/locate`)
      .then(checkJson)
      .then((d: LocateResponse) => {
        setData(d)
        onBlocked(Boolean(d.blocked))
      })
      .catch((err) => setError(err.message))
  }, [ticketId])

  useEffect(() => {
    if (!data) return
    const ticketText = data.ticket.title + '\n\n' + data.ticket.description
    let i = 0
    const id = setInterval(() => {
      i++
      setTyped(ticketText.slice(0, i))
      if (i >= ticketText.length) clearInterval(id)
    }, 12)
    return () => clearInterval(id)
  }, [data])

  if (error) return <ErrorPanel message={error} />
  if (!data) return <LoadingPanel />

  return (
    <div className="fade-in space-y-6">
      <div>
        <p className="text-xs uppercase tracking-widest text-[#7a87aa] mb-3 font-medium">Ticket Content</p>
        <div className="bg-[#0d1826] border border-[#1e3048] rounded-xl p-5 font-mono text-sm text-[#c9d1ec] leading-relaxed min-h-[160px] whitespace-pre-wrap">
          {typed}
          <span className="inline-block w-0.5 h-4 bg-[#5eead4] ml-0.5 animate-pulse align-middle" />
        </div>
      </div>
      {data.ticket.source === 'jira' && data.ticket.url && (
        <a href={data.ticket.url} target="_blank" rel="noreferrer" className="block text-xs text-[#5eead4] hover:text-[#7df0de]">
          Read from Jira: {data.ticket.id} → open in Jira
        </a>
      )}
      {data.blocked && (
        <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 px-4 py-2 text-xs text-amber-300">{data.blocked}</div>
      )}
      {data.resolution && (
        <div className="rounded-lg border border-[#2d7a6e] bg-[#0d2a22] px-4 py-2 text-xs text-[#5eead4]">
          The Locator chose {data.resolution.targetFile} ({data.resolution.hits} keyword hits) and will check fixes against {data.resolution.testFile}. If this looks like the wrong file, do not approve.
        </div>
      )}
      <div>
        <p className="text-xs uppercase tracking-widest text-[#7a87aa] mb-3 font-medium">
          Files Searched <span className="normal-case text-[#3a4a62]">(real grep over target-repo/src)</span>
        </p>
        <div className="space-y-2">
          {data.files.map((f) => (
            <div key={f.file} className="px-4 py-2.5 rounded-lg bg-[#162035] border border-[#1e3048]">
              <div className="flex items-center justify-between">
                <span className="font-mono text-sm text-[#c9d1ec]">{f.file}</span>
                <div className="flex items-center gap-3">
                  <span className="text-xs text-[#7a87aa]">{f.hits} hit{f.hits !== 1 ? 's' : ''}</span>
                  {f.relevant ? (
                    <span className="text-xs bg-[#0d2a22] text-[#5eead4] border border-[#2d7a6e] px-2 py-0.5 rounded-full">relevant</span>
                  ) : (
                    <span className="text-xs bg-[#1e3048] text-[#3a4a62] border border-[#1e3048] px-2 py-0.5 rounded-full">skipped</span>
                  )}
                </div>
              </div>
              {f.relevant && f.matches.length > 0 && (
                <div className="mt-2 space-y-1 border-t border-[#1e3048] pt-2">
                  {f.matches.map((m) => (
                    <div key={m.line} className="flex gap-3 font-mono text-xs">
                      <span className="text-[#5eead4] shrink-0">line {m.line}</span>
                      <span className="text-[#7a87aa] truncate">{m.text}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

interface FixCandidate {
  id: string
  title: string
  description: string
  coverage: number
  passed: number
  total: number
  changedLines?: number
  tradeoffs?: string
  risks?: string
  tests: { name: string; pass: boolean }[]
}

interface FixMeta {
  source: 'llm' | 'fallback'
  model?: string
  inputTokens?: number | null
  outputTokens?: number | null
  ms?: number
  reason?: string
  revision?: number
}

interface FixResponse {
  candidates: FixCandidate[]
  winnerId: string
  meta?: FixMeta
  rootCause?: string
  selection?: { rule: string; reason: string }
}

function FixerStage({ ticketId }: { ticketId: string }) {
  const [data, setData] = useState<FixResponse | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setData(null)
    setError(null)
    fetch(`/api/pipeline/${ticketId}/fix`)
      .then(checkJson)
      .then(setData)
      .catch((err) => setError(err.message))
  }, [ticketId])

  if (error) return <ErrorPanel message={error} />
  if (!data) return <LoadingPanel />

  return (
    <div className="fade-in space-y-4">
      <p className="text-xs uppercase tracking-widest text-[#7a87aa] mb-3 font-medium">
        Candidate Fixes <span className="normal-case text-[#3a4a62]">(tests run for real with node --test; trade-offs and risks are the AI&apos;s own notes)</span>
      </p>
      {(data.meta?.revision ?? 0) > 0 && (
        <div className="rounded-lg border border-[#3a4a62] bg-[#0d1826] px-4 py-2 text-xs text-[#c9d1ec]">
          Revised after reviewer feedback (revision {data.meta?.revision} of 2). Review these new candidates.
        </div>
      )}
      {data.meta?.source === 'llm' && (
        <div className="rounded-lg border border-[#2d7a6e] bg-[#0d2a22] px-4 py-2 text-xs text-[#5eead4]">
          Candidates written by AI ({data.meta.model}) in {((data.meta.ms ?? 0) / 1000).toFixed(1)}s
          {data.meta.inputTokens != null && data.meta.outputTokens != null
            ? ` · ${data.meta.inputTokens} tokens in, ${data.meta.outputTokens} out`
            : ''}
        </div>
      )}
      {data.meta?.source === 'fallback' && (
        <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 px-4 py-2 text-xs text-amber-300">
          AI unavailable, showing pre-written candidates instead ({data.meta.reason})
        </div>
      )}
      {data.rootCause && (
        <div className="rounded-xl border border-[#1e3048] bg-[#0d1826] p-4">
          <p className="text-xs uppercase tracking-widest text-[#7a87aa] mb-2 font-medium">Root cause <span className="normal-case text-[#3a4a62]">(written by the AI)</span></p>
          <p className="text-sm text-[#c9d1ec] leading-relaxed">{data.rootCause}</p>
        </div>
      )}
      {data.selection && (
        <div className="rounded-xl border border-[#2d7a6e] bg-[#0d2a22] p-4">
          <p className="text-xs uppercase tracking-widest text-[#5eead4] mb-2 font-medium">Why {data.winnerId} is recommended <span className="normal-case text-[#7a87aa]">(from measured results, not the AI&apos;s opinion)</span></p>
          <p className="text-sm text-[#c9d1ec] leading-relaxed">{data.selection.reason}</p>
        </div>
      )}
      {data.candidates.map((c) => {
        const allPass = c.id === data.winnerId
        return (
          <div key={c.id} className={`rounded-xl border p-5 ${allPass ? 'border-[#2d7a6e] bg-[#0d2a22]' : 'border-[#1e3048] bg-[#162035]'}`}>
            <div className="flex items-start justify-between gap-4 mb-3">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-xs text-[#7a87aa] font-mono">{c.id}</span>
                  {allPass && <span className="text-xs bg-[#5eead4] text-[#0d1826] px-2 py-0.5 rounded-full font-semibold">Recommended</span>}
                </div>
                <h3 className="text-[#c9d1ec] font-semibold text-sm">{c.title}</h3>
                <p className="text-[#7a87aa] text-xs mt-1 leading-relaxed">{c.description}</p>
              </div>
              <div className="text-right shrink-0">
                <div className={`text-lg font-bold font-mono ${allPass ? 'text-[#5eead4]' : c.coverage >= 50 ? 'text-amber-400' : 'text-red-400'}`}>{c.coverage}%</div>
                <div className="text-xs text-[#7a87aa]">tests passing</div>
                {c.changedLines != null && <div className="text-xs text-[#7a87aa] mt-0.5">{c.changedLines} lines changed</div>}
              </div>
            </div>
            {(c.tradeoffs || c.risks) && (
              <div className="mb-3 space-y-1 text-xs leading-relaxed">
                {c.tradeoffs && <p className="text-[#c9d1ec]"><span className="text-[#7a87aa]">Trade-offs (AI): </span>{c.tradeoffs}</p>}
                {c.risks && <p className="text-[#c9d1ec]"><span className="text-[#7a87aa]">Risks (AI): </span>{c.risks}</p>}
              </div>
            )}
            <div className="flex flex-wrap gap-2">
              {c.tests.map((t) => (
                <span key={t.name} className={`flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full border font-mono ${t.pass ? 'bg-[#0d2a22] border-[#2d7a6e] text-[#5eead4]' : 'bg-[#2a0d0d] border-[#7a2a2a] text-[#f87171]'}`}>
                  {t.pass ? '✓' : '✗'} {t.name}
                </span>
              ))}
            </div>
          </div>
        )
      })}
    </div>
  )
}

interface GateResponse {
  syntax: { ok: boolean; detail: string; durationMs: number }
  tests: { passed: number; failed: number; total: number; ok: boolean; durationMs: number }
  staticScan: { ok: boolean; debugStatements: number; durationMs: number }
}

function GateStage({ ticketId }: { ticketId: string }) {
  const [data, setData] = useState<GateResponse | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setData(null)
    setError(null)
    fetch(`/api/pipeline/${ticketId}/gate`)
      .then(checkJson)
      .then(setData)
      .catch((err) => setError(err.message))
  }, [ticketId])

  if (error) return <ErrorPanel message={error} />
  if (!data) return <LoadingPanel />

  const groups = [
    {
      category: 'Test Suite',
      items: [{ name: `checkout.test.js (${data.tests.total} tests)`, pass: data.tests.ok, duration: `${data.tests.durationMs}ms` }],
    },
    {
      category: 'Syntax Check',
      items: [{ name: 'node --check on winning candidate', pass: data.syntax.ok, duration: `${data.syntax.durationMs}ms` }],
    },
    {
      category: 'Static Scan',
      items: [{ name: `Debug statement scan (${data.staticScan.debugStatements} found)`, pass: data.staticScan.ok, duration: `${data.staticScan.durationMs}ms` }],
    },
  ]

  const totalChecks = groups.reduce((sum, g) => sum + g.items.length, 0)
  const passedChecks = groups.reduce((sum, g) => sum + g.items.filter((i) => i.pass).length, 0)
  const totalMs = data.syntax.durationMs + data.tests.durationMs + data.staticScan.durationMs

  return (
    <div className="fade-in space-y-5">
      {groups.map((group) => (
        <div key={group.category}>
          <p className="text-xs uppercase tracking-widest text-[#7a87aa] mb-3 font-medium">{group.category}</p>
          <div className="space-y-2">
            {group.items.map((item) => (
              <div key={item.name} className="flex items-center justify-between px-4 py-3 rounded-lg bg-[#162035] border border-[#1e3048]">
                <div className="flex items-center gap-3">
                  <div className={`w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold ${item.pass ? 'bg-[#0d2a22] text-[#5eead4]' : 'bg-[#2a0d0d] text-[#f87171]'}`}>
                    {item.pass ? '✓' : '✗'}
                  </div>
                  <span className="text-sm text-[#c9d1ec]">{item.name}</span>
                </div>
                <span className="text-xs text-[#7a87aa] font-mono">{item.duration}</span>
              </div>
            ))}
          </div>
        </div>
      ))}
      <div className="flex items-center gap-2 pt-2">
        <div className={`w-2 h-2 rounded-full ${passedChecks === totalChecks ? 'bg-[#5eead4]' : 'bg-[#f87171]'}`} />
        <span className={`text-sm font-medium ${passedChecks === totalChecks ? 'text-[#5eead4]' : 'text-[#f87171]'}`}>
          {passedChecks}/{totalChecks} checks passed
        </span>
        <span className="text-xs text-[#7a87aa] ml-auto font-mono">Total: {totalMs}ms</span>
      </div>
    </div>
  )
}

interface DiffLine {
  type: 'add' | 'rem' | 'ctx'
  text: string
  oldNo?: number | null
  newNo?: number | null
}

interface TestRun {
  passed: number
  total: number
  tests: { name: string; pass: boolean }[]
}

interface ReviewSummary {
  rootCause: string
  before: TestRun
  after: TestRun
  tradeoffs: string
  risks: string
  testFile: string
  alternatives: { id: string; title: string; passed: number; total: number; changedLines?: number }[]
}

// Pairs removed and added lines so the old and new file can sit side by side.
function toSideBySide(lines: DiffLine[]) {
  const rows: { left: DiffLine | null; right: DiffLine | null }[] = []
  let i = 0
  while (i < lines.length) {
    if (lines[i].type === 'ctx') {
      rows.push({ left: lines[i], right: lines[i] })
      i++
      continue
    }
    const rem: DiffLine[] = []
    const add: DiffLine[] = []
    while (i < lines.length && lines[i].type === 'rem') rem.push(lines[i++])
    while (i < lines.length && lines[i].type === 'add') add.push(lines[i++])
    for (let k = 0; k < Math.max(rem.length, add.length); k++) {
      rows.push({ left: rem[k] ?? null, right: add[k] ?? null })
    }
  }
  return rows
}

interface PrResponse {
  diff: { filePath: string; added: number; removed: number; lines: DiffLine[] }
  explanation: string
  commitMessage: string
  summary?: ReviewSummary
  github?: { number?: number; url?: string; branch?: string; repo?: string; merged?: boolean; mergeError?: string; error?: string }
}

function ReviewView({ data }: { data: PrResponse }) {
  const [mode, setMode] = useState<'unified' | 'side'>('unified')
  const sm = data.summary
  const num = (n?: number | null) => (n == null ? '' : n)
  const cellClass = (l: DiffLine | null) =>
    !l ? 'bg-[#0d1826]' : l.type === 'add' ? 'bg-[#0d2a22] text-[#4ade80]' : l.type === 'rem' ? 'bg-[#2a0d0d] text-[#f87171]' : 'bg-[#0d1826] text-[#c9d1ec]'
  return (
    <div className="space-y-6">
      {sm && (
        <div>
          <p className="text-xs uppercase tracking-widest text-[#7a87aa] mb-3 font-medium">Review summary</p>
          <div className="bg-[#162035] border border-[#1e3048] rounded-xl p-5 text-sm text-[#c9d1ec] leading-relaxed space-y-4">
            {sm.rootCause && (
              <div>
                <p className="text-xs text-[#7a87aa] mb-1">Root cause <span className="text-[#3a4a62]">(the AI&apos;s explanation)</span></p>
                <p>{sm.rootCause}</p>
              </div>
            )}
            <div>
              <p className="text-xs text-[#7a87aa] mb-1">Before and after <span className="text-[#3a4a62]">(measured: {sm.testFile} run on the original code and on this fix)</span></p>
              <div className="grid grid-cols-2 gap-3 text-xs">
                {[['Before', sm.before], ['After', sm.after]].map(([label, r]) => (
                  <div key={label as string} className="rounded-lg bg-[#0d1826] border border-[#1e3048] p-3 space-y-1">
                    <p className="font-semibold text-[#c9d1ec]">{label as string}: {(r as TestRun).passed}/{(r as TestRun).total} tests passed</p>
                    {(r as TestRun).tests.map((t) => (
                      <p key={t.name} className={t.pass ? 'text-[#4ade80]' : 'text-[#f87171]'}>{t.pass ? '✓' : '✗'} {t.name}</p>
                    ))}
                  </div>
                ))}
              </div>
              <p className="text-xs text-[#7a87aa] mt-2">
                Test gap: only these {sm.after.total} tests check this file. A behaviour they do not mention is not checked at all, so read the diff for edge cases.
              </p>
            </div>
            {(sm.tradeoffs || sm.risks) && (
              <div className="grid sm:grid-cols-2 gap-3 text-xs">
                {sm.tradeoffs && <div><p className="text-[#7a87aa] mb-1">Trade-offs <span className="text-[#3a4a62]">(the AI&apos;s notes)</span></p><p>{sm.tradeoffs}</p></div>}
                {sm.risks && <div><p className="text-[#7a87aa] mb-1">Risks <span className="text-[#3a4a62]">(the AI&apos;s notes)</span></p><p>{sm.risks}</p></div>}
              </div>
            )}
            {sm.alternatives.length > 0 && (
              <div>
                <p className="text-xs text-[#7a87aa] mb-1">Other candidates, side by side (measured)</p>
                <table className="w-full text-xs">
                  <thead><tr className="text-left text-[#7a87aa]"><th className="py-1 pr-3 font-medium">Candidate</th><th className="py-1 pr-3 font-medium">Tests passed</th><th className="py-1 font-medium">Lines changed</th></tr></thead>
                  <tbody>
                    <tr className="text-[#5eead4]"><td className="py-1 pr-3">Recommended</td><td className="py-1 pr-3">{sm.after.passed}/{sm.after.total}</td><td className="py-1">{data.diff.added + data.diff.removed}</td></tr>
                    {sm.alternatives.map((a) => (
                      <tr key={a.id} className="text-[#c9d1ec]"><td className="py-1 pr-3">{a.id}: {a.title}</td><td className="py-1 pr-3">{a.passed}/{a.total}</td><td className="py-1">{a.changedLines ?? '–'}</td></tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}
      <div>
        <div className="flex items-center mb-3">
          <p className="text-xs uppercase tracking-widest text-[#7a87aa] font-medium">Code Diff</p>
          <div className="ml-auto flex gap-1 text-xs">
            {(['unified', 'side'] as const).map((m) => (
              <button
                key={m}
                onClick={() => setMode(m)}
                className={`px-3 py-1 rounded-md border ${mode === m ? 'border-[#5eead4] text-[#5eead4]' : 'border-[#1e3048] text-[#7a87aa] hover:text-[#c9d1ec]'}`}
              >
                {m === 'unified' ? 'Unified' : 'Side by side'}
              </button>
            ))}
          </div>
        </div>
        <div className="rounded-xl border border-[#1e3048] overflow-hidden">
          <div className="bg-[#111f33] px-4 py-2 text-xs text-[#7a87aa] font-mono border-b border-[#1e3048] flex items-center gap-2">
            <span>{data.diff.filePath}</span>
            <span className="ml-auto text-[#5eead4]">+{data.diff.added} −{data.diff.removed}</span>
          </div>
          <div className="overflow-x-auto">
            {mode === 'unified' ? (
              <pre className="text-xs font-mono leading-6">
                {data.diff.lines.map((line, i) => (
                  <div key={i} className={`flex pr-4 ${cellClass(line)}`}>
                    <span className="select-none text-[#3a4a62] w-10 text-right pr-2 shrink-0">{num(line.oldNo)}</span>
                    <span className="select-none text-[#3a4a62] w-10 text-right pr-2 shrink-0">{num(line.newNo)}</span>
                    <span className="select-none text-[#3a4a62] w-5 shrink-0">{line.type === 'add' ? '+' : line.type === 'rem' ? '-' : ' '}</span>
                    <span className="whitespace-pre">{line.text}</span>
                  </div>
                ))}
              </pre>
            ) : (
              <div className="text-xs font-mono leading-6 min-w-[640px]">
                <div className="grid grid-cols-2 text-[#7a87aa] bg-[#111f33] border-b border-[#1e3048]">
                  <div className="px-4 py-1">Original</div>
                  <div className="px-4 py-1 border-l border-[#1e3048]">Recommended fix</div>
                </div>
                {toSideBySide(data.diff.lines).map((row, i) => (
                  <div key={i} className="grid grid-cols-2">
                    <div className={`flex pr-2 ${cellClass(row.left)}`}>
                      <span className="select-none text-[#3a4a62] w-10 text-right pr-2 shrink-0">{num(row.left?.oldNo)}</span>
                      <span className="whitespace-pre">{row.left?.text ?? ''}</span>
                    </div>
                    <div className={`flex pr-2 border-l border-[#1e3048] ${cellClass(row.right)}`}>
                      <span className="select-none text-[#3a4a62] w-10 text-right pr-2 shrink-0">{num(row.right?.newNo)}</span>
                      <span className="whitespace-pre">{row.right?.text ?? ''}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
      <div>
        <p className="text-xs uppercase tracking-widest text-[#7a87aa] mb-3 font-medium">Explanation</p>
        <div className="bg-[#162035] border border-[#1e3048] rounded-xl p-5 text-sm text-[#c9d1ec] leading-relaxed space-y-3">
          <p>{data.explanation}</p>
          <p className="text-[#7a87aa]">
            Commit message: <code className="font-mono text-xs bg-[#0d1826] px-1.5 py-0.5 rounded">{data.commitMessage}</code>
          </p>
        </div>
      </div>
    </div>
  )
}

function PRAgentStage({ ticketId }: { ticketId: string }) {
  const [data, setData] = useState<PrResponse | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setData(null)
    setError(null)
    fetch(`/api/pipeline/${ticketId}/pr`)
      .then(async (res) => {
        const body = await res.json()
        if (!res.ok) throw new Error(body.error || 'Could not open the pull request')
        return body
      })
      .then(setData)
      .catch((err) => setError(err.message))
  }, [ticketId])

  if (error) return <ErrorPanel message={error} />
  if (!data) return <LoadingPanel />

  return (
    <div className="fade-in space-y-6">
      {data.github?.url && (
        <a
          href={data.github.url}
          target="_blank"
          rel="noreferrer"
          className="block rounded-lg border border-[#2d7a6e] bg-[#0d2a22] px-4 py-3 text-sm text-[#5eead4] hover:bg-[#10362c] transition-colors"
        >
          Pull request #{data.github.number} opened on GitHub ({data.github.repo}){data.github.merged ? ' and merged' : ''} → view it
        </a>
      )}
      {data.github?.mergeError && (
        <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 px-4 py-2 text-xs text-amber-300">
          The pull request was opened but could not be merged: {data.github.mergeError}. Resolve it on GitHub.
        </div>
      )}
      {data.github?.error && (
        <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 px-4 py-2 text-xs text-amber-300">
          Could not open a GitHub pull request: {data.github.error}
        </div>
      )}
      <ReviewView data={data} />
    </div>
  )
}

function ApprovalStage({ ticketId, onApprove, onRevised }: { ticketId: string; onApprove: () => void; onRevised: () => void }) {
  const [decision, setDecision] = useState<'none' | 'approving' | 'approved' | 'changes' | 'revising' | 'sent'>('none')
  const [sentMessage, setSentMessage] = useState('')
  const [feedback, setFeedback] = useState('')
  const [info, setInfo] = useState<{ winnerId: string; coverage: number; testsPassed: number; testsTotal: number; gatePassed: boolean } | null>(null)
  const [review, setReview] = useState<PrResponse | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setDecision('none')
    setInfo(null)
    setReview(null)
    setError(null)
    ;(async () => {
      try {
        const [fix, gate] = await Promise.all([
          fetch(`/api/pipeline/${ticketId}/fix`, { signal: AbortSignal.timeout(90000) }).then((r) => r.json()) as Promise<FixResponse>,
          fetch(`/api/pipeline/${ticketId}/gate`, { signal: AbortSignal.timeout(90000) }).then((r) => r.json()) as Promise<GateResponse>,
        ])
        const winner = fix.candidates.find((c) => c.id === fix.winnerId)!
        const rev = await fetch(`/api/pipeline/${ticketId}/review`, { signal: AbortSignal.timeout(90000) }).then((r) => r.json()) as PrResponse
        setReview(rev)
        setInfo({
          winnerId: winner.id,
          coverage: winner.coverage,
          testsPassed: gate.tests.passed,
          testsTotal: gate.tests.total,
          gatePassed: gate.syntax.ok && gate.tests.ok && gate.staticScan.ok,
        })
      } catch (err: any) {
        setError(err?.name === 'TimeoutError' ? 'The review summary took longer than 90 seconds to load. The server may be waking up; reload the page and try again.' : err.message)
      }
    })()
  }, [ticketId])

  const handleApprove = async () => {
    setDecision('approving')
    try {
      const res = await fetch(`/api/pipeline/${ticketId}/approve`, { method: 'POST' })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body.error || 'Approve failed')
      }
      setDecision('approved')
      setTimeout(onApprove, 600)
    } catch (err: any) {
      setError(err.message)
      setDecision('none')
    }
  }

  const handleSubmitFeedback = async () => {
    if (!feedback.trim()) return
    setDecision('revising')
    try {
      const res = await fetch(`/api/pipeline/${ticketId}/request-changes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ feedback }),
      })
      const body = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(body.error || 'Could not save feedback')
      if (body.revised) {
        setFeedback('')
        onRevised()
        return
      }
      setSentMessage(body.message || 'Feedback saved.')
      setDecision('sent')
    } catch (err: any) {
      setError(err.message)
    }
  }

  if (error) return <ErrorPanel message={error} />

  return (
    <div className="fade-in space-y-8">
      {review && decision !== 'approved' && decision !== 'sent' && <ReviewView data={review} />}
      <div className="flex items-center justify-center min-h-[320px]">
      <div className="w-full max-w-lg">
        {(decision === 'none' || decision === 'approving') && (
          <div className="rounded-2xl border-2 border-[#2d7a6e] bg-[#0d2a22] p-8 shadow-[0_0_40px_rgba(94,234,212,0.08)]">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 rounded-full bg-[#5eead4] flex items-center justify-center text-[#0d1826]">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/>
                  <circle cx="9" cy="7" r="4"/>
                  <polyline points="16 11 18 13 22 9"/>
                </svg>
              </div>
              <div>
                <p className="text-xs uppercase tracking-widest text-[#5eead4] font-medium">Human Review Required</p>
                <h2 className="text-[#c9d1ec] font-semibold text-lg leading-tight">Ready for your decision</h2>
              </div>
            </div>
            {info ? (
              <div className="space-y-3 mb-6 text-sm text-[#7a87aa]">
                <div className="flex items-center gap-2"><span className="text-[#5eead4]">✓</span> {info.winnerId} recommended ({info.coverage}% of its tests pass)</div>
                <div className="flex items-center gap-2">
                  <span className={info.gatePassed ? 'text-[#5eead4]' : 'text-[#f87171]'}>{info.gatePassed ? '✓' : '✗'}</span>
                  Gate: {info.testsPassed}/{info.testsTotal} tests passed{info.gatePassed ? '' : ', checks failed'}
                </div>
                {review && (
                  <div className="flex items-center gap-2"><span className="text-[#5eead4]">✓</span> Change: +{review.diff.added} −{review.diff.removed} lines in {review.diff.filePath}. Read the diff above before you decide.</div>
                )}
              </div>
            ) : (
              <p className="text-sm text-[#7a87aa] mb-6">Loading review summary (up to a minute if the server was asleep)…</p>
            )}
            <div className="flex gap-3">
              <button
                onClick={handleApprove}
                disabled={decision === 'approving' || !info?.gatePassed}
                className="flex-1 bg-[#5eead4] text-[#0d1826] font-semibold text-sm py-3 px-5 rounded-xl hover:bg-[#7df0de] transition-colors duration-150 disabled:opacity-60"
              >
                {decision === 'approving' ? 'Approving…' : 'Approve fix'}
              </button>
              <button
                onClick={() => setDecision('changes')}
                disabled={decision === 'approving'}
                className="flex-1 bg-transparent text-[#c9d1ec] font-medium text-sm py-3 px-5 rounded-xl border border-[#3a4a62] hover:border-[#7a87aa] hover:text-white transition-colors duration-150 disabled:opacity-60"
              >
                Request changes
              </button>
            </div>
          </div>
        )}
        {decision === 'approved' && (
          <div className="text-center space-y-3">
            <div className="w-14 h-14 rounded-full bg-[#0d2a22] border-2 border-[#5eead4] flex items-center justify-center mx-auto text-2xl">✓</div>
            <p className="text-[#5eead4] font-semibold">Approved. The PR Agent opens the pull request next.</p>
          </div>
        )}
        {decision === 'revising' && (
          <div className="rounded-2xl border border-[#1e3048] bg-[#162035] p-8 text-center space-y-2">
            <p className="text-[#5eead4] font-semibold">Asking the AI for a revised fix…</p>
            <p className="text-sm text-[#7a87aa]">This can take up to a minute.</p>
          </div>
        )}
        {decision === 'sent' && (
          <div className="rounded-2xl border border-[#1e3048] bg-[#162035] p-8 text-center space-y-2">
            <p className="text-[#5eead4] font-semibold">Feedback recorded</p>
            <p className="text-sm text-[#7a87aa]">The fix was not applied. {sentMessage}</p>
          </div>
        )}
        {decision === 'changes' && (
          <div className="rounded-2xl border border-[#1e3048] bg-[#162035] p-8">
            <p className="text-[#c9d1ec] font-medium mb-3">Changes requested</p>
            <textarea
              className="w-full bg-[#0d1826] border border-[#1e3048] rounded-lg p-3 text-sm text-[#c9d1ec] font-sans resize-none h-28 focus:outline-none focus:border-[#5eead4] transition-colors"
              placeholder="What is wrong with this fix, or what should change?"
              value={feedback}
              onChange={(e) => setFeedback(e.target.value)}
            />
            <div className="flex gap-3 mt-3">
              <button
                onClick={handleSubmitFeedback}
                disabled={!feedback.trim()}
                className="bg-[#5eead4] text-[#0d1826] font-semibold text-sm py-2.5 px-5 rounded-lg hover:bg-[#7df0de] transition-colors disabled:opacity-50">
                Submit feedback
              </button>
              <button
                onClick={() => setDecision('none')}
                className="text-[#7a87aa] text-sm hover:text-[#c9d1ec] transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>
      </div>
    </div>
  )
}

interface CostTotals {
  calls: number
  inputTokens: number
  outputTokens: number
  ms: number
  tokensMissing: boolean
  dollars: number | null
}

interface TicketCost {
  pricing: { configured: boolean; inputPerMTok: number | null; outputPerMTok: number | null }
  calls: { kind: string; model: string | null; inputTokens: number | null; outputTokens: number | null; ms: number }[]
  totals: CostTotals
  revisions: number
  usedAI: boolean
}

interface CostSummary {
  tickets: number
  avgDollarsPerTicket: number | null
  avgTokensPerTicket: number | null
  totals: CostTotals
}

interface AblationResult {
  ranAt?: string
  model?: string
  tickets?: number
  trials?: number
  errors?: number
  rows: { n: number; resolved: number; total: number; avgDollars: number | null; avgTokens: number }[]
}

const fmtUsd = (v: number | null) => (v == null ? 'not set' : v < 0.01 ? `$${v.toFixed(4)}` : `$${v.toFixed(2)}`)
const fmtNum = (v: number) => v.toLocaleString('en-US')

function CostStage({ ticketId }: { ticketId: string }) {
  const [ticket, setTicket] = useState<TicketCost | null>(null)
  const [summary, setSummary] = useState<CostSummary | null>(null)
  const [ablation, setAblation] = useState<AblationResult | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setError(null)
    Promise.all([
      fetch(`/api/pipeline/${ticketId}/cost`).then(checkJson),
      fetch('/api/cost/summary').then(checkJson),
      fetch('/api/ablation').then((r) => r.json()),
    ])
      .then(([t, s, a]) => {
        setTicket(t)
        setSummary(s)
        setAblation(a && Array.isArray(a.rows) ? a : null)
      })
      .catch((err) => setError(err.message))
  }, [ticketId])

  if (error) return <ErrorPanel message={error} />
  if (!ticket || !summary) return <LoadingPanel />

  const t = ticket.totals
  const priced = ticket.pricing.configured

  return (
    <div className="fade-in space-y-6">
      {!ticket.usedAI && (
        <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 px-4 py-2 text-xs text-amber-300">
          No AI call was made for this ticket in this server session (the pre-written candidates were used, or the server restarted), so there is no cost to show.
        </div>
      )}
      {ticket.usedAI && !priced && (
        <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 px-4 py-2 text-xs text-amber-300">
          Prices are not set, so dollars are blank. Set COST_INPUT_PER_MTOK and COST_OUTPUT_PER_MTOK on the server (US dollars per million tokens, from Anthropic&apos;s pricing page).
        </div>
      )}

      <div>
        <p className="text-xs uppercase tracking-widest text-[#7a87aa] mb-3 font-medium">This ticket ({ticketId})</p>
        <div className="grid grid-cols-4 gap-4">
          {[
            { label: 'AI cost', value: fmtUsd(t.dollars), sub: priced ? 'measured tokens × your prices' : 'prices not set' },
            { label: 'Tokens', value: fmtNum(t.inputTokens + t.outputTokens), sub: `${fmtNum(t.inputTokens)} in · ${fmtNum(t.outputTokens)} out` },
            { label: 'AI calls', value: String(t.calls), sub: ticket.revisions ? `incl. ${ticket.revisions} revision${ticket.revisions === 1 ? '' : 's'}` : 'no revisions' },
            { label: 'AI time', value: `${(t.ms / 1000).toFixed(1)}s`, sub: 'time waiting for the model' },
          ].map((s) => (
            <div key={s.label} className="bg-[#162035] border border-[#1e3048] rounded-xl p-4">
              <p className="text-xs text-[#7a87aa] mb-1">{s.label}</p>
              <p className="text-2xl font-bold text-[#5eead4] font-mono">{s.value}</p>
              <p className="text-xs text-[#7a87aa] mt-1">{s.sub}</p>
            </div>
          ))}
        </div>
        {t.tokensMissing && <p className="text-xs text-amber-300 mt-2">The API did not report token counts for at least one call, so totals may be low.</p>}
      </div>

      {ticket.calls.length > 0 && (
        <div className="bg-[#162035] border border-[#1e3048] rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[#1e3048] text-xs text-[#7a87aa] uppercase tracking-wider">
                <th className="text-left px-5 py-3 font-medium">Call</th>
                <th className="text-left px-5 py-3 font-medium">Model</th>
                <th className="text-right px-5 py-3 font-medium">In</th>
                <th className="text-right px-5 py-3 font-medium">Out</th>
                <th className="text-right px-5 py-3 font-medium">Time</th>
              </tr>
            </thead>
            <tbody>
              {ticket.calls.map((c, i) => (
                <tr key={i} className="border-b border-[#1e3048] last:border-0 text-[#c9d1ec]">
                  <td className="px-5 py-2.5">{c.kind === 'revision' ? 'Revision' : 'First candidates'}</td>
                  <td className="px-5 py-2.5 font-mono text-xs">{c.model ?? '—'}</td>
                  <td className="px-5 py-2.5 text-right font-mono">{c.inputTokens == null ? '—' : fmtNum(c.inputTokens)}</td>
                  <td className="px-5 py-2.5 text-right font-mono">{c.outputTokens == null ? '—' : fmtNum(c.outputTokens)}</td>
                  <td className="px-5 py-2.5 text-right font-mono">{(c.ms / 1000).toFixed(1)}s</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div>
        <p className="text-xs uppercase tracking-widest text-[#7a87aa] mb-3 font-medium">Across all tickets run since the server started</p>
        <div className="grid grid-cols-3 gap-4">
          {[
            { label: 'Tickets with AI calls', value: String(summary.tickets), sub: 'counted in the average' },
            { label: 'Average cost per ticket', value: fmtUsd(summary.avgDollarsPerTicket), sub: summary.tickets ? 'includes revisions' : 'no data yet' },
            { label: 'Average tokens per ticket', value: summary.avgTokensPerTicket == null ? '—' : fmtNum(summary.avgTokensPerTicket), sub: 'input + output' },
          ].map((s) => (
            <div key={s.label} className="bg-[#162035] border border-[#1e3048] rounded-xl p-4">
              <p className="text-xs text-[#7a87aa] mb-1">{s.label}</p>
              <p className="text-2xl font-bold text-[#c9d1ec] font-mono">{s.value}</p>
              <p className="text-xs text-[#7a87aa] mt-1">{s.sub}</p>
            </div>
          ))}
        </div>
      </div>

      <div>
        <p className="text-xs uppercase tracking-widest text-[#7a87aa] mb-3 font-medium">Ablation: how many candidates is worth the cost?</p>
        {ablation ? (
          <div className="bg-[#162035] border border-[#1e3048] rounded-xl overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[#1e3048] text-xs text-[#7a87aa] uppercase tracking-wider">
                  <th className="text-left px-5 py-3 font-medium">Candidates (N)</th>
                  <th className="text-left px-5 py-3 font-medium">Tickets resolved</th>
                  <th className="text-left px-5 py-3 font-medium">Avg cost / ticket</th>
                  <th className="text-left px-5 py-3 font-medium">Avg tokens</th>
                </tr>
              </thead>
              <tbody>
                {ablation.rows.map((r) => (
                  <tr key={r.n} className="border-b border-[#1e3048] last:border-0 text-[#c9d1ec]">
                    <td className="px-5 py-3 font-mono">{r.n}</td>
                    <td className="px-5 py-3 font-mono">{r.resolved} of {r.total}</td>
                    <td className="px-5 py-3 font-mono">{fmtUsd(r.avgDollars)}</td>
                    <td className="px-5 py-3 font-mono">{fmtNum(r.avgTokens)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="text-xs text-[#7a87aa] px-5 py-3">
              Measured {ablation.ranAt ? new Date(ablation.ranAt).toLocaleDateString() : ''} on {ablation.tickets ?? '?'} tickets × {ablation.trials ?? 1} run{(ablation.trials ?? 1) === 1 ? '' : 's'}{ablation.model ? ` with ${ablation.model}` : ''}. "Resolved" means the best candidate passed every test. Small sample: read as a trend, not a rate.{ablation.errors ? ` ${ablation.errors} call(s) failed and are left out.` : ''}
            </p>
          </div>
        ) : (
          <p className="text-sm text-[#7a87aa] bg-[#162035] border border-[#1e3048] rounded-xl p-4">
            Not measured yet. Run the ablation script to fill this table with real numbers (no placeholder values are shown).
          </p>
        )}
      </div>
    </div>
  )
}

// ── Dashboard (ticket queue + stats overview) ─────────────────────────────────

interface TicketSummary {
  id: string
  title: string
  status: string
  source?: string
  url?: string | null
}

interface JiraStatus {
  enabled: boolean
  ok: boolean
  count: number
  error: string | null
}

interface StatsResponse {
  total: number
  queued: number
  inProgress: number
  solved: number
  byStatus: Record<string, number>
  avgResolutionMs: number | null
  avgResolutionSeconds: number | null
}

const STATUS_LABEL: Record<string, string> = {
  queued: 'Queued',
  located: 'Located',
  fixed: 'Fixed',
  gated: 'Gated',
  gate_failed: 'Gate Failed',
  pr_ready: 'PR Ready',
  approved: 'Approved',
}

const STATUS_COLOR: Record<string, string> = {
  queued: '#3a4a62',
  located: '#7a87aa',
  fixed: '#c9a84a',
  gated: '#4a9ac9',
  gate_failed: '#f87171',
  pr_ready: '#a78bfa',
  approved: '#5eead4',
}

function StatusDonut({ byStatus, total }: { byStatus: Record<string, number>; total: number }) {
  const order = ['approved', 'pr_ready', 'gated', 'gate_failed', 'fixed', 'located', 'queued']
  let acc = 0
  const stops: string[] = []
  order.forEach((key) => {
    const count = byStatus[key] || 0
    if (count === 0) return
    const start = (acc / Math.max(total, 1)) * 360
    acc += count
    const end = (acc / Math.max(total, 1)) * 360
    stops.push(`${STATUS_COLOR[key]} ${start}deg ${end}deg`)
  })
  const gradient = stops.length ? `conic-gradient(${stops.join(', ')})` : '#1e3048'

  return (
    <div className="flex items-center gap-6">
      <div
        className="w-28 h-28 rounded-full shrink-0 flex items-center justify-center"
        style={{ background: gradient }}
      >
        <div className="w-16 h-16 rounded-full bg-[#162035] flex flex-col items-center justify-center">
          <span className="text-lg font-bold text-[#c9d1ec] font-mono">{total}</span>
          <span className="text-[9px] text-[#7a87aa] uppercase tracking-wider">tickets</span>
        </div>
      </div>
      <div className="space-y-1.5">
        {order
          .filter((key) => (byStatus[key] || 0) > 0)
          .map((key) => (
            <div key={key} className="flex items-center gap-2 text-xs">
              <span className="w-2 h-2 rounded-full shrink-0" style={{ background: STATUS_COLOR[key] }} />
              <span className="text-[#7a87aa]">{STATUS_LABEL[key]}</span>
              <span className="text-[#c9d1ec] font-mono ml-1">{byStatus[key]}</span>
            </div>
          ))}
      </div>
    </div>
  )
}

function Gauge({ value, label, sub }: { value: number; label: string; sub: string }) {
  const pct = Math.max(0, Math.min(100, value))
  const angle = (pct / 100) * 180
  return (
    <div className="flex flex-col items-center">
      <svg width="120" height="68" viewBox="0 0 120 68">
        <path d="M 10 64 A 50 50 0 0 1 110 64" fill="none" stroke="#1e3048" strokeWidth="10" strokeLinecap="round" />
        <path
          d="M 10 64 A 50 50 0 0 1 110 64"
          fill="none"
          stroke="#5eead4"
          strokeWidth="10"
          strokeLinecap="round"
          strokeDasharray={`${(angle / 180) * 157} 157`}
        />
        <text x="60" y="52" textAnchor="middle" fontSize="20" fontWeight="700" fill="#c9d1ec" fontFamily="monospace">
          {pct.toFixed(0)}%
        </text>
      </svg>
      <p className="text-xs text-[#7a87aa] -mt-1">{label}</p>
      <p className="text-[10px] text-[#3a4a62]">{sub}</p>
    </div>
  )
}

function Dashboard({ onOpenTicket }: { onOpenTicket: (id: string) => void }) {
  const [tickets, setTickets] = useState<TicketSummary[]>([])
  const [stats, setStats] = useState<StatsResponse | null>(null)
  const [jiraStatus, setJiraStatus] = useState<JiraStatus | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [filter, setFilter] = useState<'all' | 'queued' | 'inProgress' | 'solved'>('all')

  const load = useCallback(() => {
    Promise.all([
      fetch('/api/tickets').then((r) => r.json()) as Promise<TicketSummary[]>,
      fetch('/api/stats').then((r) => r.json()) as Promise<StatsResponse>,
      fetch('/api/jira/status').then((r) => r.json()) as Promise<JiraStatus>,
    ])
      .then(([t, s, j]) => {
        setTickets(t)
        setStats(s)
        setJiraStatus(j)
      })
      .catch((err) => setError(err.message))
  }, [])

  useEffect(() => {
    load()
  }, [load])

  if (error) return <ErrorPanel message={error} />
  if (!stats) return <LoadingPanel />

  const resolutionRate = stats.total ? Math.round((stats.solved / stats.total) * 100) : 0

  const inProgressStatuses = new Set(['located', 'fixed', 'gated', 'gate_failed', 'pr_ready'])
  const filteredTickets = tickets.filter((t) => {
    if (filter === 'all') return true
    if (filter === 'queued') return t.status === 'queued'
    if (filter === 'solved') return t.status === 'approved'
    if (filter === 'inProgress') return inProgressStatuses.has(t.status)
    return true
  })

  return (
    <div className="fade-in space-y-6">
      {/* KPI row */}
      <div className="grid grid-cols-4 gap-4">
        {[
          { label: 'Total tickets', value: stats.total, onClick: () => setFilter('all') },
          { label: 'Queued', value: stats.queued, onClick: () => setFilter('queued') },
          { label: 'In progress', value: stats.inProgress, onClick: () => setFilter('inProgress') },
          { label: 'Solved', value: stats.solved, onClick: () => setFilter('solved') },
        ].map((kpi) => (
          <button
            key={kpi.label}
            onClick={kpi.onClick}
            className={`text-left bg-[#162035] border rounded-xl p-4 transition-colors ${
              filter === kpi.label.toLowerCase().replace(' ', '') ? 'border-[#5eead4]' : 'border-[#1e3048] hover:border-[#3a4a62]'
            }`}
          >
            <p className="text-xs text-[#7a87aa] mb-1">{kpi.label}</p>
            <p className="text-2xl font-bold text-[#c9d1ec] font-mono">{kpi.value}</p>
          </button>
        ))}
      </div>

      {/* Donut + gauges */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-[#162035] border border-[#1e3048] rounded-xl p-5 flex items-center justify-center">
          <StatusDonut byStatus={stats.byStatus} total={stats.total} />
        </div>
        <div className="bg-[#162035] border border-[#1e3048] rounded-xl p-5 flex items-center justify-center">
          <Gauge value={resolutionRate} label="Resolution rate" sub={`${stats.solved} of ${stats.total} solved`} />
        </div>
        <div className="bg-[#162035] border border-[#1e3048] rounded-xl p-5 flex flex-col items-center justify-center">
          <p className="text-2xl font-bold text-[#5eead4] font-mono">
            {stats.avgResolutionSeconds !== null ? `${stats.avgResolutionSeconds}s` : '—'}
          </p>
          <p className="text-xs text-[#7a87aa] mt-1">Avg. pipeline time</p>
          <p className="text-[10px] text-[#3a4a62] mt-0.5">queued → approved, per ticket</p>
        </div>
      </div>

      {/* Ticket list */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <p className="text-xs uppercase tracking-widest text-[#7a87aa] font-medium">
            Tickets <span className="normal-case text-[#3a4a62]">({filteredTickets.length} shown)</span>
          </p>
          {jiraStatus && (
            <span className={`text-[11px] ${jiraStatus.error ? 'text-amber-300' : 'text-[#7a87aa]'}`}>
              {!jiraStatus.enabled
                ? 'Jira: not connected'
                : jiraStatus.error
                  ? `Jira error: ${jiraStatus.error}`
                  : `Jira: connected, ${jiraStatus.count} open issue${jiraStatus.count === 1 ? '' : 's'}`}
            </span>
          )}
          {filter !== 'all' && (
            <button onClick={() => setFilter('all')} className="text-xs text-[#5eead4] hover:text-[#7df0de]">
              Clear filter
            </button>
          )}
        </div>
        <div className="bg-[#162035] border border-[#1e3048] rounded-xl overflow-hidden">
          {filteredTickets.map((t, i) => (
            <button
              key={t.id}
              onClick={() => onOpenTicket(t.id)}
              className={`w-full text-left flex items-center justify-between px-5 py-3.5 hover:bg-[#1e3048] transition-colors ${
                i < filteredTickets.length - 1 ? 'border-b border-[#1e3048]' : ''
              }`}
            >
              <div className="flex items-center gap-3 min-w-0">
                <span className="text-xs font-mono text-[#7a87aa] shrink-0">{t.id}</span>
                {t.source === 'jira' && (
                  <span className="text-[10px] px-1.5 py-0.5 rounded border border-[#2d7a6e] text-[#5eead4] shrink-0">Jira</span>
                )}
                <span className="text-sm text-[#c9d1ec] truncate">{t.title}</span>
              </div>
              <span
                className="text-xs px-2.5 py-1 rounded-full border shrink-0 ml-4"
                style={{
                  color: STATUS_COLOR[t.status],
                  borderColor: STATUS_COLOR[t.status] + '66',
                  background: STATUS_COLOR[t.status] + '1a',
                }}
              >
                {STATUS_LABEL[t.status] ?? t.status}
              </span>
            </button>
          ))}
          {filteredTickets.length === 0 && (
            <p className="text-sm text-[#7a87aa] px-5 py-8 text-center">No tickets match this filter.</p>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Stepper ───────────────────────────────────────────────────────────────────

function StepperNode({ stage, state, onClick }: { stage: Stage; state: StageState; onClick: () => void }) {
  const isActive = state === 'active'
  const isCompleted = state === 'completed'
  const isLocked = state === 'locked'

  return (
    <button
      onClick={onClick}
      disabled={isLocked}
      className={`flex flex-col items-center gap-2 group transition-opacity ${isLocked ? 'opacity-30 cursor-not-allowed' : 'cursor-pointer'}`}
    >
      <div className={`
        w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold transition-all duration-200
        ${isActive ? 'bg-[#5eead4] text-[#0d1826] pulse-active' : ''}
        ${isCompleted ? 'bg-[#0d2a22] text-[#5eead4] border-2 border-[#2d7a6e] group-hover:border-[#5eead4]' : ''}
        ${isLocked ? 'bg-[#162035] text-[#7a87aa] border-2 border-[#1e3048]' : ''}
      `}>
        {isCompleted ? '✓' : stage.id}
      </div>
      <span className={`text-xs font-medium whitespace-nowrap ${isActive ? 'text-[#5eead4]' : isCompleted ? 'text-[#c9d1ec]' : 'text-[#3a4a62]'}`}>
        {stage.shortLabel}
      </span>
    </button>
  )
}

function Connector({ completed }: { completed: boolean }) {
  return (
    <div className="flex-1 h-px mx-1 mt-[-18px] transition-colors duration-500" style={{ background: completed ? '#2d7a6e' : '#1e3048' }} />
  )
}

// ── Main app ──────────────────────────────────────────────────────────────────

export default function App() {
  const [view, setView] = useState<'dashboard' | 'pipeline'>('dashboard')
  const [ticketId, setTicketId] = useState('BUG-4821')
  const [activeStage, setActiveStage] = useState(1)
  const [viewingStage, setViewingStage] = useState(1)
  const [loading, setLoading] = useState(false)
  const [locatorBlocked, setLocatorBlocked] = useState(false)

  const openTicket = (id: string) => {
    setTicketId(id)
    setActiveStage(1)
    setViewingStage(1)
    setLocatorBlocked(false)
    setView('pipeline')
  }

  const getState = (id: number): StageState => {
    if (id < activeStage) return 'completed'
    if (id === activeStage) return 'active'
    return 'locked'
  }

  const handleStepperClick = (id: number) => {
    if (getState(id) === 'locked') return
    if (getState(id) === 'completed') {
      setViewingStage(id)
    }
  }

  const handleContinue = useCallback(() => {
    if (activeStage >= STAGES.length) return
    setLoading(true)
    setViewingStage(activeStage)
    setTimeout(() => {
      const next = activeStage + 1
      setActiveStage(next)
      setViewingStage(next)
      setLoading(false)
    }, 400)
  }, [activeStage])

  // After "Request changes" produces new candidates, go back to the Fixer stage.
  const handleRevised = useCallback(() => {
    setActiveStage(2)
    setViewingStage(2)
  }, [])

  const stageLabel = STAGES.find((s) => s.id === viewingStage)?.label ?? ''
  const isViewingActive = viewingStage === activeStage

  return (
    <div className="min-h-screen bg-[#0d1826] text-[#c9d1ec] flex flex-col">
      {/* Header */}
      <header className="border-b border-[#1e3048] px-8 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-7 h-7 rounded-lg bg-[#5eead4] flex items-center justify-center">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#0d1826" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>
            </svg>
          </div>
          <span className="font-semibold text-[#c9d1ec] tracking-tight">Ticket to PR Pipeline</span>
          <nav className="ml-6 flex items-center gap-1">
            <button
              onClick={() => setView('dashboard')}
              className={`text-xs font-medium px-3 py-1.5 rounded-lg transition-colors ${
                view === 'dashboard' ? 'bg-[#1e3048] text-[#5eead4]' : 'text-[#7a87aa] hover:text-[#c9d1ec]'
              }`}
            >
              Dashboard
            </button>
            <button
              onClick={() => setView('pipeline')}
              className={`text-xs font-medium px-3 py-1.5 rounded-lg transition-colors ${
                view === 'pipeline' ? 'bg-[#1e3048] text-[#5eead4]' : 'text-[#7a87aa] hover:text-[#c9d1ec]'
              }`}
            >
              Pipeline
            </button>
          </nav>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-[#5eead4] animate-pulse" />
          <span className="text-xs text-[#7a87aa]">Agent running</span>
          <button
            onClick={() => {
              fetch('/api/reset', { method: 'POST' }).then(() => window.location.reload())
            }}
            className="ml-3 text-xs font-medium px-3 py-1.5 rounded-lg border border-[#1e3048] text-[#7a87aa] hover:text-[#c9d1ec] transition-colors"
          >
            Reset demo
          </button>
          {view === 'pipeline' && (
            <span className="ml-3 text-xs font-mono text-[#3a4a62] bg-[#162035] border border-[#1e3048] px-2 py-1 rounded">{ticketId}</span>
          )}
        </div>
      </header>

      {view === 'dashboard' ? (
        <main className="flex-1 px-8 py-8 max-w-4xl mx-auto w-full">
          <div className="mb-6">
            <p className="text-xs uppercase tracking-widest text-[#7a87aa] mb-1 font-medium">Overview</p>
            <h1 className="text-xl font-semibold text-[#c9d1ec]">Ticket Pipeline Dashboard</h1>
          </div>
          <Dashboard onOpenTicket={openTicket} />
        </main>
      ) : (
        <>
          {/* Stepper */}
          <div className="px-8 py-6 border-b border-[#1e3048]">
            <div className="max-w-3xl mx-auto flex items-start">
              {STAGES.map((stage, i) => (
                <Fragment key={stage.id}>
                  <StepperNode
                    stage={stage}
                    state={getState(stage.id)}
                    onClick={() => handleStepperClick(stage.id)}
                  />
                  {i < STAGES.length - 1 && (
                    <Connector completed={stage.id < activeStage} />
                  )}
                </Fragment>
              ))}
            </div>
          </div>

          {/* Content */}
          <main className="flex-1 px-8 py-8 max-w-4xl mx-auto w-full">
            <div className="flex items-center justify-between mb-6">
              <div>
                <p className="text-xs uppercase tracking-widest text-[#7a87aa] mb-1 font-medium">
                  Stage {viewingStage} of {STAGES.length}
                  {!isViewingActive && <span className="ml-2 text-[#3a4a62]">(reviewing)</span>}
                </p>
                <h1 className="text-xl font-semibold text-[#c9d1ec]">{stageLabel}</h1>
              </div>
              {isViewingActive && !loading && activeStage < STAGES.length && activeStage !== 4 && !(activeStage === 1 && locatorBlocked) && (
                <button
                  onClick={handleContinue}
                  className="flex items-center gap-2 bg-[#5eead4] text-[#0d1826] font-semibold text-sm px-5 py-2.5 rounded-xl hover:bg-[#7df0de] transition-colors duration-150"
                >
                  Continue
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="9 18 15 12 9 6"/>
                  </svg>
                </button>
              )}
            </div>

            <div className="bg-[#162035] border border-[#1e3048] rounded-2xl p-6 min-h-[400px]">
              {loading ? (
                <LoadingPanel />
              ) : (
                <>
                  {viewingStage === 1 && <LocatorStage ticketId={ticketId} onBlocked={setLocatorBlocked} />}
                  {viewingStage === 2 && <FixerStage ticketId={ticketId} />}
                  {viewingStage === 3 && <GateStage ticketId={ticketId} />}
                  {viewingStage === 4 && <ApprovalStage ticketId={ticketId} onApprove={handleContinue} onRevised={handleRevised} />}
                  {viewingStage === 5 && <PRAgentStage ticketId={ticketId} />}
                  {viewingStage === 6 && <CostStage ticketId={ticketId} />}
                </>
              )}
            </div>

            {!isViewingActive && (
              <div className="mt-4 flex justify-end">
                <button
                  onClick={() => setViewingStage(activeStage)}
                  className="text-xs text-[#5eead4] hover:text-[#7df0de] transition-colors flex items-center gap-1"
                >
                  Back to current stage
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="9 18 15 12 9 6"/>
                  </svg>
                </button>
              </div>
            )}
          </main>
        </>
      )}
    </div>
  )
}
