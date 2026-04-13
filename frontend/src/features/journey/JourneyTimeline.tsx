import { useState, useRef, useEffect, useMemo, useCallback } from 'react'
import { useJourneyStore, type MembershipLength } from '../../stores/journeyStore'
import type { ClientJourneyStep, ClientJourneyTemplate } from '../../types/journey'
import { Badge } from '../../components/ui/Badge'
import { cn } from '../../lib/utils'

const MEMBERSHIP_DAYS: Record<MembershipLength, number> = { 3: 90, 6: 180, 12: 365 }
const MEMBERSHIP_OPTIONS: MembershipLength[] = [3, 6, 12]
const MEMBERSHIP_LABELS: Record<MembershipLength, string> = { 3: '3 mo', 6: '6 mo', 12: '12 mo' }
const MIN_GAP_PX = 60
const TRACK_PAD = 40
const NODE_RADIUS = 7
const TRACK_Y = 64

type PositionedNode = {
  step: ClientJourneyStep
  absoluteDay: number
  anchor: 'start' | 'expiry1' | 'expiry2'
  /** Secondary line (e.g. timing); empty when suppressed */
  dayLabel: string
  /** Title above the track, day label below — avoids cramped 0d / EXPIRY stacking */
  labelLayout: 'alternate' | 'split'
  isConditional: boolean
  xPx: number
  color: string
  textPosition: 'above' | 'below'
}

function buildAndPositionForLocation(
  newMemberSteps: ClientJourneyStep[],
  renewalSteps: ClientJourneyStep[],
  totalDays: number,
  membershipLength: MembershipLength,
  containerWidth: number
): { nodes: PositionedNode[], trackInnerWidth: number, anchorXs: { start: number, expiry1: number, expiry2: number } } {
  const minTrackWidth = 1000
  const trackWidthBase = Math.max(containerWidth, minTrackWidth)
  const usable = trackWidthBase - TRACK_PAD * 2
  const maxDay = totalDays * 2

  const nodes: PositionedNode[] = []

  newMemberSteps
    .filter(s => s.days_from_start != null || s.days_from_expiry != null)
    .forEach(s => {
      const fromStart = s.days_from_start != null
      const raw = fromStart ? s.days_from_start! : totalDays - s.days_from_expiry!
      const absoluteDay = Math.max(0, Math.min(totalDays, raw))

      const atExpiryZero =
        !fromStart && s.days_from_expiry != null && s.days_from_expiry === 0
      let dayLabel: string
      let labelLayout: PositionedNode['labelLayout'] = 'alternate'
      if (fromStart) {
        dayLabel = s.days_from_start === 0 ? 'Day 0' : `Day ${s.days_from_start}`
      } else if (atExpiryZero) {
        dayLabel = 'EXPIRY'
        labelLayout = 'split'
      } else {
        dayLabel = `${s.days_from_expiry}d pre`
      }

      nodes.push({
        step: s,
        absoluteDay,
        anchor: fromStart ? 'start' : 'expiry1',
        dayLabel,
        labelLayout,
        isConditional: (s.min_membership_months ?? 0) > membershipLength,
        xPx: 0,
        color: 'var(--blue)',
        textPosition: 'below'
      })
    })

  renewalSteps
    .filter(s => s.days_from_start != null || s.days_from_expiry != null)
    .forEach(s => {
      const fromStart = s.days_from_start != null
      const raw = fromStart ? totalDays + s.days_from_start! : totalDays * 2 - s.days_from_expiry!
      const absoluteDay = Math.max(totalDays, Math.min(totalDays * 2, raw))

      const atRenewalStartZero = fromStart && s.days_from_start === 0
      const atRenewalExpiryZero =
        !fromStart && s.days_from_expiry != null && s.days_from_expiry === 0
      let dayLabel: string
      let labelLayout: PositionedNode['labelLayout'] = 'alternate'
      if (atRenewalStartZero) {
        dayLabel = 'EXPIRY'
        labelLayout = 'split'
      } else if (atRenewalExpiryZero) {
        dayLabel = 'EXPIRY'
        labelLayout = 'split'
      } else if (fromStart) {
        dayLabel = `Ren. Day ${s.days_from_start}`
      } else {
        dayLabel = `${s.days_from_expiry}d pre`
      }

      nodes.push({
        step: s,
        absoluteDay,
        anchor: fromStart ? 'expiry1' : 'expiry2',
        dayLabel,
        labelLayout,
        isConditional: (s.min_membership_months ?? 0) > membershipLength,
        xPx: 0,
        color: 'var(--purple)',
        textPosition: 'below'
      })
    })

  nodes.sort((a, b) => a.absoluteDay - b.absoluteDay)

  for (const n of nodes) {
    n.xPx = TRACK_PAD + (n.absoluteDay / maxDay) * usable
  }

  for (let i = 1; i < nodes.length; i++) {
    if (nodes[i].xPx - nodes[i - 1].xPx < MIN_GAP_PX) {
      nodes[i].xPx = nodes[i - 1].xPx + MIN_GAP_PX
    }
  }

  let finalWidth = trackWidthBase
  const lastNode = nodes[nodes.length - 1]
  if (lastNode && lastNode.xPx > finalWidth - TRACK_PAD) {
    finalWidth = lastNode.xPx + TRACK_PAD
  }

  const anchorXs = {
    start: TRACK_PAD,
    expiry1: TRACK_PAD + 0.5 * usable,
    expiry2: TRACK_PAD + usable
  }

  // Alternate title placement above/below track (split nodes keep title above, timing below)
  nodes.forEach((n, i) => {
    if (n.labelLayout === 'split') return
    n.textPosition = i % 2 === 0 ? 'below' : 'above'
  })

  return { nodes, trackInnerWidth: finalWidth, anchorXs }
}

