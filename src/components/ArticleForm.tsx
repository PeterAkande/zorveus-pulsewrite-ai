import React, { useState, useEffect } from "react";
import { useZorveusAuth, useZorveusModels, SpendCapIndicator, ConnectWalletButton } from "@zorveus/react";
import type { ArticleFormData, ArticleTone, ImageStyle } from "../types";
import { DEFAULT_CHAT_MODEL, DEFAULT_IMAGE_MODEL, DEFAULT_TTS_VOICE } from "../services/agent";
import {
  Loader2,
  AlertCircle,
  RefreshCw
} from "lucide-react";

interface ArticleFormProps {
  onSubmit: (data: ArticleFormData) => void;
  isGenerating: boolean;
}

const TONE_OPTIONS: { id: ArticleTone; label: string; desc: string }[] = [
  { id: "thought-leadership", label: "Thought Leadership", desc: "Provocative, forward-looking insights" },
  { id: "technical-deep-dive", label: "Technical Deep Dive", desc: "Code, systems, and engineering specifics" },
  { id: "founder-story", label: "Founder Story", desc: "First-person narrative, struggles, and lessons" },
  { id: "industry-analysis", label: "Industry Analysis", desc: "Data trends, market shifts, and economics" },
  { id: "how-to-guide", label: "Practical Guide", desc: "Step-by-step actionable implementation" }
];

const IMAGE_STYLES: { id: ImageStyle; label: string }[] = [
  { id: "editorial-minimal", label: "Editorial Minimal" },
  { id: "abstract-geometric", label: "Abstract Geometric" },
  { id: "cyberpunk-future", label: "Future Neo" },
  { id: "architectural", label: "Architectural" }
];

const VOICE_OPTIONS = [
  { id: "achird", label: "Achird (Gemini Default)" },
  { id: "algenib", label: "Algenib (Gemini Warm)" },
  { id: "despina", label: "Despina (Gemini Clear)" },
  { id: "puck", label: "Puck (Gemini Dynamic)" },
  { id: "kore", label: "Kore (Gemini Calm)" },
  { id: "alloy", label: "Alloy (Neutral)" },
  { id: "echo", label: "Echo (Narrative)" },
  { id: "nova", label: "Nova (Crisp)" }
];

