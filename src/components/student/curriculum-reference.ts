// Built-in reference chapters and topics shown as "Suggested" in the Learn pickers.
// They are common school/diploma syllabus outlines (NCERT-style) to help students get started;
// students can always type their own chapter or topic. Edit or extend freely.

type ChapterMap = Record<string, string[]>;

const MATHEMATICS: ChapterMap = {
  "Real Numbers": ["Euclid's Division Lemma", "Fundamental Theorem of Arithmetic", "Irrational Numbers", "Decimal Expansions of Rational Numbers"],
  "Polynomials": ["Zeroes of a Polynomial", "Relationship between Zeroes and Coefficients", "Division Algorithm for Polynomials"],
  "Pair of Linear Equations in Two Variables": ["Graphical Method", "Substitution Method", "Elimination Method", "Cross-Multiplication Method"],
  "Quadratic Equations": ["Factorisation Method", "Completing the Square", "Quadratic Formula", "Nature of Roots"],
  "Arithmetic Progressions": ["nth Term of an AP", "Sum of First n Terms"],
  "Triangles": ["Similar Triangles", "Basic Proportionality Theorem", "Criteria for Similarity", "Pythagoras Theorem"],
  "Coordinate Geometry": ["Distance Formula", "Section Formula", "Area of a Triangle"],
  "Introduction to Trigonometry": ["Trigonometric Ratios", "Trigonometric Ratios of Specific Angles", "Trigonometric Identities"],
  "Some Applications of Trigonometry": ["Heights and Distances", "Angles of Elevation and Depression"],
  "Circles": ["Tangent to a Circle", "Number of Tangents from a Point"],
  "Areas Related to Circles": ["Perimeter and Area of a Circle", "Areas of Sector and Segment"],
  "Surface Areas and Volumes": ["Combinations of Solids", "Conversion of Solids", "Frustum of a Cone"],
  "Statistics": ["Mean of Grouped Data", "Mode of Grouped Data", "Median of Grouped Data"],
  "Probability": ["Classical Definition of Probability", "Simple Problems on Probability"],
};

const SCIENCE: ChapterMap = {
  "Chemical Reactions and Equations": ["Balancing Chemical Equations", "Types of Chemical Reactions", "Corrosion and Rancidity"],
  "Acids, Bases and Salts": ["Properties of Acids and Bases", "pH Scale", "Common Salts"],
  "Metals and Non-metals": ["Physical and Chemical Properties", "Reactivity Series", "Ionic Compounds", "Corrosion"],
  "Carbon and its Compounds": ["Covalent Bonding", "Homologous Series and Nomenclature", "Chemical Properties of Carbon Compounds", "Soaps and Detergents"],
  "Life Processes": ["Nutrition", "Respiration", "Transportation", "Excretion"],
  "Control and Coordination": ["Nervous System", "Reflex Action", "Plant Hormones", "Hormones in Animals"],
  "How do Organisms Reproduce?": ["Asexual Reproduction", "Sexual Reproduction in Plants", "Human Reproduction"],
  "Heredity": ["Mendel's Laws of Inheritance", "Sex Determination", "Variations and Traits"],
  "Light - Reflection and Refraction": ["Reflection by Spherical Mirrors", "Mirror Formula and Magnification", "Refraction of Light", "Lens Formula and Power"],
  "The Human Eye and the Colourful World": ["Defects of Vision", "Refraction through a Prism", "Scattering of Light"],
  "Electricity": ["Ohm's Law", "Resistance and Resistivity", "Series and Parallel Circuits", "Heating Effect of Current"],
  "Magnetic Effects of Electric Current": ["Magnetic Field and Field Lines", "Electromagnetic Induction", "Electric Motor and Generator"],
  "Our Environment": ["Ecosystem and Food Chains", "Ozone Layer Depletion", "Waste Management"],
};

