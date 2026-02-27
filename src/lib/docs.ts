import rawMarkdown from '../../docs/user-guide.md?raw';

export interface DocSection {
  id: string;
  title: string;
  content: string;
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

function parseSections(markdown: string): DocSection[] {
  const sections: DocSection[] = [];
  const lines = markdown.split('\n');
  let currentTitle = '';
  let currentContent: string[] = [];

  for (const line of lines) {
    const match = line.match(/^## (.+)$/);
    if (match) {
      if (currentTitle) {
        sections.push({
          id: slugify(currentTitle),
          title: currentTitle,
          content: currentContent.join('\n').trim(),
        });
      }
      currentTitle = match[1];
      currentContent = [];
    } else if (currentTitle) {
      currentContent.push(line);
    }
  }

  // Push the last section
  if (currentTitle) {
    sections.push({
      id: slugify(currentTitle),
      title: currentTitle,
      content: currentContent.join('\n').trim(),
    });
  }

  return sections;
}

export const DOC_SECTIONS = parseSections(rawMarkdown);

export function searchDocs(query: string): DocSection[] {
  if (!query.trim()) return DOC_SECTIONS;
  const lower = query.toLowerCase();
  return DOC_SECTIONS.filter(
    (s) =>
      s.title.toLowerCase().includes(lower) ||
      s.content.toLowerCase().includes(lower)
  );
}

const TOOL_SECTION_MAP: Record<string, string> = {
  select: 'select--pan-tool',
  hand: 'select--pan-tool',
  boundary: 'boundary-tool',
  house: 'house-tool',
  pool: 'pool-tool',
  paver: 'area-tool',
  paving_area: 'area-tool',
  fence: 'fence-tool',
  gate: 'fence-tool',
  drainage: 'drainage-tool',
  wall: 'wall-tool',
  quick_measure: 'measure-tool',
  height: 'height-tool',
  decoration: 'decoration-tool',
};

export function getToolSection(toolName: string): DocSection | undefined {
  const sectionId = TOOL_SECTION_MAP[toolName];
  if (!sectionId) return undefined;
  return DOC_SECTIONS.find((s) => s.id === sectionId);
}
