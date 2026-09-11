import React, { useState, useRef } from "react";
import { useZorveusContext } from "@zorveus/react";
import type { ArticleFormData, ArticleResult, AgentProgress } from "../types";
import { ArticleForm } from "./ArticleForm";
import { MediumView } from "./MediumView";
import {
  streamArticleDraft,
  generateCoverImage,
  generateVoiceNarration,
  DEFAULT_CHAT_MODEL,
  DEFAULT_IMAGE_MODEL,
  DEFAULT_TTS_MODEL,
  DEFAULT_TTS_VOICE
} from "../services/agent";

export function CreatePage(): React.JSX.Element {
  const { client, gatewayBaseURL, accessToken } = useZorveusContext();

  const [subView, setSubView] = useState<"form" | "medium">("form");
  const [isGenerating, setIsGenerating] = useState(false);
  const [progress, setProgress] = useState<AgentProgress>({
    step: "idle",
    message: ""
  });

  const [article, setArticle] = useState<ArticleResult | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  const handleStartGeneration = async (data: ArticleFormData) => {
    if (!client) {
      alert("Please connect your Zorveus AI wallet first to run live model inference.");
      return;
    }

    setIsGenerating(true);
    setSubView("medium");

    // Initialize immediate article view with loader states
    const initialArticle: ArticleResult = {
      id: `art_${Date.now()}`,
      title: data.topic,
      subtitle: `An exploration of ${data.topic.toLowerCase()} for ${data.targetAudience.toLowerCase()}.`,
      content: "Drafting article with Zorveus AI...",
      coverImageUrl: "",
      isGeneratingImage: true,
      imageError: null,
      imageModel: data.imageModel || DEFAULT_IMAGE_MODEL,
      audioUrl: null,
      isGeneratingAudio: false, // will start when text stream completes
      audioError: null,
      readingTimeMinutes: 1,
      wordCount: 0,
      createdAt: new Date().toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric"
      }),
      topic: data.topic,
      tone: data.tone,
      model: data.model || DEFAULT_CHAT_MODEL,
      voice: data.voice || DEFAULT_TTS_VOICE
    };

    setArticle(initialArticle);
    abortControllerRef.current = new AbortController();

    try {
      // -------------------------------------------------------------
      // PHASE 1: GENERATE COVER IMAGE CONCURRENTLY (REAL MODEL)
      // -------------------------------------------------------------
      const imagePromise = (async () => {
        try {
          const coverUrl = await generateCoverImage(
            gatewayBaseURL,
            accessToken,
            data.topic,
            data.imageStyle,
            data.imageModel || DEFAULT_IMAGE_MODEL,
            abortControllerRef.current?.signal
          );
          setArticle((prev) =>
            prev ? { ...prev, coverImageUrl: coverUrl, isGeneratingImage: false, imageError: null } : null
          );
        } catch (imgErr: unknown) {
          const errorMsg = imgErr instanceof Error ? imgErr.message : String(imgErr);
          console.error("[Zorveus Gateway] Image generation error:", imgErr);
          setArticle((prev) => (prev ? { ...prev, isGeneratingImage: false, imageError: errorMsg } : null));
        }
      })();

      // -------------------------------------------------------------
      // PHASE 2: DRAFT ARTICLE TEXT (STREAMING)
      // -------------------------------------------------------------
      setProgress({
        step: "drafting_article",
        message: `Drafting long-form article with ${data.model || DEFAULT_CHAT_MODEL}...`
      });

      const fullDraft = await streamArticleDraft(
        client,
        data,
        (_chunk, currentText) => {
          setArticle((prev) => {
            if (!prev) return null;
            const wordCount = currentText.split(/\s+/).filter(Boolean).length;
            const readingTime = Math.max(1, Math.ceil(wordCount / 200));

            const titleMatch = currentText.match(/^#\s+(.+)$/m);
            const subtitleMatch = currentText.match(/^>\s+(.+)$/m);

            return {
              ...prev,
              title: titleMatch ? titleMatch[1].trim() : prev.title,
              subtitle: subtitleMatch ? subtitleMatch[1].trim() : prev.subtitle,
              content: currentText,
              wordCount,
              readingTimeMinutes: readingTime
            };
          });
        },
        abortControllerRef.current.signal
      );

      // -------------------------------------------------------------
      // PHASE 3: TEXT STREAM COMPLETE -> SYNTHESIZE VOICE AUDIO
      // -------------------------------------------------------------
      setProgress({
        step: "synthesizing_audio",
        message: `Synthesizing voice narration with ${DEFAULT_TTS_MODEL}...`
      });

      setArticle((prev) => (prev ? { ...prev, isGeneratingAudio: true, audioError: null } : null));

      try {
        const audioUrl = await generateVoiceNarration(
          gatewayBaseURL,
          accessToken,
          fullDraft,
          data.voice || DEFAULT_TTS_VOICE,
          abortControllerRef.current.signal
        );
        setArticle((prev) =>
          prev ? { ...prev, audioUrl, isGeneratingAudio: false, audioError: null } : null
        );
      } catch (ttsErr: unknown) {
        const errorMsg = ttsErr instanceof Error ? ttsErr.message : String(ttsErr);
        console.error("[Zorveus Gateway] Audio speech error:", ttsErr);
        setArticle((prev) => (prev ? { ...prev, isGeneratingAudio: false, audioError: errorMsg } : null));
      }

      // Await the concurrent image generation promise
      await imagePromise;

      // -------------------------------------------------------------
      // COMPLETED
      // -------------------------------------------------------------
      setProgress({
        step: "completed",
        message: "Publication ready!"
      });
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      setProgress({
        step: "error",
        message: "Generation encountered an issue.",
        error: errorMsg
      });
    } finally {
      setIsGenerating(false);
      abortControllerRef.current = null;
    }
  };

  const handleRetryImage = async () => {
    if (!article || !accessToken) return;
    setArticle((prev) => (prev ? { ...prev, isGeneratingImage: true, imageError: null } : null));
    try {
      const coverUrl = await generateCoverImage(
        gatewayBaseURL,
        accessToken,
        article.topic,
        article.tone === "thought-leadership" ? "editorial-minimal" : "abstract-geometric",
        article.imageModel || DEFAULT_IMAGE_MODEL
      );
      setArticle((prev) =>
        prev ? { ...prev, coverImageUrl: coverUrl, isGeneratingImage: false, imageError: null } : null
      );
    } catch (imgErr: unknown) {
      const errorMsg = imgErr instanceof Error ? imgErr.message : String(imgErr);
      setArticle((prev) => (prev ? { ...prev, isGeneratingImage: false, imageError: errorMsg } : null));
    }
  };

  const handleRetryAudio = async () => {
    if (!article || !accessToken || !article.content) return;
    setArticle((prev) => (prev ? { ...prev, isGeneratingAudio: true, audioError: null } : null));
    try {
      const audioUrl = await generateVoiceNarration(
        gatewayBaseURL,
        accessToken,
        article.content,
        article.voice || DEFAULT_TTS_VOICE
      );
      setArticle((prev) =>
        prev ? { ...prev, audioUrl, isGeneratingAudio: false, audioError: null } : null
      );
    } catch (ttsErr: unknown) {
      const errorMsg = ttsErr instanceof Error ? ttsErr.message : String(ttsErr);
      setArticle((prev) => (prev ? { ...prev, isGeneratingAudio: false, audioError: errorMsg } : null));
    }
  };

  const handleBackToForm = () => {
    if (isGenerating && abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    setIsGenerating(false);
    setSubView("form");
  };

  if (subView === "medium" && article) {
    return (
      <MediumView
        article={article}
        progress={progress}
        onBackToForm={handleBackToForm}
        onRetryImage={handleRetryImage}
        onRetryAudio={handleRetryAudio}
      />
    );
  }

  return (
    <ArticleForm
      onSubmit={handleStartGeneration}
      isGenerating={isGenerating}
    />
  );
}
