import { COUNTRY_BY_CODE, INITIAL_COUNTRIES } from "./globalCountries.js";

// Profession evidence is separated from legal permission to practise.
// The latter is requested only when the selected occupation is regulated
// in the applicant's home jurisdiction.
const REGULATED_GROUPS = new Set([
  "Health & Wellness", "Legal & Compliance", "Education & Training",
  "Building & Masonry", "Electrical & Power", "Business & Finance",
  "Property & Real Estate", "Security & Safety", "Marine & Aviation",
  "Research & Science", "Community & Social Services"
]);

const COUNTRY_AUTHORITIES = {
  NGA: {
    medical: "Medical and Dental Council of Nigeria (MDCN)",
    nursing: "Nursing and Midwifery Council of Nigeria (NMCN)",
    pharmacy: "Pharmacists Council of Nigeria (PCN)",
    teaching: "Teachers Registration Council of Nigeria (TRCN)",
    electrical: "Nigerian Electricity Management Services Agency (NEMSA)",
    driving: "Federal Road Safety Corps (FRSC) / relevant state licensing authority",
    legal: "Legal Practitioners Disciplinary Committee / Supreme Court enrolment",
    engineering: "Council for the Regulation of Engineering in Nigeria (COREN)",
    accounting: "ICAN or ANAN, as applicable"
  },
  GHA: {
    medical: "Medical and Dental Council Ghana",
    nursing: "Nursing and Midwifery Council Ghana",
    pharmacy: "Pharmacy Council Ghana",
    teaching: "National Teaching Council",
    electrical: "Energy Commission Ghana",
    driving: "Driver and Vehicle Licensing Authority (DVLA)",
    legal: "General Legal Council",
    engineering: "Engineering Council Ghana",
    accounting: "Institute of Chartered Accountants Ghana"
  },
  KEN: {
    medical: "Kenya Medical Practitioners and Dentists Council (KMPDC)",
    nursing: "Nursing Council of Kenya",
    pharmacy: "Pharmacy and Poisons Board",
    teaching: "Teachers Service Commission (TSC)",
    electrical: "Energy and Petroleum Regulatory Authority (EPRA), where applicable",
    driving: "National Transport and Safety Authority (NTSA)",
    legal: "Law Society of Kenya / Advocates Complaints Commission",
    engineering: "Engineers Board of Kenya",
    accounting: "Institute of Certified Public Accountants of Kenya"
  },
  ZAF: {
    medical: "Health Professions Council of South Africa (HPCSA)",
    nursing: "South African Nursing Council (SANC)",
    pharmacy: "South African Pharmacy Council (SAPC)",
    teaching: "South African Council for Educators (SACE)",
    electrical: "Department of Employment and Labour / applicable electrical installation authority",
    driving: "Driving licence authority and relevant PrDP issuing authority",
    legal: "Legal Practice Council",
    engineering: "Engineering Council of South Africa (ECSA)",
    accounting: "South African Institute of Chartered Accountants (SAICA), where applicable"
  }
};

