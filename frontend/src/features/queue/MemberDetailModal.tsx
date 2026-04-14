import { useEffect, useRef } from 'react'
import { useIntakeData } from '../../hooks/useIntakeData'
import { ClientProfileCards } from '../intake/ClientProfileCards'
import { MovementBenchmarksSection } from '../intake/MovementBenchmarksSection'

export interface MemberDetailModalProps {
  memberId: string
  memberName: string
  gymLabel?: string | null
  onClose: () => void
  onOpenEditor: () => void
}

export function MemberDetailModal({
  memberId,
  memberName,
  gymLabel,
  onClose,
  onOpenEditor,
}: MemberDetailModalProps) {
  const overlayRef = useRef<HTMLDivElement>(null)
  const {
    physicals,
    physicalsFormDate,
    profile,
    health,
    loading,
  } = useIntakeData(memberId, { includeHistory: false })

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  const displayGym = gymLabel ?? profile?.gym_string ?? null

  return (
    <div
      ref={overlayRef}
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto py-8 px-4"
      style={{ background: 'rgba(0,0,0,0.4)' }}
      onClick={(e) => {
        if (e.target === overlayRef.current) onClose()
      }}
    >
      <div
        className="relative w-full max-w-4xl rounded-2xl border shadow-xl"
        style={{
          borderColor: 'var(--border)',
          background: 'var(--bg2)',
          maxHeight: 'calc(100vh - 4rem)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          className="sticky top-0 z-10 flex items-start justify-between gap-3 border-b px-6 py-4 rounded-t-2xl"
          style={{ borderColor: 'var(--border)', background: 'var(--bg2)' }}
        >
          <div className="min-w-0">
            <h2 className="text-lg font-bold truncate" style={{ color: 'var(--text)' }}>
              {memberName}
            </h2>
            <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
              Intake snapshot ·{' '}
              {displayGym ? (
                <span className="font-medium" style={{ color: 'var(--text)' }}>
                  {displayGym}
                </span>
              ) : (
                '—'
              )}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex-shrink-0 rounded-lg p-2 transition-colors hover:bg-[var(--bg3)]"
            style={{ color: 'var(--text-muted)' }}
            aria-label="Close"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="overflow-y-auto px-6 py-5 space-y-8" style={{ maxHeight: 'calc(100vh - 12rem)' }}>
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <div
                className="w-6 h-6 rounded-full border-2 border-t-transparent animate-spin"
                style={{
                  borderColor: 'var(--border)',
                  borderTopColor: 'var(--color-gold)',
                }}
              />
            </div>
          ) : (
            <>
              <section>
                <p
                  className="text-xs font-bold uppercase tracking-wide mb-4"
                  style={{ color: 'var(--text-muted)' }}
                >
                  Client Profile
                </p>
                <ClientProfileCards
                  profile={profile}
                  physicals={physicals}
                  health={health}
                  physicalsFormDate={physicalsFormDate}
                />
              </section>
              <section>
                <p
                  className="text-xs font-bold uppercase tracking-wide mb-4"
                  style={{ color: 'var(--text-muted)' }}
                >
                  Movement & Benchmarks
                </p>
                <MovementBenchmarksSection physicals={physicals} />
              </section>
            </>
          )}
        </div>

        <div
          className="sticky bottom-0 border-t px-6 py-4 rounded-b-2xl"
          style={{ borderColor: 'var(--border)', background: 'var(--bg2)' }}
        >
          <button
            type="button"
            onClick={() => {
              onOpenEditor()
              onClose()
            }}
            className="w-full flex items-center justify-center gap-2 px-5 py-3 rounded-lg text-sm font-bold text-white transition-colors"
            style={{ background: 'var(--color-gold)' }}
            onMouseOver={(e) =>
              (e.currentTarget.style.background = 'var(--color-gold-light)')
            }
            onMouseOut={(e) =>
              (e.currentTarget.style.background = 'var(--color-gold)')
            }
          >
            Open Program Editor
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  )
}
