import { z } from "zod";

// Shared by source creation, editing, import and automatic detection.
export const sourceUrlSchema = z.string().trim().min(1, "Bitte eine Adresse eingeben.").max(2000).transform((value, ctx) => {
  let address = value;
  if (address.startsWith("//")) address = "https:" + address;
  else if (!/^[a-z][a-z\d+.-]*:/i.test(address)) address = "https://" + address;
  try {
    if (/\s/.test(address)) throw new Error();
    const url = new URL(address);
    if (!["http:", "https:"].includes(url.protocol) || !url.hostname || url.username || url.password) throw new Error();
    return url.href;
  } catch {
    ctx.addIssue({ code: "custom", message: "Bitte eine gültige Webadresse eingeben, z. B. www.tagesschau.de oder https://www.tagesschau.de/index~rss2.xml." });
    return z.NEVER;
  }
});
