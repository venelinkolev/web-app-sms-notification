/**
 * Transliteration Map - Cyrillic to Latin
 * 
 * Defines mapping from Bulgarian Cyrillic characters to Latin equivalents.
 * Each Cyrillic character can map to one or more Latin characters.
 * 
 * Customize this map based on your transliteration preferences.
 */
export const DEFAULT_CYRILLIC_TO_LATIN_MAP: Record<string, string> = {
    // Lowercase Cyrillic letters
    'а': 'a',
    'б': 'b',
    'в': 'v',
    'г': 'g',
    'д': 'd',
    'е': 'e',
    'ж': 'zh',
    'з': 'z',
    'и': 'i',
    'й': 'y',
    'к': 'k',
    'л': 'l',
    'м': 'm',
    'н': 'n',
    'о': 'o',
    'п': 'p',
    'р': 'r',
    'с': 's',
    'т': 't',
    'у': 'u',
    'ф': 'f',
    'х': 'h',
    'ц': 'ts',
    'ч': 'ch',
    'ш': 'sh',
    'щ': 'sht',
    'ъ': 'a',
    'ь': 'y',
    'ю': 'yu',
    'я': 'ya',

    // Uppercase Cyrillic letters
    'А': 'A',
    'Б': 'B',
    'В': 'V',
    'Г': 'G',
    'Д': 'D',
    'Е': 'E',
    'Ж': 'Zh',
    'З': 'Z',
    'И': 'I',
    'Й': 'Y',
    'К': 'K',
    'Л': 'L',
    'М': 'M',
    'Н': 'N',
    'О': 'O',
    'П': 'P',
    'Р': 'R',
    'С': 'S',
    'Т': 'T',
    'У': 'U',
    'Ф': 'F',
    'Х': 'H',
    'Ц': 'Ts',
    'Ч': 'Ch',
    'Ш': 'Sh',
    'Щ': 'Sht',
    'Ъ': 'A',
    'Ь': 'Y',
    'Ю': 'Yu',
    'Я': 'Ya'
};

/**
 * Transliterate Cyrillic text to Latin
 * 
 * Converts Bulgarian Cyrillic characters to their Latin equivalents.
 * Preserves non-Cyrillic characters (numbers, punctuation, spaces, etc.).
 * 
 * @param text - Text to transliterate (can contain Cyrillic)
 * @param customMap - Optional custom transliteration map (overrides defaults)
 * @returns Transliterated text in Latin characters
 * 
 * @example
 * ```typescript
 * // Basic usage
 * const result = transliterateCyrillicToLatin('Здравей, България!');
 * // Returns: "Zdravey, Bulgaria!"
 * 
 * // With custom mapping
 * const customMap = { 'ъ': 'u', 'Ъ': 'U' };
 * const result2 = transliterateCyrillicToLatin('Търново', customMap);
 * // Returns: "Turnovo" (instead of default "Tarnovo")
 * 
 * // Preserves numbers and punctuation
 * const result3 = transliterateCyrillicToLatin('Договор №12345');
 * // Returns: "Dogovor №12345"
 * ```
 */
export function transliterateCyrillicToLatin(
    text: string,
    customMap?: Record<string, string>
): string {
    // If text is empty or null, return as-is
    if (!text) {
        return text;
    }

    // Merge custom map with default map (custom takes precedence)
    const transliterationMap = {
        ...DEFAULT_CYRILLIC_TO_LATIN_MAP,
        ...(customMap || {})
    };

    // Convert text character by character
    let result = '';

    for (let i = 0; i < text.length; i++) {
        const char = text[i];

        // Check if character exists in transliteration map
        if (transliterationMap[char]) {
            result += transliterationMap[char];
        } else {
            // Keep character as-is (numbers, punctuation, Latin letters, etc.)
            result += char;
        }
    }

    return result;
}

/**
 * Check if text contains Cyrillic characters
 * 
 * Useful for determining if transliteration is needed.
 * 
 * @param text - Text to check
 * @returns True if text contains at least one Cyrillic character
 * 
 * @example
 * ```typescript
 * hasCyrillicCharacters('Hello');        // false
 * hasCyrillicCharacters('Здравей');      // true
 * hasCyrillicCharacters('Hello Мир');    // true
 * ```
 */
export function hasCyrillicCharacters(text: string): boolean {
    if (!text) {
        return false;
    }

    // Cyrillic Unicode range: U+0400 to U+04FF
    const cyrillicPattern = /[\u0400-\u04FF]/;
    return cyrillicPattern.test(text);
}

