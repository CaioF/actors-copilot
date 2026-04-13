interface PhotosSectionProps {
  photos: string[];
}

export function PhotosSection({ photos }: PhotosSectionProps) {
  return (
    <section>
      <SectionHeading title="Photos" />
      <div className="flex gap-3 overflow-x-auto pb-2">
        {photos.map((url, i) => (
          <div
            key={i}
            className="h-24 w-24 flex-shrink-0 overflow-hidden rounded-xl bg-[#555A4A]"
          >
            <img
              src={url}
              alt={`Photo ${i + 1}`}
              className="h-full w-full object-cover"
            />
          </div>
        ))}
      </div>
    </section>
  );
}

function SectionHeading({ title }: { title: string }) {
  return (
    <h2 className="mb-4 font-title text-xl font-bold text-[#212121]">
      {title}
    </h2>
  );
}
