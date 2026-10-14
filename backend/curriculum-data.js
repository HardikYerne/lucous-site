// Curriculum definitions for LUCOUS
// Data-driven educational hierarchy: Board -> Grade (Class) -> Subject -> Chapter -> Topic -> Contents & Questions
// Used for database seeding and resilient offline development / testing.

const CURRICULUM_DATA = [
  // 1. CBSE — Class 10 Mathematics
  {
    board: "CBSE",
    grade: "Class 10",
    subject: "Mathematics",
    chapters: [
      {
        name: "Real Numbers",
        topics: [
          {
            name: "Euclid's Division Lemma",
            contents: [
              {
                title: "Understanding Euclid's Division Lemma",
                order: 1,
                body: "For any two positive integers a and b, there exist unique integers q and r such that a = bq + r, where 0 ≤ r < b.\n\nThis fundamental lemma forms the foundation of the Euclidean algorithm for calculating the Highest Common Factor (HCF) of two integers systematically.\n\nExample:\nTo find the HCF of 45 and 10:\n45 = 10 × 4 + 5\n10 = 5 × 2 + 0\nSince remainder is 0, the HCF is 5.",
              },
            ],
            questions: [
              {
                text: "What is the HCF of 8 and 12?",
                optionA: "2",
                optionB: "4",
                optionC: "6",
                optionD: "8",
                correct: 1,
                difficulty: "EASY",
                explanation: "12 = 8×1 + 4; 8 = 4×2 + 0. The divisor at remainder 0 is 4.",
              },
              {
                text: "Euclid's Division Lemma states a = bq + r where:",
                optionA: "r > b",
                optionB: "0 ≤ r < b",
                optionC: "r = b",
                optionD: "r < 0",
                correct: 1,
                difficulty: "EASY",
                explanation: "The remainder r is always non-negative and strictly less than the divisor b.",
              },
              {
                text: "The smallest prime number is:",
                optionA: "0",
                optionB: "1",
                optionC: "2",
                optionD: "3",
                correct: 2,
                difficulty: "EASY",
                explanation: "2 is the smallest prime and the only even prime number.",
              },
              {
                text: "HCF × LCM of two numbers a and b equals:",
                optionA: "Sum of the numbers (a + b)",
                optionB: "Product of the numbers (a × b)",
                optionC: "Difference of the numbers (a - b)",
                optionD: "Twice the product (2ab)",
                correct: 1,
                difficulty: "MEDIUM",
                explanation: "For any two positive integers a and b, HCF(a, b) × LCM(a, b) = a × b.",
              },
              {
                text: "If a = 65 and b = 15, then by Euclid's lemma the remainder r is:",
                optionA: "0",
                optionB: "5",
                optionC: "10",
                optionD: "15",
                correct: 1,
                difficulty: "MEDIUM",
                explanation: "65 = 15 × 4 + 5. Remainder r is 5, where 0 ≤ 5 < 15.",
              },
            ],
          },
          {
            name: "Fundamental Theorem of Arithmetic",
            contents: [
              {
                title: "Fundamental Theorem of Arithmetic",
                order: 1,
                body: "Every composite number can be uniquely expressed (factorised) as a product of prime numbers, apart from the order in which the prime factors occur.\n\nFor example:\n120 = 2³ × 3 × 5\n\nThis uniqueness enables us to prove the irrationality of numbers like √2, √3, and √5.",
              },
            ],
            questions: [
              {
                text: "The prime factorisation of 96 is:",
                optionA: "2⁴ × 6",
                optionB: "2⁵ × 3",
                optionC: "2³ × 12",
                optionD: "8 × 12",
                correct: 1,
                difficulty: "MEDIUM",
                explanation: "96 = 2 × 2 × 2 × 2 × 2 × 3 = 2⁵ × 3.",
              },
              {
                text: "Which of the following numbers is irrational?",
                optionA: "√4",
                optionB: "√9",
                optionC: "√5",
                optionD: "√25",
                correct: 2,
                difficulty: "EASY",
                explanation: "√5 cannot be represented as p/q where p, q are integers and q ≠ 0.",
              },
              {
                text: "Which of the following is NOT a composite number?",
                optionA: "4",
                optionB: "9",
                optionC: "15",
                optionD: "31",
                correct: 3,
                difficulty: "EASY",
                explanation: "31 has only two factors: 1 and 31, so it is prime, not composite.",
              },
              {
                text: "If two positive integers a and b are written as a = x³y² and b = xy³, where x, y are prime numbers, then HCF(a, b) is:",
                optionA: "xy",
                optionB: "xy²",
                optionC: "x³y³",
                optionD: "x²y²",
                correct: 1,
                difficulty: "MEDIUM",
                explanation: "HCF is the product of smallest powers of common prime factors: x¹ × y² = xy².",
              },
              {
                text: "If LCM(a, b) = 360 and a × b = 1800, what is HCF(a, b)?",
                optionA: "5",
                optionB: "10",
                optionC: "15",
                optionD: "20",
                correct: 0,
                difficulty: "MEDIUM",
                explanation: "HCF = (a × b) / LCM = 1800 / 360 = 5.",
              },
            ],
          },
        ],
      },
      {
        name: "Quadratic Equations",
        topics: [
          {
            name: "Standard Form and Roots",
            contents: [
              {
                title: "Quadratic Equations in Standard Form",
                order: 1,
                body: "A quadratic equation in variable x is an equation of the form ax² + bx + c = 0, where a, b, c are real numbers and a ≠ 0.\n\nA real number α is called a root of the quadratic equation if aα² + bα + c = 0.",
              },
            ],
            questions: [
              {
                text: "Which of the following is a quadratic equation?",
                optionA: "2x + 3 = 0",
                optionB: "x² + 2x - 3 = 0",
                optionC: "x³ = 8",
                optionD: "1/x = 2",
                correct: 1,
                difficulty: "EASY",
                explanation: "A quadratic equation has maximum degree 2.",
              },
              {
                text: "The roots of x² - 9 = 0 are:",
                optionA: "3, -3",
                optionB: "9, -9",
                optionC: "0, 3",
                optionD: "3, 3",
                correct: 0,
                difficulty: "EASY",
                explanation: "x² = 9 implies x = ±3.",
              },
            ],
          },
          {
            name: "Quadratic Formula and Discriminant",
            contents: [
              {
                title: "The Nature of Roots and Discriminant",
                order: 1,
                body: "For ax² + bx + c = 0, the discriminant D = b² - 4ac determines the nature of the roots:\n1. If D > 0: Two distinct real roots (-b ± √D) / 2a.\n2. If D = 0: Two equal real roots (-b / 2a).\n3. If D < 0: No real roots.",
              },
            ],
            questions: [
              {
                text: "The discriminant of x² - 5x + 6 = 0 is:",
                optionA: "1",
                optionB: "-1",
                optionC: "25",
                optionD: "5",
                correct: 0,
                difficulty: "MEDIUM",
                explanation: "D = b² - 4ac = (-5)² - 4(1)(6) = 25 - 24 = 1.",
              },
              {
                text: "If D = b² - 4ac < 0, the quadratic equation has:",
                optionA: "Two equal real roots",
                optionB: "Two distinct real roots",
                optionC: "No real roots",
                optionD: "Infinite roots",
                correct: 2,
                difficulty: "EASY",
                explanation: "Negative discriminant indicates roots are complex/non-real.",
              },
            ],
          },
        ],
      },
    ],
  },

  // 2. CBSE — Class 10 Science
  {
    board: "CBSE",
    grade: "Class 10",
    subject: "Science",
    chapters: [
      {
        name: "Chemical Reactions and Equations",
        topics: [
          {
            name: "Types of Chemical Reactions",
            contents: [
              {
                title: "Combination, Decomposition, and Displacement",
                order: 1,
                body: "Chemical reactions transform reactants into products with different chemical properties:\n\n1. Combination: Two or more substances combine to form a single substance (A + B → AB).\n2. Decomposition: A single compound breaks down into two or more simpler substances (AB → A + B).\n3. Displacement: A more reactive element replaces a less reactive element from its salt solution (A + BC → AC + B).\n4. Double Displacement: Exchange of ions between two compounds.\n5. Redox: Oxidation and reduction happen simultaneously.",
              },
            ],
            questions: [
              {
                text: "2H₂ + O₂ → 2H₂O is which type of reaction?",
                optionA: "Decomposition",
                optionB: "Combination",
                optionC: "Displacement",
                optionD: "Neutralisation",
                correct: 1,
                difficulty: "EASY",
                explanation: "Hydrogen and oxygen combine to form a single product, water.",
              },
              {
                text: "Fe + CuSO₄ → FeSO₄ + Cu is an example of:",
                optionA: "Combination reaction",
                optionB: "Displacement reaction",
                optionC: "Decomposition reaction",
                optionD: "Precipitation reaction only",
                correct: 1,
                difficulty: "MEDIUM",
                explanation: "Iron is more reactive than copper and displaces it from copper sulphate solution.",
              },
            ],
          },
        ],
      },
      {
        name: "Light – Reflection and Refraction",
        topics: [
          {
            name: "Laws of Reflection",
            contents: [
              {
                title: "The Laws of Reflection and Plane Mirrors",
                order: 1,
                body: "When light falls on a polished smooth surface like a mirror, it reflects following two fundamental laws:\n\n1. The angle of incidence equals the angle of reflection (∠i = ∠r).\n2. The incident ray, the normal to the mirror at the point of incidence, and the reflected ray, all lie in the same plane.\n\nImage formed by a plane mirror is always virtual, erect, laterally inverted, and the same size as the object.",
              },
            ],
            questions: [
              {
                text: "If the angle of incidence is 30°, what is the angle of reflection?",
                optionA: "60°",
                optionB: "30°",
                optionC: "90°",
                optionD: "15°",
                correct: 1,
                difficulty: "EASY",
                explanation: "According to the first law of reflection, ∠r = ∠i = 30°.",
              },
              {
                text: "The image formed by a plane mirror is always:",
                optionA: "Real and inverted",
                optionB: "Virtual and erect",
                optionC: "Real and erect",
                optionD: "Virtual and inverted",
                correct: 1,
                difficulty: "EASY",
                explanation: "Plane mirrors form virtual, upright, laterally inverted images.",
              },
            ],
          },
        ],
      },
    ],
  },

  // 3. Maharashtra State Board — Class 10
  {
    board: "Maharashtra State Board",
    grade: "Class 10",
    subject: "Mathematics",
    chapters: [
      {
        name: "Linear Equations in Two Variables",
        topics: [
          {
            name: "Simultaneous Equations and Cramer's Rule",
            contents: [
              {
                title: "Solving Simultaneous Equations by Determinant Method",
                order: 1,
                body: "Cramer's Rule uses determinants to solve a system of linear equations:\na₁x + b₁y = c₁\na₂x + b₂y = c₂\n\nDeterminant D = a₁b₂ - a₂b₁\nDx = c₁b₂ - c₂b₁\nDy = a₁c₂ - a₂c₁\n\nThen x = Dx / D and y = Dy / D (when D ≠ 0).",
              },
            ],
            questions: [
              {
                text: "In Cramer's rule, x is calculated as:",
                optionA: "D / Dx",
                optionB: "Dx / D",
                optionC: "Dy / D",
                optionD: "Dx × D",
                correct: 1,
                difficulty: "EASY",
                explanation: "By Cramer's rule, x = Dx / D and y = Dy / D.",
              },
              {
                text: "If determinant D = 0, the system has:",
                optionA: "Unique solution",
                optionB: "No unique solution",
                optionC: "Always positive roots",
                optionD: "Roots equal to zero",
                correct: 1,
                difficulty: "MEDIUM",
                explanation: "When D = 0, lines are either parallel (no solution) or coincident (infinitely many solutions).",
              },
            ],
          },
        ],
      },
      {
        name: "Real Numbers",
        topics: [
          {
            name: "HCF and LCM by Prime Factorisation",
            contents: [
              {
                title: "Prime Factorisation Method",
                order: 1,
                body: "Highest Common Factor (HCF) is obtained by taking the product of the smallest powers of each common prime factor.\nLeast Common Multiple (LCM) is obtained by taking the product of the greatest powers of each prime factor involved in the numbers.",
              },
            ],
            questions: [
              {
                text: "The HCF of 12 and 18 is:",
                optionA: "2",
                optionB: "6",
                optionC: "12",
                optionD: "36",
                correct: 1,
                difficulty: "EASY",
                explanation: "12 = 2² × 3, 18 = 2 × 3². Common factors: 2¹ × 3¹ = 6.",
              },
            ],
          },
        ],
      },
    ],
  },

  // 4. ICSE — Class 10
  {
    board: "ICSE",
    grade: "Class 10",
    subject: "Mathematics",
    chapters: [
      {
        name: "Commercial Mathematics",
        topics: [
          {
            name: "Goods and Services Tax (GST)",
            contents: [
              {
                title: "Introduction to GST and Tax Calculations",
                order: 1,
                body: "GST is an indirect destination-based tax on the supply of goods and services.\n- For intra-state transactions: CGST = SGST = (GST Rate / 2).\n- For inter-state transactions: IGST = Full GST Rate.\n\nInput Tax Credit (ITC) allows businesses to deduct tax paid on purchases from output tax payable.",
              },
            ],
            questions: [
              {
                text: "For an intra-state sale with 18% GST, what is the CGST percentage?",
                optionA: "18%",
                optionB: "9%",
                optionC: "0%",
                optionD: "4.5%",
                correct: 1,
                difficulty: "EASY",
                explanation: "For intra-state trade, GST is equally divided between CGST (9%) and SGST (9%).",
              },
              {
                text: "IGST applies to which type of transaction?",
                optionA: "Within the same city",
                optionB: "Within the same state",
                optionC: "Inter-state supply",
                optionD: "Export only",
                correct: 2,
                difficulty: "EASY",
                explanation: "Integrated GST (IGST) is levied on all supply of goods/services across state borders.",
              },
            ],
          },
        ],
      },
    ],
  },

  // 5. Telangana State Board — Class 10
  {
    board: "Telangana",
    grade: "Class 10",
    subject: "Mathematics",
    chapters: [
      {
        name: "Real Numbers",
        topics: [
          {
            name: "Logarithms and Exponents",
            contents: [
              {
                title: "Properties of Logarithms",
                order: 1,
                body: "If a^x = N (where a > 0, a ≠ 1), then x is called the logarithm of N to base a, written as log_a(N) = x.\n\nKey Properties:\n1. log_a(xy) = log_a(x) + log_a(y)\n2. log_a(x/y) = log_a(x) - log_a(y)\n3. log_a(x^k) = k × log_a(x)\n4. log_a(a) = 1, log_a(1) = 0.",
              },
            ],
            questions: [
              {
                text: "What is the value of log₁₀(100)?",
                optionA: "1",
                optionB: "2",
                optionC: "10",
                optionD: "0",
                correct: 1,
                difficulty: "EASY",
                explanation: "Since 10² = 100, log₁₀(100) = 2.",
              },
              {
                text: "log_a(x × y) equals:",
                optionA: "log_a(x) × log_a(y)",
                optionB: "log_a(x) + log_a(y)",
                optionC: "log_a(x) - log_a(y)",
                optionD: "log_a(x + y)",
                correct: 1,
                difficulty: "EASY",
                explanation: "Logarithm of product is the sum of logarithms.",
              },
            ],
          },
        ],
      },
    ],
  },

  // 6. Bihar State Board — Class 10
  {
    board: "Bihar",
    grade: "Class 10",
    subject: "Science",
    chapters: [
      {
        name: "Electricity (विद्युत)",
        topics: [
          {
            name: "Ohm's Law and Resistance (ओम का नियम)",
            contents: [
              {
                title: "Ohm's Law (ओम का नियम एवं प्रतिरोध)",
                order: 1,
                body: "According to Ohm's Law, at constant temperature, the electric current (I) flowing through a metallic conductor is directly proportional to the potential difference (V) across its ends:\n\nV = I × R\n\nwhere R is the resistance of the conductor, measured in Ohms (Ω).",
              },
            ],
            questions: [
              {
                text: "The SI unit of electrical resistance is:",
                optionA: "Volt (V)",
                optionB: "Ampere (A)",
                optionC: "Ohm (Ω)",
                optionD: "Watt (W)",
                correct: 2,
                difficulty: "EASY",
                explanation: "Resistance is measured in Ohms (Ω).",
              },
              {
                text: "If voltage is 12V and current is 2A, the resistance is:",
                optionA: "24 Ω",
                optionB: "6 Ω",
                optionC: "10 Ω",
                optionD: "0.16 Ω",
                correct: 1,
                difficulty: "MEDIUM",
                explanation: "R = V / I = 12 / 2 = 6 Ω.",
              },
            ],
          },
        ],
      },
    ],
  },

  // 7. Madhya Pradesh State Board — Class 10
  {
    board: "Madhya Pradesh",
    grade: "Class 10",
    subject: "Science",
    chapters: [
      {
        name: "Life Processes (जैव प्रक्रम)",
        topics: [
          {
            name: "Photosynthesis and Nutrition (प्रकाश संश्लेषण)",
            contents: [
              {
                title: "Photosynthesis Process and Autotrophic Nutrition",
                order: 1,
                body: "Photosynthesis is the biochemical process by which autotrophic green plants convert carbon dioxide and water into glucose in the presence of chlorophyll and sunlight:\n\n6CO₂ + 12H₂O + Sunlight → C₆H₁₂O₆ + 6O₂ + 6H₂O\n\nKey events:\n1. Absorption of light energy by chlorophyll.\n2. Conversion of light energy to chemical energy and splitting of water molecules.\n3. Reduction of carbon dioxide to carbohydrates.",
              },
            ],
            questions: [
              {
                text: "Which gas is released during photosynthesis?",
                optionA: "Carbon dioxide (CO₂)",
                optionB: "Oxygen (O₂)",
                optionC: "Nitrogen (N₂)",
                optionD: "Hydrogen (H₂)",
                correct: 1,
                difficulty: "EASY",
                explanation: "Oxygen is produced from the photolysis of water during photosynthesis.",
              },
            ],
          },
        ],
      },
    ],
  },

  // 8. Diploma / Polytechnic (Engineering)
  {
    board: "Diploma / Polytechnic",
    grade: "Diploma",
    subject: "Computer Engineering",
    chapters: [
      {
        name: "Data Structures & Algorithms",
        topics: [
          {
            name: "Arrays and Linked Lists",
            contents: [
              {
                title: "Singly Linked Lists and Memory Layout",
                order: 1,
                body: "A Linked List is a linear dynamic data structure where elements (nodes) are stored at non-contiguous memory locations.\n\nEach node contains:\n1. Data: The actual value.\n2. Next: Pointer/reference to the subsequent node.\n\nKey Advantages over Arrays:\n- Dynamic sizing without reallocation.\n- O(1) time complexity for insertion/deletion at head.\n- No contiguous block memory constraint.",
              },
            ],
            questions: [
              {
                text: "What is the time complexity of inserting a node at the head of a linked list?",
                optionA: "O(1)",
                optionB: "O(n)",
                optionC: "O(log n)",
                optionD: "O(n²)",
                correct: 0,
                difficulty: "EASY",
                explanation: "Pointing the new node's next pointer to head and updating head pointer takes O(1) constant time.",
              },
              {
                text: "Unlike arrays, elements in a linked list are stored in:",
                optionA: "Sequential memory locations",
                optionB: "Non-contiguous memory locations",
                optionC: "ROM only",
                optionD: "Cache registers exclusively",
                correct: 1,
                difficulty: "EASY",
                explanation: "Nodes are dynamically allocated on the heap and connected via pointers.",
              },
            ],
          },
        ],
      },
    ],
  },

  // 9. CBSE — Class 1 Mathematics (Official NCERT Syllabus)
  {
    board: "CBSE",
    grade: "Class 1",
    subject: "Mathematics",
    chapters: [
      {
        name: "Shapes and Space",
        topics: [
          {
            name: "Inside and Outside, Bigger and Smaller",
            contents: [
              {
                title: "Understanding Spatial Positions: Inside vs Outside",
                order: 1,
                body: "In mathematics and everyday life, spatial awareness helps us describe where objects are located.\n\n- Inside: Located within the boundaries of an area or container (e.g., apples inside a basket).\n- Outside: Located exterior to or beyond the container (e.g., a ball sitting outside the box).\n- Bigger and Smaller: Comparative sizes of objects (e.g., an elephant is bigger than a mouse).",
              },
            ],
            questions: [
              {
                text: "If books are placed in a school bag, they are:",
                optionA: "Inside the bag",
                optionB: "Outside the bag",
                optionC: "Behind the bag",
                optionD: "Underneath",
                correct: 0,
                difficulty: "EASY",
                explanation: "Objects placed into a closed bag are inside.",
              },
              {
                text: "Which of the following animals is bigger?",
                optionA: "Ant",
                optionB: "Elephant",
                optionC: "Sparrow",
                optionD: "Mouse",
                correct: 1,
                difficulty: "EASY",
                explanation: "An elephant is significantly larger than an ant, sparrow, or mouse.",
              },
            ],
          },
        ],
      },
      {
        name: "Numbers from One to Nine",
        topics: [
          {
            name: "Counting and Number Names 1 to 9",
            contents: [
              {
                title: "Counting Objects from 1 to 9",
                order: 1,
                body: "Numbers help us count quantities of objects:\n\n1 - One\n2 - Two\n3 - Three\n4 - Four\n5 - Five\n6 - Six\n7 - Seven\n8 - Eight\n9 - Nine\n\nCounting tells us 'how many' items are present in a group.",
              },
            ],
            questions: [
              {
                text: "What number comes immediately after 4?",
                optionA: "3",
                optionB: "5",
                optionC: "6",
                optionD: "2",
                correct: 1,
                difficulty: "EASY",
                explanation: "Counting order: 1, 2, 3, 4, 5.",
              },
              {
                text: "How many sides does a triangle have?",
                optionA: "2",
                optionB: "3",
                optionC: "4",
                optionD: "5",
                correct: 1,
                difficulty: "EASY",
                explanation: "A triangle is a closed figure with 3 straight sides.",
              },
            ],
          },
        ],
      },
    ],
  },

  // 10. CBSE — Class 12 Mathematics (Official NCERT Syllabus)
  {
    board: "CBSE",
    grade: "Class 12",
    subject: "Mathematics",
    chapters: [
      {
        name: "Relations and Functions",
        topics: [
          {
            name: "Types of Relations (Reflexive, Symmetric, Transitive)",
            contents: [
              {
                title: "Equivalence Relations in Set Theory",
                order: 1,
                body: "Let R be a binary relation on a non-empty set A:\n\n1. Reflexive: (a, a) ∈ R for every a ∈ A.\n2. Symmetric: (a, b) ∈ R implies (b, a) ∈ R for all a, b ∈ A.\n3. Transitive: (a, b) ∈ R and (b, c) ∈ R implies (a, c) ∈ R for all a, b, c ∈ A.\n\nA relation that is simultaneously reflexive, symmetric, and transitive is termed an Equivalence Relation.",
              },
            ],
            questions: [
              {
                text: "A relation R on set A is reflexive if for all a ∈ A:",
                optionA: "(a, a) ∈ R",
                optionB: "(a, b) ∈ R implies (b, a) ∈ R",
                optionC: "(a, b) ∉ R",
                optionD: "a + a = 0",
                correct: 0,
                difficulty: "EASY",
                explanation: "Reflexivity requires every element to be related to itself.",
              },
              {
                text: "A relation that is reflexive, symmetric, and transitive is called an:",
                optionA: "Identity relation",
                optionB: "Universal relation",
                optionC: "Equivalence relation",
                optionD: "Empty relation",
                correct: 2,
                difficulty: "MEDIUM",
                explanation: "By definition, satisfying all three axioms makes R an equivalence relation.",
              },
            ],
          },
        ],
      },
      {
        name: "Matrices",
        topics: [
          {
            name: "Order and Types of Matrices",
            contents: [
              {
                title: "Matrix Definitions and Dimensions",
                order: 1,
                body: "A matrix is a rectangular arrangement of numbers or functions into rows and columns.\n\nA matrix having m rows and n columns has order m × n.\n\nTypes of Matrices:\n- Row Matrix: Matrix with only one row (1 × n).\n- Column Matrix: Matrix with only one column (m × 1).\n- Square Matrix: Matrix where number of rows equals number of columns (m = n).\n- Identity Matrix: Square matrix with 1 on diagonal and 0 everywhere else.",
              },
            ],
            questions: [
              {
                text: "If a matrix has 3 rows and 4 columns, its order is:",
                optionA: "4 × 3",
                optionB: "3 × 4",
                optionC: "12",
                optionD: "7",
                correct: 1,
                difficulty: "EASY",
                explanation: "Order is expressed as (rows) × (columns), hence 3 × 4.",
              },
              {
                text: "In a scalar matrix, all diagonal elements are:",
                optionA: "0",
                optionB: "Equal to each other",
                optionC: "1 always",
                optionD: "Imaginary numbers",
                correct: 1,
                difficulty: "MEDIUM",
                explanation: "A scalar matrix is a diagonal matrix where all diagonal elements are equal.",
              },
            ],
          },
        ],
      },
    ],
  },

  // 11. Maharashtra State Board — Class 12 Mathematics (Official MSBSHSE Syllabus)
  {
    board: "Maharashtra State Board",
    grade: "Class 12",
    subject: "Mathematics",
    chapters: [
      {
        name: "Mathematical Logic",
        topics: [
          {
            name: "Statements and Truth Values",
            contents: [
              {
                title: "Declarative Sentences and Truth Values",
                order: 1,
                body: "A statement (or proposition) in logic is a declarative sentence that is either true or false, but not both simultaneously.\n\nTruth Values:\n- If a statement is true, its truth value is denoted by T (or 1).\n- If a statement is false, its truth value is denoted by F (or 0).\n\nImperative, interrogative, exclamatory, and open sentences are NOT logical statements.",
              },
            ],
            questions: [
              {
                text: "Which of the following is a mathematical statement?",
                optionA: "What is your name?",
                optionB: "Please close the door.",
                optionC: "The sun rises in the east.",
                optionD: "Hurrah! We won.",
                correct: 2,
                difficulty: "EASY",
                explanation: "Declarative sentence with definite truth value T is a statement.",
              },
              {
                text: "The negation of a false statement has truth value:",
                optionA: "F",
                optionB: "T",
                optionC: "Neither T nor F",
                optionD: "Both T and F",
                correct: 1,
                difficulty: "EASY",
                explanation: "~F is T.",
              },
            ],
          },
        ],
      },
    ],
  },

  // 12. MSBTE — Diploma Year 1 (Semester 1 & 2)
  {
    board: "MSBTE",
    grade: "Diploma Year 1",
    branch: "Computer Engineering",
    semester: "Semester 1",
    subject: "Basic Mathematics (MSBTE 311302)",
    chapters: [
      {
        name: "Logarithms and Determinants",
        topics: [
          {
            name: "Laws of Logarithms",
            contents: [
              {
                title: "Logarithmic Properties and Computation",
                order: 1,
                body: "If b^y = x (where b > 0, b ≠ 1), then y = log_b(x).\n\nKey Fundamental Laws of Logarithms:\n1. Product Rule: log_b(M · N) = log_b(M) + log_b(N)\n2. Quotient Rule: log_b(M / N) = log_b(M) - log_b(N)\n3. Power Rule: log_b(M^k) = k · log_b(M)\n4. Base Change: log_b(M) = log_a(M) / log_a(b)",
              },
            ],
            questions: [
              {
                text: "log_b(xy) is equal to:",
                optionA: "log_b(x) · log_b(y)",
                optionB: "log_b(x) + log_b(y)",
                optionC: "log_b(x) - log_b(y)",
                optionD: "log_b(x) / log_b(y)",
                correct: 1,
                difficulty: "EASY",
                explanation: "The logarithm of a product is the sum of logarithms.",
              },
              {
                text: "What is the value of log_10(1)?",
                optionA: "0",
                optionB: "1",
                optionC: "10",
                optionD: "Undefined",
                correct: 0,
                difficulty: "EASY",
                explanation: "Since 10^0 = 1, log_10(1) = 0.",
              },
              {
                text: "log_b(x / y) is equal to:",
                optionA: "log_b(x) - log_b(y)",
                optionB: "log_b(x) + log_b(y)",
                optionC: "log_b(x) / log_b(y)",
                optionD: "log_b(x · y)",
                correct: 0,
                difficulty: "EASY",
                explanation: "The logarithm of a quotient is the difference of logarithms.",
              },
              {
                text: "log_b(x^k) simplifies to:",
                optionA: "k + log_b(x)",
                optionB: "k · log_b(x)",
                optionC: "(log_b(x))^k",
                optionD: "log_b(k · x)",
                correct: 1,
                difficulty: "EASY",
                explanation: "The power rule states log_b(x^k) = k · log_b(x).",
              },
              {
                text: "If log_2(x) = 5, what is the value of x?",
                optionA: "10",
                optionB: "25",
                optionC: "32",
                optionD: "64",
                correct: 2,
                difficulty: "MEDIUM",
                explanation: "By logarithmic definition, x = 2^5 = 32.",
              },
            ],
          },
        ],
      },
    ],
  },
  {
    board: "MSBTE",
    grade: "Diploma Year 1",
    branch: "Computer Engineering",
    semester: "Semester 2",
    subject: "Programming in C (MSBTE 312303)",
    chapters: [
      {
        name: "Fundamentals of C Programming",
        topics: [
          {
            name: "Data Types and Operators in C",
            contents: [
              {
                title: "Basic Primitive Types and Operators in C",
                order: 1,
                body: "C provides standard primitive types:\n- int: integers (typically 2 or 4 bytes)\n- char: character representation (1 byte, ASCII)\n- float: single-precision floating point (4 bytes)\n- double: double-precision floating point (8 bytes)\n\nOperators:\nArithmetic (+, -, *, /, %), Relational (==, !=, <, >), and Logical (&&, ||, !).",
              },
            ],
            questions: [
              {
                text: "Which of the following is the modulo operator in C?",
                optionA: "/",
                optionB: "%",
                optionC: "#",
                optionD: "//",
                correct: 1,
                difficulty: "EASY",
                explanation: "% gives the remainder of an integer division.",
              },
            ],
          },
        ],
      },
    ],
  },

  // 13. MSBTE — Diploma Year 2 (Semester 3 & 4)
  {
    board: "MSBTE",
    grade: "Diploma Year 2",
    branch: "Computer Engineering",
    semester: "Semester 3",
    subject: "Data Structures Using C (MSBTE 313301)",
    chapters: [
      {
        name: "Linear Data Structures",
        topics: [
          {
            name: "Arrays and Linked Lists",
            contents: [
              {
                title: "Singly Linked Lists and Pointer Traversal",
                order: 1,
                body: "A linked list is a linear collection of data elements called nodes, whose order is not given by their physical placement in memory.\n\nEach node contains data and a pointer to next node. Insertion at head is O(1).",
              },
            ],
            questions: [
              {
                text: "A node in a singly linked list contains at least:",
                optionA: "Data and next pointer",
                optionB: "Data only",
                optionC: "Two pointers only",
                optionD: "Index value only",
                correct: 0,
                difficulty: "EASY",
                explanation: "A singly linked list node has data and next address.",
              },
            ],
          },
        ],
      },
    ],
  },
  {
    board: "MSBTE",
    grade: "Diploma Year 2",
    branch: "Computer Engineering",
    semester: "Semester 4",
    subject: "Java Programming (MSBTE 314301)",
    chapters: [
      {
        name: "Object-Oriented Concepts in Java",
        topics: [
          {
            name: "Classes, Objects and Inheritance",
            contents: [
              {
                title: "Encapsulation, Classes, and Extends Keyword",
                order: 1,
                body: "Java is an object-oriented programming language.\n\n- Class: Template or blueprint from which objects are instantiated.\n- Object: Runtime instance of a class.\n- Inheritance: Mechanism where a child class acquires properties of a parent class using the 'extends' keyword.",
              },
            ],
            questions: [
              {
                text: "Which keyword is used to inherit a class in Java?",
                optionA: "implements",
                optionB: "extends",
                optionC: "inherits",
                optionD: "super",
                correct: 1,
                difficulty: "EASY",
                explanation: "The 'extends' keyword is used for class inheritance in Java.",
              },
            ],
          },
        ],
      },
    ],
  },

  // 14. MSBTE — Diploma Year 3 (Semester 5 & 6)
  {
    board: "MSBTE",
    grade: "Diploma Year 3",
    branch: "Computer Engineering",
    semester: "Semester 5",
    subject: "Advanced Java Programming (MSBTE 315301)",
    chapters: [
      {
        name: "Abstract Window Toolkit (AWT)",
        topics: [
          {
            name: "AWT Components and Layout Managers",
            contents: [
              {
                title: "GUI Components in java.awt",
                order: 1,
                body: "The Abstract Window Toolkit provides GUI components such as Button, Label, TextField, and Checkbox.\n\nLayout Managers arrange components automatically:\n- FlowLayout: Arranges components sequentially in a row.\n- BorderLayout: Divides container into North, South, East, West, Center.\n- GridLayout: Arranges components in a rectangular grid of cells.",
              },
            ],
            questions: [
              {
                text: "Which package contains basic AWT classes in Java?",
                optionA: "java.util",
                optionB: "java.awt",
                optionC: "javax.swing",
                optionD: "java.net",
                correct: 1,
                difficulty: "EASY",
                explanation: "java.awt contains AWT components.",
              },
            ],
          },
        ],
      },
    ],
  },
  {
    board: "MSBTE",
    grade: "Diploma Year 3",
    branch: "Computer Engineering",
    semester: "Semester 6",
    subject: "Network and Information Security (MSBTE 316301)",
    chapters: [
      {
        name: "Cryptography Fundamentals",
        topics: [
          {
            name: "Symmetric and Asymmetric Encryption",
            contents: [
              {
                title: "Principles of Data Encryption and Ciphers",
                order: 1,
                body: "Cryptography secures communications through encryption.\n\n- Symmetric Encryption: Uses the same secret key for both encryption and decryption (e.g., AES, DES).\n- Asymmetric Encryption: Uses a key pair — a public key for encryption and a private key for decryption (e.g., RSA, ECC).",
              },
            ],
            questions: [
              {
                text: "Symmetric key cryptography uses:",
                optionA: "One shared secret key for encryption and decryption",
                optionB: "Two completely different keys",
                optionC: "No keys",
                optionD: "Only a public key",
                correct: 0,
                difficulty: "EASY",
                explanation: "Symmetric cryptography shares a single secret key.",
              },
            ],
          },
        ],
      },
    ],
  },
];

