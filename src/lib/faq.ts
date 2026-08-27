import { brand } from "@/config/brand";
import type { FaqEntry } from "@/lib/structured-data";

/**
 * One list, rendered on the page and marked up as `FAQPage` from the same
 * source. An answer that exists only in the schema is the kind of thing Google
 * treats as marked-up content the reader cannot see.
 *
 * Written as answers to questions people actually ask, in full sentences, so a
 * model quoting one lands on something true and self-contained.
 */
export const faqEntries: FaqEntry[] = [
  {
    question: `What is ${brand.name}?`,
    answer: `${brand.name} is a personal CRM for the people you meet. You write a sentence about someone the day you meet them — where you met, what you talked about, what you promised — and ${brand.shortName} brings them back up when it matters: their birthday, the favor you owe, the friend you have not spoken to in three months.`,
  },
  {
    question: `Is ${brand.name} free?`,
    answer: `Yes. ${brand.name} is free to use on the web, iOS and Android, with no contact limit and no trial that expires.`,
  },
  {
    question: "Do the people I add ever find out?",
    answer: `No. Nobody is notified that you added them, and nothing you write is shown to anyone else. There is no feed, no social graph, and no way for another person to see their own entry. ${brand.name} is a private notebook that happens to be about people.`,
  },
  {
    question: `How is ${brand.name} different from just using Notes or a spreadsheet?`,
    answer: "A note only helps if you remember to open it, and the whole problem is that you do not. Siyi reads the dates and promises out of what you wrote and surfaces the person on the right day, so remembering to check is not a thing you have to do.",
  },
  {
    question: `Is ${brand.name} a CRM for work?`,
    answer: "Not really. Sales CRMs are built around deals, pipelines and quotas, and they make you the account manager of your own friendships. Siyi has no pipeline. It is built for classmates, club members, people from a party, and the friend from freshman year you keep meaning to text.",
  },
  {
    question: "Can I get my data out?",
    answer: `You can export everything you have written at any time, and you can delete all of it permanently. Neither costs anything and neither requires emailing support. See the privacy policy for what ${brand.name} stores and for how long.`,
  },
  {
    question: "Does it work on my phone?",
    answer: `Yes. ${brand.name} has native apps for iOS and Android, and the web app installs to a home screen. Everything syncs, and capture works offline — the thing you type on the walk home lands whether or not you had signal.`,
  },
  {
    question: "Who makes it?",
    answer: `${brand.name} is built by a small group of college students in Berkeley, in the open. We made it because we kept meeting people we liked and then losing track of them.`,
  },
];
