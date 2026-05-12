# REELSCRIBE: Key & Environment Setup Guide

To run Reelscribe, you need to configure several cloud services and API keys. Use the **Secrets** panel in Google AI Studio to set these values.

## 1. AI Transcription Keys

### Google Gemini API Key (`GEMINI_API_KEY`)
*   **Purpose:** The primary engine used for high-fidelity transcription and metadata processing.
*   **How to get it:**
    1.  Go to [Google AI Studio](https://aistudio.google.com/).
    2.  Click on **Get API key** in the left sidebar.
    3.  Copy your key and paste it into the Secrets panel.

### Deepgram API Key (`DEEPGRAM_API_KEY`)
*   **Purpose:** Optional ultra-fast transcription alternative.
*   **How to get it:**
    1.  Sign up at [Deepgram Console](https://console.deepgram.com/).
    2.  Create a new API Key.
    3.  Select "Administrator" or "Member" role.

### OpenAI API Key (`OPENAI_API_KEY`)
*   **Purpose:** Optional alternative for whisper-based transcription.
*   **How to get it:**
    1.  Go to the [OpenAI API Platform](https://platform.openai.com/).
    2.  Navigate to "API Keys" and create a new secret key.

---

## 2. Database & Cache

### MongoDB URI (`MONGODB_URI`)
*   **Purpose:** Stores job status, transcriptions, and metadata.
*   **How to get it:**
    1.  Create a free account at [MongoDB Atlas](https://www.mongodb.com/cloud/atlas).
    2.  Create a new Cluster (the free "M0" tier works).
    3.  Click **Connect** -> **Connect your application**.
    4.  Copy the connection string (it looks like `mongodb+srv://username:password@cluster.mongodb.net/...`).

### Upstash Redis URL (`UPSTASH_REDIS_URL`)
*   **Purpose:** Manages the task queue for bulk and profile processing.
*   **How to get it:**
    1.  Go to [Upstash Console](https://console.upstash.com/).
    2.  Create a new **Redis** database.
    3.  Scroll down to the "REST API" or "Connection Details" and copy the **Redis URL** (starts with `rediss://`).

---

## 3. Instagram Bot Detection Bypass

### Instagram Cookies (`INSTAGRAM_COOKIES_FILE`)
*   **Purpose:** Prevents Instagram from blocking the tool during automated downloads.
*   **How to get it:**
    1.  Install the **"Get cookies.txt LOCALLY"** extension in Chrome/Edge.
    2.  Log in to your Instagram account in the browser.
    3.  Click the extension icon and select **Export**.
    4.  Save the file as `cookies.txt` in your project root and set the path in `.env`.

### Proxy List (`PROXY_LIST`)
*   **Purpose:** Rotates IP addresses if you are processing high volumes of Reels.
*   **Format:** `http://user:pass@host:port,http://user:pass@host:port`
*   **Where to get:** Use services like **Bright Data**, **Oxylabs**, or **WebShare**.

---

## 4. Platform Provided (Auto-Injected)
*   **`APP_URL`**: This is automatically set by Google Cloud Run. You don't need to manually configure it unless testing locally.