const HISTORY: ChapterMap = {
  "The Rise of Nationalism in Europe": ["French Revolution and the Idea of the Nation", "Unification of Germany", "Unification of Italy"],
  "Nationalism in India": ["Non-Cooperation Movement", "Civil Disobedience Movement", "Salt March"],
  "The Making of a Global World": ["The Silk Routes", "The Great Depression"],
  "The Age of Industrialisation": ["Industrial Revolution", "Industrialisation in India"],
  "Print Culture and the Modern World": ["Invention of Printing", "Print and Social Change in India"],
};
const GEOGRAPHY: ChapterMap = {
  "Resources and Development": ["Types of Resources", "Land Use Pattern", "Soil Types and Conservation"],
  "Forest and Wildlife Resources": ["Biodiversity", "Conservation of Forests"],
  "Water Resources": ["Multipurpose River Projects", "Rainwater Harvesting"],
  "Agriculture": ["Types of Farming", "Major Crops", "Technological Reforms"],
  "Minerals and Energy Resources": ["Types of Minerals", "Conventional Sources of Energy", "Non-conventional Sources of Energy"],
  "Manufacturing Industries": ["Classification of Industries", "Industrial Pollution"],
  "Lifelines of National Economy": ["Roadways and Railways", "Ports and Airways", "Communication and Trade"],
};
const CIVICS: ChapterMap = {
  "Power Sharing": ["Belgium and Sri Lanka", "Forms of Power Sharing"],
  "Federalism": ["Features of Federalism", "Decentralisation in India"],
  "Gender, Religion and Caste": ["Gender and Politics", "Religion and Politics", "Caste and Politics"],
  "Political Parties": ["Functions of Political Parties", "National and State Parties"],
  "Outcomes of Democracy": ["Accountable Government", "Economic Outcomes of Democracy"],
};
const ECONOMICS: ChapterMap = {
  "Development": ["Income and Other Goals", "Human Development Indicators", "Sustainability of Development"],
  "Sectors of the Indian Economy": ["Primary, Secondary and Tertiary Sectors", "Organised and Unorganised Sectors"],
  "Money and Credit": ["Modern Forms of Money", "Formal and Informal Credit"],
  "Globalisation and the Indian Economy": ["Multinational Corporations", "Foreign Trade and Liberalisation"],
  "Consumer Rights": ["Consumer Movement", "Rights of Consumers"],
};
const SOCIAL_SCIENCE: ChapterMap = { ...HISTORY, ...GEOGRAPHY, ...CIVICS, ...ECONOMICS };

const PHYSICS: ChapterMap = {
  "Motion": ["Distance and Displacement", "Speed, Velocity and Acceleration", "Equations of Motion"],
  "Force and Laws of Motion": ["Newton's Laws of Motion", "Momentum", "Conservation of Momentum"],
  "Gravitation": ["Universal Law of Gravitation", "Free Fall", "Weight and Mass"],
  "Work and Energy": ["Work", "Kinetic and Potential Energy", "Power"],
  "Sound": ["Production and Propagation of Sound", "Reflection of Sound", "Characteristics of Sound"],
  "Heat and Thermodynamics": ["Temperature and Heat", "Specific Heat Capacity", "Laws of Thermodynamics"],
  "Light": ["Reflection", "Refraction", "Lenses and Mirrors"],
  "Electricity and Magnetism": ["Electric Current and Circuits", "Ohm's Law", "Magnetic Effects of Current"],
};
const CHEMISTRY: ChapterMap = {
  "Matter in Our Surroundings": ["States of Matter", "Change of State"],
  "Atoms and Molecules": ["Laws of Chemical Combination", "Mole Concept"],
  "Structure of the Atom": ["Atomic Models", "Electronic Configuration"],
  "Periodic Classification of Elements": ["Mendeleev's Periodic Table", "Modern Periodic Table", "Periodic Trends"],
  "Chemical Bonding": ["Ionic Bonding", "Covalent Bonding"],
  "Acids, Bases and Salts": ["Properties of Acids and Bases", "pH Scale"],
  "Metals and Non-metals": ["Properties of Metals", "Reactivity Series"],
  "Carbon and its Compounds": ["Covalent Bonding in Carbon", "Hydrocarbons", "Functional Groups"],
};
const BIOLOGY: ChapterMap = {
  "The Fundamental Unit of Life": ["Cell Structure", "Cell Organelles"],
  "Tissues": ["Plant Tissues", "Animal Tissues"],
  "Life Processes": ["Nutrition", "Respiration", "Transportation", "Excretion"],
  "Control and Coordination": ["Nervous System", "Hormones"],
  "Reproduction": ["Asexual Reproduction", "Sexual Reproduction"],
  "Heredity and Evolution": ["Mendel's Experiments", "Evolution"],
  "Our Environment": ["Ecosystem", "Food Chains and Food Webs"],
};

