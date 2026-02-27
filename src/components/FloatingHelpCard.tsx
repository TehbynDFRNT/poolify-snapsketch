import { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { X, Search, ChevronRight } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { DOC_SECTIONS, searchDocs, getToolSection, type DocSection } from '@/lib/docs';
import { cn } from '@/lib/utils';

interface FloatingHelpCardProps {
  open: boolean;
  onClose: () => void;
  activeTool: string;
}

export function FloatingHelpCard({ open, onClose, activeTool }: FloatingHelpCardProps) {
  const [search, setSearch] = useState('');
  const [selectedSection, setSelectedSection] = useState<DocSection | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Context-aware: auto-select section matching active tool when opened
  useEffect(() => {
    if (open) {
      setSearch('');
      const toolSection = getToolSection(activeTool);
      setSelectedSection(toolSection || null);
    }
  }, [open, activeTool]);

  // Close on Escape
  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [open, onClose]);

  // Focus search input when opened
  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [open]);

  if (!open) return null;

  const results = searchDocs(search);

  return (
    <Card className="fixed z-50 top-[76px] right-4 w-96 max-h-[70vh] flex flex-col shadow-xl">
      <CardHeader className="pb-3 shrink-0">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base">
            {selectedSection ? (
              <button
                onClick={() => setSelectedSection(null)}
                className="flex items-center gap-1 hover:text-primary transition-colors"
              >
                Help
                <ChevronRight className="w-4 h-4" />
                <span className="text-sm font-normal truncate max-w-[200px]">
                  {selectedSection.title}
                </span>
              </button>
            ) : (
              'Help'
            )}
          </CardTitle>
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onClose}>
            <X className="w-4 h-4" />
          </Button>
        </div>
        <div className="relative mt-2">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            ref={inputRef}
            placeholder="Search help..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setSelectedSection(null);
            }}
            className="pl-9 h-8 text-sm"
          />
        </div>
      </CardHeader>
      <CardContent className="flex-1 overflow-hidden p-0">
        <ScrollArea className="h-full max-h-[calc(70vh-130px)]">
          <div className="px-4 pb-4">
            {selectedSection ? (
              <div className="prose prose-sm prose-slate dark:prose-invert max-w-none prose-table:border prose-th:border prose-th:px-2 prose-th:py-1 prose-th:bg-muted prose-th:text-xs prose-td:border prose-td:px-2 prose-td:py-1 prose-td:text-xs prose-tr:even:bg-muted/50 prose-kbd:bg-muted prose-kbd:px-1 prose-kbd:py-0.5 prose-kbd:rounded prose-kbd:text-xs prose-kbd:font-mono prose-kbd:border prose-headings:text-sm">
                <ReactMarkdown remarkPlugins={[remarkGfm]}>
                  {selectedSection.content}
                </ReactMarkdown>
              </div>
            ) : (
              <div className="space-y-1">
                {results.map((section) => (
                  <button
                    key={section.id}
                    onClick={() => setSelectedSection(section)}
                    className={cn(
                      'w-full text-left px-3 py-2 rounded-md text-sm transition-colors',
                      'text-foreground hover:bg-muted'
                    )}
                  >
                    <div className="font-medium">{section.title}</div>
                    <div className="text-xs text-muted-foreground line-clamp-1 mt-0.5">
                      {section.content.slice(0, 100).replace(/[#*|`\-\[\]]/g, '')}
                    </div>
                  </button>
                ))}
                {results.length === 0 && (
                  <p className="text-sm text-muted-foreground text-center py-4">
                    No results found.
                  </p>
                )}
              </div>
            )}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