export function ArticleForm({ onSubmit, isGenerating }: ArticleFormProps): React.JSX.Element {
  const { isConnected } = useZorveusAuth();
  const {
    models,
    isLoading: isLoadingModels,
    refreshModels
  } = useZorveusModels({ routeStatus: undefined });

  // Filter models fetched strictly from Zorveus Gateway
  const zorveusChatModels = models.filter((m) => {
    if (m.mode === "chat" || m.mode === "responses") return true;
    if (
      m.id.includes("embed") ||
      m.id.includes("whisper") ||
      m.id.includes("image") ||
      m.id.includes("moderation")
    ) {
      return false;
    }
    return true;
  });

  const zorveusImageModels = models.filter((m) => {
    return m.mode === "image_generation" || m.id.includes("image");
  });

  const [topic, setTopic] = useState("");
  const [targetAudience, setTargetAudience] = useState("Software Engineers & Technical Leaders");
  const [tone, setTone] = useState<ArticleTone>("thought-leadership");
  const [keyPoints, setKeyPoints] = useState("");
  const [targetWordCount, setTargetWordCount] = useState(1200);
  const [model, setModel] = useState(DEFAULT_CHAT_MODEL);
  const [imageModel, setImageModel] = useState(DEFAULT_IMAGE_MODEL);
  const [voice, setVoice] = useState(DEFAULT_TTS_VOICE);
  const [imageStyle, setImageStyle] = useState<ImageStyle>("editorial-minimal");

  // Keep selected model strictly synchronized with live Zorveus models
  useEffect(() => {
    if (zorveusChatModels.length > 0) {
      const exists = zorveusChatModels.some((m) => m.id === model) || model === DEFAULT_CHAT_MODEL;
      if (!exists) {
        setModel(zorveusChatModels[0].id);
      }
    }
  }, [zorveusChatModels, model]);

  useEffect(() => {
    if (zorveusImageModels.length > 0) {
      const exists = zorveusImageModels.some((m) => m.id === imageModel) || imageModel === DEFAULT_IMAGE_MODEL;
      if (!exists) {
        setImageModel(zorveusImageModels[0].id);
      }
    }
  }, [zorveusImageModels, imageModel]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!topic.trim() || isGenerating) return;

    onSubmit({
      topic: topic.trim(),
      targetAudience: targetAudience.trim(),
      tone,
      keyPoints: keyPoints.trim(),
      targetWordCount,
      model,
      imageModel,
      voice,
      imageStyle
    });
  };

  return (
    <div className="form-page-container">
      {/* Page Header */}
      <div style={{ marginBottom: "28px" }}>
        <h1 style={{ fontSize: "28px", fontWeight: 800, color: "#09090B", letterSpacing: "-0.02em" }}>
          Create New Publication
        </h1>
        <p style={{ fontSize: "14px", color: "#71717A", marginTop: "4px" }}>
          Configure your story. The agent will write the full piece, design a cover, and narrate the audio transcript.
        </p>
      </div>

      {/* Wallet Gate Reminder */}
      {!isConnected && (
        <div
          className="shadcn-card"
          style={{
            padding: "18px",
            marginBottom: "28px",
            backgroundColor: "var(--primary-light)",
            borderColor: "var(--primary-border)",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            flexWrap: "wrap",
            gap: "14px"
          }}
        >
          <div style={{ display: "flex", alignItems: "flex-start", gap: "12px", maxWidth: "520px" }}>
            <AlertCircle size={20} color="var(--primary)" style={{ marginTop: "2px", flexShrink: 0 }} />
            <div>
              <div style={{ fontSize: "14px", fontWeight: 700, color: "var(--primary)" }}>
                AI Wallet Disconnected
              </div>
              <div style={{ fontSize: "13px", color: "#3B82F6", lineHeight: 1.5, marginTop: "2px" }}>
                Connect your Zorveus account to generate your article, cover art, and audio narration.
              </div>
            </div>
          </div>
          <ConnectWalletButton variant="default" size="sm" />
        </div>
      )}

      {/* Main Configuration Form */}
      <form onSubmit={handleSubmit} className="shadcn-card responsive-form-card">
        <div style={{ display: "flex", flexDirection: "column", gap: "26px" }}>
          
          {/* Article Topic & Title */}
          <div>
            <label
              htmlFor="topic-input"
              style={{ display: "block", fontSize: "13px", fontWeight: 600, color: "#09090B", marginBottom: "8px" }}
            >
              Article Topic & Working Title <span style={{ color: "var(--primary)" }}>*</span>
            </label>
            <input
              id="topic-input"
              type="text"
              required
              className="shadcn-input"
              placeholder="e.g. Why the Best Software Engineers Think Like Product Designers"
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              style={{ fontSize: "15px", padding: "12px 14px" }}
            />
          </div>

          {/* Target Audience */}
          <div>
            <label
              htmlFor="audience-input"
              style={{ display: "block", fontSize: "13px", fontWeight: 600, color: "#09090B", marginBottom: "8px" }}
            >
              Target Audience
            </label>
            <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
              <input
                id="audience-input"
                type="text"
                className="shadcn-input"
                placeholder="e.g. Tech Founders, Staff Engineers, Product Designers"
                value={targetAudience}
                onChange={(e) => setTargetAudience(e.target.value)}
              />
            </div>
          </div>

          {/* Tone Selector */}
          <div>
            <label style={{ display: "block", fontSize: "13px", fontWeight: 600, color: "#09090B", marginBottom: "10px" }}>
              Publication Tone & Format
            </label>
            <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
              {TONE_OPTIONS.map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => setTone(opt.id)}
                  className={`pill-option ${tone === opt.id ? "selected" : ""}`}
                >
                  <span>{opt.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Key Points & Notes */}
          <div>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "8px" }}>
              <label htmlFor="keypoints-input" style={{ fontSize: "13px", fontWeight: 600, color: "#09090B" }}>
                Outline & Key Points to Cover (Optional)
              </label>
              <span style={{ fontSize: "12px", color: "#A1A1AA" }}>Supports bullet points or rough thoughts</span>
            </div>
            <textarea
              id="keypoints-input"
              className="shadcn-textarea"
              rows={4}
              placeholder="1. The friction between engineering perfectionism and user velocity
