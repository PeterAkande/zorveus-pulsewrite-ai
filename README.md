# PulseWrite AI Studio

A production starter application demonstrating how developers can integrate **`@zorveus/react`**, **`@zorveus/sdk`**, and the **`ZorveusOpenAI`** adapter into a React and Vite application.

PulseWrite AI is an editorial article generator. Users connect their personal Zorveus AI wallet, configure foundation models, monitor their spend caps in real time, and run streaming inference, cover image generation, and audio narration without the SaaS platform incurring model costs.

---

## Overview

Traditional AI applications require the developer to configure and pay for server-side API keys (OpenAI, Anthropic, Gemini). This creates two problems:
1. High operational costs and billing risk for the application developer.
2. Complicated subscription and credit management systems for end users.

PulseWrite AI flips this model using the Zorveus SDK:
- **User-owned AI wallet:** Users authenticate with their personal Zorveus wallet through OAuth 2.0 PKCE.
- **Direct gateway routing:** All requests go through the Zorveus gateway using the user's bearer token.
- **Zero API billing liabilities:** Model usage is charged directly against the user's Zorveus balance and spend limit.
- **Drop-in OpenAI SDK compatibility:** Multimodal endpoints (chat, images, audio) work with the familiar OpenAI SDK interface through the `ZorveusOpenAI` adapter.

---

## Quickstart

### 1. Configure environment variables

Copy the template:
```bash
cp .env.example .env
```

Edit `.env`:
```env
# OAuth 2.0 Client ID from the Zorveus Developer Console
VITE_ZORVEUS_CLIENT_ID="zrv_client_..."

# OAuth callback URL (must match redirect URI configured in Zorveus console)
VITE_ZORVEUS_REDIRECT_URI="http://localhost:5173/oauth/callback"

# Zorveus control plane and AI gateway endpoints
VITE_ZORVEUS_API_URL="https://api.zorveus.com"
VITE_ZORVEUS_GATEWAY_URL="https://api.zorveus.com/v1"
```

### 2. Install dependencies and start the dev server

From the monorepo root:
```bash
npm run dev:pulsewrite
```

Or from the `pulsewrite-ai` directory:
```bash
npm install
npm run dev
```

