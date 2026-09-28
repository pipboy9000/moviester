import { useEffect, useRef, useState } from 'react'
import { movieCatalog, publicDomainSceneCandidates, type Movie } from './data/movies'
import './App.css'

type Screen = 'home' | 'play'
type MovieDeck = { drawPile: string[]; discardPile: string[] }

const youtubeMaskStorageKey = 'moviester-youtube-mask-enabled'
const movieDeckStorageKey = 'moviester-movie-deck-v1'

function shuffle<T>(items: T[]): T[] {
  const shuffled = [...items]
  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1))
    ;[shuffled[index], shuffled[swapIndex]] = [shuffled[swapIndex], shuffled[index]]
  }
  return shuffled
}

function loadMovieDeck(availableFilmIds: string[]): MovieDeck {
  try {
    const savedDeck = window.localStorage.getItem(movieDeckStorageKey)
    if (savedDeck) {
      const parsed: unknown = JSON.parse(savedDeck)
      if (
        typeof parsed === 'object' && parsed !== null &&
        'drawPile' in parsed && Array.isArray(parsed.drawPile) &&
        'discardPile' in parsed && Array.isArray(parsed.discardPile)
      ) {
        const availableIds = new Set(availableFilmIds)
        const drawPile = [...new Set(parsed.drawPile.filter((id): id is string => typeof id === 'string' && availableIds.has(id)))]
        const drawIds = new Set(drawPile)
        const discardPile = [...new Set(parsed.discardPile.filter((id): id is string => typeof id === 'string' && availableIds.has(id) && !drawIds.has(id)))]
        const accountedIds = new Set([...drawPile, ...discardPile])
        const newFilmIds = availableFilmIds.filter((id) => !accountedIds.has(id))
        return { drawPile: [...drawPile, ...shuffle(newFilmIds)], discardPile }
      }
    }
  } catch {
    return { drawPile: shuffle(availableFilmIds), discardPile: [] }
  }
  return { drawPile: shuffle(availableFilmIds), discardPile: [] }
}

function saveMovieDeck(deck: MovieDeck) {
  try {
    window.localStorage.setItem(movieDeckStorageKey, JSON.stringify(deck))
  } catch {
    // The game remains playable when browser storage is unavailable.
  }
}

function currentScreen(): Screen {
  return window.location.pathname === '/play' ? 'play' : 'home'
}

