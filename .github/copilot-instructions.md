# Moviester project notes

- Keep movie metadata, Wikidata QIDs/review state, YouTube scene references, and playable scene rows in `src/data/movies.ts`.
- Prefer individually titled scene clips from official or established licensed channels; exclude trailers, promos, compilations, and full films. Keep each playable YouTube ID synchronized between `youtubeSceneCandidates` and `movieCatalog`.
- YouTube embeds expose titles and the overlay is best-effort. Do not download or re-host YouTube clips. Use `clipUrl` only for local clips with documented rights/source provenance.
- Keep the game client-side and lightweight unless the project requirements change.