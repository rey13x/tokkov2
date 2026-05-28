// Database nama random untuk bot testimoni
export const INDONESIA_NAMES = [
  "Budi", "Siti", "Ahmad", "Rina", "Setiawan", "Dewi", "Rudi", "Eka", "Fandri", "Lina",
  "Muhammad", "Siti", "Bambang", "Irene", "Hasan", "Yuni", "Wahab", "Fitri", "Suryanto", "Nani",
  "Agus", "Suwati", "Bambang", "Tri", "Andi", "Rosa", "Bimo", "Sinta", "Doni", "Novi",
  "Rahmat", "Ida", "Gunawan", "Wina", "Joni", "Ratih", "Sari", "Wulan", "Tono", "Sasha",
  "Kris", "Dwi", "Rizki", "Anum", "Teguh", "Putri", "Amir", "Qiqi", "Ivan", "Tuti",
  "Dika", "Lina", "Rando", "Devi", "Beno", "Rini", "Yani", "Nida", "Wildan", "Endah",
  "Hanif", "Gia", "Hafiz", "Ima", "Ridho", "Intan", "Sidiq", "Isti", "Jamal", "Jeni",
  "Karim", "Juwi", "Karyo", "Jenis", "Luthfi", "Kici", "Maher", "Kira", "Nizar", "Kiki",
  "Okta", "Kuni", "Padri", "Lani", "Qadri", "Lara", "Rahman", "Leni", "Saiful", "Lesa",
  "Taufik", "Lisa", "Ubaid", "Lita", "Vicky", "Liza", "Wandi", "Lylia", "Yusuf", "Mara"
];

export const ENGLISH_NAMES = [
  "John", "Sarah", "Michael", "Emma", "Robert", "Olivia", "James", "Ava", "David", "Isabella",
  "Richard", "Sophia", "Charles", "Charlotte", "Joseph", "Amelia", "Thomas", "Harper", "Daniel", "Evelyn",
  "Matthew", "Abigail", "Anthony", "Emily", "Mark", "Elizabeth", "Donald", "Avery", "Steven", "Ella",
  "Paul", "Scarlett", "Andrew", "Victoria", "Joshua", "Madison", "Kenneth", "Chloe", "Kevin", "Camila",
  "Brian", "Penelope", "George", "Riley", "Edward", "Aria", "Ronald", "Layla", "Timothy", "Lillian",
  "Jason", "Nora", "Jeffrey", "Mia", "Ryan", "Zoey", "Jacob", "Grace", "Gary", "Hannah",
  "Nicholas", "Lily", "Eric", "Luna", "Jonathan", "Zoe", "Stephen", "Paisley", "Larry", "Naomi",
  "Justin", "Eliana", "Scott", "Gianna", "Brandon", "Claire", "Benjamin", "Sadie", "Samuel", "Samantha",
  "Frank", "Katie", "Gregory", "Audrey", "Alexander", "Addison", "Patrick", "Bella", "Jack", "Aaliyah",
  "Dennis", "Ariana", "Jerry", "Leah", "Tyler", "Aurora", "Aaron", "Hailey", "Jose", "Ivy"
];

export const ENGLISH_SHORT_NAMES = [
  "Alex", "Sam", "Max", "Joe", "Leo", "Ben", "Tom", "Dan", "Rob", "Tim",
  "Zoe", "Amy", "Ana", "Eva", "Ivy", "May", "Nia", "Rae", "Sky", "Tia"
];

export function getRandomName(): string {
  const nameGroups = [
    INDONESIA_NAMES,
    ENGLISH_NAMES,
    ENGLISH_SHORT_NAMES
  ];
  
  const randomGroup = nameGroups[Math.floor(Math.random() * nameGroups.length)];
  return randomGroup[Math.floor(Math.random() * randomGroup.length)];
}

export function getRandomNames(count: number): string[] {
  const names: string[] = [];
  for (let i = 0; i < count; i++) {
    names.push(getRandomName());
  }
  return names;
}

// Random testimoni templates
const TESTIMONI_TEMPLATES = [
  "Layanan ini sangat membantu saya dalam {context}. Highly recommended!",
  "Kualitasnya luar biasa! Saya sangat puas dengan {context}.",
  "Terbaik yang pernah saya coba. {context} benar-benar membuat perbedaan.",
  "{context} ini sangat berguna dan efisien. Terima kasih!",
  "Tidak menyangka {context} bisa sebaik ini. Sudah paling bagus!",
  "Sempurna untuk kebutuhan saya. {context} tidak mengecewakan.",
  "{context} nya keren banget! Definitely worth it.",
  "Lumayan bagus sih. {context} nya oke lah.",
  "Okay banget. Tidak ada yang disayangkan dengan {context}.",
  "5 stars untuk {context}! Mantap jiwa!",
  "Jadi lebih produktif berkat {context}. Top markotop!",
  "Suka sekali dengan {context}. Cocok banget untuk saya.",
  "Yang ini beneran beda. {context} nya quality.",
  "Rekomendasi banget untuk {context} ini!",
  "Gokil sih. {context} ini benar-benar membantu!"
];

const CONTEXT_WORDS = [
  "kualitas", "layanan", "fitur", "harga", "desain", "pengalaman", 
  "support", "kecepatan", "kemudahan", "hasil", "value", "performance"
];

export function getRandomTestimoni(): string {
  const template = TESTIMONI_TEMPLATES[Math.floor(Math.random() * TESTIMONI_TEMPLATES.length)];
  const context = CONTEXT_WORDS[Math.floor(Math.random() * CONTEXT_WORDS.length)];
  return template.replace("{context}", context);
}
