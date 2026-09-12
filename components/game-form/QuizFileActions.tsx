"use client";

import { useRef, type ChangeEvent } from "react";
import { FolderOpen, Download, Upload, ChevronDown } from "lucide-react";
import { toast } from "sonner";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from "@/components/ui/dropdown-menu";
import {
  parseQuizUpFile,
  QuizFileError,
  QUIZ_FILE_LIMITS,
  type SanitizedQuiz,
} from "@/core/domain/quiz-file";
import {
  buildQuizExportFileName,
  buildQuizExportPayload,
  type QuizDraft,
} from "@/core/application/builders/quiz-builder";

interface QuizFileActionsProps {
  draft: QuizDraft;
  onImport: (quiz: SanitizedQuiz) => void;
}

export function QuizFileActions({ draft, onImport }: QuizFileActionsProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleExport = () => {
    const payload = buildQuizExportPayload(draft, new Date().toISOString());

    const blob = new Blob([JSON.stringify(payload, null, 2)], {
      type: "application/json",
    })
    const url = URL.createObjectURL(blob)
    const link = document.createElement("a")
    link.href = url
    link.download = buildQuizExportFileName(draft.name)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
  };

  const handleImportFile = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ""
    if (!file) return

    if (file.size > QUIZ_FILE_LIMITS.maxFileBytes) {
      toast.error("El archivo es demasiado grande. El máximo permitido es 2 MB.")
      return
    }

    try {
      const text = await file.text()
      const imported = parseQuizUpFile(text)
      onImport(imported)
    } catch (error) {
      if (error instanceof QuizFileError) {
        toast.error(`Archivo .quizup inválido:\n${error.message}`)
      } else {
        toast.error(
          "No se pudo leer el archivo. Asegúrate de que sea un archivo .quizup exportado desde QuizUp."
        )
      }
    }
  };

  return (
    <>
      <DropdownMenu modal={false}>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            className="flex items-center gap-2 px-4 py-2 text-sm font-bold text-gray-700 bg-white border-2 border-gray-200 rounded-xl transition-colors hover:border-[#864CBF] hover:text-[#864CBF]"
          >
            <FolderOpen className="h-4 w-4" />
            Archivo
            <ChevronDown className="h-3.5 w-3.5" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-48">
          <DropdownMenuItem
            onClick={() => fileInputRef.current?.click()}
            className="cursor-pointer font-medium"
          >
            <Upload className="h-4 w-4 mr-2" />
            Importar (.quizup)
          </DropdownMenuItem>
          <DropdownMenuItem
            onClick={handleExport}
            className="cursor-pointer font-medium"
          >
            <Download className="h-4 w-4 mr-2" />
            Exportar (.quizup)
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <input
        ref={fileInputRef}
        type="file"
        accept=".quizup,.json,application/json"
        className="hidden"
        onChange={handleImportFile}
      />
    </>
  );
}
