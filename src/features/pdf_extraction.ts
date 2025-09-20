
import { pdfText } from "@pdf/pdftext";
import { CompletionRequest } from "../types.ts";
import { decodeBase64 } from "https://deno.land/std/encoding/base64.ts";

export async function extractPDFFromMessage(
  messages: CompletionRequest["messages"],
) {
  if (messages == undefined) return;
  for (const msg of messages) {
    if (msg.contents) {
      msg.contents = await Promise.all(msg.contents.map(async (c) => {
        if (c.type == "file") {
          try {
            const fileBuf = decodeBase64(c.file!);
            const page: { [pageno: number]: string } = await pdfText(fileBuf);
            return {
              "type": "text",
              text: Object.entries(page).map(([page, content]) => {
                `## OCR content for page ${page}\n\n${content}`;
              }).join("\n\n"),
            };
          } catch (e) {
            console.warn("error parsing pdf", e);
          }
        }

        return c;
      }));
    }
  }
}
