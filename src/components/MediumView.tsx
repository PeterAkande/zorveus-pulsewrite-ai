import React, { useState, useEffect, useRef } from "react";
import JSZip from "jszip";
import type { ArticleResult, AgentProgress } from "../types";
import {
  ArrowLeft,
  Play,
  Pause,
  Copy,
  Check,
  Download,
  ThumbsUp,
  Loader2,
  Headphones,
  AlertTriangle,
  RefreshCw
} from "lucide-react";

interface MediumViewProps {
  article: ArticleResult;
  progress?: AgentProgress;
  onBackToForm: () => void;
  onRetryImage: () => void;
  onRetryAudio: () => void;
}



/**
 * Parses markdown into skimmable, styled React elements.
 */
function RenderMarkdownProse({ content }: { content: string }) {
  if (!content) return null;

  const lines = content.split("\n");
  const elements: React.JSX.Element[] = [];

  let inCodeBlock = false;
  let codeBuffer: string[] = [];

  for (let i = 0; i < lines.length; i++) {
    const rawLine = lines[i];
    const trimmed = rawLine.trim();

    // Toggle code blocks
    if (trimmed.startsWith("```")) {
      if (inCodeBlock) {
        elements.push(
          <pre key={`code-${i}`}>
            <code>{codeBuffer.join("\n")}</code>
          </pre>
        );
        codeBuffer = [];
        inCodeBlock = false;
      } else {
        inCodeBlock = true;
      }
      continue;
    }

    if (inCodeBlock) {
      codeBuffer.push(rawLine);
      continue;
    }

    // Skip empty lines
    if (!trimmed) {
      continue;
    }

    // Skip top level title if it matches H1 since we render that in the hero header
    if (i < 3 && trimmed.startsWith("# ")) {
      continue;
    }

    // H2
    if (trimmed.startsWith("## ")) {
      elements.push(<h2 key={`h2-${i}`}>{trimmed.slice(3)}</h2>);
      continue;
    }

    // H3
    if (trimmed.startsWith("### ")) {
      elements.push(<h3 key={`h3-${i}`}>{trimmed.slice(4)}</h3>);
      continue;
    }

    // Blockquote
    if (trimmed.startsWith("> ")) {
      elements.push(<blockquote key={`quote-${i}`}>{trimmed.slice(2)}</blockquote>);
      continue;
    }

    // List item
    if (trimmed.startsWith("- ") || trimmed.startsWith("* ")) {
      elements.push(<li key={`li-${i}`}>{parseInline(trimmed.slice(2))}</li>);
      continue;
    }

    // Numbered list item
    if (/^\d+\.\s/.test(trimmed)) {
      const match = trimmed.match(/^\d+\.\s(.*)/);
      elements.push(<li key={`num-li-${i}`}>{parseInline(match ? match[1] : trimmed)}</li>);
      continue;
    }

    // Paragraph
    elements.push(<p key={`p-${i}`}>{parseInline(trimmed)}</p>);
  }

  return <div className="medium-prose">{elements}</div>;
}

/**
 * Parses bold, italic, and inline code formatting.
 */
function parseInline(text: string): React.ReactNode {
  const parts = text.split(/(\*\*.*?\*\*|`.*?`)/g);

  return parts.map((part, index) => {
    if (part.startsWith("**") && part.endsWith("**")) {
      return <strong key={index}>{part.slice(2, -2)}</strong>;
    }
    if (part.startsWith("`") && part.endsWith("`")) {
      return <code key={index}>{part.slice(1, -1)}</code>;
    }
    return part;
  });
}

