import { GoogleGenerativeAI } from '@google/generative-ai';

// ==========================================
// GOOGLE GEMINI API KEY
// .env dosyanıza EXPO_PUBLIC_GEMINI_API_KEY değişkenini ekleyin.
// (.env.example dosyasına bakın)
// Google AI Studio'dan alabilirsiniz: https://aistudio.google.com/app/apikey
// ==========================================
const API_KEY = process.env.EXPO_PUBLIC_GEMINI_API_KEY;

if (!API_KEY) {
  console.warn('[Gemini] EXPO_PUBLIC_GEMINI_API_KEY tanımlanmamış! .env.example dosyasına bakın.');
}

// Gemini istemcisini oluştur
const genAI = new GoogleGenerativeAI(API_KEY);

// Model yapılandırması
const model = genAI.getGenerativeModel({
  model: "gemini-2.5-flash-lite",
  generationConfig: {
    temperature: 0.2,
    maxOutputTokens: 200,
  },
});

/**
 * Günlük girdisini analiz eder
 * @param {string} text - Kullanıcının günlük metni
 * @returns {Promise<{mood_score: number, summary: string}>}
 */
export async function analyzeJournalEntry(text) {
  try {
    if (!text || text.trim().length === 0) {
      return {
        mood_score: 5,
        summary: 'Günlük girişi yapılmadı.',
      };
    }

    // Kısa ve net prompt
    const prompt = `Günlük: "${text.substring(0, 300)}"

JSON ver: {"mood_score":1-10,"summary":"kısa özet"}`;

    const result = await model.generateContent(prompt);
    const response = await result.response;
    const responseText = response.text();

    console.log('Gemini raw response:', responseText);

    // JSON'u parse et
    // Bazen model ```json ``` içinde döndürebilir, temizle
    let cleanedResponse = responseText
      .replace(/```json\n?/g, '')
      .replace(/```\n?/g, '')
      .trim();

    // JSON objesini bul (ilk { ile son } arası)
    const jsonStart = cleanedResponse.indexOf('{');
    const jsonEnd = cleanedResponse.lastIndexOf('}');

    if (jsonStart === -1 || jsonEnd === -1) {
      console.log('JSON bulunamadı, varsayılan değerler kullanılıyor');
      return {
        mood_score: 5,
        summary: responseText.substring(0, 100) || 'Özet oluşturulamadı.',
      };
    }

    cleanedResponse = cleanedResponse.substring(jsonStart, jsonEnd + 1);
    console.log('Cleaned JSON:', cleanedResponse);

    const parsed = JSON.parse(cleanedResponse);

    // Validasyon
    const mood_score = Math.min(10, Math.max(1, parseInt(parsed.mood_score) || 5));
    const summary = parsed.summary || 'Özet oluşturulamadı.';

    return {
      mood_score,
      summary,
    };
  } catch (error) {
    console.error('Gemini AI analiz hatası:', error);

    // Rate limit hatası kontrolü
    if (error.message && error.message.includes('429')) {
      return {
        mood_score: 5,
        summary: 'AI şu an meşgul, lütfen 1 dakika bekleyip tekrar deneyin.',
        error: 'rate_limit',
      };
    }

    return {
      mood_score: 5,
      summary: 'AI analizi yapılamadı.',
      error: error.message,
    };
  }
}

/**
 * Akıllı Etiketler (Smart Chips) - Derinleşme soruları üretir
 * @param {string} text - Kullanıcının günlük metni
 * @returns {Promise<string[]>} - 3 adet soru içeren dizi
 */
export async function generateSmartChips(text) {
  try {
    if (!text || text.trim().length === 0) {
      return [];
    }

    const prompt = `Aşağıdaki günlük metnini analiz et. 
KURAL 1: Eğer metin detaylıysa, kullanıcının neyi eksik anlattığını bul ve derinine inmek için 3 kısa soru üret. 
KURAL 2: Eğer metin çok kısa, belirsiz veya tek kelimeden ibaretse (örneğin 'kötü', 'yoruldum' gibi), kullanıcının iç dünyasını açmasını sağlayacak, yargılamayan ve empati kuran genel keşif soruları üret (Örn: 'Bugün enerjini en çok ne sömürdü?', 'Şu an bedeninde nasıl bir his var?').
KURAL 3: Çıktı KESİNLİKLE başka hiçbir metin (markdown dahil) içermeyen, parse edilebilir saf bir JSON dizisi olmalıdır: ["Soru 1", "Soru 2", "Soru 3"]

Günlük metni: "${text}"`;

    const result = await model.generateContent(prompt);
    const response = await result.response;
    const responseText = response.text();

    console.log('Smart Chips raw response:', responseText);

    // JSON dizisini temizle ve parse et
    let cleanedResponse = responseText
      .replace(/```json\n?/g, '')
      .replace(/```\n?/g, '')
      .trim();

    // JSON dizisini bul (ilk [ ile son ] arası)
    const jsonStart = cleanedResponse.indexOf('[');
    const jsonEnd = cleanedResponse.lastIndexOf(']');

    if (jsonStart === -1 || jsonEnd === -1) {
      console.log('Smart Chips: JSON dizisi bulunamadı');
      return [];
    }

    cleanedResponse = cleanedResponse.substring(jsonStart, jsonEnd + 1);
    const parsed = JSON.parse(cleanedResponse);

    if (Array.isArray(parsed)) {
      return parsed.filter(item => typeof item === 'string');
    }

    return [];
  } catch (error) {
    console.error('Smart Chips üretme hatası:', error);
    return [];
  }
}