// Catalogue metadata for School and Technical / Diploma Boards
const ALL_SCHOOL_BOARDS = [
  { id: "board_cbse", name: "CBSE", fullName: "Central Board of Secondary Education", state: "Central / National", type: "school", hasCurriculumCoverage: true },
  { id: "board_icse", name: "ICSE", fullName: "Council for the Indian School Certificate Examinations (CISCE)", state: "Central / National", type: "school", hasCurriculumCoverage: true },
  { id: "board_msbshse", name: "Maharashtra State Board", fullName: "Maharashtra State Board of Secondary and Higher Secondary Education", state: "Maharashtra", type: "school", hasCurriculumCoverage: true },
  { id: "board_telangana", name: "Telangana", fullName: "Telangana State Board of Intermediate / Secondary Education", state: "Telangana", type: "school", hasCurriculumCoverage: true },
  { id: "board_bihar", name: "Bihar", fullName: "Bihar School Examination Board (BSEB)", state: "Bihar", type: "school", hasCurriculumCoverage: true },
  { id: "board_mp", name: "Madhya Pradesh", fullName: "Board of Secondary Education, Madhya Pradesh (MPBSE)", state: "Madhya Pradesh", type: "school", hasCurriculumCoverage: true },
  { id: "board_karnataka", name: "Karnataka State Board", fullName: "Karnataka School Examination and Assessment Board (KSEAB)", state: "Karnataka", type: "school", hasCurriculumCoverage: false },
  { id: "board_tamilnadu", name: "Tamil Nadu State Board", fullName: "Tamil Nadu Directorate of Government Examinations", state: "Tamil Nadu", type: "school", hasCurriculumCoverage: false },
  { id: "board_upmsp", name: "Uttar Pradesh State Board (UPMSP)", fullName: "Uttar Pradesh Madhyamik Shiksha Parishad", state: "Uttar Pradesh", type: "school", hasCurriculumCoverage: false },
  { id: "board_andhra", name: "Andhra Pradesh State Board", fullName: "Board of Secondary / Intermediate Education, Andhra Pradesh", state: "Andhra Pradesh", type: "school", hasCurriculumCoverage: false },
  { id: "board_rajasthan", name: "Rajasthan State Board (RBSE)", fullName: "Board of Secondary Education, Rajasthan", state: "Rajasthan", type: "school", hasCurriculumCoverage: false },
  { id: "board_westbengal", name: "West Bengal Board (WBBSE)", fullName: "West Bengal Board of Secondary Education", state: "West Bengal", type: "school", hasCurriculumCoverage: false },
  { id: "board_gujarat", name: "Gujarat Board (GSEB)", fullName: "Gujarat Secondary and Higher Secondary Education Board", state: "Gujarat", type: "school", hasCurriculumCoverage: false },
  { id: "board_kerala", name: "Kerala State Board", fullName: "Directorate of General Education, Kerala", state: "Kerala", type: "school", hasCurriculumCoverage: false },
  { id: "board_delhi", name: "Delhi / UT State Board", fullName: "Delhi Board of School Education (DBSE)", state: "Delhi & UTs", type: "school", hasCurriculumCoverage: false },
];

