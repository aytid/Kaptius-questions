# Technical Interview Question Bank

A static website for running viva / technical interviews with BTech 4th-year Computer Science students. It ships with 120 short-answer questions (40 OOPS, 50 JavaScript, 30 HTML). There is no backend, no framework and no database: just HTML, CSS, vanilla JavaScript and one JSON file.

```
technical-interview-question-bank/
├── index.html
├── style.css
├── script.js
├── questions.json
└── README.md
```

## 1. How to run the website

Browsers block `fetch()` for files opened straight from disk (`file://`), so serve the folder with any static server:

```bash
cd technical-interview-question-bank
python -m http.server 8000
```

Then open <http://localhost:8000>. (Node users can run `npx serve` instead.)

If the page shows "Could not load questions.json", either you opened `index.html` directly, or `questions.json` has a JSON mistake such as a missing comma.

**Keyboard shortcuts** on a question: `←` previous, `→` next, `Space` show or hide the answer.

## 2. How to deploy to GitHub Pages

1. Create a repository and upload all five files to the root.
2. Open **Settings → Pages**.
3. Under **Build and deployment**, choose **Deploy from a branch**, select `main` and `/ (root)`, then **Save**.
4. After a minute the site is live at `https://<your-username>.github.io/<repo-name>/`.

To update questions later, edit `questions.json` on GitHub (pencil icon) and commit. The site picks up the change on the next page load, with no other change needed.

## 3. JSON structure

`questions.json` is a list of question objects:

```json
{
  "id": 25,
  "category": "HTML",
  "topic": "Semantic HTML",
  "difficulty": "Medium",
  "question": "Why should semantic HTML elements be used instead of using div elements for everything?",
  "answer": "Semantic elements provide meaning and structure to the content, improving accessibility, SEO, and maintainability.",
  "keyPoints": [
    "Improves accessibility",
    "Helps search engines understand content",
    "Improves code readability"
  ]
}
```

| Field | Meaning |
|-------|---------|
| `id` | A unique number. If it is missing or repeated, the app assigns a free one. |
| `category` | Top-level group shown as a card on the dashboard (e.g. `OOPS`). |
| `topic` | Sub-group inside the category, shown in the sidebar. |
| `difficulty` | `Easy`, `Medium` or `Hard` (anything else is treated as `Medium`). |
| `question` | The question text. |
| `answer` | The expected answer the interviewer compares against. |
| `keyPoints` | A short list of points a good answer should mention. Also searched. |

JSON rules to remember: every field name and text value is in double quotes, items are separated by commas, and there is **no comma after the last item**. Use single quotes inside text (`'like this'`), or write `\"` for a double quote.

## 4. How to add a new question

Copy an existing block, paste it before the final `]`, put a comma after the block above it, and change the values. Nothing in `script.js` needs to change; counts, topics and search update automatically.

## 5. How to add a new topic

Use a new `topic` value on a question. For example, `"topic": "Generics"` on an OOPS question creates a **Generics** entry in the OOPS sidebar. Spell it identically on every question of that topic.

## 6. How to add a new category

Use a new `category` value, such as `"category": "SQL"`. A new **SQL** card appears on the dashboard, in the interview setup form and in the totals table. Add CSS, SQL, React, Python, DBMS, OS, Networks or anything else the same way.

## 7. How to modify an answer

Find the question in `questions.json` and edit its `answer` and `keyPoints` values.

## 8. How the shuffle works

- **🎲 Jumble All Questions** copies every question from every category and shuffles the copy with a Fisher-Yates shuffle. Each question appears exactly once, so there are no repeats in a session. Duplicate questions in the JSON (same text) are also removed when the file loads.
- **🔀 Shuffle Again** makes a fresh random order and starts from question 1.
- **Interview sessions** filter by category, topic and difficulty, shuffle the matches and take the number you asked for. Tick "Order from easy to hard" to sort the picked questions by difficulty instead of random order.
- **Browsing a category** (without a session) lists questions from easy to hard.

## Other features

- **Search** covers question text, category, topic and key points. All words you type must match.
- **Mark for Review** stars a question. Marks are kept in your browser's `localStorage`; open **⭐ Review** in the top bar to see them, ask them one by one, or clear them.
- **Dark / light mode** is remembered in `localStorage`. Colours are CSS variables at the top of `style.css`.
