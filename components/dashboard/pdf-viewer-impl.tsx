"use client"

import { useState } from "react"
import { Document, Page, pdfjs } from "react-pdf"
import "react-pdf/dist/Page/AnnotationLayer.css"
import "react-pdf/dist/Page/TextLayer.css"

import { Skeleton } from "@/components/ui/skeleton"

pdfjs.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs"

export function PdfViewer({ url }: { url: string }) {
  const [numPages, setNumPages] = useState(0)

  return (
    <div className="max-h-[70vh] overflow-auto border bg-muted">
      <Document
        file={url}
        className="flex flex-col items-center gap-4 p-4"
        onLoadSuccess={({ numPages: total }) => setNumPages(total)}
        loading={
          <div className="flex w-full flex-col gap-4 p-4">
            <Skeleton className="h-[700px] w-[560px] max-w-full" />
            <Skeleton className="h-[700px] w-[560px] max-w-full" />
          </div>
        }
        error={
          <p className="p-4 text-sm text-muted-foreground">
            Could not load this PDF.
          </p>
        }
      >
        {Array.from({ length: numPages }, (_, i) => (
          <Page key={i + 1} pageNumber={i + 1} width={560} />
        ))}
      </Document>
    </div>
  )
}