function App() {
  const uniqueMovies = [...new Map(movieCatalog.map((movie) => [movie.wikidataId, movie])).values()]
  const playableMovies = movieCatalog.filter((movie) => movie.clipUrl || movie.youtubeId)
  const moviesByWikidataId = new Map<string, Movie[]>()
  for (const movie of playableMovies) {
    const matchingMovies = moviesByWikidataId.get(movie.wikidataId) ?? []
    matchingMovies.push(movie)
    moviesByWikidataId.set(movie.wikidataId, matchingMovies)
  }
  const playableFilmIds = [...moviesByWikidataId.keys()]
  const [screen, setScreen] = useState<Screen>(currentScreen)
  const [activeMovie, setActiveMovie] = useState<Movie | null>(null)
  const [movieDeck, setMovieDeck] = useState<MovieDeck>(() => loadMovieDeck(playableFilmIds))
  const [answerVisible, setAnswerVisible] = useState(false)
  const [playbackBlocked, setPlaybackBlocked] = useState(false)
  const [youtubeMaskEnabled, setYoutubeMaskEnabled] = useState(() => {
    try {
      return window.localStorage.getItem(youtubeMaskStorageKey) === 'true'
    } catch {
      return false
    }
  })
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const moviesNeedingReview = uniqueMovies.filter((movie) => !movie.metadataReviewed).length

  useEffect(() => {
    const syncScreen = () => setScreen(currentScreen())
    window.addEventListener('popstate', syncScreen)
    return () => window.removeEventListener('popstate', syncScreen)
  }, [])

  useEffect(() => {
    try {
      window.localStorage.setItem(youtubeMaskStorageKey, String(youtubeMaskEnabled))
    } catch {
      // The toggle remains usable when browser storage is unavailable.
    }
  }, [youtubeMaskEnabled])

  function navigate(nextScreen: Screen) {
    const nextPath = nextScreen === 'play' ? '/play' : '/'
    if (window.location.pathname !== nextPath) {
      window.history.pushState({}, '', nextPath)
    }
    setScreen(nextScreen)
  }

  function pickMovie() {
    let drawPile = movieDeck.drawPile
    let discardPile = movieDeck.discardPile
    if (drawPile.length === 0) {
      if (discardPile.length === 0) return
      drawPile = shuffle(discardPile)
      discardPile = []
    }

    const [nextFilmId, ...remainingFilmIds] = drawPile
    if (!nextFilmId) return
    const sceneOptions = moviesByWikidataId.get(nextFilmId)
    if (!sceneOptions?.length) return
    const nextMovie = sceneOptions[Math.floor(Math.random() * sceneOptions.length)]
    const nextDeck = {
      drawPile: remainingFilmIds,
      discardPile: [...discardPile, nextFilmId],
    }

    setMovieDeck(nextDeck)
    saveMovieDeck(nextDeck)
    setActiveMovie(nextMovie)
    setAnswerVisible(false)
    setPlaybackBlocked(false)
  }

  function handleGameAction() {
    if (!activeMovie || answerVisible) {
      pickMovie()
      return
    }
    setAnswerVisible(true)
  }

  async function startClip() {
    const video = videoRef.current
    if (!video || !activeMovie) return

    try {
      await video.play()
      setPlaybackBlocked(false)
    } catch {
      setPlaybackBlocked(true)
    }
  }

  return (
    <main className="app-shell">
      <header className="topbar">
        <button className="wordmark" onClick={() => navigate('home')} aria-label="Moviester home">
          <span className="wordmark-mark" aria-hidden="true">M</span>
          <span>moviester<span className="wordmark-period">!</span></span>
        </button>
        <div className="topbar-right">
          <span className="edition-label">THE MOVIE NIGHT GAME</span>
          {screen === 'play' ? (
            <button className="text-link" onClick={() => navigate('home')}>How to play</button>
          ) : (
            <button className="text-link" onClick={() => navigate('play')}>Start a game <span aria-hidden="true">↗</span></button>
          )}
        </div>
      </header>

      {screen === 'home' ? (
        <section className="home-page">
          <div className="home-copy">
            <div className="eyebrow"><span className="eyebrow-line" /> A little test of your movie memory</div>
            <h1>Know the scene.<br /><span>Name the film.</span></h1>
            <p className="home-intro">A random movie moment. No title, no hints. Watch, guess, then see if you got it right.</p>
            <button className="primary-button home-cta" onClick={() => navigate('play')}>
              Start playing <span aria-hidden="true">↗</span>
            </button>
            <div className="home-note"><span className="live-dot" /> No accounts. Just good movies.</div>
          </div>

          <div className="reel-display" aria-label="A selection of films in the Moviester catalog">
            <div className="reel-heading"><span>ON THE BILL</span><span>VOL. 01</span></div>
            <div className="reel-stack">
              {movieCatalog.slice(2, 5).map((movie, index) => (
                <div className={`reel-card reel-card-${index + 1}`} key={movie.id}>
                  <div className="reel-card-shade" />
                  <span className="reel-card-year">{movie.year}</span>
                  <span className="reel-card-title">{movie.title}</span>
                  <span className="reel-card-mark" aria-hidden="true">✳</span>
                </div>
              ))}
            </div>
            <div className="reel-footer"><span>CLASSICS, CULT FAVORITES</span><span>& NEW OBSESSIONS</span></div>
          </div>

          <div className="how-section" id="how-to-play">
            <div className="how-title">
              <span className="section-kicker">HOW IT WORKS</span>
              <h2>Three steps.<br />One great movie night.</h2>
            </div>
            <ol className="steps-list">
              <li><span className="step-number">01</span><div><h3>Press next move</h3><p>A movie excerpt appears. Keep the title hidden from the room.</p></div></li>
              <li><span className="step-number">02</span><div><h3>Make your guess</h3><p>Play the clip, compare notes, and lock in your answer.</p></div></li>
              <li><span className="step-number">03</span><div><h3>Show the answer</h3><p>Reveal the film, release year, and director. Then go again.</p></div></li>
            </ol>
          </div>
          <footer className="page-footer"><span>MOVIE NIGHT, SORTED.</span><span>MADE FOR THE LOVE OF FILM <span className="footer-star">✳</span></span></footer>
        </section>
      ) : (
        <section className="play-page">
          <div className="play-heading">
            <div><span className="section-kicker">THE SCREENING ROOM</span><h1>Take your guess.</h1></div>
            <span className="round-label"><span className="live-dot" /> RANDOM ROUND</span>
          </div>

          <div className={`screening-stage${activeMovie ? ' has-movie' : ''}`}>
            {activeMovie ? (
              <>
                <div className={`video-frame${activeMovie.youtubeId ? ' is-youtube' : ''}`}>
                  {activeMovie.clipUrl ? (
                    <>
                      <video
                        key={activeMovie.id}
                        ref={videoRef}
                        src={activeMovie.clipUrl}
                        autoPlay
                        playsInline
                        preload="metadata"
                        onLoadedMetadata={(event) => {
                          void event.currentTarget.play().catch(() => setPlaybackBlocked(true))
                        }}
                      />
                      {playbackBlocked && (
                        <button className="clip-play-button" onClick={() => void startClip()} aria-label="Play movie scene">
                          <span aria-hidden="true">▶</span> Play scene
                        </button>
                      )}
                    </>
                  ) : activeMovie.youtubeId ? (
                    <>
                      <iframe
                        key={activeMovie.id}
                        src={`https://www.youtube-nocookie.com/embed/${activeMovie.youtubeId}?autoplay=1&playsinline=1&rel=0`}
                        title="Movie scene"
                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                        referrerPolicy="strict-origin-when-cross-origin"
                        allowFullScreen
                      />
                      {youtubeMaskEnabled && <div className="youtube-title-mask" aria-hidden="true" />}
                    </>
                  ) : null}
                  <div className="frame-caption"><span>SCENE NO. {String(activeMovie.id).padStart(2, '0')}</span><span>NO HINTS. JUST VIBES.</span></div>
                </div>
                {activeMovie.youtubeId && (
                  <label className="youtube-mask-toggle">
                    <input
                      type="checkbox"
                      checked={youtubeMaskEnabled}
                      onChange={(event) => setYoutubeMaskEnabled(event.target.checked)}
                    />
                    <span className="toggle-track" aria-hidden="true"><span className="toggle-thumb" /></span>
                    <span>Mask YouTube title</span>
                  </label>
                )}
                {answerVisible && (
                  <div className="answer-reveal" aria-live="polite">
                    <div className="answer-icon" aria-hidden="true">✳</div>
                    <div><span className="section-kicker">THE ANSWER</span><h2>{activeMovie.title}</h2><p>{activeMovie.year} <span className="answer-separator">/</span> Directed by {activeMovie.director}</p></div>
                    <span className="answer-year">{activeMovie.year}</span>
                  </div>
                )}
              </>
            ) : (
              <div className="empty-screen">
                <div className="projector-icon" aria-hidden="true"><span /><span /><span /></div>
                <span className="section-kicker">YOUR SCREEN IS READY</span>
                <h2>{playableMovies.length ? 'What movie is it?' : 'No spoiler-safe scenes yet'}</h2>
                <p>{playableMovies.length ? 'Hit next move to roll a scene from the catalog.' : `${publicDomainSceneCandidates.length} public-domain scene candidates have been researched. YouTube and Archive players expose the movie title; extract a short local clip to keep the answer hidden.`}</p>
              </div>
            )}
          </div>

          <div className="play-controls">
            <div className="play-prompt"><span className="prompt-star" aria-hidden="true">✳</span><span>{answerVisible ? 'Ready for another round?' : activeMovie ? 'Got a guess?' : 'Scene clips are being prepared.'}</span></div>
            <button className="primary-button play-cta" onClick={handleGameAction} disabled={!activeMovie && playableMovies.length === 0}>
              {!activeMovie || answerVisible ? (playableMovies.length ? 'Next move' : 'Clips coming soon') : 'Show answer'}
              <span aria-hidden="true">{!activeMovie || answerVisible ? '↗' : '✳'}</span>
            </button>
          </div>
          <div className="catalog-note"><span className="catalog-dot" /> {movieDeck.drawPile.length} movies in deck <span className="catalog-divider">/</span> {movieDeck.discardPile.length} discarded <span className="catalog-divider">/</span> {uniqueMovies.length} draft films <span className="catalog-divider">/</span> {moviesNeedingReview} need fact review <span className="catalog-divider">/</span> {publicDomainSceneCandidates.length} {publicDomainSceneCandidates.length === 1 ? 'scene lead' : 'scene leads'} <span className="catalog-divider">/</span> {playableMovies.filter((movie) => movie.youtubeId).length} YouTube videos <span className="catalog-divider">/</span> {playableMovies.filter((movie) => movie.clipUrl).length} local clips</div>
          <footer className="page-footer"><span>MOVIE NIGHT, SORTED.</span><span>TAKE YOUR TIME <span className="footer-star">✳</span></span></footer>
        </section>
      )}
    </main>
  )
}

export default App