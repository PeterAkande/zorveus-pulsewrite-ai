import type { Zorveus } from "@zorveus/sdk";
import { ZorveusOpenAI } from "@zorveus/sdk/openai";
import type { ArticleFormData, ImageStyle } from "../types";

export const DEFAULT_CHAT_MODEL = "zorveus/qwen3.8-27b";
export const DEFAULT_IMAGE_MODEL = "gemini/gemini-2.5-flash-image";
export const DEFAULT_TTS_MODEL = "gemini/gemini-2.5-flash-preview-tts";
export const DEFAULT_TTS_VOICE = "achird";
export const DEFAULT_TTS_FORMAT = "pcm16";

/**
 * Creates an instance of the Zorveus OpenAI adapter client.
 * Configured with browser execution enabled and gateway base URL.
 */
export function getZorveusOpenAIClient(gatewayBaseURL: string, accessToken: string): ZorveusOpenAI {
  return new ZorveusOpenAI({
    apiKey: accessToken,
    baseURL: gatewayBaseURL.replace(/\/+$/, ""),
    dangerouslyAllowBrowser: true
  });
}

/**
 * Dispatches an event to notify the app that a Zorveus operation completed.
 * Components listening to this event refresh spend, limit, and balance immediately.
 */
export function notifyZorveusActivity(): void {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("zorveus:activity"));
  }
}

/**
 * Wraps raw PCM16 samples in a RIFF WAV header for standard browser audio playback.
 * If the buffer already starts with 'RIFF', it is returned as a WAV blob directly.
 */
export function pcm16ToWavBlob(buffer: ArrayBuffer, sampleRate = 24000, numChannels = 1): Blob {
  const bytes = new Uint8Array(buffer);
  if (bytes.length >= 4 && bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46) {
    return new Blob([buffer], { type: "audio/wav" });
  }

  const wavHeader = new ArrayBuffer(44);
  const view = new DataView(wavHeader);

  // "RIFF"
  view.setUint32(0, 0x52494646, false);
  view.setUint32(4, 36 + buffer.byteLength, true);
  // "WAVE"
  view.setUint32(8, 0x57415645, false);
  // "fmt "
  view.setUint32(12, 0x666d7420, false);
  view.setUint32(16, 16, true); // Subchunk1Size (16 for PCM)
  view.setUint16(20, 1, true); // AudioFormat (1 = PCM)
  view.setUint16(22, numChannels, true); // NumChannels (1 = mono)
  view.setUint32(24, sampleRate, true); // SampleRate (24000)
  view.setUint32(28, sampleRate * numChannels * 2, true); // ByteRate
  view.setUint16(32, numChannels * 2, true); // BlockAlign
  view.setUint16(34, 16, true); // BitsPerSample (16)
  // "data"
  view.setUint32(36, 0x64617461, false);
  view.setUint32(40, buffer.byteLength, true);

  return new Blob([wavHeader, buffer], { type: "audio/wav" });
}

/**
 * Strips markdown syntax to yield clean plain text for speech synthesis.
 */
