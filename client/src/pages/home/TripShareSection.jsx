import { CalendarRange, Clock, EyeOff, MapPin, ShieldCheck, UsersRound } from 'lucide-react'
import Button from '../../components/Button.jsx'
import Icon from '../../components/Icon.jsx'

const POINTS = [
  { icon: UsersRound, text: 'Publiez votre destination et vos dates, et voyez qui part au même moment.' },
  { icon: EyeOff, text: 'Choisissez ce que les autres voient : profil, ville, langues, photo.' },
  { icon: ShieldCheck, text: 'Votre e-mail et votre téléphone ne sont jamais affichés.' },
  { icon: Clock, text: 'Votre annonce disparaît d’elle-même après votre retour.' },
]

export default function TripShareSection() {
  return (
    <section className="section" aria-labelledby="partage-titre">
      <div className="container partage">
        <div className="partage__texte">
          <div className="section-head">
            <p className="surtitre">Partage de voyage</p>
            <h2 id="partage-titre" className="titre-1">
              Ne voyagez plus seul·e
            </h2>
            <p className="texte-l">
              Un louage à partager, une sortie en kayak à plusieurs, une soirée au festival :
              partagez votre déplacement, si vous le souhaitez, pour rencontrer d’autres voyageurs.
            </p>
          </div>

          <ul role="list" className="liste-points">
            {POINTS.map((point) => (
              <li key={point.text}>
                <span className="liste-points__icon">
                  <Icon icon={point.icon} size={20} />
                </span>
                {point.text}
              </li>
            ))}
          </ul>

          <Button to="/partage" variant="primary" size="lg">
            Découvrir le partage de voyage
          </Button>
        </div>

        {/* Exemple fictif d'annonce, purement illustratif. */}
        <div className="partage__exemple" aria-hidden="true">
          <div className="annonce">
            <div className="annonce__entete">
              <span className="annonce__avatar arche">A</span>
              <div>
                <p className="titre-4">Amel</p>
                <p className="texte-s annonce__profil">Étudiante · Tunis</p>
              </div>
            </div>
            <p className="annonce__ligne">
              <Icon icon={MapPin} size={18} /> Djerba
            </p>
            <p className="annonce__ligne">
              <Icon icon={CalendarRange} size={18} /> Du 12 au 15 décembre
            </p>
            <p className="annonce__message texte-s">
              « Quelqu’un pour partager un louage depuis Tunis et visiter Houmt Souk ? »
            </p>
            <div className="annonce__tags">
              <span className="tag">Français</span>
              <span className="tag">Arabe</span>
              <span className="tag">Anglais</span>
            </div>
          </div>
          <div className="annonce annonce--fond" />
        </div>
      </div>
    </section>
  )
}
