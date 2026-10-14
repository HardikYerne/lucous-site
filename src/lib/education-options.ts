// Dropdown options for student signup (and anywhere else a class / board is picked).
// Values are stored as the plain label strings on the user record.

export const SCHOOL_CLASSES: string[] = Array.from(
  { length: 12 },
  (_, i) => `Class ${i + 1}`
);

export const DIPLOMA_CLASSES: string[] = [
  "Diploma - 1st Year (Semester 1)",
  "Diploma - 1st Year (Semester 2)",
  "Diploma - 2nd Year (Semester 3)",
  "Diploma - 2nd Year (Semester 4)",
  "Diploma - 3rd Year (Semester 5)",
  "Diploma - 3rd Year (Semester 6)",
];

export const CLASS_GROUPS: { label: string; options: string[] }[] = [
  { label: "School (Class 1 - 12)", options: SCHOOL_CLASSES },
  { label: "Diploma / Polytechnic", options: DIPLOMA_CLASSES },
];

export function isDiplomaClass(value: string): boolean {
  return value.startsWith("Diploma");
}

const NATIONAL_BOARDS = [
  "CBSE (Central Board of Secondary Education)",
  "CISCE (ICSE / ISC)",
  "NIOS (National Institute of Open Schooling)",
  "IB (International Baccalaureate)",
  "Cambridge (IGCSE / A Level)",
];

const STATE_BOARDS = [
  "Andhra Pradesh (BSEAP / BIEAP)",
  "Arunachal Pradesh Board",
  "Assam (SEBA / AHSEC)",
  "Bihar (BSEB)",
  "Chhattisgarh (CGBSE)",
  "Delhi Board of School Education (DBSE)",
  "Goa (GBSHSE)",
  "Gujarat (GSEB / GSHSEB)",
  "Haryana (BSEH)",
  "Himachal Pradesh (HPBOSE)",
  "Jammu & Kashmir (JKBOSE)",
  "Jharkhand (JAC)",
  "Karnataka (KSEAB / Karnataka PU Board)",
  "Kerala (DGE Kerala / Kerala Board)",
  "Madhya Pradesh (MPBSE)",
  "Maharashtra (MSBSHSE)",
  "Manipur (BSEM / COHSEM)",
  "Meghalaya (MBOSE)",
  "Mizoram (MBSE)",
  "Nagaland (NBSE)",
  "Odisha (BSE Odisha / CHSE)",
  "Punjab (PSEB)",
  "Rajasthan (RBSE)",
  "Sikkim Board",
  "Tamil Nadu (TNBSE / DGE Tamil Nadu)",
  "Telangana (BSE Telangana / TSBIE)",
  "Tripura (TBSE)",
  "Uttar Pradesh (UPMSP)",
  "Uttarakhand (UBSE)",
  "West Bengal (WBBSE / WBCHSE)",
];

export const SCHOOL_BOARDS = [
  { label: "National & International", options: NATIONAL_BOARDS },
  { label: "State Boards", options: STATE_BOARDS },
  { label: "Other", options: ["Other Board"] },
];

export const DIPLOMA_BOARDS = [
  {
    label: "Diploma / Technical Boards",
    options: [
      "MSBTE (Maharashtra)",
      "SBTET (Telangana)",
      "SBTET (Andhra Pradesh)",
      "DTE Karnataka",
      "DOTE Tamil Nadu",
      "DTE Kerala",
      "DTE Gujarat",
      "DTE Rajasthan",
      "BTE Uttar Pradesh",
      "SBTE Bihar",
      "SBTE Jharkhand",
      "SCTE & VT Odisha",
      "WBSCTE (West Bengal)",
      "PSBTE & IT (Punjab)",
      "HSBTE (Haryana)",
      "DTE Madhya Pradesh",
      "AICTE Model Curriculum",
    ],
  },
  { label: "Other", options: ["Other Board"] },
];
