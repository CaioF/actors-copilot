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
 * Uses semantic CSS tokens for light/dark mode design consistency.
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
      e.target.value = "";
    }
  };

  return (
    <div className="rounded-3xl bg-card text-card-foreground border border-border shadow-sm p-6 sm:p-10 w-full max-w-5xl mx-auto transition-colors">
      
      {/* Header */}
      <div className="mb-8">
        <h2 className="text-2xl sm:text-3xl font-title font-bold text-foreground mb-2">{title}</h2>
        <p className="text-muted-foreground text-xs sm:text-sm">{description}</p>
      </div>

      <div className="space-y-8">
        
        {/* Drag & Drop Upload Zone */}
        {!file ? (
          <div
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            className={`border-2 border-dashed rounded-2xl p-8 sm:p-12 flex flex-col items-center justify-center cursor-pointer transition-all duration-200
              ${isDragging 
                ? "border-primary bg-primary/10" 
                : "border-border bg-card hover:border-primary/60 hover:bg-muted/40"
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
            <div className="bg-primary/10 p-4 rounded-full mb-3 text-primary">
              <UploadCloud className="w-7 h-7" />
            </div>
            <p className="text-foreground font-semibold text-sm mb-1">
              Click to upload <span className="text-muted-foreground font-normal">or drag and drop</span>
            </p>
            <p className="text-muted-foreground text-xs">PDF or DOCX (max. 20MB)</p>
          </div>
        ) : (
          /* Selected File Preview Badge */
          <div className="border border-border bg-muted/30 rounded-2xl p-4 sm:p-5 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="bg-primary/10 p-3 rounded-xl text-primary">
                <FileText className="w-5 h-5" />
              </div>
              <div>
                <p className="font-semibold text-sm text-foreground truncate max-w-[200px] sm:max-w-md">{file.name}</p>
                <p className="text-xs text-muted-foreground">{(file.size / 1024 / 1024).toFixed(2)} MB</p>
              </div>
            </div>
            <button 
              onClick={(e) => {
                e.stopPropagation();
                onFileChange(null);
              }}
              className="text-muted-foreground hover:text-destructive p-2 rounded-lg hover:bg-muted transition-colors"
              title="Remove file"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        )}

        {/* Divider */}
        <div className="flex items-center gap-4">
          <div className="flex-1 h-[1px] bg-border" />
          <span className="text-muted-foreground text-[10px] font-bold uppercase tracking-widest">or paste text</span>
          <div className="flex-1 h-[1px] bg-border" />
        </div>

        {/* Textarea Fallback */}
        <div>
          <textarea
            value={text}
            onChange={(e) => onTextChange(e.target.value)}
            placeholder="Paste your details here..."
            className="w-full rounded-2xl bg-card border border-border p-4 sm:p-5 text-sm text-foreground placeholder:text-muted-foreground/50 outline-none focus:ring-1 focus:ring-primary focus:border-primary transition-all min-h-[160px] resize-y"
          />
        </div>

      </div>
    </div>
  );
}