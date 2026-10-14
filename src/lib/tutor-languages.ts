export type LanguageCode = "en" | "hi" | "mr" | "te";

export interface StarterQuestion {
  category: "science" | "math" | "curiosity" | "doubt";
  categoryLabel: string;
  text: string;
}

export interface QuickActionPrompt {
  id: string;
  label: string;
  prompt: string;
}

export interface LanguageConfig {
  code: LanguageCode;
  name: string;
  nativeName: string;
  script: string;
  flag: string;
  tagline: string;
  ui: {
    tutorTitle: string;
    tutorSubtitle: string;
    newChat: string;
    inputPlaceholder: string;
    thinking: string;
    retry: string;
    send: string;
    preferences: string;
    gradeLabel: string;
    styleLabel: string;
    history: string;
    noHistory: string;
    noMessagesTitle: string;
    noMessagesSubtitle: string;
    checkUnderstanding: string;
    unconfiguredBanner: string;
    switchNotice: string;
    deleteChat: string;
  };
  starterQuestions: StarterQuestion[];
  quickActions: QuickActionPrompt[];
}

export const SUPPORTED_LANGUAGES: Record<LanguageCode, LanguageConfig> = {
  en: {
    code: "en",
    name: "English",
    nativeName: "English",
    script: "Latin",
    flag: "🇬🇧",
    tagline: "Understand the 'why' and 'how', not just the answer.",
    ui: {
      tutorTitle: "LUCOUS AI Teacher",
      tutorSubtitle: "Interactive, conceptual learning in your language",
      newChat: "New Discussion",
      inputPlaceholder: "Ask any doubt, concept, or problem you want to understand…",
      thinking: "The AI Teacher is thinking & breaking down the concept…",
      retry: "Retry Question",
      send: "Ask Teacher",
      preferences: "Learning Preferences",
      gradeLabel: "Grade Level",
      styleLabel: "Teaching Style",
      history: "Past Discussions",
      noHistory: "No saved discussions yet.",
      noMessagesTitle: "What would you like to understand today?",
      noMessagesSubtitle: "Ask about any school subject, concept, or homework doubt. Pick a topic below or type your own question.",
      checkUnderstanding: "Check Your Understanding",
      unconfiguredBanner: "Preview Mode: Live AI provider is not connected yet. Add GEMINI_API_KEY or AI_API_KEY on the backend to activate full live answers.",
      switchNotice: "Switched to English. Previous conversation context is preserved.",
      deleteChat: "Delete discussion",
    },
    starterQuestions: [
      {
        category: "science",
        categoryLabel: "Science",
        text: "Why does ice float on water? Explain with everyday examples.",
      },
      {
        category: "math",
        categoryLabel: "Mathematics",
        text: "How do fractions work? Teach me with a real-life story.",
      },
      {
        category: "curiosity",
        categoryLabel: "Curiosity",
        text: "Why is the sky blue during the day and red during sunset?",
      },
      {
        category: "doubt",
        categoryLabel: "Physics",
        text: "Explain Newton's Third Law using a cricket match analogy.",
      },
    ],
    quickActions: [
      {
        id: "simpler",
        label: "Explain simpler",
        prompt: "Can you explain that more simply with an easier real-world analogy?",
      },
      {
        id: "example",
        label: "Another everyday example",
        prompt: "Can you give another real-world everyday example to help me picture this?",
      },
      {
        id: "steps",
        label: "Step-by-step breakdown",
        prompt: "Could you break this down into smaller, step-by-step bullet points?",
      },
      {
        id: "practice",
        label: "Give me a practice problem",
        prompt: "Can you give me a short, friendly practice question to test if I understood?",
      },
      {
        id: "summary",
        label: "Key takeaway summary",
        prompt: "What is the single most important takeaway I should remember from this?",
      },
    ],
  },

  hi: {
    code: "hi",
    name: "Hindi",
    nativeName: "हिंदी",
    script: "Devanagari",
    flag: "🇮🇳",
    tagline: "केवल उत्तर नहीं, बल्कि संकल्पना की गहरी समझ।",
    ui: {
      tutorTitle: "ल्युकस AI शिक्षक",
      tutorSubtitle: "अपनी भाषा में सरल, संवादात्मक और संकल्पीय शिक्षण",
      newChat: "नई चर्चा",
      inputPlaceholder: "कोई भी प्रश्न, संदेह या संकल्पना पूछें जिसे आप समझना चाहते हैं…",
      thinking: "शिक्षक सोच रहे हैं और संकल्पना को सरल बना रहे हैं…",
      retry: "पुनः प्रयास करें",
      send: "पूछें",
      preferences: "सीखने की प्राथमिकताएं",
      gradeLabel: "कक्षा / स्तर",
      styleLabel: "सिखाने की शैली",
      history: "पिछली चर्चाएं",
      noHistory: "अभी कोई सहेजी गई चर्चा नहीं है।",
      noMessagesTitle: "आज आप क्या सीखना या समझना चाहते हैं?",
      noMessagesSubtitle: "स्कूल के किसी भी विषय, सवाल या गृहकार्य की शंका के बारे में पूछें। नीचे दिए गए सुझावों में से चुनें या अपना प्रश्न लिखें।",
      checkUnderstanding: "अपनी समझ परखें",
      unconfiguredBanner: "पूर्वावलोकन मोड: बैकएंड पर AI प्रदाता अभी कनेक्ट नहीं है। लाइव उत्तरों के लिए बैकएंड पर GEMINI_API_KEY या AI_API_KEY सेट करें।",
      switchNotice: "हिंदी भाषा चुनी गई। पुरानी बातचीत का संदर्भ सुरक्षित है।",
      deleteChat: "चर्चा हटाएं",
    },
    starterQuestions: [
      {
        category: "science",
        categoryLabel: "विज्ञान",
        text: "बर्फ पानी पर क्यों तैरती है? दैनिक जीवन के उदाहरण से समझाइए।",
      },
      {
        category: "math",
        categoryLabel: "गणित",
        text: "भिन्न (Fractions) क्या होते हैं? मुझे रोटी या पिज्जा के उदाहरण से सिखाइए।",
      },
      {
        category: "curiosity",
        categoryLabel: "जिज्ञासा",
        text: "दिन में आकाश नीला और सूर्यास्त के समय लाल क्यों दिखता है?",
      },
      {
        category: "doubt",
        categoryLabel: "भौतिकी",
        text: "क्रिकेट के खेल के उदाहरण से न्यूटन का तीसरा नियम (Newton's 3rd Law) समझाइए।",
      },
    ],
    quickActions: [
      {
        id: "simpler",
        label: "और सरल तरीके से समझाइए",
        prompt: "क्या आप इसे और भी सरल भाषा और आसान उदाहरण के साथ समझा सकते हैं?",
      },
      {
        id: "example",
        label: "एक और दैनिक उदाहरण दें",
        prompt: "कृपया इसे समझने के लिए हमारे रोज़मर्रा के जीवन से एक और उदाहरण दीजिए।",
      },
      {
        id: "steps",
        label: "चरण-दर-चरण बताइए",
        prompt: "कृपया इसे छोटे-छोटे चरणों में (Step-by-step) लिखकर समझाइए।",
      },
      {
        id: "practice",
        label: "एक अभ्यास प्रश्न दीजिए",
        prompt: "मेरी समझ जांचने के लिए इसी संकल्पना पर एक छोटा सा अभ्यास प्रश्न दीजिए।",
      },
      {
        id: "summary",
        label: "मुख्य सारांश बताइए",
        prompt: "इस पूरे विषय का सबसे महत्वपूर्ण मुख्य बिंदु (Takeaway) क्या है?",
      },
    ],
  },

  mr: {
    code: "mr",
    name: "Marathi",
    nativeName: "मराठी",
    script: "Devanagari",
    flag: "🇮🇳",
    tagline: "केवळ उत्तर नाही, तर संकल्पनेची खरी समज.",
    ui: {
      tutorTitle: "ल्युकस AI शिक्षक",
      tutorSubtitle: "मातृभाषेत सोपे, संवादात्मक आणि संकल्पनाधारित शिक्षण",
      newChat: "नवीन चर्चा",
      inputPlaceholder: "कोणतीही शंका, संकल्पना किंवा प्रश्न येथे विचारा…",
      thinking: "शिक्षक विचार करत आहेत आणि संकल्पना सोपी करत आहेत…",
      retry: "पुन्हा प्रयत्न करा",
      send: "विचारा",
      preferences: "शिकण्याच्या आवडीनिवडी",
      gradeLabel: "इयत्ता / वर्ग",
      styleLabel: "शिकवण्याची पद्धत",
      history: "मागील चर्चा",
      noHistory: "अजून कोणतीही जुनी चर्चा नाही.",
      noMessagesTitle: "आज तुम्हाला काय समजून घ्यायला आवडेल?",
      noMessagesSubtitle: "शाळेतील कोणत्याही विषयाबद्दल किंवा गृहपाठातील शंकेबद्दल विचारा. खालील उदाहरणांमधून निवडा किंवा स्वतःचा प्रश्न टाईप करा.",
      checkUnderstanding: "तुमची समज तपासा",
      unconfiguredBanner: "पूर्वावलोकन मोड: बॅकएंडवर AI प्रदाता अजून जोडलेला नाही. थेट उत्तरांसाठी GEMINI_API_KEY किंवा AI_API_KEY सेट करा.",
      switchNotice: "मराठी भाषा निवडली. मागील संभाषणाचा संदर्भ कायम आहे.",
      deleteChat: "चर्चा हटवा",
    },
    starterQuestions: [
      {
        category: "science",
        categoryLabel: "विज्ञान",
        text: "बर्फ पाण्यावर का तरंगतो? रोजच्या जीवनातील सोप्या उदाहरणाने समजावून सांगा.",
      },
      {
        category: "math",
        categoryLabel: "गणित",
        text: "अपूर्णांक (Fractions) म्हणजे काय? भाकरी किंवा पिझ्झाच्या उदाहरणाने शिकवा.",
      },
      {
        category: "curiosity",
        categoryLabel: "कुतूहल",
        text: "दुपारी आकाश निळे आणि संध्याकाळी तांबडे का दिसते?",
      },
      {
        category: "doubt",
        categoryLabel: "भौतिकशास्त्र",
        text: "क्रिकेटच्या खेळाच्या उदाहरणावरून न्यूटनचा गतीचा तिसरा नियम समजावा.",
      },
    ],
    quickActions: [
      {
        id: "simpler",
        label: "आणखी सोपे करून सांगा",
        prompt: "हे मला आणखी सोप्या शब्दांत आणि सोप्या उदाहरणासह समजावून सांगाल का?",
      },
      {
        id: "example",
        label: "रोजच्या जगण्यातील उदाहरण द्या",
        prompt: "कृपया हे लक्षात राहण्यासाठी दैनंदिन जीवनातील दुसरे एखादे उदाहरण द्या.",
      },
      {
        id: "steps",
        label: "टप्प्याटप्प्याने स्पष्ट करा",
        prompt: "कृपया हे समजण्यासाठी १, २, ३ अशा टप्प्यांमध्ये (Step-by-step) मांडून सांगा.",
      },
      {
        id: "practice",
        label: "एक सराव प्रश्न द्या",
        prompt: "मला ही संकल्पना समजली आहे का हे तपासण्यासाठी एक छोटा सराव प्रश्न विचारा.",
      },
      {
        id: "summary",
        label: "मुख्य सारांश सांगा",
        prompt: "या संकल्पनेचा सर्वात महत्त्वाचा मुख्य मुद्दा किंवा निष्कर्ष काय आहे?",
      },
    ],
  },

  te: {
    code: "te",
    name: "Telugu",
    nativeName: "తెలుగు",
    script: "Telugu",
    flag: "🇮🇳",
    tagline: "జవాబు మాత్రమే కాదు, భావనను సంపూర్ణంగా అర్థం చేసుకోండి.",
    ui: {
      tutorTitle: "ల్యూకస్ AI ఉపాధ్యాయుడు",
      tutorSubtitle: "మీ సొంత భాషలో సులభమైన, సంభాషణాత్మక విద్యాబోధన",
      newChat: "కొత్త చర్చ",
      inputPlaceholder: "మీకు అర్థం కావాల్సిన ఏదైనా సందేహం లేదా కాన్సెప్ట్ అడగండి…",
      thinking: "ఉపాధ్యాయుడు ఆలోచిస్తూ భావనను సులభతరం చేస్తున్నారు…",
      retry: "మళ్ళీ ప్రయత్నించండి",
      send: "అడగండి",
      preferences: "నేర్చుకునే ప్రాధాన్యతలు",
      gradeLabel: "తరగతి / స్థాయి",
      styleLabel: "బోధనా శైలి",
      history: "మునుపటి చర్చలు",
      noHistory: "ఇంకా సంభాషణలు ఏవీ లేవు.",
      noMessagesTitle: "ఈ రోజు మీరు ఏమి నేర్చుకోవాలనుకుంటున్నారు?",
      noMessagesSubtitle: "ఏదైనా పాఠశాల సబ్జెక్ట్, కాన్సెప్ట్ లేదా హోంవర్క్ సందేహం గురించి అడగండి. క్రింది సూచనలలో ఒకదాన్ని ఎంచుకోండి లేదా మీ ప్రశ్న రాయండి.",
      checkUnderstanding: "మీ అవగాహనను పరీక్షించుకోండి",
      unconfiguredBanner: "ప్రివ్యూ మోడ్: బ్యాకెండ్‌లో AI ప్రొవైడర్ ఇంకా కాన్ఫిగర్ కాలేదు. లైవ్ సమాధానాల కోసం GEMINI_API_KEY లేదా AI_API_KEY సెట్ చేయండి.",
      switchNotice: "తెలుగు భాష ఎంపిక చేయబడింది. మునుపటి సంభాషణ సందర్భం భద్రపరచబడింది.",
      deleteChat: "చర్చను తొలగించండి",
    },
    starterQuestions: [
      {
        category: "science",
        categoryLabel: "సైన్స్",
        text: "మంచు నీటిపై ఎందుకు తేలుతుంది? రోజువారీ ఉదాహరణతో వివరించండి.",
      },
      {
        category: "math",
        categoryLabel: "గణితం",
        text: "భిన్నాలు (Fractions) అంటే ఏమిటి? రొట్టె లేదా పండ్ల ఉదాహరణతో దశలవారీగా నేర్పించండి.",
      },
      {
        category: "curiosity",
        categoryLabel: "ఆసక్తికర విషయాలు",
        text: "పగటిపూట ఆకాశం నీలంగా, సూర్యాస్తమయం వేళ ఎర్రగా ఎందుకు కనిపిస్తుంది?",
      },
      {
        category: "doubt",
        categoryLabel: "భౌతికశాస్త్రం",
        text: "క్రికెట్ ఆట ఉదాహరణతో న్యూటన్ మూడవ చలన సూత్రాన్ని (Newton's 3rd Law) వివరించండి.",
      },
    ],
    quickActions: [
      {
        id: "simpler",
        label: "మరింత సులభంగా వివరించండి",
        prompt: "దీన్ని మరింత సరళమైన భాషలో మరియు సులువైన ఉదాహరణతో వివరించగలరా?",
      },
      {
        id: "example",
        label: "మరో నిజ జీవిత ఉదాహరణ ఇవ్వండి",
        prompt: "బాగా అర్థం కావడానికి మన దైనందిన జీవితం నుండి మరొక ఉదాహరణ ఇవ్వండి.",
      },
      {
        id: "steps",
        label: "దశలవారీగా తెలియజేయండి",
        prompt: "దయచేసి దీన్ని చిన్న చిన్న దశలుగా (Step-by-step) విభజించి చెప్పండి.",
      },
      {
        id: "practice",
        label: "ఒక అభ్యాస ప్రశ్న అడగండి",
        prompt: "నాకు అర్థమైందో లేదో పరీక్షించడానికి ఈ కాన్సెప్ట్‌పై ఒక చిన్న ప్రశ్న అడగండి.",
      },
      {
        id: "summary",
        label: "ముఖ్యమైన సారాంశం చెప్పండి",
        prompt: "ఈ అంశంలో నేను ఎప్పటికీ గుర్తుంచుకోవాల్సిన ముఖ్యమైన విషయం ఏమిటి?",
      },
    ],
  },
};

export const GRADE_LEVELS = [
  { id: "all", label: "All Grades" },
  { id: "primary", label: "Primary (1–5)" },
  { id: "middle", label: "Middle (6–8)" },
  { id: "secondary", label: "Secondary (9–10)" },
  { id: "senior", label: "Senior Secondary (11–12)" },
] as const;

export const TEACHING_STYLES = [
  { id: "adaptive", label: "Adaptive & Socratic", desc: "Interactive, guides with questions" },
  { id: "step_by_step", label: "Step-by-Step", desc: "Structured, detailed breakdown" },
  { id: "visual_analogy", label: "Visual & Analogies", desc: "Everyday stories and metaphors" },
  { id: "concise", label: "Concise Doubt", desc: "Direct, fast explanation" },
] as const;
