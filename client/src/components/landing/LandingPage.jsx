import TopNavBar from './TopNavBar'
import HeroSection from './HeroSection'
import FeaturesSection from './FeaturesSection'
import CtaSection from './CtaSection'
import SiteFooter from './SiteFooter'
import InteractiveBackground from './motion/InteractiveBackground'
import CursorParticles from './motion/CursorParticles'

function LandingPage({ onOpenLogin, onOpenApply }) {
  return (
    <div className="landing-page">
      <div className="landing-backdrop" aria-hidden="true">
        <div className="backdrop-grid" />
        <div className="backdrop-glow glow-one" />
        <div className="backdrop-glow glow-two" />
        <div className="backdrop-glow glow-three" />
        <InteractiveBackground />
        <CursorParticles />
        <div className="backdrop-noise" />
      </div>
      <TopNavBar onSignIn={onOpenLogin} />
      <main className="landing-main">
        <HeroSection />
        <FeaturesSection />
        <CtaSection onRequestAccess={onOpenApply} />
      </main>
      <SiteFooter />
    </div>
  )
}

export default LandingPage