const ENGLISH: ChapterMap = {
  "Reading Comprehension": ["Unseen Passages", "Factual and Discursive Passages"],
  "Writing Skills": ["Formal Letter", "Informal Letter", "Notice and Message Writing", "Essay and Article Writing"],
  "Grammar": ["Tenses", "Modals", "Determiners", "Reported Speech", "Subject-Verb Agreement"],
  "Literature - Prose": ["Summary and Theme", "Character Sketch"],
  "Literature - Poetry": ["Poem Summary", "Poetic Devices"],
};
const LANGUAGE: ChapterMap = {
  "Grammar": ["Nouns and Pronouns", "Verbs and Tenses", "Sentence Formation"],
  "Reading Comprehension": ["Unseen Passage"],
  "Writing Skills": ["Letter Writing", "Essay Writing"],
  "Prose": ["Summary and Theme", "Character Sketch"],
  "Poetry": ["Poem Summary", "Poetic Devices"],
};
const COMPUTER_SCIENCE: ChapterMap = {
  "Introduction to Computers": ["Hardware and Software", "Input and Output Devices"],
  "Programming Basics": ["Variables and Data Types", "Conditional Statements", "Loops", "Functions"],
  "Data Structures": ["Arrays and Lists", "Stacks and Queues"],
  "Computer Networks": ["Network Types and Topologies", "Internet Basics"],
  "Databases and SQL": ["Tables and Keys", "Basic SQL Queries"],
  "Web Basics": ["HTML Basics", "CSS Basics"],
};
const EVS: ChapterMap = {
  "Our Environment": ["Living and Non-living Things", "Ecosystem"],
  "Water": ["Sources of Water", "Water Conservation"],
  "Air and Weather": ["Composition of Air", "Weather and Climate"],
  "Food and Nutrition": ["Balanced Diet", "Food Sources"],
  "Natural Resources": ["Renewable and Non-renewable Resources", "Conservation"],
};

const DIPLOMA: ChapterMap = {
  "Unit 1": ["Basic Concepts and Definitions"],
  "Unit 2": ["Core Principles"],
  "Unit 3": ["Methods and Techniques"],
  "Unit 4": ["Applications"],
  "Unit 5": ["Case Studies and Problem Solving"],
};

// subject keyword -> outline. A subject matches when its name contains the keyword.
const SUBJECTS: Array<[string[], ChapterMap]> = [
  [["social science", "social studies", "sst"], SOCIAL_SCIENCE],
  [["mathematics", "maths", "math"], MATHEMATICS],
  [["environmental", "evs"], EVS],
  [["computer"], COMPUTER_SCIENCE],
  [["physics"], PHYSICS],
  [["chemistry"], CHEMISTRY],
  [["biology"], BIOLOGY],
  [["science"], SCIENCE],
  [["history"], HISTORY],
  [["geography"], GEOGRAPHY],
  [["civics", "political"], CIVICS],
  [["economics"], ECONOMICS],
  [["english"], ENGLISH],
  [["hindi", "marathi", "sanskrit"], LANGUAGE],
];

const GENERIC_CHAPTERS = [
  "Introduction",
  "Fundamentals",
  "Core Concepts",
  "Applications",
  "Advanced Topics",
  "Revision and Practice",
];
const GENERIC_TOPICS = [
  "Introduction and Key Terms",
  "Core Concepts",
  "Important Formulas and Rules",
  "Solved Examples",
  "Practice Questions and Revision",
];

function outlineFor(subject: string): ChapterMap | null {
  const name = subject.trim().toLowerCase();
  if (!name) return null;
  for (const [keys, map] of SUBJECTS) {
    if (keys.some((k) => name === k || name.includes(k))) return map;
  }
  return null;
}

/** Suggested chapters for a subject (a generic outline when the subject is not recognised). */
export function getReferenceChapters(subject: string, isDiploma = false): string[] {
  const map = outlineFor(subject);
  if (map) return Object.keys(map);
  return isDiploma ? Object.keys(DIPLOMA) : GENERIC_CHAPTERS;
}

/** Suggested topics for a chapter (generic study topics when the chapter is not recognised). */
export function getReferenceTopics(subject: string, chapter: string): string[] {
  const map = outlineFor(subject);
  const key = chapter.trim().toLowerCase();
  if (map && key) {
    const hit = Object.keys(map).find((c) => c.toLowerCase() === key);
    if (hit) return map[hit];
  }
  return GENERIC_TOPICS;
}
