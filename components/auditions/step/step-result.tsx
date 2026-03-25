"use client";



import ReactMarkdown from "react-markdown";



interface Section {

  title: string;

  items: string[];

}



interface StepResultProps {

  data: {

    intro?: string;

    sections: Section[];

    outro?: string;

  };

}



export function StepResult({ data }: StepResultProps) {

  if (!data || !data.sections) return null;



  return (

    <div className="w-full max-w-6xl mx-auto space-y-6 overflow-y-auto max-h-[75vh] custom-scrollbar pr-2 pb-12">

     

      {/* Introductory block */}

      {data.intro && (

        <div className="rounded-2xl bg-[#424842] shadow-lg p-6 sm:p-8 text-[#EADDCE] border-l-4 border-[#FF7316]">

          <div className="prose prose-invert max-w-none prose-p:text-lg prose-p:italic prose-p:leading-relaxed prose-strong:text-[#FF7316] prose-p:m-0">

            <ReactMarkdown>{data.intro}</ReactMarkdown>

          </div>

        </div>

      )}



      {/* GRID SECTIONS */}

      <div className="grid grid-cols-1 gap-6">

        {data.sections.map((section, idx) => (

          <div key={idx} className="rounded-2xl bg-[#424842] shadow-lg p-6 sm:p-8 border border-[#B7BCB6]/10">

           

            <h3 className="text-xl font-serif text-[#FF7316] mb-5">{section.title}</h3>

           

            <ul className="space-y-5">

              {section.items.map((item, i) => (

                <li key={i} className="flex items-start text-[#B7BCB6] text-sm md:text-base leading-relaxed">

                  {/* Orange Bullet Point */}

                  <span className="mr-3 text-[#FF7316] mt-[2px] opacity-70 flex-shrink-0">•</span>

                 

                  {/*  Markdown renderer */}

                  <div className="prose prose-invert max-w-none prose-p:m-0 prose-p:inline prose-strong:text-[#F5F0E8] prose-strong:font-semibold">

                    <ReactMarkdown>{item}</ReactMarkdown>

                  </div>

                </li>

              ))}

            </ul>



          </div>

        ))}

      </div>



      {data.outro && (

        <div className="rounded-2xl bg-[#2C3328] shadow-lg p-6 sm:p-8 text-[#B7BCB6] text-center border border-[#B7BCB6]/10">

          <div className="prose prose-invert max-w-none prose-p:italic prose-p:m-0 prose-strong:text-[#FF7316]">

            <ReactMarkdown>{data.outro}</ReactMarkdown>

          </div>

        </div>

      )}



    </div>

  );

}