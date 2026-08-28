export default function OrdersLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      {children}
      <style>{`
        /* Force the Order Details dialog to the exact visual center of the viewport. */
        .order-details-backdrop {
          position: fixed !important;
          top: 0 !important;
          right: auto !important;
          bottom: auto !important;
          left: 0 !important;
          width: 100vw !important;
          height: 100dvh !important;
          min-height: 100dvh !important;
          margin: 0 !important;
          padding: 0 !important;
          box-sizing: border-box !important;
          background: rgba(15, 23, 42, .58) !important;
          z-index: 999999 !important;
          overflow: hidden !important;
        }

        .order-details-modal {
          position: fixed !important;
          top: 50dvh !important;
          left: 50vw !important;
          right: auto !important;
          bottom: auto !important;
          transform: translate(-50%, -50%) !important;
          margin: 0 !important;
          width: min(1120px, calc(100vw - 44px)) !important;
          max-width: calc(100vw - 44px) !important;
          max-height: calc(100dvh - 44px) !important;
          box-sizing: border-box !important;
          overflow-y: auto !important;
        }

        body:has(.order-details-backdrop) {
          overflow: hidden !important;
        }

        @media (max-width: 640px) {
          .order-details-modal {
            top: 50dvh !important;
            left: 50vw !important;
            width: calc(100vw - 20px) !important;
            max-width: calc(100vw - 20px) !important;
            max-height: calc(100dvh - 20px) !important;
          }
        }
      `}</style>
    </>
  );
}