const FAMILY_RULES = {
  medical: [
    ["primary_qualification", "Primary professional qualification", "Upload your recognised medical, dental or relevant clinical degree/diploma."],
    ["professional_registration", "Professional registration", "Upload registration or licensing evidence from the competent health-profession regulator, if registration is required for your role.", true],
    ["practice_authority", "Current authority to practise", "Upload current practising licence, annual retention evidence or equivalent where your jurisdiction requires it.", true]
  ],
  nursing: [
    ["primary_qualification", "Nursing / midwifery qualification", "Upload your recognised nursing or midwifery qualification."],
    ["professional_registration", "Nursing / midwifery registration", "Upload current registration or licence from the competent nursing regulator where required.", true],
    ["practice_authority", "Current practice licence", "Upload current practising evidence where your jurisdiction requires renewal."]
  ],
  pharmacy: [
    ["primary_qualification", "Pharmacy qualification", "Upload your recognised pharmacy degree or diploma."],
    ["professional_registration", "Pharmacy registration", "Upload registration from the competent pharmacy regulator where required.", true],
    ["practice_authority", "Current practising authority", "Upload current licence or annual retention evidence where required.", true]
  ],
  teaching: [
    ["teaching_qualification", "Teaching qualification", "Upload an accepted teaching qualification for the level you teach (for example education degree, diploma, teacher certificate or recognised alternative route)."],
    ["teacher_registration", "Teacher registration / licence", "Upload teacher registration or licence where required for your role and country.", true]
  ],
  driving: [
    ["driving_licence", "Driving licence", "Upload a valid licence showing the vehicle class/category you are qualified to drive."],
    ["driver_training", "Driver training / competence", "Upload recognised driving-school, professional driver training, apprenticeship or practical competence evidence appropriate to your driver category."],
    ["professional_permit", "Professional driving permit", "Upload commercial passenger, goods, public service, dangerous-goods or other additional permit only if required for the selected driving activity in your country.", true]
  ],
  electrical: [
    ["trade_qualification", "Electrical trade / technical qualification", "Upload a relevant electrical trade certificate, technical qualification, apprenticeship completion or recognised competency award."],
    ["installation_authority", "Electrical installation certification / licence", "Upload the applicable installer or contractor certification where your country regulates the work you perform.", true]
  ],
  skilled_trade: [
    ["trade_qualification", "Trade qualification / competency evidence", "Upload a relevant trade-test certificate, vocational award, apprenticeship completion certificate or recognised occupational competency certificate. If no formal award exists, submit practical work evidence and training details for manual assessment."],
    ["work_evidence", "Practical work evidence", "Provide a portfolio, work samples or employer/client reference demonstrating your trade competence.", true]
  ],
  engineering: [
    ["engineering_qualification", "Engineering qualification", "Upload your recognised engineering degree, diploma or technician qualification relevant to this specialisation."],
    ["professional_registration", "Professional engineering registration", "Upload registration or practising authorisation where your country requires it for the work you offer.", true]
  ],
  legal: [
    ["law_qualification", "Legal qualification", "Upload the recognised law qualification appropriate to the legal role you selected."],
    ["professional_registration", "Professional admission / practising certificate", "Upload bar admission, practising certificate or other statutory authorisation where required. Paralegal and support roles should upload their relevant training instead.", true]
  ],
  accounting: [
    ["accounting_qualification", "Accounting qualification", "Upload a relevant accounting, finance or bookkeeping qualification, or recognised competence award."],
    ["professional_membership", "Professional membership / practising authority", "Upload professional-body membership or practising authorisation if required for the services you advertise.", true]
  ],
  education_tutor: [
    ["subject_qualification", "Subject / teaching competence", "Upload a relevant subject qualification, teaching certificate, vocational award or other evidence that supports the subject and level you teach."],
    ["work_evidence", "Teaching experience evidence", "Upload references, lesson portfolio or evidence of relevant teaching experience where available.", true]
  ],
  creative: [
    ["portfolio", "Professional portfolio", "Upload a portfolio or examples of your own completed work. This is the primary evidence for portfolio-based creative professions."],
    ["training_evidence", "Relevant training / experience evidence", "Upload relevant course certificates, apprenticeship evidence or professional references if available.", true]
  ],
  technology: [
    ["skills_portfolio", "Technical portfolio / work evidence", "Upload project samples, code portfolio, deployed work, client references or other evidence relevant to your technical specialisation."],
    ["technical_certification", "Technical certification", "Upload relevant industry certification or formal technical qualification if you hold one.", true]
  ],
  care: [
    ["care_training", "Care / support training", "Upload relevant caregiver, social-care, first-aid or safeguarding training appropriate to the services you offer."],
    ["registration", "Required care registration / clearance", "Upload statutory registration or role-specific clearance only where your country requires it for this activity.", true]
  ],
  aviation: [
    ["aviation_licence", "Aviation / marine licence", "Upload the current licence and ratings issued for the aircraft, vessel or activity you operate."],
    ["technical_qualification", "Technical qualification / medical", "Upload required technical qualifications, endorsements and current medical evidence where the regulator requires them.", true]
  ],
  general: [
    ["competence_evidence", "Qualification or competence evidence", "Upload a relevant certificate, vocational award, apprenticeship completion, employer training record or other evidence that demonstrates competence in this profession."],
    ["work_portfolio", "Work portfolio / references", "If your profession is learned through practice, upload examples of completed work, client references or employer confirmation.", true]
  ]
};

const COUNTRY_LABELS = Object.fromEntries(INITIAL_COUNTRIES.map(c => [c.iso3, c.name]));