Open [http://localhost:5173](http://localhost:5173) in your browser.

---

## How to use the app

1. **Connect your Zorveus wallet:** Click **Connect Wallet** in the navbar or studio banner. A popup opens the Zorveus OAuth flow. Authorizing the app returns you with an active session.
2. **Review your spend limit:** Once connected, the navbar displays your remaining balance and spent amount.
3. **Configure your story:**
   - Enter a topic (e.g. *"The Architecture of Modern Web Agents"*).
   - Select your tone and target word count.
   - Choose your foundation models. The dropdowns query available models directly from the Zorveus gateway.
   - Pick an editorial cover art style and a voice narrator.
4. **Generate the article:**
   - Text streams into the reading view in real time.
   - Cover art generates concurrently via `gemini/gemini-2.5-flash-image`.
   - Voice narration synthesizes as soon as text drafting completes via `gemini/gemini-2.5-flash-preview-tts`.
5. **Listen and download:**
   - Play the narration in the custom audio player with speed controls (1x, 1.25x, 1.5x, 2x).
   - Click **Download Bundle (.zip)** to package the Markdown article, high-resolution cover image, and voice narration audio into a single `.zip` archive.
   - Watch the spend counter in the navbar update automatically upon generation.


---

## Core developer patterns

### 1. Mounting the Zorveus provider

Wrap your React application tree with `<ZorveusProvider>`. This gives child components access to the auth context, wallet tokens, spend data, and initialized SDK client.

**File:** `src/App.tsx`

```tsx
import { ZorveusProvider, OAuthCallbackHandler } from "@zorveus/react";

export default function App() {
  return (
    <ZorveusProvider
      clientId={clientId}
      redirectUri={redirectUri}
      baseURL={apiUrl}
      gatewayBaseURL={gatewayBaseURL}
      persistToken={true}
    >
      {/* Handles popup and redirect callback parameters */}
      <OAuthCallbackHandler />
      <Navbar />
      <main>{/* App routes */}</main>
    </ZorveusProvider>
  );
}
```

#### Primary architecture: public clients (client-side PKCE)

PulseWrite AI uses a Zorveus **Public Client**. Single-page applications running entirely in the browser cannot protect confidential secrets. With a public client, your application authenticates securely using RFC 7636 PKCE without needing a client secret or custom backend token exchange route.

##### How public clients work

1. **RFC 7636 PKCE in the browser**: the SDK creates a random `code_verifier` and SHA-256 `code_challenge`.
2. **Zero secrets**: the application provides only `clientId`. No `clientSecret` is generated, saved, or exposed in client bundles.
3. **Automatic browser exchange**: when Zorveus redirects with the authorization code, `<OAuthCallbackHandler />` exchanges the code and verifier directly with `https://api.zorveus.com/oauth/token`.
4. **Direct gateway streaming**: inference, model queries, image generation, and audio narration stream directly between the user's browser and the Zorveus gateway.

##### How to create a public client in Zorveus

1. Open the Zorveus developer dashboard and navigate to **Apps**.
2. Click **Create App**.
3. Open **Advanced Settings**.
4. In **OAuth Client Type**, select **Public Client (SPA / Mobile PKCE)**.
5. Set your redirect URI (for local development: `http://localhost:5173/oauth/callback`).
6. Click **Create**. Copy your public `client_id` (`zrv_client_...`) into `VITE_ZORVEUS_CLIENT_ID`. No secret will be issued.

#### Alternative architecture: confidential clients (backend-orchestrated OAuth)

If you are building a server-rendered application (Next.js server components, Remix, Express) or have an existing setup with a **Confidential Client**, your application receives both a `client_id` and a confidential `client_secret`.

Confidential secrets must never exist in browser code or client-side `.env` files. In this architecture, keep the secret on your backend server and orchestrate token exchange before handing the session to your frontend.

##### Why use a backend for confidential clients?

1. **Security**: your confidential `client_secret` stays on your backend server.
2. **Zero streaming bottleneck**: AI workloads (token streaming, image generation, audio synthesis) still run directly between the user's browser and the Zorveus Gateway once hydrated. Your application server never proxies heavy, long-running HTTP streams.

##### How the confidential flow works

1. **User clicks connect**: the browser opens Zorveus OAuth with your `client_id` and a `redirect_uri` that points to your backend.
2. **User authorizes**: Zorveus redirects to your backend callback route with an authorization code (`/api/auth/callback?code=...`).
3. **Backend exchanges code**: your server calls Zorveus (`https://api.zorveus.com/oauth/token`) with the code and your secret. Zorveus returns the user's `access_token`.
4. **Backend saves session**: your server stores the token in an HTTP session or secure cookie and redirects the user back to the web application.
5. **Frontend hydrates SDK**: on page load, your React app queries your backend for the session and feeds the token to `setOAuthSession()`.
6. **Direct gateway execution**: from that point forward, `useZorveusModels()`, `useZorveusSpend()`, and inference streams talk directly to the Zorveus gateway without your server proxying the requests.

##### 1. Backend exchange route (`server.ts` or `/api/auth/callback`)

```ts
// Express / Next.js route: handles the OAuth redirect on your backend
app.get("/api/auth/callback", async (req, res) => {
  const code = req.query.code as string;
  if (!code) {
    return res.status(400).send("Missing authorization code");
  }

  // Server-to-server token exchange with confidential client_secret
  const tokenRes = await fetch("https://api.zorveus.com/oauth/token", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      grant_type: "authorization_code",
      client_id: process.env.ZORVEUS_CLIENT_ID,
      client_secret: process.env.ZORVEUS_CLIENT_SECRET, // Stays secure on server
      redirect_uri: process.env.ZORVEUS_REDIRECT_URI,
      code
    })
  });

  if (!tokenRes.ok) {
    return res.status(500).send("Token exchange failed");
  }

  const { access_token, app_connection_id } = await tokenRes.json();

  // Save in user session
  req.session.zorveusToken = access_token;
  req.session.appConnectionId = app_connection_id;

  // Redirect back to the frontend app
  res.redirect("/");
});

// Endpoint for frontend to fetch the current user's session
app.get("/api/auth/session", (req, res) => {
  if (!req.session?.zorveusToken) {
    return res.json({ authenticated: false });
  }

  res.json({
    authenticated: true,
    access_token: req.session.zorveusToken,
    app_connection_id: req.session.appConnectionId
  });
});
```

##### 2. Frontend session hydration (`src/App.tsx`)

Mount `<ZorveusProvider>` without `clientSecret`. Use a small initializer component to hydrate the session:

```tsx
import { useEffect } from "react";
import { ZorveusProvider, useZorveusContext } from "@zorveus/react";

function AuthInitializer({ children }: { children: React.ReactNode }) {
  const { setOAuthSession, isConnected } = useZorveusContext();

  useEffect(() => {
    if (isConnected) return;

    async function syncSession() {
      const res = await fetch("/api/auth/session");
      if (!res.ok) return;

      const data = await res.json();
      if (!data.authenticated || !data.access_token) return;

      // Hydrate SDK client with the session token from your backend
      setOAuthSession({
        access_token: data.access_token,
        app_connection_id: data.app_connection_id
      });
    }

    void syncSession();
  }, [isConnected, setOAuthSession]);

  return <>{children}</>;
}

export default function App() {
  return (
    <ZorveusProvider
      clientId={import.meta.env.VITE_ZORVEUS_CLIENT_ID}
      redirectUri={import.meta.env.VITE_ZORVEUS_REDIRECT_URI}
      baseURL={import.meta.env.VITE_ZORVEUS_API_URL}
      gatewayBaseURL={import.meta.env.VITE_ZORVEUS_GATEWAY_URL}
      persistToken={false} // Session managed by your backend
    >
      <AuthInitializer>
        <Navbar />
        <main>{/* App routes */}</main>
      </AuthInitializer>
    </ZorveusProvider>
  );
}
```

##### How hooks behave once hydrated

As soon as `setOAuthSession` runs:
- The provider instantiates the authenticated SDK client automatically.
- `useZorveusModels()` queries available models straight from the Zorveus gateway.
- `useZorveusSpend()` and `<SpendCapIndicator />` query live budget limits with zero polling.
- Streaming requests (`client.chat.completions.create({ stream: true })`) stream tokens directly to the reader view without loading your web server.

### 2. User authentication and wallet connection

Use `<ConnectWalletButton />` to render the standard Zorveus sign-in button. Use `useZorveusAuth()` to inspect the connection status or access the bearer token.

**File:** `src/components/Navbar.tsx`

```tsx
import { ConnectWalletButton, useZorveusAuth } from "@zorveus/react";

export function AuthControls() {
  const { isConnected, accessToken, disconnect } = useZorveusAuth();

  return (
    <div className="flex items-center gap-3">
      <ConnectWalletButton />
      {isConnected && (
        <button onClick={disconnect}>Sign out</button>
      )}
    </div>
  );
}
```

### 3. Real-time spend tracking and budget caps

Use `useZorveusSpend()` to query live period spend, remaining balance, and allowance limits. Use `<SpendCapIndicator />` for an inline visual bar.

**File:** `src/components/Navbar.tsx`

```tsx
import { useZorveusSpend, SpendCapIndicator } from "@zorveus/react";

export function SpendBadge() {
  const { spentFormatted, remainingBalanceFormatted, refresh } = useZorveusSpend();

  return (
    <div onClick={() => refresh()}>
      <span>Spent: {spentFormatted}</span>
      <span>Remaining: {remainingBalanceFormatted}</span>
      <SpendCapIndicator />
    </div>
  );
}
```

### 4. Event-driven spend updates without polling

Avoid wasteful background polling loops. When an inference operation completes, emit a `zorveus:activity` window event. Components listening to this event call `refresh()` immediately.

**File:** `src/services/agent.ts`

```ts
export function notifyZorveusActivity(): void {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("zorveus:activity"));
  }
}
```

**File:** `src/components/Navbar.tsx`

```tsx
useEffect(() => {
  const handleActivity = () => {
    void refresh();
  };

  window.addEventListener("zorveus:activity", handleActivity);
  return () => window.removeEventListener("zorveus:activity", handleActivity);
}, [refresh]);
```

### 5. Dynamic model discovery

Instead of hardcoding model lists, ask the Zorveus gateway which models are active for the connected account.

**File:** `src/components/ArticleForm.tsx`

```tsx
import { useZorveusModels } from "@zorveus/react";

export function ModelSelector() {
  const { models, isLoading, refresh } = useZorveusModels({ routeStatus: undefined });

  // Filter text vs multimodal models
  const chatModels = models.filter((m) => !m.id.includes("image") && !m.id.includes("tts"));
  const imageModels = models.filter((m) => m.id.includes("image") || m.id.includes("imagen"));

  return (
    <select>
      {chatModels.map((m) => (
        <option key={m.id} value={m.id}>{m.id}</option>
      ))}
    </select>
  );
}
```

### 6. Streaming text generation

Use `client.chat.completions.create({ stream: true })` from `@zorveus/sdk` to stream tokens to the UI directly from the Zorveus gateway.

**File:** `src/services/agent.ts`

```ts
import type { Zorveus } from "@zorveus/sdk";

export async function streamArticleDraft(
  client: Zorveus,
  formData: ArticleFormData,
  onChunk: (chunk: string, currentFullText: string) => void
) {
  const stream = await client.chat.completions.create({
    model: formData.model,
    messages: [
      { role: "system", content: "You are a professional essayist." },
      { role: "user", content: `Write an article about ${formData.topic}` }
    ],
    stream: true,
    temperature: 0.7
  });

  let accumulated = "";
  for await (const chunk of stream) {
    const delta = chunk.choices[0]?.delta?.content || "";
    accumulated += delta;
    onChunk(delta, accumulated);
  }

  notifyZorveusActivity();
  return accumulated;
}
```

### 7. Multimodal image generation via the Zorveus OpenAI adapter

The `@zorveus/sdk/openai` module exports `ZorveusOpenAI`. It wraps the standard `OpenAI` client and routes calls directly through the Zorveus gateway.

**File:** `src/services/agent.ts`

```ts
import { ZorveusOpenAI } from "@zorveus/sdk/openai";

export function getZorveusOpenAIClient(gatewayBaseURL: string, accessToken: string): ZorveusOpenAI {
  return new ZorveusOpenAI({
    apiKey: accessToken,
    baseURL: gatewayBaseURL.replace(/\/+$/, ""),
    dangerouslyAllowBrowser: true
  });
}

export async function generateCoverImage(
  gatewayBaseURL: string,
  accessToken: string,
  topic: string
): Promise<string> {
  const openai = getZorveusOpenAIClient(gatewayBaseURL, accessToken);

  const response = await openai.images.generate({
    model: "gemini/gemini-2.5-flash-image",
    prompt: `Editorial cover art for an article titled "${topic}". Minimalist, high resolution, no text.`,
    n: 1,
    size: "1024x1024",
    response_format: "b64_json"
  });

  const b64 = response.data?.[0]?.b64_json;
  notifyZorveusActivity();
  return `data:image/png;base64,${b64}`;
}
```

### 8. Voice narration synthesis via the Zorveus OpenAI adapter

Speech synthesis uses `openai.audio.speech.create` through `ZorveusOpenAI`. Raw PCM16 audio is packaged into a standard RIFF WAV blob for native browser playback.

**File:** `src/services/agent.ts`

```ts
export async function generateVoiceNarration(
  gatewayBaseURL: string,
  accessToken: string,
  articleText: string,
  voice: string = "achird"
): Promise<string> {
  const openai = getZorveusOpenAIClient(gatewayBaseURL, accessToken);

  const response = await openai.audio.speech.create({
    model: "gemini/gemini-2.5-flash-preview-tts",
    voice: voice as "alloy",
    input: articleText.slice(0, 2500),
    response_format: "pcm"
  });

  const arrayBuffer = await response.arrayBuffer();
  const wavBlob = pcm16ToWavBlob(arrayBuffer, 24000, 1);

  notifyZorveusActivity();
  return URL.createObjectURL(wavBlob);
}
```

---

## Project structure

```
pulsewrite-ai/
├── src/
│   ├── components/
│   │   ├── Navbar.tsx        # Header with wallet sign-in and live spend indicators
│   │   ├── LandingPage.tsx   # Product landing page with feature cards
│   │   ├── CreatePage.tsx    # Generation studio orchestrator
│   │   ├── ArticleForm.tsx   # Form inputs, model pickers, and inline budget status
│   │   └── MediumView.tsx    # Article reader, cover image, audio player, zip bundle export
│   ├── services/
│   │   └── agent.ts          # Zorveus SDK client, ZorveusOpenAI adapter, PCM16 conversion
│   ├── types.ts              # TypeScript definitions for forms, articles, and models
│   ├── App.tsx               # Root ZorveusProvider, OAuth handler, and routing
│   └── main.tsx              # Application entry point
├── package.json
└── README.md
```

---

## React SDK and adapter reference

| Component / Hook | Source | Purpose |
| :--- | :--- | :--- |
| `<ZorveusProvider>` | `@zorveus/react` | Application root managing OAuth PKCE tokens and Zorveus client lifecycle |
| `<OAuthCallbackHandler>` | `@zorveus/react` | Invisible listener for OAuth popup and redirect completions |
| `<ConnectWalletButton>` | `@zorveus/react` | Prebuilt connect and disconnect wallet button |
| `<SpendCapIndicator>` | `@zorveus/react` | Spending cap progress bar with status thresholds |
| `useZorveusAuth()` | `@zorveus/react` | Accesses connection status, access token, and disconnect action |
| `useZorveusSpend()` | `@zorveus/react` | Queries live period spend and spend caps (`GET /inference-keys/usage`) |
| `useZorveusModels()` | `@zorveus/react` | Queries accessible foundation models for active connection |
| `useZorveusContext()` | `@zorveus/react` | Direct access to SDK client instance, URLs, and auth state |
| `ZorveusOpenAI` | `@zorveus/sdk/openai` | OpenAI SDK adapter wrapping official client with direct gateway routing |

---

## License

MIT © [Zorveus Inc.](https://zorveus.com)
