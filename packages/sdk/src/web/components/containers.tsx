import { ReactNode, useLayoutEffect, useRef } from "react";

const MODAL_LOADING_MIN_HEIGHT = "min(360px, 90dvh)";
const HEIGHT_MORPH_MS = 180;
const HEIGHT_MORPH_EASING = "cubic-bezier(0.23, 1, 0.32, 1)";
export const MODAL_CONTENT_CLASS =
  "daimo-modal-content daimo-relative daimo-w-full daimo-max-w-[420px] daimo-max-h-[90vh] daimo-overflow-hidden daimo-bg-[var(--daimo-surface)] daimo-rounded-t-[var(--daimo-radius-xl)] sm:daimo-rounded-[var(--daimo-radius-xl)] daimo-shadow-lg daimo-flex daimo-flex-col";

type ContainerProps = {
  children: ReactNode;
  showFooterSpacer?: boolean;
};

type ModalContainerProps = ContainerProps & {
  /** Handler for closing the modal (backdrop click + close button) */
  onClose?: () => void;
  /** Key identifying current page — height morphs on change */
  pageKey?: string;
  /** Reserve the modal's expected picker height before async content loads. */
  reserveLoadingHeight?: boolean;
};

/**
 * Quick height morph on discrete page changes.
 * Snapshots current height, measures new, tweens between.
 * Does NOT run on continuous resizes (QR spacer handles its own).
 */
function usePageHeightMorph(
  ref: React.RefObject<HTMLDivElement | null>,
  pageKey: string | undefined,
) {
  const prevKey = useRef(pageKey);
  const measuredHeight = useRef<number | null>(null);
  const stopAnimation = useRef<(() => void) | null>(null);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;

    const previousHeight = measuredHeight.current;
    const changed = prevKey.current !== pageKey;
    prevKey.current = pageKey;
    if (!changed) return;

    stopAnimation.current?.();
    stopAnimation.current = null;

    if (previousHeight == null || prefersReducedMotion()) return;

    el.style.transition = "none";
    el.style.height = "auto";
    const nextHeight = el.offsetHeight;
    if (Math.abs(previousHeight - nextHeight) < 1) {
      measuredHeight.current = nextHeight;
      return;
    }

    el.style.height = `${previousHeight}px`;
    void el.offsetHeight;

    let done = false;
    let frame = 0;
    let timeout = 0;

    const finish = (event?: TransitionEvent) => {
      if (event && (event.target !== el || event.propertyName !== "height")) {
        return;
      }
      if (done) return;
      done = true;
      window.cancelAnimationFrame(frame);
      window.clearTimeout(timeout);
      el.removeEventListener("transitionend", finish);
      el.style.transition = "";
      el.style.height = "";
      measuredHeight.current = el.offsetHeight;
      stopAnimation.current = null;
    };

    stopAnimation.current = () => {
      if (done) return;
      done = true;
      window.cancelAnimationFrame(frame);
      window.clearTimeout(timeout);
      el.removeEventListener("transitionend", finish);
      const currentHeight = el.offsetHeight;
      el.style.transition = "none";
      el.style.height = `${currentHeight}px`;
      measuredHeight.current = currentHeight;
    };

    frame = window.requestAnimationFrame(() => {
      el.style.transition = `height ${HEIGHT_MORPH_MS}ms ${HEIGHT_MORPH_EASING}`;
      el.style.height = `${nextHeight}px`;
    });
    timeout = window.setTimeout(finish, HEIGHT_MORPH_MS + 50);
    el.addEventListener("transitionend", finish);

    return () => {
      stopAnimation.current?.();
      stopAnimation.current = null;
    };
  }, [ref, pageKey]);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el || stopAnimation.current) return;
    measuredHeight.current = el.offsetHeight;
  });
}

function prefersReducedMotion(): boolean {
  return (
    typeof window !== "undefined" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

export function ModalContainer({
  children,
  showFooterSpacer = true,
  onClose,
  pageKey,
  reserveLoadingHeight = false,
}: ModalContainerProps) {
  const backdropClass =
    "daimo-modal-backdrop daimo-fixed daimo-inset-0 daimo-z-50 daimo-bg-black/50";

  const contentRef = useRef<HTMLDivElement>(null);
  usePageHeightMorph(contentRef, pageKey);

  return (
    <>
      {/* Backdrop with fade-in - click to close */}
      <div className={backdropClass} onClick={onClose} />
      {/* Modal container - bottom on mobile, centered on desktop */}
      <div className="daimo-fixed daimo-inset-0 daimo-z-50 daimo-flex daimo-justify-center daimo-items-end sm:daimo-items-center daimo-pointer-events-none daimo-px-0 sm:daimo-px-4">
        <div
          ref={contentRef}
          className={`daimo-pointer-events-auto ${MODAL_CONTENT_CLASS}`}
          style={
            reserveLoadingHeight
              ? { minHeight: MODAL_LOADING_MIN_HEIGHT }
              : undefined
          }
          onClick={(e) => e.stopPropagation()}
        >
          <div className="daimo-flex-1 daimo-min-h-0 daimo-flex daimo-flex-col">
            {children}
          </div>
          {showFooterSpacer && <div className="daimo-h-8 daimo-shrink-0" />}
        </div>
      </div>
    </>
  );
}

export function EmbeddedContainer({
  children,
  showFooterSpacer = true,
}: ContainerProps & { onClose?: () => void }) {
  return (
    <div className="daimo-bg-transparent daimo-flex daimo-flex-col daimo-items-center">
      <div className="daimo-relative daimo-w-full daimo-max-w-[512px] daimo-bg-[var(--daimo-surface)] daimo-flex daimo-flex-col">
        {children}
        {showFooterSpacer && <div className="daimo-h-8" />}
      </div>
    </div>
  );
}
