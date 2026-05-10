import TopNavBar from './TopNavBar'
import HeroSection from './HeroSection'
import FeaturesSection from './FeaturesSection'
import CtaSection from './CtaSection'
import SiteFooter from './SiteFooter'

function LandingPage({ onOpenInterview, onOpenLogin, onOpenApply }) {
  return (
    <div className="landing-page">
      <div className="landing-backdrop" aria-hidden="true">
        <div className="backdrop-grid" />
        <div className="backdrop-glow glow-one" />
        <div className="backdrop-glow glow-two" />
        <div className="backdrop-glow glow-three" />
        <div className="backdrop-noise" />
      </div>
      <TopNavBar onGetDemo={onOpenInterview} onSignIn={onOpenLogin} />
      <main className="landing-main">
        <HeroSection onStartInterview={onOpenInterview} />
        <FeaturesSection />
        <CtaSection onViewDemo={onOpenInterview} onRequestAccess={onOpenApply} />
      </main>
      <SiteFooter />
    </div>
  )
}

export default LandingPage
