"use client";

import { useState, useRef } from "react";
import { UploadCloud, FileText, X } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface StepUploadProps {
  title: string;
  description: string;
  file: File | null;
  text: string;
  onFileChange: (file: File | null) => void;
  onTextChange: (text: string) => void;
}

/**
 * StepUpload Component
 * Renders a file upload zone with drag-and-drop support and text input fallback.
 * Used for uploading sides and character briefs in the audition wizard.
 * @param title - Section title
 * @param description - Section description
 * @param file - Currently selected file or null
 * @param text - Currently entered text or empty string
 * @param onFileChange - Callback when file changes
 * @param onTextChange - Callback when text changes
 */
export function StepUpload({ title, description, file, text, onFileChange, onTextChange }: StepUploadProps) {
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  // Previne o comportamento padrão do navegador de abrir o arquivo
  /**
   * Handles drag-over event to indicate a valid drop zone.
   * @param e - DragEvent from the drag operation
   */
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  /**
   * Handles drag-leave event when user exits the drop zone.
   * @param e - DragEvent from the drag operation
   */
  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  /**
   * Handles the drop event when a file is dropped onto the upload zone.
   * Validates that dropped files are PDF or DOCX format.
   * @param e - DragEvent from the drop operation
   */
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const droppedFile = e.dataTransfer.files[0];
      
      const isPDF = droppedFile.type === "application/pdf";
      const isDocxType = droppedFile.type === "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
      const isDocxExt = droppedFile.name.toLowerCase().endsWith('.docx');

      if (isPDF || isDocxType || isDocxExt) {
        onFileChange(droppedFile);
      } else {
        toast({
          variant: "destructive",
          title: "That file type isn't supported",
          description: `We only read PDFs and Word documents (.docx). You dropped a ${droppedFile.type || "file"} called "${droppedFile.name}". Convert it to PDF or paste the text into the box below.`,
        });
      }
    }
  };

  /**
   * Handles file selection from the file input dialog.
   * Validates that selected files are PDF or DOCX format.
   * @param e - ChangeEvent from the file input
   */
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const selectedFile = e.target.files[0];

      const isPDF = selectedFile.type === "application/pdf";
      const isDocxType = selectedFile.type === "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
      const isDocxExt = selectedFile.name.toLowerCase().endsWith('.docx');

      if (isPDF || isDocxType || isDocxExt) {
        onFileChange(selectedFile);
      } else {
        toast({
          variant: "destructive",
          title: "That file type isn't supported",
          description: `We only read PDFs and Word documents (.docx). You selected a ${selectedFile.type || "file"} called "${selectedFile.name}". Convert it to PDF or paste the text into the box below.`,
        });
      }
      // Reset the input so the same file can be re-selected after rejection
      e.target.value = "";
    }
  };

  return (
    <div className="rounded-3xl font-sans bg-[#424842] shadow-2xl p-8 sm:p-12 text-[#EADDCE] w-full max-w-6xl mx-auto">
      
      {/* Header */}
      <div className="mb-8">
        <h2 className="text-2xl font-title font-medium text-[#EADDCE] mb-3">{title}</h2>
        <p className="text-[#B7BCB6] text-sm">{description}</p>
      </div>

      <div className="space-y-8">
        
        {/* ZONA DE DRAG & DROP */}
        {!file ? (
          <div
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            className={`border-2 border-dashed rounded-2xl p-10 flex flex-col items-center justify-center cursor-pointer transition-all duration-300
              ${isDragging 
                ? "border-[#FF7316] bg-[#FF7316]/10" 
                : "border-[#B7BCB6]/40 hover:border-[#FF7316]/60 hover:bg-[#2C3328]/20"
              }
            `}
          >
            <input
              type="file"
              accept=".pdf,.docx"
              className="hidden"
              ref={fileInputRef}
              onChange={handleFileSelect}
            />
            <div className="bg-[#EADDCE] p-4 rounded-full mb-4">
              <UploadCloud className="w-8 h-8 text-[#424842]" />
            </div>
            <p className="text-[#EADDCE] font-medium mb-1">
              Click to upload <span className="text-[#B7BCB6] font-normal">or drag and drop</span>
            </p>
            <p className="text-[#B7BCB6] text-xs">PDF or DOCX (max. 20MB)</p>
          </div>
        ) : (
          /* ARQUIVO SELECIONADO (PREVIEW) */
          <div className="border border-[#B7BCB6]/30 bg-[#2C3328]/30 rounded-2xl p-6 flex items-center justify-between">
            <div className="flex items-center gap-4 text-[#EADDCE]">
              <div className="bg-[#FF7316]/20 p-3 rounded-lg text-[#FF7316]">
                <FileText className="w-6 h-6" />
              </div>
              <div>
                <p className="font-medium truncate max-w-[200px] sm:max-w-md">{file.name}</p>
                <p className="text-xs text-[#B7BCB6]">{(file.size / 1024 / 1024).toFixed(2)} MB</p>
              </div>
            </div>
            <button 
              onClick={(e) => {
                e.stopPropagation(); // Evita abrir o seletor novamente
                onFileChange(null);
              }}
              className="text-[#B7BCB6] hover:text-[#FF7316] p-2 transition-colors"
              title="Remove file"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        )}

        {/* DIVISOR */}
        <div className="flex items-center gap-4">
          <div className="flex-1 h-[1px] bg-[#B7BCB6]/20"></div>
          <span className="text-[#B7BCB6] text-xs font-medium uppercase tracking-wider">or paste text</span>
          <div className="flex-1 h-[1px] bg-[#B7BCB6]/20"></div>
        </div>

        {/* text area */}
        <div>
          <textarea
            value={text}
            onChange={(e) => onTextChange(e.target.value)}
            placeholder="Paste your details here..."
            className="w-full bg-[#EADDCE] rounded-xl px-5 py-4 text-[#2C3328] placeholder:text-[#2C3328]/50 focus:outline-none focus:ring-2 focus:ring-[#FF7316] transition-all min-h-[160px] resize-y"
          />
        </div>

      </div>
    </div>
  );
}