import { Sparkles, Upload } from 'lucide-react'
import { Button } from '@/components/ui/button'

export function EmptyMapHeader({reading,onGenerate,onUpload}:{reading:boolean;onGenerate:()=>void;onUpload:()=>void}){
  return <div className="flex items-center justify-between border-b border-[hsl(var(--border))] px-4 py-2">
    <span className="text-sm font-medium">Maps</span>
    {!reading&&<div className="flex items-center gap-2">
      <Button size="sm" variant="outline" className="gap-1.5" onClick={onGenerate}><Sparkles className="h-4 w-4" />Generate with AI</Button>
      <Button size="sm" onClick={onUpload}><Upload className="h-4 w-4" />Upload Map</Button>
    </div>}
  </div>
}
