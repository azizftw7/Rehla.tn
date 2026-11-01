import CategoriesSection from './CategoriesSection.jsx'
import DestinationsSection from './DestinationsSection.jsx'
import Hero from './Hero.jsx'
import ProviderSection from './ProviderSection.jsx'
import TripShareSection from './TripShareSection.jsx'
import './HomePage.css'

export default function HomePage() {
  return (
    <>
      <title>Rehla.tn — Toute la Tunisie, sur une seule carte</title>
      <Hero />
      <DestinationsSection />
      <CategoriesSection />
      <TripShareSection />
      <ProviderSection />
    </>
  )
}