const ALL_TECHNICAL_BOARDS = [
  { id: "board_msbte", name: "MSBTE", fullName: "Maharashtra State Board of Technical Education (K & I Schemes)", state: "Maharashtra", type: "diploma", hasCurriculumCoverage: true },
  { id: "board_diploma_poly", name: "Diploma / Polytechnic", fullName: "Diploma / Polytechnic Technical Board", state: "National", type: "diploma", hasCurriculumCoverage: true },
  { id: "board_sbtet", name: "SBTET (Telangana & AP)", fullName: "State Board of Technical Education and Training", state: "Telangana & Andhra Pradesh", type: "diploma", hasCurriculumCoverage: false },
  { id: "board_dte_karnataka", name: "DTE Karnataka", fullName: "Directorate of Technical Education, Karnataka", state: "Karnataka", type: "diploma", hasCurriculumCoverage: false },
  { id: "board_bteup", name: "BTEUP", fullName: "Board of Technical Education, Uttar Pradesh", state: "Uttar Pradesh", type: "diploma", hasCurriculumCoverage: false },
  { id: "board_aicte", name: "AICTE Model Polytechnic", fullName: "AICTE Model Curriculum for Polytechnic Diploma", state: "National / AICTE", type: "diploma", hasCurriculumCoverage: false },
];

const ALL_SCHOOL_CLASSES = [
  "Class 1", "Class 2", "Class 3", "Class 4", "Class 5",
  "Class 6", "Class 7", "Class 8", "Class 9", "Class 10",
  "Class 11", "Class 12"
];

const ALL_DIPLOMA_YEARS = [
  "Diploma Year 1",
  "Diploma Year 2",
  "Diploma Year 3"
];

const DIPLOMA_BRANCHES = [
  "Computer Engineering",
  "Information Technology",
  "Mechanical Engineering",
  "Civil Engineering",
  "Electrical Engineering",
  "Electronics & Telecommunication"
];

const DIPLOMA_SEMESTERS_BY_YEAR = {
  "Diploma Year 1": ["Semester 1", "Semester 2"],
  "Diploma Year 2": ["Semester 3", "Semester 4"],
  "Diploma Year 3": ["Semester 5", "Semester 6"],
};

module.exports = {
  CURRICULUM_DATA,
  ALL_SCHOOL_BOARDS,
  ALL_TECHNICAL_BOARDS,
  ALL_SCHOOL_CLASSES,
  ALL_DIPLOMA_YEARS,
  DIPLOMA_BRANCHES,
  DIPLOMA_SEMESTERS_BY_YEAR,
};
