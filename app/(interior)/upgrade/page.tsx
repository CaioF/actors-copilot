import Link from 'next/link';

export default function UpgradePage() {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-[#F5EFE6] px-4 text-center">
      <h1 className="text-4xl font-title text-[#2C3328] mb-4">
        Business Class Access Required
      </h1>
      <p className="text-[#646A64] max-w-md mb-8">
        You need the Business Class plan to access the AI Acting Coach and the deep Profile Analysis. Upgrade now to unlock your full potential!
      </p>
      
      <div className="flex gap-4 px-6 py-3 bg-[#FF7316] text-white font-medium rounded-full hover:bg-[#E5630F] shadow-md transition-all">
        <Link href="/dashboard" className="px-6 py-3 border border-[#C7C0B5] rounded-full text-[#646A64] hover:bg-[#E8DFD0] transition-colors">
          Back to Dashboard
        </Link>
        <a
          href="https://theactorscopilot.com/#pricing"
          target="_blank"
          rel="noopener noreferrer"
          className="px-6 py-3 bg-[#FF7316] text-white font-medium rounded-full hover:bg-[#E5630F] shadow-md transition-all"
        >
          View Subscription Options
        </a>
      </div>
    </div>
  );
}