function getLinkIcon(type: string) {
  switch (type) {
    case 'retool': return '\u{1F4CB}'
    case 'canva': return '\u{1F3A8}'
    case 'whatsapp': return '\u{1F4AC}'
    case 'jotform': return '\u{1F4DD}'
    default: return '\u{1F517}'
  }
}

function NodeTooltip({
  node,
  onClose,
}: {
  node: PositionedNode
  onClose: () => void
}) {
  const tooltipRef = useRef<HTMLDivElement>(null)
  const tooltipWidth = 280
  const [coords, setCoords] = useState<{ left: number; top: number; isAbove: boolean; arrowLeft: number } | null>(null)

  useEffect(() => {
    const updateCoords = () => {
      const el = document.getElementById(`timeline-node-${node.step.id}`)
      if (!el) return
      
      const rect = el.getBoundingClientRect()
      const nodeCenterX = rect.left + rect.width / 2
      
      let left = nodeCenterX - tooltipWidth / 2
      if (left < 16) left = 16
      if (left + tooltipWidth > window.innerWidth - 16) left = window.innerWidth - tooltipWidth - 16
      
      const arrowLeft = nodeCenterX - left
      
      let isAbove = node.textPosition === 'above'
      const estimatedHeight = 250
      
      if (isAbove && rect.top - estimatedHeight < 64) {
        isAbove = false
      } else if (!isAbove && rect.bottom + estimatedHeight > window.innerHeight - 20) {
        isAbove = true
      }
      
      const top = isAbove ? rect.top - 12 : rect.bottom + 12
      
      setCoords({ left, top, isAbove, arrowLeft })
    }
    
    updateCoords()
    window.addEventListener('scroll', updateCoords, true)
    window.addEventListener('resize', updateCoords)
    return () => {
      window.removeEventListener('scroll', updateCoords, true)
      window.removeEventListener('resize', updateCoords)
    }
  }, [node])

  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    function handleClick(e: MouseEvent) {
      const el = document.getElementById(`timeline-node-${node.step.id}`)
      if (el && el.contains(e.target as Node)) return
      
      if (tooltipRef.current && !tooltipRef.current.contains(e.target as Node)) {
        onClose()
      }
    }
    document.addEventListener('keydown', handleKey)
    document.addEventListener('mousedown', handleClick, true)
    return () => {
      document.removeEventListener('keydown', handleKey)
      document.removeEventListener('mousedown', handleClick, true)
    }
  }, [onClose, node.step.id])

  if (!coords) return null

  const { step } = node

  return (
    <div
      ref={tooltipRef}
      className="fixed z-[60] transition-opacity duration-150"
      style={{
        left: coords.left,
        top: coords.top,
        width: tooltipWidth,
        transform: coords.isAbove ? 'translateY(-100%)' : undefined,
      }}
    >
      <div
        className="bg-white rounded-xl border shadow-lg p-4 text-left relative"
        style={{ borderColor: 'var(--border)' }}
      >
        <div className="flex items-start justify-between gap-2 mb-2">
          <h4 className="text-sm font-semibold" style={{ color: 'var(--text)' }}>
            {step.title}
          </h4>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 flex-shrink-0 -mt-0.5"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {step.assigned_role && (
          <div className="mb-2">
            <Badge variant="blue" className="text-[10px]">
              <span className="whitespace-normal leading-tight">{step.assigned_role}</span>
            </Badge>
          </div>
        )}

        {step.actions && step.actions.length > 0 && (
          <ul className="space-y-1.5 mb-2">
            {step.actions.map((action, idx) => (
              <li key={idx} className="flex items-start gap-1.5 text-xs leading-snug">
                <span
                  className="flex-shrink-0 mt-0.5"
                  style={{ color: action.category === 'note' ? 'var(--text-muted)' : 'var(--color-gold)' }}
                >
                  {action.category === 'note' ? '\u2192' : '\u2022'}
                </span>
                <span
                  style={{ color: action.category === 'note' ? 'var(--text-muted)' : 'var(--text)' }}
                  className={action.category === 'note' ? 'italic' : ''}
                >
                  {action.text}
                </span>
              </li>
            ))}
          </ul>
        )}

        {step.forms_links && step.forms_links.length > 0 && (
          <div className="flex flex-wrap gap-1.5 pt-2 border-t" style={{ borderColor: 'var(--border)' }}>
            {step.forms_links.map((link, idx) => (
              <a
                key={idx}
                href={link.url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded border transition-colors hover:border-[var(--color-gold)] hover:text-[var(--color-gold)]"
                style={{ backgroundColor: 'var(--bg3)', borderColor: 'var(--border)', color: 'var(--text)' }}
              >
                <span>{getLinkIcon(link.type)}</span>
                <span className="truncate max-w-[120px]">{link.label}</span>
              </a>
            ))}
          </div>
        )}

        {node.isConditional && (
          <div className="mt-2 text-[10px] italic" style={{ color: 'var(--text-muted)' }}>
            Requires {node.step.min_membership_months}+ month membership
          </div>
        )}

        {/* Arrow pointing to node */}
        <div
          className={cn('absolute', coords.isAbove ? '-bottom-1.5' : '-top-1.5')}
          style={{
            left: coords.arrowLeft - 6,
            width: 12,
            height: 6,
            overflow: 'hidden',
            transform: coords.isAbove ? 'rotate(180deg)' : undefined,
          }}
        >
          <div
            className="w-3 h-3 bg-white border rotate-45"
            style={{
              borderColor: 'var(--border)',
              marginTop: -6,
              marginLeft: 1.5,
            }}
          />
        </div>
      </div>
    </div>
  )
}

