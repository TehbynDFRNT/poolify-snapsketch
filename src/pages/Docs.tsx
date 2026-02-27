import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { UserButton } from '@clerk/clerk-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { ArrowLeft, Search, Menu, X } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { DOC_SECTIONS, searchDocs } from '@/lib/docs';
import { cn } from '@/lib/utils';

export function Docs() {
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [activeId, setActiveId] = useState('');
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const contentRef = useRef<HTMLDivElement>(null);

  const filteredSections = searchDocs(search);

  // Track active section on scroll
  useEffect(() => {
    const container = contentRef.current;
    if (!container) return;

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setActiveId(entry.target.id);
          }
        }
      },
      { root: container, rootMargin: '-20% 0px -70% 0px', threshold: 0 }
    );

    const headings = container.querySelectorAll('[id]');
    headings.forEach((h) => observer.observe(h));

    return () => observer.disconnect();
  }, [filteredSections]);

  const scrollToSection = (id: string) => {
    const el = contentRef.current?.querySelector(`#${CSS.escape(id)}`);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      setActiveId(id);
    }
    setMobileNavOpen(false);
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <header className="border-b shrink-0">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Button variant="ghost" onClick={() => navigate('/projects')}>
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Projects
            </Button>
            {/* Mobile nav toggle */}
            <Button
              variant="ghost"
              size="icon"
              className="lg:hidden"
              onClick={() => setMobileNavOpen(!mobileNavOpen)}
            >
              {mobileNavOpen ? <X className="w-4 h-4" /> : <Menu className="w-4 h-4" />}
            </Button>
          </div>
          <UserButton />
        </div>
      </header>

      <div className="flex-1 flex overflow-hidden">
        {/* Sidebar */}
        <aside
          className={cn(
            'w-72 border-r bg-muted/30 flex-col shrink-0',
            mobileNavOpen
              ? 'flex absolute inset-y-[65px] left-0 z-50 bg-background shadow-lg'
              : 'hidden lg:flex'
          )}
        >
          <div className="p-4 border-b">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search docs..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
          </div>
          <ScrollArea className="flex-1">
            <nav className="p-2">
              {filteredSections.map((section) => (
                <button
                  key={section.id}
                  onClick={() => scrollToSection(section.id)}
                  className={cn(
                    'w-full text-left px-3 py-2 rounded-md text-sm transition-colors',
                    activeId === section.id
                      ? 'bg-primary/10 text-primary font-medium'
                      : 'text-muted-foreground hover:text-foreground hover:bg-muted'
                  )}
                >
                  {section.title}
                </button>
              ))}
            </nav>
          </ScrollArea>
        </aside>

        {/* Main Content */}
        <div ref={contentRef} className="flex-1 overflow-y-auto">
          <div className="container max-w-4xl mx-auto px-6 py-8">
            <h1 className="text-3xl font-bold mb-8">Documentation</h1>
            <div className="prose prose-slate dark:prose-invert max-w-none prose-headings:scroll-mt-4 prose-table:border prose-th:border prose-th:px-3 prose-th:py-2 prose-th:bg-muted prose-td:border prose-td:px-3 prose-td:py-2 prose-tr:even:bg-muted/50 prose-kbd:bg-muted prose-kbd:px-1.5 prose-kbd:py-0.5 prose-kbd:rounded prose-kbd:text-sm prose-kbd:font-mono prose-kbd:border">
              {filteredSections.map((section) => (
                <div key={section.id} id={section.id} className="mb-12">
                  <h2>{section.title}</h2>
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>
                    {section.content}
                  </ReactMarkdown>
                </div>
              ))}
              {filteredSections.length === 0 && (
                <p className="text-muted-foreground text-center py-12">
                  No sections match your search.
                </p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
