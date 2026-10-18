# Contributing

## Branches and pull requests

- Work on a branch; `main` is what GitHub Pages publishes.
- Every pull request gets a preview at `https://<owner>.github.io/<repo>/pr/<number>/`, linked in a comment on the PR once the deploy finishes.
- PR titles follow [Conventional Commits](https://www.conventionalcommits.org/): `feat:`, `fix:`, `docs:`, `chore:`, `data:` (listing or glossary edits), `test:`, `ci:`. Example: `feat: instant search with brand suggestions`.
- Fill in the pull request template: summary, user stories, before/after (with screenshots for anything visual), the changelog line, what was tested, data changes, notes for reviewers.
- Add a line under **Unreleased** in `CHANGELOG.md` in the same PR.

## Checks

```sh
npm run check      # validates data.json and glossary.json
npm test           # unit tests for the catalog rules
npm ci && npx playwright install chromium
npm run test:e2e   # browser smoke tests against a local server
```

CI runs all three on every pull request. The unit test `data.test.js` pins the number of listings (122) and how many meet the default rules (64); update both numbers in the same PR that adds or changes listings.

## Data and tone

See the README for the `data.json` schema. Record every item researched, including ones that miss the default rules. The site reports what makers and stores say and takes no position on safety or risk: no "top pick", "avoid", "safe".