function LocationTimelineRow({
  location,
  newMemberSteps,
  renewalSteps,
  totalDays,
  membershipLength,
  activeNodeId,
  setActiveNodeId,
}: {
  location: string
  newMemberSteps: ClientJourneyStep[]
  renewalSteps: ClientJourneyStep[]
  totalDays: number
  membershipLength: MembershipLength
  activeNodeId: string | null
  setActiveNodeId: (id: string | null) => void
}) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [containerWidth, setContainerWidth] = useState(0)

  useEffect(() => {
    if (!containerRef.current) return
    const ro = new ResizeObserver(entries => {
      setContainerWidth(entries[0].contentRect.width)
    })
    ro.observe(containerRef.current)
    return () => ro.disconnect()
  }, [])

  const { nodes, trackInnerWidth, anchorXs } = useMemo(
    () => buildAndPositionForLocation(newMemberSteps, renewalSteps, totalDays, membershipLength, containerWidth),
    [newMemberSteps, renewalSteps, totalDays, membershipLength, containerWidth],
  )

  const activeNode = nodes.find(n => n.step.id === activeNodeId) ?? null

  /** Global anchor labels share the same x as nodes; split nodes already show title + EXPIRY — hide to avoid "Renewal"/"Expiry" stacking on the dot */
  const hideExpiry1Anchor = nodes.some((n) => n.labelLayout === 'split' && n.anchor === 'expiry1')
  const hideExpiry2Anchor = nodes.some((n) => n.labelLayout === 'split' && n.anchor === 'expiry2')

  return (
    <div className={cn("mb-6 last:mb-0 relative transition-all duration-200", activeNode ? "z-50" : "z-10")}>
      <div
        className="text-xs font-bold mb-2 px-1 uppercase tracking-wider"
        style={{ color: 'var(--text)' }}
      >
        {location}
      </div>

      <div className="relative">
        <div 
          ref={containerRef} 
          className="overflow-x-auto pb-4" 
          style={{ scrollbarWidth: 'thin' }}
        >
          <div className="relative" style={{ height: 130, width: trackInnerWidth }}>
          
          {/* Anchor labels */}
          <div
            className="absolute text-[9px] font-bold uppercase tracking-wider"
            style={{ left: anchorXs.start, top: TRACK_Y - 20, transform: 'translateX(-50%)', color: 'var(--color-gold)' }}
          >
            Start
          </div>
          {!hideExpiry1Anchor && (
            <div
              className="absolute text-[9px] font-bold uppercase tracking-wider"
              style={{ left: anchorXs.expiry1, top: TRACK_Y - 20, transform: 'translateX(-50%)', color: 'var(--blue)' }}
            >
              Expiry
            </div>
          )}
          {!hideExpiry2Anchor && (
            <div
              className="absolute text-[9px] font-bold uppercase tracking-wider whitespace-nowrap"
              style={{ left: anchorXs.expiry2, top: TRACK_Y - 20, transform: 'translateX(-50%)', color: 'var(--purple)' }}
            >
              Renewal Expiry
            </div>
          )}

          {/* Track background line */}
          <div
            className="absolute h-px"
            style={{
              left: anchorXs.start,
              width: anchorXs.expiry1 - anchorXs.start,
              top: TRACK_Y,
              borderTop: '2px solid var(--blue)',
              opacity: 0.3,
            }}
          />
          <div
            className="absolute h-px"
            style={{
              left: anchorXs.expiry1,
              width: anchorXs.expiry2 - anchorXs.expiry1,
              top: TRACK_Y,
              borderTop: '2px solid var(--purple)',
              opacity: 0.3,
            }}
          />

          {/* Nodes */}
          {nodes.map(node => {
            const isActive = node.step.id === activeNodeId
            const fillColor = node.color || 'var(--color-gold)'
            return (
              <button
                id={`timeline-node-${node.step.id}`}
                key={node.step.id}
                type="button"
                onClick={(e) => {
                  e.stopPropagation()
                  setActiveNodeId(isActive ? null : node.step.id)
                }}
                className={cn(
                  'absolute rounded-full transition-all duration-150 focus:outline-none',
                  node.isConditional ? 'border-2 border-dashed' : 'border-2',
                  isActive && 'ring-4 ring-offset-2 ring-white',
                )}
                style={{
                  left: node.xPx - NODE_RADIUS,
                  top: TRACK_Y - NODE_RADIUS,
                  width: NODE_RADIUS * 2,
                  height: NODE_RADIUS * 2,
                  background: node.isConditional ? 'white' : fillColor,
                  borderColor: node.isConditional ? fillColor : fillColor,
                  opacity: node.isConditional ? 0.45 : 1,
                  transform: isActive ? 'scale(1.3)' : 'scale(1)',
                  zIndex: isActive ? 60 : 10,
                }}
                title={node.step.title}
              />
            )
          })}

          {/* Labels above/below nodes */}
          {nodes.map(node =>
            node.labelLayout === 'split' ? (
              <div key={`lbl-${node.step.id}`} className="pointer-events-none">
                <div
                  className="absolute text-center"
                  style={{
                    left: node.xPx,
                    top: TRACK_Y - NODE_RADIUS - 36,
                    transform: 'translateX(-50%)',
                    opacity: node.isConditional ? 0.45 : 1,
                  }}
                >
                  <div
                    className="text-[10px] font-medium leading-tight whitespace-normal break-words max-w-[120px]"
                    style={{ color: 'var(--text)' }}
                    title={node.step.title}
                  >
                    {node.step.title}
                  </div>
                </div>
                <div
                  className="absolute text-center text-[9px] font-bold uppercase tracking-wide"
                  style={{
                    left: node.xPx,
                    top: TRACK_Y + NODE_RADIUS + 10,
                    transform: 'translateX(-50%)',
                    color: node.color,
                    opacity: node.isConditional ? 0.45 : 1,
                  }}
                >
                  {node.dayLabel}
                </div>
                {node.isConditional && node.step.min_membership_months ? (
                  <div
                    className="absolute text-[8px] font-semibold rounded px-1"
                    style={{
                      left: node.xPx,
                      top: TRACK_Y + NODE_RADIUS + 26,
                      transform: 'translateX(-50%)',
                      color: 'var(--orange)',
                      background: 'var(--orange-bg)',
                    }}
                  >
                    {node.step.min_membership_months}mo+
                  </div>
                ) : null}
              </div>
            ) : (
              <div
                key={`lbl-${node.step.id}`}
                className="absolute text-center pointer-events-none"
                style={{
                  left: node.xPx,
                  top: node.textPosition === 'below' ? TRACK_Y + NODE_RADIUS + 8 : undefined,
                  bottom: node.textPosition === 'above' ? 130 - (TRACK_Y - NODE_RADIUS - 8) : undefined,
                  transform: 'translateX(-50%)',
                  opacity: node.isConditional ? 0.45 : 1,
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: node.textPosition === 'below' ? 'flex-start' : 'flex-end',
                }}
              >
                <div
                  className="text-[10px] font-medium leading-tight whitespace-normal break-words max-w-[96px]"
                  style={{ color: 'var(--text)' }}
                  title={node.step.title}
                >
                  {node.step.title}
                </div>
                {node.dayLabel ? (
                  <div className="text-[9px] leading-tight" style={{ color: 'var(--text-muted)' }}>
                    {node.dayLabel}
                  </div>
                ) : null}
                {node.isConditional && node.step.min_membership_months && (
                  <div
                    className="text-[8px] font-semibold mt-0.5 rounded px-1 inline-block"
                    style={{ color: 'var(--orange)', background: 'var(--orange-bg)' }}
                  >
                    {node.step.min_membership_months}mo+
                  </div>
                )}
              </div>
            ),
          )}

        </div>
      </div>

      {/* Tooltip rendered outside overflow-x-auto so it doesn't get clipped */}
      {activeNode && (
        <NodeTooltip node={activeNode} onClose={() => setActiveNodeId(null)} />
      )}
      
      </div>
    </div>
  )
}

