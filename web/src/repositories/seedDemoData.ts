import type { Tag } from "@/types";
import { tagRepository } from "./local/localTagStore";
import { vocabRepository } from "./local/localVocabStore";

const SEED_KEY = "echophrase:seed:v1";

export function seedDemoData(): void {
  if (localStorage.getItem(SEED_KEY)) return;
  if (vocabRepository.list().length > 0) {
    localStorage.setItem(SEED_KEY, "1");
    return;
  }

  const greeting = tagRepository.create("問候", "#6366f1");
  const nasal = tagRepository.create("鼻元音", "#ec4899");

  const samples: Array<{
    type: "word" | "sentence";
    text: string;
    ipa?: string;
    translation?: string;
    notes?: string;
    tagIds: Tag["id"][];
  }> = [
    {
      type: "word",
      text: "bonjour",
      ipa: "/bɔ̃.ʒuʁ/",
      translation: "你好",
      notes: "注意鼻元音 õ",
      tagIds: [greeting.id, nasal.id],
    },
    {
      type: "word",
      text: "merci",
      ipa: "/mɛʁ.si/",
      translation: "謝謝",
      tagIds: [greeting.id],
    },
    {
      type: "sentence",
      text: "Comment allez-vous ?",
      translation: "您好吗？（正式）",
      tagIds: [greeting.id],
    },
  ];

  for (const sample of samples) {
    vocabRepository.create(sample);
  }

  localStorage.setItem(SEED_KEY, "1");
}
