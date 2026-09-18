import Image from "next/image";
import Link from "next/link";
import styles from "./page.module.css";
import PricingTable from "@/components/PricingTable";

export default function LandingPage() {
  return (
    <div className={styles.page}>
      {/* Navbar */}
      <nav className={styles.navbar}>
        <div className={styles.brand}>AdMage</div>
        <div className={styles.navLinks}>
          <Link href="/auth/login" className={styles.navLink}>Log In</Link>
          <Link href="/auth/register" className="btn-primary">Get Started</Link>
        </div>
      </nav>

      {/* Hero Section */}
      <section className={styles.hero}>
        <div className={styles.heroBgContainer}>
          <Image 
            src="/hero-bg.jpg" 
            alt="Abstract Glass Spheres" 
            fill
            style={{ objectFit: 'cover' }}
            priority
          />
        </div>
        
        <h1 className={`${styles.title} ${styles.float}`}>
          Create Cinematic Ads with <br />
          <span className={styles.gradientText}>Generative AI</span>
        </h1>
        <p className={`${styles.subtitle} ${styles.floatDelay}`}>
          Turn raw product photos into breathtaking campaigns and high-end video ads in seconds. Built for scale, designed for conversion.
        </p>
        
        <div className={styles.ctaGroup}>
          <Link href="/auth/register" className="btn-primary" style={{ padding: '1rem 2rem', fontSize: '1.125rem' }}>
            Start Generating for Free
          </Link>
          <Link href="#features" className={styles.btnSecondary} style={{ padding: '1rem 2rem', fontSize: '1.125rem' }}>
            Explore Features
          </Link>
        </div>
      </section>

      {/* Features Bento Grid */}
      <section id="features" className={styles.features}>
        <h2 className={styles.sectionTitle}>The Creative Engine</h2>
        <div className={styles.bentoGrid}>
          
          <div className={`${styles.bentoCard} ${styles.largeCard}`}>
            <h3>Cinematic Video Ads</h3>
            <p>Generate highly engaging, high-fidelity short-form videos perfectly tailored for TikTok, Instagram Reels, and YouTube Shorts from a single text prompt or reference image.</p>
          </div>
          
          <div className={`${styles.bentoCard} ${styles.mediumCard}`}>
            <h3>Refine & Upscale</h3>
            <p>Enhance raw assets with AI-driven upscaling and lighting adjustments to make your content pop.</p>
          </div>

          <div className={`${styles.bentoCard} ${styles.halfCard}`}>
            <h3>Product Shots</h3>
            <p>Place your product in incredibly realistic lifestyle environments without ever booking a studio.</p>
          </div>

          <div className={`${styles.bentoCard} ${styles.halfCard}`}>
            <h3>Campaign Concepts</h3>
            <p>Instantly ideate massive multi-channel visual campaigns in seconds to align your creative teams.</p>
          </div>

        </div>
      </section>

      {/* How It Works Section */}
      <section id="how-it-works" className={styles.howItWorks}>
        <h2 className={styles.sectionTitle}>How It Works</h2>
        <div className={styles.stepsGrid}>
          <div className={styles.stepCard}>
            <div className={styles.stepNumber}>01</div>
            <h3>Upload Asset</h3>
            <p>Upload a simple product photo or provide a text prompt detailing your vision.</p>
          </div>
          <div className={styles.stepCard}>
            <div className={styles.stepNumber}>02</div>
            <h3>AI Generation</h3>
            <p>Our engine processes the input, applying high-end cinematic lighting and composition.</p>
          </div>
          <div className={styles.stepCard}>
            <div className={styles.stepNumber}>03</div>
            <h3>Publish</h3>
            <p>Export the final pixel-perfect campaign image or video ad directly to your channels.</p>
          </div>
        </div>
      </section>

      {/* Pricing Section */}
      <section id="pricing" className={styles.pricing}>
        <h2 className={styles.sectionTitle}>Simple, Transparent Pricing</h2>
        <p className={styles.pricingSubtitle}>
          Every plan is one pool of credits &mdash; spend them on whatever you need. The table
          shows how far each plan goes at standard quality.
        </p>
        <PricingTable ctaHref="/auth/register" />
      </section>

      {/* FAQ Section */}
      <section id="faq" className={styles.faq}>
        <h2 className={styles.sectionTitle}>Frequently Asked Questions</h2>
        <div className={styles.faqList}>
          <div className={styles.faqItem}>
            <h3>What are Credits?</h3>
            <p>Credits are the currency used to generate content. Every plan includes a monthly pool you can spend across any feature &mdash; product shots, campaign images, refining, or video ads. Richer outputs like 4K and higher quality use more credits, and the exact amount is always shown before you generate, so nothing is ever spent by surprise.</p>
          </div>
          <div className={styles.faqItem}>
            <h3>Do I own the generated content?</h3>
            <p>Yes, you hold full commercial rights to any content generated using your paid credits on AdMage.</p>
          </div>
          <div className={styles.faqItem}>
            <h3>Can I integrate AdMage into my own app?</h3>
            <p>Yes, our Enterprise plan includes API access so you can programmatically generate assets at scale.</p>
          </div>
        </div>
      </section>
      
      {/* Footer */}
      <footer style={{ borderTop: '1px solid var(--glass-border)', padding: '3rem 2rem', textAlign: 'center', color: 'var(--text-secondary)' }}>
        <p>&copy; {new Date().getFullYear()} AdMage. All rights reserved.</p>
      </footer>
    </div>
  );
}
