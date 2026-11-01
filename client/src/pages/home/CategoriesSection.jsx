import Icon from '../../components/Icon.jsx'
import { CATEGORIES } from '../../data/categories.js'

export default function CategoriesSection() {
  return (
    <section className="section section--alt" aria-labelledby="categories-titre">
      <div className="container">
        <div className="section-head">
          <p className="surtitre">Sur la carte</p>
          <h2 id="categories-titre" className="titre-1">
            Tout pour votre séjour
          </h2>
          <p className="texte-l">
            Six types d’adresses, publiées par des prestataires locaux et notées par les voyageurs.
          </p>
        </div>

        <ul role="list" className="grille-categories">
          {CATEGORIES.map((category) => (
            <li
              key={category.type}
              className="categorie"
              style={{ '--categorie-couleur': `var(${category.color})` }}
            >
              <span className="categorie__icon arche">
                <Icon icon={category.icon} size={26} />
              </span>
              <h3 className="titre-4">{category.title}</h3>
              <p className="texte-s">{category.text}</p>
            </li>
          ))}
        </ul>
      </div>
    </section>
  )
}
