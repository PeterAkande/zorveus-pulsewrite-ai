import React, { useEffect } from "react";
import { ConnectWalletButton, useZorveusAuth, useZorveusSpend } from "@zorveus/react";
import { PenTool, ArrowUpRight, Wallet, RefreshCw } from "lucide-react";

interface NavbarProps {
  currentPath: string;
  onNavigate: (path: string) => void;
}

export function Navbar({ currentPath, onNavigate }: NavbarProps): React.JSX.Element {
  const { isConnected } = useZorveusAuth();
  const { remainingBalanceFormatted, currency, spentFormatted, spendCapFormatted, isLoading, refresh } = useZorveusSpend();

  // Immediately refresh spend and limit when any Zorveus event completes (zero polling)
  useEffect(() => {
    const handleActivity = () => {
      void refresh();
    };

    window.addEventListener("zorveus:activity", handleActivity);
    return () => {
      window.removeEventListener("zorveus:activity", handleActivity);
    };
  }, [refresh]);

  return (
    <header
      style={{
        position: "sticky",
        top: 0,
        zIndex: 50,
        backgroundColor: "rgba(255, 255, 255, 0.85)",
        backdropFilter: "blur(12px)",
        borderBottom: "1px solid var(--border)",
        transition: "border-color 150ms ease"
      }}
    >
      <div className="navbar-inner">
        {/* Brand Logo */}
        <div
          onClick={() => onNavigate("/")}
          style={{
            display: "flex",
            alignItems: "center",
            gap: "10px",
            cursor: "pointer",
            userSelect: "none"
          }}
        >
          <div
            style={{
              width: "34px",
              height: "34px",
              borderRadius: "8px",
              backgroundColor: "var(--primary)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "#FFFFFF",
              flexShrink: 0
            }}
          >
            <PenTool size={18} strokeWidth={2.4} />
          </div>
          <div>
            <div style={{ fontSize: "16px", fontWeight: 700, letterSpacing: "-0.02em", color: "#09090B" }}>
              PulseWrite
            </div>
            <div className="navbar-brand-sub">
              AI Editorial Studio
            </div>
          </div>
        </div>

        {/* Right Actions: Wallet & Spend Cap */}
        <div className="navbar-actions">
          {isConnected && remainingBalanceFormatted !== null && (
            <div
              className="badge-mint navbar-balance-badge"
              onClick={() => void refresh()}
              title={`Spend: $${spentFormatted} / Cap: $${spendCapFormatted ?? "Unlimited"} · Click to refresh`}
              id="desktop-balance-badge"
            >
              <Wallet size={12} />
              <span>
                ${remainingBalanceFormatted}
                <span className="badge-currency-label"> {currency}</span>
              </span>
              {isLoading && <RefreshCw size={10} className="animate-spin-slow" />}
            </div>
          )}

          <div style={{ display: "flex", alignItems: "center" }}>
            <ConnectWalletButton variant="default" size="sm" />
          </div>

          {currentPath !== "/create" && (
            <button
              type="button"
              onClick={() => onNavigate("/create")}
              className="shadcn-btn-primary navbar-write-btn"
              title="Write New Story"
            >
              <span>Write</span>
              <ArrowUpRight size={14} />
            </button>
          )}
        </div>
      </div>
    </header>
  );
}
