# 📚 AI Study Helper

Paste class notes or type a topic and the app uses the **Google Gemini API** to create:

- a short **summary**
- a 5-question **quiz** (with score and correct answers)
- **flashcards** (click to flip)

Built with plain HTML, CSS and JavaScript (no framework, no build step).

> Add a screenshot here: `![screenshot](screenshot.png)`

## Features

- Notes box with character counter and long-text warning
- Settings box for your own API key (saved in `localStorage`, never in code)
- `fetch` POST request with `async / await`
- Loading indicator, Generate button disabled while running
- Error messages for: no key, empty input, network failure, 400/401/403/404/429/5xx, invalid AI reply
- AI reply is parsed with `JSON.parse` in `try / catch` and validated
- History saved in `localStorage` (click to reopen, button to clear)
- Copy and Download (.txt) buttons for the summary
- Dark / Light mode (remembered)
- Extra features: answer style (Normal / Explain like I am 10 / Exam-focused / Detailed), read summary aloud (Speech Synthesis), flashcard flip animation with Known / Not known count, quiz difficulty selector, character counter

## How to get a free API key

1. Go to <https://aistudio.google.com/apikey>
2. Sign in with a Google account and click **Create API key**
3. Copy the key

## How to use

1. Open the app and click **⚙️ Settings**
2. Paste your API key and click **Save settings**
3. Paste notes (or a topic), choose style and difficulty, click **Generate**
4. Use the **Summary / Quiz / Flashcards** tabs

If the model name stops working, change it in Settings (see the model list in Google AI Studio).

## Run locally

Just open `index.html` in a browser, or run `npx serve .`

## Deploy on Vercel

1. Push this folder to a GitHub repository
2. Go to <https://vercel.com>, click **Add New → Project**, import the repo
3. Framework Preset: **Other**. Leave build command empty and click **Deploy**

No environment variables are needed because every user enters their own key.

## Project files

| File | Purpose |
| --- | --- |
| `index.html` | Page structure |
| `style.css` | Layout, themes, flip animation |
| `script.js` | Prompt, API call, parsing, rendering, history |

## Fetch request explained

- **URL:** `https://generativelanguage.googleapis.com/v1beta/models/<model>:generateContent`
- **Method:** `POST`
- **Headers:** `Content-Type: application/json` and `x-goog-api-key: <user key>`
- **Body:** `{ contents: [{ parts: [{ text: prompt }] }], generationConfig: { responseMimeType: "application/json" } }`
- **Response:** the answer text is at `candidates[0].content.parts[0].text`, which is JSON text that we parse

## Security

The API key is never written in the code. It lives only in the user's browser `localStorage`.
