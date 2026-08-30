"use client"

import dynamic from "next/dynamic"

import { Skeleton } from "@/components/ui/skeleton"

const PdfViewerImpl = dynamic(
  () => import("./pdf-viewer-impl").then((m) => m.PdfViewer),
  {
    ssr: false,
    loading: () => (
      <div className="flex max-h-[70vh] flex-col items-center gap-4 overflow-auto border bg-muted p-4">
        <Skeleton className="h-[700px] w-[560px] max-w-full" />
      </div>
    ),
  },
)

export function PdfViewer({ url }: { url: string }) {
  return <PdfViewerImpl url={url} />
}
