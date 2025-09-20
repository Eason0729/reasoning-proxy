
import * as OpenCC from "opencc-js";

const openccConverter = OpenCC.Converter({ from: "cn", to: "twp" });

export function convertToTraditionalChinese(text: string): string {
  return openccConverter(text);
}
