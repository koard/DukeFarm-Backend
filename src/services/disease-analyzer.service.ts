import Fuse from 'fuse.js';
import { prisma } from '../clients/prisma';

interface AnalyzeInput {
  symptomText: string;
  symptomTags: string[];
  file?: any;
}

interface DiseaseProfile {
  id: string;
  name: string;
  category: string;
  treatmentSummary: string;
  allTerms: string[];  // For fuzzy search
  tags: string[];      // For exact tag matching
  symptoms: string;
}

const tokenize = (text: string) =>
  text
    .toLowerCase()
    .replace(/[^a-zA-Z\u0E00-\u0E7F0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(Boolean);

export const DiseaseAnalyzerService = {
  analyze: async ({ symptomText, symptomTags, file }: AnalyzeInput) => {
    let photoId: string | null = null;

    if (file) {
      const photo = await prisma.uploadedFile.create({
        data: {
          filePath: file.path,
          mimeType: file.mimetype,
          sizeBytes: file.size,
        },
      });
      photoId = photo.id;
    }

    const request = await prisma.diseaseAnalysisRequest.create({
      data: {
        symptomText,
        symptomTags,
        photoId,
      },
    });

    const diseases = await prisma.disease.findMany({
      include: { tags: true },
    });

    // 1. Prepare Disease Profiles for Fuzzy Searching
    const profiles: DiseaseProfile[] = diseases.map((d) => ({
      id: d.id,
      name: d.name,
      category: d.category,
      treatmentSummary: d.treatmentSummary ?? d.treatment?.slice(0, 140) ?? '',
      symptoms: d.symptoms ?? '',
      tags: d.tags.map((t) => t.label),
      allTerms: [
        d.name,
        d.symptoms ?? '',
        d.causes ?? '',
        ...d.tags.map((t) => t.label),
      ].filter(Boolean),
    }));

    // 2. Setup Fuse.js for Symptom/Text Matching
    const fuse = new Fuse(profiles, {
      keys: ['allTerms', 'tags'],
      includeScore: true,
      threshold: 0.5, // Slightly relaxed threshold
      ignoreLocation: true,
      useExtendedSearch: true,
    });

    // 3. Score Calculation
    // Map to track scores per disease
    const diseaseScores = new Map<string, { score: number; reasons: string[] }>();

    // Initialize scores
    profiles.forEach(p => diseaseScores.set(p.id, { score: 0, reasons: [] }));

    // Combine symptomText and symptomTags into unified text
    // This ensures clicking tags behaves the same as typing the text
    const combinedText = [
      symptomText || '',
      ...(symptomTags || [])
    ].join(' ').trim();

    // --- Unified Evaluation from Fuzzy Text (Typo tolerant) ---
    // Split input into tokens and search each
    if (combinedText) {
      // Simple split by whitespace for now. 
      // Note: Thai text often has no spaces, but users might separate key symptoms or we can rely on partial matches.
      // Use Set to deduplicate tokens (e.g., if user both types and clicks same symptom)
      const tokens = [...new Set(combinedText.split(/\s+/).filter(t => t.length > 1))];

      tokens.forEach(token => {
        const results = fuse.search(token);
        results.forEach(res => {
          // Score is 0..1 (0 is best). We want confidence 0..1 (1 is best).
          // We filter meaningful matches
          if (res.score !== undefined && res.score < 0.6) {
            const confidence = (1 - res.score);
            const current = diseaseScores.get(res.item.id)!;
            // Add weighted score per matched token
            // Weight: 0.3 per matched token
            current.score += confidence * 0.3;

            // Avoid duplicate reasons for same token/disease combo
            if (!current.reasons.includes(`Match: ${token}`)) {
              current.reasons.push(`Match: ${token}`);
            }
          }
        });
      });
    }

    // 4. Sort and Filter
    const sorted = profiles
      .map(p => {
        const s = diseaseScores.get(p.id)!;
        return {
          diseaseId: p.id,
          name: p.name,
          category: p.category,
          treatmentSummary: p.treatmentSummary,
          score: s.score,
          reasons: s.reasons
        };
      })
      .filter((s) => s.score > 0.1) // Filter out very low confidence
      .sort((a, b) => b.score - a.score)
      .slice(0, 5)
      .map((s, idx) => ({
        diseaseId: s.diseaseId,
        name: s.name,
        category: s.category,
        treatmentSummary: s.treatmentSummary,
        score: Math.min(s.score, 1.0), // Cap at 1.0 for UI display if needed, or leave raw
        rank: idx + 1,
      }));

    if (sorted.length) {
      await prisma.$transaction(
        sorted.map((s) =>
          prisma.diseaseMatch.create({
            data: {
              requestId: request.id,
              diseaseId: s.diseaseId,
              score: s.score,
              rank: s.rank,
            },
          }),
        ),
      );
    }

    return {
      requestId: request.id,
      photoPath: photoId
        ? (await prisma.uploadedFile.findUnique({ where: { id: photoId } }))?.filePath ?? null
        : null,
      results: sorted,
    };
  },

  getResult: async (id: string) => {
    return prisma.diseaseAnalysisRequest.findUnique({
      where: { id },
      include: {
        photo: true,
        matches: {
          orderBy: { rank: 'asc' },
          include: { disease: true },
        },
      },
    });
  },

  searchDiseases: async ({
    symptoms,
    category,
    page,
    limit,
  }: {
    symptoms?: string;
    category?: string;
    page: number;
    limit: number;
  }) => {
    const skip = (page - 1) * limit;

    const where: any = {};

    if (category) {
      where.category = category;
    }

    if (symptoms) {
      const terms = tokenize(symptoms);
      where.OR = [
        { name: { contains: symptoms, mode: 'insensitive' } },
        { symptoms: { contains: symptoms, mode: 'insensitive' } },
        { tags: { some: { label: { in: terms, mode: 'insensitive' } } } },
      ];
    }

    const [data, totalItems] = await Promise.all([
      prisma.disease.findMany({
        where,
        skip,
        take: limit,
        include: {
          tags: true,
        },
        orderBy: { name: 'asc' },
      }),
      prisma.disease.count({ where }),
    ]);

    return {
      data,
      pagination: {
        currentPage: page,
        totalPages: Math.ceil(totalItems / limit),
        totalItems,
        itemsPerPage: limit,
      },
    };
  },

  getDisease: async (id: string) => {
    return prisma.disease.findUnique({
      where: { id },
      include: {
        tags: true,
      },
    });
  },

  getSymptomChips: async () => {
    // Return curated chips for frontend "Quick Select"
    return [
      {
        category: 'อาการทั่วไป',
        chips: ['เบื่ออาหาร', 'ว่ายหมุน', 'ลอยหัว', 'ซึม', 'ถูตัว']
      },
      {
        category: 'ลักษณะภายนอก',
        chips: ['จุดขาว', 'แผลเลือดออก', 'ท้องบวม', 'ตาโปน', 'ตัวผอม', 'เกล็ดหลุด']
      },
      {
        category: 'อวัยวะ',
        chips: ['ครีบเปื่อย', 'หางเปื่อย', 'ปากขาว', 'เหงือกซีด']
      }
    ];
  },
};