export function MediumView({
  article,
  progress: _progress,
  onBackToForm,
  onRetryImage,
  onRetryAudio
}: MediumViewProps): React.JSX.Element {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [playbackRate, setPlaybackRate] = useState(1);
  const [copied, setCopied] = useState(false);
  const [claps, setClaps] = useState(18);
  const [isZipping, setIsZipping] = useState(false);

  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Audio setup: strictly for live model audio from Zorveus Gateway
  useEffect(() => {
    if (!article.audioUrl) {
      setIsPlaying(false);
      setCurrentTime(0);
      setDuration(0);
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.src = "";
        audioRef.current = null;
      }
      return;
    }

    const audio = new Audio(article.audioUrl);
    audioRef.current = audio;

    audio.onloadedmetadata = () => {
      setDuration(audio.duration || 0);
    };

    audio.ontimeupdate = () => {
      setCurrentTime(audio.currentTime || 0);
    };

    audio.onended = () => {
      setIsPlaying(false);
      setCurrentTime(0);
    };

    return () => {
      audio.pause();
      audio.src = "";
      audioRef.current = null;
    };
  }, [article.audioUrl]);

  // Handle Play/Pause strictly using the model's generated audio
  const togglePlay = () => {
    if (!audioRef.current || !article.audioUrl) return;

    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
      return;
    }

    audioRef.current.playbackRate = playbackRate;
    void audioRef.current.play();
    setIsPlaying(true);
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const time = Number(e.target.value);
    setCurrentTime(time);
    if (audioRef.current) {
      audioRef.current.currentTime = time;
    }
  };

  const handleRateCycle = () => {
    const rates = [1, 1.25, 1.5, 2];
    const nextIdx = (rates.indexOf(playbackRate) + 1) % rates.length;
    const nextRate = rates[nextIdx];
    setPlaybackRate(nextRate);

    if (audioRef.current) {
      audioRef.current.playbackRate = nextRate;
    }
  };

  const handleCopyMarkdown = () => {
    if (typeof navigator !== "undefined" && navigator.clipboard) {
      void navigator.clipboard.writeText(article.content);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleDownloadZip = async () => {
    if (isZipping) return;
    setIsZipping(true);

    try {
      const zip = new JSZip();

      // 1. Article Markdown with title and subtitle
      const subtitleBlock = article.subtitle ? `> *${article.subtitle}*\n\n` : "";
      const fullMarkdown = `# ${article.title}\n\n${subtitleBlock}${article.content}`;
      zip.file("article.md", fullMarkdown);

      // 2. Cover image (extract binary from base64 data URL or fetch blob)
      if (article.coverImageUrl) {
        try {
          if (article.coverImageUrl.startsWith("data:")) {
            const parts = article.coverImageUrl.split(",");
            const base64Data = parts[1];
            const mimeMatch = parts[0].match(/:(.*?);/);
            const ext = mimeMatch && mimeMatch[1].includes("jpeg") ? "jpg" : "png";
            zip.file(`cover.${ext}`, base64Data, { base64: true });
          } else {
            const res = await fetch(article.coverImageUrl);
            if (res.ok) {
              const blob = await res.blob();
              zip.file("cover.png", blob);
            }
          }
        } catch (imgErr) {
          console.error("Failed to pack cover image into zip:", imgErr);
        }
      }

      // 3. Audio narration file (fetch blob from URL)
      if (article.audioUrl) {
        try {
          const res = await fetch(article.audioUrl);
          if (res.ok) {
            const audioBlob = await res.blob();
            zip.file("narration.wav", audioBlob);
          }
        } catch (audioErr) {
          console.error("Failed to pack audio narration into zip:", audioErr);
        }
      }

      // 4. Generate zip and trigger browser download
      const zipBlob = await zip.generateAsync({ type: "blob" });
      const downloadUrl = URL.createObjectURL(zipBlob);
      const link = document.createElement("a");
      const slug =
        article.title
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, "-")
          .replace(/^-+|-+$/g, "") || "article";
      link.href = downloadUrl;
      link.setAttribute("download", `${slug}.zip`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(downloadUrl);
    } catch (err) {
      console.error("Failed to create article zip archive:", err);
      alert("Failed to create zip bundle. Please try again.");
    } finally {
      setIsZipping(false);
    }
  };

  const formatSeconds = (sec: number) => {
    const mins = Math.floor(sec / 60);
    const remainder = Math.floor(sec % 60);
    return `${mins}:${remainder < 10 ? "0" : ""}${remainder}`;
  };

  return (
    <article className="medium-article-container">
      {/* Top Utility Bar */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: "24px",
          borderBottom: "1px solid var(--border)",
          paddingBottom: "14px",
          flexWrap: "wrap",
          gap: "12px"
        }}
      >
        <button
          type="button"
          onClick={onBackToForm}
          className="shadcn-btn-ghost"
          style={{ gap: "8px", fontWeight: 600, color: "#09090B" }}
        >
          <ArrowLeft size={16} />
          <span>New Article</span>
        </button>

        <div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
          <button
            type="button"
            onClick={handleDownloadZip}
            disabled={isZipping}
            className="shadcn-btn-primary"
            style={{ fontSize: "13px", padding: "6px 14px", gap: "6px" }}
            title="Download full bundle with Markdown, cover art, and audio (.zip)"
          >
            {isZipping ? (
              <>
                <Loader2 size={14} className="animate-spin" />
                <span>Packaging .zip...</span>
              </>
            ) : (
              <>
                <Download size={14} />
                <span>Download Bundle (.zip)</span>
              </>
            )}
          </button>

          <button
            type="button"
            onClick={handleCopyMarkdown}
            className="shadcn-btn-secondary"
            style={{ fontSize: "13px", padding: "6px 12px" }}
            title="Copy Markdown"
          >
            {copied ? <Check size={14} color="#10B981" /> : <Copy size={14} />}
            <span>{copied ? "Copied" : "Copy Markdown"}</span>
          </button>
        </div>
      </div>


      {/* Article Title */}
      <h1 className="medium-title">{article.title}</h1>

      {/* Subtitle */}
      {article.subtitle && <div className="medium-subtitle">{article.subtitle}</div>}

      {/* Author and Read Meta Row */}
      <div className="medium-author-row">
        <div style={{ display: "flex", alignItems: "center", gap: "14px" }}>
          <div
            style={{
              width: "44px",
              height: "44px",
              borderRadius: "50%",
              backgroundColor: "var(--primary)",
              color: "#FFFFFF",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontWeight: 700,
              fontSize: "18px"
            }}
          >
            P
          </div>
          <div>
            <div style={{ fontSize: "15px", fontWeight: 700, color: "#191919" }}>
              PulseWrite AI
            </div>
            <div style={{ fontSize: "13px", color: "#71717A" }}>
              <span>{article.createdAt}</span>
              <span style={{ margin: "0 6px" }}>·</span>
              <span>{article.readingTimeMinutes} min read</span>
            </div>
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
          <button
            type="button"
            onClick={() => setClaps((c) => c + 1)}
            style={{
              background: "none",
              border: "none",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: "6px",
              color: "#71717A",
              fontSize: "13px"
            }}
          >
            <ThumbsUp size={18} color="var(--primary)" />
            <span>{claps}</span>
          </button>
        </div>
      </div>

      {/* Medium-Style Audio Narration Player Bar */}
      <div className="audio-player-bar">
        {article.isGeneratingAudio ? (
          <div style={{ display: "flex", alignItems: "center", gap: "12px", width: "100%" }}>
            <div
              style={{
                width: "40px",
                height: "40px",
                borderRadius: "50%",
                backgroundColor: "var(--primary-light)",
                color: "var(--primary)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0
              }}
            >
              <Loader2 size={20} className="animate-spin" color="var(--primary)" />
            </div>
            <span style={{ fontSize: "13px", fontWeight: 600, color: "var(--foreground)" }}>
              Generating audio narration...
            </span>
          </div>
        ) : article.audioError ? (
          <div className="audio-player-error-state">
            <div style={{ display: "flex", alignItems: "center", gap: "10px", flex: 1, minWidth: 0 }}>
              <AlertTriangle size={20} color="#EF4444" style={{ flexShrink: 0 }} />
              <div>
                <div style={{ fontSize: "13px", fontWeight: 700, color: "#991B1B" }}>
                  Voice Narration Failed
                </div>
                <div style={{ fontSize: "12px", color: "#B91C1C", fontFamily: "var(--font-mono)", marginTop: "2px" }}>
                  {article.audioError}
                </div>
              </div>
            </div>
            <button
              type="button"
              onClick={onRetryAudio}
              className="shadcn-btn-secondary"
              style={{ fontSize: "12px", padding: "6px 12px", flexShrink: 0, gap: "6px" }}
            >
              <RefreshCw size={13} />
              <span>Retry Narration</span>
            </button>
          </div>
        ) : article.audioUrl ? (
          <div className="audio-player-single-row">
            <button
              type="button"
              onClick={togglePlay}
              aria-label={isPlaying ? "Pause narration" : "Play narration"}
              style={{
                width: "38px",
                height: "38px",
                borderRadius: "50%",
                backgroundColor: "var(--primary)",
                color: "#FFFFFF",
                border: "none",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                cursor: "pointer",
                flexShrink: 0
              }}
            >
              {isPlaying ? <Pause size={18} /> : <Play size={18} style={{ marginLeft: "2px" }} />}
            </button>

            <div className="audio-player-slider-wrap">
              <input
                type="range"
                min={0}
                max={duration || 180}
                value={currentTime}
                onChange={handleSeek}
                aria-label="Audio narration progress"
              />
            </div>

            <span className="audio-player-counter">
              {formatSeconds(currentTime)} / {formatSeconds(duration || 180)}
            </span>

            <button
              type="button"
              onClick={handleRateCycle}
              className="audio-player-speed-btn"
              aria-label={`Playback rate ${playbackRate}x`}
            >
              {playbackRate}x
            </button>
          </div>
        ) : (
          <div style={{ display: "flex", alignItems: "center", gap: "10px", color: "#71717A", fontSize: "13px" }}>
            <Headphones size={18} color="#71717A" />
            <span>
              Audio narration will start generating once the article finishes drafting.
            </span>
          </div>
        )}
      </div>

      {/* Hero Cover Image Section */}
      <div className="medium-cover-section">
        {article.isGeneratingImage && (
          <div
            style={{
              minHeight: "200px",
              maxHeight: "360px",
              aspectRatio: "16 / 9",
              backgroundColor: "var(--primary-light)",
              border: "1px dashed var(--primary-border)",
              borderRadius: "12px",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              gap: "14px",
              margin: "24px 0",
              color: "var(--primary)"
            }}
          >
            <Loader2 size={32} className="animate-spin" color="var(--primary)" />
            <span style={{ fontSize: "14px", fontWeight: 600, color: "var(--foreground)" }}>
              Generating cover image...
            </span>
          </div>
        )}

        {!article.isGeneratingImage && article.imageError && (
          <div className="cover-error-card">
            <div className="cover-error-title">
              <AlertTriangle size={18} color="#DC2626" />
              <span>Cover Art Generation Failed</span>
            </div>
            <div className="cover-error-msg">
              {article.imageError}
            </div>
            <button
              type="button"
              onClick={onRetryImage}
              className="shadcn-btn-secondary"
              style={{ alignSelf: "flex-start", marginTop: "4px", fontSize: "12px", gap: "6px" }}
            >
              <RefreshCw size={13} />
              <span>Retry Cover Generation</span>
            </button>
          </div>
        )}

        {!article.isGeneratingImage && !article.imageError && article.coverImageUrl && (
          <div className="medium-hero-image-wrap">
            <img src={article.coverImageUrl} alt={article.title} className="medium-hero-image" />
            <div className="medium-image-caption">
              Cover image for &ldquo;{article.title}&rdquo;
            </div>
          </div>
        )}
      </div>

      {/* Prose Article Markdown Content */}
      <RenderMarkdownProse content={article.content} />

      {/* Story Footer */}
      <div className="story-footer">
        <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
          <span className="pill-option">AI Publishing</span>
          <span className="pill-option">Technology</span>
          <span className="pill-option">Engineering</span>
        </div>

        <div className="story-footer-actions">
          <button
            type="button"
            onClick={handleDownloadZip}
            disabled={isZipping}
            className="shadcn-btn-primary"
            style={{ padding: "10px 18px", gap: "8px" }}
            title="Download full bundle with Markdown, cover art, and audio (.zip)"
          >
            {isZipping ? (
              <>
                <Loader2 size={15} className="animate-spin" />
                <span>Packaging .zip...</span>
              </>
            ) : (
              <>
                <Download size={15} />
                <span>Download Bundle (.zip)</span>
              </>
            )}
          </button>

          <button
            type="button"
            onClick={onBackToForm}
            className="shadcn-btn-secondary"
            style={{ padding: "10px 18px" }}
          >
            <span>Write Another Story</span>
            <ArrowLeft size={16} style={{ transform: "rotate(180deg)" }} />
          </button>
        </div>
      </div>
    </article>
  );
}
