import { extractText, getDocumentProxy } from "unpdf";

/** Text per page. A scanned PDF has (almost) no text layer. */
export async function pdfPages(bytes: Uint8Array): Promise<string[]> {
  const pdf = await getDocumentProxy(bytes);
  const { text } = await extractText(pdf, { mergePages: false });
  return text as string[];
}

export const looksScanned = (pages: string[]) => pages.join("").replace(/\s/g, "").length < 200;