export function JourneyTimeline({
  templates,
}: {
  templates: ClientJourneyTemplate[]
}) {
  const { templates: allTemplates, selectedLocation, setLocationFilter, steps, selectedMembershipLength, setMembershipLength, showTimeline, toggleTimeline } = useJourneyStore()
  const [activeNodeId, setActiveNodeId] = useState<string | null>(null)

  const handleNodeClick = useCallback((id: string | null) => {
    setActiveNodeId(id)
  }, [])

  const totalDays = MEMBERSHIP_DAYS[selectedMembershipLength]

  // Get unique locations from the passed templates (for rendering rows)
  const locations = Array.from(new Set(templates.map(t => t.location))).sort()
  
  // Get all possible locations from all templates for the filter
  const allLocations = ['All', ...Array.from(new Set(allTemplates.map(t => t.location))).sort()]

  if (!showTimeline) {
    return (
      <div className="bg-white rounded-xl border shadow-sm p-4 mb-4 flex items-center justify-between" style={{ borderColor: 'var(--border)' }}>
        <div className="flex items-center gap-4">
          <h3 className="text-sm font-bold" style={{ color: 'var(--text)' }}>Continuous Journey Timeline</h3>
          <div
            className="flex p-0.5 rounded-lg"
            style={{ background: 'var(--bg3)', border: '1px solid var(--border)' }}
          >
            {allLocations.map(loc => (
              <button
                key={loc}
                onClick={() => setLocationFilter(loc)}
                className={cn(
                  'px-3 py-1 text-xs font-semibold rounded-md transition-colors',
                  selectedLocation === loc
                    ? 'bg-white shadow-sm'
                    : 'hover:bg-[var(--border)]',
                )}
                style={{
                  color: selectedLocation === loc ? 'var(--text)' : 'var(--text-muted)',
                }}
              >
                {loc}
              </button>
            ))}
          </div>
        </div>
        <button
          onClick={toggleTimeline}
          className="text-xs font-semibold px-3 py-1.5 rounded-md transition-colors hover:bg-gray-100"
          style={{ color: 'var(--color-gold)' }}
        >
          Show Timeline
        </button>
      </div>
    )
  }

  return (
    <div
      className={cn(
        "bg-white rounded-xl border shadow-sm p-5 mb-4 transition-all",
        activeNodeId ? "relative z-50" : ""
      )}
      style={{ borderColor: 'var(--border)' }}
    >
      {/* Header with membership toggle and Hide button */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <svg
              className="w-4 h-4"
              style={{ color: 'var(--color-gold)' }}
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M13 17h8m0 0V9m0 8l-8-8-4 4-6-6"
              />
            </svg>
            <h3 className="text-sm font-bold" style={{ color: 'var(--text)' }}>
              Continuous Journey Timeline
            </h3>
            <span className="text-[10px] ml-1" style={{ color: 'var(--text-muted)' }}>
              {totalDays * 2} days view
            </span>
          </div>

          <div
            className="flex p-0.5 rounded-lg"
            style={{ background: 'var(--bg3)', border: '1px solid var(--border)' }}
          >
            {allLocations.map(loc => (
              <button
                key={loc}
                onClick={() => setLocationFilter(loc)}
                className={cn(
                  'px-3 py-1 text-xs font-semibold rounded-md transition-colors',
                  selectedLocation === loc
                    ? 'bg-white shadow-sm'
                    : 'hover:bg-[var(--border)]',
                )}
                style={{
                  color: selectedLocation === loc ? 'var(--text)' : 'var(--text-muted)',
                }}
              >
                {loc}
              </button>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div
            className="flex p-0.5 rounded-lg"
            style={{ background: 'var(--bg3)', border: '1px solid var(--border)' }}
          >
            {MEMBERSHIP_OPTIONS.map(len => (
              <button
                key={len}
                onClick={() => setMembershipLength(len)}
                className={cn(
                  'px-3 py-1 text-xs font-semibold rounded-md transition-colors',
                  selectedMembershipLength === len
                    ? 'bg-white shadow-sm'
                    : 'hover:bg-[var(--border)]',
                )}
                style={{
                  color: selectedMembershipLength === len ? 'var(--color-gold)' : 'var(--text-muted)',
                }}
              >
                {MEMBERSHIP_LABELS[len]}
              </button>
            ))}
          </div>

          <button
            onClick={toggleTimeline}
            className="text-[11px] font-medium px-2 py-1 rounded transition-colors hover:bg-gray-100"
            style={{ color: 'var(--text-muted)' }}
          >
            Hide
          </button>
        </div>
      </div>

      {/* Unified Timeline rows per location */}
      <div className="relative">
        {/* Global backdrop when a node is active */}
        {activeNodeId && (
          <div 
            className="fixed inset-0 z-40 transition-all duration-200"
            style={{ background: 'rgba(15, 23, 42, 0.5)', backdropFilter: 'blur(3px)' }}
            onClick={() => setActiveNodeId(null)}
          />
        )}
        
        {locations.length === 0 ? (
          <div className="text-sm text-center py-6" style={{ color: 'var(--text-muted)' }}>
            No locations match the current filters.
          </div>
        ) : (
          locations.map(loc => {
            const locTemplates = templates.filter(t => t.location === loc)
          const newMemberTemplate = locTemplates.find(t => t.journey_type === 'new_member')
          const renewalTemplate = locTemplates.find(t => t.journey_type === 'renewal')

          const newMemberSteps = newMemberTemplate ? steps.filter(s => s.journey_id === newMemberTemplate.id) : []
          const renewalSteps = renewalTemplate ? steps.filter(s => s.journey_id === renewalTemplate.id) : []

          if (newMemberSteps.length === 0 && renewalSteps.length === 0) return null

          return (
            <LocationTimelineRow
              key={loc}
              location={loc}
              newMemberSteps={newMemberSteps}
              renewalSteps={renewalSteps}
              totalDays={totalDays}
              membershipLength={selectedMembershipLength}
              activeNodeId={activeNodeId}
              setActiveNodeId={handleNodeClick}
            />
          )
        })
      )}
      </div>
    </div>
  )
}
