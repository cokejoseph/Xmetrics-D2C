import { useState } from 'react'
import { CheckSquare, Tag, ThumbsUp, Pause, X, Download } from 'lucide-react'
import { Button } from '../ui'
import { useAppStore } from '../../stores/appStore'

interface LabelToast {
  awbs: Array<{ awb: string; courier: string; orderId: string }>
  pdfUrl: string
}

interface Props {
  selectedIds: string[]
  onClear: () => void
  showGenerateLabels?: boolean
}

export default function BulkActionBar({ selectedIds, onClear, showGenerateLabels = true }: Props) {
  const { bulkApprove, bulkHold, generateLabels } = useAppStore()
  const [labelToast, setLabelToast] = useState<LabelToast | null>(null)

  if (selectedIds.length === 0) return null

  const handleGenerateLabels = () => {
    const result = generateLabels(selectedIds)
    setLabelToast({
      awbs: result.results.map(r => ({ awb: r.awb_number, courier: r.courier, orderId: r.order_id })),
      pdfUrl: result.merged_pdf_url,
    })
    onClear()
  }

  const handleApprove = () => {
    bulkApprove(selectedIds)
    onClear()
  }

  const handleHold = () => {
    bulkHold(selectedIds)
    onClear()
  }

  return (
    <>
      <div className="fixed bottom-20 lg:bottom-6 left-1/2 -translate-x-1/2 z-40 animate-in slide-in-from-bottom-2">
        <div className="flex items-center gap-2 bg-brand-900 text-white rounded-2xl shadow-dropdown px-4 py-3">
          <CheckSquare size={16} className="text-brand-400" />
          <span className="text-sm font-medium">{selectedIds.length} selected</span>
          <div className="w-px h-4 bg-white/20 mx-1" />
          {showGenerateLabels && (
            <Button
              size="sm"
              variant="secondary"
              className="bg-white/10 border-white/20 text-white hover:bg-white/20"
              onClick={handleGenerateLabels}
            >
              <Tag size={14} />
              Generate Labels
            </Button>
          )}
          <Button
            size="sm"
            variant="secondary"
            className="bg-green-500/20 border-green-500/30 text-green-300 hover:bg-green-500/30"
            onClick={handleApprove}
          >
            <ThumbsUp size={14} />
            Approve
          </Button>
          <Button
            size="sm"
            variant="secondary"
            className="bg-amber-500/20 border-amber-500/30 text-amber-300 hover:bg-amber-500/30"
            onClick={handleHold}
          >
            <Pause size={14} />
            Hold
          </Button>
          <button
            onClick={onClear}
            className="p-1.5 rounded-lg hover:bg-white/10 text-white/60 hover:text-white transition-colors"
          >
            <X size={14} />
          </button>
        </div>
      </div>

      {labelToast && (
        <div className="fixed bottom-24 lg:bottom-20 right-6 z-50 w-80 bg-white rounded-2xl shadow-dropdown border border-gray-100 p-4 animate-in slide-in-from-right-2">
          <div className="flex items-start justify-between mb-3">
            <p className="text-sm font-semibold text-gray-900">Labels Generated</p>
            <button onClick={() => setLabelToast(null)} className="text-gray-400 hover:text-gray-600">
              <X size={14} />
            </button>
          </div>
          <div className="space-y-1 max-h-36 overflow-y-auto mb-3">
            {labelToast.awbs.map(a => (
              <div key={a.awb} className="flex items-center justify-between text-xs text-gray-600">
                <span className="font-mono">{a.awb}</span>
                <span className="text-gray-400">{a.courier}</span>
              </div>
            ))}
          </div>
          <Button size="sm" className="w-full" onClick={() => setLabelToast(null)}>
            <Download size={14} />
            Download Merged PDF
          </Button>
        </div>
      )}
    </>
  )
}
