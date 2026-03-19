import { ArxivPaper } from './types';

const ARXIV_API = 'https://export.arxiv.org/api/query';

export interface ArxivSearchParams {
  query?: string;
  category?: string;
  start?: number;
  maxResults?: number;
  sortBy?: 'relevance' | 'lastUpdatedDate' | 'submittedDate';
}

export const ARXIV_CATEGORIES: { label: string; value: string }[] = [
  { label: 'All', value: '' },
  { label: 'cs.AI', value: 'cs.AI' },
  { label: 'cs.LG', value: 'cs.LG' },
  { label: 'cs.CL', value: 'cs.CL' },
  { label: 'q-bio.NC', value: 'q-bio.NC' },
  { label: 'stat.ML', value: 'stat.ML' },
];

// ─── XML parsing helpers ──────────────────────────────────────────────────────

function extractTag(xml: string, tag: string): string {
  const re = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, 'i');
  const match = xml.match(re);
  return match ? match[1].replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').trim() : '';
}

function extractAllMatches(xml: string, tag: string): string[] {
  const re = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, 'gi');
  const results: string[] = [];
  let match;
  while ((match = re.exec(xml)) !== null) {
    results.push(match[1].replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').trim());
  }
  return results;
}

function parseEntries(xml: string): ArxivPaper[] {
  const entryRe = /<entry>([\s\S]*?)<\/entry>/gi;
  const papers: ArxivPaper[] = [];
  let entryMatch;

  while ((entryMatch = entryRe.exec(xml)) !== null) {
    const entry = entryMatch[1];

    // ID: extract arxiv ID from URL like http://arxiv.org/abs/2401.12345v1
    const idUrl = extractTag(entry, 'id');
    const idMatch = idUrl.match(/abs\/([^\s]+?)(?:v\d+)?$/);
    const id = idMatch ? idMatch[1] : idUrl;

    const title = extractTag(entry, 'title').replace(/\s+/g, ' ');
    const abstract = extractTag(entry, 'summary').replace(/\s+/g, ' ');
    const published = extractTag(entry, 'published');
    const updated = extractTag(entry, 'updated');

    // Authors
    const authorBlocks = extractAllMatches(entry, 'author');
    const authors = authorBlocks.map((block) => extractTag(block, 'name')).filter(Boolean);

    // Categories — match self-closing <category term="..." ... />
    const categories: string[] = [];
    const catRe = /<category[^>]*\sterm="([^"]*)"[^>]*\/?>/gi;
    let catMatch;
    while ((catMatch = catRe.exec(entry)) !== null) {
      categories.push(catMatch[1]);
    }

    // PDF link: <link title="pdf" href="..." .../>
    const pdfMatch = entry.match(/<link[^>]*title="pdf"[^>]*href="([^"]*)"[^>]*\/?>/i)
      || entry.match(/<link[^>]*href="([^"]*)"[^>]*title="pdf"[^>]*\/?>/i);
    const pdfUrl = pdfMatch ? pdfMatch[1] : `https://arxiv.org/pdf/${id}`;

    // Abstract URL: <link rel="alternate" href="..." .../>
    const altMatch = entry.match(/<link[^>]*rel="alternate"[^>]*href="([^"]*)"[^>]*\/?>/i)
      || entry.match(/<link[^>]*href="([^"]*)"[^>]*rel="alternate"[^>]*\/?>/i);
    const abstractUrl = altMatch ? altMatch[1] : `https://arxiv.org/abs/${id}`;

    if (id && title) {
      papers.push({ id, title, authors, abstract, published, updated, categories, pdfUrl, abstractUrl });
    }
  }

  return papers;
}

// ─── Public API ───────────────────────────────────────────────────────────────

export async function searchArxiv(params: ArxivSearchParams): Promise<ArxivPaper[]> {
  const {
    query = '',
    category = '',
    start = 0,
    maxResults = 20,
    sortBy = 'submittedDate',
  } = params;

  const parts: string[] = [];
  if (query.trim()) parts.push(`all:${query.trim()}`);
  if (category) parts.push(`cat:${category}`);

  if (parts.length === 0) return [];

  const searchQuery = parts.join(' AND ');
  const url = `${ARXIV_API}?search_query=${encodeURIComponent(searchQuery)}&start=${start}&max_results=${maxResults}&sortBy=${sortBy}&sortOrder=descending`;

  const resp = await fetch(url);
  if (!resp.ok) throw new Error(`ArXiv API error: ${resp.status}`);
  const xml = await resp.text();
  return parseEntries(xml);
}

export async function fetchPaperById(arxivId: string): Promise<ArxivPaper | null> {
  const url = `${ARXIV_API}?id_list=${encodeURIComponent(arxivId)}`;
  const resp = await fetch(url);
  if (!resp.ok) throw new Error(`ArXiv API error: ${resp.status}`);
  const xml = await resp.text();
  const papers = parseEntries(xml);
  return papers[0] ?? null;
}

// ─── Formatting helpers ───────────────────────────────────────────────────────

export function formatAuthors(authors: string[]): string {
  if (authors.length === 0) return 'Unknown';
  if (authors.length === 1) return authors[0];
  if (authors.length === 2) return `${authors[0]} & ${authors[1]}`;
  return `${authors[0]} et al.`;
}

export function formatArxivDate(isoDate: string): string {
  if (!isoDate) return '';
  const date = new Date(isoDate);
  return date.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
}