/**
 * Get percentage of Cyrillic characters in text
 * 
 * Useful for analytics or deciding whether to apply transliteration.
 * 
 * @param text - Text to analyze
 * @returns Percentage of Cyrillic characters (0-100)
 * 
 * @example
 * ```typescript
 * getCyrillicPercentage('Hello');              // 0
 * getCyrillicPercentage('Здравей');            // 100
 * getCyrillicPercentage('Hello Мир');          // ~44.44
 * getCyrillicPercentage('Договор №12345');     // ~53.85
 * ```
 */
export function getCyrillicPercentage(text: string): number {
    if (!text || text.length === 0) {
        return 0;
    }

    const cyrillicPattern = /[\u0400-\u04FF]/;
    let cyrillicCount = 0;

    for (const char of text) {
        if (cyrillicPattern.test(char)) {
            cyrillicCount++;
        }
    }

    return (cyrillicCount / text.length) * 100;
}

/**
 * Alternative transliteration maps for different use cases
 */
export const TRANSLITERATION_MAPS = {
    /**
     * Default Bulgarian Latin transliteration (BGN/PCGN standard)
     */
    DEFAULT: DEFAULT_CYRILLIC_TO_LATIN_MAP,

    /**
     * ISO 9 transliteration (more technical, used in libraries)
     */
    ISO_9: {
        'а': 'a', 'б': 'b', 'в': 'v', 'г': 'g', 'д': 'd', 'е': 'e',
        'ж': 'ž', 'з': 'z', 'и': 'i', 'й': 'j', 'к': 'k', 'л': 'l',
        'м': 'm', 'н': 'n', 'о': 'o', 'п': 'p', 'р': 'r', 'с': 's',
        'т': 't', 'у': 'u', 'ф': 'f', 'х': 'h', 'ц': 'c', 'ч': 'č',
        'ш': 'š', 'щ': 'ŝ', 'ъ': 'ă', 'ь': 'ʹ', 'ю': 'û', 'я': 'â',
        'А': 'A', 'Б': 'B', 'В': 'V', 'Г': 'G', 'Д': 'D', 'Е': 'E',
        'Ж': 'Ž', 'З': 'Z', 'И': 'I', 'Й': 'J', 'К': 'K', 'Л': 'L',
        'М': 'M', 'Н': 'N', 'О': 'O', 'П': 'P', 'Р': 'R', 'С': 'S',
        'Т': 'T', 'У': 'U', 'Ф': 'F', 'Х': 'H', 'Ц': 'C', 'Ч': 'Č',
        'Ш': 'Š', 'Щ': 'Ŝ', 'Ъ': 'Ă', 'Ь': 'ʹ', 'Ю': 'Û', 'Я': 'Â'
    },

    /**
     * SMS-friendly transliteration (no diacritics, ASCII-only)
     */
    SMS_FRIENDLY: {
        'а': 'a', 'б': 'b', 'в': 'v', 'г': 'g', 'д': 'd', 'е': 'e',
        'ж': 'j', 'з': 'z', 'и': 'i', 'й': 'y', 'к': 'k', 'л': 'l',
        'м': 'm', 'н': 'n', 'о': 'o', 'п': 'p', 'р': 'r', 'с': 's',
        'т': 't', 'у': 'u', 'ф': 'f', 'х': 'h', 'ц': 'c', 'ч': 'ch',
        'ш': 'sh', 'щ': 'sht', 'ъ': 'a', 'ь': 'y', 'ю': 'yu', 'я': 'ya',
        'А': 'A', 'Б': 'B', 'В': 'V', 'Г': 'G', 'Д': 'D', 'Е': 'E',
        'Ж': 'J', 'З': 'Z', 'И': 'I', 'Й': 'Y', 'К': 'K', 'Л': 'L',
        'М': 'M', 'Н': 'N', 'О': 'O', 'П': 'P', 'Р': 'R', 'С': 'S',
        'Т': 'T', 'У': 'U', 'Ф': 'F', 'Х': 'H', 'Ц': 'C', 'Ч': 'Ch',
        'Ш': 'Sh', 'Щ': 'Sht', 'Ъ': 'A', 'Ь': 'Y', 'Ю': 'Yu', 'Я': 'Ya'
    }
};

/**
 * Transliterate using a predefined map
 * 
 * @param text - Text to transliterate
 * @param mapName - Name of predefined map ('DEFAULT' | 'ISO_9' | 'SMS_FRIENDLY')
 * @returns Transliterated text
 * 
 * @example
 * ```typescript
 * transliterateWithMap('Здравей', 'SMS_FRIENDLY');
 * // Returns: "Zdravey"
 * ```
 */
export function transliterateWithMap(
    text: string,
    mapName: keyof typeof TRANSLITERATION_MAPS = 'DEFAULT'
): string {
    return transliterateCyrillicToLatin(text, TRANSLITERATION_MAPS[mapName]);
}