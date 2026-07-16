# CHANGE_REQUEST.md

## Source
- Deployed site: `https://twlee1.github.io/`
- Last good deploy commit: `1386f03`
- Last good deploy URL: `https://twlee1.github.io/`
- References: `AORR.md`, `MEMORY.md`, `AORR_LOG.md`, current code, deployed site

## Active Step 9 Scope
- Continue the approved static-site change loop in `index.html`, `styles.css`, and `script.js`.
- Keep the implementation limited to HTML, CSS, and JavaScript.
- Do not invent private facts or move outside the approved static front-end scope.

## New Atomic Change Item

### CR-17
- Request: 소스가 가장 단순한 순서이고, HTML/CSS/JS만으로 만든 오픈소스 브라우저 게임 5개를 추려서 참고 레퍼런스로 추가 구현.
- Category: `CONTENT`
- Current:
  - There is no curated reference block for simple open-source browser games.
- Expected:
  - Add exactly 5 browser-playable references.
  - Restrict the set to HTML/CSS/JS implementations only.
  - Order the cards from the simplest source structure to the most involved source structure within that limited set.
  - Each card should expose a short reason plus direct `Play` and `Source` links.
- Approved file scope:
  - `CHANGE_REQUEST.json`
  - `CHANGE_REQUEST.md`
  - `index.html`
  - `styles.css`
- Dependencies:
  - none
- Completion criteria:
  - A visible section lists exactly 5 references.
  - The heading explains the HTML/CSS/JS-only filter and the source-simplicity ordering.
  - The section remains readable at `375px`, `768px`, and `1440px`.

## Ordered Reference Set
1. `2048`
2. `Emoji Minesweeper`
3. `A Dark Room`
4. `Sleeping Beauty`
5. `Hextris`

## Verification Plan
- Validate `CHANGE_REQUEST.json` parses cleanly.
- Check `script.js` syntax.
- Confirm the new section heading and the five reference titles exist in `index.html`.
- Confirm local HTTP `200` on a temporary static server.

## Stop Rule
- After local verification passes, update memory/log state and move to `DEPLOY_APPROVAL_REQUIRED` unless the user has already explicitly approved commit, push, and redeploy.
