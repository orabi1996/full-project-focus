// ============================================================================
// ARABIC TO ENGLISH NAME TRANSLITERATION UTILITY
// Automatically converts Arabic personal & family names to English
// ============================================================================

const COMMON_ARABIC_NAMES: Record<string, string> = {
  "أحمد": "Ahmed",
  "احمد": "Ahmed",
  "محمد": "Mohammed",
  "محمود": "Mahmoud",
  "مصطفى": "Mostafa",
  "مصطفي": "Mostafa",
  "علي": "Ali",
  "على": "Ali",
  "عمر": "Omar",
  "عمرو": "Amr",
  "خالد": "Khaled",
  "سعيد": "Saeed",
  "سعد": "Saad",
  "عبدالله": "Abdullah",
  "عبد الله": "Abdullah",
  "عبدالرحمن": "Abdulrahman",
  "عبد الرحمن": "Abdulrahman",
  "عبدالعزيز": "Abdulaziz",
  "عبد العزيز": "Abdulaziz",
  "عبدالملك": "Abdulmalik",
  "عبد الملك": "Abdulmalik",
  "عبداللطيف": "Abdullatif",
  "عبد اللطيف": "Abdullatif",
  "عبدالكريم": "Abdulkarim",
  "عبد الكريم": "Abdulkarim",
  "عبدالمجيد": "Abdulmajeed",
  "عبد المجيد": "Abdulmajeed",
  "أشرف": "Ashraf",
  "اشرف": "Ashraf",
  "عرابي": "Orabi",
  "عرابى": "Orabi",
  "ابراهيم": "Ibrahim",
  "إبراهيم": "Ibrahim",
  "اسماعيل": "Ismail",
  "إسماعيل": "Ismail",
  "يوسف": "Youssef",
  "ياسر": "Yasser",
  "يحيى": "Yahya",
  "يحيي": "Yahya",
  "طارق": "Tarek",
  "طلال": "Talal",
  "حسن": "Hassan",
  "حسين": "Hussein",
  "حسام": "Hossam",
  "حمد": "Hamad",
  "حمدان": "Hamdan",
  "سلمان": "Salman",
  "سلطان": "Sultan",
  "سليمان": "Sulaiman",
  "سالم": "Salem",
  "سليم": "Salim",
  "فهد": "Fahad",
  "فيصل": "Faisal",
  "فارس": "Fares",
  "تركي": "Turki",
  "تركى": "Turki",
  "بندر": "Bandar",
  "بدر": "Badr",
  "نواف": "Nawaf",
  "نايف": "Nayef",
  "ناصر": "Nasser",
  "منصور": "Mansour",
  "ماجد": "Majed",
  "مازن": "Mazen",
  "مروان": "Marwan",
  "مراد": "Murad",
  "وليد": "Waleed",
  "وائل": "Wael",
  "وسام": "Wissam",
  "زياد": "Ziad",
  "زيد": "Zaid",
  "زكريا": "Zakaria",
  "رامي": "Rami",
  "رامى": "Rami",
  "راشد": "Rashed",
  "رشيد": "Rashid",
  "رائد": "Raed",
  "ماهر": "Maher",
  "تامر": "Tamer",
  "سامر": "Samer",
  "سمير": "Samir",
  "نبيل": "Nabil",
  "عادل": "Adel",
  "عاصم": "Assem",
  "عصام": "Essam",
  "علاء": "Alaa",
  "عماد": "Emad",
  "إيهاب": "Ehab",
  "ايهاب": "Ehab",
  "أيمن": "Ayman",
  "ايمن": "Ayman",
  "أنس": "Anas",
  "انس": "Anas",
  "أسامة": "Osama",
  "اسامة": "Osama",
  "اسامه": "Osama",
  "أمجد": "Amjad",
  "امجد": "Amjad",
  "كريم": "Karim",
  "كامل": "Kamel",
  "كمال": "Kamal",
  "جمال": "Gamal",
  "جلال": "Galal",
  "شريف": "Sherif",
  "شادي": "Shady",
  "شادى": "Shady",
  "هشام": "Hisham",
  "هاني": "Hany",
  "هانى": "Hany",
  "يثرب": "Yathrib",
  "سارة": "Sarah",
  "ساره": "Sarah",
  "فاطمة": "Fatimah",
  "فاطمه": "Fatimah",
  "مريم": "Mariam",
  "نورة": "Noura",
  "نوره": "Noura",
  "نور": "Nour",
  "ريم": "Reem",
  "ريما": "Reema",
  "مها": "Maha",
  "منى": "Mona",
  "مني": "Mona",
  "هدى": "Huda",
  "هدي": "Huda",
  "هبة": "Heba",
  "هبه": "Heba",
  "آية": "Aya",
  "أية": "Aya",
  "اية": "Aya",
  "إيمان": "Eman",
  "ايمان": "Eman",
  "أمل": "Amal",
  "امل": "Amal",
  "ندى": "Nada",
  "ندي": "Nada",
  "نهى": "Noha",
  "نهي": "Noha",
  "سلمى": "Salma",
  "سلمي": "Salma",
  "ليلى": "Laila",
  "ليلي": "Laila",
  "لينا": "Lina",
  "لجين": "Lujain",
  "دانا": "Dana",
  "دينا": "Dina",
  "رنا": "Rana",
  "رانيا": "Rania",
  "روان": "Rawan",
  "يارا": "Yara",
  "ياسمين": "Yasmin",
  "عبير": "Abeer",
  "عائشة": "Aisha",
  "عائشه": "Aisha",
  "خديجة": "Khadijah",
  "زينب": "Zainab",
  "حنان": "Hanan",
  "سماح": "Samah",
  "سمر": "Samar",
  "سحر": "Sahar",
  "غادة": "Ghada",
  "غاده": "Ghada",
  "تغريد": "Taghreed",
  "خلود": "Kholoud",
  "جميلة": "Jamila",
  "لطيفة": "Latifa",
  "منيرة": "Munira",
  "نوف": "Nouf",
  "العنود": "Al-Anoud",
  "الجوهرة": "Al-Jawhara",
  "السعيد": "Al-Saeed",
  "العتيبي": "Al-Otaibi",
  "القحطاني": "Al-Qahtani",
  "الغامدي": "Al-Ghamdi",
  "الزهراني": "Al-Zahrani",
  "الدوسري": "Al-Dosari",
  "الشمري": "Al-Shammari",
  "الحربي": "Al-Harbi",
  "المطيري": "Al-Mutairi",
  "السبيعي": "Al-Subaie",
  "الشهري": "Al-Shehri",
  "المالكي": "Al-Malki",
  "العمري": "Al-Omari",
  "الرشيدي": "Al-Rashidi",
  "اليامي": "Al-Yami",
  "البلوي": "Al-Balawi",
  "الجهني": "Al-Juhani",
  "الشمراني": "Al-Shamrani",
  "العنزي": "Al-Anazi",
  "الخالدي": "Al-Khaldi",
  "الهاجري": "Al-Hajri",
  "المري": "Al-Marri",
  "الكواري": "Al-Kuwari",
  "الثاني": "Al-Thani",
  "النعيمي": "Al-Nuaimi",
  "المكتوم": "Al-Maktoum",
  "النهيان": "Al-Nahyan",
  "القاسمي": "Al-Qasimi",
  "الصباح": "Al-Sabah",
  "الخليفة": "Al-Khalifa",
  "البوسعيدي": "Al-Busaidi",
  "المصري": "El-Masry",
  "الشافعي": "El-Shafei",
  "السيد": "El-Sayed",
};

