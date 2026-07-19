import type { RefObject } from 'react'
import { CheckIcon, XIcon } from '@phosphor-icons/react'
import { getMahjongTileName, MAHJONG_HONOR_LABELS } from '../config/mahjong'
import type { MahjongAttachment, Tower } from '../types/game'
import {
  ATTACHMENT_FAILURE_MESSAGES,
  getMahjongHonorAttachmentPreview
} from './mahjongUiModel'
import { MahjongTile } from './MahjongTile'
import { useDialogFocus } from './useDialogFocus'

interface MahjongHonorAttachmentConfirmProps {
  tower: Tower
  attachment: MahjongAttachment
  onConfirm: () => void
  onClose: () => void
}

interface MahjongHonorAttachmentConfirmViewProps
  extends MahjongHonorAttachmentConfirmProps {
  dialogRef?: RefObject<HTMLElement | null>
  closeButtonRef?: RefObject<HTMLButtonElement | null>
}

/**
 * Hook-free presentation so the confirm/cancel wiring stays unit-testable through
 * findElement + props.onClick in the default Node test environment. The effect copy
 * is resolved against the concrete target tower's suit/formation.
 */
export function MahjongHonorAttachmentConfirmView({
  tower,
  attachment,
  onConfirm,
  onClose,
  dialogRef,
  closeButtonRef
}: MahjongHonorAttachmentConfirmViewProps) {
  const honorLabel = MAHJONG_HONOR_LABELS[attachment]
  const towerName = tower.mahjongTile ? getMahjongTileName(tower.mahjongTile) : '棋子'
  const preview = tower.mahjongState
    ? getMahjongHonorAttachmentPreview(attachment, tower.mahjongState)
    : null
  const canAttach = preview?.canAttach ?? false
  const blockMessage = preview
    ? (preview.blockReason ? ATTACHMENT_FAILURE_MESSAGES[preview.blockReason] : null)
    : ATTACHMENT_FAILURE_MESSAGES.tower_not_found

  const confirm = () => {
    if (canAttach) onConfirm()
  }

  return (
    <div className="synthesis-dialog-backdrop" role="presentation">
      <section
        ref={dialogRef}
        className="synthesis-dialog mahjong-honor-detail"
        role="dialog"
        aria-modal="true"
        aria-labelledby="mahjong-attachment-title"
      >
        <header className="synthesis-dialog__header">
          <h2 id="mahjong-attachment-title">将{honorLabel}附着到{towerName}</h2>
          <button
            ref={closeButtonRef}
            type="button"
            className="icon-button"
            aria-label={`关闭${honorLabel}附着确认`}
            onClick={onClose}
          >
            <XIcon weight="bold" />
          </button>
        </header>

        <div className="mahjong-honor-detail__body">
          {tower.mahjongTile
            ? <MahjongTile tile={tower.mahjongTile} />
            : <MahjongTile honor={attachment} />}
          <div>
            <strong>
              {towerName}
              {preview && ` · ${preview.suitLabel}${preview.formationLabel}`}
            </strong>
            <ul className="mahjong-honor-detail__effects">
              {(preview?.effects ?? []).map(effect => <li key={effect}>{effect}</li>)}
            </ul>
          </div>
        </div>

        {preview && (
          <p className="mahjong-honor-detail__usage">
            {honorLabel}附着位 {preview.attachedCount}/{preview.capacity}
            {preview.attachedHonors.length
              ? `，已附着${preview.attachedHonors.map(honor => MAHJONG_HONOR_LABELS[honor]).join('、')}`
              : '，暂未附着功能牌'}
          </p>
        )}

        {blockMessage && (
          <p className="mahjong-action-message" aria-live="polite">{blockMessage}</p>
        )}

        <div className="mahjong-dialog__actions">
          <button type="button" onClick={onClose}>取消</button>
          <button
            type="button"
            className="synthesis-dialog__confirm"
            disabled={!canAttach}
            onClick={confirm}
          >
            <CheckIcon weight="bold" />确认附着
          </button>
        </div>
      </section>
    </div>
  )
}

export function MahjongHonorAttachmentConfirm(props: MahjongHonorAttachmentConfirmProps) {
  const { dialogRef, closeButtonRef } = useDialogFocus(props.onClose)
  return (
    <MahjongHonorAttachmentConfirmView
      {...props}
      dialogRef={dialogRef}
      closeButtonRef={closeButtonRef}
    />
  )
}
