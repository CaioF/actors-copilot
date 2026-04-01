import Link from "next/link"
import Image from "next/image"

function StartEmblem() {
  return (
    <Link
      href="/dashboard"
      className="group relative flex h-[160px] w-[160px] items-center justify-center"
      aria-label="Start - Enter Dashboard"
    >
      {/* Outer ring */}
      <div className="absolute inset-0 rounded-full border-[3px] border-[#4A5548] shadow-[0_0_30px_rgba(232,114,26,0.15)] transition-shadow group-hover:shadow-[0_0_40px_rgba(232,114,26,0.35)]" />

      {/* Tick marks around the ring */}
      {Array.from({ length: 24 }).map((_, i) => {
        const angle = (i * 360) / 24
        const isMain = i % 6 === 0
        return (
          <div
            key={i}
            className="absolute"
            style={{
              transform: `rotate(${angle}deg) translateY(-74px)`,
              transformOrigin: "center center",
            }}
          >
            <div
              className={`mx-auto rounded-full bg-[#E8721A] ${
                isMain ? "h-2 w-[2px]" : "h-1 w-[1px]"
              }`}
            />
          </div>
        )
      })}

      {/* Rivet dots at N, E, S, W */}
      {[0, 90, 180, 270].map((angle) => (
        <div
          key={angle}
          className="absolute"
          style={{
            transform: `rotate(${angle}deg) translateY(-70px)`,
          }}
        >
          <div className="h-2 w-2 rounded-full bg-[#8B5E3C] shadow-inner" />
        </div>
      ))}

      {/* START HERE text - top */}
      <span className="absolute top-5 text-[8px] font-bold uppercase tracking-[0.2em] text-[#E8721A]">
        &#9670; start here &#9670;
      </span>

      {/* Logo */}
      <div className="flex items-center justify-center px-5 pt-6 pb-5">
        {/* We wrap the image in a Link so clicking the logo goes home. 
            Added a slight hover scale effect for interactivity */}
        <Link href="/dashboard" className="block transition-transform hover:scale-105">
          <Image 
            src="/logo.png" 
            alt="The Actors Copilot" 
            width={130} 
            height={130} 
            className="object-contain" // Ensures the image doesn't stretch or distort
            priority // Tells Next.js to load this immediately since it's above the fold
          />
        </Link>
      </div>

      {/* START HERE text - bottom */}
      <span className="absolute bottom-5 text-[8px] font-bold uppercase tracking-[0.2em] text-[#E8721A]">
        &#9670; enter &#9670;
      </span>
    </Link>
  )
}

export default function WelcomePage() {
  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden bg-gradient-to-br from-[#1A2F2F] to-[#0D1B1B]">
      {/* Warm stage-light glow */}
      <div
        className="pointer-events-none absolute top-[10%] right-[10%] h-[400px] w-[500px] rounded-[40%] opacity-30 blur-[100px]"
        style={{
          background: "radial-gradient(ellipse, rgba(255, 230, 180, 0.4) 0%, rgba(255, 200, 120, 0.1) 60%, transparent 100%)",
        }}
      />

      {/* Content */}
      <div className="relative z-10 flex flex-col items-center gap-10">
        {/* Title */}
        <div className="flex flex-col items-center gap-2 text-center">
          <h1 className="font-serif text-5xl italic text-[#F5F0E8] md:text-6xl">
            Welcome to
          </h1>
          <h2 className="font-serif text-6xl font-bold italic text-[#E8721A] md:text-7xl">
            The Actors Copilot
          </h2>
          <h3 className="font-serif text-5xl italic text-[#F5F0E8] md:text-6xl">
            your acting assistant
          </h3>
        </div>

        {/* Start Emblem */}
        <StartEmblem />
      </div>
    </div>
  )
}