2. Case study: How small autonomous pods outperform large waterfall squads
3. The shift from writing boilerplate to curating AI workflows
4. Three actionable principles for engineering leads"
              value={keyPoints}
              onChange={(e) => setKeyPoints(e.target.value)}
            />
          </div>

          {/* Target Word Count */}
          <div>
            <label style={{ display: "block", fontSize: "13px", fontWeight: 600, color: "#09090B", marginBottom: "10px" }}>
              Target Length
            </label>
            <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
              {[
                { count: 800, label: "Short (800 words)" },
                { count: 1200, label: "Standard (1,200 words)" },
                { count: 2000, label: "Deep Dive (2,000 words)" }
              ].map((item) => (
                <button
                  key={item.count}
                  type="button"
                  onClick={() => setTargetWordCount(item.count)}
                  className={`pill-option ${targetWordCount === item.count ? "selected" : ""}`}
                >
                  <span>{item.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* 3-Column Row: Text Model, Image Model & Voice */}
          <div className="form-model-grid">
            {/* AI Text Model */}
            <div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
                <label htmlFor="model-select" style={{ fontSize: "13px", fontWeight: 600, color: "#09090B" }}>
                  Text Engine
                </label>
                {isConnected && (
                  <button
                    type="button"
                    onClick={() => void refreshModels()}
                    disabled={isLoadingModels}
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "4px",
                      fontSize: "11px",
                      color: "var(--primary)",
                      background: "none",
                      border: "none",
                      cursor: "pointer",
                      padding: 0
                    }}
                    title="Refresh Zorveus models"
                  >
                    <RefreshCw size={11} className={isLoadingModels ? "animate-pulse-subtle" : ""} />
                    <span>{isLoadingModels ? "Syncing..." : "Refresh"}</span>
                  </button>
                )}
              </div>

              <select
                id="model-select"
                className="shadcn-select"
                value={model}
                onChange={(e) => setModel(e.target.value)}
              >
                <option value={DEFAULT_CHAT_MODEL}>
                  {DEFAULT_CHAT_MODEL} (Default)
                </option>
                {zorveusChatModels
                  .filter((m) => m.id !== DEFAULT_CHAT_MODEL)
                  .map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.id}
                    </option>
                  ))}
              </select>
            </div>

            {/* AI Image Model */}
            <div>
              <label htmlFor="image-model-select" style={{ display: "block", fontSize: "13px", fontWeight: 600, color: "#09090B", marginBottom: "8px" }}>
                Image Model
              </label>
              <select
                id="image-model-select"
                className="shadcn-select"
                value={imageModel}
                onChange={(e) => setImageModel(e.target.value)}
              >
                <option value={DEFAULT_IMAGE_MODEL}>
                  {DEFAULT_IMAGE_MODEL} (Default)
                </option>
                {zorveusImageModels
                  .filter((m) => m.id !== DEFAULT_IMAGE_MODEL)
                  .map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.id}
                    </option>
                  ))}
              </select>
            </div>

            {/* Audio Voice */}
            <div>
              <label htmlFor="voice-select" style={{ display: "block", fontSize: "13px", fontWeight: 600, color: "#09090B", marginBottom: "8px" }}>
                Narration Voice (Gemini TTS)
              </label>
              <select
                id="voice-select"
                className="shadcn-select"
                value={voice}
                onChange={(e) => setVoice(e.target.value)}
              >
                {VOICE_OPTIONS.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Cover Art Aesthetic */}
          <div>
            <label style={{ display: "block", fontSize: "13px", fontWeight: 600, color: "#09090B", marginBottom: "10px" }}>
              Cover Image Aesthetic
            </label>
            <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
              {IMAGE_STYLES.map((style) => (
                <button
                  key={style.id}
                  type="button"
                  onClick={() => setImageStyle(style.id)}
                  className={`pill-option ${imageStyle === style.id ? "selected" : ""}`}
                >
                  <span>{style.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Submit Action */}
          <div style={{ borderTop: "1px solid var(--border)", paddingTop: "24px", marginTop: "8px" }}>
            <button
              type="submit"
              disabled={!topic.trim() || isGenerating}
              className="shadcn-btn-primary"
              style={{ width: "100%", padding: "14px", fontSize: "15px" }}
            >
              {isGenerating ? (
                <>
                  <Loader2 size={18} className="animate-spin" />
                  <span>Generating Article, Cover & Audio...</span>
                </>
              ) : (
                <span>Generate Article, Cover & Audio</span>
              )}
            </button>
            <p style={{ fontSize: "12px", color: "#71717A", textAlign: "center", marginTop: "10px" }}>
              Upon submission, you will be taken directly to your editorial reader view.
            </p>
          </div>

        </div>
      </form>

      {/* Live Spend Indicator Card */}
      {isConnected && (
        <div className="shadcn-card" style={{ padding: "20px", marginTop: "24px" }}>
          <div style={{ fontSize: "13px", fontWeight: 600, color: "#09090B", marginBottom: "12px" }}>
            Zorveus Account & Budget Cap
          </div>
          <SpendCapIndicator />
        </div>
      )}
    </div>
  );
}
