interface TrainingItem {
  institution: string;
  qualification: string;
  years: string;
  category: string;
}

interface TrainingSectionProps {
  training: TrainingItem[];
}

export function TrainingSection({ training }: TrainingSectionProps) {
  return (
    <section>
      <h2 className="mb-4 font-title text-xl font-bold text-[#212121]">Training</h2>
      <div className="space-y-3">
        {training.map((item, i) => (
          <div key={i} className="flex items-start gap-3">
            <div className="mt-2 h-2 w-2 flex-shrink-0 rounded-full bg-[#494E3E]" />
            <p className="text-sm">
              <span className="font-semibold text-[#212121]">
                {item.institution}
              </span>
              {item.qualification && (
                <span className="text-[#7E7E7E]"> — {item.qualification}</span>
              )}
              {item.years && (
                <span className="text-[#7E7E7E]"> ({item.years})</span>
              )}
            </p>
          </div>
        ))}
      </div>
    </section>
  );
}
