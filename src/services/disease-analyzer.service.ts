import { prisma } from '../clients/prisma';

interface AnalyzeInput {
  symptomText: string;
  symptomTags: string[];
  file?: Express.Multer.File | undefined;
}

interface DiseaseProfile {
  id: string;
  name: string;
  category: string;
  treatmentSummary: string;
  bag: string[];
}

const tokenize = (text: string) =>
  text
    .toLowerCase()
    .replace(/[^a-zA-Z\u0E00-\u0E7F0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(Boolean);

const simpleScore = (requestTerms: string[], bag: string[]) => {
  const setReq = new Set(requestTerms);
  const setBag = new Set(bag);
  const intersection = [...setReq].filter((t) => setBag.has(t)).length;
  return setReq.size ? intersection / setReq.size : 0;
};

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

    const profiles: DiseaseProfile[] = diseases.map((d) => ({
      id: d.id,
      name: d.name,
      category: d.category,
      treatmentSummary: d.treatmentSummary ?? d.treatment?.slice(0, 140) ?? '',
      bag: [
        ...tokenize(d.symptoms ?? ''),
        ...tokenize(d.causes ?? ''),
        ...tokenize(d.treatment ?? ''),
        ...tokenize(d.prevention ?? ''),
        ...d.tags.map((t) => t.label.toLowerCase()),
      ],
    }));

    const reqTerms = [
      ...tokenize(symptomText),
      ...symptomTags.map((t) => t.toLowerCase()),
    ];

    const scored = profiles
      .map((p) => ({ ...p, score: simpleScore(reqTerms, p.bag) }))
      .filter((p) => p.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 5)
      .map((p, idx) => ({
        diseaseId: p.id,
        name: p.name,
        category: p.category,
        treatmentSummary: p.treatmentSummary,
        score: p.score,
        rank: idx + 1,
      }));

    if (scored.length) {
      await prisma.$transaction(
        scored.map((s) =>
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
      results: scored,
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
};
