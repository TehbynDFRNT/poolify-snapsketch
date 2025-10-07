import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { useEffect, useState } from "react";

export function LandingPage() {
  const navigate = useNavigate();
  const [isScrolled, setIsScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 50);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const fadeInUp = {
    hidden: { opacity: 0, y: 20 },
    visible: { opacity: 1, y: 0 }
  };

  const staggerContainer = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.2
      }
    }
  };

  return (
    <div className="min-h-screen">
      {/* Header */}
      <header className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
        isScrolled ? 'bg-white shadow-md' : 'bg-transparent'
      }`}>
        <div className="max-w-7xl mx-auto px-6 py-4 flex justify-between items-center">
          <div className={`text-2xl font-bold transition-colors ${
            isScrolled ? 'text-purple-600' : 'text-white'
          }`}>
            🏊 SnapSketch
          </div>
          <nav className="flex gap-6 items-center">
            <a href="#features" className={`transition-colors hover:text-purple-600 ${
              isScrolled ? 'text-gray-700' : 'text-white'
            }`}>Features</a>
            <a href="#benefits" className={`transition-colors hover:text-purple-600 ${
              isScrolled ? 'text-gray-700' : 'text-white'
            }`}>Benefits</a>
            <Button 
              onClick={() => navigate('/signup')}
              variant="default"
              className={isScrolled 
                ? "bg-purple-600 text-white hover:bg-purple-700" 
                : "bg-white text-purple-600 hover:bg-white/90"}
            >
              Get Started
            </Button>
          </nav>
        </div>
      </header>

      {/* Hero Section */}
      <section className="relative min-h-screen flex items-center justify-center overflow-hidden bg-gradient-to-br from-purple-600 via-indigo-600 to-purple-700">
        {/* Grid overlay pattern */}
        <div className="absolute inset-0 opacity-10" style={{
          backgroundImage: 'linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)',
          backgroundSize: '50px 50px'
        }} />
        
        <motion.div 
          initial="hidden"
          animate="visible"
          variants={fadeInUp}
          transition={{ duration: 0.8 }}
          className="relative z-10 max-w-5xl mx-auto px-6 text-center"
        >
          <h1 className="text-5xl md:text-7xl font-extrabold text-white leading-tight mb-6">
            Design Professional Pool Layouts<br />in 10 Minutes
          </h1>
          <p className="text-xl md:text-2xl text-white/95 mb-12 max-w-4xl mx-auto leading-relaxed">
            SnapSketch gives your sales team the power of CAD without the complexity. 
            Drop components, drag to fill, export perfect PDFs—all at true 1:100 scale.
          </p>
          <Button 
            onClick={() => navigate('/signup')}
            size="lg"
            className="bg-white text-purple-600 hover:bg-white/90 shadow-2xl px-12 py-6 text-lg font-bold rounded-full transform hover:-translate-y-1 transition-all duration-300"
          >
            Get Started
          </Button>
        </motion.div>
      </section>

      {/* Pain Points Section */}
      <section id="pain-points" className="py-20 bg-gray-50">
        <div className="max-w-7xl mx-auto px-6">
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            variants={fadeInUp}
            className="text-center mb-16"
          >
            <h2 className="text-4xl md:text-5xl font-bold text-gray-900 mb-4">
              The Industry Standard Is Slow
            </h2>
            <p className="text-xl text-gray-600 max-w-3xl mx-auto">
              Sales reps sketch on paper. Design teams redraw in CAD. Customers wait days.
            </p>
          </motion.div>

          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            variants={staggerContainer}
            className="grid md:grid-cols-2 lg:grid-cols-3 gap-8"
          >
            <motion.div variants={fadeInUp} className="bg-white rounded-xl p-8 shadow-sm hover:shadow-lg transition-all duration-300 border-l-4 border-red-500">
              <div className="text-5xl mb-4">⏱️</div>
              <h3 className="text-2xl font-bold text-red-500 mb-4">30+ Minutes Per Sketch</h3>
              <p className="text-gray-600 leading-relaxed">
                Sales appointments bog down with manual sketching, photo markup, and rough measurements on graph paper.
              </p>
            </motion.div>

            <motion.div variants={fadeInUp} className="bg-white rounded-xl p-8 shadow-sm hover:shadow-lg transition-all duration-300 border-l-4 border-red-500">
              <div className="text-5xl mb-4">🔄</div>
              <h3 className="text-2xl font-bold text-red-500 mb-4">Lost in Translation</h3>
              <p className="text-gray-600 leading-relaxed">
                Design teams spend hours redrawing rough sketches. Measurements go missing. Details get confused in handoff.
              </p>
            </motion.div>

            <motion.div variants={fadeInUp} className="bg-white rounded-xl p-8 shadow-sm hover:shadow-lg transition-all duration-300 border-l-4 border-red-500">
              <div className="text-5xl mb-4">😤</div>
              <h3 className="text-2xl font-bold text-red-500 mb-4">Customers Wait</h3>
              <p className="text-gray-600 leading-relaxed">
                Days pass between site visit and final design. Momentum dies. Competitors move faster.
              </p>
            </motion.div>
          </motion.div>
        </div>
      </section>

      {/* Solution/Features Section */}
      <section id="features" className="py-20 bg-white">
        <div className="max-w-7xl mx-auto px-6">
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            variants={fadeInUp}
            className="text-center mb-16"
          >
            <h2 className="text-4xl md:text-5xl font-bold text-gray-900 mb-4">
              Component-Based Design at Scale
            </h2>
            <p className="text-xl text-gray-600 max-w-3xl mx-auto">
              Professional CAD output with drag-and-drop simplicity
            </p>
          </motion.div>

          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            variants={staggerContainer}
            className="grid md:grid-cols-2 lg:grid-cols-4 gap-10"
          >
            <motion.div variants={fadeInUp} className="text-center p-8">
              <div className="text-6xl mb-6">🏊</div>
              <h3 className="text-2xl font-bold text-purple-600 mb-4">Real Products, Real Scale</h3>
              <p className="text-gray-600 leading-relaxed">
                Place actual pool models at perfect 1:100 scale. Empire 6×3m appears exactly 6000×3000mm on your plan.
              </p>
            </motion.div>

            <motion.div variants={fadeInUp} className="text-center p-8">
              <div className="text-6xl mb-6">⬛</div>
              <h3 className="text-2xl font-bold text-purple-600 mb-4">Drag-to-Replicate</h3>
              <p className="text-gray-600 leading-relaxed">
                Drop a paver, drag the handle to fill an area. Watch it multiply with live counts: '24 pavers = 3.84m²'
              </p>
            </motion.div>

            <motion.div variants={fadeInUp} className="text-center p-8">
              <div className="text-6xl mb-6">💧</div>
              <h3 className="text-2xl font-bold text-purple-600 mb-4">Extend in Real-Time</h3>
              <p className="text-gray-600 leading-relaxed">
                Drainage lines, pool fencing, retaining walls—drag to extend with measurements updating live as you work.
              </p>
            </motion.div>

            <motion.div variants={fadeInUp} className="text-center p-8">
              <div className="text-6xl mb-6">📐</div>
              <h3 className="text-2xl font-bold text-purple-600 mb-4">Auto-Calculate Everything</h3>
              <p className="text-gray-600 leading-relaxed">
                Material counts, square meters, linear meters—all calculated automatically from your layout.
              </p>
            </motion.div>
          </motion.div>
        </div>
      </section>

      {/* Demo/Output Section */}
      <section className="py-20 bg-gradient-to-br from-purple-600 via-indigo-600 to-purple-700 relative overflow-hidden">
        <div className="absolute inset-0 opacity-10" style={{
          backgroundImage: 'linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)',
          backgroundSize: '50px 50px'
        }} />
        
        <div className="relative z-10 max-w-6xl mx-auto px-6">
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            variants={fadeInUp}
            className="text-center mb-12"
          >
            <h2 className="text-4xl md:text-5xl font-bold text-white mb-4">
              Hand Them a Professional Plan
            </h2>
            <p className="text-xl text-white/90">
              Before you leave the backyard
            </p>
          </motion.div>

          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            variants={fadeInUp}
            className="bg-white/10 backdrop-blur-md border-2 border-white/20 rounded-2xl p-12 shadow-2xl"
          >
            <h3 className="text-2xl font-bold text-white text-center mb-12">
              Every Design You Create:
            </h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
              <div>
                <div className="text-5xl font-extrabold text-white mb-2">1:100</div>
                <div className="text-lg text-white/80">Perfect Scale</div>
              </div>
              <div>
                <div className="text-5xl font-extrabold text-white mb-2">PDF</div>
                <div className="text-lg text-white/80">Ready to Print</div>
              </div>
              <div>
                <div className="text-5xl font-extrabold text-white mb-2">✓</div>
                <div className="text-lg text-white/80">Auto Legend</div>
              </div>
              <div>
                <div className="text-5xl font-extrabold text-white mb-2">✓</div>
                <div className="text-lg text-white/80">All Materials</div>
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Impact/Benefits Section */}
      <section id="benefits" className="py-20 bg-gray-50">
        <div className="max-w-7xl mx-auto px-6">
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            variants={fadeInUp}
            className="text-center mb-16"
          >
            <h2 className="text-4xl md:text-5xl font-bold text-gray-900 mb-4">
              Transform Your Sales Process
            </h2>
            <p className="text-xl text-gray-600 max-w-3xl mx-auto">
              Speed, accuracy, and professionalism at every appointment
            </p>
          </motion.div>

          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            variants={staggerContainer}
            className="grid md:grid-cols-2 lg:grid-cols-4 gap-8"
          >
            <motion.div variants={fadeInUp} className="bg-white rounded-xl p-8 shadow-sm hover:shadow-lg transition-all duration-300 border-t-4 border-green-500">
              <h3 className="text-2xl font-bold text-green-600 mb-4">⚡ 70% Faster</h3>
              <p className="text-gray-600 leading-relaxed">
                What took 30 minutes now takes 10. More appointments per day, more time building customer relationships.
              </p>
            </motion.div>

            <motion.div variants={fadeInUp} className="bg-white rounded-xl p-8 shadow-sm hover:shadow-lg transition-all duration-300 border-t-4 border-green-500">
              <h3 className="text-2xl font-bold text-green-600 mb-4">🎯 Zero Translation Errors</h3>
              <p className="text-gray-600 leading-relaxed">
                Design team receives complete, accurate plans. No redrawing. No guesswork. No lost measurements.
              </p>
            </motion.div>

            <motion.div variants={fadeInUp} className="bg-white rounded-xl p-8 shadow-sm hover:shadow-lg transition-all duration-300 border-t-4 border-green-500">
              <h3 className="text-2xl font-bold text-green-600 mb-4">🤝 Close On-Site</h3>
              <p className="text-gray-600 leading-relaxed">
                Show customers a professional design before you leave their backyard. Strike while momentum is hot.
              </p>
            </motion.div>

            <motion.div variants={fadeInUp} className="bg-white rounded-xl p-8 shadow-sm hover:shadow-lg transition-all duration-300 border-t-4 border-green-500">
              <h3 className="text-2xl font-bold text-green-600 mb-4">🔗 Seamless Handoff</h3>
              <p className="text-gray-600 leading-relaxed">
                Perfect data flows from sales to design to installation. One source of truth for the entire project.
              </p>
            </motion.div>
          </motion.div>
        </div>
      </section>

      {/* Final CTA Section */}
      <section className="py-24 bg-gray-900 text-white text-center relative overflow-hidden">
        {/* Subtle dot pattern */}
        <div className="absolute inset-0 opacity-5" style={{
          backgroundImage: 'radial-gradient(circle, white 1px, transparent 1px)',
          backgroundSize: '30px 30px'
        }} />
        
        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true }}
          variants={fadeInUp}
          className="relative z-10 max-w-4xl mx-auto px-6"
        >
          <h2 className="text-4xl md:text-5xl font-bold mb-6">
            Ready to Transform Your Process?
          </h2>
          <p className="text-xl text-white/80 mb-12">
            Start creating professional pool designs in minutes.
          </p>
          <Button 
            onClick={() => navigate('/signup')}
            size="lg"
            className="bg-purple-600 hover:bg-purple-700 text-white shadow-2xl shadow-purple-500/50 px-12 py-6 text-lg font-bold rounded-full transform hover:-translate-y-1 hover:shadow-purple-500/70 transition-all duration-300"
          >
            Get Started
          </Button>
          <p className="text-sm text-white/50 mt-8">
            Used by leading pool companies across Australia
          </p>
        </motion.div>
      </section>

      {/* Footer */}
      <footer className="bg-gray-950 text-white/60 py-8">
        <div className="max-w-7xl mx-auto px-6 text-center">
          <p className="text-sm">
            © 2025 SnapSketch. Professional pool design tool for modern sales teams.
          </p>
        </div>
      </footer>
    </div>
  );
}
