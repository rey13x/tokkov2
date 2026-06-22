import OpenAI from "openai";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Positive comment phrases for variety
const COMMENT_TEMPLATES = [
  "Ini adalah layanan terbaik yang pernah saya gunakan!",
  "Sangat puas dengan kualitas dan pelayanannya.",
  "Recommended! Layanannya profesional dan cepat.",
  "Kualitas bagus, harga terjangkau. Sukses terus!",
  "Pelayanannya ramah dan responsif. Top banget!",
  "Saya jadi pelanggan setia karena kualitasnya.",
  "Sangat membantu bisnis saya. Terima kasih!",
  "Prosesnya mudah dan hasil memuaskan.",
  "Tim mereka very helpful dan responsif.",
  "Kualitas kerjanya jauh melampaui ekspektasi saya.",
  "Investasi terbaik untuk bisnis online saya.",
  "Layanan customer service yang luar biasa responsif.",
  "Hasil kerja profesional dan sesuai timeline.",
  "Saya sangat merekomendasikan layanan ini.",
  "Efisien waktu dan menghemat biaya operasional.",
  "Kualitas premium dengan harga kompetitif.",
  "Terima kasih telah membantu kesuksesan bisnis saya.",
  "Pelayanannya melampaui yang saya harapkan!",
  "Tidak akan cari tempat lain lagi untuk ini.",
  "Genuinely impressed dengan profesionalisme mereka.",
];

const USER_NAMES = [
  "Tokker ID", "Pembeli Setia", "Tokker Baru", "Customer", "Pengguna",
  "Member", "Tokker Premium", "User", "Pengunjung", "Pelanggan",
  "Pembeli", "Supporter", "Tokker Aktif", "Friend", "Tokker Keren",
];

/**
 * Generate AI comments for a testimonial
 * @param count Number of comments to generate (1-50)
 * @param testimonialContext Context about the testimonial (product name, rating, etc.)
 * @returns Array of generated comment texts
 */
export async function generateAIComments(
  count: number,
  testimonialContext: { productName?: string; rating?: number } = {}
): Promise<string[]> {
  if (!process.env.OPENAI_API_KEY) {
    console.warn("OPENAI_API_KEY not set, using template-based generation");
    return generateTemplateComments(count);
  }

  if (count < 1 || count > 50) {
    count = Math.min(Math.max(count, 1), 50);
  }

  try {
    const systemPrompt = `You are a helpful assistant that generates natural, genuine-sounding customer testimonial comments in Indonesian. 
Generate comments that are:
- Positive and encouraging
- 1-3 sentences long
- Varied in style and content
- Natural and authentic-sounding
- Relevant to e-commerce/service platforms
- Include emojis occasionally for natural feel`;

    const userPrompt = `Generate ${count} unique positive customer testimonial comments in Indonesian language.
${testimonialContext.productName ? `About product/service: ${testimonialContext.productName}` : ""}
${testimonialContext.rating ? `Rating context: ${testimonialContext.rating} stars` : ""}

Format: Return ONLY a JSON array of strings, nothing else.
Example: ["comment 1", "comment 2", "comment 3"]`;

    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      temperature: 0.8,
      max_tokens: Math.min(count * 100, 2000),
    });

    const content = response.choices[0]?.message?.content || "[]";
    
    try {
      const parsed = JSON.parse(content);
      if (Array.isArray(parsed)) {
        return parsed.slice(0, count).map((c: any) => String(c).trim()).filter(c => c.length > 0);
      }
    } catch {
      // Fallback to template if parsing fails
      console.warn("Failed to parse AI response, using templates");
    }

    return generateTemplateComments(count);
  } catch (error) {
    console.error("Error generating AI comments:", error);
    return generateTemplateComments(count);
  }
}

/**
 * Generate AI replies to a comment
 * @param parentCommentText The comment being replied to
 * @param count Number of replies to generate (1-20)
 * @returns Array of generated reply texts
 */
export async function generateAIReplies(
  parentCommentText: string,
  count: number
): Promise<string[]> {
  if (!process.env.OPENAI_API_KEY) {
    console.warn("OPENAI_API_KEY not set, using template-based replies");
    return generateTemplateReplies(count);
  }

  if (count < 1 || count > 20) {
    count = Math.min(Math.max(count, 1), 20);
  }

  try {
    const systemPrompt = `You are a helpful assistant generating natural reply comments to customer testimonials in Indonesian.
Generate replies that:
- Thank the commenter
- Are positive and professional
- Are 1-2 sentences long
- Varied in style
- Sound natural from a business/seller perspective`;

    const userPrompt = `The customer said: "${parentCommentText}"

Generate ${count} unique professional reply comments in Indonesian language to respond to this testimonial.
The replies should be from the service provider/seller perspective.

Format: Return ONLY a JSON array of strings, nothing else.
Example: ["reply 1", "reply 2"]`;

    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      temperature: 0.7,
      max_tokens: Math.min(count * 80, 1200),
    });

    const content = response.choices[0]?.message?.content || "[]";

    try {
      const parsed = JSON.parse(content);
      if (Array.isArray(parsed)) {
        return parsed.slice(0, count).map((c: any) => String(c).trim()).filter(c => c.length > 0);
      }
    } catch {
      console.warn("Failed to parse AI replies, using templates");
    }

    return generateTemplateReplies(count);
  } catch (error) {
    console.error("Error generating AI replies:", error);
    return generateTemplateReplies(count);
  }
}

/**
 * Generate fallback template-based comments
 */
function generateTemplateComments(count: number): string[] {
  const comments: string[] = [];
  const used = new Set<number>();

  for (let i = 0; i < count; i++) {
    let templateIdx: number;
    do {
      templateIdx = Math.floor(Math.random() * COMMENT_TEMPLATES.length);
    } while (used.has(templateIdx) && used.size < COMMENT_TEMPLATES.length);
    
    used.add(templateIdx);
    comments.push(COMMENT_TEMPLATES[templateIdx]);
  }

  return comments;
}

/**
 * Generate fallback template-based replies
 */
function generateTemplateReplies(count: number): string[] {
  const replies = [
    "Terima kasih atas testimoni positifnya! Kami sangat senang melayani Anda.",
    "Apresiasi feedback Anda! Kami berkomitmen memberikan yang terbaik.",
    "Sama-sama! Kepuasan pelanggan adalah prioritas kami. Ditunggu order berikutnya!",
    "Makasih ya sudah percaya dengan layanan kami. Semoga bisa membantu terus!",
    "Terima kasih telah menjadi pelanggan setia kami! 🙏",
    "Senang bisa membantu! Sampai jumpa di order berikutnya.",
    "Apresiasi banget testimonialnya! Kami akan terus meningkatkan kualitas.",
    "Thank you for the kind words! We appreciate your business.",
    "Sama-sama! Semoga terus sukses dan berkembang juga bisnisnya ya.",
    "Terima kasih, senang bisa berbisnis dengan Anda! 😊",
  ];

  const selected: string[] = [];
  for (let i = 0; i < Math.min(count, replies.length); i++) {
    selected.push(replies[i]);
  }

  return selected;
}

/**
 * Get random username
 */
export function getRandomUsername(): string {
  return `${USER_NAMES[Math.floor(Math.random() * USER_NAMES.length)]} ${Math.floor(Math.random() * 100000)}`;
}

/**
 * Get random rating (3-5 stars mostly)
 */
export function getRandomRating(): number {
  const rand = Math.random();
  if (rand < 0.05) return 3; // 5% chance of 3 stars
  if (rand < 0.15) return 4; // 10% chance of 4 stars
  return 5; // 85% chance of 5 stars (positive testimonials)
}
