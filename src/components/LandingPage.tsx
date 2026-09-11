import React from "react";
import {
  FileText,
  Image as ImageIcon,
  Headphones,
  ArrowRight,
  ShieldCheck,
  Play,
  Share2,
  Bookmark
} from "lucide-react";

interface LandingPageProps {
  onStartWriting: () => void;
}

export function LandingPage({ onStartWriting }: LandingPageProps): React.JSX.Element {
  return (
    <div className="page-container">
      {/* Hero Section */}
      <section className="hero-section">
        <div
          className="badge-blue"
          style={{ marginBottom: "20px", display: "inline-flex", padding: "6px 14px", fontSize: "13px" }}
        >
          <span>One-Prompt Publication Agent</span>
        </div>

        <h1 className="hero-heading">
          From Idea to Published Medium Story in One Click
        </h1>

        <p className="hero-text">
          Connect your AI wallet and provide your topic. The agent drafts your long-form article,
          paints a custom cover, and synthesizes a full audio narration transcript.
        </p>

        <div style={{ display: "flex", justifyContent: "center", gap: "14px", flexWrap: "wrap" }}>
          <button
            type="button"
            onClick={onStartWriting}
            className="shadcn-btn-primary hero-btn-primary"
          >
            <span>Start Creating</span>
            <ArrowRight size={18} />
          </button>
        </div>
      </section>

      {/* The 3-Step Agent Workflow Cards */}
      <section style={{ marginBottom: "64px" }}>
        <div className="workflow-grid">
          {/* Step 1 */}
          <div className="shadcn-card shadcn-card-interactive workflow-card">
            <div
              style={{
                width: "44px",
                height: "44px",
                borderRadius: "10px",
                backgroundColor: "var(--primary-light)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "var(--primary)",
                marginBottom: "20px"
              }}
            >
              <FileText size={22} />
            </div>
            <div style={{ fontSize: "13px", fontWeight: 700, color: "var(--primary)", marginBottom: "6px" }}>
              STEP 01
            </div>
            <h3 style={{ fontSize: "18px", fontWeight: 700, color: "#09090B", marginBottom: "8px" }}>
              Long-Form Essay Drafting
            </h3>
            <p style={{ fontSize: "14px", color: "#71717A", lineHeight: 1.6 }}>
              The agent writes a structured, engaging Medium article complete with narrative hooks,
              sub-sections, blockquotes, and practical takeaways.
            </p>
          </div>

          {/* Step 2 */}
          <div className="shadcn-card shadcn-card-interactive workflow-card">
            <div
              style={{
                width: "44px",
                height: "44px",
                borderRadius: "10px",
                backgroundColor: "#FDF2F8",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "#DB2777",
                marginBottom: "20px"
              }}
            >
              <ImageIcon size={22} />
            </div>
            <div style={{ fontSize: "13px", fontWeight: 700, color: "#DB2777", marginBottom: "6px" }}>
              STEP 02
            </div>
            <h3 style={{ fontSize: "18px", fontWeight: 700, color: "#09090B", marginBottom: "8px" }}>
              Custom Cover Art Generation
            </h3>
            <p style={{ fontSize: "14px", color: "#71717A", lineHeight: 1.6 }}>
              Generates high-resolution hero artwork tailored to your title and chosen aesthetic, ready
              to catch reader attention across feeds.
            </p>
          </div>

          {/* Step 3 */}
          <div className="shadcn-card shadcn-card-interactive" style={{ padding: "32px 28px" }}>
            <div
              style={{
                width: "44px",
                height: "44px",
                borderRadius: "10px",
                backgroundColor: "#ECFDF5",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "#059669",
                marginBottom: "20px"
              }}
            >
              <Headphones size={22} />
            </div>
            <div style={{ fontSize: "13px", fontWeight: 700, color: "#059669", marginBottom: "6px" }}>
              STEP 03
            </div>
            <h3 style={{ fontSize: "18px", fontWeight: 700, color: "#09090B", marginBottom: "8px" }}>
              Audio Narration Transcript
            </h3>
            <p style={{ fontSize: "14px", color: "#71717A", lineHeight: 1.6 }}>
              Produces a lifelike voice reading of the article with an interactive Medium-style player
              supporting scrubber controls and speed toggles.
            </p>
          </div>
        </div>
      </section>

      {/* Medium Interface Preview Mockup */}
      <section style={{ marginBottom: "80px" }}>
        <div style={{ textAlign: "center", marginBottom: "28px" }}>
          <h2 style={{ fontSize: "28px", fontWeight: 800, color: "#09090B", letterSpacing: "-0.02em" }}>
            The Reader Experience You Love
          </h2>
          <p style={{ fontSize: "15px", color: "#71717A", marginTop: "6px" }}>
            No noisy dashboards. Just clean editorial typography, immersive audio, and distraction-free prose.
          </p>
        </div>

        <div className="shadcn-card responsive-preview-card">
          {/* Mockup Audio Bar */}
          <div
            style={{
              backgroundColor: "#F8FAFC",
              border: "1px solid #E2E8F0",
              borderRadius: "12px",
              padding: "12px 16px",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              flexWrap: "wrap",
              gap: "10px",
              marginBottom: "24px"
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
              <div
                style={{
                  width: "36px",
                  height: "36px",
                  borderRadius: "50%",
                  backgroundColor: "var(--primary)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "#FFFFFF",
                  flexShrink: 0
                }}
              >
                <Play size={16} style={{ marginLeft: "2px" }} />
              </div>
              <div>
                <div style={{ fontSize: "13px", fontWeight: 700, color: "#0F172A" }}>
                  Listen to this article
                </div>
                <div style={{ fontSize: "11px", color: "#64748B" }}>
                  4 min 12 sec · Narrated by AI
                </div>
              </div>
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <span style={{ fontSize: "12px", fontWeight: 600, color: "#64748B", padding: "4px 8px", backgroundColor: "#FFFFFF", borderRadius: "6px", border: "1px solid #E2E8F0" }}>
                1x
              </span>
              <Bookmark size={16} color="#64748B" />
              <Share2 size={16} color="#64748B" />
            </div>
          </div>

          {/* Mockup Title & Meta */}
          <h3 className="preview-mockup-title">
            The Shift Toward Autonomous Engineering
          </h3>

          <p style={{ fontSize: "16px", color: "#6B6B6B", marginBottom: "20px" }}>
            Why tomorrow’s software products will be composed rather than coded.
          </p>

          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "10px",
              flexWrap: "wrap",
              fontSize: "13px",
              color: "#71717A",
              borderTop: "1px solid #F4F4F5",
              paddingTop: "14px"
            }}
          >
            <span style={{ fontWeight: 600, color: "#09090B" }}>PulseWrite AI</span>
            <span>·</span>
            <span>5 min read</span>
            <span>·</span>
            <span className="badge-mint" style={{ padding: "2px 8px", fontSize: "11px" }}>
              Verified Zorveus Inference
            </span>
          </div>
        </div>
      </section>

      {/* Why Zorveus Banner */}
      <section className="shadcn-card responsive-banner-card">
        <div style={{ maxWidth: "600px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "8px" }}>
            <ShieldCheck size={20} color="var(--primary)" />
            <h3 style={{ fontSize: "18px", fontWeight: 700, color: "#09090B" }}>
              Budget-Protected by Zorveus
            </h3>
          </div>
          <p style={{ fontSize: "14px", color: "#71717A", lineHeight: 1.6 }}>
            Set your monthly spending cap and create with confidence. You only pay for what you generate,
            with no surprise bills.
          </p>
        </div>

        <button
          type="button"
          onClick={onStartWriting}
          className="shadcn-btn-primary"
          style={{ padding: "12px 24px" }}
        >
          <span>Open Studio</span>
          <ArrowRight size={16} />
        </button>
      </section>
    </div>
  );
}
