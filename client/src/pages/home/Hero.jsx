import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import ArchScene from '../../components/ArchScene.jsx'
import Icon from '../../components/Icon.jsx'
import SearchBar from '../../components/SearchBar.jsx'
import { CATEGORIES } from '../../data/categories.js'

export default function Hero() {
  const navigate = useNavigate()
  const [selectedTypes, setSelectedTypes] = useState([])

  const toggleType = (type) =>
    setSelectedTypes((types) =>
      types.includes(type) ? types.filter((t) => t !== type) : [...types, type],
    )

  // La page de résultats (/destinations) arrive dans une prochaine story.
  const search = (text) => {
    const params = new URLSearchParams()
    if (text) params.set('search', text)
    if (selectedTypes.length > 0) params.set('types', selectedTypes.join(','))
    const query = params.toString()
    navigate(query ? `/destinations?${query}` : '/destinations')
  }

  return (
    <section className="hero" aria-labelledby="hero-titre">
      <div className="container hero__inner">
        <div className="hero__content">
          <p className="surtitre hero__surtitre">Préparez votre déplacement en Tunisie</p>
          <h1 id="hero-titre" className="hero__titre">
            Toute la Tunisie, sur une seule carte
          </h1>
          <p className="texte-l hero__intro">
            Hébergements, restaurants, activités, événements, transports et guides locaux :
            repérez tout ce qui vous attend autour de votre destination, gardez vos favoris et
            trouvez des compagnons de route.
          </p>

          <SearchBar size="lg" inputId="recherche" onSearch={search} />

          <div className="hero__filtres" role="group" aria-label="Filtres rapides par type">
            {CATEGORIES.map((category) => {
              const selected = selectedTypes.includes(category.type)
              return (
                <button
                  key={category.type}
                  type="button"
                  className="chip"
                  aria-pressed={selected}
                  onClick={() => toggleType(category.type)}
                  style={{ '--chip-couleur': `var(${category.color})` }}
                >
                  <Icon icon={category.icon} size={18} className="chip__icon" />
                  {category.label}
                </button>
              )
            })}
          </div>
        </div>

        <ArchScene className="hero__illustration" />
      </div>
    </section>
  )
}
