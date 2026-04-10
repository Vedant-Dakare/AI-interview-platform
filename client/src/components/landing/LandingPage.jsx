import TopNavBar from './TopNavBar'
import HeroSection from './HeroSection'
import FeaturesSection from './FeaturesSection'
import CtaSection from './CtaSection'
import SiteFooter from './SiteFooter'

function LandingPage({ onOpenInterview, onOpenLogin }) {
  return (
    <div className="landing-page">
      <TopNavBar onGetDemo={onOpenInterview} onSignIn={onOpenLogin} />
      <main>
        <HeroSection />
        <FeaturesSection />
        <CtaSection onViewDemo={onOpenInterview} />
      </main>
      <SiteFooter />
    </div>
  )
}

export default LandingPage
