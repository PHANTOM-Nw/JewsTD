import type { RefObject } from 'react'
import { CheckIcon, XIcon } from '@phosphor-icons/react'
import type { MahjongAttachment, MahjongHonor } from '../types/game'
import { getMahjongHonorDescription } from './mahjongUiModel'
import { MahjongTile } from './MahjongTile'
import { useDialogFocus } from './useDialogFocus'

interface MahjongHonorDetailProps {
  honor: MahjongHonor
  canAttach: boolean
  onConfirm: (attachment: MahjongAttachment) => void
  onClose: () => void
}

interface MahjongHonorDetailViewProps extends MahjongHonorDetailProps {
  dialogRef?: RefObject<HTMLElement | null>
  closeButtonRef?: RefObject<HTMLButtonElement | null>
}

/**
 * Hook-free presentation so the confirm/cancel wiring stays unit-testable through
 * findElement + props.onClick in the default Node test environment.
 */
export function MahjongHonorDetailView({
  honor,
  canAttach,
  onConfirm,
  onClose,
  dialogRef,
  closeButtonRef
}: MahjongHonorDetailViewProps) {
  const description = getMahjongHonorDescription(honor)

  const confirm = () => {
    if (honor === 'white') return
    onConfirm(honor)
  }

  return (
    <div className="synthesis-dialog-backdrop" role="presentation">
      <section
        ref={dialogRef}
        className="synthesis-dialog mahjong-honor-detail"
        role="dialog"
        aria-modal="true"
        aria-labelledby="mahjong-honor-title"
      >
        <header className="synthesis-dialog__header">
          <h2 id="mahjong-honor-title">{description.title}</h2>
          <button
            ref={closeButtonRef}
            type="button"
            className="icon-button"
            aria-label={`关闭${description.title}说明`}
            onClick={onClose}
          >
            <XIcon weight="bold" />
          </button>
        </header>

        <div className="mahjong-honor-detail__body">
          <MahjongTile honor={honor} />
          <div>
            <strong>{description.title}</strong>
            <ul className="mahjong-honor-detail__effects">
              {description.effects.map(effect => <li key={effect}>{effect}</li>)}
            </ul>
          </div>
        </div>

        <p className="mahjong-honor-detail__usage">{description.usageNote}</p>

        <div className="mahjong-dialog__actions">
          {description.kind === 'attachment' ? (
            <>
              <button type="button" onClick={onClose}>取消</button>
              <button
                type="button"
                className="synthesis-dialog__confirm"
                disabled={!canAttach}
                onClick={confirm}
              >
                <CheckIcon weight="bold" />确认选择
              </button>
            </>
          ) : (
            <button type="button" onClick={onClose}>关闭</button>
          )}
        </div>
      </section>
    </div>
  )
}

export function MahjongHonorDetail(props: MahjongHonorDetailProps) {
  const { dialogRef, closeButtonRef } = useDialogFocus(props.onClose)
  return (
    <MahjongHonorDetailView
      {...props}
      dialogRef={dialogRef}
      closeButtonRef={closeButtonRef}
    />
  )
}
