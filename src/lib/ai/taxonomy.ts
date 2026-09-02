export interface CategoryDefinition {
  category: string;
  subcategories: string[];
  keywords: string[];
  commonSkills: string[];
}

export const CONTROLLED_TAXONOMY: Record<string, CategoryDefinition> = {
  "Software & Engineering": {
    category: "Software & Engineering",
    subcategories: [
      "Frontend Engineering",
      "Backend Engineering",
      "Full Stack Engineering",
      "Mobile Development",
      "DevOps & Cloud",
      "Security Engineering",
      "Embedded Systems",
      "QA & Testing",
      "Systems Architecture"
    ],
    keywords: ["software", "developer", "engineer", "frontend", "backend", "fullstack", "mobile", "ios", "android", "devops", "cloud", "sre", "qa", "firmware"],
    commonSkills: ["TypeScript", "JavaScript", "Python", "Java", "Go", "Rust", "C++", "React", "Node.js", "AWS", "Docker", "Kubernetes", "Git", "CI/CD"]
  },
  "Data & AI": {
    category: "Data & AI",
    subcategories: [
      "Data Analysis",
      "Data Science",
      "Machine Learning Engineering",
      "AI Research",
      "Data Engineering",
      "Business Intelligence",
      "Computer Vision",
      "NLP"
    ],
    keywords: ["data", "analyst", "analytics", "scientist", "machine learning", "ai", "artificial intelligence", "ml", "bi", "deep learning", "nlp", "llm"],
    commonSkills: ["SQL", "Python", "R", "Pandas", "PyTorch", "TensorFlow", "Power BI", "Tableau", "Spark", "Snowflake", "dbt", "Machine Learning"]
  },
  "Information Technology": {
    category: "Information Technology",
    subcategories: [
      "IT Support & Helpdesk",
      "Network Administration",
      "System Administration",
      "Database Administration",
      "Cybersecurity & SOC",
      "IT Project Management"
    ],
    keywords: ["it support", "helpdesk", "sysadmin", "network", "system administrator", "dba", "cybersecurity", "soc", "infosec"],
    commonSkills: ["Linux", "Windows Server", "Active Directory", "Networking", "Firewalls", "Bash", "Powershell", "ITSM", "Cisco"]
  },
  "Finance & Accounting": {
    category: "Finance & Accounting",
    subcategories: [
      "Accounting & Bookkeeping",
      "Financial Analysis",
      "Auditing",
      "Taxation",
      "Investment Banking",
      "Corporate Finance",
      "Risk & Compliance"
    ],
    keywords: ["finance", "accountant", "accounting", "financial", "auditor", "tax", "banking", "treasury", "controller", "cpa", "bookkeeper"],
    commonSkills: ["Financial Modeling", "Excel", "GAAP", "Tax Preparation", "QuickBooks", "SAP", "Forecasting", "Budgeting"]
  },
  "Sales": {
    category: "Sales",
    subcategories: [
      "Account Executive",
      "Business Development (BDR/SDR)",
      "Sales Management",
      "Technical Sales",
      "Inside Sales",
      "Retail Sales"
    ],
    keywords: ["sales", "account executive", "bdr", "sdr", "business development", "selling", "account manager"],
    commonSkills: ["Salesforce", "CRM", "Cold Calling", "Negotiation", "Lead Generation", "Pipeline Management", "Closing"]
  },
  "Marketing": {
    category: "Marketing",
    subcategories: [
      "Digital Marketing",
      "Content & Copywriting",
      "SEO & SEM",
      "Growth Marketing",
      "Product Marketing",
      "Social Media & Brand",
      "Email Marketing"
    ],
    keywords: ["marketing", "seo", "sem", "content", "copywriter", "growth", "social media", "brand", "campaign"],
    commonSkills: ["SEO", "Google Analytics", "Content Strategy", "Social Media Marketing", "HubSpot", "Copywriting", "PPC"]
  },
  "Human Resources": {
    category: "Human Resources",
    subcategories: [
      "Talent Acquisition & Recruiting",
      "HR Generalist",
      "People Operations",
      "Compensation & Benefits",
      "Learning & Development"
    ],
    keywords: ["hr", "human resources", "recruiter", "talent acquisition", "people ops", "benefits", "payroll"],
    commonSkills: ["Recruiting", "Applicant Tracking Systems", "Employee Relations", "Onboarding", "HR Policies", "Workday"]
  },
  "Operations": {
    category: "Operations",
    subcategories: [
      "Operations Management",
      "Business Operations",
      "Project Management",
      "Process Improvement"
    ],
    keywords: ["operations", "operational", "bizops", "project manager", "scrum master", "process"],
    commonSkills: ["Project Management", "Agile", "Scrum", "Process Optimization", "Jira", "Workflow Management"]
  },
  "Supply Chain": {
    category: "Supply Chain",
    subcategories: [
      "Logistics Management",
      "Procurement & Purchasing",
      "Warehouse Operations",
      "Inventory Management"
    ],
    keywords: ["supply chain", "logistics", "procurement", "purchasing", "warehouse", "inventory", "freight"],
    commonSkills: ["ERP", "Supply Chain Management", "Inventory Control", "Vendor Management", "Logistics Planning"]
  },
  "Manufacturing": {
    category: "Manufacturing",
    subcategories: [
      "Production Engineering",
      "Quality Control & QA",
      "Machining & CNC",
      "Plant Operations"
    ],
    keywords: ["manufacturing", "production", "plant", "machinist", "cnc", "assembly", "fabrication"],
    commonSkills: ["Quality Assurance", "Six Sigma", "Lean Manufacturing", "CAD", "Safety Compliance"]
  },
  "Healthcare": {
    category: "Healthcare",
    subcategories: [
      "Nursing",
      "Medical Practice & Physicians",
      "Pharmacy",
      "Health Administration",
      "Therapy & Rehabilitation"
    ],
    keywords: ["healthcare", "nurse", "nursing", "doctor", "physician", "medical", "clinic", "hospital", "pharmacist", "therapist"],
    commonSkills: ["Patient Care", "Clinical Documentation", "BLS/ACLS", "HIPAA", "Pharmacology", "EMR/EHR"]
  },
  "Education": {
    category: "Education",
    subcategories: [
      "Teaching (K-12)",
      "Higher Education & Professors",
      "Curriculum Development",
      "Tutoring & Instructional Design"
    ],
    keywords: ["teacher", "teaching", "education", "professor", "curriculum", "tutor", "instructor", "academic"],
    commonSkills: ["Classroom Management", "Curriculum Design", "Instructional Strategies", "E-Learning", "LMS"]
  },
  "Agriculture & Agribusiness": {
    category: "Agriculture & Agribusiness",
    subcategories: [
      "Agronomy & Crop Management",
      "Agricultural Engineering",
      "Farm Management",
      "Food Processing & Quality"
    ],
    keywords: ["agriculture", "agribusiness", "agronomy", "farming", "crop", "horticulture", "livestock", "food production"],
    commonSkills: ["Crop Management", "Soil Science", "Farm Operations", "Pest Management", "AgTech"]
  },
  "Legal": {
    category: "Legal",
    subcategories: [
      "Corporate Legal Counsel",
      "Paralegal & Legal Assistant",
      "Compliance & Regulatory",
      "Litigation"
    ],
    keywords: ["legal", "lawyer", "attorney", "paralegal", "counsel", "compliance", "regulatory", "contracts"],
    commonSkills: ["Contract Drafting", "Legal Research", "Regulatory Compliance", "Due Diligence", "Litigation Support"]
  },
  "Design & Creative": {
    category: "Design & Creative",
    subcategories: [
      "UI/UX Design",
      "Graphic Design",
      "Product Design",
      "Animation & Motion Design",
      "Industrial Design"
    ],
    keywords: ["design", "designer", "ui", "ux", "graphic design", "product designer", "creative", "animator"],
    commonSkills: ["Figma", "Adobe Creative Suite", "Prototyping", "User Research", "Wireframing", "Visual Design"]
  },
  "Media": {
    category: "Media",
    subcategories: [
      "Journalism & Reporting",
      "Video Production & Editing",
      "Broadcasting",
      "Public Relations"
    ],
    keywords: ["media", "journalist", "journalism", "video editor", "broadcast", "pr", "public relations"],
    commonSkills: ["Video Editing", "Premiere Pro", "Interviewing", "Media Relations", "Storytelling"]
  },
  "Hospitality": {
    category: "Hospitality",
    subcategories: [
      "Hotel & Lodging Management",
      "Food & Beverage Service",
      "Culinary & Chefs",
      "Event Planning"
    ],
    keywords: ["hospitality", "hotel", "restaurant", "chef", "cook", "food service", "bartender", "events", "concierge"],
    commonSkills: ["Guest Services", "Food Safety (ServSafe)", "Event Coordination", "POS Systems"]
  },
  "Retail": {
    category: "Retail",
    subcategories: [
      "Store Management",
      "Merchandising",
      "Cashier & Customer Assistance",
      "E-commerce Retail"
    ],
    keywords: ["retail", "store manager", "merchandiser", "cashier", "shop", "floor associate"],
    commonSkills: ["Visual Merchandising", "Inventory Tracking", "Point of Sale", "Customer Interaction"]
  },
  "Customer Service": {
    category: "Customer Service",
    subcategories: [
      "Customer Support Representative",
      "Client Success Management",
      "Call Center Operations",
      "Technical Support"
    ],
    keywords: ["customer service", "customer support", "client success", "customer success", "call center", "support rep"],
    commonSkills: ["Zendesk", "Customer Satisfaction (CSAT)", "Conflict Resolution", "Interpersonal Skills"]
  },
  "Construction": {
    category: "Construction",
    subcategories: [
      "Site Supervision & Construction Management",
      "Civil Engineering",
      "Electrical & Plumbing Trades",
      "Carpentry & Masonry"
    ],
    keywords: ["construction", "site manager", "civil engineer", "carpenter", "electrician", "plumber", "contractor"],
    commonSkills: ["Blueprints", "OSHA Safety", "Project Estimation", "Site Inspection", "AutoCAD"]
  },
  "Government": {
    category: "Government",
    subcategories: [
      "Public Administration",
      "Policy & Analysis",
      "Emergency Services & Public Safety",
      "Municipal Services"
    ],
    keywords: ["government", "public sector", "federal", "state government", "municipal", "policy analyst", "public administration"],
    commonSkills: ["Public Policy", "Government Regulations", "Grant Writing", "Public Sector Management"]
  },
  "Research": {
    category: "Research",
    subcategories: [
      "Scientific Research",
      "Market Research",
      "Academic Research",
      "R&D Laboratory"
    ],
    keywords: ["research", "researcher", "scientist", "r&d", "postdoc", "laboratory", "experimental"],
    commonSkills: ["Experimental Design", "Data Analysis", "Scientific Writing", "Lab Techniques", "Statistical Modeling"]
  },
  "Internship": {
    category: "Internship",
    subcategories: ["Technical Internship", "Business Internship", "Research Internship", "Design Internship"],
    keywords: ["intern", "internship", "summer intern", "student intern", "trainee"],
    commonSkills: ["Learning Agility", "Team Collaboration", "Problem Solving", "Communication"]
  },
  "Apprenticeship": {
    category: "Apprenticeship",
    subcategories: ["Trade Apprenticeship", "Technical Apprenticeship"],
    keywords: ["apprentice", "apprenticeship"],
    commonSkills: ["Practical Training", "Workplace Safety", "Trade Skills"]
  },
  "Part-Time": {
    category: "Part-Time",
    subcategories: ["Part-Time Service", "Part-Time Retail", "Part-Time Admin"],
    keywords: ["part-time", "part time", "weekend"],
    commonSkills: ["Flexibility", "Reliability", "Multitasking"]
  },
  "Gig/Contract": {
    category: "Gig/Contract",
    subcategories: ["Freelance Consulting", "Independent Contractor"],
    keywords: ["contractor", "freelance", "gig", "contract", "consultant"],
    commonSkills: ["Client Management", "Self-Direction", "Time Management"]
  },
  "Other": {
    category: "Other",
    subcategories: ["General Employment"],
    keywords: [],
    commonSkills: []
  }
};

export const CATEGORY_NAMES = Object.keys(CONTROLLED_TAXONOMY);
