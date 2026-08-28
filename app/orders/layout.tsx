export default function OrdersLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      {children}
      <style>{`
        /* Keep the Order Details dialog locked to the viewport center. */
        .order-details-backdrop {
          position: fixed !important;
          top: 0 !important;
          right: 0 !important;
          bottom: 0 !important;
          left: 0 !important;
          width: 100vw !important;
          height: 100dvh !important;
          min-height: 100dvh !important;
          margin: 0 !important;
          padding: 22px !important;
          box-sizing: border-box !important;
          display: flex !important;
          align-items: center !important;
          justify-content: center !important;
          overflow: hidden !important;
        }

        .order-details-modal {
          position: relative !important;
          margin: 0 !important;
          transform: none !important;
          width: min(1120px, 100%) !important;
          max-height: calc(100dvh - 44px) !important;
          box-sizing: border-box !important;
          flex: 0 1 auto !important;
          overflow-y: auto !important;
        }

        body:has(.order-details-backdrop) {
          overflow: hidden !important;
        }

        @media (max-width: 640px) {
          .order-details-backdrop {
            padding: 10px !important;
          }

          .order-details-modal {
            max-height: calc(100dvh - 20px) !important;
          }
        }
      `}</style>
    </>
  );
}
