import type { RefObject } from 'react'
import { XIcon } from '@phosphor-icons/react'
import { getMahjongWhiteCatalystDescription } from './mahjongUiModel'
import { MahjongTile } from './MahjongTile'
import { useDialogFocus } from './useDialogFocus'

interface MahjongHonorDetailProps {
  onClose: () => void
}

interface MahjongHonorDetailViewProps extends MahjongHonorDetailProps {
  dialogRef?: RefObject<HTMLElement | null>
  closeButtonRef?: RefObject<HTMLButtonElement | null>
}

/**
 * White is the only honor without an attachment flow, so selecting it opens this
 * read-only catalyst detail. Kept as a hook-free View wrapped by a focus-managing
 * component so it stays unit-testable in the default Node test environment.
 */
export function MahjongHonorDetailView({
  onClose,
  dialogRef,
  closeButtonRef
}: MahjongHonorDetailViewProps) {
  const description = getMahjongWhiteCatalystDescription()

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
          <MahjongTile honor="white" />
          <div>
            <strong>{description.title}</strong>
            <ul className="mahjong-honor-detail__effects">
              {description.effects.map(effect => <li key={effect}>{effect}</li>)}
            </ul>
          </div>
        </div>

        <p className="mahjong-honor-detail__usage">{description.usageNote}</p>

        <div className="mahjong-dialog__actions">
          <button type="button" onClick={onClose}>关闭</button>
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
