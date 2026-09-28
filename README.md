# Moviester!

A lightweight movie-night guessing game. Watch a movie scene, guess the film, then reveal its title, release year, and director.

## Run locally

```sh
npm install
npm run dev
```

Open the local URL printed by Vite. To create a production build, run `npm run build`.

## Movie catalog

The local catalog in `src/data/movies.ts` contains a decade-balanced Wikidata snapshot from 1924-2026. Facts have stable QIDs and `metadataReviewed` flags. Review original release year, title, and director before treating draft records as verified. Multiple round records can point to one film when it has more than one scene.

The game currently has 200 playable videos: 194 YouTube scene embeds and six local clips. YouTube selections are individual scene clips, not trailers, promos, compilations, or full films. Multiple scenes can belong to a single film; the persistent deck deals each film once per cycle and picks one of its available scenes. Scene references and playable YouTube IDs are stored in the movie catalog.

The six local clips are *His Girl Friday* (1940), two excerpts from *The Gold Rush* (1925), two from *The General* (1926), and one from *The Phantom of the Opera* (1925). They live in `public/clips/`; the silent-film extracts have no audio track, avoiding unverified Archive-added scores. Their source items and time ranges are recorded in the catalog. The *Sherlock Jr.* lead (1924) remains research-only because its available copy has identifying text burned into the picture.

The play screen includes a **Mask YouTube title** switch, default off, that covers a fixed strip at the top of the embed. It is a best-effort overlay, not a guarantee: YouTube may place metadata elsewhere, and fullscreen escapes the mask. YouTube scene references are not permission to download or re-host video; embeds remain subject to YouTube's player and content terms.

Archive item pages show public-domain metadata, but this is not a legal determination for every copy or jurisdiction; verify the source print and soundtrack before distribution. Add local `clipUrl` records only with source, time-range, and rights provenance. Wikidata is the metadata origin; TMDB is not used.
