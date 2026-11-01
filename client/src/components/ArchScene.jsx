import './ArchScene.css'

/**
 * Illustration décorative : une vue de Sidi Bou Saïd dans une arche
 * (ciel, soleil, mer, mur blanc, porte bleue, bougainvillier).
 * Formes SVG simples ; couleurs tirées des variables --scene-* (suivent le thème).
 * `children` permet de poser un élément par-dessus (ex. « 404 » sur la page d'erreur).
 */
export default function ArchScene({ className = '', children }) {
  return (
    <div className={`arch-scene ${className}`.trim()}>
      <div className="arch-scene__frame arche">
        <svg
          viewBox="0 0 400 500"
          preserveAspectRatio="xMidYMid slice"
          aria-hidden="true"
          focusable="false"
        >
          <rect className="scene-ciel" width="400" height="500" />
          <circle className="scene-soleil arch-scene__sun" cx="290" cy="150" r="46" />
          <rect className="scene-mer" y="300" width="400" height="200" />
          <path
            className="scene-lagune"
            d="M0 330c50-14 100-14 150 0s100 14 150 0 75-10 100-6v40H0z"
            opacity="0.7"
          />
          <path className="scene-sable" d="M0 440c90-26 220-30 400-8v68H0z" />

          {/* Maison blanche à coupole */}
          <path className="scene-mur" d="M60 250a50 50 0 0 1 100 0z" />
          <rect className="scene-mur" x="40" y="250" width="230" height="250" />
          <path className="scene-porte" d="M115 500V410a40 40 0 0 1 80 0v90z" />
          <path className="scene-porte" d="M210 340v-34a16 16 0 0 1 32 0v34z" />
          <rect className="scene-porte" x="206" y="340" width="40" height="6" rx="3" />

          {/* Bougainvillier */}
          <g className="arch-scene__fleurs">
            <circle className="scene-vegetal" cx="262" cy="262" r="20" />
            <circle className="scene-fleur" cx="250" cy="246" r="18" />
            <circle className="scene-fleur" cx="276" cy="240" r="16" />
            <circle className="scene-fleur" cx="288" cy="268" r="15" />
            <circle className="scene-vegetal" cx="296" cy="292" r="10" />
            <circle className="scene-fleur" cx="270" cy="290" r="12" />
            <circle className="scene-fleur" cx="286" cy="314" r="9" />
          </g>
        </svg>
      </div>
      {children}
    </div>
  )
}