export function cleanMarkdownForSpeech(markdown: string): string {
  if (!markdown) return "";
  return markdown
    .replace(/^#+\s+.*$/gm, "") // Remove headers
    .replace(/```[\s\S]*?```/g, "") // Remove code blocks
    .replace(/`([^`]+)`/g, "$1") // Inline code
    .replace(/\*\*([^*]+)\*\*/g, "$1") // Bold
    .replace(/\*([^*]+)\*/g, "$1") // Italic
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1") // Links
    .replace(/^>\s+/gm, "") // Blockquotes
    .replace(/[-*+]\s+/g, "") // Bullet points
    .replace(/\n{2,}/g, " ") // Collapse whitespace
    .trim();
}

/**
 * Builds the article writing prompt from the user form data.
 */
function buildArticlePrompt(data: ArticleFormData): string {
  const points = data.keyPoints.trim()
    ? `Key points to address:\n${data.keyPoints}\n`
    : "";

  return `Write a publication-ready Medium article on the topic: "${data.topic}".

Tone: ${data.tone}
Target audience: ${data.targetAudience}
Target length: approximately ${data.targetWordCount} words.
${points}
Formatting instructions:
1. Start with the article title as a Markdown H1 (# Title), followed by an empty line.
2. Follow with a one-sentence italic subtitle (*Subtitle*), followed by an empty line.
3. Paragraph spacing: always insert a blank line between every paragraph, heading, blockquote, and list. Never run thoughts together into a single dense block of text.
4. Keep paragraphs skimmable and focused, between 2 and 4 sentences each.
5. Structure the body with clear H2 (##) and H3 (###) section headings. Place an empty line before and after every heading.
6. Place blockquotes (> quote text) on their own lines with blank lines above and below.
7. Place each list item on its own line with blank lines separating the list from surrounding prose.
8. Provide concrete takeaways and a thoughtful conclusion.
9. Do not include meta commentary or preamble. Begin directly with the # Title.`;
}

interface StreamDelta {
  content?: string | null;
  reasoning_content?: string | null;
  reasoning?: string | null;
}

/**
 * Streams article generation using either the native Zorveus SDK client or the Zorveus OpenAI adapter.
 * Detects reasoning tokens (both via delta fields and in-band <think> tags) and reports them cleanly.
 */
export async function streamArticleDraft(
  client: Zorveus | ZorveusOpenAI,
  formData: ArticleFormData,
  onChunk: (chunk: string, currentFullText: string) => void,
  signal?: AbortSignal,
  onReasoningChunk?: (reasoningChunk: string, currentFullReasoning: string) => void,
  onAnswerStart?: () => void
): Promise<string> {
  const prompt = buildArticlePrompt(formData);

  let accumulatedContent = "";
  let accumulatedReasoning = "";
  let insideThinkTag = false;
  let hasSignaledAnswerStart = false;

  const processDelta = (delta: StreamDelta) => {
    const reasoningDelta = delta.reasoning_content || delta.reasoning || "";
    if (reasoningDelta) {
      accumulatedReasoning += reasoningDelta;
      onReasoningChunk?.(reasoningDelta, accumulatedReasoning);
    }

    const contentDelta = delta.content || "";
    if (!contentDelta) return;

    let remaining = contentDelta;

    while (remaining.length > 0) {
      if (!insideThinkTag) {
        const startTagIndex = remaining.indexOf("<think>");
        if (startTagIndex === -1) {
          if (!hasSignaledAnswerStart && remaining.trim().length > 0) {
            hasSignaledAnswerStart = true;
            onAnswerStart?.();
          }
          accumulatedContent += remaining;
          onChunk(remaining, accumulatedContent);
          remaining = "";
          continue;
        }

        const beforeTag = remaining.slice(0, startTagIndex);
        if (beforeTag) {
          if (!hasSignaledAnswerStart && beforeTag.trim().length > 0) {
            hasSignaledAnswerStart = true;
            onAnswerStart?.();
          }
          accumulatedContent += beforeTag;
          onChunk(beforeTag, accumulatedContent);
        }
        insideThinkTag = true;
        remaining = remaining.slice(startTagIndex + 7);
      } else {
        const endTagIndex = remaining.indexOf("</think>");
        if (endTagIndex === -1) {
          accumulatedReasoning += remaining;
          onReasoningChunk?.(remaining, accumulatedReasoning);
          remaining = "";
          continue;
        }

        const reasoningPart = remaining.slice(0, endTagIndex);
        if (reasoningPart) {
          accumulatedReasoning += reasoningPart;
          onReasoningChunk?.(reasoningPart, accumulatedReasoning);
        }
        insideThinkTag = false;
        remaining = remaining.slice(endTagIndex + 8);
      }
    }

    if (accumulatedReasoning && !insideThinkTag && !hasSignaledAnswerStart && accumulatedContent.trim().length > 0) {
      hasSignaledAnswerStart = true;
      onAnswerStart?.();
    }
  };

  if (client instanceof ZorveusOpenAI) {
    const stream = await client.chat.completions.create(
      {
        model: formData.model || DEFAULT_CHAT_MODEL,
        messages: [
          {
            role: "system",
            content:
              "You are an acclaimed Medium publication essayist and journalist. You write clear, compelling, and insightful long-form articles."
          },
          {
            role: "user",
            content: prompt
          }
        ],
        stream: true,
        temperature: 0.7,
        enable_thinking: false,
        extra_body: {
          enable_thinking: false,
          chat_template_kwargs: {
            enable_thinking: false
          }
        },
        metadata: {
          app: "pulsewrite-ai",
          topic: formData.topic
        }
      } as unknown as Parameters<typeof client.chat.completions.create>[0],
      { signal }
    );

    for await (const chunk of stream as AsyncIterable<{ choices: Array<{ delta?: StreamDelta }> }>) {
      const delta = chunk.choices[0]?.delta;
      if (!delta) continue;
      processDelta(delta);
    }

    if (!accumulatedContent.trim()) {
      throw new Error(
        `Model (${formData.model || DEFAULT_CHAT_MODEL}) returned an empty response. Check model availability or try again.`
      );
    }

    notifyZorveusActivity();
    return accumulatedContent;
  }

  const stream = await client.chat.completions.create(
    {
      model: formData.model || DEFAULT_CHAT_MODEL,
      messages: [
        {
          role: "system",
          content:
            "You are an acclaimed Medium publication essayist and journalist. You write clear, compelling, and insightful long-form articles."
        },
        {
          role: "user",
          content: prompt
        }
      ],
      stream: true,
      temperature: 0.7,
      enable_thinking: false,
      extra_body: {
        enable_thinking: false,
        chat_template_kwargs: {
          enable_thinking: false
        }
      }
    } as unknown as Parameters<typeof client.chat.completions.create>[0],
    { signal }
  );

  for await (const chunk of stream as AsyncIterable<{ choices: Array<{ delta?: StreamDelta }> }>) {
    const delta = chunk.choices[0]?.delta;
    if (!delta) continue;
    processDelta(delta);
  }

  if (!accumulatedContent.trim()) {
    throw new Error(
      `Model (${formData.model || DEFAULT_CHAT_MODEL}) returned an empty response. Check model availability or try again.`
    );
  }

  notifyZorveusActivity();
  return accumulatedContent;
}

/**
 * Generates an image for the article using the Zorveus OpenAI adapter (openai.images.generate).
 * Strictly queries the gateway with zero mock or procedural fallbacks.
 */
export async function generateCoverImage(
  gatewayBaseURL: string,
  accessToken: string | null,
  topic: string,
  style: ImageStyle,
  imageModel?: string,
  signal?: AbortSignal
): Promise<string> {
  if (!accessToken) {
    throw new Error("Authentication required. Connect your Zorveus AI wallet to generate cover images.");
  }

  const modelToUse = imageModel || DEFAULT_IMAGE_MODEL;
  const imagePrompt = `Editorial cover art for a Medium article titled "${topic}". Style: ${style}, minimalist, atmospheric lighting, high resolution, award-winning digital art, no text, clean composition.`;

  const openai = getZorveusOpenAIClient(gatewayBaseURL, accessToken);

  const response = await openai.images.generate(
    {
      model: modelToUse,
      prompt: imagePrompt,
      n: 1,
      size: "1024x1024",
      response_format: "b64_json"
    },
    { signal }
  );

  const item = response.data?.[0];
  if (item?.b64_json) {
    notifyZorveusActivity();
    return `data:image/png;base64,${item.b64_json}`;
  }
  if (item?.url) {
    notifyZorveusActivity();
    return item.url;
  }

  throw new Error(`Zorveus Gateway returned no image data for ${modelToUse}.`);
}

/**
 * Generates audio narration using the Zorveus OpenAI adapter (openai.audio.speech.create).
 * Strictly queries the gateway with zero mock or speech synthesis fallbacks.
 */
export async function generateVoiceNarration(
  gatewayBaseURL: string,
  accessToken: string | null,
  articleMarkdown: string,
  voice: string,
  signal?: AbortSignal
): Promise<string> {
  if (!accessToken) {
    throw new Error("Authentication required. Connect your Zorveus AI wallet to synthesize audio.");
  }

  const plainText = cleanMarkdownForSpeech(articleMarkdown);
  if (!plainText) {
    throw new Error("No article text available for speech synthesis.");
  }

  // Sample the opening 2500 characters for narration
  const speechInput = plainText.slice(0, 2500);

  const openai = getZorveusOpenAIClient(gatewayBaseURL, accessToken);

  const response = await openai.audio.speech.create(
    {
      model: DEFAULT_TTS_MODEL,
      voice: (voice || DEFAULT_TTS_VOICE) as "alloy",
      input: speechInput,
      response_format: DEFAULT_TTS_FORMAT as "pcm"
    },
    { signal }
  );

  const arrayBuffer = await response.arrayBuffer();
  const wavBlob = pcm16ToWavBlob(arrayBuffer, 24000, 1);
  notifyZorveusActivity();
  return URL.createObjectURL(wavBlob);
}

