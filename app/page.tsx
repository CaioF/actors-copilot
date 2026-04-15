import Link from "next/link"
import Image from "next/image"

/**
 * Start emblem component that displays the app logo as a clickable link to the dashboard.
 * Features a hover scale animation for interactive feedback.
 * @returns Link component containing the app logo image
 */
function StartEmblem() {
  return (
    <Link
      href="/dashboard"
      className="group relative flex items-center justify-center transition-transform hover:scale-105"
      aria-label="Start - Enter Dashboard"
    >
      <div className="relative h-50 w-50 md:h-62.5 md:w-62.5">
        <Image 
          src="/image.png" 
          alt="The Actors Copilot" 
          fill
          className="object-contain" 
          priority 
        />
      </div>
    </Link>
  )
}

/**
 * Welcome page component displaying the landing page for The Actors Copilot.
 * Shows animated background effects and a logo link to the dashboard.
 * @returns The welcome page with branding and navigation
 */
export default function WelcomePage() {
  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden bg-[#152323]">
      
      <div
        className="pointer-events-none absolute top-[20%] left-[-15%] h-[600px] w-[600px] rounded-full opacity-40 blur-[120px] md:h-[800px] md:w-[800px]"
        style={{
          background: "radial-gradient(circle, rgba(160, 190, 190, 0.5) 30%, transparent 90%)",
        }}
      />

      <div
        className="pointer-events-none absolute top-[-10%] right-[-10%] h-[700px] w-[700px] rounded-full opacity-50 blur-[130px] md:h-[900px] md:w-[900px]"
        style={{
          background: "radial-gradient(circle, rgba(255, 230, 170, 0.4) 0%, transparent 60%)",
        }}
      />

      <div
        className="pointer-events-none absolute top-[-5%] right-[-5%] h-[300px] w-[400px] rotate-[-15deg] opacity-70 blur-[90px] md:h-[400px] md:w-[500px]"
        style={{
          background: "linear-gradient(135deg, rgba(255, 250, 230, 1) 0%, rgba(255, 210, 140, 0.6) 50%, transparent 100%)",
          borderRadius: "40px"
        }}
      />

      {/* spotlight group */}
      <div className="pointer-events-none absolute right-[-25%] md:right-[0%] top-[0%] h-screen w-[450px] md:w-[600px] z-0">
        
        {/* Main light */}
        <div
          className="absolute top-[8%] md:top-[12%] left-[10%] h-75 w-87.5 md:h-100 md:w-112.5 rotate-[-15deg] opacity-70 blur-[70px] z-20"
          style={{
            background: "linear-gradient(135deg, rgba(255, 255, 255, 1) 0%, rgba(255, 230, 180, 0.8) 40%, transparent 100%)",
            borderRadius: "40px"
          }}
        />

        <div className="relative h-full w-full z-10 opacity-95">
          <Image
            src="/spotlight.png" 
            alt="Holofote de Estúdio"
            fill
            className="object-contain object-top"
            priority
          />
        </div>
      </div>

      {/* Container main */}
      <div className="relative z-10 flex flex-col items-center gap-10">
        
        <div className="flex flex-col items-center text-center">
          <h1 className="font-title text-5xl md:text-7xl text-[#EFEADD] tracking-wide">
            Welcome to
          </h1>
          
          <h2 className="font-title mt-[-4px] mb-[-4px] text-6xl md:text-9xl font-bold text-[#F2671A] leading-[0.9] tracking-wider">
            The Actors Copilot
          </h2>
          
          <h3 className="font-title text-5xl md:text-7xl text-[#EFEADD] tracking-wide mt-4 italic">
            your <span className="text-[#F2671A]"> acting </span>assistant
          </h3>
        </div>

        {/* button */}
        <StartEmblem />
      </div>
      {/* Stage floor gradient to ground the spotlight and create depth */}
      <div
        className="pointer-events-none absolute bottom-0 left-0 w-full h-[6vh] md:h-[8vh] z-[5]"
        style={{
          background: `
            radial-gradient(ellipse at 80% 0%, rgba(220, 200, 150, 0.25) 0%, transparent 50%),
            linear-gradient(to bottom, rgba(15, 20, 20, 0.9) 40%, #000000 100%)
          `,
          borderTop: "1px solid rgba(15, 20, 20, 1) ",
          boxShadow: "0px -5px 10px rgba(15, 20, 20, 0.9)"
        }}
      />
    </div>
  
  )
}