import { watch, onBeforeUnmount, isRef, type Ref } from 'vue'

let activeLockCount = 0

/**
 * Increment lock count and lock document.body scroll if this is the first active lock.
 */
export const lockBodyScroll = () => {
  if (typeof document === 'undefined') return
  activeLockCount++
  if (activeLockCount === 1) {
    document.body.style.overflow = 'hidden'
  }
}

/**
 * Decrement lock count and restore document.body scroll when all locks are released.
 */
export const unlockBodyScroll = () => {
  if (typeof document === 'undefined') return
  activeLockCount = Math.max(0, activeLockCount - 1)
  if (activeLockCount === 0) {
    document.body.style.overflow = ''
  }
}

/**
 * Composable that manages background scroll lock for modals.
 * Safely handles nested/stacked modals and cleans up on component unmount.
 *
 * @param isOpen - Ref<boolean> or getter function returning boolean
 */
export const useModalScrollLock = (isOpen: Ref<boolean> | (() => boolean)) => {
  let hasLocked = false

  const update = (open: boolean) => {
    if (typeof document === 'undefined') return
    if (open && !hasLocked) {
      lockBodyScroll()
      hasLocked = true
    } else if (!open && hasLocked) {
      unlockBodyScroll()
      hasLocked = false
    }
  }

  watch(
    typeof isOpen === 'function' ? isOpen : () => (isRef(isOpen) ? isOpen.value : false),
    (open) => {
      update(Boolean(open))
    },
    { immediate: true }
  )

  onBeforeUnmount(() => {
    if (hasLocked) {
      unlockBodyScroll()
      hasLocked = false
    }
  })
}
