export default function OrdersLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      {children}
      <style>{`
        /* Responsive Order Details dialog: adapts to viewport size and stays centered. */
        .order-details-backdrop {
          position: fixed !important;
          inset: 0 !important;
          width: 100vw !important;
          width: 100dvw !important;
          height: 100vh !important;
          height: 100dvh !important;
          margin: 0 !important;
          padding: clamp(12px, 3vw, 40px) !important;
          box-sizing: border-box !important;
          display: grid !important;
          place-items: center !important;
          background: rgba(15, 23, 42, .58) !important;
          z-index: 999999 !important;
          overflow: hidden !important;
        }

        .order-details-modal {
          position: relative !important;
          inset: auto !important;
          transform: none !important;
          margin: 0 !important;
          width: min(1180px, 100%) !important;
          max-width: 100% !important;
          max-height: 100% !important;
          box-sizing: border-box !important;
          overflow: auto !important;
          overscroll-behavior: contain !important;
          -webkit-overflow-scrolling: touch !important;
        }

        body:has(.order-details-backdrop) {
          overflow: hidden !important;
        }

        /* Tablet: use more of the screen while keeping comfortable margins. */
        @media (max-width: 900px) {
          .order-details-backdrop {
            padding: 18px !important;
          }

          .order-details-modal {
            width: 100% !important;
            max-width: 100% !important;
          }
        }

        /* Mobile: nearly full-screen, with safe spacing and internal scrolling. */
        @media (max-width: 640px) {
          .order-details-backdrop {
            padding: 8px !important;
            place-items: center !important;
          }

          .order-details-modal {
            width: 100% !important;
            max-width: 100% !important;
            max-height: 100% !important;
            border-radius: 18px !important;
          }
        }

        /* Short screens: preserve the center and let only the modal content scroll. */
        @media (max-height: 700px) {
          .order-details-backdrop {
            padding-top: 10px !important;
            padding-bottom: 10px !important;
          }
        }
      `}</style>
    </>
  );
}
