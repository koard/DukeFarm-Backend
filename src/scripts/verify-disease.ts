
import { DiseaseAnalyzerService } from '../services/disease-analyzer.service';
import { prisma } from '../clients/prisma';

// Mock express file if needed, or pass undefined
async function main() {
    console.log('--- Starting Disease Analysis Verification ---');

    // Test Case 1: Exact Match using Chips
    console.log('\n[Test 1] Analyzing with Chips: "จุดขาว", "เบื่ออาหาร"');
    const result1 = await DiseaseAnalyzerService.analyze({
        symptomText: '',
        symptomTags: ['จุดขาว', 'เบื่ออาหาร'],
        file: undefined
    });
    console.log('Top Result:', result1.results[0]?.name, 'Score:', result1.results[0]?.score);

    // Test Case 2: Fuzzy Text Match with Typos
    console.log('\n[Test 2] Analyzing with Typos in Text: "ปามีแผลเลืดออก ท้องบวมม" (Intended: ปลามีแผลเลือดออก ท้องบวม)');
    const result2 = await DiseaseAnalyzerService.analyze({
        symptomText: 'ปามีแผลเลืดออก ท้องบวมม',
        symptomTags: [],
        file: undefined
    });
    console.log('Top Result:', result2.results[0]?.name, 'Score:', result2.results[0]?.score);
    console.log('Matches:', result2.results.map(r => `${r.name} (${r.score.toFixed(2)})`).join(', '));

    // Test Case 3: New Disease (EUS)
    console.log('\n[Test 3] Analyzing EUS symptoms: "แผลแดง เห็นกระดูก แผลลึก"');
    const result3 = await DiseaseAnalyzerService.analyze({
        symptomText: 'มีแผลลึกเห็นกะดูก',
        symptomTags: ['แผลแดง'],
        file: undefined
    });
    console.log('Top Result:', result3.results[0]?.name, 'Score:', result3.results[0]?.score);

    // Test Case 4: Symptom Chips
    console.log('\n[Test 4] Fetching Symptom Chips');
    const chips = await DiseaseAnalyzerService.getSymptomChips();
    console.log('Categories:', chips.map(c => c.category).join(', '));
    console.log('Total Categories:', chips.length);

    await prisma.$disconnect();
}

main().catch(console.error);