function professionFamily(group, profession) {
  const g = String(group || "").toLowerCase();
  const p = String(profession || "").toLowerCase();
  if (/doctor|physician|surgeon|dentist|optometrist|medical laboratory|pharmacist|psychologist|physiotherapist|dietitian|nutritionist/.test(p)) return p.includes("pharmac") ? "pharmacy" : p.includes("dentist") ? "medical" : "medical";
  if (/nurse|midwife/.test(p)) return "nursing";
  if (/driver|chauffeur|dispatch rider|delivery driver|truck driver/.test(p)) return "driving";
  if (/teacher|tutor|educator|instructor|lecturer|trainer/.test(p) || g.includes("education")) return "teaching";
  if (/electrician|electrical|power systems|meter installer|solar installer|inverter technician/.test(p) || g.includes("electrical")) return "electrical";
  if (/engineer|architect|quantity surveyor|land surveyor/.test(p)) return "engineering";
  if (/lawyer|legal|paralegal|notary/.test(p)) return "legal";
  if (/accountant|auditor|bookkeeper|investment adviser|financial analyst/.test(p)) return "accounting";
  if (/photograph|videograph|graphic designer|fashion designer|tailor|musician|singer|artist|illustrator|animator|content creator|writer|editor|makeup artist|hair stylist|barber/.test(p)) return "creative";
  if (/software|developer|cybersecurity|network|cloud engineer|data analyst|data scientist|database|it support|computer technician|qa tester|devops|ui\/ux/.test(p)) return "technology";
  if (/caregiver|nanny|social worker|disability support|community health/.test(p)) return "care";
  if (/pilot|aviation|aircraft|marine|boat operator|diver/.test(p)) return "aviation";
  if (["Building & Masonry","Plumbing & Water","Carpentry & Furniture","Welding & Metalwork","Automotive & Transport","Cooling & Refrigeration","Manufacturing & Industry","Agriculture & Livestock","Artisan & Handicraft"].includes(group)) return "skilled_trade";
  if (g.includes("health")) return "care";
  return "general";
}

function authorityFor(countryIso3, family) {
  const authorities = COUNTRY_AUTHORITIES[countryIso3] || {};
  if (["medical","nursing","pharmacy"].includes(family)) return authorities[family] || null;
  if (family === "teaching") return authorities.teaching || null;
  if (family === "driving") return authorities.driving || null;
  if (family === "electrical") return authorities.electrical || null;
  if (family === "engineering") return authorities.engineering || null;
  if (family === "legal") return authorities.legal || null;
  if (family === "accounting") return authorities.accounting || null;
  return null;
}

export function getProfessionalDocumentRequirements(countryIso3, group, profession) {
  const iso3 = String(countryIso3 || "").toUpperCase();
  const country = COUNTRY_BY_CODE[Object.values(COUNTRY_BY_CODE).find(c => c.iso3 === iso3)?.code] || null;
  const countryName = country?.name || COUNTRY_LABELS[iso3] || "your selected country";
  const family = professionFamily(group, profession);
  const authority = authorityFor(iso3, family);
  const definitions = FAMILY_RULES[family] || FAMILY_RULES.general;
  const countryKnownAuthority = Boolean(authority);
  const authorityRequirementIndex = family === "driving" ? 2 : 1;
  const jurisdictionRegulated = REGULATED_GROUPS.has(group);
  return definitions.map(([id, title, description, conditional], index) => ({
    id,
    documentType: "professional_" + id,
    title,
    description: authority && index === 1 ? description + " Issuing authority in " + countryName + ": " + authority + "." : description,
    required: !conditional,
    conditional: Boolean(conditional),
    countryIso3: iso3,
    countryName,
    professionFamily: family,
    authority: index === authorityRequirementIndex ? authority : null,
    jurisdictionNote: "Requirements are assessed under " + countryName + " rules. Where the occupation is not legally regulated, upload the relevant competence evidence instead of an unavailable statutory licence.",
    evidenceRoute: ["creative","technology","general","skilled_trade"].includes(family) ? "qualification_or_practical_evidence" : "formal_qualification_and_regulatory_evidence",
    reviewStatus: "pending"
  }));
}

export function getProfessionalDocumentFamily(group, profession) {
  return professionFamily(group, profession);
}
