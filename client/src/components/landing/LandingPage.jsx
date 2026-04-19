import TopNavBar from './TopNavBar'
import HeroSection from './HeroSection'
import FeaturesSection from './FeaturesSection'
import CtaSection from './CtaSection'
import SiteFooter from './SiteFooter'

function LandingPage({ onOpenInterview, onOpenLogin, onOpenApply }) {
  return (
    <div className="landing-page">
      <TopNavBar onGetDemo={onOpenInterview} onSignIn={onOpenLogin} />
      <main>
        <HeroSection onStartInterview={onOpenInterview} />
        <FeaturesSection />
        <CtaSection onViewDemo={onOpenInterview} onRequestAccess={onOpenApply} />
      </main>
      <SiteFooter />
    </div>
  )
}

export default LandingPage