const CHAR_MAP: Record<string, string> = {
  "ا": "a",
  "أ": "a",
  "إ": "e",
  "آ": "aa",
  "ء": "",
  "ئ": "e",
  "ؤ": "o",
  "ب": "b",
  "ت": "t",
  "ث": "th",
  "ج": "j",
  "ح": "h",
  "خ": "kh",
  "د": "d",
  "ذ": "dh",
  "ر": "r",
  "ز": "z",
  "س": "s",
  "ش": "sh",
  "ص": "s",
  "ض": "d",
  "ط": "t",
  "ظ": "z",
  "ع": "a",
  "غ": "gh",
  "ف": "f",
  "ق": "q",
  "ك": "k",
  "ل": "l",
  "م": "m",
  "ن": "n",
  "ه": "h",
  "ة": "a",
  "و": "w",
  "ي": "y",
  "ى": "a",
  "َ": "a",
  "ُ": "u",
  "ِ": "i",
  "ّ": "",
  "ْ": "",
};

function capitalizeWord(word: string): string {
  if (!word) return "";
  return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
}

function transliterateSingleWord(word: string): string {
  const clean = word.trim();
  if (!clean) return "";

  if (COMMON_ARABIC_NAMES[clean]) {
    return COMMON_ARABIC_NAMES[clean];
  }

  // Handle "ال" prefix
  if (clean.startsWith("ال") && clean.length > 3) {
    const rest = clean.slice(2);
    if (COMMON_ARABIC_NAMES[rest]) {
      return `Al-${COMMON_ARABIC_NAMES[rest]}`;
    }
    return `Al-${transliterateSingleWord(rest)}`;
  }

  let out = "";
  for (let i = 0; i < clean.length; i++) {
    const ch = clean[i]!;
    if (i === 0 && (ch === "ي" || ch === "و")) {
      out += ch === "ي" ? "y" : "w";
    } else if (i > 0 && ch === "و" && i < clean.length - 1) {
      out += "ou";
    } else if (i > 0 && ch === "ي") {
      out += i === clean.length - 1 ? "i" : "ee";
    } else {
      out += CHAR_MAP[ch] !== undefined ? CHAR_MAP[ch] : ch;
    }
  }

  return capitalizeWord(out);
}

export function transliterateArabicName(input: string): string {
  const trimmed = input.trim();
  if (!trimmed) return "";

  // Check full string match first (e.g. "عبد الله")
  if (COMMON_ARABIC_NAMES[trimmed]) {
    return COMMON_ARABIC_NAMES[trimmed];
  }

  const parts = trimmed.split(/\s+/);
  const result: string[] = [];

  for (let i = 0; i < parts.length; i++) {
    const twoWord = i < parts.length - 1 ? `${parts[i]} ${parts[i + 1]}` : "";
    if (twoWord && COMMON_ARABIC_NAMES[twoWord]) {
      result.push(COMMON_ARABIC_NAMES[twoWord]);
      i++;
    } else {
      result.push(transliterateSingleWord(parts[i]!));
    }
  }

  return result.join(" ");
}
