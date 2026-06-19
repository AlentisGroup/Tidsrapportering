const STORAGE_KEY = "novadex-tid-loner-state-v1";
const supabaseConfig = globalThis.NOVADEX_SUPABASE || {};
const supabaseClient = globalThis.supabase?.createClient && supabaseConfig.url && supabaseConfig.anonKey
  ? globalThis.supabase.createClient(supabaseConfig.url, supabaseConfig.anonKey)
  : null;
let cloudSession = null;
let cloudProfile = null;
let cloudAccountRequests = [];
let cloudHealth = {
  checkedAt: "",
  auth: false,
  database: false,
  tables: [],
  error: ""
};

function makeId() {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

const defaultState = {
  clients: [
    { id: makeId(), name: "Nordvik AB", org: "556214-1190", email: "ekonomi@nordvik.example", billingEmail: "faktura@nordvik.example", invoiceReference: "Anna Berg", invoiceAddress: "Storgatan 12, 111 22 Stockholm", paymentTerms: "", vatRate: "", owner: "Anna Berg", rate: 1050 },
    { id: makeId(), name: "Södra Handel", org: "559008-4412", email: "loner@sodrahandel.example", billingEmail: "ekonomi@sodrahandel.example", invoiceReference: "Johan Lind", invoiceAddress: "Köpmangatan 4, 411 10 Göteborg", paymentTerms: "", vatRate: "", owner: "Johan Lind", rate: 950 },
    { id: makeId(), name: "Lind & Co Fastigheter", org: "556781-0234", email: "info@lindfastigheter.example", billingEmail: "fakturor@lindfastigheter.example", invoiceReference: "Mira Holm", invoiceAddress: "Norra Vägen 8, 212 18 Malmö", paymentTerms: "", vatRate: "", owner: "Mira Holm", rate: 1150 },
    { id: makeId(), name: "Intern byrå", org: "", email: "", billingEmail: "", invoiceReference: "", invoiceAddress: "", paymentTerms: "", vatRate: "", owner: "Admin", rate: 0 }
  ],
  entries: [],
  projects: [],
  receipts: [],
  travels: [],
  agreements: [],
  esignatures: [],
  invoices: [],
  timeLocks: [],
  users: [
    { id: "admin-anna", name: "Anna Berg", email: "anna@novadex.example", role: "admin", title: "Administratör" },
    { id: "owner-johan", name: "Johan Lind", email: "johan@novadex.example", role: "owner", title: "Kundansvarig" },
    { id: "employee-mira", name: "Mira Holm", email: "mira@novadex.example", role: "employee", title: "Medarbetare" },
    { id: "customer-nordvik", name: "Mikael Andersson", email: "mikael@nordvik.example", role: "customer", title: "Kund", clientId: "" }
  ],
  accountRequests: [
    { id: makeId(), name: "Erik Nordin", email: "erik@kundbolag.example", requestedRole: "employee", company: "Nordvik AB", status: "pending", createdAt: offsetDate(0), note: "Behöver rapportera tid och kvitton." },
    { id: makeId(), name: "Sara Ek", email: "sara@novadex.example", requestedRole: "owner", company: "Novadex", status: "pending", createdAt: offsetDate(-1), note: "Ny kundansvarig för IT-kunder." },
    { id: makeId(), name: "Lena Wallin", email: "lena@nordvik.example", requestedRole: "customer", company: "Nordvik AB", status: "pending", createdAt: offsetDate(-2), note: "Vill följa avtal, fakturor och ladda upp underlag i portalen." }
  ],
  currentUserId: "admin-anna",
  settings: {
    companyName: "Novadex Tid & Löner",
    adminEmail: "info@novadex.se",
    approvalMode: "admin",
    weekLockDay: "Fredag",
    defaultRate: 950,
    invoicePrefix: "F",
    nextInvoiceNumber: 1,
    paymentTerms: 10,
    vatRate: 25,
    workdayHours: 8,
    defaultDueDays: 7,
    invoiceReminderDays: 5,
    portalAutoNotify: true,
    customerApprovalRequired: true,
    bankgiro: "000-0000",
    invoiceFooter: "Tack för förtroendet."
  },
  shortcuts: [
    { label: "Tidsregistrering", view: "time" },
    { label: "Rapporter", view: "reports" }
  ],
  newsPosts: []
};

const today = new Date();
const isoToday = toISODate(today);
const seededEntries = [
  {
    employee: "Anna Berg",
    clientName: "Nordvik AB",
    type: "project",
    workOrder: "Månadsredovisning",
    task: "Bokföring",
    hours: 2.5,
    billable: true,
    payroll: true,
    status: "approved",
    description: "Månadsavstämning och momsunderlag",
    date: isoToday
  },
  {
    employee: "Johan Lind",
    clientName: "Södra Handel",
    type: "project",
    workOrder: "Lönekörning maj",
    task: "Löner",
    hours: 1.8,
    billable: true,
    payroll: true,
    status: "draft",
    description: "Lönerapport och arbetsgivardeklaration",
    date: offsetDate(-1)
  },
  {
    employee: "Mira Holm",
    clientName: "Lind & Co Fastigheter",
    type: "project",
    workOrder: "Rådgivning",
    task: "Rådgivning",
    hours: 1.2,
    billable: true,
    payroll: true,
    status: "approved",
    description: "Likviditetsplanering",
    date: offsetDate(-2)
  },
  {
    employee: "Anna Berg",
    clientName: "Intern byrå",
    type: "internal",
    workOrder: "Byrådrift",
    task: "Intern administration",
    hours: 0.7,
    billable: false,
    payroll: true,
    status: "draft",
    description: "Intern kontroll av underlag",
    date: offsetDate(-3)
  },
  {
    employee: "Johan Lind",
    clientName: "Intern byrå",
    type: "absence",
    workOrder: "Frånvaro",
    task: "Frånvaro",
    hours: 4,
    billable: false,
    payroll: true,
    status: "approved",
    description: "Halvdag semester",
    date: offsetDate(-4)
  }
];

defaultState.entries = seededEntries.map((entry) => ({
  ...(({ clientName, ...rest }) => rest)(entry),
  id: makeId(),
  clientId: defaultState.clients.find((client) => client.name === entry.clientName)?.id
}));

defaultState.projects = [
  {
    id: makeId(),
    name: "Månadsredovisning",
    clientId: defaultState.clients.find((client) => client.name === "Nordvik AB")?.id,
    manager: "Anna Berg",
    start: offsetDate(-14),
      status: "active",
      budget: 24,
      fixedPrice: 0,
      description: "Löpande bokföring, avstämning och momsunderlag.",
    checklist: [
      { text: "Hämta bankunderlag", done: true },
      { text: "Stäm av kundreskontra", done: true },
      { text: "Förbered momsrapport", done: false }
    ]
  },
  {
    id: makeId(),
    name: "Lönekörning maj",
    clientId: defaultState.clients.find((client) => client.name === "Södra Handel")?.id,
    manager: "Johan Lind",
    start: offsetDate(-7),
      status: "active",
      budget: 12,
      fixedPrice: 50000,
      description: "Löner, frånvaro, tillägg och arbetsgivardeklaration.",
    checklist: [
      { text: "Kontrollera avvikelser", done: true },
      { text: "Godkänn löneunderlag", done: false }
    ]
  }
];

defaultState.receipts = [
  {
    id: makeId(),
    date: offsetDate(-1),
    supplier: "Office Depot",
    amount: 684,
    vat: 136.8,
    clientId: defaultState.clients.find((client) => client.name === "Nordvik AB")?.id,
    projectId: defaultState.projects[0]?.id,
    billable: true,
    payroll: true,
    status: "draft"
  }
];

defaultState.travels = [
  {
    id: makeId(),
    date: offsetDate(-2),
    type: "mileage",
    from: "Kontoret",
    to: "Nordvik AB",
    quantity: 3.4,
    clientId: defaultState.clients.find((client) => client.name === "Nordvik AB")?.id,
    billable: true,
    payroll: true,
    status: "approved"
  }
];

defaultState.agreements = [
  {
    id: makeId(),
    number: 12,
    title: "Avtal med kunden",
    type: "Kundavtal",
    clientId: defaultState.clients.find((client) => client.name === "Nordvik AB")?.id,
    projectId: defaultState.projects[0]?.id,
    clientEmail: "ekonomi@nordvik.example",
    watchDate: offsetDate(60),
    endDate: offsetDate(75),
    owner: "Anna Berg",
    label: "Årsavtal",
    permission: "Alla administratörer",
    scope: "Löpande redovisning, momsrapportering, avstämningar, löneadministration och rådgivning enligt separat uppdragsplan.",
    price: "Löpande enligt aktuell prislista och kundens timpris",
    payment: "10 dagar netto",
    message: "Hej, här kommer avtalet för ert godkännande.",
    status: "sent",
    sentAt: offsetDate(-2),
    signedAt: ""
  }
];

defaultState.esignatures = [
  {
    id: makeId(),
    number: 1001,
    title: "Signering av kundavtal",
    docType: "Avtal",
    agreementId: defaultState.agreements[0]?.id,
    clientId: defaultState.clients.find((client) => client.name === "Nordvik AB")?.id,
    owner: "Anna Berg",
    reminderDate: offsetDate(5),
    dueDate: offsetDate(14),
    message: "Hej, vänligen signera kundavtalet.",
    status: "sent",
    sentAt: offsetDate(-1)
  }
];

defaultState.users.find((user) => user.id === "customer-nordvik").clientId = defaultState.clients[0]?.id || "";

defaultState.portalTasks = [
  {
    id: makeId(),
    clientId: defaultState.clients.find((client) => client.name === "Nordvik AB")?.id,
    title: "Ladda upp kontoutdrag för maj",
    type: "Underlag",
    status: "waiting",
    owner: "Anna Berg",
    dueDate: offsetDate(5),
    createdAt: offsetDate(-1),
    message: "Behövs för att färdigställa månadsredovisningen.",
    uploads: [],
    comments: [
      { id: makeId(), author: "Anna Berg", role: "Admin", body: "Ladda gärna upp kontoutdraget här när banken är avstämd.", createdAt: offsetDate(-1) }
    ]
  },
  {
    id: makeId(),
    clientId: defaultState.clients.find((client) => client.name === "Södra Handel")?.id,
    title: "Godkänn löneunderlag",
    type: "Godkännande",
    status: "open",
    owner: "Johan Lind",
    dueDate: offsetDate(3),
    createdAt: offsetDate(-2),
    message: "Kontrollera frånvaro, tillägg och timmar innan lönekörning.",
    uploads: [],
    comments: [
      { id: makeId(), author: "Johan Lind", role: "Kundansvarig", body: "Svara i tråden om något värde behöver ändras innan körning.", createdAt: offsetDate(-2) }
    ]
  },
  {
    id: makeId(),
    clientId: defaultState.clients.find((client) => client.name === "Nordvik AB")?.id,
    title: "Signera uppdaterat kundavtal",
    type: "Signering",
    status: "done",
    owner: "Anna Berg",
    dueDate: offsetDate(-1),
    createdAt: offsetDate(-6),
    completedAt: offsetDate(-1),
    message: "Avtalet är mottaget och signerat.",
    uploads: [],
    comments: [
      { id: makeId(), author: "Mikael Andersson", role: "Kund", body: "Avtalet är genomläst och signerat.", createdAt: offsetDate(-1) }
    ]
  }
];

let state = loadState();
let timer = {
  running: false,
  startedAt: null,
  elapsedSeconds: 0,
  interval: null,
  context: null
};
let calendarCursor = new Date();
let newsLikes = 0;
let newsComments = 0;
let selectedClientId = state.clients[0]?.id || "";
let selectedProjectId = state.projects[0]?.id || "";
let selectedTimePeriodMode = "day";
let selectedTimeAnchorDate = isoToday;
let selectedTimeEmployee = "";
let selectedReportId = "worked-time";
let selectedTaskStatus = "all";
let selectedPortalFocus = "all";

const viewTitles = {
  dashboard: "Start",
  tasks: "Uppgifter",
  time: "Tidsrapportering",
  clients: "Kunder",
  sales: "Affärsmöjligheter",
  projects: "Projekt",
  agreements: "Avtal",
  esign: "E-signeringar",
  invoice: "Att fakturera",
  planning: "Resursplanering",
  analysis: "Analys",
  portal: "Kundportal",
  collaboration: "Samarbete",
  versions: "Testa olika versioner",
  reports: "Rapporter"
};

const roleLabels = {
  admin: "Admin",
  owner: "Kundansvarig",
  employee: "Medarbetare",
  customer: "Kund"
};

const roleAccess = {
  admin: ["dashboard", "tasks", "time", "clients", "sales", "projects", "agreements", "esign", "invoice", "planning", "analysis", "portal", "collaboration", "versions", "reports"],
  owner: ["dashboard", "tasks", "time", "clients", "sales", "projects", "agreements", "esign", "invoice", "planning", "analysis", "portal", "collaboration", "versions", "reports"],
  employee: ["dashboard", "tasks", "time", "planning", "analysis", "collaboration", "versions", "reports"],
  customer: ["portal"]
};

const portalTaskTemplates = [
  { type: "Underlag", title: "Ladda upp kontoutdrag", message: "Ladda upp kontoutdrag och eventuella verifikat för perioden.", dueDays: 7 },
  { type: "Godkännande", title: "Godkänn löneunderlag", message: "Kontrollera frånvaro, tillägg och timmar innan lönekörning.", dueDays: 3 },
  { type: "Kvitton", title: "Skicka kvitton", message: "Ladda upp saknade kvitton eller leverantörsunderlag.", dueDays: 5 },
  { type: "Signering", title: "Signera avtal", message: "Läs igenom avtalet och signera eller skriv en kommentar om något ska ändras.", dueDays: 10 }
];

const reportDefinitions = [
  { id: "worked-time", code: "TID-01", title: "Uppföljning av arbetad och debiterbar tid", tag: "Tidrapportering", description: "Fördelar rapporterade och debiterbara timmar per kund, projekt, aktivitet och medarbetare.", view: "reports", moduleLabel: "Tidrapportering", owner: "Byråansvarig", frequency: "Vecka/månad", favorite: true, keywords: ["debiteringsgrad", "kundtid", "projekt", "aktivitet"] },
  { id: "invoice-basis", code: "FAK-01", title: "Fakturaunderlag", tag: "Fakturering", description: "Visar attesterade poster som kan bli fakturor samt redan skapade fakturaunderlag.", view: "invoice", moduleLabel: "Fakturering", owner: "Ekonomi", frequency: "Löpande", favorite: true, keywords: ["att fakturera", "utkast", "spärrar", "fastpris"] },
  { id: "payroll", code: "LON-01", title: "Löneunderlag", tag: "Lön", description: "Samlar arbetad tid, frånvaro, kvitton, resor och traktamenten per medarbetare.", view: "reports", moduleLabel: "Tid & lön", owner: "Löneansvarig", frequency: "Månad", favorite: true, keywords: ["lön", "frånvaro", "utlägg", "resor"] },
  { id: "receipts", code: "KVI-01", title: "Kvitton och utlägg", tag: "Kvitton", description: "Följer upp privata utlägg och inköp med status för attest och eventuell fakturering.", view: "time", moduleLabel: "Kvitton", owner: "Medarbetare", frequency: "Löpande", favorite: false, keywords: ["utlägg", "kvitto", "inköp", "underlag"] },
  { id: "absence", code: "FRV-01", title: "Frånvaro", tag: "Frånvaro", description: "Visar frånvaroorsaker, timmar och lönepåverkan för vald period.", view: "analysis", moduleLabel: "Analys", owner: "Löneansvarig", frequency: "Månad", favorite: false, keywords: ["sjuk", "semester", "vab", "schema"] },
  { id: "internal", code: "INT-01", title: "Interntid", tag: "Interntid", description: "Analyserar ej debiterbar tid och interna aktiviteter.", view: "analysis", moduleLabel: "Analys", owner: "Ledning", frequency: "Vecka", favorite: false, keywords: ["intern", "ej debiterbar", "administration"] },
  { id: "customers", code: "KND-01", title: "Kundstatus", tag: "Kund", description: "Kombinerar kundansvarig, projekt, avtal, öppna ärenden och fakturavärde.", view: "clients", moduleLabel: "CRM", owner: "Kundansvarig", frequency: "Löpande", favorite: false, keywords: ["kund", "avtal", "projekt", "portal"] },
  { id: "approvals", code: "ATT-01", title: "Attestflöde", tag: "Attest", description: "Lista över tid, kvitton, resor, avtal och fakturor som kräver beslut.", view: "reports", moduleLabel: "Attest", owner: "Admin", frequency: "Dagligen", favorite: true, keywords: ["attest", "godkänna", "skickat", "spärrat"] }
];

const els = {
  navItems: document.querySelectorAll("[data-view]"),
  navGroups: document.querySelectorAll(".nav-group"),
  moduleItems: document.querySelectorAll("[data-module]"),
  shortcuts: document.querySelectorAll("[data-view-shortcut]"),
  views: document.querySelectorAll(".view"),
  pageTitle: document.querySelector("#page-title"),
  globalSearch: document.querySelector(".global-search input"),
  topActions: document.querySelectorAll("[data-top-action]"),
  globalTimerButton: document.querySelector("#global-timer-button"),
  globalTimerReadout: document.querySelector("#global-timer-readout"),
  cloudStatus: document.querySelector("#cloud-status"),
  roleSwitcher: document.querySelector("#role-switcher"),
  toastStack: document.querySelector("#toast-stack"),
  trialLink: document.querySelector("[data-action='trial']"),
  calendarMonth: document.querySelector("#calendar-month"),
  calendarPrev: document.querySelector("#calendar-prev"),
  calendarNext: document.querySelector("#calendar-next"),
  calendarGrid: document.querySelector("#calendar-grid"),
  weekHours: document.querySelector("#week-hours"),
  reportedHours: document.querySelector("#reported-hours"),
  weekChange: document.querySelector("#week-change"),
  billableHours: document.querySelector("#billable-hours"),
  activeClients: document.querySelector("#active-clients"),
  pendingCount: document.querySelector("#pending-count"),
  pendingCopy: document.querySelector("#pending-copy"),
  resourceTitle: document.querySelector("#resource-title"),
  resourceHours: document.querySelector("#resource-hours"),
  clientChart: document.querySelector("#client-chart"),
  recentActivity: document.querySelector("#recent-activity"),
  tasksSummary: document.querySelector("#tasks-summary"),
  tasksBoard: document.querySelector("#tasks-board"),
  tasksPipeline: document.querySelector("#tasks-pipeline"),
  taskNewButton: document.querySelector("#task-new-button"),
  salesSummary: document.querySelector("#sales-summary"),
  salesBoard: document.querySelector("#sales-board"),
  salesActions: document.querySelector("#sales-actions"),
  salesNewButton: document.querySelector("#sales-new-button"),
  planningSummary: document.querySelector("#planning-summary"),
  planningBoard: document.querySelector("#planning-board"),
  planningModes: document.querySelectorAll("[data-planning-mode]"),
  analysisCards: document.querySelector("#analysis-cards"),
  analysisSummary: document.querySelector("#analysis-summary"),
  timerDisplay: document.querySelector("#timer-display"),
  timerStatus: document.querySelector("#timer-status"),
  timerLiveMeta: document.querySelector("#timer-live-meta"),
  timePeriodSummary: document.querySelector("#time-period-summary"),
  timeStatusSummary: document.querySelector("#time-status-summary"),
  timePeriodBoard: document.querySelector("#time-period-board"),
  monthDayBoard: document.querySelector("#month-day-board"),
  monthRegisterAside: document.querySelector("#month-register-aside"),
  timePrevPeriod: document.querySelector("#time-prev-period"),
  timeTodayPeriod: document.querySelector("#time-today-period"),
  timeNextPeriod: document.querySelector("#time-next-period"),
  timeExpandBlocks: document.querySelector("#time-expand-blocks"),
  timeSubmitPeriod: document.querySelector("#time-submit-period"),
  timeLockPeriod: document.querySelector("#time-lock-period"),
  timeAttestMonth: document.querySelector("#time-attest-month"),
  timerType: document.querySelector("#timer-type"),
  timerClient: document.querySelector("#timer-client"),
  timerProject: document.querySelector("#timer-project"),
  timerWorkOrder: document.querySelector("#timer-workorder"),
  timerTask: document.querySelector("#timer-task"),
  timerDescription: document.querySelector("#timer-description"),
  startTimer: document.querySelector("#start-timer"),
  pauseTimer: document.querySelector("#pause-timer"),
  stopTimer: document.querySelector("#stop-timer"),
  copyLastEntry: document.querySelector("#copy-last-entry"),
  entryForm: document.querySelector("#entry-form"),
  entryDate: document.querySelector("#entry-date"),
  entryEmployee: document.querySelector("#entry-employee"),
  entryType: document.querySelector("#entry-type"),
  entryClient: document.querySelector("#entry-client"),
  entryProject: document.querySelector("#entry-project"),
  entryWorkOrder: document.querySelector("#entry-workorder"),
  entryTask: document.querySelector("#entry-task"),
  entryHours: document.querySelector("#entry-hours"),
  entryStatus: document.querySelector("#entry-status"),
  entryBillable: document.querySelector("#entry-billable"),
  entryPayroll: document.querySelector("#entry-payroll"),
  entryDescription: document.querySelector("#entry-description"),
  filterClient: document.querySelector("#filter-client"),
  filterStatus: document.querySelector("#filter-status"),
  entriesTable: document.querySelector("#entries-table"),
  clientForm: document.querySelector("#client-form"),
  clientName: document.querySelector("#client-name"),
  clientOrg: document.querySelector("#client-org"),
  clientEmail: document.querySelector("#client-email"),
  clientOwner: document.querySelector("#client-owner"),
  clientRate: document.querySelector("#client-rate"),
  clientGrid: document.querySelector("#client-grid"),
  clientDetail: document.querySelector("#client-detail"),
  projectForm: document.querySelector("#project-form"),
  projectName: document.querySelector("#project-name"),
  projectClient: document.querySelector("#project-client"),
  projectManager: document.querySelector("#project-manager"),
  projectStart: document.querySelector("#project-start"),
  projectStatus: document.querySelector("#project-status"),
  projectBudget: document.querySelector("#project-budget"),
  projectDescription: document.querySelector("#project-description"),
  projectGrid: document.querySelector("#project-grid"),
  projectDetail: document.querySelector("#project-detail"),
  agreementForm: document.querySelector("#agreement-form"),
  agreementTitle: document.querySelector("#agreement-title"),
  agreementOwner: document.querySelector("#agreement-owner"),
  agreementClient: document.querySelector("#agreement-client"),
  agreementProject: document.querySelector("#agreement-project"),
  agreementEmail: document.querySelector("#agreement-email"),
  agreementType: document.querySelector("#agreement-type"),
  agreementLabel: document.querySelector("#agreement-label"),
  agreementWatch: document.querySelector("#agreement-watch"),
  agreementEnd: document.querySelector("#agreement-end"),
  agreementPermission: document.querySelector("#agreement-permission"),
  agreementPrice: document.querySelector("#agreement-price"),
  agreementPayment: document.querySelector("#agreement-payment"),
  agreementScope: document.querySelector("#agreement-scope"),
  agreementMessage: document.querySelector("#agreement-message"),
  agreementSearch: document.querySelector("#agreement-search"),
  agreementStatusFilter: document.querySelector("#agreement-status-filter"),
  agreementsTable: document.querySelector("#agreements-table"),
  esignForm: document.querySelector("#esign-form"),
  esignTitle: document.querySelector("#esign-title"),
  esignDocType: document.querySelector("#esign-doc-type"),
  esignAgreement: document.querySelector("#esign-agreement"),
  esignClient: document.querySelector("#esign-client"),
  esignOwner: document.querySelector("#esign-owner"),
  esignReminder: document.querySelector("#esign-reminder"),
  esignDue: document.querySelector("#esign-due"),
  esignStatus: document.querySelector("#esign-status"),
  esignMessage: document.querySelector("#esign-message"),
  esignSearch: document.querySelector("#esign-search"),
  esignStatusFilter: document.querySelector("#esign-status-filter"),
  esignTable: document.querySelector("#esign-table"),
  invoicePrevMonth: document.querySelector("#invoice-prev-month"),
  invoiceCurrentMonth: document.querySelector("#invoice-current-month"),
  invoiceTotalOpen: document.querySelector("#invoice-total-open"),
  invoiceSearch: document.querySelector("#invoice-search"),
  invoiceReadinessFilter: document.querySelector("#invoice-readiness-filter"),
  invoiceFrom: document.querySelector("#invoice-from"),
  invoiceTo: document.querySelector("#invoice-to"),
  invoiceTable: document.querySelector("#invoice-table"),
  invoiceHistoryTable: document.querySelector("#invoice-history-table"),
  invoiceHistorySummary: document.querySelector("#invoice-history-summary"),
  invoiceHistorySearch: document.querySelector("#invoice-history-search"),
  invoiceHistoryStatus: document.querySelector("#invoice-history-status"),
  invoiceHistoryClient: document.querySelector("#invoice-history-client"),
  invoiceHistoryReset: document.querySelector("#invoice-history-reset"),
  invoiceTabs: document.querySelectorAll("[data-invoice-tab]"),
  invoiceViewModes: document.querySelectorAll("[data-invoice-viewmode]"),
  invoiceFilterButton: document.querySelector("#invoice-filter-button"),
  invoiceResetFilter: document.querySelector("#invoice-reset-filter"),
  invoiceCommandStrip: document.querySelector("#invoice-command-strip"),
  invoiceStatusSummary: document.querySelector("#invoice-status-summary"),
  portalClient: document.querySelector("#portal-client"),
  portalNewTask: document.querySelector("#portal-new-task"),
  portalSummary: document.querySelector("#portal-summary"),
  portalTaskList: document.querySelector("#portal-task-list"),
  portalAgreements: document.querySelector("#portal-agreements"),
  portalInvoices: document.querySelector("#portal-invoices"),
  portalDocuments: document.querySelector("#portal-documents"),
  portalTemplates: document.querySelector("#portal-templates"),
  collaborationSummary: document.querySelector("#collaboration-summary"),
  collaborationFeed: document.querySelector("#collaboration-feed"),
  collaborationPermissions: document.querySelector("#collaboration-permissions"),
  collaborationCopyLink: document.querySelector("#collaboration-copy-link"),
  collaborationNewThread: document.querySelector("#collaboration-new-thread"),
  versionsSummary: document.querySelector("#versions-summary"),
  versionGrid: document.querySelector("#version-grid"),
  versionsApplyRecommended: document.querySelector("#versions-apply-recommended"),
  newsTabs: document.querySelectorAll("[data-news-tab]"),
  newsTitle: document.querySelector("#news-title"),
  newsBody: document.querySelector("#news-body"),
  newsBodyExtra: document.querySelector("#news-body-extra"),
  newsReactions: document.querySelector("#news-reactions"),
  shortcutList: document.querySelector("#shortcut-list"),
  agreementTabs: document.querySelectorAll("[data-agreement-tab]"),
  agreementNewButton: document.querySelector("#agreement-new-button"),
  receiptForm: document.querySelector("#receipt-form"),
  receiptDate: document.querySelector("#receipt-date"),
  receiptSupplier: document.querySelector("#receipt-supplier"),
  receiptAmount: document.querySelector("#receipt-amount"),
  receiptVat: document.querySelector("#receipt-vat"),
  receiptClient: document.querySelector("#receipt-client"),
  receiptProject: document.querySelector("#receipt-project"),
  receiptBillable: document.querySelector("#receipt-billable"),
  receiptPayroll: document.querySelector("#receipt-payroll"),
  receiptFile: document.querySelector("#receipt-file"),
  receiptSummary: document.querySelector("#receipt-summary"),
  receiptSearch: document.querySelector("#receipt-search"),
  receiptStatusFilter: document.querySelector("#receipt-status-filter"),
  receiptSubmitDrafts: document.querySelector("#receipt-submit-drafts"),
  receiptApproveSubmitted: document.querySelector("#receipt-approve-submitted"),
  receiptList: document.querySelector("#receipt-list"),
  travelForm: document.querySelector("#travel-form"),
  travelDate: document.querySelector("#travel-date"),
  travelType: document.querySelector("#travel-type"),
  travelFrom: document.querySelector("#travel-from"),
  travelTo: document.querySelector("#travel-to"),
  travelQuantity: document.querySelector("#travel-quantity"),
  travelClient: document.querySelector("#travel-client"),
  travelBillable: document.querySelector("#travel-billable"),
  travelPayroll: document.querySelector("#travel-payroll"),
  travelSummary: document.querySelector("#travel-summary"),
  travelSearch: document.querySelector("#travel-search"),
  travelStatusFilter: document.querySelector("#travel-status-filter"),
  travelSubmitDrafts: document.querySelector("#travel-submit-drafts"),
  travelApproveSubmitted: document.querySelector("#travel-approve-submitted"),
  travelList: document.querySelector("#travel-list"),
  quickCards: document.querySelectorAll("[data-quick-type]"),
  periodModes: document.querySelectorAll("[data-period-mode]"),
  invoiceSummary: document.querySelector("#invoice-summary"),
  payrollSummary: document.querySelector("#payroll-summary"),
  reportSearch: document.querySelector("#report-search"),
  reportShowFavorites: document.querySelector("#report-show-favorites"),
  reportTags: document.querySelector("#report-tags"),
  reportCatalog: document.querySelector("#report-catalog"),
  reportDetailTitle: document.querySelector("#report-detail-title"),
  reportDetailDescription: document.querySelector("#report-detail-description"),
  reportDetailActions: document.querySelector("#report-detail-actions"),
  reportDetailMetrics: document.querySelector("#report-detail-metrics"),
  reportResultList: document.querySelector("#report-result-list"),
  employeeList: document.querySelector("#employee-list"),
  adminSummary: document.querySelector("#admin-summary"),
  adminChecklist: document.querySelector("#admin-checklist"),
  roleMatrix: document.querySelector("#role-matrix"),
  adminOpenSettings: document.querySelector("#admin-open-settings"),
  adminCreateUser: document.querySelector("#admin-create-user"),
  userList: document.querySelector("#user-list"),
  accountRequestList: document.querySelector("#account-request-list"),
  addAccountRequest: document.querySelector("#add-account-request"),
  approvalSummary: document.querySelector("#approval-summary"),
  approvalSearch: document.querySelector("#approval-search"),
  approvalOwnerFilter: document.querySelector("#approval-owner-filter"),
  approvalProjectFilter: document.querySelector("#approval-project-filter"),
  approvalKindFilter: document.querySelector("#approval-kind-filter"),
  approvalStatusFilter: document.querySelector("#approval-status-filter"),
  approvalFrom: document.querySelector("#approval-from"),
  approvalTo: document.querySelector("#approval-to"),
  approvalSelectAll: document.querySelector("#approval-select-all"),
  approvalActionableOnly: document.querySelector("#approval-actionable-only"),
  approvalResetFilters: document.querySelector("#approval-reset-filters"),
  approvalGroupSummary: document.querySelector("#approval-group-summary"),
  approvalBulkSubmit: document.querySelector("#approval-bulk-submit"),
  approvalBulkApprove: document.querySelector("#approval-bulk-approve"),
  approvalBulkReject: document.querySelector("#approval-bulk-reject"),
  approvalList: document.querySelector("#approval-list"),
  exportCsv: document.querySelector("#export-csv"),
  drawer: document.querySelector("#app-drawer"),
  drawerEyebrow: document.querySelector("#drawer-eyebrow"),
  drawerTitle: document.querySelector("#drawer-title"),
  drawerBody: document.querySelector("#drawer-body"),
  emptyTemplate: document.querySelector("#empty-template")
};

function loadState() {
  const saved = localStorage.getItem(STORAGE_KEY);
  if (!saved) return defaultState;

  try {
    const parsed = JSON.parse(saved);
    if (!Array.isArray(parsed.clients) || !Array.isArray(parsed.entries)) return defaultState;
    return normalizeState(parsed);
  } catch {
    return defaultState;
  }
}

function normalizeState(savedState) {
  const clients = [...savedState.clients];
  if (!clients.some((client) => client.name === "Intern byrå")) {
    clients.push({ id: makeId(), name: "Intern byrå", org: "", owner: "Admin", rate: 0 });
  }
  const users = Array.isArray(savedState.users) && savedState.users.length
    ? savedState.users.map((user) => ({ clientId: "", ...user }))
    : defaultState.users.map((user) => ({ ...user }));
  defaultState.users.forEach((defaultUser) => {
    if (!users.some((user) => user.id === defaultUser.id)) {
      users.push({ ...defaultUser });
    }
  });
  users
    .filter((user) => user.role === "customer" && !user.clientId)
    .forEach((user) => {
      const requestedClient = clients.find((client) => user.email?.includes(client.name.toLowerCase().split(" ")[0]));
      user.clientId = requestedClient?.id || clients.find((client) => client.name !== "Intern byrå")?.id || "";
    });

  return {
    clients: clients.map((client) => ({
      email: "",
      billingEmail: client.email || "",
      invoiceReference: "",
      invoiceAddress: "",
      paymentTerms: "",
      vatRate: "",
      ...client,
      billingEmail: client.billingEmail || client.email || ""
    })),
    projects: (Array.isArray(savedState.projects) ? savedState.projects : createStarterProjects(clients)).map((project) => ({
      fixedPrice: 0,
      invoiceStatus: "preliminary",
      invoiceText: "",
      invoicePaymentTerms: "",
      invoiceVatRate: "",
      ...project
    })),
    receipts: (Array.isArray(savedState.receipts) ? savedState.receipts : []).map((receipt) => ({
      status: "draft",
      reviewNote: "",
      fileName: "",
      fileType: "",
      fileData: "",
      ...receipt
    })),
    travels: (Array.isArray(savedState.travels) ? savedState.travels : []).map((travel) => ({
      status: "draft",
      reviewNote: "",
      ...travel
    })),
    agreements: (Array.isArray(savedState.agreements) ? savedState.agreements : defaultState.agreements).map((agreement) => ({
      clientEmail: getClientEmail(clients, agreement.clientId),
      projectId: "",
      scope: "",
      price: "",
      payment: "10 dagar netto",
      sentAt: "",
      signedAt: "",
      archivedAt: "",
      ...agreement
    })),
    esignatures: (Array.isArray(savedState.esignatures) ? savedState.esignatures : defaultState.esignatures).map((signature) => ({
      sentAt: "",
      signedAt: "",
      reminderSentAt: "",
      ...signature
    })),
    invoices: Array.isArray(savedState.invoices) ? savedState.invoices : [],
    timeLocks: Array.isArray(savedState.timeLocks) ? savedState.timeLocks : [],
    portalTasks: (Array.isArray(savedState.portalTasks) ? savedState.portalTasks : defaultState.portalTasks).map((task) => ({
      type: "Underlag",
      status: "open",
      owner: "",
      dueDate: "",
      createdAt: isoToday,
      message: "",
      uploads: [],
      comments: [],
      ...task
    })),
    users,
    accountRequests: Array.isArray(savedState.accountRequests) ? savedState.accountRequests : defaultState.accountRequests,
    currentUserId: savedState.currentUserId || defaultState.currentUserId,
    settings: {
      ...defaultState.settings,
      ...(savedState.settings || {})
    },
    shortcuts: Array.isArray(savedState.shortcuts) && savedState.shortcuts.length ? savedState.shortcuts : defaultState.shortcuts,
    newsPosts: Array.isArray(savedState.newsPosts) ? savedState.newsPosts : [],
    entries: savedState.entries.map((entry) => ({
      type: entry.type || (entry.billable ? "project" : "internal"),
      workOrder: entry.workOrder || "",
      payroll: entry.payroll ?? true,
      status: entry.status || "draft",
      reviewNote: entry.reviewNote || "",
      ...entry
    })),
  };
}

function createStarterProjects(clients) {
  return [
    {
      id: makeId(),
      name: "Månadsredovisning",
      clientId: clients.find((client) => client.name === "Nordvik AB")?.id || clients[0]?.id,
      manager: "Anna Berg",
      start: offsetDate(-14),
      status: "active",
      budget: 24,
      fixedPrice: 0,
      description: "Löpande bokföring, avstämning och momsunderlag.",
      checklist: [
        { text: "Hämta bankunderlag", done: true },
        { text: "Stäm av kundreskontra", done: true },
        { text: "Förbered momsrapport", done: false }
      ]
    },
    {
      id: makeId(),
      name: "Lönekörning maj",
      clientId: clients.find((client) => client.name === "Södra Handel")?.id || clients[1]?.id || clients[0]?.id,
      manager: "Johan Lind",
      start: offsetDate(-7),
      status: "active",
      budget: 12,
      fixedPrice: 50000,
      description: "Löner, frånvaro, tillägg och arbetsgivardeklaration.",
      checklist: [
        { text: "Kontrollera avvikelser", done: true },
        { text: "Godkänn löneunderlag", done: false }
      ]
    }
  ];
}

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function isSupabaseReady() {
  return Boolean(supabaseClient);
}

async function checkCloudConnection(options = {}) {
  const settings = { silent: true, ...options };
  cloudHealth = {
    checkedAt: isoToday,
    auth: false,
    database: false,
    tables: [],
    error: ""
  };

  if (!isSupabaseReady()) {
    cloudHealth.error = "Supabase SDK eller konfiguration saknas.";
    renderCloudStatus();
    return cloudHealth;
  }

  try {
    const { error: authError } = await supabaseClient.auth.getSession();
    cloudHealth.auth = !authError;

    const tableNames = ["profiles", "account_requests", "clients", "projects", "time_entries"];
    for (const tableName of tableNames) {
      const { error } = await supabaseClient
        .from(tableName)
        .select("id")
        .limit(1);
      if (error) {
        cloudHealth.error = `${tableName}: ${error.message}`;
      } else {
        cloudHealth.tables.push(tableName);
      }
    }

    cloudHealth.database = cloudHealth.tables.length === tableNames.length;
    if (!settings.silent) {
      showToast(cloudHealth.database ? "Supabase svarar och bastabellerna finns." : "Supabase svarar delvis, men alla tabeller kunde inte kontrolleras.", cloudHealth.database ? "success" : "warning");
    }
  } catch (error) {
    cloudHealth.error = error.message || "Supabase kunde inte nås.";
    if (!settings.silent) showToast(`Supabase-kontroll misslyckades: ${cloudHealth.error}`, "warning");
  }

  renderCloudStatus();
  return cloudHealth;
}

function getCloudStatusLabel() {
  if (!isSupabaseReady()) return "Moln: lokal";
  if (cloudSession?.user && cloudProfile?.is_active === false) return "Moln: väntar";
  if (cloudSession?.user) return `Moln: ${cloudSession.user.email || "inloggad"}`;
  if (cloudHealth.database) return "Moln: anslutet";
  return "Moln: redo";
}

function renderCloudStatus() {
  if (!els.cloudStatus) return;
  els.cloudStatus.textContent = getCloudStatusLabel();
  els.cloudStatus.classList.toggle("ready", Boolean(cloudSession?.user || cloudHealth.database));
  els.cloudStatus.classList.toggle("warning", isSupabaseReady() && !cloudSession?.user && !cloudHealth.database);
}

async function refreshCloudSession() {
  if (!isSupabaseReady()) {
    renderCloudStatus();
    return null;
  }
  await checkCloudConnection();
  const { data, error } = await supabaseClient.auth.getSession();
  if (error) {
    showToast(`Supabase kunde inte läsa sessionen: ${error.message}`, "warning");
    renderCloudStatus();
    return null;
  }
  cloudSession = data.session;
  await loadCloudProfile();
  syncCloudProfileToLocalUser({ silent: true });
  await loadCloudAccountRequests();
  await loadCloudBusinessData();
  if (canManageCloudAccounts()) renderAll();
  renderCloudStatus();
  return cloudSession;
}

async function loadCloudProfile() {
  cloudProfile = null;
  if (!cloudSession?.user || !isSupabaseReady()) return null;
  const { data, error } = await supabaseClient
    .from("profiles")
    .select("*")
    .eq("id", cloudSession.user.id)
    .maybeSingle();
  if (!error) cloudProfile = data;
  return cloudProfile;
}

function getSupabaseOrganizationId() {
  return cloudProfile?.organization_id || supabaseConfig.organizationId || null;
}

function isUuid(value) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(value || ""));
}

function canUseCloudData() {
  return Boolean(isSupabaseReady() && cloudSession?.user && cloudProfile?.is_active && getSupabaseOrganizationId());
}

function canManageCloudAccounts() {
  return Boolean(
    isSupabaseReady()
    && cloudSession?.user
    && cloudProfile?.is_active
    && ["admin", "owner"].includes(cloudProfile.role)
  );
}

function getCloudProfileStatusText() {
  if (!cloudSession?.user) return "Ingen molnanvändare är inloggad ännu.";
  if (!cloudProfile) return "Kontot finns, men ingen profilrad är skapad än.";
  if (!cloudProfile.is_active) return "Profilen väntar på att admin godkänner åtkomst.";
  return "Profilen är aktiv och kan användas i appen.";
}

function upsertLocalUserFromCloudProfile(profile, options = {}) {
  if (!profile?.email || profile.is_active === false) return null;
  const email = String(profile.email).toLowerCase();
  const role = Object.keys(roleLabels).includes(profile.role) ? profile.role : "employee";
  let user = state.users.find((item) => item.email.toLowerCase() === email);
  if (!user) {
    user = {
      id: makeUserId(profile.full_name || profile.email),
      name: profile.full_name || profile.email,
      email: profile.email,
      role,
      title: profile.title || roleLabels[role] || "Medarbetare",
      clientId: ""
    };
    state.users.push(user);
  } else {
    user.name = profile.full_name || user.name;
    user.role = role;
    user.title = profile.title || roleLabels[role] || user.title;
  }
  if (options.makeCurrent !== false) state.currentUserId = user.id;
  saveState();
  if (!options.silent) showToast(`Molnprofilen är aktiv: ${user.name}.`);
  renderAll();
  return user;
}

function syncCloudProfileToLocalUser(options = {}) {
  return Boolean(upsertLocalUserFromCloudProfile(cloudProfile, options));
}

function normalizeCloudAccountRequest(row) {
  return {
    id: `cloud-${row.id}`,
    cloudId: row.id,
    source: "cloud",
    name: row.full_name,
    email: row.email,
    requestedRole: row.requested_role || "employee",
    company: row.company || "",
    status: row.status || "pending",
    createdAt: row.created_at ? row.created_at.slice(0, 10) : "",
    approvedAt: row.approved_at ? row.approved_at.slice(0, 10) : "",
    rejectedAt: row.rejected_at ? row.rejected_at.slice(0, 10) : "",
    note: row.note ? `Supabase: ${row.note}` : "Supabase-ansökan"
  };
}

async function loadCloudAccountRequests() {
  cloudAccountRequests = [];
  if (!canManageCloudAccounts()) return [];
  const { data, error } = await supabaseClient
    .from("account_requests")
    .select("id, full_name, email, requested_role, company, note, status, approved_at, rejected_at, created_at")
    .order("created_at", { ascending: false });
  if (error) {
    showToast(`Kunde inte läsa molnansökningar: ${error.message}`, "warning");
    return [];
  }
  cloudAccountRequests = (data || []).map(normalizeCloudAccountRequest);
  return cloudAccountRequests;
}

function mapCloudClient(row) {
  return {
    id: row.id,
    name: row.name,
    org: row.org_number || "",
    email: row.email || "",
    billingEmail: row.billing_email || row.email || "",
    invoiceReference: row.invoice_reference || "",
    invoiceAddress: row.invoice_address || "",
    paymentTerms: row.payment_terms ?? "",
    vatRate: row.vat_rate ?? "",
    owner: row.owner_name || "",
    rate: Number(row.rate || 0),
    cloudSyncedAt: row.created_at || ""
  };
}

function mapCloudProject(row) {
  return {
    id: row.id,
    name: row.name,
    clientId: row.client_id,
    manager: row.manager_name || "",
    start: row.starts_on || "",
    status: row.status || "active",
    budget: Number(row.budget_hours || 0),
    fixedPrice: Number(row.fixed_price || 0),
    invoiceStatus: row.invoice_status || "preliminary",
    description: row.description || "",
    checklist: Array.isArray(row.checklist) ? row.checklist : [],
    cloudSyncedAt: row.created_at || ""
  };
}

function mapCloudEntry(row) {
  const profile = Array.isArray(row.profiles) ? row.profiles[0] : row.profiles;
  return {
    id: row.id,
    date: row.entry_date,
    employee: profile?.full_name || cloudProfile?.full_name || getCurrentUser().name,
    type: row.entry_type || "project",
    clientId: row.client_id,
    projectId: row.project_id || "",
    workOrder: row.work_order || "",
    task: row.task || "",
    hours: Number(row.hours || 0),
    billable: Boolean(row.billable),
    payroll: Boolean(row.payroll),
    status: row.status || "draft",
    reviewNote: row.review_note || "",
    description: row.description || "",
    cloudSyncedAt: row.created_at || ""
  };
}

function toCloudClientRow(client) {
  return {
    organization_id: getSupabaseOrganizationId(),
    name: client.name,
    org_number: client.org || null,
    email: client.email || null,
    billing_email: client.billingEmail || client.email || null,
    invoice_reference: client.invoiceReference || null,
    invoice_address: client.invoiceAddress || null,
    owner_name: client.owner || null,
    payment_terms: client.paymentTerms === "" ? null : Number(client.paymentTerms || 0),
    vat_rate: client.vatRate === "" ? null : Number(client.vatRate || 0),
    rate: Number(client.rate || 0)
  };
}

function toCloudProjectRow(project) {
  return {
    organization_id: getSupabaseOrganizationId(),
    client_id: project.clientId,
    name: project.name,
    status: project.status || "active",
    starts_on: project.start || null,
    budget_hours: Number(project.budget || 0),
    fixed_price: Number(project.fixedPrice || 0),
    invoice_status: project.invoiceStatus || "preliminary",
    description: project.description || null,
    checklist: project.checklist || []
  };
}

function toCloudEntryRow(entry) {
  return {
    organization_id: getSupabaseOrganizationId(),
    client_id: entry.clientId,
    project_id: entry.projectId || null,
    employee_profile_id: cloudProfile?.id || cloudSession?.user?.id,
    entry_date: entry.date,
    entry_type: entry.type || "project",
    work_order: entry.workOrder || null,
    task: entry.task || "Tidrapportering",
    hours: Number(entry.hours || 0),
    billable: Boolean(entry.billable),
    payroll: Boolean(entry.payroll),
    status: entry.status || "draft",
    review_note: entry.reviewNote || null,
    description: entry.description || null
  };
}

function remapClientId(oldId, newId) {
  if (!oldId || !newId || oldId === newId) return;
  state.clients.forEach((client) => {
    if (client.id === oldId) client.id = newId;
  });
  ["entries", "projects", "receipts", "travels", "agreements", "esignatures", "invoices", "portalTasks"].forEach((collection) => {
    (state[collection] || []).forEach((item) => {
      if (item.clientId === oldId) item.clientId = newId;
    });
  });
  if (selectedClientId === oldId) selectedClientId = newId;
}

function remapProjectId(oldId, newId) {
  if (!oldId || !newId || oldId === newId) return;
  state.projects.forEach((project) => {
    if (project.id === oldId) project.id = newId;
  });
  ["entries", "receipts", "agreements", "esignatures", "invoices"].forEach((collection) => {
    (state[collection] || []).forEach((item) => {
      if (item.projectId === oldId) item.projectId = newId;
    });
  });
  if (selectedProjectId === oldId) selectedProjectId = newId;
}

function remapEntryId(oldId, newId) {
  if (!oldId || !newId || oldId === newId) return;
  state.entries.forEach((entry) => {
    if (entry.id === oldId) entry.id = newId;
  });
}

async function loadCloudBusinessData() {
  if (!canUseCloudData()) return false;
  const { data: clients, error: clientError } = await supabaseClient
    .from("clients")
    .select("id, name, org_number, email, billing_email, invoice_reference, invoice_address, owner_name, payment_terms, vat_rate, rate, created_at")
    .order("name", { ascending: true });
  if (clientError) {
    showToast(`Kunder kunde inte läsas från Supabase: ${clientError.message}`, "warning");
    return false;
  }

  const { data: projects, error: projectError } = await supabaseClient
    .from("projects")
    .select("id, client_id, name, status, starts_on, budget_hours, fixed_price, invoice_status, description, checklist, created_at")
    .order("created_at", { ascending: false });
  if (projectError) {
    showToast(`Projekt kunde inte läsas från Supabase: ${projectError.message}`, "warning");
    return false;
  }

  if (clients?.length) {
    const internalClient = state.clients.find((client) => client.name === "Intern byrå");
    state.clients = clients.map(mapCloudClient);
    if (internalClient && !state.clients.some((client) => client.name === "Intern byrå")) {
      state.clients.push(internalClient);
    }
  }
  if (projects?.length) state.projects = projects.map(mapCloudProject);

  const { data: entries, error: entryError } = await supabaseClient
    .from("time_entries")
    .select("id, client_id, project_id, employee_profile_id, entry_date, entry_type, work_order, task, hours, billable, payroll, status, review_note, description, created_at, profiles:employee_profile_id(full_name, email)")
    .order("entry_date", { ascending: false });
  if (entryError) {
    showToast(`Tidsrader kunde inte läsas från Supabase: ${entryError.message}`, "warning");
  } else if (entries?.length) {
    state.entries = entries.map(mapCloudEntry);
  }

  saveState();
  renderAll();
  return true;
}

async function saveCloudClient(client) {
  if (!canUseCloudData()) return null;
  const payload = toCloudClientRow(client);
  if (isUuid(client.id)) {
    const { data, error } = await supabaseClient
      .from("clients")
      .update(payload)
      .eq("id", client.id)
      .select("id, name, org_number, email, billing_email, invoice_reference, invoice_address, owner_name, payment_terms, vat_rate, rate, created_at")
      .single();
    if (error) throw error;
    return mapCloudClient(data);
  }
  const { data, error } = await supabaseClient
    .from("clients")
    .insert(payload)
    .select("id, name, org_number, email, billing_email, invoice_reference, invoice_address, owner_name, payment_terms, vat_rate, rate, created_at")
    .single();
  if (error) throw error;
  return mapCloudClient(data);
}

async function ensureCloudClient(clientId) {
  if (isUuid(clientId)) return clientId;
  const client = getClient(clientId);
  if (!client) return clientId;
  const saved = await saveCloudClient(client);
  if (saved?.id) {
    const oldId = client.id;
    Object.assign(client, saved);
    remapClientId(oldId, saved.id);
    return saved.id;
  }
  return clientId;
}

async function ensureCloudProject(projectId) {
  if (!projectId || isUuid(projectId)) return projectId || "";
  const project = getProject(projectId);
  if (!project) return projectId;
  const saved = await saveCloudProject(project);
  if (saved?.id) {
    const oldId = project.id;
    Object.assign(project, saved);
    remapProjectId(oldId, saved.id);
    return saved.id;
  }
  return projectId;
}

async function saveCloudProject(project) {
  if (!canUseCloudData()) return null;
  project.clientId = await ensureCloudClient(project.clientId);
  if (!isUuid(project.clientId)) {
    throw new Error("Projektets kund behöver vara sparad i Supabase först.");
  }
  const payload = toCloudProjectRow(project);
  if (isUuid(project.id)) {
    const { data, error } = await supabaseClient
      .from("projects")
      .update(payload)
      .eq("id", project.id)
      .select("id, client_id, name, status, starts_on, budget_hours, fixed_price, invoice_status, description, checklist, created_at")
      .single();
    if (error) throw error;
    return mapCloudProject(data);
  }
  const { data, error } = await supabaseClient
    .from("projects")
    .insert(payload)
    .select("id, client_id, name, status, starts_on, budget_hours, fixed_price, invoice_status, description, checklist, created_at")
    .single();
  if (error) throw error;
  return mapCloudProject(data);
}

async function saveCloudEntry(entry) {
  if (!canUseCloudData()) return null;
  entry.clientId = await ensureCloudClient(entry.clientId);
  entry.projectId = await ensureCloudProject(entry.projectId);
  if (!isUuid(entry.clientId)) {
    throw new Error("Tidsradens kund behöver vara sparad i Supabase först.");
  }
  if (entry.projectId && !isUuid(entry.projectId)) {
    throw new Error("Tidsradens projekt behöver vara sparat i Supabase först.");
  }

  const payload = toCloudEntryRow(entry);
  if (isUuid(entry.id)) {
    const { data, error } = await supabaseClient
      .from("time_entries")
      .update(payload)
      .eq("id", entry.id)
      .select("id, client_id, project_id, employee_profile_id, entry_date, entry_type, work_order, task, hours, billable, payroll, status, review_note, description, created_at, profiles:employee_profile_id(full_name, email)")
      .single();
    if (error) throw error;
    return mapCloudEntry(data);
  }

  const { data, error } = await supabaseClient
    .from("time_entries")
    .insert(payload)
    .select("id, client_id, project_id, employee_profile_id, entry_date, entry_type, work_order, task, hours, billable, payroll, status, review_note, description, created_at, profiles:employee_profile_id(full_name, email)")
    .single();
  if (error) throw error;
  return mapCloudEntry(data);
}

async function deleteCloudClient(clientId) {
  if (!canUseCloudData() || !isUuid(clientId)) return true;
  const { error } = await supabaseClient.from("clients").delete().eq("id", clientId);
  if (error) throw error;
  return true;
}

async function deleteCloudProject(projectId) {
  if (!canUseCloudData() || !isUuid(projectId)) return true;
  const { error } = await supabaseClient.from("projects").delete().eq("id", projectId);
  if (error) throw error;
  return true;
}

async function deleteCloudEntry(entryId) {
  if (!canUseCloudData() || !isUuid(entryId)) return true;
  const { error } = await supabaseClient.from("time_entries").delete().eq("id", entryId);
  if (error) throw error;
  return true;
}

async function cloudApproveAccountRequest(requestId) {
  if (!canManageCloudAccounts()) {
    showToast("Logga in som aktiv admin i Supabase för att godkänna molnkonton.", "warning");
    return false;
  }
  const { data, error } = await supabaseClient.rpc("approve_account_request", {
    target_request_id: requestId
  });
  if (error) {
    showToast(`Molnansökan kunde inte godkännas: ${error.message}`, "warning");
    return false;
  }
  const profile = Array.isArray(data) ? data[0] : data;
  if (profile) upsertLocalUserFromCloudProfile(profile, { makeCurrent: false, silent: true });
  await loadCloudAccountRequests();
  saveState();
  renderAll();
  showToast("Molnansökan godkändes och profilen aktiverades.");
  return true;
}

async function cloudRejectAccountRequest(requestId) {
  if (!canManageCloudAccounts()) {
    showToast("Logga in som aktiv admin i Supabase för att avvisa molnkonton.", "warning");
    return false;
  }
  const { error } = await supabaseClient.rpc("reject_account_request", {
    target_request_id: requestId
  });
  if (error) {
    showToast(`Molnansökan kunde inte avvisas: ${error.message}`, "warning");
    return false;
  }
  await loadCloudAccountRequests();
  renderAll();
  showToast("Molnansökan avvisades.");
  return true;
}

async function cloudSignIn(email, password) {
  if (!isSupabaseReady()) {
    showToast("Supabase är inte laddat. Kontrollera internet/CDN och configfilen.", "warning");
    return false;
  }
  const { data, error } = await supabaseClient.auth.signInWithPassword({ email, password });
  if (error) {
    showToast(`Inloggningen misslyckades: ${error.message}`, "warning");
    return false;
  }
  cloudSession = data.session;
  await loadCloudProfile();
  const synced = syncCloudProfileToLocalUser({ silent: true });
  await loadCloudAccountRequests();
  await loadCloudBusinessData();
  if (canManageCloudAccounts()) renderAll();
  renderCloudStatus();
  if (!cloudProfile) {
    showToast("Du är inloggad, men admin behöver skapa eller koppla din profil i Supabase.", "warning");
  } else if (!cloudProfile.is_active) {
    showToast("Kontot väntar på admin-godkännande innan rollen aktiveras.", "warning");
  } else {
    showToast(synced ? "Du är inloggad och din roll är synkad." : "Du är inloggad mot Supabase.");
  }
  return true;
}

async function cloudRegisterAccount(formData) {
  if (!isSupabaseReady()) {
    showToast("Supabase är inte laddat. Kontrollera config och internetanslutning.", "warning");
    return false;
  }
  const fullName = String(formData.get("fullName") || "").trim();
  const email = String(formData.get("email") || "").trim().toLowerCase();
  const password = String(formData.get("password") || "");
  const requestedRole = String(formData.get("requestedRole") || "employee");
  const company = String(formData.get("company") || "").trim();
  const note = String(formData.get("note") || "").trim();
  if (!fullName || !email || !password) {
    showToast("Fyll i namn, e-post och lösenord för att skapa konto.", "warning");
    return false;
  }

  const { data, error } = await supabaseClient.auth.signUp({
    email,
    password,
    options: {
      data: {
        full_name: fullName,
        requested_role: requestedRole,
        company
      }
    }
  });
  if (error) {
    showToast(`Kontot kunde inte skapas: ${error.message}`, "warning");
    return false;
  }

  const requestPayload = {
    organization_id: getSupabaseOrganizationId(),
    full_name: fullName,
    email,
    requested_role: requestedRole,
    company,
    note,
    status: "pending"
  };
  if (!requestPayload.organization_id) delete requestPayload.organization_id;
  const { error: requestError } = await supabaseClient
    .from("account_requests")
    .insert(requestPayload);

  if (data.session) {
    cloudSession = data.session;
    await loadCloudProfile();
  }
  renderCloudStatus();
  if (requestError) {
    showToast(`Kontot skapades, men ansökan kunde inte sparas: ${requestError.message}`, "warning");
    return true;
  }
  showToast("Kontot är skapat. Admin behöver godkänna åtkomsten innan rollen aktiveras.");
  return true;
}

async function cloudSignOut() {
  if (!isSupabaseReady()) return;
  await supabaseClient.auth.signOut();
  cloudSession = null;
  cloudProfile = null;
  cloudAccountRequests = [];
  renderCloudStatus();
  showToast("Du är utloggad från Supabase.");
}

function toISODate(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function offsetDate(days) {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return toISODate(date);
}

function formatHours(hours) {
  return `${hours.toFixed(1).replace(".", ",")} h`;
}

function formatCurrency(value) {
  return new Intl.NumberFormat("sv-SE", {
    style: "currency",
    currency: "SEK",
    maximumFractionDigits: 0
  }).format(value);
}

function formatSEK(value) {
  return `${new Intl.NumberFormat("sv-SE", { maximumFractionDigits: 0 }).format(value)} SEK`;
}

function icon(name) {
  return `<i class="ti ti-${name}" aria-hidden="true"></i>`;
}

function normalizeNumber(value, fallback = 0) {
  const number = Number(String(value ?? "").replace(",", "."));
  return Number.isFinite(number) ? number : fallback;
}

function readFileInput(input) {
  const file = input?.files?.[0];
  if (!file) return Promise.resolve(null);
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve({
      fileName: file.name,
      fileType: file.type || "application/octet-stream",
      fileData: String(reader.result || "")
    });
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

function getClient(clientId) {
  return state.clients.find((client) => client.id === clientId);
}

function getProject(projectId) {
  return state.projects.find((project) => project.id === projectId);
}

function getAgreement(agreementId) {
  return state.agreements.find((agreement) => agreement.id === agreementId);
}

function getCurrentUser() {
  return state.users.find((user) => user.id === state.currentUserId) || state.users[0] || defaultState.users[0];
}

function makeUserId(name) {
  return `${name.toLowerCase().replaceAll("å", "a").replaceAll("ä", "a").replaceAll("ö", "o").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")}-${makeId().slice(-5)}`;
}

function isAdminUser() {
  return getCurrentUser().role === "admin";
}

function isOwnerUser() {
  return getCurrentUser().role === "owner";
}

function canAccessView(viewName) {
  const user = getCurrentUser();
  return (roleAccess[user.role] || roleAccess.employee).includes(viewName);
}

function getDefaultViewForCurrentUser() {
  const user = getCurrentUser();
  return (roleAccess[user.role] || roleAccess.employee)[0] || "dashboard";
}

function getViewFromHash() {
  const viewName = decodeURIComponent(String(location.hash || "").replace(/^#/, "")).trim();
  return viewTitles[viewName] ? viewName : "";
}

function syncHashToView(viewName) {
  if (!viewTitles[viewName]) return;
  const nextHash = `#${encodeURIComponent(viewName)}`;
  if (location.hash === nextHash) return;
  history.replaceState(null, "", nextHash);
}

function isClientVisible(client) {
  if (!client) return false;
  const user = getCurrentUser();
  if (user.role === "admin") return true;
  if (user.role === "owner") return client.owner === user.name;
  if (user.role === "customer") return client.id === user.clientId;
  return state.entries.some((entry) => entry.clientId === client.id && entry.employee === user.name);
}

function isProjectVisible(project) {
  const client = getClient(project.clientId);
  const user = getCurrentUser();
  if (user.role === "admin") return true;
  if (user.role === "owner") return client?.owner === user.name || project.manager === user.name;
  if (user.role === "customer") return project.clientId === user.clientId;
  return state.entries.some((entry) => entry.projectId === project.id && entry.employee === user.name);
}

function isEntryVisible(entry) {
  const user = getCurrentUser();
  const client = getClient(entry.clientId);
  if (user.role === "admin") return true;
  if (user.role === "owner") return client?.owner === user.name || entry.employee === user.name;
  if (user.role === "customer") return entry.clientId === user.clientId;
  return entry.employee === user.name;
}

function getClientEmail(clients, clientId) {
  return clients.find((client) => client.id === clientId)?.email || "";
}

function getTypeLabel(type) {
  return {
    project: "Kundtid",
    internal: "Interntid",
    absence: "Frånvaro"
  }[type] || "Kundtid";
}

function getBasisLabel(entry) {
  const labels = [];
  if (entry.billable) labels.push("Faktura");
  if (entry.payroll) labels.push("Lön");
  return labels.length ? labels.join(" + ") : "Internt";
}

function getWeekStart(date = new Date()) {
  const copy = new Date(date);
  const day = copy.getDay() || 7;
  copy.setHours(0, 0, 0, 0);
  copy.setDate(copy.getDate() - day + 1);
  return copy;
}

function isThisWeek(dateString) {
  const date = new Date(`${dateString}T12:00:00`);
  return date >= getWeekStart();
}

function isSameISODate(left, right) {
  return String(left || "") === String(right || "");
}

function isSameISOWeek(dateString, anchorDate = selectedTimeAnchorDate) {
  const date = new Date(`${dateString}T12:00:00`);
  const start = getWeekStart(new Date(`${anchorDate}T12:00:00`));
  const end = new Date(start);
  end.setDate(start.getDate() + 6);
  end.setHours(23, 59, 59, 999);
  return date >= start && date <= end;
}

function isSameISOMonth(dateString, anchorDate = selectedTimeAnchorDate) {
  const date = new Date(`${dateString}T12:00:00`);
  const anchor = new Date(`${anchorDate}T12:00:00`);
  return date.getFullYear() === anchor.getFullYear() && date.getMonth() === anchor.getMonth();
}

function isInSelectedTimePeriod(dateString) {
  if (selectedTimePeriodMode === "list") return true;
  if (selectedTimePeriodMode === "week") return isSameISOWeek(dateString);
  if (selectedTimePeriodMode === "month") return isSameISOMonth(dateString);
  return isSameISODate(dateString, selectedTimeAnchorDate);
}

function getTimePeriodLabel() {
  if (selectedTimePeriodMode === "list") return "Alla tidsrader";
  if (selectedTimePeriodMode === "week") {
    const start = getWeekStart(new Date(`${selectedTimeAnchorDate}T12:00:00`));
    const end = new Date(start);
    end.setDate(start.getDate() + 6);
    return `${toISODate(start)} - ${toISODate(end)}`;
  }
  if (selectedTimePeriodMode === "month") {
    const date = new Date(`${selectedTimeAnchorDate}T12:00:00`);
    return new Intl.DateTimeFormat("sv-SE", { month: "long", year: "numeric" }).format(date);
  }
  return selectedTimeAnchorDate;
}

function addDaysToISO(dateString, days) {
  const date = new Date(`${dateString || isoToday}T12:00:00`);
  date.setDate(date.getDate() + days);
  return toISODate(date);
}

function addMonthsToISO(dateString, months) {
  const date = new Date(`${dateString || isoToday}T12:00:00`);
  date.setMonth(date.getMonth() + months);
  return toISODate(date);
}

function getSelectedPeriodDates() {
  if (selectedTimePeriodMode === "list") {
    const visibleDates = [...new Set(state.entries.filter(isEntryVisible).map((entry) => entry.date))]
      .filter(Boolean)
      .sort();
    return visibleDates.length ? visibleDates : [isoToday];
  }
  if (selectedTimePeriodMode === "week") {
    const start = getWeekStart(new Date(`${selectedTimeAnchorDate || isoToday}T12:00:00`));
    return Array.from({ length: 7 }, (_, index) => toISODate(new Date(start.getFullYear(), start.getMonth(), start.getDate() + index)));
  }
  if (selectedTimePeriodMode === "month") {
    const anchor = new Date(`${selectedTimeAnchorDate || isoToday}T12:00:00`);
    const days = new Date(anchor.getFullYear(), anchor.getMonth() + 1, 0).getDate();
    return Array.from({ length: days }, (_, index) => toISODate(new Date(anchor.getFullYear(), anchor.getMonth(), index + 1)));
  }
  return [selectedTimeAnchorDate || isoToday];
}

function getSelectedPeriodRange() {
  const dates = getSelectedPeriodDates().filter(Boolean).sort();
  return {
    from: dates[0] || isoToday,
    to: dates[dates.length - 1] || dates[0] || isoToday
  };
}

function getScheduledHoursForSelectedPeriod() {
  if (selectedTimePeriodMode === "list") return 40;
  return getSelectedPeriodDates().reduce((sum, dateString) => {
    const day = new Date(`${dateString}T12:00:00`).getDay();
    return sum + ([0, 6].includes(day) ? 0 : 8);
  }, 0);
}

function getSelectedTimePeriodKey(mode = selectedTimePeriodMode, anchorDate = selectedTimeAnchorDate) {
  if (mode === "list") return "list";
  if (mode === "week") {
    const start = getWeekStart(new Date(`${anchorDate || isoToday}T12:00:00`));
    return `week:${toISODate(start)}`;
  }
  if (mode === "month") {
    return `month:${String(anchorDate || isoToday).slice(0, 7)}`;
  }
  return `day:${anchorDate || isoToday}`;
}

function isSelectedTimePeriodLocked(mode = selectedTimePeriodMode, anchorDate = selectedTimeAnchorDate) {
  const key = getSelectedTimePeriodKey(mode, anchorDate);
  return (state.timeLocks || []).some((lock) => lock.key === key);
}

function isDateLocked(dateString) {
  return ["day", "week", "month"].some((mode) => isSelectedTimePeriodLocked(mode, dateString || isoToday));
}

function setTimePeriodAnchorByDelta(delta) {
  if (selectedTimePeriodMode === "list") {
    selectedTimeAnchorDate = isoToday;
  } else if (selectedTimePeriodMode === "month") {
    selectedTimeAnchorDate = addMonthsToISO(selectedTimeAnchorDate, delta);
  } else if (selectedTimePeriodMode === "week") {
    selectedTimeAnchorDate = addDaysToISO(selectedTimeAnchorDate, delta * 7);
  } else {
    selectedTimeAnchorDate = addDaysToISO(selectedTimeAnchorDate, delta);
  }
  if (els.entryDate) els.entryDate.value = selectedTimeAnchorDate;
  renderTimePeriodOverview();
  renderEntriesTable();
}

function groupBy(items, getKey) {
  return items.reduce((acc, item) => {
    const key = getKey(item);
    acc[key] = acc[key] || [];
    acc[key].push(item);
    return acc;
  }, {});
}

function sumHours(entries) {
  return entries.reduce((total, entry) => total + Number(entry.hours || 0), 0);
}

function isApprovalOpen(status) {
  return ["draft", "submitted", "rejected"].includes(status || "draft");
}

function isInvoiceReady(status) {
  return status === "approved";
}

function isLockedStatus(status) {
  return status === "approved" || status === "invoiced";
}

function getApprovalStatusLabel(status) {
  return {
    draft: "Utkast",
    submitted: "Inskickad",
    approved: "Attesterad",
    rejected: "Avvisad",
    invoiced: "Fakturerad"
  }[status] || "Utkast";
}

function getApprovalBadgeClass(status) {
  return ["submitted", "approved", "rejected", "invoiced"].includes(status) ? status : "draft";
}

function getWorkflowBadgeClass(kind, status) {
  if (["entry", "receipt", "travel"].includes(kind)) return getApprovalBadgeClass(status);
  if (kind === "agreement") return getAgreementBadgeClass(status);
  if (kind === "esign") return getEsignBadgeClass(status);
  if (kind === "invoice") return getInvoiceStatusBadge(status);
  if (kind === "portal") return {
    open: "draft",
    waiting: "submitted",
    submitted: "submitted",
    done: "approved",
    rejected: "rejected"
  }[status] || "draft";
  return "draft";
}

function getWorkflowStatusLabel(kind, status) {
  if (["entry", "receipt", "travel"].includes(kind)) return getApprovalStatusLabel(status);
  if (kind === "agreement") return getAgreementStatusLabel(status);
  if (kind === "esign") return getEsignStatusLabel(status);
  if (kind === "invoice") return getInvoiceStatusLabel(status);
  if (kind === "portal") return {
    open: "Öppen",
    waiting: "Väntar på kund",
    submitted: "Inskickad",
    done: "Klar",
    rejected: "Avvisad"
  }[status] || "Öppen";
  return "Utkast";
}

function getInvoiceStatusLabel(status) {
  return {
    draft: "Utkast",
    created: "Skapad",
    sent: "Skickad",
    paid: "Betald",
    customerApproved: "Godkänd av kund",
    changeRequested: "Ändring begärd",
    overdue: "Förfallen",
    credited: "Krediterad",
    reopened: "Återöppnad"
  }[status] || "Skapad";
}

function getInvoiceStatusBadge(status) {
  return {
    draft: "draft",
    created: "submitted",
    sent: "submitted",
    paid: "approved",
    customerApproved: "approved",
    changeRequested: "rejected",
    overdue: "rejected",
    credited: "invoiced",
    reopened: "draft"
  }[status] || "submitted";
}

function getEffectiveInvoiceStatus(invoice) {
  if (!invoice) return "created";
  if (["paid", "credited", "reopened", "customerApproved", "changeRequested"].includes(invoice.status)) return invoice.status;
  if (invoice.dueDate && invoice.dueDate < isoToday) return "overdue";
  return invoice.status || "created";
}

function getInvoiceTimeline(invoice) {
  const baseTimeline = [
    { label: "Skapad", date: invoice.createdAt, active: true },
    { label: "Skickad", date: invoice.sentAt, active: Boolean(invoice.sentAt) },
    { label: "Kundgodkänd", date: invoice.customerApprovedAt, active: Boolean(invoice.customerApprovedAt) },
    { label: "Ändring begärd", date: invoice.changeRequestedAt, active: Boolean(invoice.changeRequestedAt) },
    { label: "Betald", date: invoice.paidAt, active: Boolean(invoice.paidAt) },
    { label: "Krediterad", date: invoice.creditedAt, active: Boolean(invoice.creditedAt) },
    { label: "Återöppnad", date: invoice.reopenedAt, active: Boolean(invoice.reopenedAt) }
  ].filter((item) => item.active);
  const eventTimeline = (invoice.events || []).map((event) => ({
    label: event.label,
    date: event.date,
    active: true
  }));
  return [...baseTimeline, ...eventTimeline]
    .sort((a, b) => String(a.date || "").localeCompare(String(b.date || "")) || String(a.label).localeCompare(String(b.label)));
}

function addInvoiceEvent(invoice, label, note = "") {
  if (!invoice) return;
  invoice.events = [
    ...(invoice.events || []),
    {
      id: makeId(),
      date: isoToday,
      actor: getCurrentUser().name,
      label,
      note
    }
  ];
}

function getInvoiceNextAction(invoice) {
  const status = getEffectiveInvoiceStatus(invoice);
  if (status === "created") {
    return { label: "Skicka till kund", detail: "Dela till portal eller skicka e-post", tone: "active", command: "share" };
  }
  if (status === "sent") {
    return { label: "Väntar på kund", detail: invoice.portalSharedAt ? "Kunden kan godkänna i portalen" : "Följ upp utskick", tone: "waiting", command: "followup" };
  }
  if (status === "overdue") {
    return { label: "Förfallen", detail: "Följ upp betalning", tone: "blocked", command: "followup" };
  }
  if (status === "customerApproved") {
    return { label: "Redo för betalning", detail: "Markera betald när pengarna kommit in", tone: "ready", command: "paid" };
  }
  if (status === "changeRequested") {
    return { label: "Ändring begärd", detail: invoice.changeRequestMessage || "Hantera kundens fråga", tone: "blocked", command: "reopen" };
  }
  if (status === "paid") {
    return { label: "Klar", detail: invoice.paidAt ? `Betald ${invoice.paidAt}` : "Betald", tone: "done", command: "none" };
  }
  if (status === "credited") {
    return { label: "Krediterad", detail: invoice.creditedAt || "Stängd", tone: "done", command: "none" };
  }
  if (status === "reopened") {
    return { label: "Återöppnad", detail: "Underlaget finns åter i faktureringen", tone: "active", command: "none" };
  }
  return { label: "Granska", detail: "Kontrollera fakturan", tone: "active", command: "none" };
}

function getDaysUntil(dateString) {
  if (!dateString) return null;
  const target = new Date(`${dateString}T00:00:00`);
  if (Number.isNaN(target.getTime())) return null;
  const start = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  return Math.ceil((target - start) / 86400000);
}

function getClientSnapshot(clientId) {
  const client = getClient(clientId);
  const entries = state.entries.filter((entry) => entry.clientId === clientId);
  const projects = state.projects.filter((project) => project.clientId === clientId);
  const receipts = state.receipts.filter((receipt) => receipt.clientId === clientId);
  const travels = state.travels.filter((travel) => travel.clientId === clientId);
  const agreements = state.agreements.filter((agreement) => agreement.clientId === clientId);
  const esignatures = state.esignatures.filter((signature) => signature.clientId === clientId);
  const invoices = (state.invoices || []).filter((invoice) => invoice.clientId === clientId);
  const portalTasks = (state.portalTasks || []).filter((task) => task.clientId === clientId);
  const approvedBillableEntries = entries.filter((entry) => entry.billable && isInvoiceReady(entry.status));
  const draftItems = [
    ...entries.filter((entry) => isApprovalOpen(entry.status)),
    ...receipts.filter((receipt) => isApprovalOpen(receipt.status)),
    ...travels.filter((travel) => isApprovalOpen(travel.status))
  ];
  const billableHours = sumHours(approvedBillableEntries);
  const draftHours = sumHours(entries.filter((entry) => isApprovalOpen(entry.status)));
  const receiptValue = receipts
    .filter((receipt) => receipt.billable && isInvoiceReady(receipt.status))
    .reduce((total, receipt) => total + Number(receipt.amount || 0), 0);
  const travelValue = travels
    .filter((travel) => travel.billable && isInvoiceReady(travel.status))
    .reduce((total, travel) => total + getTravelValue(travel), 0);
  const fixedPrice = projects
    .filter((project) => (project.invoiceStatus || "preliminary") !== "created")
    .reduce((total, project) => total + Number(project.fixedPrice || 0), 0);
  const invoiceValue = billableHours * Number(client?.rate || 0) + receiptValue + travelValue + fixedPrice;

  return {
    client,
    entries,
    projects,
    receipts,
    travels,
    agreements,
    esignatures,
    invoices,
    portalTasks,
    billableHours,
    draftHours,
    draftItems,
    receiptValue,
    travelValue,
    fixedPrice,
    invoiceValue
  };
}

function getClientNextActions(snapshot) {
  const waitingApproval = snapshot.draftItems.filter((item) => item.status === "submitted").length;
  const openPortalTasks = snapshot.portalTasks.filter((task) => task.status !== "done").length;
  const pendingSignatures = snapshot.esignatures.filter((signature) => signature.status !== "signed").length;
  const watchedAgreements = snapshot.agreements
    .filter((agreement) => agreement.status !== "signed" && agreement.status !== "archived")
    .map((agreement) => ({ ...agreement, days: getDaysUntil(agreement.watchDate) }))
    .filter((agreement) => agreement.days !== null && agreement.days <= 30)
    .sort((a, b) => a.days - b.days);
  const actions = [];

  if (waitingApproval) {
    actions.push({
      title: "Attestera underlag",
      copy: `${waitingApproval} inskickade poster väntar på beslut.`,
      cta: "Öppna attest",
      attrs: `data-client-approval="${snapshot.client.id}"`,
      tone: "warning"
    });
  }

  if (snapshot.invoiceValue > 0) {
    actions.push({
      title: "Skapa fakturaunderlag",
      copy: `${formatCurrency(snapshot.invoiceValue)} är redo eller nästan redo för fakturering.`,
      cta: "Till fakturering",
      attrs: `data-client-invoice="${snapshot.client.id}"`,
      tone: "success"
    });
  }

  if (watchedAgreements.length) {
    const agreement = watchedAgreements[0];
    actions.push({
      title: "Följ upp avtal",
      copy: `${agreement.title} bevakas ${agreement.watchDate}${agreement.days < 0 ? " och är passerat" : ""}.`,
      cta: "Öppna avtal",
      attrs: `data-edit-agreement="${agreement.id}"`,
      tone: "info"
    });
  }

  if (pendingSignatures) {
    actions.push({
      title: "Signering saknas",
      copy: `${pendingSignatures} signeringar är fortfarande öppna.`,
      cta: "Öppna signering",
      attrs: `data-client-esign="${snapshot.client.id}"`,
      tone: "info"
    });
  }

  if (openPortalTasks) {
    actions.push({
      title: "Kundportal",
      copy: `${openPortalTasks} öppna ärenden eller underlag i portalen.`,
      cta: "Visa portal",
      attrs: `data-client-portal="${snapshot.client.id}"`,
      tone: "neutral"
    });
  }

  if (!actions.length) {
    actions.push({
      title: "Kunden är i balans",
      copy: "Inga akuta underlag, avtal eller fakturor kräver åtgärd just nu.",
      cta: "Skapa uppgift",
      attrs: `data-client-portal="${snapshot.client.id}"`,
      tone: "success"
    });
  }

  return actions.slice(0, 4);
}

function renderClientOptions() {
  const visibleClients = state.clients.filter(isClientVisible);
  const visibleProjects = state.projects.filter(isProjectVisible);
  const options = visibleClients
    .map((client) => `<option value="${client.id}">${escapeHtml(client.name)}</option>`)
    .join("");

  els.timerClient.innerHTML = options;
  els.entryClient.innerHTML = options;
  els.filterClient.innerHTML = `<option value="all">Alla kunder</option>${options}`;
  els.projectClient.innerHTML = options;
  els.receiptClient.innerHTML = options;
  els.travelClient.innerHTML = options;
  els.agreementClient.innerHTML = options;
  els.esignClient.innerHTML = options;
  if (els.portalClient) els.portalClient.innerHTML = options;
  [els.timerClient, els.entryClient, els.projectClient, els.receiptClient, els.travelClient, els.agreementClient, els.esignClient, els.portalClient].forEach((select) => {
    if (select && !select.value && visibleClients[0]) select.value = visibleClients[0].id;
  });
  if (els.portalClient) {
    const user = getCurrentUser();
    if (user.role === "customer") {
      els.portalClient.value = user.clientId || visibleClients[0]?.id || "";
      els.portalClient.disabled = true;
    } else {
      els.portalClient.disabled = false;
    }
  }
  renderProjectOptions();
  renderAgreementOptions();
}

function syncAgreementClientEmail() {
  const client = getClient(els.agreementClient.value);
  if (client && !els.agreementEmail.value) {
    els.agreementEmail.value = client.billingEmail || client.email || "";
  }
}

function renderProjectOptions() {
  const options = state.projects
    .filter(isProjectVisible)
    .map((project) => `<option value="${project.id}">${escapeHtml(project.name)}</option>`)
    .join("");
  const emptyOption = `<option value="">Inget projekt</option>`;
  els.timerProject.innerHTML = emptyOption + options;
  els.entryProject.innerHTML = emptyOption + options;
  els.receiptProject.innerHTML = emptyOption + options;
  els.agreementProject.innerHTML = emptyOption + options;
}

function renderAgreementOptions() {
  const options = state.agreements
    .map((agreement) => `<option value="${agreement.id}">${escapeHtml(agreement.title)}</option>`)
    .join("");
  els.esignAgreement.innerHTML = `<option value="">Ingen koppling</option>${options}`;
}

function renderDashboard() {
  const weekEntries = state.entries.filter((entry) => isThisWeek(entry.date));
  const totalWeekHours = sumHours(weekEntries);
  const billableEntries = weekEntries.filter((entry) => entry.billable);
  const billableHours = sumHours(billableEntries);
  const activeClientCount = new Set(weekEntries.map((entry) => entry.clientId)).size;
  const pendingCount = [
    ...state.entries,
    ...state.receipts,
    ...state.travels
  ].filter((item) => isApprovalOpen(item.status)).length;
  const topClient = Object.entries(groupBy(weekEntries, (entry) => entry.clientId))
    .map(([clientId, entries]) => ({ client: getClient(clientId), hours: sumHours(entries) }))
    .sort((a, b) => b.hours - a.hours)[0];

  els.weekHours.textContent = formatHours(totalWeekHours);
  els.reportedHours.textContent = formatHours(totalWeekHours);
  els.weekChange.textContent = totalWeekHours > 0 ? `${weekEntries.length} tidsrader registrerade` : "Ingen registrerad tid";
  els.billableHours.textContent = formatHours(billableHours);
  if (els.billableShare) {
    els.billableShare.textContent = totalWeekHours ? `${Math.round((billableHours / totalWeekHours) * 100)}% av rapporterad tid` : "0% av rapporterad tid";
  }
  els.activeClients.textContent = activeClientCount;
  els.pendingCount.textContent = pendingCount;
  els.pendingCopy.textContent = pendingCount
    ? `${pendingCount} underlag behöver skickas in eller granskas innan lön och faktura.`
    : "Din föregående vecka är läst och inga tider väntar.";
  els.resourceTitle.textContent = topClient?.client?.name || "Ingen planerad kundtid";
  els.resourceHours.textContent = formatHours(topClient?.hours || 0);

  const groupedClients = groupBy(weekEntries, (entry) => entry.clientId);
  const clientRows = Object.entries(groupedClients)
    .map(([clientId, entries]) => ({
      client: getClient(clientId),
      hours: sumHours(entries)
    }))
    .sort((a, b) => b.hours - a.hours);

  if (!clientRows.length) {
    renderEmpty(els.clientChart);
  } else {
    const maxHours = Math.max(...clientRows.map((row) => row.hours));
    els.clientChart.innerHTML = clientRows.map((row) => {
      const width = Math.max(8, (row.hours / maxHours) * 100);
      return `
        <div class="chart-row">
          <strong>${escapeHtml(row.client?.name || "Okänd kund")}</strong>
          <div class="bar-track" aria-hidden="true"><div class="bar-fill" style="width:${width}%"></div></div>
          <span>${formatHours(row.hours)}</span>
        </div>
      `;
    }).join("");
  }

  renderCalendar();

  const visibleEntries = state.entries.filter(isEntryVisible);
  const recentEntries = [...visibleEntries]
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, 5);

  if (!recentEntries.length) {
    renderEmpty(els.recentActivity);
  } else {
    els.recentActivity.innerHTML = recentEntries.map((entry) => `
      <div class="activity-item">
        <div>
          <strong>${escapeHtml(getClient(entry.clientId)?.name || "Okänd kund")}</strong>
          <span>${escapeHtml(entry.employee)} · ${escapeHtml(getTypeLabel(entry.type))} · ${escapeHtml(entry.workOrder || entry.task)} · ${entry.date}</span>
        </div>
        <strong>${formatHours(Number(entry.hours))}</strong>
      </div>
    `).join("");
  }
}

function renderBranding() {
  const settings = state.settings || defaultState.settings;
  const user = getCurrentUser();
  document.title = settings.companyName;
  document.querySelector(".product-logo").textContent = settings.companyName.split(" ")[0] || "Novadex";
  document.querySelector(".account-menu strong").textContent = user.name;
  document.querySelector(".account-menu span").textContent = `${roleLabels[user.role] || user.role} · ${settings.companyName}`;
  document.querySelector(".account-menu .avatar").textContent = user.name.split(" ").map((part) => part[0]).join("").slice(0, 2).toUpperCase();
  if (els.roleSwitcher) {
    els.roleSwitcher.innerHTML = state.users.map((item) => `<option value="${item.id}" ${item.id === user.id ? "selected" : ""}>${escapeHtml(item.name)} · ${roleLabels[item.role] || item.role}</option>`).join("");
  }
  els.navItems.forEach((button) => {
    const allowed = canAccessView(button.dataset.view);
    button.hidden = !allowed;
    button.disabled = !allowed;
  });
  const activeView = [...els.views].find((view) => view.classList.contains("active"))?.id?.replace("-view", "") || "dashboard";
  if (!canAccessView(activeView)) {
    window.setTimeout(() => setView(getDefaultViewForCurrentUser()), 0);
  }
}

function renderCalendar() {
  const date = new Date(calendarCursor);
  const monthName = new Intl.DateTimeFormat("sv-SE", { month: "long", year: "numeric" }).format(date);
  els.calendarMonth.textContent = monthName.charAt(0).toUpperCase() + monthName.slice(1);

  const year = date.getFullYear();
  const month = date.getMonth();
  const firstDay = new Date(year, month, 1);
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const leading = (firstDay.getDay() || 7) - 1;
  const labels = ["v.", "Må", "Ti", "On", "To", "Fr", "Lö", "Sö"];
  const cells = labels.map((label) => `<span class="calendar-label">${label}</span>`);

  for (let i = 0; i < leading; i += 1) {
    cells.push("<span></span>");
  }

  for (let day = 1; day <= daysInMonth; day += 1) {
    const iso = toISODate(new Date(year, month, day));
    const hasEntries = state.entries.some((entry) => isEntryVisible(entry) && entry.date === iso);
    const isToday = day === date.getDate();
    cells.push(`<button class="${isToday ? "today" : ""} ${hasEntries ? "has-entry" : ""}" type="button" data-calendar-date="${iso}">${day}</button>`);
  }

  els.calendarGrid.innerHTML = cells.join("");
}

function renderEntriesTable() {
  const clientFilter = els.filterClient.value;
  const statusFilter = els.filterStatus.value;
  const entries = state.entries
    .filter(isEntryVisible)
    .filter((entry) => isInSelectedTimePeriod(entry.date))
    .filter((entry) => !selectedTimeEmployee || (entry.employee || getCurrentUser().name) === selectedTimeEmployee)
    .filter((entry) => clientFilter === "all" || entry.clientId === clientFilter)
    .filter((entry) => statusFilter === "all" || entry.status === statusFilter)
    .sort((a, b) => b.date.localeCompare(a.date));

  if (!entries.length) {
    els.entriesTable.innerHTML = `<tr><td colspan="9">${els.emptyTemplate.innerHTML}</td></tr>`;
    return;
  }

  els.entriesTable.innerHTML = entries.map((entry) => {
    const client = getClient(entry.clientId);
    const statusLabel = getApprovalStatusLabel(entry.status);
    const isPeriodLocked = isDateLocked(entry.date);
    const canSubmit = !isPeriodLocked && (entry.status === "draft" || entry.status === "rejected");
    const canReview = !isPeriodLocked && entry.status === "submitted" && (isAdminUser() || isOwnerUser());
    const isLocked = isLockedStatus(entry.status) || isPeriodLocked;
    return `
      <tr>
        <td>${entry.date}</td>
        <td>${escapeHtml(entry.employee)}</td>
        <td>${escapeHtml(getTypeLabel(entry.type))}</td>
        <td>${escapeHtml(client?.name || "Okänd kund")}</td>
        <td>
          <strong>${escapeHtml(entry.task)}</strong>
          <span class="table-subtext">${escapeHtml(getProject(entry.projectId)?.name || entry.workOrder || "Ingen arbetsorder")}</span>
        </td>
        <td>${escapeHtml(getBasisLabel(entry))}</td>
        <td>${formatHours(Number(entry.hours))}</td>
        <td><span class="badge ${getApprovalBadgeClass(entry.status)}">${statusLabel}</span></td>
        <td>
          <div class="row-actions">
            ${canSubmit ? `
            <button class="mini-button" type="button" title="Skicka in" aria-label="Skicka in" data-submit-entry="${entry.id}">
              ${icon("send")}
            </button>
            ` : ""}
            ${canReview ? `
            <button class="mini-button" type="button" title="Attestera" aria-label="Attestera" data-approve="${entry.id}">
              ${icon("check")}
            </button>
            <button class="mini-button" type="button" title="Avvisa" aria-label="Avvisa" data-reject-entry="${entry.id}">
              ${icon("x")}
            </button>
            ` : ""}
            <button class="mini-button" type="button" title="Redigera" aria-label="Redigera" data-edit-entry="${entry.id}" ${isLocked ? "disabled" : ""}>
              ${icon("pencil")}
            </button>
            <button class="mini-button" type="button" title="Ta bort" aria-label="Ta bort" data-delete="${entry.id}" ${isLocked ? "disabled" : ""}>
              ${icon("trash")}
            </button>
          </div>
        </td>
      </tr>
    `;
  }).join("");
}

function renderClients() {
  const visibleClients = state.clients.filter(isClientVisible);
  if (!visibleClients.length) {
    renderEmpty(els.clientGrid);
    if (els.clientDetail) renderEmpty(els.clientDetail);
    return;
  }

  if (!visibleClients.some((client) => client.id === selectedClientId)) {
    selectedClientId = visibleClients[0]?.id || "";
  }

  els.clientGrid.innerHTML = visibleClients.map((client) => {
    const snapshot = getClientSnapshot(client.id);
    const isSelected = client.id === selectedClientId;

    return `
      <article class="client-card ${isSelected ? "selected" : ""}">
        <div class="client-card-header">
          <div>
            <strong>${escapeHtml(client.name)}</strong>
            <span>${escapeHtml(client.org || "Org.nr saknas")}</span>
          </div>
          <span class="badge ${snapshot.draftItems.length ? "draft" : "approved"}">${snapshot.draftItems.length ? `${snapshot.draftItems.length} väntar` : "Klar"}</span>
        </div>
        <div class="client-meta">
          <div><span>Ansvarig</span><strong>${escapeHtml(client.owner || "Ej satt")}</strong></div>
          <div><span>Timpris</span><strong>${formatCurrency(Number(client.rate || 0))}</strong></div>
          <div><span>Debiterbar tid</span><strong>${formatHours(snapshot.billableHours)}</strong></div>
          <div><span>Att fakturera</span><strong>${formatCurrency(snapshot.invoiceValue)}</strong></div>
        </div>
        <div class="client-card-actions">
          <button class="ghost-button small-button" type="button" data-open-client="${client.id}">Öppna kundkort</button>
          <button class="mini-button" type="button" title="Registrera tid" aria-label="Registrera tid" data-client-time="${client.id}">
            ${icon("plus")}
          </button>
          <button class="mini-button" type="button" title="Fakturaunderlag" aria-label="Fakturaunderlag" data-client-invoice="${client.id}">
            ${icon("file-invoice")}
          </button>
          <button class="mini-button" type="button" title="Redigera kund" aria-label="Redigera kund" data-edit-client="${client.id}">
            ${icon("pencil")}
          </button>
          <button class="mini-button" type="button" title="Ta bort kund" aria-label="Ta bort kund" data-delete-client="${client.id}">
            ${icon("trash")}
          </button>
        </div>
      </article>
    `;
  }).join("");

  renderClientDetail();
}

function renderClientDetail() {
  if (!els.clientDetail || !selectedClientId) return;
  const snapshot = getClientSnapshot(selectedClientId);
  const { client } = snapshot;
  if (!client) {
    renderEmpty(els.clientDetail);
    return;
  }

  const latestEntries = snapshot.entries
    .slice()
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, 6);
  const activeProjects = snapshot.projects.filter((project) => project.status !== "done").slice(0, 6);
  const activeAgreements = snapshot.agreements.filter((agreement) => agreement.status !== "archived").slice(0, 3);
  const openReceipts = snapshot.receipts.filter((receipt) => receipt.status !== "invoiced").slice(0, 4);
  const openTravels = snapshot.travels.filter((travel) => travel.status !== "invoiced").slice(0, 4);
  const recentInvoices = snapshot.invoices.slice().sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 4);
  const statusCount = snapshot.entries.reduce((acc, entry) => {
    acc[entry.status || "draft"] = (acc[entry.status || "draft"] || 0) + 1;
    return acc;
  }, {});
  const nextActions = getClientNextActions(snapshot);
  const openPortalTasks = snapshot.portalTasks.filter((task) => task.status !== "done").length;
  const pendingSignatures = snapshot.esignatures.filter((signature) => signature.status !== "signed").length;

  els.clientDetail.innerHTML = `
    <div class="section-heading">
      <div>
        <p class="eyebrow">Kundkort</p>
        <h2>${escapeHtml(client.name)}</h2>
        <span class="muted-line">${escapeHtml(client.email || "Ingen e-post")} · ${escapeHtml(client.org || "Org.nr saknas")}</span>
      </div>
      <div class="row-actions">
        <button class="ghost-button small-button" type="button" data-edit-client="${client.id}">Redigera kund</button>
        <button class="ghost-button small-button" type="button" data-client-project="${client.id}">Nytt projekt</button>
        <button class="primary-button small-button" type="button" data-client-time="${client.id}">Registrera tid</button>
      </div>
    </div>
    <div class="client-detail-metrics">
      <div><span>Debiterbar tid</span><strong>${formatHours(snapshot.billableHours)}</strong></div>
      <div><span>Utkasttid</span><strong>${formatHours(snapshot.draftHours)}</strong></div>
      <div><span>Kvitton/resor</span><strong>${formatCurrency(snapshot.receiptValue + snapshot.travelValue)}</strong></div>
      <div><span>Att fakturera</span><strong>${formatCurrency(snapshot.invoiceValue)}</strong></div>
      <div><span>Attesterade rader</span><strong>${statusCount.approved || 0}</strong></div>
      <div><span>Öppna underlag</span><strong>${snapshot.draftItems.length}</strong></div>
      <div><span>Portalärenden</span><strong>${openPortalTasks}</strong></div>
      <div><span>Signeringar</span><strong>${pendingSignatures}</strong></div>
    </div>
    <div class="client-action-board">
      <section class="client-next-panel">
        <h3>Nästa steg</h3>
        <div class="client-next-list">
          ${nextActions.map((action) => `
            <button class="client-next-card ${action.tone}" type="button" ${action.attrs}>
              <span>${escapeHtml(action.title)}</span>
              <strong>${escapeHtml(action.copy)}</strong>
              <em>${escapeHtml(action.cta)}</em>
            </button>
          `).join("")}
        </div>
      </section>
      <section class="client-command-panel">
        <h3>Snabbkommandon</h3>
        <div class="client-command-grid">
          <button type="button" data-client-time="${client.id}"><strong>Tid</strong><span>Registrera tid</span></button>
          <button type="button" data-client-docs="${client.id}"><strong>Underlag</strong><span>Kvitto eller resa</span></button>
          <button type="button" data-client-agreement="${client.id}"><strong>Avtal</strong><span>Nytt kundavtal</span></button>
          <button type="button" data-client-esign="${client.id}"><strong>Signering</strong><span>Skicka dokument</span></button>
          <button type="button" data-client-portal="${client.id}"><strong>Portal</strong><span>Ärenden och filer</span></button>
          <button type="button" data-client-invoice="${client.id}"><strong>Faktura</strong><span>${formatCurrency(snapshot.invoiceValue)}</span></button>
        </div>
      </section>
    </div>
    <div class="client-workflow">
      <button type="button" data-client-time="${client.id}">
        <strong>1. Tid</strong>
        <span>${snapshot.entries.length} registreringar</span>
      </button>
      <button type="button" data-client-project="${client.id}">
        <strong>2. Uppdrag</strong>
        <span>${snapshot.projects.length} projekt</span>
      </button>
      <button type="button" data-client-docs="${client.id}">
        <strong>3. Kvitton & avtal</strong>
        <span>${snapshot.receipts.length + snapshot.agreements.length} poster</span>
      </button>
      <button type="button" data-client-invoice="${client.id}">
        <strong>4. Fakturering</strong>
        <span>${formatCurrency(snapshot.invoiceValue)}</span>
      </button>
    </div>
    <div class="client-detail-grid">
      <section>
        <h3>Aktiva projekt</h3>
        ${activeProjects.length ? activeProjects.map((project) => `
          <button class="compact-row clickable-row" type="button" data-open-project="${project.id}">
            <strong>${escapeHtml(project.name)}</strong>
            <span>${escapeHtml(project.manager || "Ingen ansvarig")} · ${formatHours(sumHours(snapshot.entries.filter((entry) => entry.projectId === project.id || entry.workOrder === project.name)))}</span>
          </button>
        `).join("") : els.emptyTemplate.innerHTML}
      </section>
      <section>
        <h3>Senaste tid</h3>
        ${latestEntries.length ? latestEntries.map((entry) => `
          <div class="compact-row">
            <strong>${escapeHtml(entry.task)}</strong>
            <span>${entry.date} · ${formatHours(Number(entry.hours || 0))} · ${getApprovalStatusLabel(entry.status).toLowerCase()}</span>
          </div>
        `).join("") : els.emptyTemplate.innerHTML}
      </section>
      <section>
        <h3>Kvitton</h3>
        ${openReceipts.length ? openReceipts.map((receipt) => `
          <button class="compact-row clickable-row" type="button" data-edit-receipt="${receipt.id}">
            <strong>${escapeHtml(receipt.supplier)}</strong>
            <span>${receipt.date} · ${formatCurrency(Number(receipt.amount || 0))} · ${getApprovalStatusLabel(receipt.status).toLowerCase()}</span>
          </button>
        `).join("") : els.emptyTemplate.innerHTML}
      </section>
      <section>
        <h3>Resor</h3>
        ${openTravels.length ? openTravels.map((travel) => `
          <button class="compact-row clickable-row" type="button" data-edit-travel="${travel.id}">
            <strong>${travel.type === "allowance" ? "Traktamente" : "Milersättning"}</strong>
            <span>${travel.date} · ${escapeHtml(travel.from || "-")} till ${escapeHtml(travel.to || "-")} · ${getApprovalStatusLabel(travel.status).toLowerCase()}</span>
          </button>
        `).join("") : els.emptyTemplate.innerHTML}
      </section>
      <section>
        <h3>Dokument</h3>
        ${[
          ...snapshot.receipts.filter((receipt) => receipt.fileData).slice(0, 4).map((receipt) => `
            <button class="compact-row clickable-row" type="button" data-open-document="receipt" data-document-id="${receipt.id}">
              <strong>${escapeHtml(receipt.fileName || receipt.supplier)}</strong>
              <span>Kvitto · ${receipt.date} · ${formatCurrency(Number(receipt.amount || 0))}</span>
            </button>
          `),
          ...activeAgreements.slice(0, 3).map((agreement) => `
            <button class="compact-row clickable-row" type="button" data-preview-agreement="${agreement.id}">
              <strong>${escapeHtml(agreement.title)}</strong>
              <span>Avtal · ${escapeHtml(getAgreementStatusLabel(agreement.status))}</span>
            </button>
          `),
          ...recentInvoices.map((invoice) => `
            <button class="compact-row clickable-row" type="button" data-invoice-detail="${invoice.id}">
              <strong>${escapeHtml(invoice.number)}</strong>
              <span>Faktura · förfaller ${invoice.dueDate || "-"} · ${getInvoiceStatusLabel(getEffectiveInvoiceStatus(invoice)).toLowerCase()} · ${formatSEK(Number(invoice.totalInclVat || invoice.total || 0))}</span>
            </button>
          `)
        ].join("") || els.emptyTemplate.innerHTML}
      </section>
      <section>
        <h3>Avtal</h3>
        ${activeAgreements.length ? activeAgreements.map((agreement) => `
          <button class="compact-row clickable-row" type="button" data-edit-agreement="${agreement.id}">
            <strong>${escapeHtml(agreement.title)}</strong>
            <span>${escapeHtml(getAgreementStatusLabel(agreement.status))} · bevakas ${agreement.watchDate || "-"}</span>
          </button>
        `).join("") : els.emptyTemplate.innerHTML}
      </section>
    </div>
  `;
}

function renderProjects() {
  const visibleProjects = state.projects.filter(isProjectVisible);
  if (!visibleProjects.length) {
    renderEmpty(els.projectGrid);
    if (els.projectDetail) renderEmpty(els.projectDetail);
    return;
  }

  if (!visibleProjects.some((project) => project.id === selectedProjectId)) {
    selectedProjectId = visibleProjects[0]?.id || "";
  }

  els.projectGrid.innerHTML = visibleProjects.map((project) => {
    const entries = state.entries.filter((entry) => isEntryVisible(entry) && (entry.projectId === project.id || entry.workOrder === project.name));
    const client = getClient(project.clientId);
    const approvedEntries = entries.filter((entry) => isInvoiceReady(entry.status));
    const openEntries = entries.filter((entry) => isApprovalOpen(entry.status));
    const receipts = state.receipts.filter((receipt) => receipt.projectId === project.id);
    const approvedReceiptValue = receipts.filter((receipt) => isInvoiceReady(receipt.status)).reduce((sum, receipt) => sum + Number(receipt.amount || 0), 0);
    const hours = sumHours(entries);
    const invoiceValue = sumHours(approvedEntries.filter((entry) => entry.billable)) * Number(client?.rate || 0) + approvedReceiptValue + Number(project.fixedPrice || 0);
    const progress = Number(project.budget || 0) ? Math.min(100, Math.round((hours / Number(project.budget)) * 100)) : 0;
    const isSelected = project.id === selectedProjectId;
    const checklist = (project.checklist || []).map((item, index) => `
      <label class="checklist-row">
        <input type="checkbox" ${item.done ? "checked" : ""} data-project-check="${project.id}" data-check-index="${index}">
        ${escapeHtml(item.text)}
      </label>
    `).join("");

    return `
      <article class="client-card project-card">
        <div class="client-card-header">
          <div>
            <strong>${escapeHtml(project.name)}</strong>
            <span>${escapeHtml(client?.name || "Okänd kund")} · ${escapeHtml(project.manager || "Ingen projektledare")}</span>
          </div>
          <span class="badge ${project.status === "active" ? "approved" : "draft"}">${escapeHtml(getProjectStatusLabel(project.status))}</span>
        </div>
        <p>${escapeHtml(project.description || "Ingen beskrivning")}</p>
        <div class="project-card-stats">
          <span>${openEntries.length} öppna underlag</span>
          <span>${formatCurrency(invoiceValue)} fakturerbart</span>
        </div>
        <div class="project-progress">
          <div><span style="width:${progress}%"></span></div>
          <strong>${formatHours(hours)} / ${formatHours(Number(project.budget || 0))}</strong>
        </div>
        <div class="checklist">${checklist}</div>
        <div class="client-card-actions">
          <button class="primary-button small-button" type="button" data-start-project-timer="${project.id}">Starta klocka</button>
          <button class="ghost-button small-button" type="button" data-open-project="${project.id}">${isSelected ? "Öppet" : "Öppna projektkort"}</button>
          <button class="ghost-button small-button" type="button" data-edit-project="${project.id}">Redigera projekt</button>
          <button class="mini-button" type="button" title="Ta bort projekt" aria-label="Ta bort projekt" data-delete-project="${project.id}">
            <svg viewBox="0 0 24 24"><path d="M4 7h16M10 11v6M14 11v6M6 7l1 14h10l1-14M9 7V4h6v3"></path></svg>
          </button>
        </div>
      </article>
    `;
  }).join("");

  renderProjectDetail();
}

function getProjectActionPlan(project, entries, receipts, invoiceValue) {
  const checklist = project.checklist || [];
  const openChecklist = checklist.filter((item) => !item.done).length;
  const submittedEntries = entries.filter((entry) => entry.status === "submitted").length;
  const draftEntries = entries.filter((entry) => ["draft", "rejected"].includes(entry.status || "draft")).length;
  const approvedEntries = entries.filter((entry) => isInvoiceReady(entry.status));
  const billableApprovedHours = sumHours(approvedEntries.filter((entry) => entry.billable));
  const customer = getClient(project.clientId);
  return [
    {
      key: "timer",
      title: "Registrera arbetstid",
      text: entries.length ? `${formatHours(sumHours(entries))} rapporterat på projektet` : "Ingen tid registrerad ännu",
      action: "start-timer",
      tone: entries.length ? "done" : "todo"
    },
    {
      key: "attest",
      title: "Attestera underlag",
      text: submittedEntries ? `${submittedEntries} tidsrader väntar på attest` : draftEntries ? `${draftEntries} utkast behöver skickas in` : "Inga öppna tidsrader",
      action: "open-approvals",
      tone: submittedEntries ? "warning" : draftEntries ? "todo" : "done"
    },
    {
      key: "checklist",
      title: "Arbetsorder/checklista",
      text: openChecklist ? `${openChecklist} steg återstår` : checklist.length ? "Alla checklistesteg är klara" : "Ingen checklista skapad",
      action: "edit-project",
      tone: openChecklist || !checklist.length ? "todo" : "done"
    },
    {
      key: "invoice",
      title: "Fakturaunderlag",
      text: invoiceValue > 0 ? `${formatCurrency(invoiceValue)} kan förberedas` : "Inget att fakturera ännu",
      action: invoiceValue > 0 ? "open-invoice" : "start-timer",
      tone: invoiceValue > 0 ? "warning" : "todo"
    },
    {
      key: "agreement",
      title: "Avtal/offert",
      text: customer?.billingEmail || customer?.email ? `Kundkontakt ${customer.billingEmail || customer.email}` : "Kundens e-post saknas",
      action: "create-agreement",
      tone: customer?.billingEmail || customer?.email ? "done" : "todo"
    },
    {
      key: "receipts",
      title: "Kvitton/utlägg",
      text: receipts.length ? `${receipts.length} kvitton kopplade` : "Inga kvitton på projektet",
      action: "open-receipts",
      tone: receipts.some((receipt) => isApprovalOpen(receipt.status)) ? "warning" : receipts.length ? "done" : "todo"
    }
  ];
}

function getProjectRiskRows(project, entries, receipts, budget, invoiceValue) {
  const hours = sumHours(entries);
  const draftEntries = entries.filter((entry) => ["draft", "rejected"].includes(entry.status || "draft")).length;
  const submittedEntries = entries.filter((entry) => entry.status === "submitted").length;
  const openReceipts = receipts.filter((receipt) => isApprovalOpen(receipt.status)).length;
  const budgetUsage = budget ? Math.round((hours / budget) * 100) : 0;
  return [
    {
      level: budget && budgetUsage >= 90 ? "warning" : "ok",
      title: "Budget",
      text: budget ? `${budgetUsage}% använt (${formatHours(hours)} av ${formatHours(budget)})` : "Budget saknas"
    },
    {
      level: submittedEntries ? "warning" : "ok",
      title: "Attest",
      text: submittedEntries ? `${submittedEntries} tidsrader väntar på attest` : "Ingen tid väntar på attest"
    },
    {
      level: draftEntries ? "warning" : "ok",
      title: "Utkast",
      text: draftEntries ? `${draftEntries} tidsrader behöver skickas in` : "Inga öppna tidsutkast"
    },
    {
      level: openReceipts ? "warning" : "ok",
      title: "Kvitton",
      text: openReceipts ? `${openReceipts} kvitton behöver hanteras` : "Kvitton är i ordning"
    },
    {
      level: invoiceValue > 0 ? "warning" : "ok",
      title: "Fakturering",
      text: invoiceValue > 0 ? `${formatCurrency(invoiceValue)} finns att fakturera` : "Inget fakturerbart underlag"
    }
  ];
}

function handleProjectAction(action, projectId) {
  const project = getProject(projectId);
  if (!project) return false;
  const client = getClient(project.clientId);

  if (action === "start-timer") {
    openTimerWithContext({
      clientId: project.clientId,
      projectId: project.id,
      workOrder: project.name,
      task: "Bokföring",
      description: project.description || ""
    });
    return true;
  }

  if (action === "open-approvals") {
    if (els.approvalProjectFilter) els.approvalProjectFilter.value = project.id;
    if (els.approvalStatusFilter) els.approvalStatusFilter.value = "open";
    setView("reports");
    renderApprovalFlow();
    showToast("Öppnade attestflödet för projektets underlag.");
    return true;
  }

  if (action === "edit-project") {
    openEntityEditor("project", project.id);
    return true;
  }

  if (action === "open-invoice") {
    openInvoiceDetail(project.id);
    return true;
  }

  if (action === "create-agreement") {
    if (els.agreementClient) els.agreementClient.value = project.clientId;
    if (els.agreementProject) els.agreementProject.value = project.id;
    if (els.agreementEmail) els.agreementEmail.value = client?.billingEmail || client?.email || "";
    if (els.agreementTitle) els.agreementTitle.value = `Uppdragsavtal ${project.name}`;
    if (els.agreementMessage) {
      els.agreementMessage.value = `Hej, här kommer uppdragsavtalet för ${project.name}.`;
    }
    setView("agreements");
    focusElement(els.agreementTitle);
    showToast("Avtal/offert för projektet är förberedd.");
    return true;
  }

  if (action === "open-receipts") {
    if (els.receiptClient) els.receiptClient.value = project.clientId;
    if (els.receiptProject) els.receiptProject.value = project.id;
    setView("time");
    focusElement(els.receiptSupplier);
    showToast("Kvittoflödet är förberett för projektet.");
    return true;
  }

  return false;
}

function renderProjectDetail() {
  if (!els.projectDetail || !selectedProjectId) return;
  const project = getProject(selectedProjectId);
  if (!project) {
    renderEmpty(els.projectDetail);
    return;
  }

  const client = getClient(project.clientId);
  const entries = state.entries
    .filter((entry) => entry.projectId === project.id || entry.workOrder === project.name)
    .sort((a, b) => b.date.localeCompare(a.date));
  const receipts = state.receipts.filter((receipt) => receipt.projectId === project.id);
  const travels = state.travels.filter((travel) => travel.clientId === project.clientId && travel.billable);
  const approvedEntries = entries.filter((entry) => isInvoiceReady(entry.status));
  const openEntries = entries.filter((entry) => isApprovalOpen(entry.status));
  const hours = sumHours(entries);
  const approvedHours = sumHours(approvedEntries);
  const budget = Number(project.budget || 0);
  const progress = budget ? Math.min(100, Math.round((hours / budget) * 100)) : 0;
  const receiptValue = receipts.filter((receipt) => isInvoiceReady(receipt.status)).reduce((total, receipt) => total + Number(receipt.amount || 0), 0);
  const travelValue = travels.filter((travel) => isInvoiceReady(travel.status)).reduce((total, travel) => total + getTravelValue(travel), 0);
  const invoiceValue = approvedHours * Number(client?.rate || 0) + receiptValue + travelValue + Number(project.fixedPrice || 0);
  const actionPlan = getProjectActionPlan(project, entries, receipts, invoiceValue);
  const riskRows = getProjectRiskRows(project, entries, receipts, budget, invoiceValue);
  const budgetRemaining = Math.max(budget - hours, 0);
  const lastEntryDate = entries[0]?.date || project.start || "-";

  els.projectDetail.innerHTML = `
    <div class="section-heading">
      <div>
        <p class="eyebrow">Projektkort</p>
        <h2>${escapeHtml(project.name)}</h2>
        <span class="muted-line">${escapeHtml(client?.name || "Okänd kund")} · ${escapeHtml(project.manager || "Ingen ansvarig")}</span>
      </div>
      <div class="row-actions">
        <button class="primary-button small-button" type="button" data-start-project-timer="${project.id}">Starta klocka</button>
        <button class="ghost-button small-button" type="button" data-client-time="${project.clientId}">Registrera tid</button>
        <button class="ghost-button small-button" type="button" data-client-invoice="${project.clientId}">Fakturera</button>
        <button class="primary-button small-button" type="button" data-edit-project="${project.id}">Redigera</button>
      </div>
    </div>
    <div class="client-detail-metrics">
      <div><span>Rapporterat</span><strong>${formatHours(hours)}</strong></div>
      <div><span>Attesterat</span><strong>${formatHours(approvedHours)}</strong></div>
      <div><span>Budget</span><strong>${formatHours(budget)}</strong></div>
      <div><span>Kvar budget</span><strong>${formatHours(budgetRemaining)}</strong></div>
      <div><span>Att fakturera</span><strong>${formatCurrency(invoiceValue)}</strong></div>
      <div><span>Öppna underlag</span><strong>${openEntries.length + receipts.filter((receipt) => isApprovalOpen(receipt.status)).length}</strong></div>
      <div><span>Status</span><strong>${escapeHtml(getProjectStatusLabel(project.status))}</strong></div>
      <div><span>Senast aktivitet</span><strong>${escapeHtml(lastEntryDate)}</strong></div>
    </div>
    <div class="project-progress detail-progress">
      <div><span style="width:${progress}%"></span></div>
      <strong>${progress}% av budget</strong>
    </div>
    <div class="project-action-board">
      ${actionPlan.map((item) => `
        <button class="project-action-card ${item.tone}" type="button" data-project-action="${item.action}" data-project-id="${project.id}">
          <strong>${escapeHtml(item.title)}</strong>
          <span>${escapeHtml(item.text)}</span>
        </button>
      `).join("")}
    </div>
    <div class="project-risk-panel">
      ${riskRows.map((item) => `
        <div class="project-risk-row ${item.level}">
          <strong>${escapeHtml(item.title)}</strong>
          <span>${escapeHtml(item.text)}</span>
        </div>
      `).join("")}
    </div>
    <div class="client-detail-grid">
      <section>
        <h3>Senaste tid</h3>
        ${entries.length ? entries.slice(0, 6).map((entry) => `
          <button class="compact-row clickable-row" type="button" data-edit-entry="${entry.id}">
            <strong>${escapeHtml(entry.task)}</strong>
            <span>${entry.date} · ${escapeHtml(entry.employee)} · ${formatHours(Number(entry.hours || 0))} · ${getApprovalStatusLabel(entry.status).toLowerCase()}</span>
          </button>
        `).join("") : els.emptyTemplate.innerHTML}
      </section>
      <section>
        <h3>Checklistor</h3>
        ${(project.checklist || []).length ? (project.checklist || []).map((item, index) => `
          <label class="checklist-row compact-checklist">
            <input type="checkbox" ${item.done ? "checked" : ""} data-project-check="${project.id}" data-check-index="${index}">
            ${escapeHtml(item.text)}
          </label>
        `).join("") : els.emptyTemplate.innerHTML}
      </section>
      <section>
        <h3>Kvitton</h3>
        ${receipts.length ? receipts.slice(0, 5).map((receipt) => `
          <button class="compact-row clickable-row" type="button" data-edit-receipt="${receipt.id}">
            <strong>${escapeHtml(receipt.supplier)}</strong>
            <span>${receipt.date} · ${formatCurrency(Number(receipt.amount || 0))} · ${getApprovalStatusLabel(receipt.status).toLowerCase()}</span>
          </button>
        `).join("") : els.emptyTemplate.innerHTML}
      </section>
      <section>
        <h3>Fakturastatus</h3>
        <div class="compact-row">
          <strong>${project.invoiceStatus === "created" ? "Fakturaunderlag skapat" : project.invoiceStatus === "draft" ? "Sparat som utkast" : "Preliminärt underlag"}</strong>
          <span>${formatCurrency(invoiceValue)} · ${formatHours(approvedHours)} attesterad tid</span>
        </div>
      </section>
    </div>
  `;
}

function getProjectStatusLabel(status) {
  return {
    active: "Aktivt",
    planned: "Planerat",
    paused: "Pausat",
    done: "Avslutat"
  }[status] || "Aktivt";
}

function matchesExpenseStatus(status, filter) {
  if (filter === "all") return true;
  if (filter === "open") return !["approved", "invoiced"].includes(status);
  if (filter === "approved") return status === "approved";
  return status === filter;
}

function renderExpenseSummary(target, items, getValue) {
  if (!target) return;
  const waiting = items.filter((item) => item.status === "submitted").length;
  const open = items.filter((item) => !["approved", "invoiced"].includes(item.status)).length;
  const billable = items.filter((item) => item.billable).reduce((sum, item) => sum + getValue(item), 0);
  const payroll = items.filter((item) => item.payroll).reduce((sum, item) => sum + getValue(item), 0);
  target.innerHTML = `
    <div><span>Öppna</span><strong>${open}</strong></div>
    <div><span>Väntar attest</span><strong>${waiting}</strong></div>
    <div><span>Till faktura</span><strong>${formatSEK(billable)}</strong></div>
    <div><span>Till lön</span><strong>${formatSEK(payroll)}</strong></div>
  `;
}

function getFilteredReceipts() {
  const query = (els.receiptSearch?.value || "").trim().toLowerCase();
  const status = els.receiptStatusFilter?.value || "open";
  return state.receipts
    .filter((receipt) => isClientVisible(getClient(receipt.clientId) || {}))
    .filter((receipt) => matchesExpenseStatus(receipt.status || "draft", status))
    .filter((receipt) => {
      const haystack = `${receipt.supplier} ${getClient(receipt.clientId)?.name || ""} ${getProject(receipt.projectId)?.name || ""} ${receipt.fileName || ""}`.toLowerCase();
      return !query || haystack.includes(query);
    })
    .sort((a, b) => (b.date || "").localeCompare(a.date || ""));
}

function renderReceipts() {
  const receipts = getFilteredReceipts();
  renderExpenseSummary(els.receiptSummary, state.receipts.filter((receipt) => isClientVisible(getClient(receipt.clientId) || {})), (receipt) => Number(receipt.amount || 0));

  if (!receipts.length) {
    renderEmpty(els.receiptList);
    return;
  }

  els.receiptList.innerHTML = receipts.map((receipt) => {
    const canSubmit = receipt.status === "draft" || receipt.status === "rejected";
    const canReview = receipt.status === "submitted";
    const client = getClient(receipt.clientId);
    const project = getProject(receipt.projectId);
    return `
      <div class="mini-list-item expense-card">
        <div>
          <strong>${escapeHtml(receipt.supplier)}</strong>
          <span>${receipt.date} · ${escapeHtml(client?.name || "Intern")} · ${escapeHtml(project?.name || "Inget projekt")}</span>
          <div class="expense-flags">
            <button class="${receipt.billable ? "active" : ""}" type="button" data-toggle-receipt-billable="${receipt.id}" ${isLockedStatus(receipt.status) ? "disabled" : ""}>Faktura</button>
            <button class="${receipt.payroll ? "active" : ""}" type="button" data-toggle-receipt-payroll="${receipt.id}" ${isLockedStatus(receipt.status) ? "disabled" : ""}>Lön</button>
            <span class="badge ${getApprovalBadgeClass(receipt.status)}">${getApprovalStatusLabel(receipt.status)}</span>
          </div>
          ${receipt.fileName ? `<button class="text-link inline-link" type="button" data-open-document="receipt" data-document-id="${receipt.id}">${escapeHtml(receipt.fileName)}</button>` : `<span class="muted-line">Ingen fil uppladdad</span>`}
          ${receipt.reviewNote ? `<small class="review-note">${escapeHtml(receipt.reviewNote)}</small>` : ""}
        </div>
        <div class="mini-list-actions">
          <b>${formatCurrency(Number(receipt.amount || 0))}</b>
          ${canSubmit ? `
          <button class="mini-button" type="button" title="Skicka in kvitto" aria-label="Skicka in kvitto" data-submit-receipt="${receipt.id}">
            ${icon("send")}
          </button>
          ` : ""}
          ${canReview ? `
          <button class="mini-button" type="button" title="Attestera kvitto" aria-label="Attestera kvitto" data-approve-receipt="${receipt.id}">
            ${icon("check")}
          </button>
          <button class="mini-button" type="button" title="Avvisa kvitto" aria-label="Avvisa kvitto" data-reject-receipt="${receipt.id}">
            ${icon("x")}
          </button>
          ` : ""}
          ${receipt.fileData ? `
          <button class="mini-button" type="button" title="Öppna kvittofil" aria-label="Öppna kvittofil" data-open-document="receipt" data-document-id="${receipt.id}">
            ${icon("file-text")}
          </button>
          ` : ""}
          <button class="mini-button" type="button" title="Redigera kvitto" aria-label="Redigera kvitto" data-edit-receipt="${receipt.id}">
            ${icon("pencil")}
          </button>
          <button class="mini-button" type="button" title="Ta bort kvitto" aria-label="Ta bort kvitto" data-delete-receipt="${receipt.id}" ${isLockedStatus(receipt.status) ? "disabled" : ""}>
            ${icon("trash")}
          </button>
        </div>
      </div>
    `;
  }).join("");
}

function getFilteredTravels() {
  const query = (els.travelSearch?.value || "").trim().toLowerCase();
  const status = els.travelStatusFilter?.value || "open";
  return state.travels
    .filter((travel) => isClientVisible(getClient(travel.clientId) || {}))
    .filter((travel) => matchesExpenseStatus(travel.status || "draft", status))
    .filter((travel) => {
      const haystack = `${travel.type} ${travel.from || ""} ${travel.to || ""} ${getClient(travel.clientId)?.name || ""}`.toLowerCase();
      return !query || haystack.includes(query);
    })
    .sort((a, b) => (b.date || "").localeCompare(a.date || ""));
}

function renderTravels() {
  const travels = getFilteredTravels();
  renderExpenseSummary(els.travelSummary, state.travels.filter((travel) => isClientVisible(getClient(travel.clientId) || {})), getTravelValue);

  if (!travels.length) {
    renderEmpty(els.travelList);
    return;
  }

  els.travelList.innerHTML = travels.map((travel) => {
    const canSubmit = travel.status === "draft" || travel.status === "rejected";
    const canReview = travel.status === "submitted";
    const value = getTravelValue(travel);
    return `
      <div class="mini-list-item expense-card">
        <div>
          <strong>${travel.type === "allowance" ? "Traktamente" : "Milersättning"}</strong>
          <span>${travel.date} · ${escapeHtml(travel.from || "-")} till ${escapeHtml(travel.to || "-")} · ${escapeHtml(getClient(travel.clientId)?.name || "Intern")}</span>
          <div class="expense-flags">
            <button class="${travel.billable ? "active" : ""}" type="button" data-toggle-travel-billable="${travel.id}" ${isLockedStatus(travel.status) ? "disabled" : ""}>Faktura</button>
            <button class="${travel.payroll ? "active" : ""}" type="button" data-toggle-travel-payroll="${travel.id}" ${isLockedStatus(travel.status) ? "disabled" : ""}>Lön</button>
            <span class="badge ${getApprovalBadgeClass(travel.status)}">${getApprovalStatusLabel(travel.status)}</span>
          </div>
          ${travel.reviewNote ? `<small class="review-note">${escapeHtml(travel.reviewNote)}</small>` : ""}
        </div>
        <div class="mini-list-actions">
          <b>${formatSEK(value)}</b>
          <span class="muted-line">${Number(travel.quantity || 0).toFixed(1).replace(".", ",")} ${travel.type === "allowance" ? "dagar" : "mil"}</span>
          ${canSubmit ? `
          <button class="mini-button" type="button" title="Skicka in resa" aria-label="Skicka in resa" data-submit-travel="${travel.id}">
            ${icon("send")}
          </button>
          ` : ""}
          ${canReview ? `
          <button class="mini-button" type="button" title="Attestera resa" aria-label="Attestera resa" data-approve-travel="${travel.id}">
            ${icon("check")}
          </button>
          <button class="mini-button" type="button" title="Avvisa resa" aria-label="Avvisa resa" data-reject-travel="${travel.id}">
            ${icon("x")}
          </button>
          ` : ""}
          <button class="mini-button" type="button" title="Redigera resa" aria-label="Redigera resa" data-edit-travel="${travel.id}">
            ${icon("pencil")}
          </button>
          <button class="mini-button" type="button" title="Ta bort resa" aria-label="Ta bort resa" data-delete-travel="${travel.id}" ${isLockedStatus(travel.status) ? "disabled" : ""}>
            ${icon("trash")}
          </button>
        </div>
      </div>
    `;
  }).join("");
}

function renderAgreements() {
  const search = els.agreementSearch.value.trim().toLowerCase();
  const status = els.agreementStatusFilter.value;
  const agreements = state.agreements
    .filter((agreement) => status === "all" || agreement.status === status || getEffectiveAgreementStatus(agreement) === status)
    .filter((agreement) => {
      const haystack = `${agreement.title} ${agreement.type} ${getClient(agreement.clientId)?.name || ""} ${agreement.owner} ${agreement.label}`.toLowerCase();
      return !search || haystack.includes(search);
    })
    .sort((a, b) => Number(a.number) - Number(b.number));

  if (!agreements.length) {
    els.agreementsTable.innerHTML = `<tr><td colspan="10">${els.emptyTemplate.innerHTML}</td></tr>`;
    return;
  }

  els.agreementsTable.innerHTML = agreements.map((agreement) => {
    const agreementStatus = getEffectiveAgreementStatus(agreement);
    const project = getProject(agreement.projectId);
    return `
    <tr>
      <td>${agreement.number}</td>
      <td><strong>${escapeHtml(agreement.title)}</strong><span class="table-subtext">${escapeHtml(project?.name || agreement.message || "Inget kopplat projekt")}</span></td>
      <td>${escapeHtml(agreement.type)}</td>
      <td>${escapeHtml(getClient(agreement.clientId)?.name || "Okänd motpart")}</td>
      <td>${agreement.watchDate || "-"}</td>
      <td>${agreement.endDate || "-"}</td>
      <td>${escapeHtml(agreement.owner || "-")}</td>
      <td><span class="label-chip">${escapeHtml(agreement.label || "Standard")}</span></td>
      <td><span class="badge ${getAgreementBadgeClass(agreementStatus)}">${escapeHtml(getAgreementStatusLabel(agreementStatus))}</span></td>
      <td>
        <div class="row-actions">
          <button class="mini-button" type="button" title="Avtalskort" aria-label="Avtalskort" data-agreement-detail="${agreement.id}">
            <svg viewBox="0 0 24 24"><path d="M4 4h16v16H4zM8 8h8M8 12h8M8 16h4"></path></svg>
          </button>
          <button class="mini-button" type="button" title="Redigera avtal" aria-label="Redigera avtal" data-edit-agreement="${agreement.id}">
            <svg viewBox="0 0 24 24"><path d="M4 20h4l11-11-4-4L4 16v4Z"></path></svg>
          </button>
          <button class="mini-button" type="button" title="Skicka till kund" aria-label="Skicka till kund" data-send-agreement="${agreement.id}">
            <svg viewBox="0 0 24 24"><path d="M22 2 11 13M22 2l-7 20-4-9-9-4 20-7Z"></path></svg>
          </button>
          <button class="mini-button" type="button" title="Förhandsgranska avtal" aria-label="Förhandsgranska avtal" data-preview-agreement="${agreement.id}">
            <svg viewBox="0 0 24 24"><path d="M4 5h16v14H4zM8 9h8M8 13h8M8 17h4"></path></svg>
          </button>
          <button class="mini-button" type="button" title="Ladda ner avtal" aria-label="Ladda ner avtal" data-download-agreement="${agreement.id}">
            <svg viewBox="0 0 24 24"><path d="M12 3v12m0 0 4-4m-4 4-4-4M4 21h16"></path></svg>
          </button>
          <button class="mini-button" type="button" title="Skapa e-signering" aria-label="Skapa e-signering" data-esign-from-agreement="${agreement.id}">
            <svg viewBox="0 0 24 24"><path d="M4 20h16M5 16l4 2 9-9-4-4-9 9v2Z"></path></svg>
          </button>
          <button class="mini-button" type="button" title="Markera signerat" aria-label="Markera signerat" data-sign-agreement="${agreement.id}">
            <svg viewBox="0 0 24 24"><path d="m5 12 4 4L19 6"></path></svg>
          </button>
          <button class="mini-button" type="button" title="Arkivera avtal" aria-label="Arkivera avtal" data-archive-agreement="${agreement.id}">
            <svg viewBox="0 0 24 24"><path d="M4 7h16M7 7v13h10V7M9 4h6"></path></svg>
          </button>
        </div>
      </td>
    </tr>
  `;
  }).join("");
}

function renderEsignatures() {
  const search = els.esignSearch.value.trim().toLowerCase();
  const status = els.esignStatusFilter.value;
  const items = state.esignatures
    .filter((item) => status === "all" || item.status === status || getEffectiveEsignStatus(item) === status)
    .filter((item) => {
      const haystack = `${item.number} ${item.title} ${item.docType} ${getAgreement(item.agreementId)?.title || ""} ${getClient(item.clientId)?.name || ""}`.toLowerCase();
      return !search || haystack.includes(search);
    })
    .sort((a, b) => Number(b.number) - Number(a.number));

  if (!items.length) {
    els.esignTable.innerHTML = `<tr><td colspan="9">${els.emptyTemplate.innerHTML}</td></tr>`;
    return;
  }

  els.esignTable.innerHTML = items.map((item) => {
    const status = getEffectiveEsignStatus(item);
    return `
    <tr>
      <td><span class="badge ${getEsignBadgeClass(status)}">${escapeHtml(getEsignStatusLabel(status))}</span></td>
      <td>${escapeHtml(item.docType)}</td>
      <td>${item.number}</td>
      <td><strong>${escapeHtml(item.title)}</strong><span class="table-subtext">${escapeHtml(getClient(item.clientId)?.name || "Okänd signerare")}</span></td>
      <td>${escapeHtml(getAgreement(item.agreementId)?.title || "Fristående")}</td>
      <td>${escapeHtml(item.owner || "-")}</td>
      <td>${item.reminderDate || "-"}</td>
      <td>${item.dueDate || "-"}</td>
      <td>
        <div class="row-actions">
          <button class="mini-button" type="button" title="Signeringskort" aria-label="Signeringskort" data-esign-detail="${item.id}">
            <svg viewBox="0 0 24 24"><path d="M4 4h16v16H4zM8 8h8M8 12h8M8 16h4"></path></svg>
          </button>
          <button class="mini-button" type="button" title="Redigera e-signering" aria-label="Redigera e-signering" data-edit-esign="${item.id}">
            <svg viewBox="0 0 24 24"><path d="M4 20h4l11-11-4-4L4 16v4Z"></path></svg>
          </button>
          <button class="mini-button" type="button" title="Skicka signering" aria-label="Skicka signering" data-send-esign="${item.id}">
            <svg viewBox="0 0 24 24"><path d="M22 2 11 13M22 2l-7 20-4-9-9-4 20-7Z"></path></svg>
          </button>
          <button class="mini-button" type="button" title="Skicka påminnelse" aria-label="Skicka påminnelse" data-remind-esign="${item.id}">
            <svg viewBox="0 0 24 24"><path d="M18 8a6 6 0 1 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4"></path></svg>
          </button>
          <button class="mini-button" type="button" title="Markera signerad" aria-label="Markera signerad" data-sign-esign="${item.id}">
            <svg viewBox="0 0 24 24"><path d="m5 12 4 4L19 6"></path></svg>
          </button>
        </div>
      </td>
    </tr>
  `;
  }).join("");
}

function getAgreementStatusLabel(status) {
  return {
    draft: "Utkast",
    sent: "Skickat",
    signed: "Signerat",
    archived: "Arkiverat",
    expired: "Förfallet"
  }[status] || "Utkast";
}

function getEffectiveAgreementStatus(agreement) {
  if (!agreement) return "draft";
  if (["signed", "archived"].includes(agreement.status)) return agreement.status;
  if (agreement.endDate && agreement.endDate < isoToday) return "expired";
  return agreement.status || "draft";
}

function getAgreementBadgeClass(status) {
  return {
    draft: "draft",
    sent: "submitted",
    signed: "approved",
    archived: "invoiced",
    expired: "rejected"
  }[status] || "draft";
}

function getEsignStatusLabel(status) {
  return {
    draft: "Utkast",
    sent: "Skickad",
    signed: "Signerad",
    expired: "Förfallen"
  }[status] || "Utkast";
}

function getEffectiveEsignStatus(item) {
  if (!item) return "draft";
  if (item.status === "signed") return "signed";
  if (item.dueDate && item.dueDate < isoToday) return "expired";
  return item.status || "draft";
}

function getEsignBadgeClass(status) {
  return {
    draft: "draft",
    sent: "submitted",
    signed: "approved",
    expired: "rejected"
  }[status] || "draft";
}

function getApprovalItems({ includeApproved = false } = {}) {
  const entryItems = state.entries.filter(isEntryVisible).map((entry) => {
    const client = getClient(entry.clientId);
    const project = getProject(entry.projectId);
    return {
      kind: "entry",
      id: entry.id,
      date: entry.date,
      status: entry.status || "draft",
      title: `${entry.employee} · ${getTypeLabel(entry.type)}`,
      subtitle: `${client?.name || "Okänd kund"} · ${entry.task}`,
      value: formatHours(Number(entry.hours || 0)),
      note: entry.reviewNote || "",
      owner: entry.employee || "",
      clientId: entry.clientId || "",
      projectId: entry.projectId || "",
      haystack: `${entry.employee} ${getTypeLabel(entry.type)} ${client?.name || ""} ${project?.name || ""} ${entry.task} ${entry.description || ""}`,
      actions: getBasisApprovalActions(entry.status || "draft")
    };
  });
  const receiptItems = state.receipts.filter((receipt) => isClientVisible(getClient(receipt.clientId) || {})).map((receipt) => {
    const client = getClient(receipt.clientId);
    const project = getProject(receipt.projectId);
    return {
      kind: "receipt",
      id: receipt.id,
      date: receipt.date,
      status: receipt.status || "draft",
      title: `Kvitto · ${receipt.supplier}`,
      subtitle: `${client?.name || "Intern"} · ${project?.name || "Inget projekt"}`,
      value: formatCurrency(Number(receipt.amount || 0)),
      note: receipt.reviewNote || "",
      owner: receipt.employee || getCurrentUser().name,
      clientId: receipt.clientId || "",
      projectId: receipt.projectId || "",
      haystack: `${receipt.supplier} ${client?.name || ""} ${project?.name || ""} ${receipt.amount || ""}`,
      actions: getBasisApprovalActions(receipt.status || "draft")
    };
  });
  const travelItems = state.travels.filter((travel) => isClientVisible(getClient(travel.clientId) || {})).map((travel) => {
    const client = getClient(travel.clientId);
    return {
      kind: "travel",
      id: travel.id,
      date: travel.date,
      status: travel.status || "draft",
      title: travel.type === "allowance" ? "Traktamente" : "Milersättning",
      subtitle: `${travel.from || "-"} till ${travel.to || "-"} · ${client?.name || "Intern"}`,
      value: travel.type === "allowance" ? `${String(travel.quantity || 0).replace(".", ",")} dagar` : `${String(travel.quantity || 0).replace(".", ",")} km`,
      note: travel.reviewNote || "",
      owner: travel.employee || getCurrentUser().name,
      clientId: travel.clientId || "",
      projectId: "",
      haystack: `${travel.from || ""} ${travel.to || ""} ${client?.name || ""} ${travel.quantity || ""}`,
      actions: getBasisApprovalActions(travel.status || "draft")
    };
  });
  const agreementItems = state.agreements.filter((agreement) => isAdminUser() || isOwnerUser()).filter((agreement) => isClientVisible(getClient(agreement.clientId) || {})).map((agreement) => {
    const status = getEffectiveAgreementStatus(agreement);
    return {
      kind: "agreement",
      id: agreement.id,
      date: agreement.watchDate || agreement.sentAt || agreement.createdAt || isoToday,
      status,
      title: `Avtal · ${agreement.title}`,
      subtitle: `${getClient(agreement.clientId)?.name || "Okänd kund"} · ${getProject(agreement.projectId)?.name || "Inget projekt"}`,
      value: agreement.number ? `#${agreement.number}` : "Avtal",
      note: agreement.message || "",
      owner: agreement.owner || "",
      clientId: agreement.clientId || "",
      projectId: agreement.projectId || "",
      haystack: `${agreement.title} ${agreement.number || ""} ${agreement.owner || ""} ${getClient(agreement.clientId)?.name || ""} ${getProject(agreement.projectId)?.name || ""}`,
      actions: getAgreementApprovalActions(status)
    };
  });
  const esignItems = state.esignatures.filter((item) => isAdminUser() || isOwnerUser()).filter((item) => isClientVisible(getClient(item.clientId) || {})).map((item) => {
    const status = getEffectiveEsignStatus(item);
    return {
      kind: "esign",
      id: item.id,
      date: item.dueDate || item.reminderDate || item.sentAt || item.createdAt || isoToday,
      status,
      title: `E-signering · ${item.title}`,
      subtitle: `${getClient(item.clientId)?.name || "Okänd signerare"} · ${getAgreement(item.agreementId)?.title || item.docType}`,
      value: item.number ? `#${item.number}` : "Signering",
      note: item.message || "",
      owner: item.owner || "",
      clientId: item.clientId || "",
      projectId: getAgreement(item.agreementId)?.projectId || "",
      haystack: `${item.title} ${item.number || ""} ${item.owner || ""} ${item.docType || ""} ${getClient(item.clientId)?.name || ""} ${getAgreement(item.agreementId)?.title || ""}`,
      actions: getEsignApprovalActions(status)
    };
  });
  const invoiceItems = (state.invoices || []).filter((invoice) => isAdminUser() || isOwnerUser()).filter((invoice) => isClientVisible(getClient(invoice.clientId) || {})).map((invoice) => {
    const status = getEffectiveInvoiceStatus(invoice);
    return {
      kind: "invoice",
      id: invoice.id,
      date: invoice.dueDate || invoice.createdAt || isoToday,
      status,
      title: `Faktura · ${invoice.number}`,
      subtitle: `${getClient(invoice.clientId)?.name || "Okänd kund"} · ${getProject(invoice.projectId)?.name || "Okänt projekt"}`,
      value: formatSEK(Number(invoice.totalInclVat || invoice.total || 0)),
      note: invoice.billingEmail ? `Skickas till ${invoice.billingEmail}` : "",
      owner: "",
      clientId: invoice.clientId || "",
      projectId: invoice.projectId || "",
      haystack: `${invoice.number} ${invoice.billingEmail || ""} ${getClient(invoice.clientId)?.name || ""} ${getProject(invoice.projectId)?.name || ""}`,
      actions: getInvoiceApprovalActions(status)
    };
  });

  return [...entryItems, ...receiptItems, ...travelItems, ...agreementItems, ...esignItems, ...invoiceItems]
    .filter((item) => !["invoiced", "archived", "credited", "reopened"].includes(item.status))
    .filter((item) => includeApproved || !["approved", "signed", "paid"].includes(item.status))
    .sort((a, b) => {
      const statusWeight = { overdue: 0, expired: 0, submitted: 1, sent: 1, rejected: 2, created: 2, draft: 3, approved: 4, signed: 4, paid: 5 };
      return (statusWeight[a.status] ?? 4) - (statusWeight[b.status] ?? 4) || b.date.localeCompare(a.date);
    });
}

function getBasisApprovalActions(status) {
  if (status === "draft" || status === "rejected") return [{ action: "submit", label: "Skicka in", style: "ghost" }];
  if (status === "submitted") return [
    { action: "approve", label: "Godkänn", style: "primary" },
    { action: "reject", label: "Avvisa", style: "ghost" }
  ];
  return [];
}

function getAgreementApprovalActions(status) {
  if (status === "draft") return [{ action: "submit", label: "Skicka avtal", style: "ghost" }];
  if (status === "sent") return [
    { action: "approve", label: "Markera signerat", style: "primary" },
    { action: "reject", label: "Till utkast", style: "ghost" }
  ];
  if (status === "expired") return [{ action: "submit", label: "Skicka om", style: "ghost" }];
  return [];
}

function getEsignApprovalActions(status) {
  if (status === "draft") return [{ action: "submit", label: "Skicka", style: "ghost" }];
  if (status === "sent") return [
    { action: "approve", label: "Markera signerad", style: "primary" },
    { action: "remind", label: "Påminn", style: "ghost" }
  ];
  if (status === "expired") return [{ action: "remind", label: "Påminn", style: "ghost" }];
  return [];
}

function getInvoiceApprovalActions(status) {
  if (status === "created") return [{ action: "submit", label: "Skicka", style: "ghost" }];
  if (status === "customerApproved") return [
    { action: "submit", label: "Skicka", style: "ghost" },
    { action: "approve", label: "Markera betald", style: "primary" }
  ];
  if (status === "changeRequested") return [{ action: "reject", label: "Återöppna", style: "ghost" }];
  if (status === "sent" || status === "overdue") return [
    { action: "approve", label: "Markera betald", style: "primary" },
    { action: "reject", label: "Kreditera", style: "ghost" }
  ];
  return [];
}

function getPortalClientId() {
  const user = getCurrentUser();
  if (user.role === "customer") return user.clientId || "";
  return els.portalClient?.value || state.clients.find(isClientVisible)?.id || "";
}

function getPortalStatusLabel(status) {
  return {
    open: "Öppen",
    waiting: "Väntar på kund",
    submitted: "Inskickat",
    done: "Klar",
    rejected: "Kompletteras"
  }[status] || "Öppen";
}

function getPortalStatusBadgeClass(status) {
  return {
    open: "draft",
    waiting: "submitted",
    submitted: "submitted",
    done: "approved",
    rejected: "rejected"
  }[status] || "draft";
}

function getPortalCommentRole() {
  return roleLabels[getCurrentUser().role] || getCurrentUser().role;
}

function renderPortalTemplates() {
  if (!els.portalTemplates) return;
  if (!(isAdminUser() || isOwnerUser())) {
    els.portalTemplates.innerHTML = "";
    return;
  }
  els.portalTemplates.innerHTML = portalTaskTemplates.map((template, index) => `
    <button class="ghost-button small-button" type="button" data-portal-template="${index}">
      ${escapeHtml(template.title)}
    </button>
  `).join("");
}

function createPortalTaskFromTemplate(templateIndex) {
  if (!(isAdminUser() || isOwnerUser())) return;
  const template = portalTaskTemplates[Number(templateIndex)];
  const clientId = getPortalClientId();
  const client = getClient(clientId);
  if (!template || !client) return;
  state.portalTasks.unshift({
    id: makeId(),
    clientId,
    title: template.title,
    type: template.type,
    status: "waiting",
    owner: getCurrentUser().name,
    dueDate: offsetDate(template.dueDays),
    createdAt: isoToday,
    message: template.message,
    uploads: [],
    comments: [
      {
        id: makeId(),
        author: getCurrentUser().name,
        role: getPortalCommentRole(),
        body: template.message,
        createdAt: isoToday
      }
    ]
  });
  saveState();
  renderAll();
  showToast(`Mallen skapade ett ärende till ${client.name}.`);
}

function getPortalHealth({ tasks, invoices, agreements, documents }) {
  const openTasks = tasks.filter((task) => task.status !== "done");
  const overdueTasks = openTasks.filter((task) => task.dueDate && task.dueDate < isoToday);
  const invoicesNeedingAction = invoices.filter((invoice) => ["created", "sent", "overdue", "changeRequested"].includes(getEffectiveInvoiceStatus(invoice)));
  const agreementsNeedingAction = agreements.filter((agreement) => ["sent", "expired"].includes(getEffectiveAgreementStatus(agreement)));
  const uploadedThisMonth = documents.filter((receipt) => String(receipt.date || "").slice(0, 7) === String(isoToday).slice(0, 7));
  const nextAction = overdueTasks.length
    ? { label: "Följ upp försenade ärenden", focus: "tasks", tone: "blocked" }
    : invoicesNeedingAction.length
      ? { label: "Granska fakturor", focus: "invoices", tone: "active" }
      : agreementsNeedingAction.length
        ? { label: "Följ upp avtal/signering", focus: "agreements", tone: "active" }
        : openTasks.length
          ? { label: "Fortsätt med öppna ärenden", focus: "tasks", tone: "active" }
          : { label: "Portalen är i fas", focus: "all", tone: "done" };
  return {
    openTasks,
    overdueTasks,
    invoicesNeedingAction,
    agreementsNeedingAction,
    uploadedThisMonth,
    nextAction
  };
}

function renderPortalActionStrip(client, health) {
  return `
    <div class="portal-action-strip ${health.nextAction.tone}">
      <div>
        <strong>${escapeHtml(health.nextAction.label)}</strong>
        <span>${health.openTasks.length} öppna ärenden · ${health.invoicesNeedingAction.length} fakturor att följa upp · ${health.uploadedThisMonth.length} nya underlag denna månad</span>
      </div>
      <div class="summary-actions">
        <button class="${selectedPortalFocus === "all" ? "active" : ""}" type="button" data-portal-focus="all">Översikt</button>
        <button class="${selectedPortalFocus === "tasks" ? "active" : ""}" type="button" data-portal-focus="tasks">Ärenden</button>
        <button class="${selectedPortalFocus === "invoices" ? "active" : ""}" type="button" data-portal-focus="invoices">Fakturor</button>
        <button class="${selectedPortalFocus === "agreements" ? "active" : ""}" type="button" data-portal-focus="agreements">Avtal</button>
        <button class="${selectedPortalFocus === "documents" ? "active" : ""}" type="button" data-portal-focus="documents">Underlag</button>
      </div>
    </div>
  `;
}

function renderPortalInvoiceProgress(invoice, status) {
  const steps = getInvoiceRecordFlowSteps(invoice, status).map((step) => ({
    ...step,
    note: step.note === "-" ? "" : step.note
  }));
  return renderInvoiceFlowSteps(steps);
}

function renderPortal() {
  if (!els.portalSummary || !els.portalTaskList) return;
  renderPortalTemplates();
  const clientId = getPortalClientId();
  const snapshot = getClientSnapshot(clientId);
  const client = snapshot.client;

  if (!client) {
    [els.portalSummary, els.portalTaskList, els.portalAgreements, els.portalInvoices, els.portalDocuments].forEach(renderEmpty);
    return;
  }

  const portalTasks = (state.portalTasks || [])
    .filter((task) => task.clientId === clientId)
    .sort((a, b) => (a.status === "done") - (b.status === "done") || String(a.dueDate || "").localeCompare(String(b.dueDate || "")));
  const openTasks = portalTasks.filter((task) => task.status !== "done");
  const portalAgreements = snapshot.agreements
    .filter((agreement) => ["sent", "signed", "expired"].includes(getEffectiveAgreementStatus(agreement)) || getCurrentUser().role !== "customer")
    .sort((a, b) => String(b.sentAt || b.watchDate || "").localeCompare(String(a.sentAt || a.watchDate || "")));
  const portalInvoices = snapshot.invoices
    .filter((invoice) => getCurrentUser().role !== "customer" || ["created", "sent", "overdue", "paid", "customerApproved", "changeRequested"].includes(getEffectiveInvoiceStatus(invoice)))
    .sort((a, b) => String(b.createdAt || "").localeCompare(String(a.createdAt || "")));
  const portalDocuments = snapshot.receipts
    .filter((receipt) => receipt.fileData || receipt.supplier)
    .sort((a, b) => String(b.date || "").localeCompare(String(a.date || "")));
  const unpaid = portalInvoices.filter((invoice) => !["paid", "credited"].includes(getEffectiveInvoiceStatus(invoice)));
  const health = getPortalHealth({ tasks: portalTasks, invoices: portalInvoices, agreements: portalAgreements, documents: portalDocuments });

  els.portalSummary.innerHTML = `
    <div><span>Kund</span><strong>${escapeHtml(client.name)}</strong></div>
    <div><span>Öppna ärenden</span><strong>${openTasks.length}</strong></div>
    <div><span>Försenade</span><strong>${health.overdueTasks.length}</strong></div>
    <div><span>Avtal</span><strong>${portalAgreements.length}</strong></div>
    <div><span>Obetalda fakturor</span><strong>${unpaid.length}</strong></div>
    <div><span>Nya underlag</span><strong>${health.uploadedThisMonth.length}</strong></div>
    <div><span>${getCurrentUser().role === "customer" ? "Fakturavärde" : "Att fakturera"}</span><strong>${getCurrentUser().role === "customer" ? formatSEK(portalInvoices.reduce((sum, invoice) => sum + Number(invoice.totalInclVat || invoice.total || 0), 0)) : formatSEK(snapshot.invoiceValue)}</strong></div>
    ${renderPortalActionStrip(client, health)}
  `;

  if (!portalTasks.length) {
    renderEmpty(els.portalTaskList);
  } else {
    els.portalTaskList.innerHTML = portalTasks.map((task) => {
      const isDone = task.status === "done";
      const canManage = isAdminUser() || isOwnerUser();
      const isOverdue = !isDone && task.dueDate && task.dueDate < isoToday;
      const linkedInvoice = task.invoiceId ? (state.invoices || []).find((invoice) => invoice.id === task.invoiceId) : null;
      return `
        <div class="approval-card portal-task-card ${getPortalStatusBadgeClass(task.status)} ${isOverdue ? "portal-overdue" : ""}">
          <div>
            <div class="approval-title">
              <strong>${escapeHtml(task.title)}</strong>
              <span class="badge ${getPortalStatusBadgeClass(task.status)}">${getPortalStatusLabel(task.status)}</span>
              ${isOverdue ? `<span class="badge rejected">Försenad</span>` : ""}
            </div>
            <span>${escapeHtml(task.type || "Ärende")} · ansvarig ${escapeHtml(task.owner || "-")} · förfaller ${task.dueDate || "-"}</span>
            ${task.message ? `<small class="review-note">${escapeHtml(task.message)}</small>` : ""}
            <div class="portal-card-meta">
              <span>${(task.comments || []).length} kommentarer</span>
              <span>${(task.uploads || []).length} uppladdningar</span>
              ${task.waitingOn ? `<span>Väntar på ${task.waitingOn === "customer" ? "kund" : "byrå"}</span>` : ""}
              ${task.lastActivityAt ? `<span>Senast ${escapeHtml(task.lastActivityAt)}</span>` : ""}
              ${linkedInvoice ? `<span>Faktura ${escapeHtml(linkedInvoice.number)}</span>` : ""}
            </div>
            ${(task.uploads || []).length ? `
              <div class="portal-upload-list">
                ${(task.uploads || []).map((upload) => `
                  <button class="portal-upload-chip" type="button" data-open-document="receipt" data-document-id="${upload.receiptId}">
                    ${escapeHtml(upload.fileName || upload.supplier || "Uppladdat underlag")}
                  </button>
                `).join("")}
              </div>
            ` : ""}
          </div>
          <div class="approval-actions">
            ${isDone ? `<span class="muted-line">Klart ${task.completedAt || ""}</span>` : ""}
            ${!isDone ? `<button class="primary-button small-button" type="button" data-portal-task-action="complete" data-portal-task-id="${task.id}">Markera klar</button>` : ""}
            ${!isDone ? `<button class="ghost-button small-button" type="button" data-portal-task-action="upload" data-portal-task-id="${task.id}">Ladda upp</button>` : ""}
            ${canManage && !isDone ? `<button class="ghost-button small-button" type="button" data-portal-task-action="reject" data-portal-task-id="${task.id}">Komplettera</button>` : ""}
            ${canManage && isDone ? `<button class="ghost-button small-button" type="button" data-portal-task-action="reopen" data-portal-task-id="${task.id}">Öppna igen</button>` : ""}
            ${canManage ? `<button class="mini-button" type="button" title="Ta bort ärende" aria-label="Ta bort ärende" data-portal-task-action="delete" data-portal-task-id="${task.id}"><svg viewBox="0 0 24 24"><path d="M4 7h16M10 11v6M14 11v6M6 7l1 14h10l1-14M9 7V4h6v3"></path></svg></button>` : ""}
          </div>
          <div class="portal-task-thread">
            ${(task.comments || []).length ? `
              <div class="portal-comments">
                ${(task.comments || []).map((comment) => `
                  <div class="portal-comment">
                    <strong>${escapeHtml(comment.author || "Okänd")}</strong>
                    <span>${escapeHtml(comment.role || "")} · ${comment.createdAt || ""}</span>
                    <p>${escapeHtml(comment.body || "")}</p>
                  </div>
                `).join("")}
              </div>
            ` : `<div class="muted-line">Ingen dialog ännu.</div>`}
            <form class="portal-comment-form" data-portal-comment-form="${task.id}">
              <input name="body" type="text" placeholder="Skriv kommentar till ${escapeHtml(client.name)}" required>
              <button class="ghost-button small-button" type="submit">Skicka</button>
            </form>
            ${!isDone ? `
              <form class="portal-upload-form" data-portal-upload-form="${task.id}">
                <input name="supplier" type="text" placeholder="Beskriv underlaget" required>
                <input name="amount" type="number" min="0" step="1" placeholder="Belopp, valfritt">
                <input name="file" type="file" accept="image/*,.pdf" required>
                <button class="primary-button small-button" type="submit">Skicka in underlag</button>
              </form>
            ` : ""}
          </div>
        </div>
      `;
    }).join("");
  }

  if (!portalAgreements.length) {
    renderEmpty(els.portalAgreements);
  } else {
    els.portalAgreements.innerHTML = portalAgreements.map((agreement) => {
      const status = getEffectiveAgreementStatus(agreement);
      return `
        <div class="employee-item">
          <div>
            <strong>${escapeHtml(agreement.title)}</strong>
            <span>${escapeHtml(agreement.type)} · ${getAgreementStatusLabel(status)} · förfaller ${agreement.endDate || "-"}</span>
          </div>
          <div class="row-actions">
            <button class="ghost-button small-button" type="button" data-preview-agreement="${agreement.id}">Visa</button>
            ${status !== "signed" ? `<button class="primary-button small-button" type="button" data-sign-agreement="${agreement.id}">Signera</button>` : ""}
          </div>
        </div>
      `;
    }).join("");
  }

  if (!portalInvoices.length) {
    renderEmpty(els.portalInvoices);
  } else {
    els.portalInvoices.innerHTML = portalInvoices.map((invoice) => {
      const status = getEffectiveInvoiceStatus(invoice);
      const relatedTasks = (state.portalTasks || []).filter((task) => task.invoiceId === invoice.id || task.id === invoice.portalTaskId);
      const isActionableForCustomer = getCurrentUser().role === "customer" && ["created", "sent", "overdue", "customerApproved"].includes(status);
      const nextAction = getInvoiceNextAction(invoice);
      return `
        <div class="employee-item portal-invoice-card ${getInvoiceStatusBadge(status)}">
          <div>
            <div class="approval-title">
              <strong>${escapeHtml(invoice.number)}</strong>
              <span class="badge ${getInvoiceStatusBadge(status)}">${getInvoiceStatusLabel(status)}</span>
              ${isActionableForCustomer ? `<span class="badge submitted">Åtgärd</span>` : ""}
            </div>
            <span>${getProject(invoice.projectId)?.name || "Faktura"} · förfaller ${invoice.dueDate || "-"} · ${formatSEK(Number(invoice.totalInclVat || invoice.total || 0))}</span>
            <div class="portal-card-meta">
              <span>${invoice.portalSharedAt ? `Delad ${escapeHtml(invoice.portalSharedAt)}` : "Ej delad"}</span>
              <span>${relatedTasks.length} portalärenden</span>
              ${invoice.changeRequestMessage ? `<span>Ändring begärd</span>` : ""}
            </div>
            <div class="portal-next-action ${escapeHtml(nextAction.tone || "neutral")}">
              <strong>${escapeHtml(nextAction.label)}</strong>
              <span>${escapeHtml(nextAction.detail)}</span>
            </div>
            ${renderPortalInvoiceProgress(invoice, status)}
          </div>
          <div class="row-actions">
            <button class="ghost-button small-button" type="button" data-invoice-detail="${invoice.id}">Fakturakort</button>
            <button class="ghost-button small-button" type="button" data-open-document="invoice" data-document-id="${invoice.id}">Visa faktura</button>
            ${getCurrentUser().role !== "customer" ? `<button class="ghost-button small-button" type="button" data-invoice-share-portal="${invoice.id}">Dela</button>` : ""}
            ${getCurrentUser().role === "customer" && ["created", "sent", "overdue"].includes(status) ? `<button class="primary-button small-button" type="button" data-portal-invoice-action="approve" data-portal-invoice-id="${invoice.id}">Godkänn</button>` : ""}
            ${getCurrentUser().role === "customer" && ["created", "sent", "overdue", "customerApproved"].includes(status) ? `<button class="ghost-button small-button" type="button" data-portal-invoice-action="change" data-portal-invoice-id="${invoice.id}">Fråga om ändring</button>` : ""}
          </div>
        </div>
      `;
    }).join("");
  }

  if (!portalDocuments.length) {
    renderEmpty(els.portalDocuments);
  } else {
    els.portalDocuments.innerHTML = portalDocuments.map((receipt) => `
      <div class="employee-item">
        <div>
          <strong>${escapeHtml(receipt.fileName || receipt.supplier || "Kvitto")}</strong>
          <span>${receipt.date || "-"} · ${formatCurrency(Number(receipt.amount || 0))} · ${getApprovalStatusLabel(receipt.status || "draft")}</span>
        </div>
        <div class="row-actions">
          ${receipt.fileData ? `<button class="ghost-button small-button" type="button" data-open-document="receipt" data-document-id="${receipt.id}">Öppna fil</button>` : ""}
          ${getCurrentUser().role !== "customer" ? `<button class="ghost-button small-button" type="button" data-edit-receipt="${receipt.id}">Redigera</button>` : ""}
        </div>
      </div>
    `).join("");
  }

  if (els.portalNewTask) {
    els.portalNewTask.hidden = !(isAdminUser() || isOwnerUser());
  }
}

function renderCollaboration() {
  if (!els.collaborationSummary || !els.collaborationFeed || !els.collaborationPermissions) return;
  const visibleTasks = (state.portalTasks || [])
    .filter((task) => isClientVisible(getClient(task.clientId)))
    .sort((a, b) => (a.status === "done") - (b.status === "done") || String(a.dueDate || "").localeCompare(String(b.dueDate || "")));
  const openTasks = visibleTasks.filter((task) => task.status !== "done");
  const sharedAgreements = state.agreements.filter((agreement) => isClientVisible(getClient(agreement.clientId)) && getEffectiveAgreementStatus(agreement) !== "archived");
  const waitingSignatures = state.esignatures.filter((signature) => isClientVisible(getClient(signature.clientId)) && ["draft", "sent"].includes(getEffectiveEsignStatus(signature)));
  const customerUsers = state.users.filter((user) => user.role === "customer" && isClientVisible(getClient(user.clientId)));

  els.collaborationSummary.innerHTML = `
    <div><span>${icon("messages")} Ã–ppna trÃ¥dar</span><strong>${openTasks.length}</strong></div>
    <div><span>${icon("file-certificate")} Delade avtal</span><strong>${sharedAgreements.length}</strong></div>
    <div><span>${icon("signature")} VÃ¤ntar signering</span><strong>${waitingSignatures.length}</strong></div>
    <div><span>${icon("users")} KundanvÃ¤ndare</span><strong>${customerUsers.length}</strong></div>
  `;

  if (!visibleTasks.length) {
    renderEmpty(els.collaborationFeed);
  } else {
    els.collaborationFeed.innerHTML = visibleTasks.slice(0, 8).map((task) => {
      const client = getClient(task.clientId);
      return `
        <div class="workflow-card">
          <span class="badge ${getPortalStatusBadgeClass(task.status)}">${getPortalStatusLabel(task.status)}</span>
          <strong>${escapeHtml(task.title)}</strong>
          <p>${escapeHtml(client?.name || "OkÃ¤nd kund")} Â· ${escapeHtml(task.type || "Ã„rende")} Â· fÃ¶rfaller ${task.dueDate || "-"}</p>
          ${task.message ? `<small class="review-note">${escapeHtml(task.message)}</small>` : ""}
          <div class="row-actions">
            <button class="ghost-button small-button" type="button" data-collab-client="${task.clientId}">${icon("address-book")} Kundkort</button>
            <button class="primary-button small-button" type="button" data-collab-portal="${task.clientId}">${icon("external-link")} Portal</button>
          </div>
        </div>
      `;
    }).join("");
  }

  const portalClients = state.clients
    .filter(isClientVisible)
    .filter((client) => client.name !== "Intern byrÃ¥")
    .slice(0, 10);
  els.collaborationPermissions.innerHTML = portalClients.map((client) => {
    const users = customerUsers.filter((user) => user.clientId === client.id);
    const tasks = visibleTasks.filter((task) => task.clientId === client.id && task.status !== "done");
    return `
      <div class="permission-row">
        <div>
          <strong>${escapeHtml(client.name)}</strong>
          <span>${users.length ? users.map((user) => escapeHtml(user.name)).join(", ") : "Ingen kundanvÃ¤ndare kopplad"} Â· ${tasks.length} Ã¶ppna Ã¤renden</span>
        </div>
        <button class="ghost-button small-button" type="button" data-collab-portal="${client.id}">${icon("share")} Ã–ppna</button>
      </div>
    `;
  }).join("");
}

function getVersionBlueprints() {
  return [
    {
      id: "spiris-workspace",
      title: "Spiris-lik arbetsyta",
      status: "Aktiv",
      active: true,
      view: "dashboard",
      copy: "Toppbar, sidomeny, snabbvÃ¤gar, startflÃ¶de och notiser i samma arbetssÃ¤tt som referenskontot."
    },
    {
      id: "invoice-flow",
      title: "UtÃ¶kat fakturaflÃ¶de",
      status: "NÃ¤sta",
      view: "invoice",
      copy: "PreliminÃ¤ra underlag, utkast, filter, varningar och kundgodkÃ¤nnande innan faktura skapas."
    },
    {
      id: "time-engine",
      title: "Tidsklocka och mÃ¥nadsregistrering",
      status: "Aktiv",
      active: true,
      view: "time",
      copy: "Live-timer, manuell tidsrad, status, lÃ¶neunderlag, debiterbar tid och periodattest."
    },
    {
      id: "customer-collaboration",
      title: "Samarbete och kundportal",
      status: "Aktiv",
      active: true,
      view: "collaboration",
      copy: "Delade uppgifter, uppladdade underlag, avtal, fakturor och kundanvÃ¤ndare i ett sammanhÃ¥llet flÃ¶de."
    },
    {
      id: "cloud-rollout",
      title: "Supabase-konton och godkÃ¤nnande",
      status: "Test",
      view: "portal",
      copy: "KontoansÃ¶kan, adminbeslut och rollstyrning fÃ¶r kommande publicering pÃ¥ hemsidan."
    }
  ];
}

function renderVersions() {
  if (!els.versionsSummary || !els.versionGrid) return;
  const blueprints = getVersionBlueprints();
  const activeCount = blueprints.filter((item) => item.active).length;
  const nextCount = blueprints.filter((item) => item.status === "NÃ¤sta").length;
  els.versionsSummary.innerHTML = `
    <div><span>${icon("toggle-right")} Aktiva versioner</span><strong>${activeCount}</strong></div>
    <div><span>${icon("flask")} Testytor</span><strong>${blueprints.length - activeCount}</strong></div>
    <div><span>${icon("route")} NÃ¤sta pass</span><strong>${nextCount}</strong></div>
    <div><span>${icon("layers-intersect")} Moduler</span><strong>${Object.keys(viewTitles).length}</strong></div>
  `;
  els.versionGrid.innerHTML = blueprints.map((item) => `
    <div class="analysis-card ${item.active ? "active-version" : ""}">
      <span class="badge ${item.active ? "approved" : "submitted"}">${escapeHtml(item.status)}</span>
      <strong>${escapeHtml(item.title)}</strong>
      <p>${escapeHtml(item.copy)}</p>
      <div class="version-status-row">
        <button class="${item.active ? "ghost-button" : "primary-button"} small-button" type="button" data-version-activate="${item.view}">
          ${icon(item.active ? "eye" : "rocket")} ${item.active ? "Visa" : "Aktivera i prototyp"}
        </button>
      </div>
    </div>
  `).join("");
}

function createPortalTaskForCurrentClient() {
  if (!(isAdminUser() || isOwnerUser())) return;
  const clientId = getPortalClientId();
  const client = getClient(clientId);
  if (!client) return;
  const title = window.prompt(`Ny uppgift till ${client.name}:`, "Ladda upp underlag");
  if (!title) return;
  const message = window.prompt("Kort instruktion till kunden:", "Ladda upp filen i portalen eller svara när underlaget är klart.") || "";
  state.portalTasks.unshift({
    id: makeId(),
    clientId,
    title: title.trim(),
    type: "Underlag",
    status: "waiting",
    owner: getCurrentUser().name,
    dueDate: offsetDate(7),
    createdAt: isoToday,
    message: message.trim(),
    uploads: [],
    comments: [
      {
        id: makeId(),
        author: getCurrentUser().name,
        role: getPortalCommentRole(),
        body: message.trim() || "Ny uppgift skapad.",
        createdAt: isoToday
      }
    ]
  });
  saveState();
  renderAll();
  showToast("Uppgift skapades i kundportalen.");
}

function addPortalTaskComment(task, body, author = getCurrentUser().name, role = getPortalCommentRole()) {
  task.comments = [
    ...(task.comments || []),
    {
      id: makeId(),
      author,
      role,
      body,
      createdAt: isoToday
    }
  ];
  task.lastActivityAt = isoToday;
  task.lastActivityBy = author;
}

function handlePortalTaskAction(action, taskId) {
  const task = (state.portalTasks || []).find((item) => item.id === taskId);
  if (!task) return;

  if (action === "complete") {
    task.status = "done";
    task.completedAt = isoToday;
    task.completedBy = getCurrentUser().name;
    task.waitingOn = "";
    addPortalTaskComment(task, "Ärendet markerades som klart.");
    showToast("Ärendet markerades som klart.");
  }

  if (action === "upload") {
    const uploadInput = document.querySelector(`[data-portal-upload-form="${taskId}"] input[type="file"]`);
    focusElement(uploadInput);
    showToast("Välj fil direkt på ärendet och klicka sedan på Skicka in underlag.");
    return;
  }

  if (action === "reject" && (isAdminUser() || isOwnerUser())) {
    task.status = "rejected";
    task.message = `${task.message || ""}${task.message ? " " : ""}Behöver kompletteras.`;
    task.waitingOn = "customer";
    addPortalTaskComment(task, "Byrån begär komplettering från kund.");
    showToast("Ärendet markerades för komplettering.");
  }

  if (action === "reopen" && (isAdminUser() || isOwnerUser())) {
    task.status = "open";
    task.completedAt = "";
    task.waitingOn = "office";
    addPortalTaskComment(task, "Ärendet öppnades igen.");
    showToast("Ärendet öppnades igen.");
  }

  if (action === "delete" && (isAdminUser() || isOwnerUser())) {
    if (!window.confirm("Vill du ta bort portalärendet?")) return;
    state.portalTasks = state.portalTasks.filter((item) => item.id !== taskId);
    showToast("Portalärendet togs bort.");
  }

  saveState();
  renderAll();
}

async function handlePortalUploadSubmit(form) {
  const task = (state.portalTasks || []).find((item) => item.id === form.dataset.portalUploadForm);
  if (!task) return;
  const uploadedFile = await readFileInput(form.elements.file);
  if (!uploadedFile) {
    showToast("Välj en fil innan du skickar in underlaget.", "warning");
    return;
  }

  const supplier = form.elements.supplier.value.trim();
  const amount = normalizeNumber(form.elements.amount.value, 0);
  const projectId = state.projects.find((project) => project.clientId === task.clientId)?.id || "";
  const receipt = {
    id: makeId(),
    date: isoToday,
    supplier: supplier || task.title,
    amount,
    vat: amount ? Math.round((amount * 0.2) * 100) / 100 : 0,
    clientId: task.clientId,
    projectId,
    billable: true,
    payroll: false,
    status: "submitted",
    reviewNote: `Inskickat via kundportalärende: ${task.title}`,
    portalTaskId: task.id,
    ...uploadedFile
  };

  state.receipts.unshift(receipt);
  task.status = "submitted";
  task.waitingOn = "office";
  task.uploads = [
    ...(task.uploads || []),
    {
      id: makeId(),
      receiptId: receipt.id,
      fileName: receipt.fileName,
      supplier: receipt.supplier,
      amount: receipt.amount,
      uploadedBy: getCurrentUser().name,
      uploadedAt: isoToday
    }
  ];
  addPortalTaskComment(task, `Skickade in underlag: ${receipt.fileName || receipt.supplier}.`);
  saveState();
  renderAll();
  showToast("Underlaget skickades in och hamnade i kvitto-/dokumentflödet.");
}

function handlePortalCommentSubmit(form) {
  const task = (state.portalTasks || []).find((item) => item.id === form.dataset.portalCommentForm);
  if (!task) return;
  const body = form.elements.body.value.trim();
  if (!body) return;
  addPortalTaskComment(task, body);
  if (task.status === "done") {
    task.status = "open";
    task.completedAt = "";
    task.waitingOn = "office";
  } else if (getCurrentUser().role === "customer" && ["waiting", "rejected"].includes(task.status)) {
    task.status = "submitted";
    task.waitingOn = "office";
  } else if (getCurrentUser().role !== "customer") {
    task.waitingOn = "customer";
  }
  saveState();
  renderAll();
  showToast("Kommentaren sparades på ärendet.");
}

function createInvoicePortalTask(invoice, message) {
  const client = getClient(invoice.clientId);
  const project = getProject(invoice.projectId);
  const existingTask = (state.portalTasks || []).find((item) => item.id === invoice.portalTaskId || item.invoiceId === invoice.id);
  if (existingTask) {
    existingTask.status = existingTask.status === "done" ? "open" : existingTask.status;
    existingTask.waitingOn = "customer";
    existingTask.dueDate = existingTask.dueDate || offsetDate(3);
    addPortalTaskComment(existingTask, message);
    return existingTask;
  }
  const task = {
    id: makeId(),
    clientId: invoice.clientId,
    projectId: invoice.projectId,
    invoiceId: invoice.id,
    title: `Fråga om faktura ${invoice.number}`,
    type: "Faktura",
    status: "open",
    owner: client?.owner || getCurrentUser().name,
    dueDate: offsetDate(3),
    createdAt: isoToday,
    message,
    waitingOn: "customer",
    lastActivityAt: isoToday,
    lastActivityBy: getCurrentUser().name,
    uploads: [],
    comments: [
      {
        id: makeId(),
        author: getCurrentUser().name,
        role: getPortalCommentRole(),
        body: `${message}${project ? ` (${project.name})` : ""}`,
        createdAt: isoToday
      }
    ]
  };
  state.portalTasks.unshift(task);
  return task;
}

function shareInvoiceToPortal(invoiceId, options = {}) {
  const settings = { navigate: true, toast: true, ...options };
  const invoice = (state.invoices || []).find((item) => item.id === invoiceId);
  if (!invoice) return false;
  const client = getClient(invoice.clientId);
  if (!client) {
    showToast("Fakturan saknar kundkoppling.", "warning");
    return false;
  }
  const amount = formatSEK(Number(invoice.totalInclVat || invoice.total || 0));
  const message = `Hej, faktura ${invoice.number} på ${amount} finns nu för granskning i kundportalen. Svara här om något behöver justeras.`;
  const task = createInvoicePortalTask(invoice, message);
  invoice.status = "sent";
  invoice.sentAt = invoice.sentAt || isoToday;
  invoice.portalSharedAt = isoToday;
  invoice.portalTaskId = task.id;
  addInvoiceEvent(invoice, "Delad till kundportal", `Kund: ${client.name}`);
  syncInvoicePortalTask(invoice, "sent");
  saveState();
  renderAll();
  if (els.portalClient) els.portalClient.value = invoice.clientId;
  if (settings.navigate) {
    setView("portal");
    renderPortal();
  }
  if (settings.toast) showToast(`Faktura ${invoice.number} skickades till kundportalen.`);
  return true;
}

function handlePortalInvoiceAction(action, invoiceId) {
  const invoice = (state.invoices || []).find((item) => item.id === invoiceId);
  if (!invoice || getCurrentUser().role !== "customer") return;

  if (action === "approve") {
    invoice.status = "customerApproved";
    invoice.customerApprovedAt = isoToday;
    invoice.customerApprovedBy = getCurrentUser().name;
    const task = (state.portalTasks || []).find((item) => item.id === invoice.portalTaskId || item.invoiceId === invoice.id);
    if (task) {
      task.status = "submitted";
      task.waitingOn = "office";
      addPortalTaskComment(task, `Kunden godkände faktura ${invoice.number}.`);
    }
    showToast("Fakturan markerades som godkänd av kund.");
  }

  if (action === "change") {
    const message = window.prompt("Vad vill du ändra eller fråga om?", "Jag har en fråga om fakturaunderlaget.");
    if (!message) return;
    invoice.status = "changeRequested";
    invoice.changeRequestedAt = isoToday;
    invoice.changeRequestedBy = getCurrentUser().name;
    invoice.changeRequestMessage = message.trim();
    const task = createInvoicePortalTask(invoice, message.trim());
    task.status = "open";
    task.waitingOn = "office";
    invoice.portalTaskId = task.id;
    showToast("Ändringsfrågan skickades till byrån och blev ett portalärende.");
  }

  saveState();
  renderAll();
}

function handlePortalFocus(focus) {
  selectedPortalFocus = focus || "all";
  renderPortal();
  const targetMap = {
    all: els.portalSummary,
    tasks: els.portalTaskList,
    invoices: els.portalInvoices,
    agreements: els.portalAgreements,
    documents: els.portalDocuments
  };
  const target = targetMap[selectedPortalFocus];
  if (target) target.scrollIntoView({ behavior: "smooth", block: "start" });
  showToast(`Visar portalens ${({
    tasks: "ärenden",
    invoices: "fakturor",
    agreements: "avtal",
    documents: "underlag"
  }[selectedPortalFocus] || "översikt")}.`);
}

function getTaskWorkflowItems() {
  const portalItems = (state.portalTasks || [])
    .filter((task) => isClientVisible(getClient(task.clientId)))
    .map((task) => ({
      id: task.id,
      kind: "portal",
      title: task.title,
      subtitle: `${getClient(task.clientId)?.name || "Okänd kund"} · ${task.type || "Uppgift"}`,
      owner: task.owner || "Ej satt",
      dueDate: task.dueDate || "",
      status: task.status || "open",
      message: task.message || "",
      clientId: task.clientId || "",
      projectId: task.projectId || "",
      actionLabel: "Öppna portal",
      view: "portal"
    }));

  const approvalItems = getApprovalItems({ includeApproved: false })
    .filter((item) => ["entry", "receipt", "travel"].includes(item.kind))
    .map((item) => ({
      id: item.id,
      kind: item.kind,
      title: item.title,
      subtitle: item.subtitle,
      owner: item.owner || getCurrentUser().name,
      dueDate: item.date || "",
      status: item.status || "draft",
      message: item.value,
      clientId: item.clientId || "",
      projectId: item.projectId || "",
      actionLabel: item.status === "submitted" ? "Attestera" : "Öppna tid",
      view: "time"
    }));

  return [...portalItems, ...approvalItems].sort((a, b) => (a.dueDate || "9999").localeCompare(b.dueDate || "9999"));
}

function renderTasks() {
  if (!els.tasksSummary || !els.tasksBoard || !els.tasksPipeline) return;
  const tasks = getTaskWorkflowItems();
  const openTasks = tasks.filter((task) => !["done", "approved", "signed", "paid", "invoiced"].includes(task.status));
  const lateTasks = openTasks.filter((task) => task.dueDate && task.dueDate < isoToday);
  const waitingTasks = tasks.filter((task) => ["waiting", "submitted"].includes(task.status));

  els.tasksSummary.innerHTML = `
    <div><span>Öppna</span><strong>${openTasks.length}</strong></div>
    <div><span>Väntar på kund/attest</span><strong>${waitingTasks.length}</strong></div>
    <div><span>Försenade</span><strong>${lateTasks.length}</strong></div>
    <div><span>Klart senaste flödet</span><strong>${tasks.filter((task) => ["done", "approved"].includes(task.status)).length}</strong></div>
  `;

  const visibleTasks = selectedTaskStatus === "all"
    ? tasks
    : tasks.filter((task) => task.status === selectedTaskStatus || (selectedTaskStatus === "open" && !["done", "approved", "signed", "paid", "invoiced"].includes(task.status)));

  if (!visibleTasks.length) {
    renderEmpty(els.tasksBoard);
  } else {
    els.tasksBoard.innerHTML = visibleTasks.map((task) => `
      <div class="workflow-card">
        <div>
          <div class="approval-title">
            <strong>${escapeHtml(task.title)}</strong>
            <span class="badge ${getWorkflowBadgeClass(task.kind === "portal" ? "portal" : task.kind, task.status)}">${escapeHtml(getWorkflowStatusLabel(task.kind === "portal" ? "portal" : task.kind, task.status))}</span>
          </div>
          <span>${escapeHtml(task.subtitle)} · ansvarig ${escapeHtml(task.owner)} · ${task.dueDate || "inget datum"}</span>
          ${task.message ? `<small class="review-note">${escapeHtml(task.message)}</small>` : ""}
        </div>
        <div class="workflow-actions">
          <button class="ghost-button small-button" type="button" data-task-open="${task.view}" data-task-kind="${task.kind}" data-task-id="${task.id}">${escapeHtml(task.actionLabel)}</button>
          <button class="primary-button small-button" type="button" data-start-task-timer="${task.id}" data-task-kind="${task.kind}">Starta klocka</button>
        </div>
      </div>
    `).join("");
  }

  const pipeline = [
    ["all", "Alla"],
    ["open", "Öppen"],
    ["waiting", "Väntar"],
    ["submitted", "Skickad"],
    ["done", "Klar"]
  ];
  els.tasksPipeline.innerHTML = pipeline.map(([status, label]) => {
    const count = status === "all"
      ? tasks.length
      : status === "open"
        ? openTasks.length
        : tasks.filter((task) => task.status === status).length;
    return `
      <button class="pipeline-row ${selectedTaskStatus === status ? "active" : ""}" type="button" data-task-status-filter="${status}">
        <span>${label}</span>
        <strong>${count}</strong>
      </button>
    `;
  }).join("");
}

function getSalesRows() {
  return state.clients.filter(isClientVisible).map((client) => {
    const snapshot = getClientSnapshot(client.id);
    const openAgreements = snapshot.agreements.filter((agreement) => agreement.status !== "signed" && agreement.status !== "archived").length;
    const wonAgreements = snapshot.agreements.filter((agreement) => agreement.status === "signed").length;
    const value = snapshot.invoiceValue + snapshot.projects.reduce((sum, project) => sum + Number(project.fixedPrice || 0), 0);
    const stage = wonAgreements ? "won" : openAgreements ? "offer" : snapshot.projects.length ? "active" : "lead";
    return { client, snapshot, value, stage };
  }).sort((a, b) => b.value - a.value);
}

function renderSales() {
  if (!els.salesSummary || !els.salesBoard || !els.salesActions) return;
  const rows = getSalesRows();
  const totalValue = rows.reduce((sum, row) => sum + row.value, 0);
  const openOffers = state.agreements.filter((agreement) => agreement.status === "sent" && isClientVisible(getClient(agreement.clientId))).length;
  const signed = state.agreements.filter((agreement) => agreement.status === "signed" && isClientVisible(getClient(agreement.clientId))).length;

  els.salesSummary.innerHTML = `
    <div><span>Pipeline</span><strong>${formatCurrency(totalValue)}</strong></div>
    <div><span>Öppna offerter/avtal</span><strong>${openOffers}</strong></div>
    <div><span>Vunna avtal</span><strong>${signed}</strong></div>
    <div><span>Kunder i flöde</span><strong>${rows.length}</strong></div>
  `;

  const columns = [
    ["lead", "Prospekt"],
    ["active", "Pågående uppdrag"],
    ["offer", "Offert/avtal ute"],
    ["won", "Vunnet"]
  ];
  els.salesBoard.innerHTML = columns.map(([stage, title]) => {
    const items = rows.filter((row) => row.stage === stage);
    return `
      <section class="sales-column">
        <h3>${title}</h3>
        ${items.length ? items.map((row) => `
          <button class="sales-card" type="button" data-sales-client="${row.client.id}">
            <strong>${escapeHtml(row.client.name)}</strong>
            <span>${row.snapshot.projects.length} projekt · ${row.snapshot.agreements.length} avtal · ${formatCurrency(row.value)}</span>
          </button>
        `).join("") : `<div class="empty-state compact-empty"><span>Inga poster</span></div>`}
      </section>
    `;
  }).join("");

  const nextActions = rows.slice(0, 4).map((row) => ({
    client: row.client,
    label: row.stage === "lead" ? "Skapa offert" : row.stage === "offer" ? "Följ upp signering" : "Öppna kundkort",
    view: row.stage === "offer" ? "agreements" : "clients"
  }));
  els.salesActions.innerHTML = nextActions.map((item) => `
    <div class="employee-item">
      <div>
        <strong>${escapeHtml(item.client.name)}</strong>
        <span>${escapeHtml(item.label)}</span>
      </div>
      <button class="ghost-button small-button" type="button" data-sales-action="${item.view}" data-sales-client="${item.client.id}">Öppna</button>
    </div>
  `).join("");
}

function renderPlanning() {
  if (!els.planningSummary || !els.planningBoard) return;
  const projects = state.projects.filter(isProjectVisible);
  const rows = projects.map((project) => {
    const entries = state.entries.filter((entry) => isEntryVisible(entry) && (entry.projectId === project.id || entry.workOrder === project.name));
    const reported = sumHours(entries);
    const budget = Number(project.budget || 0);
    const planned = Math.max(budget - reported, 0);
    return { project, client: getClient(project.clientId), reported, budget, planned };
  });
  const totalBudget = rows.reduce((sum, row) => sum + row.budget, 0);
  const totalReported = rows.reduce((sum, row) => sum + row.reported, 0);
  const utilization = totalBudget ? Math.min(100, Math.round((totalReported / totalBudget) * 100)) : 0;

  els.planningSummary.innerHTML = `
    <div><span>Budget</span><strong>${formatHours(totalBudget)}</strong></div>
    <div><span>Rapporterat</span><strong>${formatHours(totalReported)}</strong></div>
    <div><span>Kvar att planera</span><strong>${formatHours(Math.max(totalBudget - totalReported, 0))}</strong></div>
    <div><span>Beläggning</span><strong>${utilization}%</strong></div>
  `;

  if (!rows.length) {
    renderEmpty(els.planningBoard);
    return;
  }

  els.planningBoard.innerHTML = rows.map((row) => {
    const percent = row.budget ? Math.min(100, Math.round((row.reported / row.budget) * 100)) : 0;
    return `
      <div class="planning-row">
        <div>
          <strong>${escapeHtml(row.project.name)}</strong>
          <span>${escapeHtml(row.client?.name || "Intern")} · ${escapeHtml(getProjectStatusLabel(row.project.status))}</span>
        </div>
        <div class="planning-bar" aria-label="${percent}% rapporterat">
          <span style="width:${percent}%"></span>
        </div>
        <strong>${formatHours(row.reported)} / ${formatHours(row.budget)}</strong>
        <button class="mini-button" type="button" data-planning-project="${row.project.id}" aria-label="Öppna projekt">
          <svg viewBox="0 0 24 24"><path d="M7 7h10v10H7zM14 7h3v3"></path></svg>
        </button>
      </div>
    `;
  }).join("");
}

function renderAnalysis() {
  if (!els.analysisCards || !els.analysisSummary) return;
  const entries = state.entries.filter(isEntryVisible);
  const total = sumHours(entries);
  const billable = sumHours(entries.filter((entry) => entry.billable));
  const internal = sumHours(entries.filter((entry) => entry.type === "internal"));
  const absence = sumHours(entries.filter((entry) => entry.type === "absence"));
  const approved = sumHours(entries.filter((entry) => isInvoiceReady(entry.status) || entry.status === "invoiced"));
  const rate = total ? Math.round((billable / total) * 100) : 0;
  const cards = [
    { key: "reported", title: "Uppföljning av arbetad och debiterbar tid", text: "Fördela timmar på kund, projekt, aktivitet och medarbetare.", value: `${formatHours(billable)} debiterbart`, view: "reports" },
    { key: "keyfigures", title: "Uppföljning av nyckeltal", text: "Följ debiteringsgrad, attestgrad och fakturerbar kapacitet över perioden.", value: `${rate}% debiteringsgrad`, view: "reports" },
    { key: "absence", title: "Frånvaro", text: "Se frånvaro per medarbetare och period för löneunderlag.", value: formatHours(absence), view: "time" },
    { key: "internal", title: "Interntid", text: "Följ intern administration, möten och byrådrift.", value: formatHours(internal), view: "time" }
  ];

  els.analysisCards.innerHTML = cards.map((card) => `
    <button class="analysis-card" type="button" data-analysis-view="${card.view}">
      <span class="analysis-icon">${escapeHtml(card.key.slice(0, 2).toUpperCase())}</span>
      <div>
        <strong>${escapeHtml(card.title)}</strong>
        <p>${escapeHtml(card.text)}</p>
      </div>
      <b>${escapeHtml(card.value)}</b>
    </button>
  `).join("");

  els.analysisSummary.innerHTML = `
    <div><span>Totalt rapporterat</span><strong>${formatHours(total)}</strong></div>
    <div><span>Attesterat</span><strong>${formatHours(approved)}</strong></div>
    <div><span>Debiterbart</span><strong>${formatHours(billable)}</strong></div>
    <div><span>Ej debiterbart</span><strong>${formatHours(Math.max(total - billable, 0))}</strong></div>
  `;
}

function getDayRegisterRows(entries, scheduleMultiplier = 1) {
  const dates = getSelectedPeriodDates();
  const visibleEntries = entries.filter((entry) => !selectedTimeEmployee || (entry.employee || getCurrentUser().name) === selectedTimeEmployee);
  return dates.map((date) => {
    const dayEntries = visibleEntries.filter((entry) => entry.date === date);
    const reported = sumHours(dayEntries);
    const absence = sumHours(dayEntries.filter((entry) => entry.type === "absence"));
    const billable = sumHours(dayEntries.filter((entry) => entry.billable));
    const weekday = new Date(`${date}T12:00:00`).getDay();
    const scheduled = ([0, 6].includes(weekday) ? 0 : 8) * Math.max(1, scheduleMultiplier);
    const draft = dayEntries.filter((entry) => ["draft", "rejected"].includes(entry.status || "draft")).length;
    const submitted = dayEntries.filter((entry) => entry.status === "submitted").length;
    const approved = dayEntries.filter((entry) => isInvoiceReady(entry.status) || entry.status === "invoiced").length;
    const status = submitted ? "Väntar attest" : draft ? "Utkast" : approved ? "Attesterad" : reported ? "Kontrollera" : "Ej rapporterad";
    return {
      date,
      dayEntries,
      reported,
      absence,
      scheduled,
      deviation: reported - scheduled,
      billable,
      draft,
      submitted,
      approved,
      status
    };
  });
}

function getDayStatusBadgeClass(row) {
  if (row.submitted) return "submitted";
  if (row.draft) return "draft";
  if (row.approved) return "approved";
  return row.reported ? "rejected" : "neutral";
}

function renderTimeBlock(entry) {
  const client = getClient(entry.clientId);
  const project = getProject(entry.projectId);
  const blockClass = entry.type === "absence" ? "absence" : entry.billable ? "billable" : "internal";
  return `
    <button class="time-block ${blockClass}" type="button" data-edit-entry="${escapeHtml(entry.id)}" title="${escapeHtml(entry.description || entry.task)}">
      <strong>${escapeHtml(entry.task)}</strong>
      <span>${formatHours(Number(entry.hours || 0))} · ${escapeHtml(client?.name || project?.name || entry.workOrder || "Intern tid")}</span>
    </button>
  `;
}

function getPeriodWorkflowSummary(entries, receipts, travels, totals) {
  const draftEntries = entries.filter((entry) => ["draft", "rejected"].includes(entry.status || "draft")).length;
  const submittedEntries = entries.filter((entry) => entry.status === "submitted").length;
  const approvedEntries = entries.filter((entry) => isInvoiceReady(entry.status) || entry.status === "invoiced").length;
  const draftExpenses = [
    ...receipts.filter((receipt) => ["draft", "rejected"].includes(receipt.status || "draft")),
    ...travels.filter((travel) => ["draft", "rejected"].includes(travel.status || "draft"))
  ].length;
  const submittedExpenses = [
    ...receipts.filter((receipt) => receipt.status === "submitted"),
    ...travels.filter((travel) => travel.status === "submitted")
  ].length;
  const invoiceValue = entries
    .filter((entry) => entry.billable && isInvoiceReady(entry.status))
    .reduce((sum, entry) => sum + Number(entry.hours || 0) * Number(getClient(entry.clientId)?.rate || 0), 0)
    + receipts
      .filter((receipt) => receipt.billable && isInvoiceReady(receipt.status))
      .reduce((sum, receipt) => sum + Number(receipt.amount || 0), 0)
    + travels
      .filter((travel) => travel.billable && isInvoiceReady(travel.status))
      .reduce((sum, travel) => sum + getTravelValue(travel), 0);
  const blockers = submittedEntries + submittedExpenses;
  const drafts = draftEntries + draftExpenses;
  const payrollHours = totals.payroll || 0;
  return {
    drafts,
    submitted: blockers,
    approved: approvedEntries,
    invoiceValue,
    payrollHours,
    readyForInvoice: invoiceValue > 0 && blockers === 0,
    nextLabel: blockers ? "Attestera inskickat" : drafts ? "Skicka utkast" : invoiceValue > 0 ? "Öppna fakturering" : "Lägg till tid",
    nextAction: blockers ? "approval" : drafts ? "submit" : invoiceValue > 0 ? "invoice" : "new"
  };
}

function renderMonthDayRegister(rows, totals, locked, workflow = {}) {
  if (!els.monthDayBoard || !els.monthRegisterAside) return;
  els.monthDayBoard.innerHTML = rows.map((row) => {
    const date = new Date(`${row.date}T12:00:00`);
    const dayName = new Intl.DateTimeFormat("sv-SE", { weekday: "short" }).format(date);
    const isWeekend = [0, 6].includes(date.getDay());
    return `
      <tr class="${isWeekend ? "weekend-row" : ""}">
        <td>
          <strong>${escapeHtml(dayName.charAt(0).toUpperCase() + dayName.slice(1))}</strong>
          <span class="table-subtext">${row.date}</span>
        </td>
        <td>
          <div class="time-block-stack">
            ${row.dayEntries.length ? row.dayEntries.map(renderTimeBlock).join("") : `<span class="empty-inline">Ingen tid</span>`}
          </div>
        </td>
        <td>${formatHours(row.reported)}</td>
        <td>${formatHours(row.absence)}</td>
        <td>${formatHours(row.scheduled)}</td>
        <td class="${row.deviation < 0 ? "danger-text" : ""}">${formatHours(row.deviation)}</td>
        <td>${formatHours(row.billable)}</td>
        <td><span class="badge ${getDayStatusBadgeClass(row)}">${escapeHtml(row.status)}</span></td>
        <td>
          <div class="row-actions">
            <button class="mini-button" type="button" title="Ny tidsrad" aria-label="Ny tidsrad" data-time-day-new="${row.date}" ${locked ? "disabled" : ""}>
              <svg viewBox="0 0 24 24"><path d="M12 5v14M5 12h14"></path></svg>
            </button>
            ${row.submitted ? `
              <button class="mini-button" type="button" title="Attestera dag" aria-label="Attestera dag" data-time-day-approve="${row.date}">
                <svg viewBox="0 0 24 24"><path d="m5 12 4 4L19 6"></path></svg>
              </button>
            ` : ""}
          </div>
        </td>
      </tr>
    `;
  }).join("");

  const activityRows = Object.entries(groupBy(
    rows.flatMap((row) => row.dayEntries),
    (entry) => entry.task || "Tidrapportering"
  ))
    .map(([task, taskEntries]) => ({ task, hours: sumHours(taskEntries), billable: sumHours(taskEntries.filter((entry) => entry.billable)) }))
    .sort((a, b) => b.hours - a.hours)
    .slice(0, 5);
  const billableRate = totals.reported ? Math.round((totals.billable / totals.reported) * 100) : 0;
  els.monthRegisterAside.innerHTML = `
    <section>
      <h3>Rapporterad/schemalagd tid</h3>
      <div class="mini-chart-row"><span style="height:${Math.min(100, Math.max(8, totals.scheduled ? (totals.reported / totals.scheduled) * 100 : 8))}%"></span><span style="height:100%"></span></div>
      <p>${formatHours(totals.reported)} rapporterat mot ${formatHours(totals.scheduled)} schema.</p>
    </section>
    <section>
      <h3>Debiterbar tid</h3>
      <div class="donut-lite" style="--value:${billableRate}%"><strong>${billableRate}%</strong></div>
      <p>${formatHours(totals.billable)} debiterbart · ${formatHours(Math.max(totals.reported - totals.billable, 0))} ej debiterbart.</p>
    </section>
    <section>
      <h3>Flöde till attest/faktura</h3>
      <div class="workflow-steps">
        <div class="${workflow.drafts ? "active" : "done"}"><strong>${workflow.drafts || 0}</strong><span>Utkast</span></div>
        <div class="${workflow.submitted ? "active" : workflow.drafts ? "" : "done"}"><strong>${workflow.submitted || 0}</strong><span>Väntar attest</span></div>
        <div class="${workflow.readyForInvoice ? "active" : ""}"><strong>${formatSEK(workflow.invoiceValue || 0)}</strong><span>Kan faktureras</span></div>
      </div>
      <div class="workflow-actions">
        <button type="button" data-time-flow-action="${escapeHtml(workflow.nextAction || "approval")}">${escapeHtml(workflow.nextLabel || "Öppna attest")}</button>
        <button type="button" data-time-flow-action="complete-period">Skicka + attestera</button>
        <button type="button" data-time-flow-action="create-invoices">Skapa fakturor</button>
        <button type="button" data-time-flow-action="invoice">Fakturering</button>
      </div>
    </section>
    <section>
      <h3>Fördelning aktiviteter</h3>
      <div class="activity-breakdown">
        ${activityRows.length ? activityRows.map((item) => `
          <div><span>${escapeHtml(item.task)}</span><strong>${formatHours(item.hours)}</strong></div>
        `).join("") : `<p>Ingen aktivitet i perioden.</p>`}
      </div>
    </section>
    <section>
      <h3>Löneunderlag</h3>
      <p>${formatHours(totals.payroll)} på löneunderlag · ${formatHours(totals.absence)} frånvaro.</p>
    </section>
  `;
}

function renderTimePeriodOverview() {
  if (!els.timePeriodSummary || !els.timePeriodBoard) return;
  const entries = state.entries.filter(isEntryVisible).filter((entry) => isInSelectedTimePeriod(entry.date));
  const receipts = state.receipts
    .filter((receipt) => isClientVisible(getClient(receipt.clientId) || {}))
    .filter((receipt) => isInSelectedTimePeriod(receipt.date));
  const travels = state.travels
    .filter((travel) => isClientVisible(getClient(travel.clientId) || {}))
    .filter((travel) => isInSelectedTimePeriod(travel.date));
  const employees = [...new Set([
    ...entries.map((entry) => entry.employee || getCurrentUser().name),
    ...state.users.filter((user) => user.role !== "customer").map((user) => user.name)
  ])].filter(Boolean);
  const scheduledHoursForPeriod = getScheduledHoursForSelectedPeriod();

  const rows = employees.map((employee) => {
    const employeeEntries = entries.filter((entry) => (entry.employee || getCurrentUser().name) === employee);
    const submittedReceipts = receipts.filter((receipt) => (receipt.employee || getCurrentUser().name) === employee && receipt.status === "submitted").length;
    const submittedTravels = travels.filter((travel) => (travel.employee || getCurrentUser().name) === employee && travel.status === "submitted").length;
    const reported = sumHours(employeeEntries);
    const absence = sumHours(employeeEntries.filter((entry) => entry.type === "absence"));
    const scheduled = scheduledHoursForPeriod;
    const billable = sumHours(employeeEntries.filter((entry) => entry.billable));
    const submitted = employeeEntries.filter((entry) => entry.status === "submitted").length + submittedReceipts + submittedTravels;
    const approved = employeeEntries.filter((entry) => isInvoiceReady(entry.status) || entry.status === "invoiced").length;
    const status = submitted ? "Väntar attest" : approved ? "Attesterad" : reported ? "Utkast" : "Ej påbörjad";
    return {
      employee,
      reported,
      absence,
      scheduled,
      deviation: reported - scheduled,
      billable,
      submitted,
      status
    };
  }).sort((a, b) => b.submitted - a.submitted || b.reported - a.reported);

  const totalReported = rows.reduce((sum, row) => sum + row.reported, 0);
  const totalBillable = rows.reduce((sum, row) => sum + row.billable, 0);
  const totalScheduled = rows.reduce((sum, row) => sum + row.scheduled, 0);
  const waitingCount = rows.reduce((sum, row) => sum + row.submitted, 0);
  const totalAbsence = rows.reduce((sum, row) => sum + row.absence, 0);
  const draftCount = entries.filter((entry) => ["draft", "rejected"].includes(entry.status || "draft")).length;
  const submittedCount = entries.filter((entry) => entry.status === "submitted").length;
  const approvedCount = entries.filter((entry) => isInvoiceReady(entry.status) || entry.status === "invoiced").length;
  const locked = isSelectedTimePeriodLocked();
  const dayRows = getDayRegisterRows(entries, selectedTimeEmployee ? 1 : rows.length || 1);
  const dayTotals = {
    reported: dayRows.reduce((sum, row) => sum + row.reported, 0),
    scheduled: dayRows.reduce((sum, row) => sum + row.scheduled, 0),
    billable: dayRows.reduce((sum, row) => sum + row.billable, 0),
    absence: dayRows.reduce((sum, row) => sum + row.absence, 0),
    payroll: entries.filter((entry) => entry.payroll).reduce((sum, entry) => sum + Number(entry.hours || 0), 0)
  };
  const workflow = getPeriodWorkflowSummary(entries, receipts, travels, dayTotals);

  els.timePeriodSummary.innerHTML = `
    <div><span>Period</span><strong>${escapeHtml(getTimePeriodLabel())}</strong></div>
    <div><span>Rapporterat</span><strong>${formatHours(totalReported)}</strong></div>
    <div><span>Schemalagt</span><strong>${formatHours(totalScheduled)}</strong></div>
    <div><span>Avvikelse</span><strong>${formatHours(totalReported - totalScheduled)}</strong></div>
    <div><span>Debiterbart</span><strong>${formatHours(totalBillable)}</strong></div>
    <div><span>Frånvaro</span><strong>${formatHours(totalAbsence)}</strong></div>
    <div><span>Väntar attest</span><strong>${waitingCount}</strong></div>
    <div><span>Status</span><strong>${locked ? "Låst" : "Öppen"}</strong></div>
  `;

  if (els.timeStatusSummary) {
    const billableRate = totalReported ? Math.round((totalBillable / totalReported) * 100) : 0;
    els.timeStatusSummary.innerHTML = `
      <div>
        <strong>${formatHours(totalReported)} rapporterat · ${billableRate}% debiterbart</strong>
        <span>${draftCount} utkast · ${submittedCount} inskickade · ${approvedCount} attesterade/fakturerade · ${formatSEK(workflow.invoiceValue)} kan faktureras</span>
      </div>
      <div class="summary-actions">
        <button type="button" data-time-flow-action="${escapeHtml(workflow.nextAction)}">${escapeHtml(workflow.nextLabel)}</button>
        <button type="button" data-time-flow-action="complete-period">Skicka + attestera</button>
        <button type="button" data-time-flow-action="approve-period">Attestera period</button>
        <button type="button" data-time-flow-action="create-invoices">Skapa fakturor</button>
        <button type="button" data-time-flow-action="approval">Attestflöde</button>
        <button type="button" data-time-flow-action="invoice">Fakturering</button>
        <button type="button" data-time-status-filter="all">Alla rader</button>
        <button type="button" data-time-status-filter="draft">Visa utkast</button>
        <button type="button" data-time-status-filter="submitted">Visa inskickade</button>
        <button type="button" data-time-status-filter="approved">Visa attesterade</button>
      </div>
    `;
  }

  if (els.timeLockPeriod) {
    els.timeLockPeriod.textContent = locked ? "Lås upp period" : (selectedTimePeriodMode === "month" ? "Lås månad" : "Lås period");
    els.timeLockPeriod.classList.toggle("active", locked);
  }
  if (els.timeSubmitPeriod) els.timeSubmitPeriod.disabled = locked;
  if (els.timeAttestMonth) {
    els.timeAttestMonth.textContent = selectedTimePeriodMode === "month" ? "Attestera månad" : "Attestera period";
  }

  renderMonthDayRegister(dayRows, dayTotals, locked, workflow);

  if (!rows.length) {
    els.timePeriodBoard.innerHTML = `<tr><td colspan="8">${els.emptyTemplate.innerHTML}</td></tr>`;
    return;
  }

  const expanded = els.timePeriodBoard.classList.contains("expanded");
  els.timePeriodBoard.innerHTML = rows.map((row) => {
    const employeeEntries = entries.filter((entry) => (entry.employee || getCurrentUser().name) === row.employee);
    const detailRows = employeeEntries
      .sort((a, b) => (a.date || "").localeCompare(b.date || ""))
      .map((entry) => {
        const client = getClient(entry.clientId);
        const project = getProject(entry.projectId);
        return `${entry.date} · ${client?.name || "Intern tid"} · ${project?.name || entry.workOrder || entry.task} · ${formatHours(Number(entry.hours || 0))} · ${getApprovalStatusLabel(entry.status)}`;
      });
    return `
      <tr>
        <td>
          <button class="link-button" type="button" data-time-employee="${escapeHtml(row.employee)}">${escapeHtml(row.employee)}</button>
        </td>
        <td>${formatHours(row.reported)}</td>
        <td>${formatHours(row.absence)}</td>
        <td>${formatHours(row.scheduled)}</td>
        <td class="${row.deviation < 0 ? "danger-text" : ""}">${formatHours(row.deviation)}</td>
        <td>${formatHours(row.billable)}</td>
        <td>
          <span class="badge ${row.submitted ? "submitted" : row.status === "Attesterad" ? "approved" : "draft"}">${escapeHtml(row.status)}</span>
          ${row.submitted ? `<button class="ghost-button small-button" type="button" data-time-approve-employee="${escapeHtml(row.employee)}">Attestera</button>` : ""}
        </td>
        <td>
          <button class="mini-button" type="button" title="Ny tidsrad" aria-label="Ny tidsrad" data-time-new-row="${escapeHtml(row.employee)}" ${locked ? "disabled" : ""}>
            <svg viewBox="0 0 24 24"><path d="M12 5v14M5 12h14"></path></svg>
          </button>
        </td>
      </tr>
      ${expanded ? `
        <tr class="time-block-detail">
          <td colspan="8">
            ${detailRows.length
              ? detailRows.map((line) => `<span>${escapeHtml(line)}</span>`).join("")
              : "<span>Inga tidsrader i perioden.</span>"
            }
          </td>
        </tr>
      ` : ""}
    `;
  }).join("");
}

function renderInvoiceCommandStrip() {
  if (!els.invoiceCommandStrip) return;
  const rows = getInvoiceRows();
  const totals = getInvoiceWorkbenchTotals(rows);
  const draftRows = state.projects.filter((project) => project.invoiceStatus === "draft");
  const visibleProjectIds = getInvoiceProjectIdsFromRows(rows);
  const blockedProjectIds = getInvoiceProjectIdsFromRows(totals.blockedRows);
  const invoiceQueue = (state.invoices || []).filter((invoice) => !["paid", "credited", "reopened"].includes(getEffectiveInvoiceStatus(invoice)));
  const notSentInvoices = invoiceQueue.filter((invoice) => getEffectiveInvoiceStatus(invoice) === "created");
  const waitingCustomerInvoices = invoiceQueue.filter((invoice) => ["sent", "overdue"].includes(getEffectiveInvoiceStatus(invoice)));
  const overdueInvoices = invoiceQueue.filter((invoice) => getEffectiveInvoiceStatus(invoice) === "overdue");
  const changeRequestInvoices = invoiceQueue.filter((invoice) => getEffectiveInvoiceStatus(invoice) === "changeRequested");
  const customerApprovedInvoices = invoiceQueue.filter((invoice) => getEffectiveInvoiceStatus(invoice) === "customerApproved");
  const paidInvoices = (state.invoices || []).filter((invoice) => getEffectiveInvoiceStatus(invoice) === "paid");
  const openInvoiceValue = [...notSentInvoices, ...waitingCustomerInvoices, ...changeRequestInvoices, ...customerApprovedInvoices]
    .reduce((sum, invoice) => sum + Number(invoice.totalInclVat || invoice.total || 0), 0);
  const latestInvoice = getSortedInvoices()[0];

  els.invoiceCommandStrip.innerHTML = `
    <div class="invoice-pipeline-panel">
      <button type="button" data-invoice-command="warnings" class="${totals.blockedRows.length ? "blocked" : "done"}">
        <span>1</span>
        <strong>Attest</strong>
        <small>${totals.blockedRows.length ? `${totals.blockedRows.length} spärrade underlag` : "Allt synligt är attesterat"}</small>
      </button>
      <button type="button" data-invoice-command="customer-data" class="${totals.customerIssueRows.length ? "blocked" : "done"}">
        <span>2</span>
        <strong>Kunddata</strong>
        <small>${totals.customerIssueRows.length ? `${totals.customerIssueRows.length} behöver kompletteras` : "Kunddata är klar"}</small>
      </button>
      <button type="button" data-invoice-command="create-ready" class="${totals.readyRows.length ? "active" : ""}">
        <span>3</span>
        <strong>Skapa</strong>
        <small>${totals.readyRows.length} klara · ${formatCurrency(totals.readyRows.reduce((sum, row) => sum + row.total, 0))}</small>
      </button>
      <button type="button" data-invoice-command="share-created" class="${notSentInvoices.length ? "active" : ""}">
        <span>4</span>
        <strong>Skicka</strong>
        <small>${notSentInvoices.length} skapade väntar</small>
      </button>
      <button type="button" data-invoice-command="open-customer" class="${waitingCustomerInvoices.length ? "active" : ""}">
        <span>5</span>
        <strong>Kund</strong>
        <small>${waitingCustomerInvoices.length} hos kund · ${overdueInvoices.length} förfallna</small>
      </button>
      <button type="button" data-invoice-command="open-payment" class="${customerApprovedInvoices.length ? "ready" : ""}">
        <span>6</span>
        <strong>Betalning</strong>
        <small>${customerApprovedInvoices.length} godkända · ${formatCurrency(openInvoiceValue)}</small>
      </button>
    </div>
    <button class="invoice-command-card" type="button" data-invoice-command="create-ready">
      <span>1. Skapa klara</span>
      <strong>${totals.readyRows.length}</strong>
      <small>${formatCurrency(totals.readyRows.reduce((sum, row) => sum + row.total, 0))}</small>
    </button>
    <button class="invoice-command-card" type="button" data-invoice-command="draft-visible">
      <span>2. Spara utkast</span>
      <strong>${visibleProjectIds.length}</strong>
      <small>Respekterar sök, datum och status</small>
    </button>
    <button class="invoice-command-card" type="button" data-invoice-command="drafts">
      <span>3. Granska utkast</span>
      <strong>${draftRows.length}</strong>
      <small>Kan granskas före utskick</small>
    </button>
    <button class="invoice-command-card warning" type="button" data-invoice-command="approve-blocked">
      <span>Attestera spärrar</span>
      <strong>${blockedProjectIds.length}</strong>
      <small>Godkänn synliga blockerade rader</small>
    </button>
    <button class="invoice-command-card warning" type="button" data-invoice-command="warnings">
      <span>Behöver åtgärd</span>
      <strong>${totals.blockedRows.length}</strong>
      <small>Ej attesterad tid/kvitton</small>
    </button>
    <button class="invoice-command-card warning" type="button" data-invoice-command="customer-data">
      <span>Kunddata</span>
      <strong>${totals.customerIssueRows.length}</strong>
      <small>E-post, referens eller timpris</small>
    </button>
    <button class="invoice-command-card" type="button" data-invoice-command="history">
      <span>Netto / moms</span>
      <strong>${formatCurrency(totals.net)}</strong>
      <small>${formatCurrency(totals.vat)} moms · ${formatCurrency(totals.gross)} totalt</small>
    </button>
    <button class="invoice-command-card" type="button" data-invoice-command="share-created">
      <span>Ej skickade</span>
      <strong>${notSentInvoices.length}</strong>
      <small>Skicka till kundportal</small>
    </button>
    <button class="invoice-command-card" type="button" data-invoice-command="open-customer">
      <span>Väntar kund</span>
      <strong>${waitingCustomerInvoices.length}</strong>
      <small>Skickade/förfallna fakturor</small>
    </button>
    <button class="invoice-command-card warning" type="button" data-invoice-command="open-overdue">
      <span>Förfallna</span>
      <strong>${overdueInvoices.length}</strong>
      <small>Behöver påminnelse</small>
    </button>
    <button class="invoice-command-card warning" type="button" data-invoice-command="open-changes">
      <span>Ändringar</span>
      <strong>${changeRequestInvoices.length}</strong>
      <small>Kundfrågor att hantera</small>
    </button>
    <button class="invoice-command-card" type="button" data-invoice-command="open-approved">
      <span>Godkända</span>
      <strong>${customerApprovedInvoices.length}</strong>
      <small>Redo att följa upp betalning</small>
    </button>
    <button class="invoice-command-card" type="button" data-invoice-command="mark-approved-paid">
      <span>Bokför betalda</span>
      <strong>${customerApprovedInvoices.length}</strong>
      <small>Markera kundgodkända som betalda</small>
    </button>
    <button class="invoice-command-card" type="button" data-invoice-command="portal-invoices">
      <span>Kundportal</span>
      <strong>${waitingCustomerInvoices.length + changeRequestInvoices.length}</strong>
      <small>Öppna fakturor hos kund</small>
    </button>
    <button class="invoice-command-card" type="button" data-invoice-command="open-latest" ${latestInvoice ? "" : "disabled"}>
      <span>Senaste faktura</span>
      <strong>${latestInvoice ? escapeHtml(latestInvoice.number) : "-"}</strong>
      <small>${latestInvoice ? escapeHtml(getInvoiceNextAction(latestInvoice).label) : "Ingen faktura skapad"}</small>
    </button>
  `;

  if (els.invoiceStatusSummary) {
    const rowLabel = rows.length === 1 ? "underlag" : "underlag";
    els.invoiceStatusSummary.innerHTML = `
      <div>
        <strong>${rows.length} ${rowLabel} i urvalet</strong>
        <span>${totals.readyRows.length} klara · ${totals.blockedRows.length} behöver attest · ${totals.customerIssueRows.length} behöver kunddata · ${overdueInvoices.length} förfallna · ${customerApprovedInvoices.length} kundgodkända · ${paidInvoices.length} betalda</span>
        <div class="invoice-flow-hint">
          <span class="${totals.blockedRows.length ? "blocked" : "done"}">Attest</span>
          <span class="${totals.customerIssueRows.length ? "blocked" : "done"}">Kunddata</span>
          <span class="${totals.readyRows.length ? "active" : ""}">Skapa</span>
          <span class="${notSentInvoices.length ? "active" : ""}">Skicka</span>
          <span class="${waitingCustomerInvoices.length ? "active" : ""}">Kund</span>
          <span class="${customerApprovedInvoices.length ? "ready" : ""}">Betalning</span>
        </div>
      </div>
      <div class="summary-actions">
        <button type="button" data-invoice-summary-filter="ready">Visa klara</button>
        <button type="button" data-invoice-summary-filter="blocked">Visa spärrar</button>
        <button type="button" data-invoice-summary-filter="customer">Visa kunddata</button>
      </div>
    `;
  }
}

function renderReportCatalog() {
  if (!els.reportTags || !els.reportCatalog) return;
  const query = (els.reportSearch?.value || "").trim().toLowerCase();
  const favoritesOnly = els.reportShowFavorites?.classList.contains("active");
  const tags = [...new Set(reportDefinitions.map((report) => report.tag))];
  const reports = reportDefinitions.filter((report) => {
    const haystack = `${report.code} ${report.title} ${report.tag} ${report.description} ${report.moduleLabel} ${report.owner} ${report.frequency} ${(report.keywords || []).join(" ")}`.toLowerCase();
    return (!query || haystack.includes(query)) && (!favoritesOnly || report.favorite);
  });

  els.reportTags.innerHTML = tags.map((tag) => `
    <button class="tag-button ${query === tag.toLowerCase() ? "active" : ""}" type="button" data-report-tag="${escapeHtml(tag)}">${escapeHtml(tag)} <span>${reportDefinitions.filter((report) => report.tag === tag).length}</span></button>
  `).join("");

  if (!reports.length) {
    renderEmpty(els.reportCatalog);
    return;
  }

  els.reportCatalog.innerHTML = reports.map((report) => {
    const rows = getReportRows(report.id);
    const health = getReportHealth(report, rows);
    return `
    <button class="analysis-card report-card ${report.id === selectedReportId ? "active" : ""}" type="button" data-report-select="${escapeHtml(report.id)}">
      <span class="report-card-head">
        <span class="analysis-icon">${escapeHtml(report.tag.slice(0, 2).toUpperCase())}</span>
        <span class="report-health ${escapeHtml(health.tone)}">${escapeHtml(health.label)}</span>
      </span>
      <div>
        <strong>${escapeHtml(report.title)}</strong>
        <p>${escapeHtml(report.description)}</p>
        <small class="report-code">${escapeHtml(report.code)} · ${escapeHtml(report.frequency)} · ${escapeHtml(report.owner)}</small>
      </div>
      <span class="report-card-meta">
        <span>${escapeHtml(report.moduleLabel)}</span>
        <span>${rows.length} rader</span>
        <span>${escapeHtml(health.detail)}</span>
      </span>
      <b>${report.favorite ? "Favorit" : escapeHtml(report.tag)}</b>
    </button>
  `;
  }).join("");
}

function getReportDefinition(reportId = selectedReportId) {
  return reportDefinitions.find((report) => report.id === reportId) || reportDefinitions[0];
}

function getReportHealth(report, rows = getReportRows(report.id)) {
  const statuses = rows.map((row) => (row.status || "").toLowerCase());
  const hasBlockingStatus = statuses.some((status) => /behöver|attest|öppet|följ upp|spärr|förfallen|ändring/.test(status));
  if (!rows.length) {
    return { label: "Tom", tone: "neutral", detail: "Inga rader" };
  }
  if (hasBlockingStatus) {
    return { label: "Åtgärd", tone: "warning", detail: "Kräver kontroll" };
  }
  if (report.favorite) {
    return { label: "Favorit", tone: "success", detail: "Redo" };
  }
  return { label: "Aktiv", tone: "info", detail: "Uppdaterad" };
}

function getReportRowTone(status = "") {
  const normalized = status.toLowerCase();
  if (/behöver|attest|öppet|följ upp|spärr|förfallen|ändring/.test(normalized)) return "warning";
  if (/klar|godkänd|attesterad|betald|signerad/.test(normalized)) return "success";
  if (/intern|utkast/.test(normalized)) return "neutral";
  return "info";
}

function getReportRows(reportId = selectedReportId) {
  if (reportId === "worked-time") {
    const entries = state.entries.filter(isEntryVisible);
    const rows = Object.entries(groupBy(entries, (entry) => `${entry.clientId || "internal"}|${entry.projectId || entry.workOrder || "none"}|${entry.task || "Aktivitet"}`))
      .map(([key, items]) => {
        const [clientId, projectKey, task] = key.split("|");
        const client = getClient(clientId);
        const project = getProject(projectKey);
        const billable = sumHours(items.filter((entry) => entry.billable));
        const total = sumHours(items);
        return {
          title: client?.name || "Intern tid",
          subtitle: `${project?.name || items[0]?.workOrder || "Inget projekt"} · ${task}`,
          value: formatHours(total),
          meta: `${formatHours(billable)} debiterbart · ${total ? Math.round((billable / total) * 100) : 0}%`,
          status: items.some((entry) => isApprovalOpen(entry.status)) ? "Behöver attest" : "Klar",
          targetView: "time",
          targetKind: "entry",
          targetId: items[0]?.id,
          clientId,
          projectId: project?.id || "",
          actionLabel: "Öppna tid"
        };
      });
    return rows.sort((a, b) => parseFloat(b.value) - parseFloat(a.value));
  }

  if (reportId === "invoice-basis") {
    return getInvoiceRows().map((row) => ({
      title: row.project.name,
      subtitle: row.client?.name || "Okänd kund",
      value: formatCurrency(row.total),
      meta: `${formatHours(row.hours)} fakturerbara timmar · ${formatCurrency(row.supplierInvoices + row.otherValue)} övrigt`,
      status: getInvoiceReadinessLabel(row),
      targetView: "invoice",
      targetKind: "invoice-row",
      targetId: row.project.id,
      clientId: row.client?.id || row.project.clientId || "",
      projectId: row.project.id,
      actionLabel: "Öppna underlag"
    }));
  }

  if (reportId === "payroll") {
    const payrollEntries = state.entries.filter((entry) => isEntryVisible(entry) && entry.payroll);
    const payrollReceipts = state.receipts.filter((receipt) => isClientVisible(getClient(receipt.clientId) || {}) && receipt.payroll);
    const payrollTravels = state.travels.filter((travel) => isClientVisible(getClient(travel.clientId) || {}) && travel.payroll);
    const employees = [...new Set([
      ...payrollEntries.map((entry) => entry.employee || getCurrentUser().name),
      ...payrollReceipts.map((receipt) => receipt.employee || getCurrentUser().name),
      ...payrollTravels.map((travel) => travel.employee || getCurrentUser().name)
    ])].filter(Boolean);
    return employees.map((employee) => {
      const entries = payrollEntries.filter((entry) => (entry.employee || getCurrentUser().name) === employee);
      const receipts = payrollReceipts.filter((receipt) => (receipt.employee || getCurrentUser().name) === employee);
      const travels = payrollTravels.filter((travel) => (travel.employee || getCurrentUser().name) === employee);
      const amount = receipts.reduce((sum, receipt) => sum + Number(receipt.amount || 0), 0) + travels.reduce((sum, travel) => sum + getTravelValue(travel), 0);
      return {
        title: employee,
        subtitle: `${formatHours(sumHours(entries.filter((entry) => entry.type === "absence")))} frånvaro · ${receipts.length} kvitton · ${travels.length} resor`,
        value: formatHours(sumHours(entries)),
        meta: `${formatSEK(amount)} ersättning/utlägg`,
        status: entries.some((entry) => isApprovalOpen(entry.status)) ? "Öppet" : "Klar",
        targetView: "time",
        targetKind: "payroll",
        employee,
        actionLabel: "Öppna månad"
      };
    }).sort((a, b) => parseFloat(b.value) - parseFloat(a.value));
  }

  if (reportId === "receipts") {
    return state.receipts.filter((receipt) => isClientVisible(getClient(receipt.clientId) || {})).map((receipt) => ({
      title: receipt.supplier,
      subtitle: `${getClient(receipt.clientId)?.name || "Intern"} · ${getProject(receipt.projectId)?.name || "Inget projekt"}`,
      value: formatCurrency(Number(receipt.amount || 0)),
      meta: `${receipt.billable ? "Fakturerbar" : "Ej fakturerbar"} · ${receipt.payroll ? "På löneunderlag" : "Ej lön"}`,
      status: getApprovalStatusLabel(receipt.status),
      targetView: "time",
      targetKind: "receipt",
      targetId: receipt.id,
      clientId: receipt.clientId,
      projectId: receipt.projectId,
      actionLabel: "Öppna kvitto"
    })).sort((a, b) => parseFloat(b.value.replace(/\s/g, "")) - parseFloat(a.value.replace(/\s/g, "")));
  }

  if (reportId === "absence") {
    const entries = state.entries.filter((entry) => isEntryVisible(entry) && entry.type === "absence");
    return Object.entries(groupBy(entries, (entry) => entry.employee || "Okänd")).map(([employee, items]) => ({
      title: employee,
      subtitle: [...new Set(items.map((entry) => entry.task || "Frånvaro"))].join(", "),
      value: formatHours(sumHours(items)),
      meta: `${items.length} registreringar`,
      status: items.some((entry) => isApprovalOpen(entry.status)) ? "Attest kvar" : "Klar",
      targetView: "time",
      targetKind: "entry",
      targetId: items[0]?.id,
      employee,
      actionLabel: "Öppna frånvaro"
    })).sort((a, b) => parseFloat(b.value) - parseFloat(a.value));
  }

  if (reportId === "internal") {
    const entries = state.entries.filter((entry) => isEntryVisible(entry) && entry.type === "internal");
    return Object.entries(groupBy(entries, (entry) => entry.task || "Internt")).map(([task, items]) => ({
      title: task,
      subtitle: [...new Set(items.map((entry) => entry.employee || "Okänd"))].join(", "),
      value: formatHours(sumHours(items)),
      meta: `${items.length} registreringar · ej debiterbart`,
      status: "Intern",
      targetView: "time",
      targetKind: "entry",
      targetId: items[0]?.id,
      actionLabel: "Öppna interntid"
    })).sort((a, b) => parseFloat(b.value) - parseFloat(a.value));
  }

  if (reportId === "customers") {
    return state.clients.filter(isClientVisible).map((client) => {
      const snapshot = getClientSnapshot(client.id);
      return {
        title: client.name,
        subtitle: `${client.owner || "Ingen ansvarig"} · ${snapshot.projects.length} projekt · ${snapshot.agreements.length} avtal`,
        value: formatCurrency(snapshot.invoiceValue),
        meta: `${formatHours(snapshot.billableHours)} debiterbar tid · ${snapshot.draftItems.length} öppna underlag`,
        status: snapshot.draftItems.length ? "Följ upp" : "Klar",
        targetView: "clients",
        targetKind: "client",
        targetId: client.id,
        clientId: client.id,
        actionLabel: "Öppna kund"
      };
    }).sort((a, b) => parseFloat(b.value.replace(/\s/g, "")) - parseFloat(a.value.replace(/\s/g, "")));
  }

  if (reportId === "approvals") {
    return getApprovalItems({ includeApproved: true }).map((item) => ({
      title: item.title,
      subtitle: item.subtitle,
      value: item.value,
      meta: `${item.owner || "Ingen ansvarig"} · ${item.date || "-"}`,
      status: getApprovalStatusLabel(item.status),
      targetView: "approvals",
      targetKind: item.kind,
      targetId: item.id,
      actionLabel: "Öppna attest"
    }));
  }

  return [];
}

function getReportActions(reportId = selectedReportId) {
  const actions = [
    { label: "Exportera CSV", action: "export" }
  ];
  if (reportId === "worked-time" || reportId === "absence" || reportId === "internal" || reportId === "receipts") {
    actions.unshift({ label: "Öppna tidsvy", action: "time", primary: true });
  }
  if (reportId === "invoice-basis") actions.unshift({ label: "Gå till fakturering", action: "invoice", primary: true });
  if (reportId === "customers") actions.unshift({ label: "Öppna kunder", action: "clients", primary: true });
  if (reportId === "approvals") actions.unshift({ label: "Visa attestflöde", action: "approvals", primary: true });
  if (reportId === "payroll") actions.unshift({ label: "Öppna löneunderlag", action: "payroll", primary: true });
  return actions;
}

function getReportMetrics(reportId = selectedReportId, rows = getReportRows(reportId)) {
  const entries = state.entries.filter(isEntryVisible);
  const totalHours = sumHours(entries);
  const billableHours = sumHours(entries.filter((entry) => entry.billable));
  const invoiceRows = reportId === "invoice-basis" ? getInvoiceRows() : [];
  if (reportId === "invoice-basis") {
    return [
      { label: "Underlag", value: String(invoiceRows.length) },
      { label: "Att fakturera", value: formatCurrency(invoiceRows.reduce((sum, row) => sum + row.total, 0)) },
      { label: "Behöver attest", value: String(invoiceRows.filter((row) => row.warning > 0).length) },
      { label: "Klara", value: String(invoiceRows.filter(isInvoiceRowReady).length) }
    ];
  }
  if (reportId === "payroll") {
    return [
      { label: "Medarbetare", value: String(rows.length) },
      { label: "Lönetid", value: formatHours(sumHours(entries.filter((entry) => entry.payroll))) },
      { label: "Frånvaro", value: formatHours(sumHours(entries.filter((entry) => entry.payroll && entry.type === "absence"))) },
      { label: "Utlägg", value: formatSEK(state.receipts.filter((receipt) => receipt.payroll).reduce((sum, receipt) => sum + Number(receipt.amount || 0), 0)) }
    ];
  }
  if (reportId === "customers") {
    return [
      { label: "Kunder", value: String(rows.length) },
      { label: "Öppna underlag", value: String(rows.reduce((sum, row) => sum + (row.status === "Följ upp" ? 1 : 0), 0)) },
      { label: "Aktiva projekt", value: String(state.projects.filter((project) => project.status === "active").length) },
      { label: "Avtal", value: String(state.agreements.length) }
    ];
  }
  if (reportId === "approvals") {
    const open = getApprovalItems().filter((item) => matchesApprovalStatusFilter(item, "open")).length;
    return [
      { label: "Totalt", value: String(rows.length) },
      { label: "Öppna", value: String(open) },
      { label: "Attesterade", value: String(rows.length - open) },
      { label: "I urvalet", value: String(rows.length) }
    ];
  }
  return [
    { label: "Rader", value: String(rows.length) },
    { label: "Totaltid", value: formatHours(totalHours) },
    { label: "Debiterbart", value: formatHours(billableHours) },
    { label: "Debiteringsgrad", value: `${totalHours ? Math.round((billableHours / totalHours) * 100) : 0}%` }
  ];
}

function renderReportDetail() {
  if (!els.reportDetailTitle || !els.reportResultList || !els.reportDetailMetrics) return;
  const report = getReportDefinition();
  const rows = getReportRows(report.id);
  const metrics = getReportMetrics(report.id, rows);
  els.reportDetailTitle.textContent = report.title;
  els.reportDetailDescription.textContent = report.description;
  els.reportDetailActions.innerHTML = getReportActions(report.id).map((action) => `
    <button class="${action.primary ? "primary-button" : "ghost-button"} small-button" type="button" data-report-action="${escapeHtml(action.action)}">${escapeHtml(action.label)}</button>
  `).join("");
  els.reportDetailMetrics.innerHTML = metrics.map((metric) => `
    <div><span>${escapeHtml(metric.label)}</span><strong>${escapeHtml(metric.value)}</strong></div>
  `).join("");

  if (!rows.length) {
    renderEmpty(els.reportResultList);
    return;
  }

  els.reportResultList.innerHTML = rows.slice(0, 12).map((row, index) => `
    <article class="report-result-row ${escapeHtml(getReportRowTone(row.status))}">
      <div>
        <strong>${escapeHtml(row.title)}</strong>
        <span>${escapeHtml(row.subtitle || "")}</span>
      </div>
      <div>
        <strong>${escapeHtml(row.value || "-")}</strong>
        <span>${escapeHtml(row.meta || "")}</span>
      </div>
      <span class="report-row-actions">
        <b>${escapeHtml(row.status || "")}</b>
        <button class="ghost-button small-button" type="button" data-report-row-index="${index}">${escapeHtml(row.actionLabel || "Öppna")}</button>
      </span>
    </article>
  `).join("");
}

function openReportRow(row) {
  if (!row) return;
  if (row.clientId && state.clients.some((client) => client.id === row.clientId)) selectedClientId = row.clientId;
  if (row.projectId && state.projects.some((project) => project.id === row.projectId)) selectedProjectId = row.projectId;

  if (row.targetView === "clients" && row.targetId) {
    selectedClientId = row.targetId;
    setView("clients");
    renderClients();
    showToast("Öppnade kundkortet från rapporten.");
    return;
  }

  if (row.targetView === "invoice") {
    setView("invoice");
    renderInvoiceWorkbench();
    if (row.targetId) openInvoiceDetail(row.targetId);
    showToast("Öppnade fakturaunderlaget från rapporten.");
    return;
  }

  if (row.targetView === "approvals") {
    selectedReportId = "approvals";
    setView("reports");
    renderReportCatalog();
    renderReportDetail();
    if (els.approvalKindFilter && row.targetKind) els.approvalKindFilter.value = row.targetKind;
    renderApprovalFlow();
    els.approvalList?.scrollIntoView({ behavior: "smooth", block: "start" });
    showToast("Öppnade attestflödet från rapporten.");
    return;
  }

  if (row.targetView === "time") {
    setView("time");
    if (row.targetKind && row.targetId && ["entry", "receipt", "travel"].includes(row.targetKind)) {
      openEntityEditor(row.targetKind, row.targetId);
    } else if (row.targetKind === "payroll") {
      scrollToPageTarget("monthly-register");
    }
    showToast("Öppnade tidsunderlaget från rapporten.");
  }
}

function handleReportAction(action) {
  if (action === "export") {
    exportCsv();
    showToast("CSV-export skapades från aktuellt underlag.");
    return;
  }
  if (action === "time" || action === "payroll") {
    setView("time");
    if (action === "payroll") scrollToPageTarget("monthly-register");
    showToast("Öppnade tidsrapporteringen.");
    return;
  }
  if (action === "invoice") {
    setView("invoice");
    scrollToPageTarget("invoice-history");
    showToast("Öppnade fakturering.");
    return;
  }
  if (action === "clients") {
    setView("clients");
    showToast("Öppnade kunder.");
    return;
  }
  if (action === "approvals") {
    selectedReportId = "approvals";
    renderReportCatalog();
    renderReportDetail();
    els.approvalList?.scrollIntoView({ behavior: "smooth", block: "start" });
    showToast("Visar attestflödet.");
  }
}

function isApprovalDone(status) {
  return ["approved", "signed", "paid", "invoiced"].includes(status);
}

function isApprovalBlocked(status) {
  return ["rejected", "expired", "overdue", "changeRequested"].includes(status);
}

function matchesApprovalStatusFilter(item, filter) {
  if (filter === "all") return true;
  if (filter === "open") return !isApprovalDone(item.status);
  if (filter === "submitted") return ["submitted", "sent", "created", "customerApproved"].includes(item.status);
  if (filter === "draft") return ["draft", "rejected"].includes(item.status);
  if (filter === "approved") return isApprovalDone(item.status);
  if (filter === "blocked") return isApprovalBlocked(item.status);
  return true;
}

function setDynamicSelectOptions(select, options, allLabel) {
  if (!select) return;
  const selected = select.value || "all";
  const normalized = [...new Map(options.filter(Boolean).map((option) => [option.value, option])).values()]
    .sort((a, b) => a.label.localeCompare(b.label, "sv"));
  select.innerHTML = [
    `<option value="all">${escapeHtml(allLabel)}</option>`,
    ...normalized.map((option) => `<option value="${escapeHtml(option.value)}">${escapeHtml(option.label)}</option>`)
  ].join("");
  select.value = normalized.some((option) => option.value === selected) ? selected : "all";
}

function renderApprovalFilterOptions(items) {
  setDynamicSelectOptions(
    els.approvalOwnerFilter,
    items.map((item) => ({ value: item.owner || "unassigned", label: item.owner || "Ingen ansvarig" })),
    "Alla"
  );
  setDynamicSelectOptions(
    els.approvalProjectFilter,
    items.map((item) => {
      const project = getProject(item.projectId);
      return { value: item.projectId || "unassigned", label: project?.name || "Inget projekt" };
    }),
    "Alla projekt"
  );
}

function getFilteredApprovalItems(items) {
  const query = (els.approvalSearch?.value || "").trim().toLowerCase();
  const owner = els.approvalOwnerFilter?.value || "all";
  const projectId = els.approvalProjectFilter?.value || "all";
  const kind = els.approvalKindFilter?.value || "all";
  const status = els.approvalStatusFilter?.value || "open";
  const from = els.approvalFrom?.value || "";
  const to = els.approvalTo?.value || "";
  const actionableOnly = Boolean(els.approvalActionableOnly?.checked);
  return items.filter((item) => {
    const matchesKind = kind === "all" || item.kind === kind;
    const matchesStatus = matchesApprovalStatusFilter(item, status);
    const matchesOwner = owner === "all" || (owner === "unassigned" ? !item.owner : item.owner === owner);
    const matchesProject = projectId === "all" || (projectId === "unassigned" ? !item.projectId : item.projectId === projectId);
    const matchesDate = isDateInRange(item.date || isoToday, from, to);
    const matchesActionable = !actionableOnly || (item.actions || []).length > 0;
    const matchesQuery = !query || `${item.title} ${item.subtitle} ${item.value} ${item.note} ${item.haystack || ""}`.toLowerCase().includes(query);
    return matchesKind && matchesStatus && matchesOwner && matchesProject && matchesDate && matchesActionable && matchesQuery;
  });
}

function getApprovalItemKey(item) {
  return `${item.kind}:${item.id}`;
}

function getSelectedApprovalTargets() {
  return [...document.querySelectorAll("[data-approval-select]:checked")]
    .map((checkbox) => {
      const [kind, id] = checkbox.dataset.approvalSelect.split(":");
      return { kind, id };
    });
}

function getApprovalItem(kind, id, options = { includeApproved: true }) {
  return getApprovalItems(options).find((item) => item.kind === kind && item.id === id) || null;
}

function renderApprovalFlow() {
  if (!els.approvalList) return;
  const allItems = getApprovalItems({ includeApproved: true });
  renderApprovalFilterOptions(allItems);
  const visibleItems = getFilteredApprovalItems(allItems);
  const waiting = allItems.filter((item) => ["submitted", "sent", "created", "customerApproved"].includes(item.status));
  const blocked = allItems.filter((item) => isApprovalBlocked(item.status));
  const done = allItems.filter((item) => isApprovalDone(item.status));
  const drafts = allItems.filter((item) => ["draft", "rejected"].includes(item.status));
  const visibleActionable = visibleItems.filter((item) => (item.actions || []).length > 0).length;

  if (els.approvalSummary) {
    els.approvalSummary.innerHTML = `
      <button type="button" data-approval-summary-filter="submitted"><span>Väntar attest</span><strong>${waiting.length}</strong></button>
      <button type="button" data-approval-summary-filter="draft"><span>Utkast</span><strong>${drafts.length}</strong></button>
      <button type="button" data-approval-summary-filter="blocked"><span>Spärrade/förfallna</span><strong>${blocked.length}</strong></button>
      <button type="button" data-approval-summary-filter="approved"><span>Klara</span><strong>${done.length}</strong></button>
      <button type="button" data-approval-summary-filter="all"><span>Visas nu</span><strong>${visibleItems.length}</strong></button>
      <button type="button" data-approval-actionable-shortcut><span>Kan hanteras</span><strong>${visibleActionable}</strong></button>
    `;
  }

  if (els.approvalGroupSummary) {
    const kindRows = ["entry", "receipt", "travel", "agreement", "esign", "invoice"].map((kind) => {
      const rows = visibleItems.filter((item) => item.kind === kind);
      const actionable = rows.filter((item) => (item.actions || []).length > 0).length;
      return { kind, rows, actionable };
    }).filter((row) => row.rows.length);
    els.approvalGroupSummary.innerHTML = kindRows.length
      ? kindRows.map((row) => `
        <button class="approval-group-card" type="button" data-approval-kind-shortcut="${row.kind}">
          <span>${escapeHtml(getApprovalKindLabel(row.kind))}</span>
          <strong>${row.rows.length}</strong>
          <small>${row.actionable} kan hanteras</small>
        </button>
      `).join("")
      : "";
  }

  if (els.approvalSelectAll) {
    els.approvalSelectAll.checked = false;
  }

  if (!visibleItems.length) {
    renderEmpty(els.approvalList);
    return;
  }

  els.approvalList.innerHTML = visibleItems.map((item) => {
    const canSelect = (item.actions || []).length > 0;
    return `
      <div class="approval-card ${getWorkflowBadgeClass(item.kind, item.status)}">
        <label class="approval-select-cell" aria-label="Markera ${escapeHtml(item.title)}">
          <input type="checkbox" data-approval-select="${escapeHtml(getApprovalItemKey(item))}" ${canSelect ? "" : "disabled"}>
        </label>
        <div>
          <div class="approval-title">
            <strong>${escapeHtml(item.title)}</strong>
            <span class="badge ${getWorkflowBadgeClass(item.kind, item.status)}">${getWorkflowStatusLabel(item.kind, item.status)}</span>
          </div>
          <span>${escapeHtml(item.subtitle)} · ${item.date}</span>
          <small class="approval-meta">
            <span>${escapeHtml(item.owner || "Ingen ansvarig")}</span>
            <span>${escapeHtml(getApprovalKindLabel(item.kind))}</span>
            <span>${escapeHtml(getClient(item.clientId)?.name || "Ingen kund")}</span>
            <span>${escapeHtml(getProject(item.projectId)?.name || "Inget projekt")}</span>
          </small>
          ${item.note ? `<small class="review-note">${escapeHtml(item.note)}</small>` : ""}
        </div>
        <div class="approval-actions">
          <strong>${escapeHtml(item.value)}</strong>
          <button class="ghost-button small-button" type="button" data-approval-open="${item.kind}" data-approval-id="${item.id}">Öppna</button>
          ${(item.actions || []).map((action) => `
            <button class="${action.style === "primary" ? "primary-button" : "ghost-button"} small-button" type="button" data-approval-action="${action.action}" data-approval-kind="${item.kind}" data-approval-id="${item.id}">${escapeHtml(action.label)}</button>
          `).join("")}
          ${isApprovalDone(item.status) ? `<span class="muted-line">Klart</span>` : ""}
        </div>
      </div>
    `;
  }).join("");
}

function getApprovalKindLabel(kind) {
  return {
    entry: "Tid",
    receipt: "Kvitto",
    travel: "Resa",
    agreement: "Avtal",
    esign: "E-signering",
    invoice: "Faktura"
  }[kind] || kind;
}

function getApprovalEditAttribute(kind, id) {
  return {
    entry: `data-edit-entry="${id}"`,
    receipt: `data-edit-receipt="${id}"`,
    travel: `data-edit-travel="${id}"`
  }[kind] || "";
}

function openBasisApprovalDetail(kind, id) {
  const item = getApprovalItem(kind, id);
  const target = getApprovalTarget(kind, id);
  if (!item || !target) return false;
  const client = getClient(item.clientId);
  const project = getProject(item.projectId);
  const actions = item.actions || [];
  const valueLabel = kind === "entry" ? "Tid" : kind === "receipt" ? "Belopp" : "Antal";
  const description = kind === "entry"
    ? target.description || target.workOrder || "Ingen beskrivning"
    : kind === "receipt"
      ? `${target.supplier || "Leverantör saknas"} · moms ${formatSEK(Number(target.vat || 0))}`
      : `${target.from || "-"} till ${target.to || "-"}`;

  setDrawerContent({
    eyebrow: "Attest",
    title: item.title,
    body: `
      <div class="drawer-list">
        <article class="drawer-list-item">
          <div>
            <strong>${escapeHtml(item.subtitle)}</strong>
            <span>${escapeHtml(description)}</span>
          </div>
          <span class="badge ${getWorkflowBadgeClass(kind, item.status)}">${escapeHtml(getWorkflowStatusLabel(kind, item.status))}</span>
        </article>
        <article class="drawer-list-item">
          <strong>Koppling</strong>
          <span>${escapeHtml(client?.name || "Ingen kund")} · ${escapeHtml(project?.name || "Inget projekt")} · ${escapeHtml(item.owner || "Ingen ansvarig")}</span>
        </article>
        <article class="drawer-list-item">
          <strong>${escapeHtml(valueLabel)}</strong>
          <span>${escapeHtml(item.value)} · datum ${escapeHtml(item.date || "-")}</span>
        </article>
        ${item.note ? `
          <article class="drawer-list-item">
            <strong>Kommentar</strong>
            <span>${escapeHtml(item.note)}</span>
          </article>
        ` : ""}
      </div>
      <div class="drawer-actions">
        <button class="ghost-button" type="button" ${getApprovalEditAttribute(kind, id)}>Redigera underlag</button>
        ${actions.map((action) => `
          <button class="${action.style === "primary" ? "primary-button" : "ghost-button"}" type="button" data-approval-action="${action.action}" data-approval-kind="${kind}" data-approval-id="${id}">${escapeHtml(action.label)}</button>
        `).join("")}
      </div>
    `
  });
  return true;
}

function openApprovalItem(kind, id) {
  if (kind === "entry" || kind === "receipt" || kind === "travel") {
    return openBasisApprovalDetail(kind, id);
  }
  if (kind === "agreement") {
    openAgreementDetail(id);
    return true;
  }
  if (kind === "esign") {
    openEsignDetail(id);
    return true;
  }
  if (kind === "invoice") {
    openInvoiceRecordDetail(id);
    return true;
  }
  return false;
}

async function runApprovalBulkAction(action) {
  const selected = getSelectedApprovalTargets();
  if (!selected.length) {
    showToast("Markera minst en post i attestflödet först.", "warning");
    return;
  }

  const options = { silent: true };
  if (action === "reject") {
    const note = window.prompt("Kommentar till de markerade posterna:", "Komplettera underlaget.");
    if (note === null) return;
    options.note = note.trim() || "Komplettera underlaget.";
    const creditTargets = selected.filter((target) => {
      if (target.kind !== "invoice") return false;
      const invoice = (state.invoices || []).find((item) => item.id === target.id);
      return invoice && getEffectiveInvoiceStatus(invoice) !== "changeRequested";
    });
    if (creditTargets.length && !window.confirm(`Vill du kreditera ${creditTargets.length} markerade fakturor?`)) return;
    options.confirmedCredit = true;
  }

  let changed = 0;
  for (const target of selected) {
    if (await handleApprovalAction(action, target.kind, target.id, options)) changed += 1;
  }

  if (!changed) {
    showToast("Inga markerade poster kunde hanteras med den åtgärden.", "warning");
    return;
  }
  showToast(`${changed} markerade poster hanterades.`);
}

function renderReports() {
  renderReportCatalog();
  renderReportDetail();
  const visibleEntriesForReports = state.entries.filter(isEntryVisible);
  const totalHours = sumHours(visibleEntriesForReports);
  const billableHours = sumHours(visibleEntriesForReports.filter((entry) => entry.billable));
  const internalHours = sumHours(visibleEntriesForReports.filter((entry) => entry.type === "internal"));
  const absenceHours = sumHours(visibleEntriesForReports.filter((entry) => entry.type === "absence"));
  const approvedHours = sumHours(visibleEntriesForReports.filter((entry) => isInvoiceReady(entry.status) || entry.status === "invoiced"));
  const debitingRate = totalHours ? Math.round((billableHours / totalHours) * 100) : 0;
  const billableByClient = state.clients.map((client) => {
    if (!isClientVisible(client)) return null;
    const entries = state.entries.filter((entry) => isEntryVisible(entry) && entry.clientId === client.id && entry.billable && isInvoiceReady(entry.status));
    const receipts = state.receipts.filter((receipt) => receipt.clientId === client.id && receipt.billable && isInvoiceReady(receipt.status));
    const travels = state.travels.filter((travel) => travel.clientId === client.id && travel.billable && isInvoiceReady(travel.status));
    const hours = sumHours(entries);
    const expenses = receipts.reduce((total, receipt) => total + Number(receipt.amount || 0), 0);
    const travelValue = travels.reduce((total, travel) => total + getTravelValue(travel), 0);
    return {
      client,
      hours,
      value: hours * Number(client.rate || 0) + expenses + travelValue,
      extras: expenses + travelValue
    };
  }).filter(Boolean).filter((row) => row.hours > 0 || row.extras > 0).sort((a, b) => b.value - a.value);

  if (!billableByClient.length) {
    els.invoiceSummary.innerHTML = `
      <div class="client-detail-metrics portal-metrics report-kpi-grid">
        <div><span>Debiteringsgrad</span><strong>${debitingRate}%</strong></div>
        <div><span>Intern tid</span><strong>${formatHours(internalHours)}</strong></div>
        <div><span>Frånvaro</span><strong>${formatHours(absenceHours)}</strong></div>
      </div>
      ${els.emptyTemplate.innerHTML}
    `;
  } else {
    els.invoiceSummary.innerHTML = `
      <div class="client-detail-metrics portal-metrics report-kpi-grid">
        <div><span>Debiteringsgrad</span><strong>${debitingRate}%</strong></div>
        <div><span>Intern tid</span><strong>${formatHours(internalHours)}</strong></div>
        <div><span>Frånvaro</span><strong>${formatHours(absenceHours)}</strong></div>
      </div>
      ${billableByClient.map((row) => `
      <div class="invoice-item">
        <div>
          <strong>${escapeHtml(row.client.name)}</strong>
          <span>${formatHours(row.hours)} tid · ${formatCurrency(row.extras)} kvitton/resor</span>
        </div>
        <strong>${formatCurrency(row.value)}</strong>
      </div>
    `).join("")}
    `;
  }

  const payrollEntries = state.entries.filter((entry) => isEntryVisible(entry) && entry.payroll && (isInvoiceReady(entry.status) || entry.status === "invoiced"));
  const payrollReceipts = state.receipts.filter((receipt) => isClientVisible(getClient(receipt.clientId)) && receipt.payroll && (isInvoiceReady(receipt.status) || receipt.status === "invoiced"));
  const payrollTravels = state.travels.filter((travel) => isClientVisible(getClient(travel.clientId)) && travel.payroll && (isInvoiceReady(travel.status) || travel.status === "invoiced"));
  const payrollEmployees = [...new Set([
    ...payrollEntries.map((entry) => entry.employee || getCurrentUser().name),
    ...payrollReceipts.map((receipt) => receipt.employee || getCurrentUser().name),
    ...payrollTravels.map((travel) => travel.employee || getCurrentUser().name)
  ])].filter(Boolean);
  const payrollByEmployee = payrollEmployees
    .map((employee) => {
      const entries = payrollEntries.filter((entry) => (entry.employee || getCurrentUser().name) === employee);
      const receipts = payrollReceipts.filter((receipt) => (receipt.employee || getCurrentUser().name) === employee);
      const travels = payrollTravels.filter((travel) => (travel.employee || getCurrentUser().name) === employee);
      const receiptValue = receipts.reduce((sum, receipt) => sum + Number(receipt.amount || 0), 0);
      const travelValue = travels.reduce((sum, travel) => sum + getTravelValue(travel), 0);
      return {
        employee,
        hours: sumHours(entries),
        absence: sumHours(entries.filter((entry) => entry.type === "absence")),
        receipts: receipts.length,
        travels: travels.length,
        amount: receiptValue + travelValue
      };
    })
    .sort((a, b) => b.hours - a.hours || b.amount - a.amount);

  if (!payrollByEmployee.length) {
    els.payrollSummary.innerHTML = `
      ${els.emptyTemplate.innerHTML}
      <div class="invoice-item">
        <div>
          <strong>Utlägg och kvitton</strong>
          <span>${payrollReceipts.length} underlag på löneunderlag</span>
        </div>
        <strong>${formatSEK(payrollReceipts.reduce((sum, receipt) => sum + Number(receipt.amount || 0), 0))}</strong>
      </div>
      <div class="invoice-item">
        <div>
          <strong>Resor och traktamenten</strong>
          <span>${payrollTravels.length} poster på löneunderlag</span>
        </div>
        <strong>${formatSEK(payrollTravels.reduce((sum, travel) => sum + getTravelValue(travel), 0))}</strong>
      </div>
    `;
  } else {
    els.payrollSummary.innerHTML = `
      ${payrollByEmployee.map((row) => `
      <div class="invoice-item">
        <div>
          <strong>${escapeHtml(row.employee)}</strong>
          <span>${formatHours(row.absence)} frånvaro · ${row.receipts} kvitton · ${row.travels} resor</span>
        </div>
        <strong>${formatHours(row.hours)} · ${formatSEK(row.amount)}</strong>
      </div>
    `).join("")}
      <div class="invoice-item">
        <div>
          <strong>Utlägg och kvitton</strong>
          <span>${payrollReceipts.length} underlag på löneunderlag</span>
        </div>
        <strong>${formatSEK(payrollReceipts.reduce((sum, receipt) => sum + Number(receipt.amount || 0), 0))}</strong>
      </div>
      <div class="invoice-item">
        <div>
          <strong>Resor och traktamenten</strong>
          <span>${payrollTravels.length} poster på löneunderlag</span>
        </div>
        <strong>${formatSEK(payrollTravels.reduce((sum, travel) => sum + getTravelValue(travel), 0))}</strong>
      </div>
    `;
  }

  const byEmployee = Object.entries(groupBy(state.entries.filter(isEntryVisible), (entry) => entry.employee))
    .map(([employee, entries]) => ({
      employee,
      hours: sumHours(entries),
      approved: sumHours(entries.filter((entry) => isInvoiceReady(entry.status) || entry.status === "invoiced"))
    }))
    .sort((a, b) => b.hours - a.hours);

  if (!byEmployee.length) {
    renderEmpty(els.employeeList);
  } else {
    els.employeeList.innerHTML = byEmployee.map((row) => `
      <div class="employee-item">
        <div>
          <strong>${escapeHtml(row.employee)}</strong>
          <span>${formatHours(row.approved)} attesterat · ${totalHours ? Math.round((row.hours / totalHours) * 100) : 0}% av all tid</span>
        </div>
        <strong>${formatHours(row.hours)}</strong>
      </div>
    `).join("");
  }

  renderUserAdministration();
  renderAdminOverview();

  renderApprovalFlow();
}

function renderAdminOverview() {
  if (!els.adminSummary || !els.adminChecklist || !els.roleMatrix) return;
  const pendingRequests = [...state.accountRequests, ...cloudAccountRequests].filter((request) => request.status === "pending").length;
  const customerUsers = state.users.filter((user) => user.role === "customer").length;
  const usersWithoutClient = state.users.filter((user) => user.role === "customer" && !user.clientId).length;
  const openApprovals = getApprovalItems().filter((item) => matchesApprovalStatusFilter(item, "open")).length;
  const settings = state.settings || defaultState.settings;
  const invoiceReady = Boolean(settings.companyName && settings.adminEmail && settings.invoicePrefix && settings.bankgiro);
  const portalReady = customerUsers > 0 && !usersWithoutClient;

  if (!isAdminUser()) {
    els.adminSummary.innerHTML = `
      <div><span>Din roll</span><strong>${escapeHtml(roleLabels[getCurrentUser().role] || getCurrentUser().role)}</strong></div>
      <div><span>Åtkomst</span><strong>Begränsad</strong></div>
      <div><span>Adminläge</span><strong>Låst</strong></div>
    `;
    els.adminChecklist.innerHTML = `
      <div class="admin-check-row warning"><strong>Endast admin kan ändra roller och inställningar</strong><span>Byt till adminrollen i testläget för att konfigurera systemet.</span></div>
    `;
  } else {
    els.adminSummary.innerHTML = `
      <div><span>Användare</span><strong>${state.users.length}</strong></div>
      <div><span>Kunder med portal</span><strong>${customerUsers}</strong></div>
      <div><span>Kontoansökningar</span><strong>${pendingRequests}</strong></div>
      <div><span>Öppna attester</span><strong>${openApprovals}</strong></div>
      <div><span>Fakturainställningar</span><strong>${invoiceReady ? "Klara" : "Saknas"}</strong></div>
      <div><span>Portalstatus</span><strong>${portalReady ? "Klar" : "Kontrollera"}</strong></div>
    `;

    const checks = [
      {
        ok: invoiceReady,
        title: "Fakturaprofil",
        text: invoiceReady ? `Prefix ${settings.invoicePrefix}, bankgiro ${settings.bankgiro}` : "Fyll i företagsnamn, admin e-post, fakturaprefix och bankgiro."
      },
      {
        ok: pendingRequests === 0,
        title: "Kontoansökningar",
        text: pendingRequests ? `${pendingRequests} ansökningar väntar på beslut.` : "Alla kontoansökningar är hanterade."
      },
      {
        ok: usersWithoutClient === 0,
        title: "Kundkoppling",
        text: usersWithoutClient ? `${usersWithoutClient} kundkonton saknar kopplad kund.` : "Alla kundkonton är kopplade till kund."
      },
      {
        ok: openApprovals === 0,
        title: "Attestkö",
        text: openApprovals ? `${openApprovals} underlag ligger öppna i attestflödet.` : "Inga öppna attester just nu."
      }
    ];

    els.adminChecklist.innerHTML = checks.map((check) => `
      <div class="admin-check-row ${check.ok ? "ok" : "warning"}">
        <strong>${escapeHtml(check.title)}</strong>
        <span>${escapeHtml(check.text)}</span>
      </div>
    `).join("");
  }

  const matrixViews = [
    ["dashboard", "Start"],
    ["tasks", "Uppgifter"],
    ["time", "Tid"],
    ["clients", "Kunder"],
    ["sales", "Affärer"],
    ["projects", "Projekt"],
    ["agreements", "Avtal"],
    ["esign", "Signering"],
    ["invoice", "Faktura"],
    ["planning", "Planering"],
    ["analysis", "Analys"],
    ["portal", "Portal"],
    ["collaboration", "Samarbete"],
    ["versions", "Versioner"],
    ["reports", "Rapporter"]
  ];

  els.roleMatrix.innerHTML = `
    <div class="role-matrix-head">
      <span>Roll</span>
      ${matrixViews.map(([, label]) => `<span>${escapeHtml(label)}</span>`).join("")}
    </div>
    ${Object.entries(roleLabels).map(([role, label]) => `
      <div class="role-matrix-row">
        <strong>${escapeHtml(label)}</strong>
        ${matrixViews.map(([view]) => `<span class="${(roleAccess[role] || []).includes(view) ? "allowed" : "blocked"}">${(roleAccess[role] || []).includes(view) ? "Ja" : "-"}</span>`).join("")}
      </div>
    `).join("")}
  `;
}

function renderUserAdministration() {
  if (!els.userList || !els.accountRequestList) return;
  if (!isAdminUser()) {
    els.userList.innerHTML = `
      <div class="empty-state">
        <svg viewBox="0 0 24 24"><path d="M12 17v-6M12 7h.01M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z"></path></svg>
        <span>Endast admin kan hantera team och roller</span>
      </div>
    `;
    els.accountRequestList.innerHTML = `
      <div class="empty-state">
        <svg viewBox="0 0 24 24"><path d="M12 17v-6M12 7h.01M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z"></path></svg>
        <span>Endast admin kan godkänna kontoansökningar</span>
      </div>
    `;
    if (els.addAccountRequest) els.addAccountRequest.disabled = true;
    return;
  }

  if (els.addAccountRequest) els.addAccountRequest.disabled = false;
  els.userList.innerHTML = state.users.map((user) => `
    <div class="employee-item admin-user-card">
      <div>
        <strong>${escapeHtml(user.name)}</strong>
        <span>${escapeHtml(user.email)} · ${escapeHtml(user.title || roleLabels[user.role] || user.role)}</span>
        <small class="review-note">${user.role === "customer" ? `Kundportal: ${escapeHtml(getClient(user.clientId)?.name || "ingen kund kopplad")}` : `Åtkomst: ${(roleAccess[user.role] || []).length} moduler`}</small>
      </div>
      <div class="row-actions">
        <select class="compact-select" data-user-role="${user.id}" aria-label="Roll för ${escapeHtml(user.name)}">
          ${Object.entries(roleLabels).map(([role, label]) => `<option value="${role}" ${role === user.role ? "selected" : ""}>${label}</option>`).join("")}
        </select>
        ${user.role === "customer" ? `
          <select class="compact-select" data-user-client="${user.id}" aria-label="Kundkoppling för ${escapeHtml(user.name)}">
            <option value="">Ingen kund</option>
            ${state.clients.filter((client) => client.name !== "Intern byrå").map((client) => `<option value="${client.id}" ${client.id === user.clientId ? "selected" : ""}>${escapeHtml(client.name)}</option>`).join("")}
          </select>
        ` : ""}
        <button class="mini-button" type="button" title="Ta bort användare" aria-label="Ta bort användare" data-delete-user="${user.id}" ${user.id === state.currentUserId ? "disabled" : ""}>
          <svg viewBox="0 0 24 24"><path d="M4 7h16M10 11v6M14 11v6M6 7l1 14h10l1-14M9 7V4h6v3"></path></svg>
        </button>
      </div>
    </div>
  `).join("");

  const requests = [...cloudAccountRequests, ...state.accountRequests].sort((a, b) => {
    const statusWeight = { pending: 0, approved: 1, rejected: 2 };
    return (statusWeight[a.status] ?? 3) - (statusWeight[b.status] ?? 3) || String(b.createdAt || "").localeCompare(String(a.createdAt || ""));
  });
  if (!requests.length) {
    renderEmpty(els.accountRequestList);
    return;
  }

  els.accountRequestList.innerHTML = requests.map((request) => `
    <div class="employee-item admin-request-card ${request.status}">
      <div>
        <strong>${escapeHtml(request.name)} <span class="badge ${request.status === "approved" ? "approved" : request.status === "rejected" ? "rejected" : "submitted"}">${request.status === "approved" ? "Godkänd" : request.status === "rejected" ? "Avvisad" : "Väntar"}</span></strong>
        <span>${escapeHtml(request.email)} · ${escapeHtml(request.company || "Okänt företag")} · önskar ${escapeHtml(roleLabels[request.requestedRole] || request.requestedRole)}</span>
        ${request.note ? `<small class="review-note">${escapeHtml(request.note)}</small>` : ""}
        ${request.approvedAt ? `<small class="review-note">Godkänd ${request.approvedAt}</small>` : ""}
        ${request.rejectedAt ? `<small class="review-note">Avvisad ${request.rejectedAt}</small>` : ""}
      </div>
      <div class="row-actions">
        ${request.status === "pending" ? `
          <button class="primary-button small-button" type="button" data-approve-account="${request.id}">Godkänn</button>
          <button class="ghost-button small-button" type="button" data-reject-account="${request.id}">Avvisa</button>
        ` : ""}
      </div>
    </div>
  `).join("");
}

function createManualUser() {
  if (!isAdminUser()) return;
  const name = window.prompt("Namn på ny användare:", "Ny medarbetare");
  if (!name) return;
  const email = window.prompt("E-post till användaren:", `${name.toLowerCase().replace(/\s+/g, ".")}@example.se`);
  if (!email) return;
  const role = window.prompt("Roll: admin, owner, employee eller customer", "employee") || "employee";
  const normalizedRole = Object.keys(roleLabels).includes(role.trim()) ? role.trim() : "employee";
  const user = {
    id: makeUserId(name),
    name: name.trim(),
    email: email.trim(),
    role: normalizedRole,
    title: roleLabels[normalizedRole] || "Medarbetare",
    clientId: ""
  };

  if (normalizedRole === "customer") {
    user.clientId = state.clients.find((client) => client.name !== "Intern byrå")?.id || "";
  }

  if (state.users.some((item) => item.email.toLowerCase() === user.email.toLowerCase())) {
    showToast("Det finns redan en användare med den e-posten.", "warning");
    return;
  }

  state.users.push(user);
  saveState();
  renderAll();
  showToast(`${user.name} skapades som ${roleLabels[user.role].toLowerCase()}.`);
}

function getTravelValue(travel) {
  const quantity = Number(travel.quantity || 0);
  return travel.type === "allowance" ? quantity * 290 : quantity * 25;
}

function getInvoiceRows() {
  const from = els.invoiceFrom.value;
  const to = els.invoiceTo.value;
  const search = els.invoiceSearch.value.trim().toLowerCase();
  const activeTab = document.querySelector("[data-invoice-tab].active")?.dataset.invoiceTab || "preliminary";

  const rows = state.projects.map((project, index) => {
    const client = getClient(project.clientId);
    const entries = state.entries.filter((entry) => {
      const belongsToProject = entry.projectId === project.id || entry.workOrder === project.name;
      return belongsToProject && entry.billable && entry.status !== "invoiced" && isDateInRange(entry.date, from, to);
    });
    const receipts = state.receipts.filter((receipt) => receipt.projectId === project.id && receipt.billable && receipt.status !== "invoiced" && isDateInRange(receipt.date, from, to));
    const travels = state.travels.filter((travel) => travel.clientId === project.clientId && travel.billable && travel.status !== "invoiced" && isDateInRange(travel.date, from, to));
    const approvedEntries = entries.filter((entry) => isInvoiceReady(entry.status));
    const draftEntries = entries.filter((entry) => !isInvoiceReady(entry.status));
    const blockedReceipts = receipts.filter((receipt) => !isInvoiceReady(receipt.status));
    const blockedTravels = travels.filter((travel) => !isInvoiceReady(travel.status));
    const hours = sumHours(approvedEntries);
    const draftHours = sumHours(draftEntries);
    const fixedPrice = Number(project.fixedPrice || 0);
    const hourlyValue = hours * Number(client?.rate || 0);
    const articleValue = 0;
    const supplierInvoices = receipts.filter((receipt) => isInvoiceReady(receipt.status)).reduce((total, receipt) => total + Number(receipt.amount || 0), 0);
    const otherValue = travels.filter((travel) => isInvoiceReady(travel.status)).reduce((total, travel) => total + getTravelValue(travel), 0);
    const total = fixedPrice + hourlyValue + articleValue + supplierInvoices + otherValue;

    return {
      id: project.id,
      number: index + 1,
      project,
      client,
      fixedPrice,
      hours,
      draftHours,
      hourlyValue,
      articleValue,
      supplierInvoices,
      otherValue,
      total,
      status: project.invoiceStatus || "preliminary",
      warning: draftEntries.length + blockedReceipts.length + blockedTravels.length,
      blockedBreakdown: {
        entries: draftEntries.length,
        receipts: blockedReceipts.length,
        travels: blockedTravels.length
      }
    };
  }).filter((row) => row.total > 0 || row.draftHours > 0);

  const filteredRows = rows
    .filter((row) => activeTab === "draft" ? row.status === "draft" : row.status === "preliminary")
    .filter((row) => {
      const haystack = `${row.project.name} ${row.client?.name || ""}`.toLowerCase();
      return !search || haystack.includes(search);
    });

  return groupInvoiceRows(filteredRows).filter((row) => matchesInvoiceReadinessFilter(row));
}

function groupInvoiceRows(rows) {
  const mode = document.querySelector("[data-invoice-viewmode].active")?.dataset.invoiceViewmode || "project";
  if (mode === "project") return rows;

  const grouped = Object.values(rows.reduce((acc, row) => {
    const key = mode === "client" ? row.client?.id || "unknown" : "collection";
    if (!acc[key]) {
      acc[key] = {
        ...row,
        id: key,
        sourceProjectIds: [row.id],
        project: { name: mode === "client" ? `Alla projekt för ${row.client?.name || "okänd kund"}` : "Samlingsprojekt" },
        fixedPrice: 0,
        hours: 0,
        draftHours: 0,
        hourlyValue: 0,
        articleValue: 0,
        supplierInvoices: 0,
        otherValue: 0,
        total: 0,
        warning: 0,
        blockedBreakdown: { entries: 0, receipts: 0, travels: 0 }
      };
    } else {
      acc[key].sourceProjectIds.push(row.id);
    }

    acc[key].fixedPrice += row.fixedPrice;
    acc[key].hours += row.hours;
    acc[key].draftHours += row.draftHours;
    acc[key].hourlyValue += row.hourlyValue;
    acc[key].articleValue += row.articleValue;
    acc[key].supplierInvoices += row.supplierInvoices;
    acc[key].otherValue += row.otherValue;
    acc[key].total += row.total;
    acc[key].warning += row.warning;
    acc[key].blockedBreakdown.entries += row.blockedBreakdown?.entries || 0;
    acc[key].blockedBreakdown.receipts += row.blockedBreakdown?.receipts || 0;
    acc[key].blockedBreakdown.travels += row.blockedBreakdown?.travels || 0;
    return acc;
  }, {}));

  return grouped;
}

function getInvoiceRowIssues(row) {
  const issues = [];
  if (row.warning > 0) issues.push(`${row.warning} rad${row.warning === 1 ? "" : "er"} behöver attest`);
  if (!row.client?.billingEmail && !row.client?.email) issues.push("Faktura-e-post saknas");
  if (!row.client?.invoiceReference) issues.push("Referens saknas");
  if (!row.client?.invoiceAddress) issues.push("Fakturaadress saknas");
  if (row.hours > 0 && !Number(row.client?.rate || 0)) issues.push("Timpris saknas");
  if (row.total <= 0) issues.push("Inget belopp");
  return issues;
}

function getInvoiceIssueChips(row) {
  const chips = [];
  const breakdown = row.blockedBreakdown || {};
  if (breakdown.entries) chips.push(`${breakdown.entries} tidsrad${breakdown.entries === 1 ? "" : "er"}`);
  if (breakdown.receipts) chips.push(`${breakdown.receipts} kvitto${breakdown.receipts === 1 ? "" : "n"}`);
  if (breakdown.travels) chips.push(`${breakdown.travels} resa${breakdown.travels === 1 ? "" : "or"}`);
  if (!row.client?.billingEmail && !row.client?.email) chips.push("E-post saknas");
  if (!row.client?.invoiceReference) chips.push("Referens saknas");
  if (!row.client?.invoiceAddress) chips.push("Adress saknas");
  if (row.hours > 0 && !Number(row.client?.rate || 0)) chips.push("Timpris saknas");
  if (row.total <= 0) chips.push("Inget belopp");
  return chips;
}

function isInvoiceRowReady(row) {
  const blockingIssues = getInvoiceRowIssues(row).filter((issue) => !["Referens saknas", "Fakturaadress saknas"].includes(issue));
  return row.total > 0 && blockingIssues.length === 0;
}

function getInvoiceReadinessLabel(row) {
  const issues = getInvoiceRowIssues(row);
  if (!issues.length) return "Klar";
  if (row.warning > 0) return "Attest krävs";
  if (!row.client?.billingEmail && !row.client?.email) return "Kunddata saknas";
  return "Kontrollera";
}

function getInvoiceReadinessBadge(row) {
  if (isInvoiceRowReady(row)) return "approved";
  if (row.warning > 0) return "submitted";
  return "rejected";
}

function matchesInvoiceReadinessFilter(row, filter = els.invoiceReadinessFilter?.value || "all") {
  if (filter === "all") return true;
  const issues = getInvoiceRowIssues(row);
  if (filter === "ready") return isInvoiceRowReady(row);
  if (filter === "blocked") return row.warning > 0;
  if (filter === "customer") return issues.some((issue) => issue.includes("saknas"));
  if (filter === "empty") return row.total <= 0;
  return true;
}

function getInvoiceWorkbenchTotals(rows) {
  const net = rows.reduce((sum, row) => sum + Number(row.total || 0), 0);
  const vatRate = normalizeNumber(state.settings?.vatRate ?? defaultState.settings.vatRate, 25);
  const vat = Math.round(net * (vatRate / 100));
  const readyRows = rows.filter(isInvoiceRowReady);
  const blockedRows = rows.filter((row) => row.warning > 0);
  const customerIssueRows = rows.filter((row) => getInvoiceRowIssues(row).some((issue) => issue.includes("saknas")));
  return {
    net,
    vat,
    gross: net + vat,
    vatRate,
    readyRows,
    blockedRows,
    customerIssueRows
  };
}

function isDateInRange(date, from, to) {
  if (from && date < from) return false;
  if (to && date > to) return false;
  return true;
}

function markProjectItemsInvoiced(project) {
  const from = els.invoiceFrom.value;
  const to = els.invoiceTo.value;
  state.entries.forEach((entry) => {
    const belongsToProject = entry.projectId === project.id || entry.workOrder === project.name;
    if (belongsToProject && entry.billable && isInvoiceReady(entry.status) && isDateInRange(entry.date, from, to)) {
      entry.status = "invoiced";
    }
  });
  state.receipts.forEach((receipt) => {
    if (receipt.projectId === project.id && receipt.billable && isInvoiceReady(receipt.status) && isDateInRange(receipt.date, from, to)) {
      receipt.status = "invoiced";
    }
  });
  state.travels.forEach((travel) => {
    if (travel.clientId === project.clientId && travel.billable && isInvoiceReady(travel.status) && isDateInRange(travel.date, from, to)) {
      travel.status = "invoiced";
    }
  });
}

function getInvoiceDetail(projectId) {
  const project = getProject(projectId);
  if (!project) return null;
  const client = getClient(project.clientId);
  const from = els.invoiceFrom.value;
  const to = els.invoiceTo.value;
  const entries = state.entries
    .filter((entry) => {
      const belongsToProject = entry.projectId === project.id || entry.workOrder === project.name;
      return belongsToProject && entry.billable && entry.status !== "invoiced" && isDateInRange(entry.date, from, to);
    })
    .sort((a, b) => a.date.localeCompare(b.date));
  const receipts = state.receipts
    .filter((receipt) => receipt.projectId === project.id && receipt.billable && receipt.status !== "invoiced" && isDateInRange(receipt.date, from, to))
    .sort((a, b) => a.date.localeCompare(b.date));
  const travels = state.travels
    .filter((travel) => travel.clientId === project.clientId && travel.billable && travel.status !== "invoiced" && isDateInRange(travel.date, from, to))
    .sort((a, b) => a.date.localeCompare(b.date));
  const approvedEntries = entries.filter((entry) => isInvoiceReady(entry.status));
  const approvedReceipts = receipts.filter((receipt) => isInvoiceReady(receipt.status));
  const approvedTravels = travels.filter((travel) => isInvoiceReady(travel.status));
  const hours = sumHours(approvedEntries);
  const fixedPrice = Number(project.fixedPrice || 0);
  const hourlyValue = hours * Number(client?.rate || 0);
  const receiptsValue = approvedReceipts.reduce((total, receipt) => total + Number(receipt.amount || 0), 0);
  const travelValue = approvedTravels.reduce((total, travel) => total + getTravelValue(travel), 0);
  const total = fixedPrice + hourlyValue + receiptsValue + travelValue;
  const warnings = [
    ...entries.filter((entry) => !isInvoiceReady(entry.status)).map((entry) => `${entry.date}: ${entry.task} är ${getApprovalStatusLabel(entry.status).toLowerCase()}`),
    ...receipts.filter((receipt) => !isInvoiceReady(receipt.status)).map((receipt) => `${receipt.date}: kvitto från ${receipt.supplier} är ${getApprovalStatusLabel(receipt.status).toLowerCase()}`),
    ...travels.filter((travel) => !isInvoiceReady(travel.status)).map((travel) => `${travel.date}: resa ${travel.from || "-"} till ${travel.to || "-"} är ${getApprovalStatusLabel(travel.status).toLowerCase()}`)
  ];

  return {
    project,
    client,
    from,
    to,
    entries,
    receipts,
    travels,
    approvedEntries,
    approvedReceipts,
    approvedTravels,
    hours,
    fixedPrice,
    hourlyValue,
    receiptsValue,
    travelValue,
    total,
    warnings
  };
}

function getInvoiceBlockedItems(detail) {
  if (!detail) return [];
  const blockedEntries = detail.entries
    .filter((entry) => !isInvoiceReady(entry.status))
    .map((entry) => ({
      kind: "entry",
      id: entry.id,
      projectId: detail.project.id,
      title: entry.task,
      subtitle: `${entry.date} · ${entry.employee} · ${formatHours(Number(entry.hours || 0))}`,
      value: formatSEK(Number(entry.hours || 0) * Number(detail.client?.rate || 0)),
      status: entry.status || "draft",
      category: "Tid",
      meta: entry.reviewNote || "Behöver attest innan faktura"
    }));
  const blockedReceipts = detail.receipts
    .filter((receipt) => !isInvoiceReady(receipt.status))
    .map((receipt) => ({
      kind: "receipt",
      id: receipt.id,
      projectId: detail.project.id,
      title: `Kvitto · ${receipt.supplier}`,
      subtitle: `${receipt.date} · ${getProject(receipt.projectId)?.name || detail.project.name}`,
      value: formatSEK(Number(receipt.amount || 0)),
      status: receipt.status || "draft",
      category: "Kvitto",
      meta: receipt.reviewNote || "Behöver attest innan faktura"
    }));
  const blockedTravels = detail.travels
    .filter((travel) => !isInvoiceReady(travel.status))
    .map((travel) => ({
      kind: "travel",
      id: travel.id,
      projectId: detail.project.id,
      title: travel.type === "allowance" ? "Traktamente" : "Milersättning",
      subtitle: `${travel.date} · ${travel.from || "-"} till ${travel.to || "-"}`,
      value: formatSEK(getTravelValue(travel)),
      status: travel.status || "draft",
      category: "Resa",
      meta: travel.reviewNote || "Behöver attest innan faktura"
    }));
  return [...blockedEntries, ...blockedReceipts, ...blockedTravels];
}

function getInvoiceRecordLines(invoice) {
  const client = getClient(invoice.clientId);
  const entryRows = (invoice.entryIds || []).map((id) => {
    const entry = state.entries.find((item) => item.id === id);
    if (!entry) return null;
    return {
      title: entry.task,
      subtitle: `${entry.date} · ${entry.employee} · ${formatHours(Number(entry.hours || 0))}`,
      value: formatSEK(Number(entry.hours || 0) * Number(client?.rate || 0)),
      category: "Tid",
      status: entry.status || "invoiced",
      meta: getClient(entry.clientId)?.name || getProject(entry.projectId)?.name || "Kundtid"
    };
  });
  const receiptRows = (invoice.receiptIds || []).map((id) => {
    const receipt = state.receipts.find((item) => item.id === id);
    if (!receipt) return null;
    return {
      title: `Kvitto · ${receipt.supplier}`,
      subtitle: `${receipt.date} · moms ${formatSEK(Number(receipt.vat || 0))}`,
      value: formatSEK(Number(receipt.amount || 0)),
      category: "Kvitto",
      status: receipt.status || "invoiced",
      meta: getProject(receipt.projectId)?.name || "Utlägg"
    };
  });
  const travelRows = (invoice.travelIds || []).map((id) => {
    const travel = state.travels.find((item) => item.id === id);
    if (!travel) return null;
    return {
      title: travel.type === "allowance" ? "Traktamente" : "Milersättning",
      subtitle: `${travel.date} · ${travel.from || "-"} till ${travel.to || "-"}`,
      value: formatSEK(getTravelValue(travel)),
      category: "Resa",
      status: travel.status || "invoiced",
      meta: getClient(travel.clientId)?.name || "Resa"
    };
  });
  return [...entryRows, ...receiptRows, ...travelRows].filter(Boolean);
}

function renderInvoiceReadyChecklist(detail, meta) {
  const checks = [
    { label: "Faktura-e-post", ok: Boolean(meta.billingEmail), note: meta.billingEmail || "Saknas" },
    { label: "Referens", ok: Boolean(meta.invoiceReference), note: meta.invoiceReference || "Saknas" },
    { label: "Fakturaadress", ok: Boolean(meta.invoiceAddress), note: meta.invoiceAddress || "Saknas" },
    { label: "Attesterade rader", ok: detail.total > 0, note: formatSEK(detail.total) },
    { label: "Bankgiro", ok: Boolean(meta.bankgiro), note: meta.bankgiro || "Saknas" },
    { label: `Moms ${meta.vatRate}%`, ok: meta.vatRate >= 0, note: formatSEK(meta.vat) }
  ];
  return `
    <div class="invoice-ready-list">
      ${checks.map((check) => `
        <div class="${check.ok ? "ready" : "blocked"}">
          <span>${check.ok ? "✓" : "!"}</span>
          <strong>${escapeHtml(check.label)}</strong>
          <small>${escapeHtml(check.note)}</small>
        </div>
      `).join("")}
    </div>
  `;
}

function renderInvoiceFlowSteps(steps) {
  return `
    <div class="invoice-flow-steps">
      ${steps.map((step) => `
        <div class="${step.state || ""}">
          <span>${escapeHtml(step.index || "")}</span>
          <strong>${escapeHtml(step.title)}</strong>
          <small>${escapeHtml(step.note || "")}</small>
        </div>
      `).join("")}
    </div>
  `;
}

function getInvoiceDraftFlowSteps(detail, meta, blockedItems) {
  const customerReady = Boolean(meta.billingEmail);
  const lineReady = detail.total > 0;
  const attestReady = blockedItems.length === 0;
  const createReady = customerReady && lineReady && attestReady && (!detail.hours || Number(detail.client?.rate || 0));
  return [
    {
      index: "1",
      title: "Kunddata",
      note: customerReady ? "Faktura-e-post finns" : "Komplettera e-post innan utskick",
      state: customerReady ? "done" : "active"
    },
    {
      index: "2",
      title: "Rader",
      note: lineReady ? `${formatSEK(detail.total)} i underlag` : "Inga attesterade rader",
      state: lineReady ? "done" : "active"
    },
    {
      index: "3",
      title: "Attest",
      note: attestReady ? "Alla rader är klara" : `${blockedItems.length} rad${blockedItems.length === 1 ? "" : "er"} behöver attest`,
      state: attestReady ? "done" : "active"
    },
    {
      index: "4",
      title: "Skapa faktura",
      note: createReady ? "Redo att skapa underlag" : "Väntar på komplettering",
      state: createReady ? "ready" : ""
    }
  ];
}

function getInvoiceRecordFlowSteps(invoice, status) {
  return [
    {
      index: "1",
      title: "Skapad",
      note: invoice.createdAt || "-",
      state: "done"
    },
    {
      index: "2",
      title: "Skickad",
      note: invoice.sentAt || invoice.portalSharedAt || "Inte skickad",
      state: invoice.sentAt || invoice.portalSharedAt ? "done" : "active"
    },
    {
      index: "3",
      title: "Kund",
      note: status === "changeRequested" ? "Ändring begärd" : invoice.customerApprovedAt ? "Godkänd av kund" : "Väntar på svar",
      state: status === "changeRequested" ? "blocked" : invoice.customerApprovedAt ? "done" : ""
    },
    {
      index: "4",
      title: "Betalning",
      note: invoice.paidAt ? `Betald ${invoice.paidAt}` : invoice.dueDate ? `Förfaller ${invoice.dueDate}` : "Ej betald",
      state: status === "paid" ? "ready" : status === "overdue" ? "blocked" : ""
    }
  ];
}

function renderInvoiceLineRows(lines, emptyText = "Inga rader") {
  if (!lines.length) {
    return `<div class="empty-state compact-empty"><span>${escapeHtml(emptyText)}</span></div>`;
  }
  return lines.map((line) => `
    <div class="compact-row invoice-line-row">
      <button class="clickable-row" type="button" ${line.editKind ? `data-edit-${line.editKind}="${line.id}"` : ""}>
        <strong>${escapeHtml(line.title)}</strong>
        <span>${escapeHtml(line.subtitle)}</span>
        ${line.meta ? `<small>${escapeHtml(line.meta)}</small>` : ""}
      </button>
      <div class="invoice-line-actions">
        <strong>${escapeHtml(line.value)}</strong>
        ${line.category ? `<span class="invoice-line-chip">${escapeHtml(line.category)}</span>` : ""}
        ${line.status ? `<span class="badge ${getApprovalBadgeClass(line.status)}">${escapeHtml(getApprovalStatusLabel(line.status))}</span>` : ""}
        ${line.excludeKind ? `<button class="ghost-button small-button" type="button" data-invoice-line-exclude="${line.excludeKind}" data-invoice-line-id="${line.id}" data-invoice-project-id="${line.projectId}">Ta bort</button>` : ""}
        ${line.approveKind ? `<button class="ghost-button small-button" type="button" data-invoice-line-approve="${line.approveKind}" data-invoice-line-id="${line.id}" data-invoice-project-id="${line.projectId}">Attestera</button>` : ""}
      </div>
    </div>
  `).join("");
}

function saveInvoiceDraft(projectId) {
  const project = getProject(projectId);
  if (!project) return false;
  project.invoiceStatus = "draft";
  return true;
}

function updateInvoiceSettings(form) {
  const project = getProject(form.dataset.invoiceSettingsForm);
  if (!project) return false;
  const data = new FormData(form);
  project.fixedPrice = Math.max(0, normalizeNumber(data.get("fixedPrice"), 0));
  project.invoicePaymentTerms = String(data.get("paymentTerms") || "").trim();
  project.invoiceVatRate = String(data.get("vatRate") || "").trim();
  project.invoiceText = String(data.get("invoiceText") || "").trim();
  project.invoiceStatus = "draft";
  saveState();
  renderAll();
  openInvoiceDetail(project.id);
  showToast("Fakturainställningarna sparades som utkast.");
  return true;
}

function updateStoredInvoiceSettings(form) {
  const invoice = (state.invoices || []).find((item) => item.id === form.dataset.storedInvoiceSettingsForm);
  if (!invoice) return false;
  if (["paid", "credited", "reopened"].includes(invoice.status)) {
    showToast("Stängda fakturor kan inte ändras. Kreditera eller återöppna underlaget istället.", "warning");
    return false;
  }
  const data = new FormData(form);
  const paymentTerms = Math.max(0, Number(data.get("paymentTerms") || invoice.paymentTerms || 0));
  const vatRate = Math.max(0, normalizeNumber(data.get("vatRate"), invoice.vatRate || 0));
  const netTotal = Number(invoice.total || 0);
  const vat = Math.round(netTotal * (vatRate / 100));
  const dueDate = String(data.get("dueDate") || "").trim() || addDaysToISO(invoice.createdAt || isoToday, paymentTerms);

  invoice.billingEmail = String(data.get("billingEmail") || "").trim();
  invoice.invoiceReference = String(data.get("invoiceReference") || "").trim();
  invoice.invoiceAddress = String(data.get("invoiceAddress") || "").trim();
  invoice.paymentTerms = paymentTerms;
  invoice.vatRate = vatRate;
  invoice.dueDate = dueDate;
  invoice.bankgiro = String(data.get("bankgiro") || "").trim();
  invoice.invoiceText = String(data.get("invoiceText") || "").trim();
  invoice.vat = vat;
  invoice.totalInclVat = netTotal + vat;
  invoice.documentHtml = buildStoredInvoiceDocument(invoice);
  addInvoiceEvent(invoice, "Fakturauppgifter uppdaterade", `Förfallodatum ${invoice.dueDate} · ${formatSEK(invoice.totalInclVat)}`);

  const task = (state.portalTasks || []).find((item) => item.id === invoice.portalTaskId || item.invoiceId === invoice.id);
  if (task && invoice.portalSharedAt) {
    addPortalTaskComment(task, `Faktura ${invoice.number} uppdaterades av byrån.`);
  }

  saveState();
  renderAll();
  openInvoiceRecordDetail(invoice.id);
  showToast("Fakturauppgifterna uppdaterades och dokumentet byggdes om.");
  return true;
}

function createInvoiceFromProject(projectId) {
  const project = getProject(projectId);
  if (!project) return null;
  const record = createInvoiceRecord(project);
  if (!record) return null;
  project.invoiceStatus = "created";
  markProjectItemsInvoiced(project);
  return record;
}

function approveInvoiceLine(kind, id) {
  const collections = {
    entry: state.entries,
    receipt: state.receipts,
    travel: state.travels
  };
  const item = collections[kind]?.find((candidate) => candidate.id === id);
  if (!item || item.status === "invoiced") return false;
  item.status = "approved";
  item.reviewNote = "";
  return true;
}

function approveInvoiceBlockedItems(projectId) {
  const detail = getInvoiceDetail(projectId);
  if (!detail) return 0;
  return getInvoiceBlockedItems(detail).reduce((count, item) => approveInvoiceLine(item.kind, item.id) ? count + 1 : count, 0);
}

function getInvoiceProjectIdsFromRows(rows) {
  return [...new Set(rows.flatMap((row) => row.sourceProjectIds || [row.id]))]
    .filter((projectId) => Boolean(getProject(projectId)));
}

function saveInvoiceDraftsFromRows(rows) {
  return getInvoiceProjectIdsFromRows(rows).reduce((count, projectId) => saveInvoiceDraft(projectId) ? count + 1 : count, 0);
}

function approveInvoiceBlockedFromRows(rows) {
  return getInvoiceProjectIdsFromRows(rows).reduce((count, projectId) => count + approveInvoiceBlockedItems(projectId), 0);
}

function createInvoicesFromRows(rows) {
  const createdRecords = [];
  getInvoiceProjectIdsFromRows(rows).forEach((projectId) => {
    const record = createInvoiceFromProject(projectId);
    if (record) createdRecords.push(record);
  });
  return createdRecords;
}

function openInvoiceDetail(projectId) {
  const detail = getInvoiceDetail(projectId);
  if (!detail) {
    showToast("Fakturaunderlaget kunde inte öppnas.", "warning");
    return;
  }
  const meta = getInvoiceMeta(detail);
  const blockedItems = getInvoiceBlockedItems(detail);
  const canCreateInvoice = detail.total > 0
    && blockedItems.length === 0
    && Boolean(meta.billingEmail)
    && (!detail.hours || Number(detail.client?.rate || 0));
  const approvedLines = [
    ...detail.approvedEntries.map((entry) => ({
      id: entry.id,
      editKind: "entry",
      excludeKind: "entry",
      projectId: detail.project.id,
      title: entry.task,
      subtitle: `${entry.date} · ${entry.employee} · ${formatHours(Number(entry.hours || 0))}`,
      value: formatSEK(Number(entry.hours || 0) * Number(detail.client?.rate || 0)),
      category: "Tid",
      meta: entry.description || detail.client?.name || "Debiterbar tid"
    })),
    ...detail.approvedReceipts.map((receipt) => ({
      id: receipt.id,
      editKind: "receipt",
      excludeKind: "receipt",
      projectId: detail.project.id,
      title: `Kvitto · ${receipt.supplier}`,
      subtitle: `${receipt.date} · moms ${formatSEK(Number(receipt.vat || 0))}`,
      value: formatSEK(Number(receipt.amount || 0)),
      category: "Kvitto",
      meta: receipt.fileName || "Vidarefakturerat utlägg"
    })),
    ...detail.approvedTravels.map((travel) => ({
      id: travel.id,
      editKind: "travel",
      excludeKind: "travel",
      projectId: detail.project.id,
      title: travel.type === "allowance" ? "Traktamente" : "Milersättning",
      subtitle: `${travel.date} · ${travel.from || "-"} till ${travel.to || "-"}`,
      value: formatSEK(getTravelValue(travel)),
      category: "Resa",
      meta: travel.purpose || "Resa och traktamente"
    }))
  ];

  setDrawerContent({
    eyebrow: "Fakturaunderlag",
    title: detail.project.name,
    body: `
      <div class="drawer-list">
        <article class="drawer-list-item">
          <div>
            <strong>${escapeHtml(detail.client?.name || "Okänd kund")}</strong>
            <span>${escapeHtml(detail.client?.org || "Org.nr saknas")} · ${escapeHtml(meta.billingEmail || "Ingen faktura-e-post")}</span>
          </div>
          <span class="badge ${detail.project.invoiceStatus === "draft" ? "draft" : "approved"}">${detail.project.invoiceStatus === "draft" ? "Utkast" : "Preliminärt"}</span>
        </article>
      </div>
      ${renderInvoiceFlowSteps(getInvoiceDraftFlowSteps(detail, meta, blockedItems))}
      ${renderInvoiceReadyChecklist(detail, meta)}
      ${detail.warnings.length ? `
        <div class="info-banner warning-banner">
          ${detail.warnings.slice(0, 4).map((warning) => `<div>${escapeHtml(warning)}</div>`).join("")}
        </div>
      ` : ""}
      <div class="client-detail-metrics drawer-metrics">
        <div><span>Fastpris</span><strong>${formatSEK(detail.fixedPrice)}</strong></div>
        <div><span>Timmar</span><strong>${formatHours(detail.hours)}</strong></div>
        <div><span>Kvitton</span><strong>${formatSEK(detail.receiptsValue)}</strong></div>
        <div><span>Resor</span><strong>${formatSEK(detail.travelValue)}</strong></div>
        <div><span>Totalt</span><strong>${formatSEK(detail.total)}</strong></div>
        <div><span>Varningar</span><strong>${detail.warnings.length}</strong></div>
      </div>
      <div class="invoice-meta-box">
        <div><span>Fakturanummer</span><strong>${escapeHtml(meta.invoiceNumber)}</strong></div>
        <div><span>Betalvillkor</span><strong>${meta.paymentTerms} dagar</strong></div>
        <div><span>Moms</span><strong>${formatSEK(meta.vat)}</strong></div>
        <div><span>Att betala</span><strong>${formatSEK(meta.totalInclVat)}</strong></div>
        <div><span>Referens</span><strong>${escapeHtml(meta.invoiceReference || "Ej angiven")}</strong></div>
        <div><span>Bankgiro</span><strong>${escapeHtml(meta.bankgiro || "Ej angivet")}</strong></div>
      </div>
      <form class="invoice-settings-form" data-invoice-settings-form="${detail.project.id}">
        <div>
          <label>Fastpris
            <input name="fixedPrice" type="number" min="0" step="100" value="${Number(detail.project.fixedPrice || 0)}">
          </label>
          <label>Betalvillkor
            <input name="paymentTerms" type="number" min="0" step="1" value="${escapeHtml(String(detail.project.invoicePaymentTerms || meta.paymentTerms))}">
          </label>
          <label>Moms %
            <input name="vatRate" type="number" min="0" step="1" value="${escapeHtml(String(detail.project.invoiceVatRate || meta.vatRate))}">
          </label>
        </div>
        <label>Fakturatext
          <textarea name="invoiceText" rows="3" placeholder="Ex. Avser löpande redovisning, rådgivning och avstämningar för vald period.">${escapeHtml(detail.project.invoiceText || "")}</textarea>
        </label>
        <button class="ghost-button small-button" type="submit">Spara fakturainställningar</button>
      </form>
      <div class="invoice-detail-list">
        <h3>Klara fakturarader</h3>
        ${renderInvoiceLineRows(approvedLines, "Inga attesterade rader")}
        <h3>Ej klara för faktura</h3>
        ${renderInvoiceLineRows(blockedItems.map((item) => ({ ...item, approveKind: item.kind })), "Inga spärrade rader")}
      </div>
      <div class="drawer-actions">
        <button class="ghost-button" type="button" data-edit-client="${detail.client?.id || ""}">Redigera fakturauppgifter</button>
        <button class="ghost-button" type="button" data-invoice-draft="${detail.project.id}">Spara utkast</button>
        <button class="ghost-button" type="button" data-invoice-preview="${detail.project.id}">Förhandsgranska</button>
        <button class="ghost-button" type="button" data-invoice-download="${detail.project.id}">Ladda ner</button>
        ${blockedItems.length ? `<button class="ghost-button" type="button" data-invoice-open-approval="${detail.project.id}">Öppna attestflöde</button>` : ""}
        ${blockedItems.length ? `<button class="ghost-button" type="button" data-invoice-approve-blocked="${detail.project.id}">Snabbattestera spärrade</button>` : ""}
        <button class="primary-button" type="button" data-invoice-create="${detail.project.id}" ${canCreateInvoice ? "" : "disabled"}>Skapa fakturaunderlag</button>
      </div>
    `
  });
}

function getInvoiceMeta(detail, override = {}) {
  const settings = state.settings || defaultState.settings;
  const client = detail.client || {};
  const project = detail.project || {};
  const paymentTermsCandidate = override.paymentTerms ?? project.invoicePaymentTerms ?? client.paymentTerms;
  const vatRateCandidate = override.vatRate ?? project.invoiceVatRate ?? client.vatRate;
  const paymentTermsValue = paymentTermsCandidate === "" || paymentTermsCandidate == null ? (settings.paymentTerms || 10) : paymentTermsCandidate;
  const vatRateValue = vatRateCandidate === "" || vatRateCandidate == null ? (settings.vatRate ?? 25) : vatRateCandidate;
  const paymentTerms = Math.max(0, Number(paymentTermsValue));
  const vatRate = Math.max(0, normalizeNumber(vatRateValue, 25));
  const invoiceNumber = override.number || override.invoiceNumber || `${settings.invoicePrefix || "F"}-${new Date().getFullYear()}-${String(settings.nextInvoiceNumber || 1).padStart(4, "0")}`;
  const createdAt = override.createdAt || isoToday;
  const dueDate = override.dueDate || offsetDate(paymentTerms);
  const vat = Math.round(detail.total * (vatRate / 100));

  return {
    invoiceNumber,
    createdAt,
    dueDate,
    paymentTerms,
    vatRate,
    netTotal: detail.total,
    vat,
    totalInclVat: detail.total + vat,
    billingEmail: override.billingEmail || client.billingEmail || client.email || "",
    invoiceReference: override.invoiceReference || client.invoiceReference || "",
    invoiceAddress: override.invoiceAddress || client.invoiceAddress || "",
    bankgiro: override.bankgiro || settings.bankgiro || "",
    invoiceFooter: override.invoiceFooter || settings.invoiceFooter || "",
    invoiceText: override.invoiceText ?? project.invoiceText ?? ""
  };
}

function buildInvoiceDocument(projectId, override = {}) {
  const detail = getInvoiceDetail(projectId);
  if (!detail) return "";
  const settings = state.settings || defaultState.settings;
  const meta = getInvoiceMeta(detail, override);
  const rows = [
    detail.fixedPrice ? { label: `Fastpris ${detail.project.name}`, qty: "1", unit: formatSEK(detail.fixedPrice), amount: detail.fixedPrice } : null,
    detail.hourlyValue ? { label: `Arvode, ${formatHours(detail.hours)} à ${formatSEK(Number(detail.client?.rate || 0))}`, qty: formatHours(detail.hours), unit: formatSEK(Number(detail.client?.rate || 0)), amount: detail.hourlyValue } : null,
    detail.receiptsValue ? { label: "Vidarefakturerade kvitton/utlägg", qty: String(detail.approvedReceipts.length), unit: "-", amount: detail.receiptsValue } : null,
    detail.travelValue ? { label: "Resor och traktamenten", qty: String(detail.approvedTravels.length), unit: "-", amount: detail.travelValue } : null
  ].filter(Boolean);

  return `<!doctype html>
<html lang="sv">
<head>
  <meta charset="utf-8">
  <title>Faktura ${meta.invoiceNumber} | ${escapeHtml(detail.client?.name || "Kund")}</title>
  <style>
    body { margin: 0; background: #f4f3ef; color: #1f2528; font-family: Arial, sans-serif; }
    .invoice { max-width: 860px; margin: 32px auto; padding: 48px; background: #fff; box-shadow: 0 18px 50px rgba(0,0,0,.12); }
    .top { display: flex; justify-content: space-between; gap: 28px; margin-bottom: 34px; }
    h1 { margin: 0; font-size: 34px; }
    h2 { margin: 26px 0 10px; font-size: 18px; }
    p { line-height: 1.5; }
    .brand { color: #5c238d; font-weight: 800; }
    .box { border: 1px solid #ddd; border-radius: 6px; padding: 14px; }
    table { width: 100%; border-collapse: collapse; margin-top: 18px; }
    th, td { padding: 12px 10px; border-bottom: 1px solid #ddd; text-align: left; }
    th:last-child, td:last-child { text-align: right; }
    .totals { width: min(340px, 100%); margin-left: auto; margin-top: 20px; }
    .totals div { display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #ddd; }
    .total { font-size: 20px; font-weight: 800; }
    @media print { body { background: #fff; } .invoice { margin: 0; box-shadow: none; max-width: none; } }
  </style>
</head>
<body>
  <main class="invoice">
    <section class="top">
      <div>
        <p class="brand">${escapeHtml(settings.companyName || "Novadex Tid & Löner")}</p>
        <h1>Faktura</h1>
        <p>Fakturanummer ${meta.invoiceNumber}<br>Fakturadatum ${meta.createdAt}<br>Förfallodatum ${meta.dueDate}<br>Betalvillkor ${meta.paymentTerms} dagar</p>
      </div>
      <div class="box">
        <strong>${escapeHtml(detail.client?.name || "Okänd kund")}</strong>
        <p>Org.nr: ${escapeHtml(detail.client?.org || "Ej angivet")}<br>Faktura e-post: ${escapeHtml(meta.billingEmail || "Ej angiven")}${meta.invoiceReference ? `<br>Referens: ${escapeHtml(meta.invoiceReference)}` : ""}${meta.invoiceAddress ? `<br>Adress: ${escapeHtml(meta.invoiceAddress)}` : ""}</p>
      </div>
    </section>
    <h2>${escapeHtml(detail.project.name)}</h2>
    <p>Period: ${escapeHtml(detail.from || "start")} till ${escapeHtml(detail.to || "idag")}</p>
    ${meta.invoiceText ? `<p>${escapeHtml(meta.invoiceText)}</p>` : ""}
    <table>
      <thead><tr><th>Rad</th><th>Antal</th><th>Pris</th><th>Belopp</th></tr></thead>
      <tbody>
        ${rows.map((row) => `<tr><td>${escapeHtml(row.label)}</td><td>${escapeHtml(row.qty)}</td><td>${escapeHtml(row.unit)}</td><td>${formatSEK(row.amount)}</td></tr>`).join("")}
      </tbody>
    </table>
    <section class="totals">
      <div><span>Netto</span><strong>${formatSEK(meta.netTotal)}</strong></div>
      <div><span>Moms ${meta.vatRate}%</span><strong>${formatSEK(meta.vat)}</strong></div>
      <div class="total"><span>Att betala</span><strong>${formatSEK(meta.totalInclVat)}</strong></div>
    </section>
    <p>Betalas till bankgiro ${escapeHtml(meta.bankgiro || "ej angivet")}.</p>
    ${meta.invoiceFooter ? `<p>${escapeHtml(meta.invoiceFooter)}</p>` : ""}
  </main>
</body>
</html>`;
}

function getStoredInvoiceDocumentRows(invoice) {
  const client = getClient(invoice.clientId);
  const rows = [];
  (invoice.entryIds || []).forEach((id) => {
    const entry = state.entries.find((item) => item.id === id);
    if (!entry) return;
    rows.push({
      label: entry.task || "Tid",
      description: `${entry.date || "-"} · ${entry.employee || "-"} · ${formatHours(Number(entry.hours || 0))}`,
      amount: Number(entry.hours || 0) * Number(client?.rate || 0)
    });
  });
  (invoice.receiptIds || []).forEach((id) => {
    const receipt = state.receipts.find((item) => item.id === id);
    if (!receipt) return;
    rows.push({
      label: `Kvitto · ${receipt.supplier || "Utlägg"}`,
      description: `${receipt.date || "-"} · moms ${formatSEK(Number(receipt.vat || 0))}`,
      amount: Number(receipt.amount || 0)
    });
  });
  (invoice.travelIds || []).forEach((id) => {
    const travel = state.travels.find((item) => item.id === id);
    if (!travel) return;
    rows.push({
      label: travel.type === "allowance" ? "Traktamente" : "Milersättning",
      description: `${travel.date || "-"} · ${travel.from || "-"} till ${travel.to || "-"}`,
      amount: getTravelValue(travel)
    });
  });
  const represented = rows.reduce((sum, row) => sum + Number(row.amount || 0), 0);
  const remainder = Number(invoice.total || 0) - represented;
  if (remainder > 0.5) {
    rows.push({
      label: "Fastpris / övrigt",
      description: getProject(invoice.projectId)?.name || "Fakturaunderlag",
      amount: remainder
    });
  }
  return rows;
}

function buildStoredInvoiceDocument(invoice) {
  const client = getClient(invoice.clientId);
  const project = getProject(invoice.projectId);
  const settings = state.settings || defaultState.settings;
  const rows = getStoredInvoiceDocumentRows(invoice);
  return `<!doctype html>
<html lang="sv">
<head>
  <meta charset="utf-8">
  <title>Faktura ${escapeHtml(invoice.number)} | ${escapeHtml(client?.name || "Kund")}</title>
  <style>
    body { margin: 0; background: #f4f3ef; color: #1f2528; font-family: Arial, sans-serif; }
    .invoice { max-width: 860px; margin: 32px auto; padding: 48px; background: #fff; box-shadow: 0 18px 50px rgba(0,0,0,.12); }
    .top { display: flex; justify-content: space-between; gap: 28px; margin-bottom: 34px; }
    h1 { margin: 0; font-size: 34px; }
    h2 { margin: 26px 0 10px; font-size: 18px; }
    p { line-height: 1.5; }
    .brand { color: #5c238d; font-weight: 800; }
    .box { border: 1px solid #ddd; border-radius: 6px; padding: 14px; }
    table { width: 100%; border-collapse: collapse; margin-top: 18px; }
    th, td { padding: 12px 10px; border-bottom: 1px solid #ddd; text-align: left; }
    th:last-child, td:last-child { text-align: right; }
    .totals { width: min(340px, 100%); margin-left: auto; margin-top: 20px; }
    .totals div { display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #ddd; }
    .total { font-size: 20px; font-weight: 800; }
    @media print { body { background: #fff; } .invoice { margin: 0; box-shadow: none; max-width: none; } }
  </style>
</head>
<body>
  <main class="invoice">
    <section class="top">
      <div>
        <p class="brand">${escapeHtml(settings.companyName || "Novadex Tid & Löner")}</p>
        <h1>Faktura</h1>
        <p>Fakturanummer ${escapeHtml(invoice.number)}<br>Fakturadatum ${invoice.createdAt || "-"}<br>Förfallodatum ${invoice.dueDate || "-"}<br>Betalvillkor ${invoice.paymentTerms || 0} dagar</p>
      </div>
      <div class="box">
        <strong>${escapeHtml(client?.name || "Okänd kund")}</strong>
        <p>Org.nr: ${escapeHtml(client?.org || "Ej angivet")}<br>Faktura e-post: ${escapeHtml(invoice.billingEmail || client?.billingEmail || client?.email || "Ej angiven")}${invoice.invoiceReference ? `<br>Referens: ${escapeHtml(invoice.invoiceReference)}` : ""}${invoice.invoiceAddress ? `<br>Adress: ${escapeHtml(invoice.invoiceAddress)}` : ""}</p>
      </div>
    </section>
    <h2>${escapeHtml(project?.name || "Fakturaunderlag")}</h2>
    ${invoice.invoiceText ? `<p>${escapeHtml(invoice.invoiceText)}</p>` : ""}
    <table>
      <thead><tr><th>Rad</th><th>Beskrivning</th><th>Belopp</th></tr></thead>
      <tbody>
        ${rows.map((row) => `<tr><td>${escapeHtml(row.label)}</td><td>${escapeHtml(row.description)}</td><td>${formatSEK(row.amount)}</td></tr>`).join("")}
      </tbody>
    </table>
    <section class="totals">
      <div><span>Netto</span><strong>${formatSEK(Number(invoice.total || 0))}</strong></div>
      <div><span>Moms ${invoice.vatRate || 0}%</span><strong>${formatSEK(Number(invoice.vat || 0))}</strong></div>
      <div class="total"><span>Att betala</span><strong>${formatSEK(Number(invoice.totalInclVat || invoice.total || 0))}</strong></div>
    </section>
    <p>Betalas till bankgiro ${escapeHtml(invoice.bankgiro || settings.bankgiro || "ej angivet")}.</p>
    ${settings.invoiceFooter ? `<p>${escapeHtml(settings.invoiceFooter)}</p>` : ""}
  </main>
</body>
</html>`;
}

function previewInvoiceDocument(projectId) {
  const documentHtml = buildInvoiceDocument(projectId);
  if (!documentHtml) return;
  const url = URL.createObjectURL(new Blob([documentHtml], { type: "text/html;charset=utf-8" }));
  window.open(url, "_blank", "noopener,noreferrer");
  window.setTimeout(() => URL.revokeObjectURL(url), 15000);
}

function downloadInvoiceDocument(projectId) {
  const detail = getInvoiceDetail(projectId);
  const documentHtml = buildInvoiceDocument(projectId);
  if (!detail || !documentHtml) return;
  const fileName = `faktura-${detail.project.name}`.toLowerCase()
    .replaceAll("å", "a")
    .replaceAll("ä", "a")
    .replaceAll("ö", "o")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  const url = URL.createObjectURL(new Blob([documentHtml], { type: "text/html;charset=utf-8" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = `${fileName || "faktura"}.html`;
  link.click();
  URL.revokeObjectURL(url);
}

function downloadStoredInvoiceDocument(invoiceId) {
  const invoice = (state.invoices || []).find((item) => item.id === invoiceId);
  if (!invoice?.documentHtml) {
    showToast("Fakturadokumentet saknas.", "warning");
    return false;
  }
  const fileName = `faktura-${invoice.number}`.toLowerCase()
    .replaceAll("å", "a")
    .replaceAll("ä", "a")
    .replaceAll("ö", "o")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  const url = URL.createObjectURL(new Blob([invoice.documentHtml], { type: "text/html;charset=utf-8" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = `${fileName || "faktura"}.html`;
  link.click();
  URL.revokeObjectURL(url);
  return true;
}

function createInvoiceRecord(project) {
  const detail = getInvoiceDetail(project.id);
  if (!detail || detail.total <= 0) return null;
  const existing = (state.invoices || []).find((invoice) => invoice.projectId === project.id && !["credited", "reopened"].includes(invoice.status));
  const meta = getInvoiceMeta(detail, existing || {});
  const record = {
    id: existing?.id || makeId(),
    number: meta.invoiceNumber,
    projectId: project.id,
    clientId: project.clientId,
    createdAt: meta.createdAt,
    dueDate: meta.dueDate,
    paymentTerms: meta.paymentTerms,
    vatRate: meta.vatRate,
    invoiceText: meta.invoiceText,
    total: meta.netTotal,
    vat: meta.vat,
    totalInclVat: meta.totalInclVat,
    billingEmail: meta.billingEmail,
    invoiceReference: meta.invoiceReference,
    invoiceAddress: meta.invoiceAddress,
    bankgiro: meta.bankgiro,
    status: existing?.status || "created",
    sentAt: existing?.sentAt || "",
    portalSharedAt: existing?.portalSharedAt || "",
    portalTaskId: existing?.portalTaskId || "",
    customerApprovedAt: existing?.customerApprovedAt || "",
    customerApprovedBy: existing?.customerApprovedBy || "",
    changeRequestedAt: existing?.changeRequestedAt || "",
    changeRequestedBy: existing?.changeRequestedBy || "",
    changeRequestMessage: existing?.changeRequestMessage || "",
    paidAt: existing?.paidAt || "",
    creditedAt: existing?.creditedAt || "",
    reopenedAt: existing?.reopenedAt || "",
    events: existing?.events || [],
    entryIds: detail.approvedEntries.map((entry) => entry.id),
    receiptIds: detail.approvedReceipts.map((receipt) => receipt.id),
    travelIds: detail.approvedTravels.map((travel) => travel.id),
    documentHtml: buildInvoiceDocument(project.id, meta)
  };
  addInvoiceEvent(record, existing ? "Faktura uppdaterad" : "Faktura skapad", `${project.name} · ${formatSEK(record.totalInclVat || record.total || 0)}`);
  state.invoices = existing
    ? state.invoices.map((invoice) => invoice.id === existing.id ? record : invoice)
    : [record, ...(state.invoices || [])];
  if (!existing) {
    state.settings.nextInvoiceNumber = Math.max(1, Number(state.settings.nextInvoiceNumber || 1)) + 1;
  }
  return record;
}

function reopenInvoice(invoiceId) {
  const invoice = (state.invoices || []).find((item) => item.id === invoiceId);
  if (!invoice || invoice.status === "paid") {
    showToast("Betalda fakturor behöver krediteras istället för att återöppnas.", "warning");
    return false;
  }

  (invoice.entryIds || []).forEach((id) => {
    const entry = state.entries.find((item) => item.id === id);
    if (entry?.status === "invoiced") entry.status = "approved";
  });
  (invoice.receiptIds || []).forEach((id) => {
    const receipt = state.receipts.find((item) => item.id === id);
    if (receipt?.status === "invoiced") receipt.status = "approved";
  });
  (invoice.travelIds || []).forEach((id) => {
    const travel = state.travels.find((item) => item.id === id);
    if (travel?.status === "invoiced") travel.status = "approved";
  });

  const project = getProject(invoice.projectId);
  if (project) project.invoiceStatus = "draft";
  invoice.status = "reopened";
  invoice.reopenedAt = isoToday;
  addInvoiceEvent(invoice, "Faktura återöppnad", "Kopplade rader släpptes tillbaka till fakturering.");
  return true;
}

function setInvoiceStatus(invoiceId, status) {
  const invoice = (state.invoices || []).find((item) => item.id === invoiceId);
  if (!invoice) return false;
  if (invoice.status === "paid" && status !== "credited") {
    showToast("Betalda fakturor kan bara krediteras eller lämnas som betalda.", "warning");
    return false;
  }
  invoice.status = status;
  if (status === "sent") invoice.sentAt = isoToday;
  if (status === "paid") invoice.paidAt = isoToday;
  if (status === "credited") invoice.creditedAt = isoToday;
  if (status === "customerApproved") invoice.customerApprovedAt = isoToday;
  if (status === "changeRequested") invoice.changeRequestedAt = isoToday;
  if (status === "changeRequested" && !invoice.changeRequestMessage) {
    invoice.changeRequestMessage = "Ändring begärd av byrån.";
  }
  if (status === "changeRequested" && !(state.portalTasks || []).some((task) => task.id === invoice.portalTaskId || task.invoiceId === invoice.id)) {
    const task = createInvoicePortalTask(invoice, invoice.changeRequestMessage);
    invoice.portalTaskId = task.id;
  }
  addInvoiceEvent(invoice, `Status: ${getInvoiceStatusLabel(status)}`, getInvoiceNextAction(invoice).detail);
  syncInvoicePortalTask(invoice, status);
  return true;
}

function syncInvoicePortalTask(invoice, status = getEffectiveInvoiceStatus(invoice)) {
  const task = (state.portalTasks || []).find((item) => item.id === invoice.portalTaskId || item.invoiceId === invoice.id);
  if (!task) return;

  if (status === "sent" || status === "overdue") {
    task.status = task.status === "done" ? "open" : task.status;
    task.waitingOn = "customer";
    addPortalTaskComment(task, `Faktura ${invoice.number} väntar på kundens granskning.`);
  }

  if (status === "customerApproved") {
    task.status = "submitted";
    task.waitingOn = "office";
    addPortalTaskComment(task, `Kunden godkände faktura ${invoice.number}.`);
  }

  if (status === "changeRequested") {
    task.status = "open";
    task.waitingOn = "office";
    addPortalTaskComment(task, `Ändring begärd på faktura ${invoice.number}: ${invoice.changeRequestMessage || "Se fakturakortet."}`);
  }

  if (status === "paid") {
    task.status = "done";
    task.completedAt = isoToday;
    task.waitingOn = "";
    addPortalTaskComment(task, `Faktura ${invoice.number} markerades som betald.`);
  }
}

function excludeInvoiceLine(kind, id, projectId) {
  const collections = {
    entry: state.entries,
    receipt: state.receipts,
    travel: state.travels
  };
  const item = collections[kind]?.find((candidate) => candidate.id === id);
  if (!item) return false;
  item.billable = false;
  item.reviewNote = `${item.reviewNote || ""}${item.reviewNote ? " " : ""}Borttagen från fakturaunderlag ${isoToday}.`;
  saveState();
  renderAll();
  openInvoiceDetail(projectId);
  showToast("Raden togs bort från fakturaunderlaget men finns kvar i historiken.");
  return true;
}

function sendInvoiceEmail(invoiceId) {
  const invoice = (state.invoices || []).find((item) => item.id === invoiceId);
  if (!invoice) return false;
  const client = getClient(invoice.clientId);
  const email = invoice.billingEmail || client?.billingEmail || client?.email;
  if (!email) {
    showToast("Kunden saknar faktura-e-post.", "warning");
    return false;
  }

  const subject = encodeURIComponent(`Faktura ${invoice.number} från ${state.settings.companyName}`);
  const body = encodeURIComponent([
    `Hej ${client?.name || ""},`,
    "",
    `Här kommer faktura ${invoice.number} på ${formatSEK(Number(invoice.totalInclVat || invoice.total || 0))}.`,
    `Förfallodatum: ${invoice.dueDate || "-"}.`,
    `Bankgiro: ${invoice.bankgiro || state.settings.bankgiro || "-"}.`,
    "",
    "Fakturadokumentet öppnas från Novadex Tid & Löner och kan laddas ner som HTML/PDF i nästa produktionssteg.",
    "",
    "Vänliga hälsningar",
    state.settings.companyName
  ].join("\n"));
  window.location.href = `mailto:${encodeURIComponent(email)}?subject=${subject}&body=${body}`;
  invoice.status = "sent";
  invoice.sentAt = isoToday;
  addInvoiceEvent(invoice, "E-postutkast öppnat", `Mottagare: ${email}`);
  syncInvoicePortalTask(invoice, "sent");
  return true;
}

function openInvoiceRecordDetail(invoiceId) {
  const invoice = (state.invoices || []).find((item) => item.id === invoiceId);
  if (!invoice) {
    showToast("Fakturan kunde inte hittas.", "warning");
    return;
  }
  const project = getProject(invoice.projectId);
  const client = getClient(invoice.clientId);
  const status = getEffectiveInvoiceStatus(invoice);
  const timeline = getInvoiceTimeline(invoice);
  const invoiceLines = getInvoiceRecordLines(invoice);
  const isClosed = ["paid", "credited", "reopened"].includes(invoice.status);
  const canEditInvoice = !isClosed;
  const portalTasks = (state.portalTasks || []).filter((task) => task.invoiceId === invoice.id || task.id === invoice.portalTaskId);

  setDrawerContent({
    eyebrow: "Faktura",
    title: `${invoice.number} · ${getInvoiceStatusLabel(status)}`,
    body: `
      <div class="drawer-list">
        <article class="drawer-list-item">
          <div>
            <strong>${escapeHtml(client?.name || "Okänd kund")}</strong>
            <span>${escapeHtml(project?.name || "Okänt projekt")} · ${escapeHtml(invoice.billingEmail || client?.billingEmail || client?.email || "ingen faktura-e-post")}</span>
          </div>
          <span class="badge ${getInvoiceStatusBadge(status)}">${getInvoiceStatusLabel(status)}</span>
        </article>
        <article class="drawer-list-item">
          <strong>Belopp</strong>
          <span>Netto ${formatSEK(Number(invoice.total || 0))} · moms ${formatSEK(Number(invoice.vat || 0))} · att betala ${formatSEK(Number(invoice.totalInclVat || invoice.total || 0))}</span>
        </article>
        <article class="drawer-list-item">
          <strong>Betalning</strong>
          <span>Fakturadatum ${invoice.createdAt || "-"} · förfallodatum ${invoice.dueDate || "-"} · bankgiro ${escapeHtml(invoice.bankgiro || state.settings.bankgiro || "-")}</span>
        </article>
        ${invoice.invoiceReference || invoice.invoiceAddress ? `
          <article class="drawer-list-item">
            <strong>Kunduppgifter</strong>
            <span>${invoice.invoiceReference ? `Referens ${escapeHtml(invoice.invoiceReference)}` : ""}${invoice.invoiceReference && invoice.invoiceAddress ? " · " : ""}${invoice.invoiceAddress ? `Adress ${escapeHtml(invoice.invoiceAddress)}` : ""}</span>
          </article>
        ` : ""}
      </div>
        ${invoice.invoiceText ? `
      <div class="drawer-list">
          <article class="drawer-list-item">
            <strong>Fakturatext</strong>
            <span>${escapeHtml(invoice.invoiceText)}</span>
          </article>
      </div>
        ` : ""}
      ${(invoice.portalSharedAt || portalTasks.length || invoice.changeRequestMessage) ? `
      <div class="drawer-list">
          <article class="drawer-list-item">
            <strong>Kundportal</strong>
            <span>${invoice.portalSharedAt ? `Delad ${escapeHtml(invoice.portalSharedAt)}` : "Inte delad ännu"}${portalTasks.length ? ` · ${portalTasks.length} ärende${portalTasks.length === 1 ? "" : "n"}` : ""}</span>
          </article>
          ${invoice.changeRequestMessage ? `
          <article class="drawer-list-item">
            <strong>Ändringsfråga</strong>
            <span>${escapeHtml(invoice.changeRequestMessage)}</span>
          </article>
          ` : ""}
      </div>
        ` : ""}
      <form class="invoice-settings-form stored-invoice-settings-form" data-stored-invoice-settings-form="${invoice.id}">
        <div class="form-intro">
          <strong>Fakturauppgifter före utskick</strong>
          <span>Ändringar bygger om fakturadokumentet och sparas i händelseloggen.</span>
        </div>
        <div>
          <label>Faktura-e-post
            <input name="billingEmail" type="email" value="${escapeHtml(invoice.billingEmail || client?.billingEmail || client?.email || "")}" ${canEditInvoice ? "" : "disabled"}>
          </label>
          <label>Referens
            <input name="invoiceReference" type="text" value="${escapeHtml(invoice.invoiceReference || "")}" ${canEditInvoice ? "" : "disabled"}>
          </label>
          <label>Bankgiro
            <input name="bankgiro" type="text" value="${escapeHtml(invoice.bankgiro || state.settings.bankgiro || "")}" ${canEditInvoice ? "" : "disabled"}>
          </label>
        </div>
        <div>
          <label>Betalvillkor
            <input name="paymentTerms" type="number" min="0" step="1" value="${Number(invoice.paymentTerms || 0)}" ${canEditInvoice ? "" : "disabled"}>
          </label>
          <label>Förfallodatum
            <input name="dueDate" type="date" value="${escapeHtml(invoice.dueDate || "")}" ${canEditInvoice ? "" : "disabled"}>
          </label>
          <label>Moms %
            <input name="vatRate" type="number" min="0" step="0.1" value="${Number(invoice.vatRate || 0)}" ${canEditInvoice ? "" : "disabled"}>
          </label>
        </div>
        <label>Fakturaadress
          <input name="invoiceAddress" type="text" value="${escapeHtml(invoice.invoiceAddress || "")}" ${canEditInvoice ? "" : "disabled"}>
        </label>
        <label>Fakturatext
          <textarea name="invoiceText" rows="3" ${canEditInvoice ? "" : "disabled"}>${escapeHtml(invoice.invoiceText || "")}</textarea>
        </label>
        <button class="primary-button" type="submit" ${canEditInvoice ? "" : "disabled"}>Spara fakturauppgifter</button>
      </form>
      ${renderInvoiceFlowSteps(getInvoiceRecordFlowSteps(invoice, status))}
      <div class="invoice-timeline">
        ${timeline.map((item) => `
          <div class="${item.active ? "active" : ""}">
            <span></span>
            <strong>${escapeHtml(item.label)}</strong>
            <em>${escapeHtml(item.date || "-")}</em>
          </div>
        `).join("")}
      </div>
      ${(invoice.events || []).length ? `
      <div class="drawer-list invoice-event-log">
        ${(invoice.events || []).slice().reverse().map((event) => `
          <article class="drawer-list-item">
            <div>
              <strong>${escapeHtml(event.label || "Händelse")}</strong>
              <span>${escapeHtml(event.actor || "System")} · ${escapeHtml(event.date || "-")}</span>
            </div>
            <span>${escapeHtml(event.note || "")}</span>
          </article>
        `).join("")}
      </div>
      ` : ""}
      <div class="invoice-detail-list">
        <h3>Ingår i fakturan</h3>
        ${renderInvoiceLineRows(invoiceLines, "Inga kopplade rader")}
      </div>
      <div class="drawer-actions">
        <button class="ghost-button" type="button" data-open-document="invoice" data-document-id="${invoice.id}">Öppna faktura</button>
        <button class="ghost-button" type="button" data-invoice-stored-download="${invoice.id}">Ladda ner</button>
        <button class="ghost-button" type="button" data-invoice-email="${invoice.id}" ${isClosed ? "disabled" : ""}>Skicka e-post</button>
        <button class="ghost-button" type="button" data-invoice-share-portal="${invoice.id}" ${isClosed ? "disabled" : ""}>Skicka till kundportal</button>
        <button class="ghost-button" type="button" data-invoice-status="sent" data-invoice-id="${invoice.id}" ${isClosed ? "disabled" : ""}>Markera skickad</button>
        <button class="ghost-button" type="button" data-invoice-status="customerApproved" data-invoice-id="${invoice.id}" ${isClosed ? "disabled" : ""}>Kund godkände</button>
        <button class="ghost-button" type="button" data-invoice-status="changeRequested" data-invoice-id="${invoice.id}" ${isClosed ? "disabled" : ""}>Begär ändring</button>
        <button class="ghost-button" type="button" data-invoice-status="paid" data-invoice-id="${invoice.id}" ${["credited", "reopened"].includes(invoice.status) ? "disabled" : ""}>Markera betald</button>
        <button class="ghost-button" type="button" data-invoice-status="credited" data-invoice-id="${invoice.id}" ${["credited", "reopened"].includes(invoice.status) ? "disabled" : ""}>Kreditera</button>
        <button class="ghost-button" type="button" data-invoice-reopen="${invoice.id}" ${isClosed ? "disabled" : ""}>${status === "changeRequested" ? "Återöppna för ändring" : "Återöppna underlag"}</button>
      </div>
    `
  });
}

function openStoredDocument(kind, id) {
  if (kind === "receipt") {
    const receipt = state.receipts.find((item) => item.id === id);
    if (!receipt?.fileData) {
      showToast("Kvittot har ingen fil.", "warning");
      return;
    }
    const win = window.open("", "_blank", "noopener,noreferrer");
    if (!win) return;
    if ((receipt.fileType || "").includes("pdf")) {
      win.document.write(`<iframe title="${escapeHtml(receipt.fileName)}" src="${receipt.fileData}" style="border:0;width:100%;height:100vh"></iframe>`);
    } else {
      win.document.write(`<body style="margin:0;background:#111;display:grid;place-items:center;min-height:100vh"><img alt="${escapeHtml(receipt.fileName)}" src="${receipt.fileData}" style="max-width:100%;max-height:100vh"></body>`);
    }
    win.document.close();
    return;
  }

  if (kind === "invoice") {
    const invoice = (state.invoices || []).find((item) => item.id === id);
    if (!invoice?.documentHtml) {
      showToast("Fakturadokumentet saknas.", "warning");
      return;
    }
    const url = URL.createObjectURL(new Blob([invoice.documentHtml], { type: "text/html;charset=utf-8" }));
    window.open(url, "_blank", "noopener,noreferrer");
    window.setTimeout(() => URL.revokeObjectURL(url), 15000);
  }
}

function getMonthKey(dateString = isoToday, offset = 0) {
  const date = new Date(`${dateString || isoToday}T12:00:00`);
  date.setMonth(date.getMonth() + offset);
  return date.toISOString().slice(0, 7);
}

function getMonthStart(dateString = isoToday, offset = 0) {
  const date = new Date(`${dateString || isoToday}T12:00:00`);
  date.setMonth(date.getMonth() + offset, 1);
  return date.toISOString().slice(0, 10);
}

function sumInvoicesForMonth(invoices, monthKey) {
  return invoices
    .filter((invoice) => String(invoice.createdAt || "").slice(0, 7) === monthKey)
    .reduce((sum, invoice) => sum + Number(invoice.totalInclVat || invoice.total || 0), 0);
}

function renderInvoiceWorkbench() {
  const rowsAll = getInvoiceRows();
  const activeTab = document.querySelector("[data-invoice-tab].active")?.dataset.invoiceTab || "preliminary";
  const activeInvoices = (state.invoices || []).filter((invoice) => !["credited", "reopened"].includes(invoice.status));
  const previousMonthCreated = sumInvoicesForMonth(activeInvoices, getMonthKey(isoToday, -1));
  const currentMonthCreated = sumInvoicesForMonth(activeInvoices, getMonthKey(isoToday, 0));
  const openTotal = rowsAll.reduce((total, row) => total + row.total, 0);
  els.invoicePrevMonth.textContent = formatSEK(previousMonthCreated);
  els.invoiceCurrentMonth.textContent = formatSEK(currentMonthCreated);
  els.invoiceTotalOpen.textContent = formatSEK(openTotal);
  renderInvoiceCommandStrip();
  renderInvoiceHistory();

  if (!rowsAll.length) {
    els.invoiceTable.innerHTML = `<tr><td colspan="9">${els.emptyTemplate.innerHTML}</td></tr>`;
    if (activeTab === "draft") {
      showToast("Det finns inga sparade fakturautkast just nu.");
    }
    return;
  }

  els.invoiceTable.innerHTML = rowsAll.map((row) => {
    const actionProjectId = state.projects.some((project) => project.id === row.id)
      ? row.id
      : row.sourceProjectIds?.[0];
    const canRunInvoiceAction = Boolean(actionProjectId);
    const rowIssues = getInvoiceRowIssues(row);
    const issueChips = getInvoiceIssueChips(row);
    const isReady = isInvoiceRowReady(row);
    const invoiceEmail = row.client?.billingEmail || row.client?.email || "";
    return `
    <tr>
      <td>
        <a href="#" class="table-link" data-invoice-open="${row.id}">${row.number} - ${escapeHtml(row.project.name)}</a>
        <span class="table-subtext">${rowIssues.length ? escapeHtml(rowIssues.slice(0, 2).join(" · ")) : "Redo att fakturera"}</span>
        <div class="invoice-issue-chips">
          ${issueChips.length
            ? issueChips.map((issue) => `<span>${escapeHtml(issue)}</span>`).join("")
            : `<span class="ready">Klar för faktura</span>`
          }
        </div>
      </td>
      <td>
        <strong>${escapeHtml(row.client?.name || "Okänd kund")}</strong>
        <span class="table-subtext">${invoiceEmail ? escapeHtml(invoiceEmail) : "Faktura-e-post saknas"}</span>
        <div class="invoice-row-quick-actions">
          ${row.warning > 0 && actionProjectId ? `<button type="button" data-invoice-row-approval="${actionProjectId}">Öppna attest</button>` : ""}
          ${row.client?.id && rowIssues.some((issue) => issue.includes("saknas")) ? `<button type="button" data-edit-client="${row.client.id}">Kunddata</button>` : ""}
        </div>
      </td>
      <td>${formatSEK(row.fixedPrice)}</td>
      <td>
        <strong>${formatHours(row.hours)}</strong>
        <span class="table-subtext">${formatSEK(row.hourlyValue)}${row.draftHours ? ` · (${formatHours(row.draftHours)} ej attesterat)` : ""}</span>
      </td>
      <td>${formatSEK(row.articleValue)}</td>
      <td>${formatSEK(row.supplierInvoices)}</td>
      <td>${formatSEK(row.otherValue)}</td>
      <td>
        <div class="invoice-status-stack">
          <strong>${formatSEK(row.total)}</strong>
          <span class="badge ${getInvoiceReadinessBadge(row)}">${escapeHtml(getInvoiceReadinessLabel(row))}</span>
        </div>
      </td>
      <td>
        <div class="row-actions">
          <button class="mini-button" type="button" title="Förhandsgranska" aria-label="Förhandsgranska" data-invoice-preview="${actionProjectId || row.id}" ${canRunInvoiceAction ? "" : "disabled"}>
            ${icon("file-text")}
          </button>
          <button class="mini-button" type="button" title="Ladda ner faktura" aria-label="Ladda ner faktura" data-invoice-download="${actionProjectId || row.id}" ${canRunInvoiceAction ? "" : "disabled"}>
            ${icon("download")}
          </button>
          <button class="mini-button" type="button" title="Spara som utkast" aria-label="Spara som utkast" data-invoice-draft="${actionProjectId || row.id}" ${canRunInvoiceAction ? "" : "disabled"}>
            ${icon("file-pencil")}
          </button>
          <button class="mini-button" type="button" title="${isReady ? "Skapa fakturaunderlag" : "Komplettera raden innan faktura skapas"}" aria-label="Skapa fakturaunderlag" data-invoice-create="${actionProjectId || row.id}" ${canRunInvoiceAction && isReady ? "" : "disabled"}>
            ${icon("check")}
          </button>
        </div>
      </td>
    </tr>
  `;
  }).join("");

}

function getSortedInvoices() {
  return [...(state.invoices || [])]
    .sort((a, b) => (b.createdAt || "").localeCompare(a.createdAt || "") || String(b.number).localeCompare(String(a.number)));
}

function renderInvoiceHistoryControls(invoices) {
  if (!els.invoiceHistoryClient) return;
  setDynamicSelectOptions(
    els.invoiceHistoryClient,
    invoices.map((invoice) => {
      const client = getClient(invoice.clientId);
      return { value: invoice.clientId || "unknown", label: client?.name || "Okänd kund" };
    }),
    "Alla kunder"
  );
}

function getFilteredInvoiceHistoryRows(invoices = getSortedInvoices()) {
  const query = (els.invoiceHistorySearch?.value || "").trim().toLowerCase();
  const statusFilter = els.invoiceHistoryStatus?.value || "all";
  const clientFilter = els.invoiceHistoryClient?.value || "all";
  return invoices.filter((invoice) => {
    const client = getClient(invoice.clientId);
    const project = getProject(invoice.projectId);
    const status = getEffectiveInvoiceStatus(invoice);
    const matchesStatus = statusFilter === "all"
      || (statusFilter === "open" ? !["paid", "credited", "reopened"].includes(status) : status === statusFilter);
    const matchesClient = clientFilter === "all" || invoice.clientId === clientFilter || (clientFilter === "unknown" && !client);
    const haystack = `${invoice.number} ${client?.name || ""} ${project?.name || ""} ${invoice.billingEmail || ""} ${invoice.invoiceReference || ""}`.toLowerCase();
    return matchesStatus && matchesClient && (!query || haystack.includes(query));
  });
}

function renderInvoiceHistorySummary(allInvoices, visibleInvoices) {
  if (!els.invoiceHistorySummary) return;
  const activeInvoices = allInvoices.filter((invoice) => !["credited", "reopened"].includes(getEffectiveInvoiceStatus(invoice)));
  const unpaidInvoices = activeInvoices.filter((invoice) => !["paid"].includes(getEffectiveInvoiceStatus(invoice)));
  const overdueInvoices = activeInvoices.filter((invoice) => getEffectiveInvoiceStatus(invoice) === "overdue");
  const changeInvoices = activeInvoices.filter((invoice) => getEffectiveInvoiceStatus(invoice) === "changeRequested");
  const approvedInvoices = activeInvoices.filter((invoice) => getEffectiveInvoiceStatus(invoice) === "customerApproved");
  const paidInvoices = allInvoices.filter((invoice) => getEffectiveInvoiceStatus(invoice) === "paid");
  const visibleTotal = visibleInvoices.reduce((sum, invoice) => sum + Number(invoice.totalInclVat || invoice.total || 0), 0);
  els.invoiceHistorySummary.innerHTML = `
    <button type="button" data-invoice-history-status="open">
      <span>Öppna</span>
      <strong>${unpaidInvoices.length}</strong>
      <small>${formatSEK(unpaidInvoices.reduce((sum, invoice) => sum + Number(invoice.totalInclVat || invoice.total || 0), 0))}</small>
    </button>
    <button type="button" data-invoice-history-status="overdue">
      <span>Förfallna</span>
      <strong>${overdueInvoices.length}</strong>
      <small>${formatSEK(overdueInvoices.reduce((sum, invoice) => sum + Number(invoice.totalInclVat || invoice.total || 0), 0))}</small>
    </button>
    <button type="button" data-invoice-history-status="paid">
      <span>Betalda</span>
      <strong>${paidInvoices.length}</strong>
      <small>${formatSEK(paidInvoices.reduce((sum, invoice) => sum + Number(invoice.totalInclVat || invoice.total || 0), 0))}</small>
    </button>
    <button type="button" data-invoice-history-status="changeRequested">
      <span>Ändringar</span>
      <strong>${changeInvoices.length}</strong>
      <small>${formatSEK(changeInvoices.reduce((sum, invoice) => sum + Number(invoice.totalInclVat || invoice.total || 0), 0))}</small>
    </button>
    <button type="button" data-invoice-history-status="customerApproved">
      <span>Godkända</span>
      <strong>${approvedInvoices.length}</strong>
      <small>${formatSEK(approvedInvoices.reduce((sum, invoice) => sum + Number(invoice.totalInclVat || invoice.total || 0), 0))}</small>
    </button>
    <button type="button" data-invoice-history-status="all">
      <span>Visas nu</span>
      <strong>${visibleInvoices.length}</strong>
      <small>${formatSEK(visibleTotal)}</small>
    </button>
  `;
}

function renderInvoiceHistory() {
  if (!els.invoiceHistoryTable) return;
  const allInvoices = getSortedInvoices();
  renderInvoiceHistoryControls(allInvoices);
  const invoices = getFilteredInvoiceHistoryRows(allInvoices);
  renderInvoiceHistorySummary(allInvoices, invoices);

  if (!invoices.length) {
    const readyRows = getInvoiceRows().filter(isInvoiceRowReady);
    els.invoiceHistoryTable.innerHTML = `
      <tr>
        <td colspan="8">
          <div class="empty-state invoice-empty-state">
            <svg viewBox="0 0 24 24"><path d="M7 3h7l5 5v13H7zM14 3v5h5M9 14h8M9 18h5"></path></svg>
            <span>${readyRows.length ? `${readyRows.length} klara underlag kan bli faktura.` : "Inga fakturor matchar filtret ännu."}</span>
            <div class="row-actions">
              ${readyRows.length ? `<button class="primary-button small-button" type="button" data-invoice-empty-action="create-ready">Skapa faktura</button>` : ""}
              <button class="ghost-button small-button" type="button" data-invoice-empty-action="show-all">Visa alla</button>
            </div>
          </div>
        </td>
      </tr>
    `;
    return;
  }

  els.invoiceHistoryTable.innerHTML = invoices.map((invoice) => {
    const project = getProject(invoice.projectId);
    const client = getClient(invoice.clientId);
    const status = getEffectiveInvoiceStatus(invoice);
    const isClosed = ["paid", "credited", "reopened"].includes(invoice.status);
    const nextAction = getInvoiceNextAction(invoice);
    return `
      <tr>
        <td><a href="#" class="table-link" data-invoice-detail="${invoice.id}">${escapeHtml(invoice.number)}</a></td>
        <td>${escapeHtml(client?.name || "Okänd kund")}</td>
        <td>${escapeHtml(project?.name || "Okänt projekt")}</td>
        <td>${invoice.createdAt || "-"}</td>
        <td>${invoice.dueDate || "-"}</td>
        <td>
          <span class="badge ${getInvoiceStatusBadge(status)}">${getInvoiceStatusLabel(status)}</span>
          <div class="invoice-next-action ${nextAction.tone}">
            <strong>${escapeHtml(nextAction.label)}</strong>
            <span>${escapeHtml(nextAction.detail)}</span>
          </div>
        </td>
        <td><strong>${formatSEK(Number(invoice.totalInclVat || invoice.total || 0))}</strong></td>
        <td>
          <div class="row-actions">
            <button class="mini-button" type="button" title="Fakturakort" aria-label="Fakturakort" data-invoice-detail="${invoice.id}">
              ${icon("file-description")}
            </button>
            <button class="mini-button" type="button" title="Öppna faktura" aria-label="Öppna faktura" data-open-document="invoice" data-document-id="${invoice.id}">
              ${icon("file-text")}
            </button>
            <button class="mini-button" type="button" title="Ladda ner faktura" aria-label="Ladda ner faktura" data-invoice-stored-download="${invoice.id}">
              ${icon("download")}
            </button>
            <button class="mini-button" type="button" title="Skicka e-post" aria-label="Skicka e-post" data-invoice-email="${invoice.id}" ${isClosed ? "disabled" : ""}>
              ${icon("mail")}
            </button>
            <button class="mini-button" type="button" title="Skicka till kundportal" aria-label="Skicka till kundportal" data-invoice-share-portal="${invoice.id}" ${isClosed ? "disabled" : ""}>
              ${icon("message-share")}
            </button>
            <button class="mini-button" type="button" title="Markera skickad" aria-label="Markera skickad" data-invoice-status="sent" data-invoice-id="${invoice.id}" ${isClosed ? "disabled" : ""}>
              ${icon("send")}
            </button>
            <button class="mini-button" type="button" title="Markera betald" aria-label="Markera betald" data-invoice-status="paid" data-invoice-id="${invoice.id}" ${["credited", "reopened"].includes(invoice.status) ? "disabled" : ""}>
              ${icon("check")}
            </button>
            <button class="mini-button" type="button" title="Kreditera" aria-label="Kreditera" data-invoice-status="credited" data-invoice-id="${invoice.id}" ${["credited", "reopened"].includes(invoice.status) ? "disabled" : ""}>
              ${icon("receipt-refund")}
            </button>
            <button class="mini-button" type="button" title="Återöppna" aria-label="Återöppna" data-invoice-reopen="${invoice.id}" ${isClosed ? "disabled" : ""}>
              ${icon("refresh")}
            </button>
          </div>
        </td>
      </tr>
    `;
  }).join("");
}

function renderEmpty(target) {
  target.innerHTML = els.emptyTemplate.innerHTML;
}

function showToast(message, type = "info") {
  if (!els.toastStack) return;
  const toast = document.createElement("div");
  toast.className = `toast ${type}`;
  toast.textContent = message;
  els.toastStack.append(toast);
  window.setTimeout(() => toast.classList.add("visible"), 20);
  window.setTimeout(() => {
    toast.classList.remove("visible");
    window.setTimeout(() => toast.remove(), 220);
  }, 3200);
}

function focusElement(element) {
  if (!element) return;
  element.scrollIntoView({ behavior: "smooth", block: "center" });
  window.setTimeout(() => element.focus?.(), 250);
}

function openDrawer(kind) {
  const content = getDrawerContent(kind);
  setDrawerContent(content);
}

function handleDrawerCommand(command) {
  if (command === "actionable-approvals" || command === "open-reports") {
    setView("reports");
    if (els.approvalStatusFilter) els.approvalStatusFilter.value = command === "actionable-approvals" ? "open" : "all";
    if (els.approvalKindFilter) els.approvalKindFilter.value = "all";
    renderApprovalFlow();
    closeDrawer();
    els.approvalList?.scrollIntoView({ behavior: "smooth", block: "start" });
    showToast(command === "actionable-approvals" ? "Visar öppna attestposter." : "Öppnade rapporter.");
    return;
  }

  if (command === "invoice-ready") {
    setView("invoice");
    if (els.invoiceReadinessFilter) els.invoiceReadinessFilter.value = "ready";
    renderInvoiceWorkbench();
    closeDrawer();
    scrollToPageTarget("invoice-history");
    showToast("Visar fakturaunderlag och klara utkast.");
    return;
  }

  if (command === "portal-open") {
    setView("portal");
    closeDrawer();
    showToast("Öppnade kundportalens arbetsyta.");
    return;
  }

  if (command === "admin-users" || command === "account-requests") {
    setView("reports");
    closeDrawer();
    scrollToPageTarget(command === "account-requests" ? "account-request-list" : "admin-overview");
    showToast(command === "account-requests" ? "Visar kontoansökningar." : "Visar roller och systemstatus.");
  }
}

function setDrawerContent(content) {
  els.drawerEyebrow.textContent = content.eyebrow;
  els.drawerTitle.textContent = content.title;
  els.drawerBody.innerHTML = content.body;
  els.drawer.classList.add("open");
  els.drawer.setAttribute("aria-hidden", "false");
}

function closeDrawer() {
  els.drawer.classList.remove("open");
  els.drawer.setAttribute("aria-hidden", "true");
}

function makeOptions(items, selectedValue, getValue, getLabel) {
  return items.map((item) => {
    const value = getValue(item);
    return `<option value="${escapeHtml(value)}" ${value === selectedValue ? "selected" : ""}>${escapeHtml(getLabel(item))}</option>`;
  }).join("");
}

function openEntityEditor(kind, id) {
  const content = getEntityEditorContent(kind, id);
  if (!content) {
    showToast("Posten kunde inte hittas.", "warning");
    return;
  }
  setDrawerContent(content);
}

function getEntityEditorContent(kind, id) {
  if (kind === "client") {
    const client = getClient(id);
    if (!client) return null;
    return {
      eyebrow: "Kund",
      title: `Redigera ${client.name}`,
      body: `
        <form class="drawer-form" data-edit-form="client" data-edit-id="${client.id}">
          <label>Kundnamn<input name="name" type="text" value="${escapeHtml(client.name)}" required></label>
          <label>Org.nr<input name="org" type="text" value="${escapeHtml(client.org || "")}"></label>
          <label>E-post<input name="email" type="email" value="${escapeHtml(client.email || "")}"></label>
          <label>Ansvarig<input name="owner" type="text" value="${escapeHtml(client.owner || "")}"></label>
          <label>Timpris<input name="rate" type="number" min="0" step="50" value="${Number(client.rate || 0)}"></label>
          <label>Faktura e-post<input name="billingEmail" type="email" value="${escapeHtml(client.billingEmail || client.email || "")}"></label>
          <label>Fakturareferens<input name="invoiceReference" type="text" value="${escapeHtml(client.invoiceReference || "")}"></label>
          <label>Fakturaadress<input name="invoiceAddress" type="text" value="${escapeHtml(client.invoiceAddress || "")}"></label>
          <label>Betalvillkor dagar<input name="paymentTerms" type="number" min="0" step="1" value="${escapeHtml(client.paymentTerms || "")}"></label>
          <label>Moms %<input name="vatRate" type="number" min="0" step="1" value="${escapeHtml(client.vatRate || "")}"></label>
          <button class="primary-button" type="submit">Spara kund</button>
        </form>
      `
    };
  }

  if (kind === "project") {
    const project = getProject(id);
    if (!project) return null;
    return {
      eyebrow: "Projekt",
      title: `Redigera ${project.name}`,
      body: `
        <form class="drawer-form" data-edit-form="project" data-edit-id="${project.id}">
          <label>Projektnamn<input name="name" type="text" value="${escapeHtml(project.name)}" required></label>
          <label>Kund<select name="clientId">${makeOptions(state.clients, project.clientId, (client) => client.id, (client) => client.name)}</select></label>
          <label>Ansvarig<input name="manager" type="text" value="${escapeHtml(project.manager || "")}"></label>
          <label>Startdatum<input name="start" type="date" value="${escapeHtml(project.start || "")}"></label>
          <label>Status<select name="status">${makeOptions([
            { id: "active", label: "Aktivt" },
            { id: "planned", label: "Planerat" },
            { id: "paused", label: "Pausat" },
            { id: "done", label: "Avslutat" }
          ], project.status || "active", (item) => item.id, (item) => item.label)}</select></label>
          <label>Budget timmar<input name="budget" type="number" min="0" step="1" value="${Number(project.budget || 0)}"></label>
          <label>Fastpris<input name="fixedPrice" type="number" min="0" step="100" value="${Number(project.fixedPrice || 0)}"></label>
          <label>Beskrivning<input name="description" type="text" value="${escapeHtml(project.description || "")}"></label>
          <button class="primary-button" type="submit">Spara projekt</button>
        </form>
      `
    };
  }

  if (kind === "entry") {
    const entry = state.entries.find((item) => item.id === id);
    if (!entry) return null;
    return {
      eyebrow: "Tidsrad",
      title: "Redigera tidsrad",
      body: `
        <form class="drawer-form" data-edit-form="entry" data-edit-id="${entry.id}">
          <label>Datum<input name="date" type="date" value="${escapeHtml(entry.date)}" required></label>
          <label>Medarbetare<input name="employee" type="text" value="${escapeHtml(entry.employee)}" required></label>
          <label>Typ<select name="type">${makeOptions([
            { id: "project", label: "Kundtid" },
            { id: "internal", label: "Interntid" },
            { id: "absence", label: "Frånvaro" }
          ], entry.type || "project", (item) => item.id, (item) => item.label)}</select></label>
          <label>Kund<select name="clientId">${makeOptions(state.clients, entry.clientId, (client) => client.id, (client) => client.name)}</select></label>
          <label>Projekt<select name="projectId"><option value="">Inget projekt</option>${makeOptions(state.projects, entry.projectId || "", (project) => project.id, (project) => project.name)}</select></label>
          <label>Arbetsorder<input name="workOrder" type="text" value="${escapeHtml(entry.workOrder || "")}"></label>
          <label>Aktivitet<input name="task" type="text" value="${escapeHtml(entry.task || "")}" required></label>
          <label>Timmar<input name="hours" type="number" min="0.1" step="0.1" value="${Number(entry.hours || 0)}" required></label>
          <label>Status<select name="status">${makeOptions([
            { id: "draft", label: "Utkast" },
            { id: "submitted", label: "Inskickad" },
            { id: "approved", label: "Attesterad" },
            { id: "rejected", label: "Avvisad" },
            { id: "invoiced", label: "Fakturerad" }
          ], entry.status || "draft", (item) => item.id, (item) => item.label)}</select></label>
          <label><span class="checkbox-row"><input name="billable" type="checkbox" ${entry.billable ? "checked" : ""}> Fakturerbar</span></label>
          <label><span class="checkbox-row"><input name="payroll" type="checkbox" ${entry.payroll ? "checked" : ""}> På löneunderlag</span></label>
          <label>Beskrivning<input name="description" type="text" value="${escapeHtml(entry.description || "")}"></label>
          <button class="primary-button" type="submit">Spara tidsrad</button>
        </form>
      `
    };
  }

  if (kind === "receipt") {
    const receipt = state.receipts.find((item) => item.id === id);
    if (!receipt) return null;
    return {
      eyebrow: "Kvitto",
      title: `Redigera ${receipt.supplier}`,
      body: `
        <form class="drawer-form" data-edit-form="receipt" data-edit-id="${receipt.id}">
          <label>Datum<input name="date" type="date" value="${escapeHtml(receipt.date)}" required></label>
          <label>Leverantör<input name="supplier" type="text" value="${escapeHtml(receipt.supplier || "")}" required></label>
          <label>Belopp<input name="amount" type="number" min="0" step="1" value="${Number(receipt.amount || 0)}"></label>
          <label>Moms<input name="vat" type="number" min="0" step="1" value="${Number(receipt.vat || 0)}"></label>
          <label>Kund<select name="clientId">${makeOptions(state.clients, receipt.clientId, (client) => client.id, (client) => client.name)}</select></label>
          <label>Projekt<select name="projectId"><option value="">Inget projekt</option>${makeOptions(state.projects, receipt.projectId || "", (project) => project.id, (project) => project.name)}</select></label>
          ${receipt.fileData ? `<div class="document-preview"><strong>${escapeHtml(receipt.fileName || "Kvittofil")}</strong><button class="ghost-button small-button" type="button" data-open-document="receipt" data-document-id="${receipt.id}">Öppna fil</button></div>` : ""}
          <label>Byt kvittofil<input name="receiptFile" type="file" accept="image/*,.pdf"></label>
          <label>Status<select name="status">${makeOptions([
            { id: "draft", label: "Utkast" },
            { id: "submitted", label: "Inskickad" },
            { id: "approved", label: "Attesterad" },
            { id: "rejected", label: "Avvisad" },
            { id: "invoiced", label: "Fakturerad" }
          ], receipt.status || "draft", (item) => item.id, (item) => item.label)}</select></label>
          <label><span class="checkbox-row"><input name="billable" type="checkbox" ${receipt.billable ? "checked" : ""}> Fakturerbar</span></label>
          <label><span class="checkbox-row"><input name="payroll" type="checkbox" ${receipt.payroll ? "checked" : ""}> På löneunderlag</span></label>
          <button class="primary-button" type="submit">Spara kvitto</button>
        </form>
      `
    };
  }

  if (kind === "travel") {
    const travel = state.travels.find((item) => item.id === id);
    if (!travel) return null;
    return {
      eyebrow: "Resa",
      title: "Redigera resa",
      body: `
        <form class="drawer-form" data-edit-form="travel" data-edit-id="${travel.id}">
          <label>Datum<input name="date" type="date" value="${escapeHtml(travel.date)}" required></label>
          <label>Typ<select name="type">${makeOptions([
            { id: "mileage", label: "Milersättning" },
            { id: "allowance", label: "Traktamente" }
          ], travel.type || "mileage", (item) => item.id, (item) => item.label)}</select></label>
          <label>Från<input name="from" type="text" value="${escapeHtml(travel.from || "")}"></label>
          <label>Till<input name="to" type="text" value="${escapeHtml(travel.to || "")}"></label>
          <label>Antal<input name="quantity" type="number" min="0" step="0.1" value="${Number(travel.quantity || 0)}"></label>
          <label>Kund<select name="clientId">${makeOptions(state.clients, travel.clientId, (client) => client.id, (client) => client.name)}</select></label>
          <label>Status<select name="status">${makeOptions([
            { id: "draft", label: "Utkast" },
            { id: "submitted", label: "Inskickad" },
            { id: "approved", label: "Attesterad" },
            { id: "rejected", label: "Avvisad" },
            { id: "invoiced", label: "Fakturerad" }
          ], travel.status || "draft", (item) => item.id, (item) => item.label)}</select></label>
          <label><span class="checkbox-row"><input name="billable" type="checkbox" ${travel.billable ? "checked" : ""}> Fakturerbar</span></label>
          <label><span class="checkbox-row"><input name="payroll" type="checkbox" ${travel.payroll ? "checked" : ""}> På löneunderlag</span></label>
          <button class="primary-button" type="submit">Spara resa</button>
        </form>
      `
    };
  }

  if (kind === "agreement") {
    const agreement = getAgreement(id);
    if (!agreement) return null;
    return {
      eyebrow: "Avtal",
      title: `Redigera ${agreement.title}`,
      body: `
        <form class="drawer-form" data-edit-form="agreement" data-edit-id="${agreement.id}">
          <label>Titel<input name="title" type="text" value="${escapeHtml(agreement.title || "")}" required></label>
          <label>Kund<select name="clientId">${makeOptions(state.clients, agreement.clientId, (client) => client.id, (client) => client.name)}</select></label>
          <label>Projekt<select name="projectId"><option value="">Inget projekt</option>${makeOptions(state.projects, agreement.projectId || "", (project) => project.id, (project) => project.name)}</select></label>
          <label>Kundens e-post<input name="clientEmail" type="email" value="${escapeHtml(agreement.clientEmail || "")}"></label>
          <label>Ansvarig<input name="owner" type="text" value="${escapeHtml(agreement.owner || "")}"></label>
          <label>Typ<input name="type" type="text" value="${escapeHtml(agreement.type || "")}"></label>
          <label>Etikett<input name="label" type="text" value="${escapeHtml(agreement.label || "")}"></label>
          <label>Bevakningsdatum<input name="watchDate" type="date" value="${escapeHtml(agreement.watchDate || "")}"></label>
          <label>Slutdatum<input name="endDate" type="date" value="${escapeHtml(agreement.endDate || "")}"></label>
          <label>Pris<input name="price" type="text" value="${escapeHtml(agreement.price || "")}"></label>
          <label>Betalningsvillkor<input name="payment" type="text" value="${escapeHtml(agreement.payment || "")}"></label>
          <label>Omfattning<input name="scope" type="text" value="${escapeHtml(agreement.scope || "")}"></label>
          <label>Meddelande<input name="message" type="text" value="${escapeHtml(agreement.message || "")}"></label>
          <label>Status<select name="status">${makeOptions([
            { id: "draft", label: "Utkast" },
            { id: "sent", label: "Skickat" },
            { id: "signed", label: "Signerat" },
            { id: "archived", label: "Arkiverat" }
          ], agreement.status || "draft", (item) => item.id, (item) => item.label)}</select></label>
          <button class="primary-button" type="submit">Spara avtal</button>
        </form>
      `
    };
  }

  if (kind === "esign") {
    const item = state.esignatures.find((signature) => signature.id === id);
    if (!item) return null;
    return {
      eyebrow: "E-signering",
      title: `Redigera ${item.title}`,
      body: `
        <form class="drawer-form" data-edit-form="esign" data-edit-id="${item.id}">
          <label>Titel<input name="title" type="text" value="${escapeHtml(item.title || "")}" required></label>
          <label>Dokumenttyp<input name="docType" type="text" value="${escapeHtml(item.docType || "")}"></label>
          <label>Avtal<select name="agreementId"><option value="">Ingen koppling</option>${makeOptions(state.agreements, item.agreementId || "", (agreement) => agreement.id, (agreement) => agreement.title)}</select></label>
          <label>Kund<select name="clientId">${makeOptions(state.clients, item.clientId, (client) => client.id, (client) => client.name)}</select></label>
          <label>Initierad av<input name="owner" type="text" value="${escapeHtml(item.owner || "")}"></label>
          <label>Påminnelsedatum<input name="reminderDate" type="date" value="${escapeHtml(item.reminderDate || "")}"></label>
          <label>Förfallodatum<input name="dueDate" type="date" value="${escapeHtml(item.dueDate || "")}"></label>
          <label>Meddelande<input name="message" type="text" value="${escapeHtml(item.message || "")}"></label>
          <label>Status<select name="status">${makeOptions([
            { id: "draft", label: "Utkast" },
            { id: "sent", label: "Skickad" },
            { id: "signed", label: "Signerad" },
            { id: "expired", label: "Förfallen" }
          ], item.status || "draft", (status) => status.id, (status) => status.label)}</select></label>
          <button class="primary-button" type="submit">Spara e-signering</button>
        </form>
      `
    };
  }

  return null;
}

function getNotificationItems() {
  const openApprovals = getApprovalItems();
  const draftInvoices = state.projects.filter((project) => project.invoiceStatus === "draft");
  const unsignedAgreements = state.agreements.filter((agreement) => agreement.status === "sent");
  const portalItems = (state.portalTasks || [])
    .filter((task) => task.status !== "done")
    .filter((task) => isClientVisible(getClient(task.clientId)))
    .slice(0, 6);
  const changedInvoices = (state.invoices || [])
    .filter((invoice) => ["changeRequested", "customerApproved", "overdue"].includes(getEffectiveInvoiceStatus(invoice)))
    .filter((invoice) => isClientVisible(getClient(invoice.clientId)));
  return [
    ...portalItems.map((task) => ({
      title: `Kundportal · ${getPortalStatusLabel(task.status)}`,
      text: `${task.title} · ${getClient(task.clientId)?.name || "Okänd kund"} · förfaller ${task.dueDate || "-"}`,
      action: "portal",
      actionLabel: "Öppna portal",
      tone: task.status === "rejected" ? "warning" : "info",
      group: "Kund"
    })),
    ...changedInvoices.map((invoice) => ({
      title: `Faktura ${getInvoiceStatusLabel(getEffectiveInvoiceStatus(invoice)).toLowerCase()}`,
      text: `${invoice.number} · ${getClient(invoice.clientId)?.name || "Okänd kund"} · ${formatSEK(Number(invoice.totalInclVat || invoice.total || 0))}`,
      action: "invoice",
      actionLabel: "Öppna fakturering",
      tone: getEffectiveInvoiceStatus(invoice) === "overdue" ? "warning" : "success",
      group: "Fakturering"
    })),
    ...openApprovals.slice(0, 6).map((item) => ({
      title: getApprovalStatusLabel(item.status),
      text: `${item.title} · ${item.subtitle}`,
      action: "reports",
      actionLabel: "Öppna attest",
      tone: isApprovalBlocked(item.status) ? "warning" : "info",
      group: "Attest"
    })),
    ...draftInvoices.slice(0, 4).map((project) => ({
      title: "Fakturautkast",
      text: `${project.name} ligger som utkast.`,
      action: "invoice",
      actionLabel: "Öppna fakturering",
      tone: "neutral",
      group: "Fakturering"
    })),
    ...unsignedAgreements.slice(0, 4).map((agreement) => ({
      title: "Avtal skickat",
      text: `${agreement.title} väntar på kundens signering.`,
      action: "agreements",
      actionLabel: "Öppna avtal",
      tone: "info",
      group: "Avtal"
    }))
  ];
}

function getSystemHealthItems() {
  const settings = state.settings || defaultState.settings;
  const customerUsers = state.users.filter((user) => user.role === "customer");
  const unlinkedCustomerUsers = customerUsers.filter((user) => !user.clientId).length;
  const openApprovals = getApprovalItems().length;
  const invoiceRows = getInvoiceRows();
  const readyInvoices = invoiceRows.filter(isInvoiceRowReady).length;
  const blockedInvoices = invoiceRows.filter((row) => row.warning > 0).length;
  const pendingRequests = [...state.accountRequests, ...cloudAccountRequests].filter((request) => request.status === "pending").length;
  return [
    {
      label: "Moln",
      value: isSupabaseReady() ? (cloudSession?.user ? "Inloggad" : "Redo") : "Lokal",
      ok: isSupabaseReady() && Boolean(settings.companyName),
      text: isSupabaseReady() ? "Supabase är konfigurerat. Logga in för synk." : "Appen använder lokal lagring tills Supabase är aktivt.",
      action: "cloud",
      actionLabel: "Molnstatus"
    },
    {
      label: "Attest",
      value: String(openApprovals),
      ok: openApprovals === 0,
      text: openApprovals ? "Det finns underlag som behöver beslut." : "Inga öppna attestposter.",
      command: "actionable-approvals",
      actionLabel: "Visa attest"
    },
    {
      label: "Fakturering",
      value: `${readyInvoices}/${invoiceRows.length}`,
      ok: blockedInvoices === 0,
      text: blockedInvoices ? `${blockedInvoices} underlag har spärrar innan faktura.` : "Fakturaunderlagen är rena.",
      command: "invoice-ready",
      actionLabel: "Visa underlag"
    },
    {
      label: "Kundportal",
      value: `${customerUsers.length}`,
      ok: customerUsers.length > 0 && unlinkedCustomerUsers === 0,
      text: unlinkedCustomerUsers ? `${unlinkedCustomerUsers} kundkonton saknar kundkoppling.` : "Kundkonton och portalflöden är kopplade.",
      command: "admin-users",
      actionLabel: "Hantera"
    },
    {
      label: "Konton",
      value: String(pendingRequests),
      ok: pendingRequests === 0,
      text: pendingRequests ? "Kontoansökningar väntar på admin." : "Inga väntande kontoansökningar.",
      command: "account-requests",
      actionLabel: "Granska"
    }
  ];
}

function renderDrawerKpis(items) {
  return `
    <div class="drawer-kpi-grid">
      ${items.map((item) => `
        <article class="drawer-kpi ${item.ok ? "ok" : "warning"}">
          <span>${escapeHtml(item.label)}</span>
          <strong>${escapeHtml(item.value)}</strong>
          <small>${escapeHtml(item.text)}</small>
          ${item.command ? `<button class="ghost-button small-button" type="button" data-drawer-command="${escapeHtml(item.command)}">${escapeHtml(item.actionLabel)}</button>` : `<button class="ghost-button small-button" type="button" data-drawer-open="${escapeHtml(item.action)}">${escapeHtml(item.actionLabel)}</button>`}
        </article>
      `).join("")}
    </div>
  `;
}

function getActiveViewName() {
  return [...els.views].find((view) => view.classList.contains("active"))?.id?.replace("-view", "") || "dashboard";
}

function getDrawerContent(kind) {
  const settings = state.settings || defaultState.settings;
  if (kind === "cloud") {
    const configured = isSupabaseReady();
    const health = getSystemHealthItems();
    return {
      eyebrow: "Supabase",
      title: configured ? "Molnanslutning redo" : "Molnanslutning saknas",
      body: `
        ${renderDrawerKpis(health.slice(0, 2))}
        <div class="drawer-list">
          <article class="drawer-list-item">
            <strong>Status</strong>
            <span>${configured ? "Supabase-klienten är laddad med Project URL och anon public key." : "Supabase SDK eller konfiguration saknas. Appen kör lokalt tills detta är löst."}</span>
          </article>
          <article class="drawer-list-item ${cloudHealth.database ? "success" : configured ? "warning" : "neutral"}">
            <strong>Databas</strong>
            <span>${cloudHealth.database ? `Ansluten. Kontrollerade tabeller: ${cloudHealth.tables.join(", ")}.` : configured ? `Inte kontrollerad eller delvis blockerad.${cloudHealth.error ? ` ${escapeHtml(cloudHealth.error)}` : ""}` : "Ingen databasanslutning."}</span>
          </article>
          <article class="drawer-list-item ${cloudHealth.auth ? "success" : configured ? "warning" : "neutral"}">
            <strong>Auth</strong>
            <span>${cloudHealth.auth ? "Supabase Auth svarar." : configured ? "Auth är inte verifierad ännu. Klicka på Uppdatera status." : "Auth saknar konfiguration."}</span>
          </article>
          <article class="drawer-list-item">
            <strong>Session</strong>
            <span>${cloudSession?.user ? `Inloggad som ${escapeHtml(cloudSession.user.email || "användare")}` : "Ingen molnanvändare är inloggad ännu."}</span>
          </article>
          <article class="drawer-list-item">
            <strong>Profil</strong>
            <span>${cloudProfile ? `${escapeHtml(cloudProfile.full_name || cloudProfile.email || "Profil")} · ${escapeHtml(cloudProfile.role || "roll saknas")} · ${cloudProfile.is_active ? "aktiv" : "väntar på godkännande"}` : "Ingen profilrad hittad. Första admin behöver läggas in i Supabase-tabellen profiles."}</span>
          </article>
          <article class="drawer-list-item ${canUseCloudData() ? "success" : "warning"}">
            <strong>Nästa krav</strong>
            <span>${canUseCloudData() ? "Molnsynk kan användas för kunder, projekt och tidrader." : "För full molnsynk behövs inloggning, aktiv profil och organization_id."}</span>
          </article>
        </div>
        ${cloudSession?.user ? `
          <div class="drawer-actions">
            <button class="ghost-button" type="button" data-cloud-action="refresh">Uppdatera status</button>
            <button class="primary-button" type="button" data-cloud-action="signout">Logga ut</button>
            <button class="ghost-button" type="button" data-drawer-command="admin-users">Hantera roller</button>
          </div>
        ` : `
          <div class="drawer-actions">
            <button class="ghost-button" type="button" data-cloud-action="refresh">Kontrollera anslutning</button>
          </div>
          <form class="drawer-form" id="cloud-login-form">
            <label>E-post<input name="email" type="email" placeholder="din e-post" required></label>
            <label>Lösenord<input name="password" type="password" placeholder="lösenord" required></label>
            <button class="primary-button" type="submit" ${configured ? "" : "disabled"}>Logga in mot Supabase</button>
          </form>
          <form class="drawer-form cloud-register-form" id="cloud-register-form">
            <div class="form-intro">
              <strong>Skapa konto</strong>
              <span>Kontot hamnar som väntande tills admin godkänner åtkomsten.</span>
            </div>
            <label>Namn<input name="fullName" type="text" placeholder="För- och efternamn" required></label>
            <label>E-post<input name="email" type="email" placeholder="namn@foretag.se" required></label>
            <label>Lösenord<input name="password" type="password" minlength="8" placeholder="minst 8 tecken" required></label>
            <label>Önskad roll
              <select name="requestedRole">
                ${Object.entries(roleLabels).map(([role, label]) => `<option value="${role}" ${role === "employee" ? "selected" : ""}>${escapeHtml(label)}</option>`).join("")}
              </select>
            </label>
            <label>Företag<input name="company" type="text" placeholder="Företag eller kundnamn"></label>
            <label>Meddelande<textarea name="note" rows="3" placeholder="Exempel: Jag arbetar med löner hos kunden."></textarea></label>
            <button class="primary-button" type="submit" ${configured ? "" : "disabled"}>Skicka kontoansökan</button>
          </form>
        `}
        <div class="info-banner warning-banner">
          Lokal data flyttas inte automatiskt än. Nästa produktionssteg är kontrollerad migrering, RLS-regler och admin-godkännande i Supabase.
        </div>
      `
    };
  }

  if (kind === "notifications") {
    const items = getNotificationItems();
    const groups = Object.entries(groupBy(items, (item) => item.group || "Övrigt"));
    return {
      eyebrow: "Aviseringar",
      title: items.length ? `${items.length} saker att följa upp` : "Allt är i fas",
      body: items.length ? `
        <div class="drawer-command-grid">
          ${groups.map(([group, groupItems]) => `
            <button type="button" data-drawer-command="${group === "Attest" ? "actionable-approvals" : group === "Fakturering" ? "invoice-ready" : group === "Kund" ? "portal-open" : "open-reports"}">
              <span>${escapeHtml(group)}</span>
              <strong>${groupItems.length}</strong>
            </button>
          `).join("")}
        </div>
        <div class="drawer-list">
          ${items.map((item) => `
            <article class="drawer-list-item ${escapeHtml(item.tone || "info")}">
              <div>
                <strong>${escapeHtml(item.title)}</strong>
                <span>${escapeHtml(item.text)}</span>
              </div>
              <button class="ghost-button small-button" type="button" data-drawer-view="${item.action}">${escapeHtml(item.actionLabel)}</button>
            </article>
          `).join("")}
        </div>
      ` : `
        <div class="empty-state">
          <svg viewBox="0 0 24 24"><path d="m5 12 4 4L19 6"></path></svg>
          <span>Inga öppna aviseringar just nu</span>
        </div>
      `
    };
  }

  if (kind === "help") {
    const activeView = getActiveViewName();
    const viewHelp = {
      dashboard: ["Startytan visar planering, nyheter, kalender och genvägar.", "Använd snabbsök eller aviseringar för att hoppa direkt till nästa uppgift."],
      time: ["Tidsrapportering är huvudflödet: timer, manuell tidsrad, kvitton, resor och månadsregistrering.", "Skicka utkast till attest innan de går vidare till lön eller faktura."],
      invoice: ["Fakturering samlar preliminära underlag, utkast och fakturahistorik.", "Klara underlag kan sparas som utkast eller skapas som faktura direkt."],
      reports: ["Rapporter visar rapportbibliotek, attestflöde, användare och kontoansökningar.", "Klicka på rapportresultat för att öppna rätt arbetsyta."],
      portal: ["Kundportalen är kundens yta för uppgifter, dokument, fakturor och kommentarer.", "Byrån kan skapa uppgifter och kunden kan lämna in underlag."],
      agreements: ["Avtal kan skapas, förhandsgranskas, skickas och användas som grund för e-signering.", "Arkivet håller signerade eller avslutade uppdrag separerade."],
      esign: ["E-signeringar följer status, påminnelsedatum och förfallodatum.", "När dokumentet är signerat kan kopplat avtal markeras som signerat."],
      clients: ["Kontakter är CRM-grunden för kunder, ansvariga, projekt, avtal och fakturering.", "Komplettera faktura-e-post och adress innan skarpa fakturor skickas."],
      projects: ["Projekt binder samman kund, arbetsorder, timmar, budget och fakturaunderlag.", "Projektkortet visar både ekonomi och underlag som behöver åtgärd."]
    };
    const help = viewHelp[activeView] || ["Den här vyn är kopplad till samma dataflöde.", "Använd rapporter och snabbsök för att hitta nästa åtgärd."];
    return {
      eyebrow: "Hjälp",
      title: `Hjälp för ${els.pageTitle.textContent}`,
      body: `
        <div class="info-banner">
          ${escapeHtml(help[0])} ${escapeHtml(help[1])}
        </div>
        <div class="drawer-list">
          <article class="drawer-list-item">
            <strong>1. Registrera underlag</strong>
            <span>Lägg in tid, kvitto eller resa och koppla det till kund och projekt.</span>
          </article>
          <article class="drawer-list-item">
            <strong>2. Skicka in och attestera</strong>
            <span>Utkast skickas in till attest. Godkänt underlag kan gå vidare till lön och faktura.</span>
          </article>
          <article class="drawer-list-item">
            <strong>3. Skapa fakturaunderlag</strong>
            <span>Fakturering tar bara med attesterade poster som ännu inte är fakturerade.</span>
          </article>
        </div>
        <div class="drawer-workflow">
          <span>Rekommenderat flöde</span>
          <strong>Tid → Attest → Faktura/Lön → Kundportal</strong>
          <small>Alla steg finns i appen och binds samman av status på tidsrader, kvitton, avtal och fakturor.</small>
        </div>
        <div class="drawer-actions">
          <button class="primary-button" type="button" data-drawer-view="time">Ny registrering</button>
          <button class="ghost-button" type="button" data-drawer-view="reports">Öppna attestflöde</button>
          <button class="ghost-button" type="button" data-drawer-view="invoice">Fakturering</button>
        </div>
      `
    };
  }

  if (kind === "settings") {
    return {
      eyebrow: "Inställningar",
      title: "Byråprofil och regler",
      body: `
        <form class="drawer-form" id="settings-form">
          <div class="drawer-form-section">
            <strong>Byråprofil</strong>
            <label>Företagsnamn<input id="settings-company" type="text" value="${escapeHtml(settings.companyName)}"></label>
            <label>Admin e-post<input id="settings-email" type="email" value="${escapeHtml(settings.adminEmail)}"></label>
            <label>Standard timpris<input id="settings-rate" type="number" min="0" step="50" value="${Number(settings.defaultRate || 0)}"></label>
            <label>Normal arbetsdag, timmar<input id="settings-workday-hours" type="number" min="0" step="0.5" value="${Number(settings.workdayHours ?? 8)}"></label>
          </div>
          <div class="drawer-form-section">
            <strong>Tid och attest</strong>
            <label>Attestregel
              <select id="settings-approval">
                <option value="admin" ${settings.approvalMode === "admin" ? "selected" : ""}>Admin attesterar allt</option>
                <option value="owner" ${settings.approvalMode === "owner" ? "selected" : ""}>Kundansvarig attesterar</option>
                <option value="self" ${settings.approvalMode === "self" ? "selected" : ""}>Egen attest tillåten</option>
              </select>
            </label>
            <label>Vecka låses<input id="settings-lock-day" type="text" value="${escapeHtml(settings.weekLockDay)}"></label>
            <label>Standard förfallodagar för kunduppgift<input id="settings-default-due-days" type="number" min="1" step="1" value="${Number(settings.defaultDueDays || 7)}"></label>
          </div>
          <div class="drawer-form-section">
            <strong>Fakturering</strong>
            <label>Fakturaprefix<input id="settings-invoice-prefix" type="text" value="${escapeHtml(settings.invoicePrefix || "F")}"></label>
            <label>Nästa fakturanummer<input id="settings-next-invoice" type="number" min="1" step="1" value="${Number(settings.nextInvoiceNumber || 1)}"></label>
            <label>Standard betalvillkor<input id="settings-payment-terms" type="number" min="0" step="1" value="${Number(settings.paymentTerms || 10)}"></label>
            <label>Standard moms %<input id="settings-vat-rate" type="number" min="0" step="1" value="${Number(settings.vatRate ?? 25)}"></label>
            <label>Påminnelse efter dagar<input id="settings-invoice-reminder-days" type="number" min="1" step="1" value="${Number(settings.invoiceReminderDays || 5)}"></label>
            <label>Bankgiro<input id="settings-bankgiro" type="text" value="${escapeHtml(settings.bankgiro || "")}"></label>
            <label>Fakturatext<input id="settings-invoice-footer" type="text" value="${escapeHtml(settings.invoiceFooter || "")}"></label>
          </div>
          <div class="drawer-form-section">
            <strong>Kundportal</strong>
            <label class="drawer-checkbox"><input id="settings-portal-auto-notify" type="checkbox" ${settings.portalAutoNotify === false ? "" : "checked"}> Skapa avisering när kunduppgift läggs upp</label>
            <label class="drawer-checkbox"><input id="settings-customer-approval-required" type="checkbox" ${settings.customerApprovalRequired === false ? "" : "checked"}> Kund ska kunna godkänna fakturor i portalen</label>
          </div>
          <button class="primary-button" type="submit">Spara inställningar</button>
        </form>
      `
    };
  }

  return {
    eyebrow: "Information",
    title: settings.companyName,
    body: `
      ${renderDrawerKpis(getSystemHealthItems())}
      <div class="drawer-list">
        <article class="drawer-list-item">
          <strong>Lokal prototyp</strong>
          <span>All data sparas i din webbläsare just nu. Nästa produktionssteg är databas, inloggning och roller.</span>
        </article>
        <article class="drawer-list-item">
          <strong>Aktiva moduler</strong>
          <span>Tid, kvitton, resor, kunder, avtal, e-signering, attest, rapporter och fakturaunderlag.</span>
        </article>
        <article class="drawer-list-item">
          <strong>Roll och behörighet</strong>
          <span>Aktiv roll är ${escapeHtml(roleLabels[getCurrentUser().role] || getCurrentUser().role)}. Behörighet styr vilka vyer rollen kan öppna.</span>
        </article>
      </div>
      <div class="drawer-actions">
        <button class="ghost-button" type="button" data-drawer-view="reports">Se rapporter</button>
        <button class="primary-button" type="button" data-drawer-view="clients">Öppna kunder</button>
        <button class="ghost-button" type="button" data-drawer-command="admin-users">Roller och konton</button>
      </div>
    `
  };
}

function renderShortcuts() {
  if (!els.shortcutList) return;
  els.shortcutList.innerHTML = state.shortcuts.map((shortcut, index) => `
    <button data-shortcut-index="${index}" type="button">${escapeHtml(shortcut.label)}</button>
  `).join("");
}

function updateNewsTab(tab) {
  const latestPost = state.newsPosts[0];
  const content = {
    feed: {
      title: "Välkommen till Novadex Tid & Löner!",
      body: "<strong>Välkommen!</strong> Här samlas rutiner, nyheter och länkar för byråns tidrapportering.",
      extra: "Följ flödet: registrera tid mot kund, interntid eller frånvaro, koppla till projekt/arbetsorder och attestera innan underlaget går vidare."
    },
    routine: {
      title: "Rutin för tid, kvitton och attest",
      body: "<strong>Veckorutin:</strong> alla medarbetare rapporterar tid senast fredag och ansvarig attesterar innan löne- och fakturaunderlag skapas.",
      extra: "Kvitton, milersättning och traktamente kopplas mot kund/projekt när de ska faktureras vidare."
    },
    news: {
      title: "Nyhet: avtal och e-signering är kopplade",
      body: "<strong>Nytt i appen:</strong> avtal kan skapas, skickas som mejlutkast, laddas ner och ligga till grund för e-signering.",
      extra: "Faktureringen samlar preliminära underlag och utkast så att arbetad tid, fastpris och övriga kostnader syns på samma ställe."
    },
    archive: {
      title: "Arkiv",
      body: "<strong>Arkiverade inlägg:</strong> här hamnar äldre rutiner och nyheter när de inte längre ska ligga i flödet.",
      extra: state.newsPosts.length ? state.newsPosts.map((post) => `${post.date}: ${post.title}`).join(" · ") : "Det finns inga lokala inlägg arkiverade ännu."
    },
    draft: {
      title: latestPost?.title || "Nytt inlägg",
      body: latestPost ? `<strong>${escapeHtml(latestPost.category)}:</strong> ${escapeHtml(latestPost.body)}` : "<strong>Utkast:</strong> skriv en intern nyhet, rutin eller instruktion till teamet.",
      extra: latestPost ? `Sparat ${latestPost.date} av ${latestPost.author}.${latestPost.comments?.length ? ` Kommentarer: ${latestPost.comments.map((comment) => `${comment.author}: ${comment.body}`).join(" · ")}` : ""}` : "Skapa ett inlägg via knappen Nytt inlägg."
    }
  }[tab];

  if (!content) return;
  els.newsTitle.textContent = content.title;
  els.newsBody.innerHTML = content.body;
  els.newsBodyExtra.textContent = content.extra;
}

function updateNewsReactions() {
  if (els.newsReactions) {
    const savedComments = state.newsPosts.reduce((sum, post) => sum + (post.comments?.length || 0), 0);
    els.newsReactions.textContent = `${newsLikes} gillar · ${newsComments + savedComments} kommentarer`;
  }
}

function runGlobalSearch(query) {
  const normalized = query.trim().toLowerCase();
  if (!normalized) return;

  const clientMatch = state.clients.find((client) => `${client.name} ${client.org} ${client.email}`.toLowerCase().includes(normalized) && isClientVisible(client));
  if (clientMatch) {
    selectedClientId = clientMatch.id;
    setView("clients");
    renderClients();
    showToast(`Hittade kunden ${clientMatch.name}.`);
    return;
  }

  const projectMatch = state.projects.find((project) => `${project.name} ${project.description} ${getClient(project.clientId)?.name || ""}`.toLowerCase().includes(normalized) && isProjectVisible(project));
  if (projectMatch) {
    selectedProjectId = projectMatch.id;
    setView("projects");
    renderProjects();
    showToast(`Hittade projektet ${projectMatch.name}.`);
    return;
  }

  const invoiceMatch = (state.invoices || []).find((invoice) => `${invoice.number} ${getClient(invoice.clientId)?.name || ""} ${getProject(invoice.projectId)?.name || ""}`.toLowerCase().includes(normalized) && isClientVisible(getClient(invoice.clientId)));
  if (invoiceMatch) {
    setView("invoice");
    openInvoiceRecordDetail(invoiceMatch.id);
    showToast(`Hittade faktura ${invoiceMatch.number}.`);
    return;
  }

  const agreementMatch = state.agreements.find((agreement) => `${agreement.title} ${agreement.type} ${getClient(agreement.clientId)?.name || ""}`.toLowerCase().includes(normalized) && isClientVisible(getClient(agreement.clientId)));
  if (agreementMatch) {
    setView("agreements");
    openAgreementDetail(agreementMatch.id);
    showToast(`Hittade avtalet ${agreementMatch.title}.`);
    return;
  }

  const portalMatch = (state.portalTasks || []).find((task) => `${task.title} ${task.message} ${getClient(task.clientId)?.name || ""}`.toLowerCase().includes(normalized) && isClientVisible(getClient(task.clientId)));
  if (portalMatch) {
    setView("portal");
    if (els.portalClient) els.portalClient.value = portalMatch.clientId;
    renderPortal();
    showToast(`Hittade portalärendet ${portalMatch.title}.`);
    return;
  }

  const target = [
    { keys: ["tid", "kvitto", "kvitton", "frånvaro", "resa", "traktamente", "milersättning"], view: "time" },
    { keys: ["uppgift", "uppgifter", "attest", "attestera", "godkänn", "godkänna"], view: "tasks" },
    { keys: ["kund", "kunder", "kontakt", "kontakter"], view: "clients" },
    { keys: ["affär", "affärer", "sälj", "säljtavla", "offert", "offerter"], view: "sales" },
    { keys: ["projekt", "arbetsorder"], view: "projects" },
    { keys: ["avtal", "kundavtal"], view: "agreements" },
    { keys: ["sign", "signering", "e-signering"], view: "esign" },
    { keys: ["faktura", "fakturering", "fakturera", "underlag"], view: "invoice" },
    { keys: ["planering", "resurs", "resursplanering", "schema", "kapacitet"], view: "planning" },
    { keys: ["rapport", "rapporter", "lön", "löner"], view: "reports" },
    { keys: ["analys", "nyckeltal", "debiteringsgrad", "uppföljning"], view: "analysis" },
    { keys: ["portal", "ärende", "kundportal", "underlag"], view: "portal" },
    { keys: ["samarbete", "samarbetsyta", "delning", "kunddialog"], view: "collaboration" },
    { keys: ["version", "versioner", "testa", "testläge"], view: "versions" },
    { keys: ["admin", "inställning", "inställningar", "konto", "konton", "roller", "behörighet"], view: "reports", scrollTarget: "admin-overview" }
  ].find((item) => item.keys.some((key) => normalized.includes(key)));

  if (target) {
    setView(target.view);
    scrollToPageTarget(target.scrollTarget);
    showToast(`Öppnade ${viewTitles[target.view].toLowerCase()} via snabbsök.`);
    return;
  }

  showToast("Jag hittade ingen exakt träff, men snabbsöket är nu kopplat.");
}

function setAgreementTab(tab) {
  els.agreementTabs.forEach((button) => button.classList.toggle("active", button.dataset.agreementTab === tab));
  els.agreementStatusFilter.value = tab === "archived" ? "archived" : "all";
  renderAgreements();
}

function handleClientAction(event) {
  const target = event.target.closest("[data-open-client], [data-client-time], [data-client-project], [data-client-docs], [data-client-agreement], [data-client-esign], [data-client-portal], [data-client-approval], [data-client-invoice], [data-delete-client]");
  if (!target) return false;

  const clientId = target.dataset.openClient
    || target.dataset.clientTime
    || target.dataset.clientProject
    || target.dataset.clientDocs
    || target.dataset.clientAgreement
    || target.dataset.clientEsign
    || target.dataset.clientPortal
    || target.dataset.clientApproval
    || target.dataset.clientInvoice
    || target.dataset.deleteClient;
  const client = getClient(clientId);
  if (!client) return false;

  if (!target.matches("[data-delete-client]")) {
    selectedClientId = clientId;
  }

  if (target.matches("[data-open-client]")) {
    renderClients();
    showToast(`Öppnade kundkort för ${client.name}.`);
    return true;
  }

  if (target.matches("[data-client-time]")) {
    els.entryClient.value = clientId;
    els.timerClient.value = clientId;
    els.filterClient.value = clientId;
    setView("time");
    focusElement(els.entryTask);
    renderEntriesTable();
    showToast(`Tidrapportering för ${client.name} är förvald.`);
    return true;
  }

  if (target.matches("[data-client-project]")) {
    els.projectClient.value = clientId;
    setView("projects");
    focusElement(els.projectName);
    showToast(`Nytt projekt kopplas till ${client.name}.`);
    return true;
  }

  if (target.matches("[data-client-docs]")) {
    els.receiptClient.value = clientId;
    els.travelClient.value = clientId;
    els.agreementClient.value = clientId;
    els.agreementEmail.value = client.billingEmail || client.email || "";
    els.agreementProject.value = state.projects.find((project) => project.clientId === clientId)?.id || "";
    setView("time");
    focusElement(els.receiptSupplier);
    showToast(`Kvitton och underlag kopplas till ${client.name}.`);
    return true;
  }

  if (target.matches("[data-client-agreement]")) {
    els.agreementClient.value = clientId;
    els.agreementEmail.value = client.billingEmail || client.email || "";
    els.agreementProject.value = state.projects.find((project) => project.clientId === clientId)?.id || "";
    els.agreementTitle.value = els.agreementTitle.value || `Kundavtal ${client.name}`;
    els.agreementOwner.value = client.owner || getCurrentUser().name;
    setAgreementTab("active");
    setView("agreements");
    focusElement(els.agreementTitle);
    showToast(`Nytt avtal förbereds för ${client.name}.`);
    return true;
  }

  if (target.matches("[data-client-esign]")) {
    const agreement = state.agreements.find((item) => item.clientId === clientId && item.status !== "signed" && item.status !== "archived")
      || state.agreements.find((item) => item.clientId === clientId);
    els.esignClient.value = clientId;
    els.esignAgreement.value = agreement?.id || "";
    els.esignTitle.value = agreement ? `Signering av ${agreement.title}` : `Signering ${client.name}`;
    els.esignOwner.value = agreement?.owner || client.owner || getCurrentUser().name;
    els.esignMessage.value = agreement?.message || `Hej, här kommer dokument för signering från ${state.settings.companyName}.`;
    setView("esign");
    focusElement(els.esignTitle);
    showToast(`E-signering förbereds för ${client.name}.`);
    return true;
  }

  if (target.matches("[data-client-portal]")) {
    if (els.portalClient) els.portalClient.value = clientId;
    setView("portal");
    renderPortal();
    showToast(`Kundportalen visar ${client.name}.`);
    return true;
  }

  if (target.matches("[data-client-approval]")) {
    if (els.approvalSearch) els.approvalSearch.value = client.name;
    if (els.approvalKindFilter) els.approvalKindFilter.value = "all";
    if (els.approvalStatusFilter) els.approvalStatusFilter.value = "submitted";
    setView("reports");
    renderApprovalFlow();
    showToast(`Attestflödet filtrerades på ${client.name}.`);
    return true;
  }

  if (target.matches("[data-client-invoice]")) {
    els.invoiceSearch.value = client.name;
    els.invoiceTabs.forEach((button) => button.classList.toggle("active", button.dataset.invoiceTab === "preliminary"));
    setView("invoice");
    renderInvoiceWorkbench();
    showToast(`Fakturaunderlag filtrerat på ${client.name}.`);
    return true;
  }

  return false;
}

function getApprovalTarget(kind, id) {
  const collections = {
    entry: state.entries,
    receipt: state.receipts,
    travel: state.travels
  };
  return collections[kind]?.find((item) => item.id === id);
}

function setApprovalStatus(kind, id, status, note = "") {
  const target = getApprovalTarget(kind, id);
  if (!target) return false;
  if (target.status === "invoiced") {
    showToast("Posten är redan fakturerad och är låst.", "warning");
    return false;
  }
  if (target.date && isDateLocked(target.date)) {
    showToast("Perioden är låst. Lås upp perioden innan status ändras.", "warning");
    return false;
  }
  target.status = status;
  target.reviewNote = note;
  return true;
}

async function handleApprovalAction(action, kind, id, options = {}) {
  if (!action || !kind || !id) return false;
  if (kind === "agreement") return handleAgreementWorkflowAction(action, id, options);
  if (kind === "esign") return handleEsignWorkflowAction(action, id, options);
  if (kind === "invoice") return handleInvoiceWorkflowAction(action, id, options);

  const messages = {
    submit: "Underlaget skickades in för attest.",
    approve: "Underlaget attesterades.",
    reject: "Underlaget avvisades."
  };

  if (action === "reject") {
    const note = options.note ?? window.prompt("Skriv gärna varför underlaget avvisas:", "Komplettera underlaget.");
    if (note === null) return false;
    if (!setApprovalStatus(kind, id, "rejected", note.trim() || "Komplettera underlaget.")) return false;
  } else if (action === "approve") {
    if (!setApprovalStatus(kind, id, "approved")) return false;
  } else if (action === "submit") {
    if (!setApprovalStatus(kind, id, "submitted")) return false;
  } else {
    return false;
  }

  if (kind === "entry" && canUseCloudData()) {
    const entry = state.entries.find((item) => item.id === id);
    if (entry) {
      try {
        const savedEntry = await saveCloudEntry(entry);
        if (savedEntry?.id) Object.assign(entry, savedEntry);
      } catch (error) {
        showToast(`Atteststatus sparades lokalt men inte i Supabase: ${error.message}`, "warning");
      }
    }
  }

  saveState();
  renderAll();
  if (!options.silent) showToast(messages[action]);
  return true;
}

function runExpenseBulkAction(kind, action) {
  const config = {
    receipt: {
      label: "kvitton",
      singular: "kvitto",
      getItems: getFilteredReceipts,
      submitFrom: ["draft", "rejected"],
      approveFrom: ["submitted"]
    },
    travel: {
      label: "resor",
      singular: "resa",
      getItems: getFilteredTravels,
      submitFrom: ["draft", "rejected"],
      approveFrom: ["submitted"]
    }
  }[kind];
  if (!config) return;

  const fromStatuses = action === "approve" ? config.approveFrom : config.submitFrom;
  const nextStatus = action === "approve" ? "approved" : "submitted";
  const rows = config.getItems().filter((item) => fromStatuses.includes(item.status || "draft"));

  if (!rows.length) {
    showToast(`Inga ${config.label} matchade åtgärden.`, "warning");
    return;
  }

  let count = 0;
  rows.forEach((item) => {
    if (setApprovalStatus(kind, item.id, nextStatus)) count += 1;
  });

  if (!count) {
    showToast(`Inga ${config.label} kunde uppdateras.`, "warning");
    return;
  }

  saveState();
  renderAll();
  showToast(`${count} ${count === 1 ? config.singular : config.label} ${action === "approve" ? "attesterades" : "skickades in"}.`);
}

function toggleExpenseFlag(kind, id, field) {
  const collection = kind === "travel" ? state.travels : state.receipts;
  const item = collection.find((row) => row.id === id);
  if (!item) return;

  if (isLockedStatus(item.status)) {
    showToast("Attesterade och fakturerade underlag är låsta.", "warning");
    return;
  }

  item[field] = !item[field];
  saveState();
  renderAll();
  const target = field === "billable" ? "fakturering" : "lön";
  showToast(`${item[field] ? "Markerad för" : "Borttagen från"} ${target}.`);
}

function handleAgreementWorkflowAction(action, id, options = {}) {
  const agreement = getAgreement(id);
  if (!agreement) return false;

  if (action === "submit") {
    agreement.status = "sent";
    agreement.sentAt = isoToday;
    prepareAgreementEmail(agreement);
    if (!options.silent) showToast("Mejlutkast för avtalet öppnades och avtalet markerades som skickat.");
  } else if (action === "approve") {
    agreement.status = "signed";
    agreement.signedAt = isoToday;
    state.esignatures
      .filter((item) => item.agreementId === agreement.id)
      .forEach((item) => {
        item.status = "signed";
        item.signedAt = isoToday;
      });
    if (!options.silent) showToast("Avtalet markerades som signerat.");
  } else if (action === "reject") {
    agreement.status = "draft";
    const note = options.note ?? window.prompt("Anteckning till avtalet:", "Behöver justeras innan utskick.");
    if (note === null) return false;
    agreement.reviewNote = note || "";
    if (!options.silent) showToast("Avtalet flyttades tillbaka till utkast.");
  } else {
    return false;
  }

  saveState();
  renderAll();
  return true;
}

function handleEsignWorkflowAction(action, id, options = {}) {
  const item = state.esignatures.find((signature) => signature.id === id);
  if (!item) return false;

  if (action === "submit") {
    if (!prepareEsignEmail(item)) return false;
    if (!options.silent) showToast("Mejlutkast för signeringen öppnades.");
  } else if (action === "approve") {
    item.status = "signed";
    item.signedAt = isoToday;
    const agreement = getAgreement(item.agreementId);
    if (agreement) {
      agreement.status = "signed";
      agreement.signedAt = isoToday;
    }
    if (!options.silent) showToast("Signeringen markerades som signerad.");
  } else if (action === "remind") {
    if (!prepareEsignEmail(item, true)) return false;
    item.reminderDate = isoToday;
    if (!options.silent) showToast("Påminnelseutkast öppnades.");
  } else {
    return false;
  }

  saveState();
  renderAll();
  return true;
}

function handleInvoiceWorkflowAction(action, id, options = {}) {
  const invoice = (state.invoices || []).find((item) => item.id === id);
  if (!invoice) return false;

  if (action === "submit") {
    if (!sendInvoiceEmail(invoice.id)) return false;
    if (!options.silent) showToast("E-postutkast öppnades och fakturan markerades som skickad.");
  } else if (action === "approve") {
    if (!setInvoiceStatus(invoice.id, "paid")) return false;
    if (!options.silent) showToast("Fakturan markerades som betald.");
  } else if (action === "reject") {
    if (getEffectiveInvoiceStatus(invoice) === "changeRequested") {
      if (!reopenInvoice(invoice.id)) return false;
      if (!options.silent) showToast("Fakturan återöppnades för ändring.");
      saveState();
      renderAll();
      return true;
    }
    if (!options.confirmedCredit && !window.confirm("Vill du markera fakturan som krediterad?")) return false;
    if (!setInvoiceStatus(invoice.id, "credited")) return false;
    if (!options.silent) showToast("Fakturan markerades som krediterad.");
  } else {
    return false;
  }

  saveState();
  renderAll();
  return true;
}

async function updateEditedEntity(form) {
  const kind = form.dataset.editForm;
  const id = form.dataset.editId;
  const data = new FormData(form);

  if (kind === "client") {
    const client = getClient(id);
    if (!client) return false;
    client.name = data.get("name").trim();
    client.org = data.get("org").trim();
    client.email = data.get("email").trim();
    client.owner = data.get("owner").trim();
    client.rate = Number(data.get("rate") || 0);
    client.billingEmail = data.get("billingEmail").trim();
    client.invoiceReference = data.get("invoiceReference").trim();
    client.invoiceAddress = data.get("invoiceAddress").trim();
    client.paymentTerms = data.get("paymentTerms").trim();
    client.vatRate = data.get("vatRate").trim();
    if (canUseCloudData()) {
      try {
        const savedClient = await saveCloudClient(client);
        if (savedClient?.id) {
          const oldId = client.id;
          Object.assign(client, savedClient);
          remapClientId(oldId, savedClient.id);
        }
      } catch (error) {
        showToast(`Kundändringen sparades lokalt men inte i Supabase: ${error.message}`, "warning");
      }
    }
  }

  if (kind === "project") {
    const project = getProject(id);
    if (!project) return false;
    project.name = data.get("name").trim();
    project.clientId = data.get("clientId");
    project.manager = data.get("manager").trim();
    project.start = data.get("start");
    project.status = data.get("status");
    project.budget = Number(data.get("budget") || 0);
    project.fixedPrice = Number(data.get("fixedPrice") || 0);
    project.description = data.get("description").trim();
    if (canUseCloudData()) {
      try {
        const savedProject = await saveCloudProject(project);
        if (savedProject?.id) {
          const oldId = project.id;
          Object.assign(project, savedProject);
          remapProjectId(oldId, savedProject.id);
        }
      } catch (error) {
        showToast(`Projektändringen sparades lokalt men inte i Supabase: ${error.message}`, "warning");
      }
    }
  }

  if (kind === "entry") {
    const entry = state.entries.find((item) => item.id === id);
    if (!entry) return false;
    entry.date = data.get("date");
    entry.employee = data.get("employee").trim();
    entry.type = data.get("type");
    entry.clientId = data.get("clientId");
    entry.projectId = data.get("projectId");
    entry.workOrder = data.get("workOrder").trim();
    entry.task = data.get("task").trim();
    entry.hours = Number(data.get("hours") || 0);
    entry.status = data.get("status");
    entry.billable = data.has("billable");
    entry.payroll = data.has("payroll");
    entry.description = data.get("description").trim();
    if (canUseCloudData()) {
      try {
        const savedEntry = await saveCloudEntry(entry);
        if (savedEntry?.id) {
          const oldId = entry.id;
          Object.assign(entry, savedEntry);
          remapEntryId(oldId, savedEntry.id);
        }
      } catch (error) {
        showToast(`Tidsraden sparades lokalt men inte i Supabase: ${error.message}`, "warning");
      }
    }
  }

  if (kind === "receipt") {
    const receipt = state.receipts.find((item) => item.id === id);
    if (!receipt) return false;
    receipt.date = data.get("date");
    receipt.supplier = data.get("supplier").trim();
    receipt.amount = Number(data.get("amount") || 0);
    receipt.vat = Number(data.get("vat") || 0);
    receipt.clientId = data.get("clientId");
    receipt.projectId = data.get("projectId");
    receipt.status = data.get("status");
    receipt.billable = data.has("billable");
    receipt.payroll = data.has("payroll");
    const uploadedFile = await readFileInput(form.elements.receiptFile);
    if (uploadedFile) Object.assign(receipt, uploadedFile);
  }

  if (kind === "travel") {
    const travel = state.travels.find((item) => item.id === id);
    if (!travel) return false;
    travel.date = data.get("date");
    travel.type = data.get("type");
    travel.from = data.get("from").trim();
    travel.to = data.get("to").trim();
    travel.quantity = Number(data.get("quantity") || 0);
    travel.clientId = data.get("clientId");
    travel.status = data.get("status");
    travel.billable = data.has("billable");
    travel.payroll = data.has("payroll");
  }

  if (kind === "agreement") {
    const agreement = getAgreement(id);
    if (!agreement) return false;
    agreement.title = data.get("title").trim();
    agreement.clientId = data.get("clientId");
    agreement.projectId = data.get("projectId");
    agreement.clientEmail = data.get("clientEmail").trim() || getClient(agreement.clientId)?.billingEmail || getClient(agreement.clientId)?.email || "";
    agreement.owner = data.get("owner").trim();
    agreement.type = data.get("type").trim();
    agreement.label = data.get("label").trim();
    agreement.watchDate = data.get("watchDate");
    agreement.endDate = data.get("endDate");
    agreement.price = data.get("price").trim();
    agreement.payment = data.get("payment").trim();
    agreement.scope = data.get("scope").trim();
    agreement.message = data.get("message").trim();
    agreement.status = data.get("status");
    if (agreement.status === "signed" && !agreement.signedAt) agreement.signedAt = isoToday;
    if (agreement.status === "archived" && !agreement.archivedAt) agreement.archivedAt = isoToday;
  }

  if (kind === "esign") {
    const item = state.esignatures.find((signature) => signature.id === id);
    if (!item) return false;
    item.title = data.get("title").trim();
    item.docType = data.get("docType").trim();
    item.agreementId = data.get("agreementId");
    item.clientId = data.get("clientId");
    item.owner = data.get("owner").trim();
    item.reminderDate = data.get("reminderDate");
    item.dueDate = data.get("dueDate");
    item.message = data.get("message").trim();
    item.status = data.get("status");
    if (item.status === "sent" && !item.sentAt) item.sentAt = isoToday;
    if (item.status === "signed") {
      const agreement = getAgreement(item.agreementId);
      if (agreement) agreement.status = "signed";
    }
  }

  saveState();
  closeDrawer();
  renderAll();
  showToast("Ändringarna sparades.");
  return true;
}

function renderAll() {
  renderBranding();
  renderShortcuts();
  renderClientOptions();
  renderDashboard();
  renderTasks();
  renderEntriesTable();
  renderTimePeriodOverview();
  renderClients();
  renderSales();
  renderProjects();
  renderReceipts();
  renderTravels();
  renderAgreements();
  renderEsignatures();
  renderInvoiceWorkbench();
  renderInvoiceCommandStrip();
  renderPlanning();
  renderAnalysis();
  renderPortal();
  renderCollaboration();
  renderVersions();
  renderReports();
}

function setView(viewName) {
  if (!canAccessView(viewName)) {
    showToast("Den här rollen har inte åtkomst till den vyn i prototypen.", "warning");
    viewName = getDefaultViewForCurrentUser();
  }
  els.navItems.forEach((button) => button.classList.toggle("active", button.dataset.view === viewName));
  els.navGroups?.forEach((group) => {
    const groupView = group.dataset.navGroup;
    const hasShortcut = Boolean(group.querySelector(`[data-view-shortcut="${viewName}"]`));
    group.classList.toggle("open", groupView === viewName || hasShortcut);
  });
  els.moduleItems.forEach((button) => button.classList.remove("active"));
  els.views.forEach((view) => view.classList.toggle("active", view.id === `${viewName}-view`));
  els.pageTitle.textContent = viewTitles[viewName] || "Start";
  syncHashToView(viewName);
}

function scrollToPageTarget(targetId) {
  if (!targetId) return;
  window.setTimeout(() => {
    const target = document.getElementById(targetId);
    target?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, 40);
}

function openModule(moduleName, button) {
  const moduleTargets = {
    tasks: "tasks",
    sales: "sales",
    projects: "projects",
    planning: "planning",
    analysis: "analysis",
    partner: "collaboration"
  };
  const targetView = moduleTargets[moduleName] || "dashboard";
  setView(targetView);
  els.navItems.forEach((item) => item.classList.remove("active"));
  button.classList.add("active");
  els.pageTitle.textContent = viewTitles[targetView] || button.textContent.trim();
  showToast(`Öppnade ${viewTitles[targetView]?.toLowerCase() || button.textContent.trim().toLowerCase()}.`);
}

function setTimePeriodMode(mode, anchorDate = selectedTimeAnchorDate) {
  selectedTimePeriodMode = mode || "day";
  selectedTimeAnchorDate = anchorDate || isoToday;
  els.periodModes?.forEach((button) => {
    button.classList.toggle("active", button.dataset.periodMode === selectedTimePeriodMode);
  });
  renderTimePeriodOverview();
  renderEntriesTable();
}

async function addEntry(entry) {
  if (isDateLocked(entry.date || selectedTimeAnchorDate)) {
    showToast("Perioden är låst. Lås upp perioden innan du lägger till eller ändrar tid.", "warning");
    return null;
  }
  const row = {
    id: makeId(),
    date: entry.date,
    employee: entry.employee,
    type: entry.type,
    clientId: entry.clientId,
    projectId: entry.projectId || "",
    workOrder: entry.workOrder || "",
    task: entry.task,
    hours: Number(entry.hours),
    billable: Boolean(entry.billable),
    payroll: Boolean(entry.payroll),
    status: entry.status,
    reviewNote: "",
    description: entry.description || ""
  };
  if (canUseCloudData()) {
    try {
      const savedEntry = await saveCloudEntry(row);
      if (savedEntry?.id) Object.assign(row, savedEntry);
    } catch (error) {
      showToast(`Tidsraden sparades lokalt men inte i Supabase: ${error.message}`, "warning");
    }
  }
  state.entries.unshift(row);
  saveState();
  renderAll();
  return row;
}

function prepareTimerContext({ clientId = "", projectId = "", workOrder = "", task = "Bokföring", type = "project", description = "" } = {}) {
  const client = getClient(clientId) || state.clients.find(isClientVisible) || state.clients[0];
  const project = getProject(projectId);
  const resolvedClientId = clientId || project?.clientId || client?.id || "";
  if (resolvedClientId && els.timerClient) els.timerClient.value = resolvedClientId;
  if (projectId && els.timerProject) els.timerProject.value = projectId;
  if (!projectId && project?.id && els.timerProject) els.timerProject.value = project.id;
  if (els.timerType) els.timerType.value = type || "project";
  if (els.timerWorkOrder) els.timerWorkOrder.value = workOrder || project?.name || "";
  if (els.timerTask) els.timerTask.value = task || "Bokföring";
  if (els.timerDescription) els.timerDescription.value = description || "";
  syncTimerTypeControls();
}

function openTimerWithContext(context = {}) {
  prepareTimerContext(context);
  setView("time");
  window.setTimeout(() => {
    document.querySelector(".timer-panel")?.scrollIntoView({ behavior: "smooth", block: "center" });
    focusElement(els.timerWorkOrder);
  }, 50);
  showToast("Timern är förberedd. Klicka Starta när arbetet börjar.");
}

function copyPreviousEntryToForm() {
  const previous = state.entries
    .filter(isEntryVisible)
    .sort((a, b) => `${b.date}${b.id}`.localeCompare(`${a.date}${a.id}`))[0];
  if (!previous) {
    showToast("Det finns ingen tidigare tidsrad att kopiera.", "warning");
    return;
  }
  els.entryDate.value = isoToday;
  els.entryEmployee.value = getCurrentUser().name;
  els.entryType.value = previous.type || "project";
  els.entryClient.value = previous.clientId || "";
  els.entryProject.value = previous.projectId || "";
  els.entryWorkOrder.value = previous.workOrder || "";
  els.entryTask.value = previous.task || "Bokföring";
  els.entryHours.value = previous.hours || "1.0";
  els.entryStatus.value = "draft";
  els.entryBillable.checked = Boolean(previous.billable);
  els.entryPayroll.checked = previous.payroll ?? true;
  els.entryDescription.value = previous.description || "";
  syncEntryTypeControls();
  setView("time");
  focusElement(els.entryHours);
  showToast("Föregående tidsrad kopierades till manuell registrering.");
}

function getTimerSeconds() {
  if (!timer.running || !timer.startedAt) return timer.elapsedSeconds;
  return timer.elapsedSeconds + Math.round((Date.now() - timer.startedAt) / 1000);
}

function getTimerContextFromForm() {
  const client = getClient(els.timerClient.value);
  const project = getProject(els.timerProject.value);
  return {
    type: els.timerType.value,
    clientId: els.timerClient.value,
    projectId: els.timerProject.value,
    workOrder: els.timerWorkOrder.value.trim(),
    task: els.timerTask.value,
    description: els.timerDescription.value.trim(),
    clientName: client?.name || "Ingen kund",
    projectName: project?.name || els.timerWorkOrder.value.trim() || "Ingen arbetsorder"
  };
}

function resetTimerState() {
  window.clearInterval(timer.interval);
  timer.running = false;
  timer.startedAt = null;
  timer.elapsedSeconds = 0;
  timer.interval = null;
  timer.context = null;
}

function renderTimerControls() {
  const hasTime = getTimerSeconds() > 0;
  if (els.startTimer) {
    els.startTimer.disabled = timer.running;
    els.startTimer.innerHTML = `
      <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m8 5 11 7-11 7V5Z"></path></svg>
      ${hasTime && !timer.running ? "Fortsätt" : "Starta"}
    `;
  }
  if (els.pauseTimer) {
    els.pauseTimer.disabled = !timer.running;
    els.pauseTimer.innerHTML = `
      <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5v14M16 5v14"></path></svg>
      Pausa
    `;
  }
  if (els.stopTimer) els.stopTimer.disabled = !hasTime;
  if (els.timerStatus) {
    els.timerStatus.textContent = timer.running ? "Aktiv" : hasTime ? "Pausad" : "Pausad";
    els.timerStatus.classList.toggle("running", timer.running);
  }
  els.globalTimerButton?.classList.toggle("running", timer.running);
}

function renderTimerLiveMeta() {
  if (!els.timerLiveMeta) return;
  const context = timer.context || getTimerContextFromForm();
  const seconds = getTimerSeconds();
  const billableText = context.type === "project" ? "Debiterbar tid" : "Interntid";
  const hasContext = Boolean(context.clientId || context.projectId || context.workOrder || context.description);
  els.timerLiveMeta.innerHTML = seconds || hasContext ? `
    <strong>${escapeHtml(context.clientName)} · ${escapeHtml(context.projectName)}</strong>
    <span>${seconds ? "Aktiv/förberedd" : "Förberedd timer"} · ${escapeHtml(billableText)} · ${escapeHtml(context.task)}${context.description ? ` · ${escapeHtml(context.description)}` : ""}</span>
  ` : `
    <strong>Ingen aktiv timer</strong>
    <span>Välj kund, projekt och aktivitet innan du startar.</span>
  `;
}

function startTimer() {
  if (!els.timerClient.value) {
    showToast("Välj kund innan du startar timern.", "warning");
    return;
  }
  if (isDateLocked(isoToday)) {
    showToast("Dagens period är låst och kan inte ta emot ny tid.", "warning");
    return;
  }
  window.clearInterval(timer.interval);
  timer.context = getTimerContextFromForm();
  timer.running = true;
  timer.startedAt = Date.now();
  timer.interval = window.setInterval(updateTimerDisplay, 1000);
  updateTimerDisplay();
  showToast(timer.elapsedSeconds ? "Timern fortsätter." : "Timern startade.");
}

function pauseTimer() {
  if (!timer.running) return;
  timer.elapsedSeconds = getTimerSeconds();
  timer.running = false;
  timer.startedAt = null;
  window.clearInterval(timer.interval);
  timer.interval = null;
  updateTimerDisplay();
  showToast("Timern pausades.");
}

async function stopTimer() {
  const elapsedSeconds = getTimerSeconds();
  if (!elapsedSeconds) return;

  window.clearInterval(timer.interval);
  timer.elapsedSeconds = Math.max(60, elapsedSeconds);
  const hours = Math.max(0.1, Math.round((timer.elapsedSeconds / 3600) * 10) / 10);
  const context = timer.context || getTimerContextFromForm();

  const row = await addEntry({
    date: isoToday,
    employee: getCurrentUser().name,
    type: context.type,
    clientId: context.clientId,
    projectId: context.projectId,
    workOrder: context.workOrder,
    task: context.task,
    hours,
    billable: context.type === "project",
    payroll: true,
    status: "draft",
    description: context.description
  });
  if (!row) {
    resetTimerState();
    updateTimerDisplay();
    return;
  }

  resetTimerState();
  els.timerWorkOrder.value = "";
  els.timerDescription.value = "";
  updateTimerDisplay();
  showToast(`Timern sparade ${formatHours(hours)} som utkast.`);
}

function updateTimerDisplay() {
  const seconds = getTimerSeconds();
  const h = String(Math.floor(seconds / 3600)).padStart(2, "0");
  const m = String(Math.floor((seconds % 3600) / 60)).padStart(2, "0");
  const s = String(seconds % 60).padStart(2, "0");
  els.timerDisplay.textContent = `${h}:${m}:${s}`;
  if (els.globalTimerReadout) els.globalTimerReadout.textContent = `${h}:${m}:${s}`;
  renderTimerControls();
  renderTimerLiveMeta();
}

function syncEntryTypeControls() {
  const type = els.entryType.value;
  if (type === "project") {
    els.entryBillable.checked = true;
    els.entryBillable.disabled = false;
    els.entryPayroll.checked = true;
    if (els.entryTask.value === "Frånvaro") els.entryTask.value = "Bokföring";
  }

  if (type === "internal") {
    els.entryBillable.checked = false;
    els.entryBillable.disabled = true;
    els.entryPayroll.checked = true;
    if (els.entryTask.value === "Frånvaro") els.entryTask.value = "Intern administration";
    els.entryWorkOrder.placeholder = "Ex. Byråmöte, utbildning eller administration";
  }

  if (type === "absence") {
    els.entryBillable.checked = false;
    els.entryBillable.disabled = true;
    els.entryPayroll.checked = true;
    els.entryTask.value = "Frånvaro";
    els.entryWorkOrder.placeholder = "Ex. Semester, sjukfrånvaro eller VAB";
  }

  if (type === "project") {
    els.entryWorkOrder.placeholder = "Ex. Löpande redovisning";
  }
}

function syncTimerTypeControls() {
  const isProject = els.timerType.value === "project";
  els.timerWorkOrder.placeholder = isProject ? "Ex. Bokslut 2026" : "Ex. Byråmöte eller utbildning";
  if (!isProject) els.timerProject.value = "";
  renderTimerLiveMeta();
}

function syncClientFromProject(projectSelect, clientSelect) {
  const project = getProject(projectSelect?.value);
  if (!project || !clientSelect) return;
  clientSelect.value = project.clientId;
}

function applyQuickType(type) {
  if (type === "project") {
    els.entryType.value = "project";
    els.entryTask.value = "Bokföring";
    els.entryHours.value = "1.0";
  }

  if (type === "overtime") {
    els.entryType.value = "project";
    els.entryTask.value = "Övertid";
    els.entryHours.value = "2.0";
  }

  if (type === "travel") {
    els.entryType.value = "project";
    els.entryTask.value = "Resa";
    els.entryHours.value = "0.5";
    els.travelType.value = "mileage";
  }

  if (type === "allowance") {
    els.entryType.value = "project";
    els.entryTask.value = "Traktamente";
    els.entryHours.value = "0.1";
    els.travelType.value = "allowance";
  }

  if (type === "absence") {
    els.entryType.value = "absence";
    els.entryTask.value = "Frånvaro";
    els.entryHours.value = "8.0";
  }

  syncEntryTypeControls();
}

function getNextNumber(items, fallback) {
  const max = items.reduce((highest, item) => Math.max(highest, Number(item.number || 0)), fallback);
  return max + 1;
}

function createEsignatureFromAgreement(agreement) {
  const signature = {
    id: makeId(),
    number: getNextNumber(state.esignatures, 1000),
    title: `Signering av ${agreement.title}`,
    docType: "Avtal",
    agreementId: agreement.id,
    clientId: agreement.clientId,
    owner: agreement.owner,
    reminderDate: offsetDate(7),
    dueDate: offsetDate(14),
    message: agreement.message || "Hej, vänligen signera dokumentet när du har möjlighet.",
    status: "draft",
    sentAt: "",
    signedAt: "",
    reminderSentAt: ""
  };
  state.esignatures.push(signature);
  agreement.status = agreement.status === "signed" ? "signed" : "sent";
  return signature;
}

function openAgreementDetail(agreementId) {
  const agreement = getAgreement(agreementId);
  if (!agreement) {
    showToast("Avtalet kunde inte hittas.", "warning");
    return;
  }
  const client = getClient(agreement.clientId);
  const project = getProject(agreement.projectId);
  const signatures = state.esignatures.filter((item) => item.agreementId === agreement.id);
  const status = getEffectiveAgreementStatus(agreement);

  setDrawerContent({
    eyebrow: "Avtal",
    title: `${agreement.number} · ${agreement.title}`,
    body: `
      <div class="drawer-list">
        <article class="drawer-list-item">
          <div>
            <strong>${escapeHtml(client?.name || "Okänd kund")}</strong>
            <span>${escapeHtml(project?.name || "Inget projekt kopplat")} · ${escapeHtml(agreement.clientEmail || client?.email || "ingen e-post")}</span>
          </div>
          <span class="badge ${getAgreementBadgeClass(status)}">${escapeHtml(getAgreementStatusLabel(status))}</span>
        </article>
        <article class="drawer-list-item">
          <strong>Uppdrag</strong>
          <span>${escapeHtml(agreement.scope || "Ingen omfattning angiven")}</span>
        </article>
        <article class="drawer-list-item">
          <strong>Pris och villkor</strong>
          <span>${escapeHtml(agreement.price || "Ej angivet")} · ${escapeHtml(agreement.payment || "Ej angivet")}</span>
        </article>
        <article class="drawer-list-item">
          <strong>Datum</strong>
          <span>Bevakas ${agreement.watchDate || "-"} · slutar ${agreement.endDate || "-"}${agreement.sentAt ? ` · skickat ${agreement.sentAt}` : ""}${agreement.signedAt ? ` · signerat ${agreement.signedAt}` : ""}</span>
        </article>
      </div>
      <div class="invoice-timeline">
        <div><span></span><strong>Skapat</strong><em>${agreement.createdAt || "-"}</em></div>
        ${agreement.sentAt ? `<div><span></span><strong>Skickat</strong><em>${agreement.sentAt}</em></div>` : ""}
        ${agreement.signedAt ? `<div><span></span><strong>Signerat</strong><em>${agreement.signedAt}</em></div>` : ""}
        ${agreement.archivedAt ? `<div><span></span><strong>Arkiverat</strong><em>${agreement.archivedAt}</em></div>` : ""}
      </div>
      <div class="drawer-list">
        <article class="drawer-list-item">
          <strong>E-signeringar</strong>
          <span>${signatures.length ? signatures.map((item) => `${item.number} ${getEsignStatusLabel(getEffectiveEsignStatus(item)).toLowerCase()}`).join(" · ") : "Ingen e-signering skapad ännu"}</span>
        </article>
      </div>
      <div class="drawer-actions">
        <button class="ghost-button" type="button" data-preview-agreement="${agreement.id}">Förhandsgranska</button>
        <button class="ghost-button" type="button" data-send-agreement="${agreement.id}">Skicka avtal</button>
        <button class="ghost-button" type="button" data-esign-from-agreement="${agreement.id}">Skapa e-signering</button>
        <button class="primary-button" type="button" data-sign-agreement="${agreement.id}">Markera signerat</button>
      </div>
    `
  });
}

function openEsignDetail(signatureId) {
  const item = state.esignatures.find((signature) => signature.id === signatureId);
  if (!item) {
    showToast("Signeringen kunde inte hittas.", "warning");
    return;
  }
  const agreement = getAgreement(item.agreementId);
  const client = getClient(item.clientId);
  const status = getEffectiveEsignStatus(item);

  setDrawerContent({
    eyebrow: "E-signering",
    title: `${item.number} · ${item.title}`,
    body: `
      <div class="drawer-list">
        <article class="drawer-list-item">
          <div>
            <strong>${escapeHtml(client?.name || "Okänd signerare")}</strong>
            <span>${escapeHtml(agreement?.title || "Fristående dokument")} · ${escapeHtml(item.docType)}</span>
          </div>
          <span class="badge ${getEsignBadgeClass(status)}">${escapeHtml(getEsignStatusLabel(status))}</span>
        </article>
        <article class="drawer-list-item">
          <strong>Planering</strong>
          <span>Påminnelse ${item.reminderDate || "-"} · förfaller ${item.dueDate || "-"} · ansvarig ${escapeHtml(item.owner || "-")}</span>
        </article>
        <article class="drawer-list-item">
          <strong>Meddelande</strong>
          <span>${escapeHtml(item.message || "Inget meddelande")}</span>
        </article>
      </div>
      <div class="invoice-timeline">
        <div><span></span><strong>Skapad</strong><em>${item.createdAt || "-"}</em></div>
        ${item.sentAt ? `<div><span></span><strong>Skickad</strong><em>${item.sentAt}</em></div>` : ""}
        ${item.reminderSentAt ? `<div><span></span><strong>Påmind</strong><em>${item.reminderSentAt}</em></div>` : ""}
        ${item.signedAt ? `<div><span></span><strong>Signerad</strong><em>${item.signedAt}</em></div>` : ""}
      </div>
      <div class="drawer-actions">
        ${agreement ? `<button class="ghost-button" type="button" data-preview-agreement="${agreement.id}">Visa avtal</button>` : ""}
        <button class="ghost-button" type="button" data-send-esign="${item.id}">Skicka signering</button>
        <button class="ghost-button" type="button" data-remind-esign="${item.id}">Påminn</button>
        <button class="primary-button" type="button" data-sign-esign="${item.id}">Markera signerad</button>
      </div>
    `
  });
}

function buildAgreementDocument(agreement) {
  const client = getClient(agreement.clientId) || {};
  const createdDate = isoToday;
  const scope = agreement.scope || "Redovisningsbyrån utför de tjänster som parterna löpande kommer överens om inom redovisning, löner, skatt, deklaration och rådgivning.";
  const price = agreement.price || "Löpande enligt aktuell prislista eller separat offert.";
  const payment = agreement.payment || "10 dagar netto.";

  return `<!doctype html>
<html lang="sv">
<head>
  <meta charset="utf-8">
  <title>${escapeHtml(agreement.title)} | Novadex Tid & Löner</title>
  <style>
    body { margin: 0; background: #f4f3ef; color: #1f2528; font-family: Arial, sans-serif; }
    .document { max-width: 820px; margin: 32px auto; padding: 48px; background: #fff; box-shadow: 0 18px 50px rgba(0,0,0,.12); }
    h1 { margin: 0 0 8px; font-size: 30px; }
    h2 { margin: 28px 0 8px; font-size: 17px; }
    p, li { line-height: 1.55; }
    .meta { color: #667; margin-bottom: 30px; }
    .party-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 18px; margin: 22px 0; }
    .box { border: 1px solid #ddd; padding: 14px; border-radius: 6px; }
    .signatures { display: grid; grid-template-columns: 1fr 1fr; gap: 36px; margin-top: 54px; }
    .line { border-top: 1px solid #111; padding-top: 8px; min-height: 54px; }
    .brand { color: #5c238d; font-weight: 700; }
    @media print { body { background: #fff; } .document { margin: 0; box-shadow: none; max-width: none; } }
  </style>
</head>
<body>
  <main class="document">
    <p class="brand">Novadex Tid & Löner</p>
    <h1>${escapeHtml(agreement.title)}</h1>
    <p class="meta">Avtalsnummer ${agreement.number} · Upprättat ${createdDate} · Avtalstyp: ${escapeHtml(agreement.type)}</p>
    ${agreement.projectId ? `<p class="meta">Kopplat projekt: ${escapeHtml(getProject(agreement.projectId)?.name || "Okänt projekt")}</p>` : ""}

    <section class="party-grid">
      <div class="box">
        <strong>Leverantör</strong>
        <p>Novadex Tid & Löner<br>Redovisningsbyrå<br>Ansvarig: ${escapeHtml(agreement.owner || "Ej angiven")}</p>
      </div>
      <div class="box">
        <strong>Kund</strong>
        <p>${escapeHtml(client.name || "Okänd kund")}<br>Org.nr: ${escapeHtml(client.org || "Ej angivet")}<br>E-post: ${escapeHtml(agreement.clientEmail || client.email || "Ej angiven")}</p>
      </div>
    </section>

    <h2>1. Uppdragets omfattning</h2>
    <p>${escapeHtml(scope)}</p>

    <h2>2. Arvode och betalningsvillkor</h2>
    <p>Arvode: ${escapeHtml(price)}. Betalningsvillkor: ${escapeHtml(payment)}.</p>

    <h2>3. Kundens ansvar</h2>
    <p>Kunden ansvarar för att lämna fullständiga, korrekta och aktuella underlag i tid. Kunden ansvarar även för slutligt godkännande av rapporter, deklarationer och beslutsunderlag.</p>

    <h2>4. Leverantörens ansvar</h2>
    <p>Leverantören ska utföra uppdraget fackmässigt och med rimlig omsorg utifrån de uppgifter och underlag som kunden tillhandahåller.</p>

    <h2>5. Sekretess och personuppgifter</h2>
    <p>Parterna ska behandla konfidentiell information varsamt. Personuppgifter behandlas endast i den utsträckning som krävs för uppdragets utförande och enligt tillämplig dataskyddslagstiftning.</p>

    <h2>6. Avtalstid och uppsägning</h2>
    <p>Avtalet gäller från bevakningsdatum ${escapeHtml(agreement.watchDate || "enligt överenskommelse")} till ${escapeHtml(agreement.endDate || "tills vidare")}. Uppsägning ska ske skriftligen om parterna inte kommer överens om annat.</p>

    <h2>7. Meddelande till kund</h2>
    <p>${escapeHtml(agreement.message || "Inget särskilt meddelande.")}</p>

    <section class="signatures">
      <div>
        <div class="line">För Novadex Tid & Löner<br>${escapeHtml(agreement.owner || "")}</div>
      </div>
      <div>
        <div class="line">För ${escapeHtml(client.name || "kunden")}<br>Behörig firmatecknare</div>
      </div>
    </section>
  </main>
</body>
</html>`;
}

function previewAgreementDocument(agreement) {
  const url = URL.createObjectURL(new Blob([buildAgreementDocument(agreement)], { type: "text/html;charset=utf-8" }));
  window.open(url, "_blank", "noopener,noreferrer");
  window.setTimeout(() => URL.revokeObjectURL(url), 15000);
}

function downloadAgreementDocument(agreement) {
  const fileName = `${agreement.number}-${agreement.title}`.toLowerCase()
    .replaceAll("å", "a")
    .replaceAll("ä", "a")
    .replaceAll("ö", "o")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  const url = URL.createObjectURL(new Blob([buildAgreementDocument(agreement)], { type: "text/html;charset=utf-8" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = `${fileName || "avtal"}.html`;
  link.click();
  URL.revokeObjectURL(url);
}

function prepareAgreementEmail(agreement) {
  const client = getClient(agreement.clientId) || {};
  const recipient = agreement.clientEmail || client.email || "";
  const subject = `Avtal för signering: ${agreement.title}`;
  const body = `${agreement.message || "Hej, här kommer avtalet för ert godkännande."}

Avtal: ${agreement.title}
Avtalsnummer: ${agreement.number}
Motpart: ${client.name || ""}

I Novadex kan du även använda knappen "Ladda ner avtal" för att bifoga avtalsdokumentet i mejlet.

Vänliga hälsningar
${agreement.owner || "Novadex Tid & Löner"}`;
  window.location.href = `mailto:${encodeURIComponent(recipient)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}

function prepareEsignEmail(item, reminder = false) {
  const client = getClient(item.clientId) || {};
  const agreement = getAgreement(item.agreementId);
  const recipient = agreement?.clientEmail || client.billingEmail || client.email || "";
  if (!recipient) {
    showToast("Signeraren saknar e-postadress.", "warning");
    return false;
  }
  const subject = `${reminder ? "Påminnelse: " : ""}Signering ${item.number} - ${item.title}`;
  const body = `${reminder ? "Hej, vi vill påminna om signeringen." : item.message || "Hej, vänligen signera dokumentet när du har möjlighet."}

Dokument: ${item.title}
Typ: ${item.docType}
${agreement ? `Avtal: ${agreement.title}` : ""}
Förfallodatum: ${item.dueDate || "-"}

I den färdiga versionen kommer detta att skickas via en riktig e-signeringstjänst med säker signeringslänk.

Vänliga hälsningar
${item.owner || state.settings.companyName}`;
  window.location.href = `mailto:${encodeURIComponent(recipient)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  item.status = item.status === "signed" ? "signed" : "sent";
  if (reminder) item.reminderSentAt = isoToday;
  if (!item.sentAt) item.sentAt = isoToday;
  return true;
}

function exportCsv() {
  const header = ["Kategori", "Datum", "Medarbetare", "Typ", "Kund", "Projekt/arbetsorder", "Aktivitet", "Antal/timmar", "Belopp", "Fakturerbar", "På löneunderlag", "Status", "Beskrivning"];
  const rows = state.entries.map((entry) => [
    "Tid",
    entry.date,
    entry.employee,
    getTypeLabel(entry.type),
    getClient(entry.clientId)?.name || "",
    getProject(entry.projectId)?.name || entry.workOrder || "",
    entry.task,
    String(entry.hours).replace(".", ","),
    "",
    entry.billable ? "Ja" : "Nej",
    entry.payroll ? "Ja" : "Nej",
    getApprovalStatusLabel(entry.status),
    entry.description
  ]);
  state.receipts.forEach((receipt) => rows.push([
    "Kvitto",
    receipt.date,
    "",
    "Utlägg",
    getClient(receipt.clientId)?.name || "",
    getProject(receipt.projectId)?.name || "",
    receipt.supplier,
    "",
    String(receipt.amount).replace(".", ","),
    receipt.billable ? "Ja" : "Nej",
    receipt.payroll ? "Ja" : "Nej",
    getApprovalStatusLabel(receipt.status),
    `Moms ${String(receipt.vat || 0).replace(".", ",")}`
  ]));
  state.travels.forEach((travel) => rows.push([
    "Resa",
    travel.date,
    "",
    travel.type === "allowance" ? "Traktamente" : "Milersättning",
    getClient(travel.clientId)?.name || "",
    "",
    `${travel.from || ""} - ${travel.to || ""}`,
    String(travel.quantity).replace(".", ","),
    String(getTravelValue(travel)).replace(".", ","),
    travel.billable ? "Ja" : "Nej",
    travel.payroll ? "Ja" : "Nej",
    getApprovalStatusLabel(travel.status),
    ""
  ]));

  const csv = [header, ...rows]
    .map((row) => row.map((cell) => `"${String(cell).replaceAll('"', '""')}"`).join(";"))
    .join("\n");
  const blob = new Blob([`\ufeff${csv}`], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `tidrapport-${isoToday}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

els.navItems.forEach((button) => {
  button.addEventListener("click", () => setView(button.dataset.view));
});

els.moduleItems.forEach((button) => {
  button.addEventListener("click", () => openModule(button.dataset.module, button));
});

els.taskNewButton?.addEventListener("click", () => {
  setView("portal");
  createPortalTaskForCurrentClient();
});

els.tasksBoard?.addEventListener("click", (event) => {
  const startButton = event.target.closest("[data-start-task-timer]");
  if (startButton) {
    const task = getTaskWorkflowItems().find((item) => item.id === startButton.dataset.startTaskTimer && item.kind === startButton.dataset.taskKind);
    if (task) {
      openTimerWithContext({
        clientId: task.clientId,
        projectId: task.projectId,
        workOrder: task.title,
        task: task.kind === "receipt" ? "Utlägg" : task.kind === "travel" ? "Resa" : "Bokföring",
        description: task.message || task.subtitle
      });
    }
    return;
  }
  const button = event.target.closest("[data-task-open]");
  if (!button) return;
  if (button.dataset.taskOpen === "portal") {
    const task = (state.portalTasks || []).find((item) => item.id === button.dataset.taskId);
    if (task && els.portalClient) els.portalClient.value = task.clientId;
    setView("portal");
    renderPortal();
    showToast("Öppnade kundärendet.");
    return;
  }
  setView(button.dataset.taskOpen || "time");
  showToast("Öppnade arbetsflödet för uppgiften.");
});

els.tasksPipeline?.addEventListener("click", (event) => {
  const button = event.target.closest("[data-task-status-filter]");
  if (!button) return;
  selectedTaskStatus = button.dataset.taskStatusFilter || "all";
  renderTasks();
  showToast(`Uppgifter filtreras: ${button.textContent.trim().toLowerCase()}.`);
});

els.salesNewButton?.addEventListener("click", () => {
  const client = state.clients.find(isClientVisible);
  if (client) {
    els.agreementClient.value = client.id;
    els.agreementEmail.value = client.billingEmail || client.email || "";
    els.agreementTitle.value = `Offert till ${client.name}`;
    els.agreementType.value = "Uppdragsavtal";
    els.agreementMessage.value = "Hej, här kommer ett förslag på uppdrag för ert godkännande.";
  }
  setView("agreements");
  focusElement(els.agreementTitle);
  showToast("Ny offert förbereds som avtal/uppdragsbrev.");
});

els.salesBoard?.addEventListener("click", (event) => {
  const button = event.target.closest("[data-sales-client]");
  if (!button) return;
  selectedClientId = button.dataset.salesClient;
  setView("clients");
  renderClients();
  showToast("Öppnade kundkort från säljtavlan.");
});

els.salesActions?.addEventListener("click", (event) => {
  const button = event.target.closest("[data-sales-action]");
  if (!button) return;
  selectedClientId = button.dataset.salesClient;
  if (button.dataset.salesAction === "agreements") {
    els.agreementSearch.value = getClient(selectedClientId)?.name || "";
    setView("agreements");
    renderAgreements();
    showToast("Visar avtal och offerter för kunden.");
    return;
  }
  setView("clients");
  renderClients();
});

els.planningModes?.forEach((button) => {
  button.addEventListener("click", () => {
    els.planningModes.forEach((item) => item.classList.remove("active"));
    button.classList.add("active");
    renderPlanning();
    showToast(`Planering visas per ${button.dataset.planningMode === "month" ? "månad" : "vecka"}.`);
  });
});

els.planningBoard?.addEventListener("click", (event) => {
  const button = event.target.closest("[data-planning-project]");
  if (!button) return;
  selectedProjectId = button.dataset.planningProject;
  setView("projects");
  renderProjects();
  showToast("Öppnade projekt från resursplaneringen.");
});

els.analysisCards?.addEventListener("click", (event) => {
  const button = event.target.closest("[data-analysis-view]");
  if (!button) return;
  setView(button.dataset.analysisView);
  showToast("Öppnade analysens arbetsunderlag.");
});

async function approveSubmittedForEmployee(employee) {
  let count = 0;
  const changedEntries = [];
  state.entries.forEach((entry) => {
    if ((entry.employee || getCurrentUser().name) === employee && entry.status === "submitted") {
      entry.status = "approved";
      entry.reviewNote = "";
      changedEntries.push(entry);
      count += 1;
    }
  });
  state.receipts.forEach((receipt) => {
    if ((receipt.employee || getCurrentUser().name) === employee && receipt.status === "submitted") {
      receipt.status = "approved";
      receipt.reviewNote = "";
      count += 1;
    }
  });
  state.travels.forEach((travel) => {
    if ((travel.employee || getCurrentUser().name) === employee && travel.status === "submitted") {
      travel.status = "approved";
      travel.reviewNote = "";
      count += 1;
    }
  });
  if (canUseCloudData()) {
    for (const entry of changedEntries) {
      try {
        const savedEntry = await saveCloudEntry(entry);
        if (savedEntry?.id) Object.assign(entry, savedEntry);
      } catch (error) {
        showToast(`En tidsrad attesterades lokalt men inte i Supabase: ${error.message}`, "warning");
      }
    }
  }
  return count;
}

async function approveSubmittedForDay(date) {
  let count = 0;
  const changedEntries = [];
  state.entries.forEach((entry) => {
    if (entry.date === date && isEntryVisible(entry) && entry.status === "submitted") {
      entry.status = "approved";
      entry.reviewNote = "";
      changedEntries.push(entry);
      count += 1;
    }
  });
  if (canUseCloudData()) {
    for (const entry of changedEntries) {
      try {
        const savedEntry = await saveCloudEntry(entry);
        if (savedEntry?.id) Object.assign(entry, savedEntry);
      } catch (error) {
        showToast(`En tidsrad attesterades lokalt men inte i Supabase: ${error.message}`, "warning");
      }
    }
  }
  return count;
}

function submitDraftsInSelectedPeriod() {
  if (isSelectedTimePeriodLocked()) return 0;
  let count = 0;
  state.entries.forEach((entry) => {
    if (isEntryVisible(entry) && isInSelectedTimePeriod(entry.date) && ["draft", "rejected"].includes(entry.status || "draft")) {
      entry.status = "submitted";
      entry.reviewNote = "";
      count += 1;
    }
  });
  state.receipts.forEach((receipt) => {
    if (isClientVisible(getClient(receipt.clientId) || {}) && isInSelectedTimePeriod(receipt.date) && ["draft", "rejected"].includes(receipt.status || "draft")) {
      receipt.status = "submitted";
      receipt.reviewNote = "";
      count += 1;
    }
  });
  state.travels.forEach((travel) => {
    if (isClientVisible(getClient(travel.clientId) || {}) && isInSelectedTimePeriod(travel.date) && ["draft", "rejected"].includes(travel.status || "draft")) {
      travel.status = "submitted";
      travel.reviewNote = "";
      count += 1;
    }
  });
  return count;
}

function submitSelectedPeriodToApproval() {
  const count = submitDraftsInSelectedPeriod();
  if (!count) {
    showToast(isSelectedTimePeriodLocked() ? "Perioden är låst." : "Det finns inga utkast att skicka i perioden.", "warning");
    return false;
  }
  saveState();
  renderAll();
  showToast(`${count} poster skickades till attest.`);
  return true;
}

function handleTimeFlowAction(action) {
  const range = getSelectedPeriodRange();
  if (action === "submit") {
    submitSelectedPeriodToApproval();
    return;
  }
  if (action === "approval") {
    if (els.approvalSearch) els.approvalSearch.value = selectedTimeEmployee || "";
    if (els.approvalKindFilter) els.approvalKindFilter.value = "all";
    if (els.approvalStatusFilter) els.approvalStatusFilter.value = "open";
    if (els.approvalFrom) els.approvalFrom.value = range.from;
    if (els.approvalTo) els.approvalTo.value = range.to;
    if (els.approvalActionableOnly) els.approvalActionableOnly.checked = false;
    setView("reports");
    renderApprovalFlow();
    scrollToPageTarget("approval-list");
    showToast("Öppnade attestflödet för vald period.");
    return;
  }
  if (action === "invoice") {
    if (els.invoiceFrom) els.invoiceFrom.value = range.from;
    if (els.invoiceTo) els.invoiceTo.value = range.to;
    if (els.invoiceReadinessFilter) els.invoiceReadinessFilter.value = "all";
    setView("invoice");
    renderInvoiceWorkbench();
    showToast("Faktureringen visar samma period som tidsrapporteringen.");
    return;
  }
  if (action === "payroll") {
    setView("reports");
    selectedReportId = "payroll";
    renderReports();
    showToast("Öppnade löneunderlag för kontroll.");
    return;
  }
  selectedTimeAnchorDate = range.from || isoToday;
  if (els.entryDate) els.entryDate.value = selectedTimeAnchorDate;
  focusElement(els.entryClient);
  showToast("Ny tidsrad är förberedd.");
}

async function syncChangedEntriesToCloud(entries, message = "En tidsrad uppdaterades lokalt men inte i Supabase") {
  if (!canUseCloudData() || !entries.length) return;
  for (const entry of entries) {
    try {
      const savedEntry = await saveCloudEntry(entry);
      if (savedEntry?.id) Object.assign(entry, savedEntry);
    } catch (error) {
      showToast(`${message}: ${error.message}`, "warning");
    }
  }
}

function getSelectedPeriodApprovalCollections() {
  return {
    entries: state.entries.filter((entry) => isEntryVisible(entry) && isInSelectedTimePeriod(entry.date)),
    receipts: state.receipts.filter((receipt) => isClientVisible(getClient(receipt.clientId) || {}) && isInSelectedTimePeriod(receipt.date)),
    travels: state.travels.filter((travel) => isClientVisible(getClient(travel.clientId) || {}) && isInSelectedTimePeriod(travel.date))
  };
}

function getOwnerName(item) {
  return item.employee || getCurrentUser().name;
}

function setSubmittedItemsApproved(items, changedEntries = []) {
  let count = 0;
  items.forEach((item) => {
    if (item.status !== "submitted") return;
    item.status = "approved";
    item.reviewNote = "";
    if (state.entries.includes(item)) changedEntries.push(item);
    count += 1;
  });
  return count;
}

async function approveSubmittedForEmployee(employee) {
  let count = 0;
  const changedEntries = [];
  const period = getSelectedPeriodApprovalCollections();
  count += setSubmittedItemsApproved(period.entries.filter((entry) => getOwnerName(entry) === employee), changedEntries);
  count += setSubmittedItemsApproved(period.receipts.filter((receipt) => getOwnerName(receipt) === employee), changedEntries);
  count += setSubmittedItemsApproved(period.travels.filter((travel) => getOwnerName(travel) === employee), changedEntries);
  await syncChangedEntriesToCloud(changedEntries, "En tidsrad attesterades lokalt men inte i Supabase");
  return count;
}

async function approveSubmittedForDay(date) {
  let count = 0;
  const changedEntries = [];
  count += setSubmittedItemsApproved(state.entries.filter((entry) => entry.date === date && isEntryVisible(entry)), changedEntries);
  count += setSubmittedItemsApproved(state.receipts.filter((receipt) => receipt.date === date && isClientVisible(getClient(receipt.clientId) || {})), changedEntries);
  count += setSubmittedItemsApproved(state.travels.filter((travel) => travel.date === date && isClientVisible(getClient(travel.clientId) || {})), changedEntries);
  await syncChangedEntriesToCloud(changedEntries, "En tidsrad attesterades lokalt men inte i Supabase");
  return count;
}

function submitDraftsInSelectedPeriod() {
  if (isSelectedTimePeriodLocked()) return { count: 0, changedEntries: [] };
  let count = 0;
  const changedEntries = [];
  const period = getSelectedPeriodApprovalCollections();
  period.entries.forEach((entry) => {
    if (!["draft", "rejected"].includes(entry.status || "draft")) return;
    entry.status = "submitted";
    entry.reviewNote = "";
    changedEntries.push(entry);
    count += 1;
  });
  period.receipts.forEach((receipt) => {
    if (!["draft", "rejected"].includes(receipt.status || "draft")) return;
    receipt.status = "submitted";
    receipt.reviewNote = "";
    count += 1;
  });
  period.travels.forEach((travel) => {
    if (!["draft", "rejected"].includes(travel.status || "draft")) return;
    travel.status = "submitted";
    travel.reviewNote = "";
    count += 1;
  });
  return { count, changedEntries };
}

async function submitSelectedPeriodToApproval(options = {}) {
  const { count, changedEntries } = submitDraftsInSelectedPeriod();
  if (!count) {
    if (!options.silent) {
      showToast(isSelectedTimePeriodLocked() ? "Perioden är låst." : "Det finns inga utkast att skicka i perioden.", "warning");
    }
    return false;
  }
  await syncChangedEntriesToCloud(changedEntries, "Tidsraden skickades lokalt men inte i Supabase");
  saveState();
  renderAll();
  if (!options.silent) showToast(`${count} poster skickades till attest.`);
  return true;
}

async function approveSelectedPeriod() {
  const period = getSelectedPeriodApprovalCollections();
  const changedEntries = [];
  const count =
    setSubmittedItemsApproved(period.entries, changedEntries)
    + setSubmittedItemsApproved(period.receipts, changedEntries)
    + setSubmittedItemsApproved(period.travels, changedEntries);
  if (!count) return 0;
  await syncChangedEntriesToCloud(changedEntries, "En tidsrad attesterades lokalt men inte i Supabase");
  saveState();
  renderAll();
  return count;
}

function getUniqueVisibleTimeEmployees() {
  const period = getSelectedPeriodApprovalCollections();
  return [...new Set([
    ...period.entries.map(getOwnerName),
    ...period.receipts.map(getOwnerName),
    ...period.travels.map(getOwnerName)
  ])].filter(Boolean);
}

function setInvoiceFiltersToSelectedPeriod() {
  const range = getSelectedPeriodRange();
  if (els.invoiceFrom) els.invoiceFrom.value = range.from;
  if (els.invoiceTo) els.invoiceTo.value = range.to;
  if (els.invoiceReadinessFilter) els.invoiceReadinessFilter.value = "all";
  els.invoiceTabs?.forEach((item) => item.classList.toggle("active", item.dataset.invoiceTab === "preliminary"));
  els.invoiceViewModes?.forEach((item) => item.classList.toggle("active", item.dataset.invoiceViewmode === "project"));
}

function createInvoicesForSelectedPeriod() {
  setInvoiceFiltersToSelectedPeriod();
  const readyRows = getInvoiceRows().filter(isInvoiceRowReady);
  const records = createInvoicesFromRows(readyRows);
  if (!records.length) {
    showToast("Det finns inga fakturaklara underlag i vald period.", "warning");
    return false;
  }
  saveState();
  renderAll();
  setView("invoice");
  openInvoiceRecordDetail(records[0].id);
  showToast(`${records.length} fakturaunderlag skapades från vald period.`);
  return true;
}

async function handleTimeFlowAction(action) {
  const range = getSelectedPeriodRange();
  if (action === "submit") {
    await submitSelectedPeriodToApproval();
    return;
  }
  if (action === "approve-period") {
    const count = await approveSelectedPeriod();
    if (!count) {
      showToast("Det finns inga inskickade poster att attestera i perioden.", "warning");
      return;
    }
    showToast(`${count} poster attesterades för perioden.`);
    return;
  }
  if (action === "complete-period") {
    await submitSelectedPeriodToApproval({ silent: true });
    const count = await approveSelectedPeriod();
    if (!count) {
      showToast("Perioden saknar poster som kan skickas eller attesteras.", "warning");
      return;
    }
    showToast(`${count} poster är klara för fakturering.`);
    return;
  }
  if (action === "create-invoices") {
    createInvoicesForSelectedPeriod();
    return;
  }
  if (action === "approval") {
    if (els.approvalSearch) els.approvalSearch.value = selectedTimeEmployee || "";
    if (els.approvalKindFilter) els.approvalKindFilter.value = "all";
    if (els.approvalStatusFilter) els.approvalStatusFilter.value = "open";
    if (els.approvalFrom) els.approvalFrom.value = range.from;
    if (els.approvalTo) els.approvalTo.value = range.to;
    if (els.approvalActionableOnly) els.approvalActionableOnly.checked = false;
    setView("reports");
    renderApprovalFlow();
    scrollToPageTarget("approval-list");
    showToast("Öppnade attestflödet för vald period.");
    return;
  }
  if (action === "invoice") {
    setInvoiceFiltersToSelectedPeriod();
    setView("invoice");
    renderInvoiceWorkbench();
    showToast("Faktureringen visar samma period som tidsrapporteringen.");
    return;
  }
  if (action === "payroll") {
    setView("reports");
    selectedReportId = "payroll";
    renderReports();
    showToast("Öppnade löneunderlag för kontroll.");
    return;
  }
  selectedTimeAnchorDate = range.from || isoToday;
  if (els.entryDate) els.entryDate.value = selectedTimeAnchorDate;
  focusElement(els.entryClient);
  showToast("Ny tidsrad är förberedd.");
}

function toggleSelectedTimePeriodLock() {
  const key = getSelectedTimePeriodKey();
  state.timeLocks = state.timeLocks || [];
  const existingIndex = state.timeLocks.findIndex((lock) => lock.key === key);
  if (existingIndex >= 0) {
    state.timeLocks.splice(existingIndex, 1);
    return false;
  }
  state.timeLocks.push({
    key,
    label: getTimePeriodLabel(),
    mode: selectedTimePeriodMode,
    lockedAt: isoToday,
    lockedBy: getCurrentUser().name
  });
  return true;
}

els.timePrevPeriod?.addEventListener("click", () => {
  setTimePeriodAnchorByDelta(-1);
  showToast(`Visar ${getTimePeriodLabel()}.`);
});

els.timeTodayPeriod?.addEventListener("click", () => {
  selectedTimeAnchorDate = isoToday;
  if (els.entryDate) els.entryDate.value = isoToday;
  renderTimePeriodOverview();
  renderEntriesTable();
  showToast(`Tillbaka till ${getTimePeriodLabel()}.`);
});

els.timeNextPeriod?.addEventListener("click", () => {
  setTimePeriodAnchorByDelta(1);
  showToast(`Visar ${getTimePeriodLabel()}.`);
});

els.timeSubmitPeriod?.addEventListener("click", async () => {
  await submitSelectedPeriodToApproval();
});

els.timeLockPeriod?.addEventListener("click", () => {
  const locked = toggleSelectedTimePeriodLock();
  saveState();
  renderAll();
  showToast(locked ? `${getTimePeriodLabel()} låstes.` : `${getTimePeriodLabel()} låstes upp.`);
});

els.timePeriodBoard?.addEventListener("click", async (event) => {
  const employeeButton = event.target.closest("[data-time-employee]");
  const approveButton = event.target.closest("[data-time-approve-employee]");
  const newRowButton = event.target.closest("[data-time-new-row]");

  if (newRowButton) {
    els.entryEmployee.value = newRowButton.dataset.timeNewRow;
    els.entryDate.value = selectedTimeAnchorDate || isoToday;
    setView("time");
    focusElement(els.entryClient);
    showToast("Ny tidsrad är förberedd för vald medarbetare.");
    return;
  }

  if (approveButton) {
    const count = await approveSubmittedForEmployee(approveButton.dataset.timeApproveEmployee);
    if (!count) {
      showToast("Det fanns inget inskickat att attestera för medarbetaren.", "warning");
      return;
    }
    saveState();
    renderAll();
    showToast(`${count} poster attesterades.`);
    return;
  }

  if (employeeButton) {
    const employee = employeeButton.dataset.timeEmployee;
    selectedTimeEmployee = selectedTimeEmployee === employee ? "" : employee;
    els.entryEmployee.value = employee;
    renderTimePeriodOverview();
    renderEntriesTable();
    els.entriesTable?.scrollIntoView({ behavior: "smooth", block: "start" });
    showToast(selectedTimeEmployee ? `Tidtabellen visar ${employee}.` : "Medarbetarfiltret rensades.");
  }
});

els.monthDayBoard?.addEventListener("click", async (event) => {
  const newButton = event.target.closest("[data-time-day-new]");
  const approveButton = event.target.closest("[data-time-day-approve]");

  if (newButton) {
    const date = newButton.dataset.timeDayNew;
    selectedTimeAnchorDate = date;
    if (els.entryDate) els.entryDate.value = date;
    setTimePeriodMode("day", date);
    focusElement(els.entryClient);
    showToast(`Ny tidsrad för ${date} är förberedd.`);
    return;
  }

  if (approveButton) {
    const count = await approveSubmittedForDay(approveButton.dataset.timeDayApprove);
    if (!count) {
      showToast("Det finns inget inskickat att attestera den dagen.", "warning");
      return;
    }
    saveState();
    renderAll();
    showToast(`${count} tidsrader attesterades för dagen.`);
  }
});

els.monthRegisterAside?.addEventListener("click", (event) => {
  const flowButton = event.target.closest("[data-time-flow-action]");
  if (!flowButton) return;
  handleTimeFlowAction(flowButton.dataset.timeFlowAction);
});

els.timeExpandBlocks?.addEventListener("click", () => {
  els.timePeriodBoard?.classList.toggle("expanded");
  renderTimePeriodOverview();
  showToast(els.timePeriodBoard?.classList.contains("expanded") ? "Alla tidsblock expanderades." : "Tidsblocken komprimerades.");
});

els.timeAttestMonth?.addEventListener("click", async () => {
  const count = await approveSelectedPeriod();
  if (!count) {
    showToast("Det finns inga inskickade poster att attestera i perioden.", "warning");
    return;
  }
  showToast(`${count} poster attesterades för perioden.`);
});

els.invoiceCommandStrip?.addEventListener("click", (event) => {
  const button = event.target.closest("[data-invoice-command]");
  if (!button) return;
  const command = button.dataset.invoiceCommand;

  if (command === "history") {
    els.invoiceHistoryTable?.scrollIntoView({ behavior: "smooth", block: "start" });
    showToast("Fakturaunderlag och arkiv visas längre ned.");
    return;
  }

  if (command === "open-latest") {
    const latestInvoice = getSortedInvoices()[0];
    if (!latestInvoice) {
      showToast("Det finns ingen skapad faktura ännu.", "warning");
      return;
    }
    openInvoiceRecordDetail(latestInvoice.id);
    showToast(`Öppnade ${latestInvoice.number}.`);
    return;
  }

  if (command === "share-created") {
    const invoices = (state.invoices || []).filter((invoice) => getEffectiveInvoiceStatus(invoice) === "created");
    const shared = invoices.reduce((count, invoice) => shareInvoiceToPortal(invoice.id, { navigate: false, toast: false }) ? count + 1 : count, 0);
    if (!shared) {
      showToast("Det finns inga skapade fakturor att dela just nu.", "warning");
      return;
    }
    if (els.invoiceHistoryStatus) els.invoiceHistoryStatus.value = "sent";
    renderAll();
    els.invoiceHistoryTable?.scrollIntoView({ behavior: "smooth", block: "start" });
    showToast(`${shared} fakturor delades till kundportalen.`);
    return;
  }

  if (command === "open-customer" || command === "open-changes" || command === "open-approved" || command === "open-overdue" || command === "open-payment") {
    const statusMap = {
      "open-customer": "sent",
      "open-overdue": "overdue",
      "open-changes": "changeRequested",
      "open-approved": "customerApproved",
      "open-payment": "customerApproved"
    };
    if (els.invoiceHistoryStatus) els.invoiceHistoryStatus.value = statusMap[command];
    renderInvoiceHistory();
    els.invoiceHistoryTable?.scrollIntoView({ behavior: "smooth", block: "start" });
    showToast(`Visar ${button.querySelector("span")?.textContent?.trim().toLowerCase() || "fakturor"} i fakturahistoriken.`);
    return;
  }

  if (command === "portal-invoices") {
    const targetInvoice = (state.invoices || []).find((invoice) => ["sent", "overdue", "changeRequested", "customerApproved"].includes(getEffectiveInvoiceStatus(invoice)));
    if (!targetInvoice) {
      showToast("Det finns inga fakturor i kundportalflödet just nu.", "warning");
      return;
    }
    if (els.portalClient) els.portalClient.value = targetInvoice.clientId;
    setView("portal");
    renderPortal();
    showToast("Öppnade kundens portalflöde för fakturor.");
    return;
  }

  if (command === "mark-approved-paid") {
    const approvedInvoices = (state.invoices || []).filter((invoice) => getEffectiveInvoiceStatus(invoice) === "customerApproved");
    if (!approvedInvoices.length) {
      showToast("Det finns inga kundgodkända fakturor att markera som betalda.", "warning");
      return;
    }
    approvedInvoices.forEach((invoice) => {
      invoice.status = "paid";
      invoice.paidAt = invoice.paidAt || isoToday;
      addInvoiceEvent(invoice, "Markerad betald", "Massåtgärd från faktureringen.");
      syncInvoicePortalTask(invoice, "paid");
    });
    saveState();
    renderAll();
    if (els.invoiceHistoryStatus) els.invoiceHistoryStatus.value = "paid";
    renderInvoiceHistory();
    els.invoiceHistoryTable?.scrollIntoView({ behavior: "smooth", block: "start" });
    showToast(`${approvedInvoices.length} kundgodkända fakturor markerades som betalda.`);
    return;
  }

  if (command === "warnings") {
    if (els.approvalKindFilter) els.approvalKindFilter.value = "all";
    if (els.approvalStatusFilter) els.approvalStatusFilter.value = "open";
    if (els.approvalSearch) els.approvalSearch.value = "";
    setView("reports");
    renderApprovalFlow();
    showToast("Öppnade attestflödet så att spärrade fakturarader kan åtgärdas.");
    return;
  }

  if (command === "customer-data") {
    const targetRow = getInvoiceRows().find((row) => getInvoiceRowIssues(row).some((issue) => issue.includes("saknas")));
    if (!targetRow) {
      showToast("Alla synliga fakturarader har tillräcklig kunddata.", "success");
      return;
    }
    const projectId = (targetRow.sourceProjectIds || [targetRow.id])[0];
    const project = getProject(projectId);
    selectedClientId = targetRow.client?.id || project?.clientId || selectedClientId;
    setView("clients");
    renderClients();
    showToast("Öppnade kundkortet som behöver kompletteras för fakturering.");
    return;
  }

  if (command === "drafts") {
    els.invoiceTabs.forEach((item) => item.classList.toggle("active", item.dataset.invoiceTab === "draft"));
    renderInvoiceWorkbench();
    renderInvoiceCommandStrip();
    showToast("Visar fakturautkast.");
    return;
  }

  if (command === "draft-visible") {
    const created = saveInvoiceDraftsFromRows(getInvoiceRows());
    if (!created) {
      showToast("Det finns inga synliga underlag att spara som utkast.", "warning");
      return;
    }
    els.invoiceTabs.forEach((item) => item.classList.toggle("active", item.dataset.invoiceTab === "draft"));
    saveState();
    renderAll();
    showToast(`${created} synliga underlag sparades som utkast.`);
    return;
  }

  if (command === "approve-blocked") {
    const count = approveInvoiceBlockedFromRows(getInvoiceRows().filter((row) => row.warning > 0));
    if (!count) {
      showToast("Det finns inga synliga spärrar att attestera.", "warning");
      return;
    }
    saveState();
    renderAll();
    showToast(`${count} blockerande rader attesterades.`);
    return;
  }

  if (command === "create-ready") {
    const rows = getInvoiceRows().filter(isInvoiceRowReady);
    const records = createInvoicesFromRows(rows);
    if (!records.length) {
      showToast("Det finns inga helt klara underlag att skapa just nu.", "warning");
      return;
    }
    saveState();
    renderAll();
    openInvoiceRecordDetail(records[0].id);
    showToast(`${records.length} fakturaunderlag skapades. Första fakturan öppnades.`);
  }
});

els.reportSearch?.addEventListener("input", renderReportCatalog);

els.reportShowFavorites?.addEventListener("click", () => {
  els.reportShowFavorites.classList.toggle("active");
  renderReportCatalog();
});

els.reportTags?.addEventListener("click", (event) => {
  const button = event.target.closest("[data-report-tag]");
  if (!button || !els.reportSearch) return;
  els.reportSearch.value = button.dataset.reportTag;
  renderReportCatalog();
});

els.reportCatalog?.addEventListener("click", (event) => {
  const button = event.target.closest("[data-report-select]");
  if (!button) return;
  selectedReportId = button.dataset.reportSelect;
  renderReportCatalog();
  renderReportDetail();
  showToast("Rapportens arbetsvy öppnades.");
});

els.reportDetailActions?.addEventListener("click", (event) => {
  const button = event.target.closest("[data-report-action]");
  if (!button) return;
  handleReportAction(button.dataset.reportAction);
});

els.reportResultList?.addEventListener("click", (event) => {
  const button = event.target.closest("[data-report-row-index]");
  if (!button) return;
  const rows = getReportRows(selectedReportId);
  openReportRow(rows[Number(button.dataset.reportRowIndex)]);
});

els.shortcuts.forEach((button) => {
  button.addEventListener("click", () => {
    setView(button.dataset.viewShortcut);
    scrollToPageTarget(button.dataset.scrollTarget);
    showToast(`Öppnade ${viewTitles[button.dataset.viewShortcut].toLowerCase()}.`);
  });
});

els.shortcutList?.addEventListener("click", (event) => {
  const button = event.target.closest("[data-shortcut-index]");
  if (!button) return;
  const shortcut = state.shortcuts[Number(button.dataset.shortcutIndex)];
  if (!shortcut) return;
  setView(shortcut.view);
  showToast(`Öppnade ${shortcut.label}.`);
});

els.globalSearch?.addEventListener("keydown", (event) => {
  if (event.key !== "Enter") return;
  event.preventDefault();
  runGlobalSearch(els.globalSearch.value);
});

els.trialLink?.addEventListener("click", (event) => {
  event.preventDefault();
  openDrawer("cloud");
  showToast("Öppnade konto och molninloggning.");
});

els.roleSwitcher?.addEventListener("change", () => {
  state.currentUserId = els.roleSwitcher.value;
  saveState();
  const user = getCurrentUser();
  els.entryEmployee.value = user.name;
  els.agreementOwner.value = user.name;
  els.esignOwner.value = user.name;
  if (!canAccessView([...els.views].find((view) => view.classList.contains("active"))?.id?.replace("-view", "") || "dashboard")) {
    setView(getDefaultViewForCurrentUser());
  }
  renderAll();
  showToast(`Roll bytt till ${roleLabels[user.role] || user.role}: ${user.name}.`);
});

els.calendarPrev?.addEventListener("click", () => {
  calendarCursor.setMonth(calendarCursor.getMonth() - 1);
  renderCalendar();
});

els.calendarNext?.addEventListener("click", () => {
  calendarCursor.setMonth(calendarCursor.getMonth() + 1);
  renderCalendar();
});

els.calendarGrid?.addEventListener("click", (event) => {
  const button = event.target.closest("[data-calendar-date]");
  if (!button) return;
  els.entryDate.value = button.dataset.calendarDate;
  setTimePeriodMode("day", button.dataset.calendarDate);
  setView("time");
  showToast(`Datum valt: ${button.dataset.calendarDate}.`);
});

els.newsTabs.forEach((button) => {
  button.addEventListener("click", () => {
    els.newsTabs.forEach((item) => item.classList.remove("active"));
    button.classList.add("active");
    updateNewsTab(button.dataset.newsTab);
  });
});

els.agreementTabs.forEach((button) => {
  button.addEventListener("click", () => {
    setAgreementTab(button.dataset.agreementTab);
    showToast(button.dataset.agreementTab === "archived" ? "Visar arkiverade avtal." : "Visar aktiva avtal.");
  });
});

els.agreementNewButton?.addEventListener("click", () => {
  setAgreementTab("active");
  focusElement(els.agreementTitle);
  showToast("Fyll i avtalet och skapa det längst ned i formuläret.");
});

document.addEventListener("click", (event) => {
  const topActionButton = event.target.closest("[data-top-action]");
  if (topActionButton) {
    const action = topActionButton.dataset.topAction;
    if (action === "timer") {
      openTimerWithContext();
      return;
    }
    openDrawer(action);
    return;
  }

  const closeButton = event.target.closest("[data-drawer-close]");
  if (closeButton) {
    closeDrawer();
    return;
  }

  const drawerViewButton = event.target.closest("[data-drawer-view]");
  if (drawerViewButton) {
    setView(drawerViewButton.dataset.drawerView);
    closeDrawer();
    return;
  }

  const drawerOpenButton = event.target.closest("[data-drawer-open]");
  if (drawerOpenButton) {
    openDrawer(drawerOpenButton.dataset.drawerOpen);
    return;
  }

  const drawerCommandButton = event.target.closest("[data-drawer-command]");
  if (drawerCommandButton) {
    handleDrawerCommand(drawerCommandButton.dataset.drawerCommand);
    return;
  }

  const drawerApprovalButton = event.target.closest("[data-approval-action]");
  if (drawerApprovalButton && els.drawer.contains(drawerApprovalButton)) {
    handleApprovalAction(drawerApprovalButton.dataset.approvalAction, drawerApprovalButton.dataset.approvalKind, drawerApprovalButton.dataset.approvalId);
    return;
  }

  const drawerEditButton = event.target.closest("[data-edit-entry], [data-edit-receipt], [data-edit-travel], [data-edit-agreement], [data-edit-project], [data-edit-client], [data-edit-esign]");
  if (drawerEditButton && els.drawer.contains(drawerEditButton)) {
    if (drawerEditButton.dataset.editEntry) openEntityEditor("entry", drawerEditButton.dataset.editEntry);
    if (drawerEditButton.dataset.editReceipt) openEntityEditor("receipt", drawerEditButton.dataset.editReceipt);
    if (drawerEditButton.dataset.editTravel) openEntityEditor("travel", drawerEditButton.dataset.editTravel);
    if (drawerEditButton.dataset.editAgreement) openEntityEditor("agreement", drawerEditButton.dataset.editAgreement);
    if (drawerEditButton.dataset.editProject) openEntityEditor("project", drawerEditButton.dataset.editProject);
    if (drawerEditButton.dataset.editClient) openEntityEditor("client", drawerEditButton.dataset.editClient);
    if (drawerEditButton.dataset.editEsign) openEntityEditor("esign", drawerEditButton.dataset.editEsign);
    return;
  }

  const pageEditButton = event.target.closest("[data-edit-entry], [data-edit-receipt], [data-edit-travel], [data-edit-agreement], [data-edit-project], [data-edit-client], [data-edit-esign]");
  if (pageEditButton && !els.drawer.contains(pageEditButton)) {
    if (pageEditButton.dataset.editEntry) openEntityEditor("entry", pageEditButton.dataset.editEntry);
    if (pageEditButton.dataset.editReceipt) openEntityEditor("receipt", pageEditButton.dataset.editReceipt);
    if (pageEditButton.dataset.editTravel) openEntityEditor("travel", pageEditButton.dataset.editTravel);
    if (pageEditButton.dataset.editAgreement) openEntityEditor("agreement", pageEditButton.dataset.editAgreement);
    if (pageEditButton.dataset.editProject) openEntityEditor("project", pageEditButton.dataset.editProject);
    if (pageEditButton.dataset.editClient) openEntityEditor("client", pageEditButton.dataset.editClient);
    if (pageEditButton.dataset.editEsign) openEntityEditor("esign", pageEditButton.dataset.editEsign);
    return;
  }

  const invoiceDetailButton = event.target.closest("[data-invoice-detail]");
  if (invoiceDetailButton) {
    event.preventDefault();
    openInvoiceRecordDetail(invoiceDetailButton.dataset.invoiceDetail);
    return;
  }

  const documentButton = event.target.closest("[data-open-document]");
  if (documentButton) {
    event.preventDefault();
    openStoredDocument(documentButton.dataset.openDocument, documentButton.dataset.documentId);
    return;
  }

  const previewAgreementButton = event.target.closest("[data-preview-agreement]");
  if (previewAgreementButton && !els.agreementsTable.contains(previewAgreementButton)) {
    const agreement = getAgreement(previewAgreementButton.dataset.previewAgreement);
    if (agreement) previewAgreementDocument(agreement);
    return;
  }

  const pageAgreementSign = event.target.closest("[data-sign-agreement]");
  if (pageAgreementSign && !els.agreementsTable.contains(pageAgreementSign) && !els.drawer.contains(pageAgreementSign)) {
    const agreement = getAgreement(pageAgreementSign.dataset.signAgreement);
    if (agreement) {
      agreement.status = "signed";
      agreement.signedAt = isoToday;
      state.esignatures
        .filter((item) => item.agreementId === agreement.id)
        .forEach((item) => {
          item.status = "signed";
          item.signedAt = isoToday;
        });
      saveState();
      renderAll();
      showToast("Avtalet markerades som signerat via kundportalen.");
    }
    return;
  }

  const drawerAgreementSend = event.target.closest("[data-send-agreement]");
  if (drawerAgreementSend && els.drawer.contains(drawerAgreementSend)) {
    const agreement = getAgreement(drawerAgreementSend.dataset.sendAgreement);
    if (agreement) {
      agreement.status = "sent";
      agreement.sentAt = isoToday;
      prepareAgreementEmail(agreement);
      saveState();
      renderAll();
      openAgreementDetail(agreement.id);
      showToast("Mejlutkast för avtalet öppnades och avtalet markerades som skickat.");
    }
    return;
  }

  const drawerAgreementEsign = event.target.closest("[data-esign-from-agreement]");
  if (drawerAgreementEsign && els.drawer.contains(drawerAgreementEsign)) {
    const agreement = getAgreement(drawerAgreementEsign.dataset.esignFromAgreement);
    if (agreement) {
      const signature = createEsignatureFromAgreement(agreement);
      saveState();
      renderAll();
      openEsignDetail(signature.id);
      showToast("E-signering skapades från avtalet.");
    }
    return;
  }

  const drawerAgreementSign = event.target.closest("[data-sign-agreement]");
  if (drawerAgreementSign && els.drawer.contains(drawerAgreementSign)) {
    const agreement = getAgreement(drawerAgreementSign.dataset.signAgreement);
    if (agreement) {
      agreement.status = "signed";
      agreement.signedAt = isoToday;
      state.esignatures
        .filter((item) => item.agreementId === agreement.id)
        .forEach((item) => {
          item.status = "signed";
          item.signedAt = isoToday;
        });
      saveState();
      renderAll();
      openAgreementDetail(agreement.id);
      showToast("Avtalet och kopplade signeringar markerades som signerade.");
    }
    return;
  }

  const drawerEsignSend = event.target.closest("[data-send-esign]");
  if (drawerEsignSend && els.drawer.contains(drawerEsignSend)) {
    const item = state.esignatures.find((signature) => signature.id === drawerEsignSend.dataset.sendEsign);
    if (item && prepareEsignEmail(item)) {
      saveState();
      renderAll();
      openEsignDetail(item.id);
      showToast("Mejlutkast för signeringen öppnades.");
    }
    return;
  }

  const drawerEsignRemind = event.target.closest("[data-remind-esign]");
  if (drawerEsignRemind && els.drawer.contains(drawerEsignRemind)) {
    const item = state.esignatures.find((signature) => signature.id === drawerEsignRemind.dataset.remindEsign);
    if (item && prepareEsignEmail(item, true)) {
      saveState();
      renderAll();
      openEsignDetail(item.id);
      showToast("Påminnelseutkast öppnades.");
    }
    return;
  }

  const drawerEsignSign = event.target.closest("[data-sign-esign]");
  if (drawerEsignSign && els.drawer.contains(drawerEsignSign)) {
    const item = state.esignatures.find((signature) => signature.id === drawerEsignSign.dataset.signEsign);
    if (item) {
      item.status = "signed";
      item.signedAt = isoToday;
      const agreement = getAgreement(item.agreementId);
      if (agreement) {
        agreement.status = "signed";
        agreement.signedAt = isoToday;
      }
      saveState();
      renderAll();
      openEsignDetail(item.id);
      showToast("Signeringen markerades som signerad.");
    }
    return;
  }

  const drawerInvoicePreview = event.target.closest("[data-invoice-preview]");
  if (drawerInvoicePreview && els.drawer.contains(drawerInvoicePreview)) {
    previewInvoiceDocument(drawerInvoicePreview.dataset.invoicePreview);
    return;
  }

  const drawerInvoiceDownload = event.target.closest("[data-invoice-download]");
  if (drawerInvoiceDownload && els.drawer.contains(drawerInvoiceDownload)) {
    downloadInvoiceDocument(drawerInvoiceDownload.dataset.invoiceDownload);
    return;
  }

  const drawerInvoiceStoredDownload = event.target.closest("[data-invoice-stored-download]");
  if (drawerInvoiceStoredDownload && els.drawer.contains(drawerInvoiceStoredDownload)) {
    downloadStoredInvoiceDocument(drawerInvoiceStoredDownload.dataset.invoiceStoredDownload);
    return;
  }

  const drawerInvoiceDraft = event.target.closest("[data-invoice-draft]");
  if (drawerInvoiceDraft && els.drawer.contains(drawerInvoiceDraft)) {
    if (saveInvoiceDraft(drawerInvoiceDraft.dataset.invoiceDraft)) {
      saveState();
      renderAll();
      openInvoiceDetail(drawerInvoiceDraft.dataset.invoiceDraft);
      showToast("Fakturaunderlaget sparades som utkast.");
    }
    return;
  }

  const drawerInvoiceApproveLine = event.target.closest("[data-invoice-line-approve]");
  if (drawerInvoiceApproveLine && els.drawer.contains(drawerInvoiceApproveLine)) {
    if (approveInvoiceLine(drawerInvoiceApproveLine.dataset.invoiceLineApprove, drawerInvoiceApproveLine.dataset.invoiceLineId)) {
      saveState();
      renderAll();
      openInvoiceDetail(drawerInvoiceApproveLine.dataset.invoiceProjectId);
      showToast("Raden attesterades och kan faktureras.");
    }
    return;
  }

  const drawerInvoiceApproveBlocked = event.target.closest("[data-invoice-approve-blocked]");
  if (drawerInvoiceApproveBlocked && els.drawer.contains(drawerInvoiceApproveBlocked)) {
    const count = approveInvoiceBlockedItems(drawerInvoiceApproveBlocked.dataset.invoiceApproveBlocked);
    if (!count) {
      showToast("Det finns inga spärrade fakturarader att attestera.", "warning");
      return;
    }
    saveState();
    renderAll();
    openInvoiceDetail(drawerInvoiceApproveBlocked.dataset.invoiceApproveBlocked);
    showToast(`${count} spärrade fakturarader attesterades.`);
    return;
  }

  const drawerInvoiceOpenApproval = event.target.closest("[data-invoice-open-approval]");
  if (drawerInvoiceOpenApproval && els.drawer.contains(drawerInvoiceOpenApproval)) {
    if (els.approvalProjectFilter) els.approvalProjectFilter.value = drawerInvoiceOpenApproval.dataset.invoiceOpenApproval;
    if (els.approvalKindFilter) els.approvalKindFilter.value = "all";
    if (els.approvalStatusFilter) els.approvalStatusFilter.value = "open";
    if (els.approvalSearch) els.approvalSearch.value = "";
    closeDrawer();
    setView("reports");
    renderApprovalFlow();
    showToast("Öppnade attestflödet för fakturaunderlaget.");
    return;
  }

  const drawerInvoiceCreate = event.target.closest("[data-invoice-create]");
  if (drawerInvoiceCreate && els.drawer.contains(drawerInvoiceCreate)) {
    const record = createInvoiceFromProject(drawerInvoiceCreate.dataset.invoiceCreate);
    if (record) {
      saveState();
      renderAll();
      openInvoiceRecordDetail(record.id);
      showToast("Fakturaunderlag skapades och poster markerades som fakturerade.");
    } else {
      showToast("Det finns inget att fakturera på underlaget.", "warning");
    }
    return;
  }

  const drawerInvoiceEmail = event.target.closest("[data-invoice-email]");
  if (drawerInvoiceEmail && els.drawer.contains(drawerInvoiceEmail)) {
    if (sendInvoiceEmail(drawerInvoiceEmail.dataset.invoiceEmail)) {
      saveState();
      renderAll();
      openInvoiceRecordDetail(drawerInvoiceEmail.dataset.invoiceEmail);
      showToast("E-postutkast öppnades och fakturan markerades som skickad.");
    }
    return;
  }

  const drawerInvoiceSharePortal = event.target.closest("[data-invoice-share-portal]");
  if (drawerInvoiceSharePortal && els.drawer.contains(drawerInvoiceSharePortal)) {
    shareInvoiceToPortal(drawerInvoiceSharePortal.dataset.invoiceSharePortal);
    return;
  }

  const drawerInvoiceStatus = event.target.closest("[data-invoice-status]");
  if (drawerInvoiceStatus && els.drawer.contains(drawerInvoiceStatus)) {
    const status = drawerInvoiceStatus.dataset.invoiceStatus;
    if (status === "credited" && !window.confirm("Vill du markera fakturan som krediterad?")) return;
    const invoice = (state.invoices || []).find((item) => item.id === drawerInvoiceStatus.dataset.invoiceId);
    if (status === "changeRequested" && invoice) {
      const message = window.prompt("Vad behöver ändras på fakturan?", invoice.changeRequestMessage || "Kunden vill justera underlaget.");
      if (message === null) return;
      invoice.changeRequestMessage = message.trim() || "Kunden vill justera underlaget.";
      invoice.changeRequestedBy = getCurrentUser().name;
    }
    if (setInvoiceStatus(drawerInvoiceStatus.dataset.invoiceId, status)) {
      saveState();
      renderAll();
      openInvoiceRecordDetail(drawerInvoiceStatus.dataset.invoiceId);
      showToast(`Fakturan markerades som ${getInvoiceStatusLabel(status).toLowerCase()}.`);
    }
    return;
  }

  const drawerInvoiceReopen = event.target.closest("[data-invoice-reopen]");
  if (drawerInvoiceReopen && els.drawer.contains(drawerInvoiceReopen)) {
    if (!window.confirm("Vill du återöppna fakturan och släppa tillbaka underlaget till fakturering?")) return;
    if (reopenInvoice(drawerInvoiceReopen.dataset.invoiceReopen)) {
      saveState();
      renderAll();
      openInvoiceRecordDetail(drawerInvoiceReopen.dataset.invoiceReopen);
      showToast("Fakturan återöppnades och underlaget kan faktureras igen.");
    }
    return;
  }

  const drawerEditClient = event.target.closest("[data-edit-client]");
  if (drawerEditClient && els.drawer.contains(drawerEditClient)) {
    openEntityEditor("client", drawerEditClient.dataset.editClient);
    return;
  }

  const cloudActionButton = event.target.closest("[data-cloud-action]");
  if (cloudActionButton && els.drawer.contains(cloudActionButton)) {
    const action = cloudActionButton.dataset.cloudAction;
    if (action === "refresh") {
      checkCloudConnection({ silent: false })
        .then(() => refreshCloudSession())
        .then(() => openDrawer("cloud"));
    }
    if (action === "signout") {
      cloudSignOut().then(() => openDrawer("cloud"));
    }
    return;
  }

  const invoiceLineExclude = event.target.closest("[data-invoice-line-exclude]");
  if (invoiceLineExclude && els.drawer.contains(invoiceLineExclude)) {
    excludeInvoiceLine(
      invoiceLineExclude.dataset.invoiceLineExclude,
      invoiceLineExclude.dataset.invoiceLineId,
      invoiceLineExclude.dataset.invoiceProjectId
    );
    return;
  }

  const actionButton = event.target.closest("[data-action]");
  if (!actionButton) return;
  const action = actionButton.dataset.action;

  if (action === "add-shortcut") {
    const label = window.prompt("Namn på genvägen:", els.pageTitle.textContent);
    if (!label) return;
    const activeView = [...els.views].find((view) => view.classList.contains("active"))?.id?.replace("-view", "") || "dashboard";
    state.shortcuts.push({ label: label.trim(), view: activeView });
    saveState();
    renderShortcuts();
    showToast("Genvägen sparades.");
  }

  if (action === "news-search") {
    focusElement(els.globalSearch);
    showToast("Skriv till exempel faktura, avtal, kund eller tid och tryck Enter.");
  }

  if (action === "news-archive") {
    els.newsTabs.forEach((item) => item.classList.remove("active"));
    updateNewsTab("archive");
    showToast("Arkivet visas i nyhetsytan.");
  }

  if (action === "news-create") {
    const title = window.prompt("Rubrik för inlägget:", "Ny rutin");
    if (!title) return;
    const body = window.prompt("Text i inlägget:", "Beskriv rutinen här.");
    if (!body) return;
    state.newsPosts.unshift({
      id: makeId(),
      title: title.trim(),
      body: body.trim(),
      category: "Nyhet",
      author: "Admin",
      date: isoToday
    });
    saveState();
    els.newsTabs.forEach((item) => item.classList.remove("active"));
    updateNewsTab("draft");
    showToast("Inlägget sparades lokalt.");
  }

  if (action === "like-news") {
    newsLikes += 1;
    updateNewsReactions();
  }

  if (action === "comment-news") {
    const body = window.prompt("Skriv en kommentar:", "Jag har läst.");
    if (!body) return;
    if (!state.newsPosts.length) {
      state.newsPosts.unshift({
        id: makeId(),
        title: els.newsTitle?.textContent || "Nyhet",
        body: els.newsBody?.textContent || "Kommentar från startsidan.",
        category: "Kommentar",
        author: "System",
        date: isoToday,
        comments: []
      });
    }
    state.newsPosts[0].comments = state.newsPosts[0].comments || [];
    state.newsPosts[0].comments.push({
      id: makeId(),
      author: getCurrentUser().name,
      body: body.trim(),
      date: isoToday
    });
    saveState();
    updateNewsReactions();
    updateNewsTab("draft");
    showToast("Kommentaren sparades på nyheten.");
  }
});

document.addEventListener("submit", async (event) => {
  const cloudLoginForm = event.target.closest("#cloud-login-form");
  if (cloudLoginForm) {
    event.preventDefault();
    const data = new FormData(cloudLoginForm);
    if (await cloudSignIn(String(data.get("email") || "").trim(), String(data.get("password") || ""))) {
      openDrawer("cloud");
    }
    return;
  }

  const cloudRegisterForm = event.target.closest("#cloud-register-form");
  if (cloudRegisterForm) {
    event.preventDefault();
    const data = new FormData(cloudRegisterForm);
    if (await cloudRegisterAccount(data)) {
      openDrawer("cloud");
    }
    return;
  }

  const portalUploadForm = event.target.closest("[data-portal-upload-form]");
  if (portalUploadForm) {
    event.preventDefault();
    await handlePortalUploadSubmit(portalUploadForm);
    return;
  }

  const portalCommentForm = event.target.closest("[data-portal-comment-form]");
  if (portalCommentForm) {
    event.preventDefault();
    handlePortalCommentSubmit(portalCommentForm);
    return;
  }

  const invoiceSettingsForm = event.target.closest("[data-invoice-settings-form]");
  if (invoiceSettingsForm) {
    event.preventDefault();
    updateInvoiceSettings(invoiceSettingsForm);
    return;
  }

  const storedInvoiceSettingsForm = event.target.closest("[data-stored-invoice-settings-form]");
  if (storedInvoiceSettingsForm) {
    event.preventDefault();
    updateStoredInvoiceSettings(storedInvoiceSettingsForm);
    return;
  }

  const editForm = event.target.closest("[data-edit-form]");
  if (editForm) {
    event.preventDefault();
    await updateEditedEntity(editForm);
    return;
  }

  if (event.target.id !== "settings-form") return;
  event.preventDefault();
  state.settings = {
    companyName: document.querySelector("#settings-company").value.trim() || defaultState.settings.companyName,
    adminEmail: document.querySelector("#settings-email").value.trim() || defaultState.settings.adminEmail,
    defaultRate: Number(document.querySelector("#settings-rate").value || 0),
    workdayHours: Math.max(0, normalizeNumber(document.querySelector("#settings-workday-hours").value, 8)),
    approvalMode: document.querySelector("#settings-approval").value,
    weekLockDay: document.querySelector("#settings-lock-day").value.trim() || "Fredag",
    defaultDueDays: Math.max(1, Number(document.querySelector("#settings-default-due-days").value || 7)),
    invoicePrefix: document.querySelector("#settings-invoice-prefix").value.trim() || "F",
    nextInvoiceNumber: Math.max(1, Number(document.querySelector("#settings-next-invoice").value || 1)),
    paymentTerms: Math.max(0, Number(document.querySelector("#settings-payment-terms").value || 10)),
    vatRate: Math.max(0, normalizeNumber(document.querySelector("#settings-vat-rate").value, 25)),
    invoiceReminderDays: Math.max(1, Number(document.querySelector("#settings-invoice-reminder-days").value || 5)),
    bankgiro: document.querySelector("#settings-bankgiro").value.trim(),
    invoiceFooter: document.querySelector("#settings-invoice-footer").value.trim(),
    portalAutoNotify: document.querySelector("#settings-portal-auto-notify").checked,
    customerApprovalRequired: document.querySelector("#settings-customer-approval-required").checked
  };
  saveState();
  renderBranding();
  closeDrawer();
  showToast("Inställningarna sparades.");
});

els.entryDate.value = isoToday;
els.projectStart.value = isoToday;
els.receiptDate.value = isoToday;
els.travelDate.value = isoToday;
els.agreementWatch.value = offsetDate(30);
els.agreementEnd.value = offsetDate(365);
els.esignReminder.value = offsetDate(7);
els.esignDue.value = offsetDate(14);
els.invoiceFrom.value = offsetDate(-14);
els.invoiceTo.value = isoToday;
els.entryEmployee.value = getCurrentUser().name;
els.agreementOwner.value = getCurrentUser().name;
els.esignOwner.value = getCurrentUser().name;

els.entryForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const row = await addEntry({
    date: els.entryDate.value,
    employee: els.entryEmployee.value.trim(),
    type: els.entryType.value,
    clientId: els.entryClient.value,
    projectId: els.entryProject.value,
    workOrder: els.entryWorkOrder.value.trim(),
    task: els.entryTask.value,
    hours: els.entryHours.value,
    billable: els.entryBillable.checked,
    payroll: els.entryPayroll.checked,
    status: els.entryStatus.value,
    description: els.entryDescription.value.trim()
  });
  if (!row) return;
  els.entryWorkOrder.value = "";
  els.entryDescription.value = "";
  els.entryHours.value = "1.0";
  showToast(canUseCloudData() ? "Tidsraden sparades." : "Tidsraden sparades lokalt.");
});

els.clientForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const client = {
    id: makeId(),
    name: els.clientName.value.trim(),
    org: els.clientOrg.value.trim(),
    email: els.clientEmail.value.trim(),
    billingEmail: els.clientEmail.value.trim(),
    invoiceReference: "",
    invoiceAddress: "",
    paymentTerms: "",
    vatRate: "",
    owner: els.clientOwner.value.trim(),
    rate: Number(els.clientRate.value || 0)
  };
  if (canUseCloudData()) {
    try {
      const savedClient = await saveCloudClient(client);
      if (savedClient?.id) Object.assign(client, savedClient);
    } catch (error) {
      showToast(`Kunden sparades lokalt men inte i Supabase: ${error.message}`, "warning");
    }
  }
  state.clients.push(client);
  selectedClientId = client.id;
  saveState();
  els.clientForm.reset();
  els.clientRate.value = "950";
  renderAll();
  showToast(canUseCloudData() && isUuid(client.id) ? "Kunden skapades i Supabase." : "Kunden skapades.");
});

els.projectForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const project = {
    id: makeId(),
    name: els.projectName.value.trim(),
    clientId: els.projectClient.value,
    manager: els.projectManager.value.trim(),
    start: els.projectStart.value,
    status: els.projectStatus.value,
    budget: Number(els.projectBudget.value || 0),
    description: els.projectDescription.value.trim(),
    checklist: [
      { text: "Planera uppdrag", done: false },
      { text: "Samla underlag", done: false },
      { text: "Godkänn leverans", done: false }
    ]
  };
  if (canUseCloudData()) {
    try {
      const savedProject = await saveCloudProject(project);
      if (savedProject?.id) Object.assign(project, savedProject);
    } catch (error) {
      showToast(`Projektet sparades lokalt men inte i Supabase: ${error.message}`, "warning");
    }
  }
  state.projects.push(project);
  saveState();
  els.projectForm.reset();
  els.projectStart.value = isoToday;
  els.projectBudget.value = "20";
  renderAll();
  showToast(canUseCloudData() && isUuid(project.id) ? "Projektet skapades i Supabase." : "Projektet skapades.");
});

els.receiptForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const uploadedFile = await readFileInput(els.receiptFile);
  state.receipts.unshift({
    id: makeId(),
    date: els.receiptDate.value,
    supplier: els.receiptSupplier.value.trim(),
    amount: Number(els.receiptAmount.value || 0),
    vat: Number(els.receiptVat.value || 0),
    clientId: els.receiptClient.value,
    projectId: els.receiptProject.value,
    billable: els.receiptBillable.checked,
    payroll: els.receiptPayroll.checked,
    status: "draft",
    reviewNote: "",
    ...(uploadedFile || {})
  });
  saveState();
  els.receiptSupplier.value = "";
  els.receiptAmount.value = "0";
  els.receiptVat.value = "0";
  els.receiptFile.value = "";
  renderAll();
  showToast("Kvittot sparades som utkast.");
});

els.travelForm.addEventListener("submit", (event) => {
  event.preventDefault();
  state.travels.unshift({
    id: makeId(),
    date: els.travelDate.value,
    type: els.travelType.value,
    from: els.travelFrom.value.trim(),
    to: els.travelTo.value.trim(),
    quantity: Number(els.travelQuantity.value || 0),
    clientId: els.travelClient.value,
    billable: els.travelBillable.checked,
    payroll: els.travelPayroll.checked,
    status: "draft",
    reviewNote: ""
  });
  saveState();
  els.travelFrom.value = "";
  els.travelTo.value = "";
  els.travelQuantity.value = "1";
  renderAll();
  showToast("Resan sparades som utkast.");
});

els.agreementForm.addEventListener("submit", (event) => {
  event.preventDefault();
  state.agreements.push({
    id: makeId(),
    number: getNextNumber(state.agreements, 10),
    title: els.agreementTitle.value.trim(),
    type: els.agreementType.value,
    clientId: els.agreementClient.value,
    projectId: els.agreementProject.value,
    clientEmail: els.agreementEmail.value.trim() || getClient(els.agreementClient.value)?.billingEmail || getClient(els.agreementClient.value)?.email || "",
    createdAt: isoToday,
    watchDate: els.agreementWatch.value,
    endDate: els.agreementEnd.value,
    owner: els.agreementOwner.value.trim(),
    label: els.agreementLabel.value,
    permission: els.agreementPermission.value,
    scope: els.agreementScope.value.trim(),
    price: els.agreementPrice.value.trim(),
    payment: els.agreementPayment.value.trim(),
    message: els.agreementMessage.value.trim(),
    status: "draft",
    sentAt: "",
    signedAt: "",
    archivedAt: ""
  });
  saveState();
  els.agreementForm.reset();
  els.agreementOwner.value = "Anna Berg";
  els.agreementWatch.value = offsetDate(30);
  els.agreementEnd.value = offsetDate(365);
  els.agreementPayment.value = "10 dagar netto";
  renderAll();
  showToast("Avtalet skapades och ligger klart för utskick.");
});

els.esignForm.addEventListener("submit", (event) => {
  event.preventDefault();
  state.esignatures.push({
    id: makeId(),
    number: getNextNumber(state.esignatures, 1000),
    title: els.esignTitle.value.trim(),
    docType: els.esignDocType.value,
    agreementId: els.esignAgreement.value,
    clientId: els.esignClient.value,
    owner: els.esignOwner.value.trim(),
    reminderDate: els.esignReminder.value,
    dueDate: els.esignDue.value,
    message: els.esignMessage.value.trim(),
    status: els.esignStatus.value,
    createdAt: isoToday,
    sentAt: els.esignStatus.value === "sent" ? isoToday : "",
    signedAt: "",
    reminderSentAt: ""
  });
  saveState();
  els.esignForm.reset();
  els.esignOwner.value = "Anna Berg";
  els.esignReminder.value = offsetDate(7);
  els.esignDue.value = offsetDate(14);
  renderAll();
  showToast("E-signeringen skapades.");
});

els.entriesTable.addEventListener("click", async (event) => {
  const submitButton = event.target.closest("[data-submit-entry]");
  const approveButton = event.target.closest("[data-approve]");
  const rejectButton = event.target.closest("[data-reject-entry]");
  const editButton = event.target.closest("[data-edit-entry]");
  const deleteButton = event.target.closest("[data-delete]");

  if (submitButton) {
    await handleApprovalAction("submit", "entry", submitButton.dataset.submitEntry);
    return;
  }

  if (approveButton) {
    await handleApprovalAction("approve", "entry", approveButton.dataset.approve);
    return;
  }

  if (rejectButton) {
    await handleApprovalAction("reject", "entry", rejectButton.dataset.rejectEntry);
    return;
  }

  if (editButton) {
    openEntityEditor("entry", editButton.dataset.editEntry);
    return;
  }

  if (deleteButton) {
    const entry = state.entries.find((item) => item.id === deleteButton.dataset.delete);
    if (entry && isLockedStatus(entry.status)) {
      showToast("Attesterade och fakturerade tidsrader är låsta.", "warning");
      return;
    }
    if (!window.confirm("Vill du ta bort tidsraden?")) return;
    try {
      await deleteCloudEntry(deleteButton.dataset.delete);
    } catch (error) {
      showToast(`Tidsraden kunde inte tas bort i Supabase: ${error.message}`, "warning");
      return;
    }
    state.entries = state.entries.filter((item) => item.id !== deleteButton.dataset.delete);
    showToast("Tidsraden togs bort.");
    saveState();
    renderAll();
  }
});

els.clientGrid.addEventListener("click", async (event) => {
  if (handleClientAction(event)) return;
  const editButton = event.target.closest("[data-edit-client]");
  if (editButton) {
    openEntityEditor("client", editButton.dataset.editClient);
    return;
  }
  const button = event.target.closest("[data-delete-client]");
  if (!button) return;

  const clientHasEntries = state.entries.some((entry) => entry.clientId === button.dataset.deleteClient);
  if (clientHasEntries) {
    showToast("Kunden har tidsrader och kan inte tas bort.", "warning");
    return;
  }

  if (!window.confirm("Vill du ta bort kunden?")) return;
  try {
    await deleteCloudClient(button.dataset.deleteClient);
  } catch (error) {
    showToast(`Kunden kunde inte tas bort i Supabase: ${error.message}`, "warning");
    return;
  }
  state.clients = state.clients.filter((client) => client.id !== button.dataset.deleteClient);
  saveState();
  renderAll();
  showToast("Kunden togs bort.");
});

els.clientDetail?.addEventListener("click", (event) => {
  const editButton = event.target.closest("[data-edit-client]");
  if (editButton) {
    openEntityEditor("client", editButton.dataset.editClient);
    return;
  }
  const projectButton = event.target.closest("[data-open-project]");
  if (projectButton) {
    selectedProjectId = projectButton.dataset.openProject;
    setView("projects");
    renderProjects();
    showToast("Öppnade projektkortet.");
    return;
  }
  const receiptButton = event.target.closest("[data-edit-receipt]");
  if (receiptButton) {
    openEntityEditor("receipt", receiptButton.dataset.editReceipt);
    return;
  }
  const travelButton = event.target.closest("[data-edit-travel]");
  if (travelButton) {
    openEntityEditor("travel", travelButton.dataset.editTravel);
    return;
  }
  const agreementButton = event.target.closest("[data-edit-agreement]");
  if (agreementButton) {
    openEntityEditor("agreement", agreementButton.dataset.editAgreement);
    return;
  }
  handleClientAction(event);
});

els.projectGrid.addEventListener("click", async (event) => {
  const startTimerButton = event.target.closest("[data-start-project-timer]");
  const openButton = event.target.closest("[data-open-project]");
  const editButton = event.target.closest("[data-edit-project]");
  const deleteButton = event.target.closest("[data-delete-project]");
  if (startTimerButton) {
    handleProjectAction("start-timer", startTimerButton.dataset.startProjectTimer);
    return;
  }
  if (openButton) {
    selectedProjectId = openButton.dataset.openProject;
    renderProjects();
    showToast("Öppnade projektkortet.");
    return;
  }
  if (editButton) {
    openEntityEditor("project", editButton.dataset.editProject);
    return;
  }
  if (deleteButton) {
    const projectId = deleteButton.dataset.deleteProject;
    const hasEntries = state.entries.some((entry) => entry.projectId === projectId);
    if (hasEntries) {
      showToast("Projektet har tidsrader och kan inte tas bort.", "warning");
      return;
    }
    if (!window.confirm("Vill du ta bort projektet?")) return;
    try {
      await deleteCloudProject(projectId);
    } catch (error) {
      showToast(`Projektet kunde inte tas bort i Supabase: ${error.message}`, "warning");
      return;
    }
    state.projects = state.projects.filter((project) => project.id !== projectId);
    saveState();
    renderAll();
    showToast("Projektet togs bort.");
  }
});

els.projectDetail?.addEventListener("click", (event) => {
  const startTimerButton = event.target.closest("[data-start-project-timer]");
  const projectActionButton = event.target.closest("[data-project-action]");
  const editProject = event.target.closest("[data-edit-project]");
  const editEntry = event.target.closest("[data-edit-entry]");
  const editReceipt = event.target.closest("[data-edit-receipt]");
  if (projectActionButton) {
    handleProjectAction(projectActionButton.dataset.projectAction, projectActionButton.dataset.projectId);
    return;
  }
  if (startTimerButton) {
    handleProjectAction("start-timer", startTimerButton.dataset.startProjectTimer);
    return;
  }
  if (editProject) {
    openEntityEditor("project", editProject.dataset.editProject);
    return;
  }
  if (editEntry) {
    openEntityEditor("entry", editEntry.dataset.editEntry);
    return;
  }
  if (editReceipt) {
    openEntityEditor("receipt", editReceipt.dataset.editReceipt);
    return;
  }
  if (handleClientAction(event)) return;
});

els.projectGrid.addEventListener("change", (event) => {
  const checkbox = event.target.closest("[data-project-check]");
  if (!checkbox) return;
  const project = state.projects.find((item) => item.id === checkbox.dataset.projectCheck);
  const index = Number(checkbox.dataset.checkIndex);
  if (project?.checklist?.[index]) {
    project.checklist[index].done = checkbox.checked;
    saveState();
    renderAll();
    showToast(checkbox.checked ? "Projektsteget markerades klart." : "Projektsteget öppnades igen.");
  }
});

els.receiptList.addEventListener("click", (event) => {
  const toggleBillable = event.target.closest("[data-toggle-receipt-billable]");
  const togglePayroll = event.target.closest("[data-toggle-receipt-payroll]");
  const submitButton = event.target.closest("[data-submit-receipt]");
  const approveButton = event.target.closest("[data-approve-receipt]");
  const rejectButton = event.target.closest("[data-reject-receipt]");
  const editButton = event.target.closest("[data-edit-receipt]");
  const deleteButton = event.target.closest("[data-delete-receipt]");
  if (toggleBillable) {
    toggleExpenseFlag("receipt", toggleBillable.dataset.toggleReceiptBillable, "billable");
    return;
  }
  if (togglePayroll) {
    toggleExpenseFlag("receipt", togglePayroll.dataset.toggleReceiptPayroll, "payroll");
    return;
  }
  if (submitButton) {
    handleApprovalAction("submit", "receipt", submitButton.dataset.submitReceipt);
    return;
  }
  if (approveButton) {
    handleApprovalAction("approve", "receipt", approveButton.dataset.approveReceipt);
    return;
  }
  if (rejectButton) {
    handleApprovalAction("reject", "receipt", rejectButton.dataset.rejectReceipt);
    return;
  }
  if (editButton) {
    openEntityEditor("receipt", editButton.dataset.editReceipt);
    return;
  }
  if (deleteButton) {
    const receipt = state.receipts.find((item) => item.id === deleteButton.dataset.deleteReceipt);
    if (receipt && isLockedStatus(receipt.status)) {
      showToast("Attesterade och fakturerade kvitton är låsta.", "warning");
      return;
    }
    if (!window.confirm("Vill du ta bort kvittot?")) return;
    state.receipts = state.receipts.filter((item) => item.id !== deleteButton.dataset.deleteReceipt);
    saveState();
    renderAll();
    showToast("Kvittot togs bort.");
  }
});

els.travelList.addEventListener("click", (event) => {
  const toggleBillable = event.target.closest("[data-toggle-travel-billable]");
  const togglePayroll = event.target.closest("[data-toggle-travel-payroll]");
  const submitButton = event.target.closest("[data-submit-travel]");
  const approveButton = event.target.closest("[data-approve-travel]");
  const rejectButton = event.target.closest("[data-reject-travel]");
  const editButton = event.target.closest("[data-edit-travel]");
  const deleteButton = event.target.closest("[data-delete-travel]");
  if (toggleBillable) {
    toggleExpenseFlag("travel", toggleBillable.dataset.toggleTravelBillable, "billable");
    return;
  }
  if (togglePayroll) {
    toggleExpenseFlag("travel", togglePayroll.dataset.toggleTravelPayroll, "payroll");
    return;
  }
  if (submitButton) {
    handleApprovalAction("submit", "travel", submitButton.dataset.submitTravel);
    return;
  }
  if (approveButton) {
    handleApprovalAction("approve", "travel", approveButton.dataset.approveTravel);
    return;
  }
  if (rejectButton) {
    handleApprovalAction("reject", "travel", rejectButton.dataset.rejectTravel);
    return;
  }
  if (editButton) {
    openEntityEditor("travel", editButton.dataset.editTravel);
    return;
  }
  if (deleteButton) {
    const travel = state.travels.find((item) => item.id === deleteButton.dataset.deleteTravel);
    if (travel && isLockedStatus(travel.status)) {
      showToast("Attesterade och fakturerade resor är låsta.", "warning");
      return;
    }
    if (!window.confirm("Vill du ta bort resan?")) return;
    state.travels = state.travels.filter((item) => item.id !== deleteButton.dataset.deleteTravel);
    saveState();
    renderAll();
    showToast("Resan togs bort.");
  }
});

els.approvalList.addEventListener("click", async (event) => {
  const openButton = event.target.closest("[data-approval-open]");
  if (openButton) {
    openApprovalItem(openButton.dataset.approvalOpen, openButton.dataset.approvalId);
    return;
  }

  const button = event.target.closest("[data-approval-action]");
  if (!button) return;
  await handleApprovalAction(button.dataset.approvalAction, button.dataset.approvalKind, button.dataset.approvalId);
});

els.approvalGroupSummary?.addEventListener("click", (event) => {
  const button = event.target.closest("[data-approval-kind-shortcut]");
  if (!button) return;
  if (els.approvalKindFilter) els.approvalKindFilter.value = button.dataset.approvalKindShortcut;
  renderApprovalFlow();
  showToast(`Visar ${getApprovalKindLabel(button.dataset.approvalKindShortcut).toLowerCase()} i attestflödet.`);
});

els.approvalSummary?.addEventListener("click", (event) => {
  const statusButton = event.target.closest("[data-approval-summary-filter]");
  if (statusButton && els.approvalStatusFilter) {
    els.approvalStatusFilter.value = statusButton.dataset.approvalSummaryFilter;
    if (els.approvalActionableOnly) els.approvalActionableOnly.checked = false;
    renderApprovalFlow();
    showToast("Attestflödet filtrerades.");
    return;
  }

  const actionableButton = event.target.closest("[data-approval-actionable-shortcut]");
  if (!actionableButton || !els.approvalActionableOnly) return;
  els.approvalActionableOnly.checked = true;
  renderApprovalFlow();
  showToast("Visar poster som kan hanteras.");
});

["input", "change"].forEach((eventName) => {
  els.approvalSearch?.addEventListener(eventName, renderApprovalFlow);
});
els.approvalOwnerFilter?.addEventListener("change", renderApprovalFlow);
els.approvalProjectFilter?.addEventListener("change", renderApprovalFlow);
els.approvalKindFilter?.addEventListener("change", renderApprovalFlow);
els.approvalStatusFilter?.addEventListener("change", renderApprovalFlow);
els.approvalFrom?.addEventListener("change", renderApprovalFlow);
els.approvalTo?.addEventListener("change", renderApprovalFlow);
els.approvalActionableOnly?.addEventListener("change", renderApprovalFlow);
els.approvalResetFilters?.addEventListener("click", () => {
  if (els.approvalSearch) els.approvalSearch.value = "";
  if (els.approvalOwnerFilter) els.approvalOwnerFilter.value = "all";
  if (els.approvalProjectFilter) els.approvalProjectFilter.value = "all";
  if (els.approvalKindFilter) els.approvalKindFilter.value = "all";
  if (els.approvalStatusFilter) els.approvalStatusFilter.value = "open";
  if (els.approvalFrom) els.approvalFrom.value = "";
  if (els.approvalTo) els.approvalTo.value = "";
  if (els.approvalActionableOnly) els.approvalActionableOnly.checked = false;
  renderApprovalFlow();
  showToast("Attestfiltren rensades.");
});

els.receiptSearch?.addEventListener("input", renderReceipts);
els.receiptStatusFilter?.addEventListener("change", renderReceipts);
els.receiptSubmitDrafts?.addEventListener("click", () => runExpenseBulkAction("receipt", "submit"));
els.receiptApproveSubmitted?.addEventListener("click", () => runExpenseBulkAction("receipt", "approve"));
els.travelSearch?.addEventListener("input", renderTravels);
els.travelStatusFilter?.addEventListener("change", renderTravels);
els.travelSubmitDrafts?.addEventListener("click", () => runExpenseBulkAction("travel", "submit"));
els.travelApproveSubmitted?.addEventListener("click", () => runExpenseBulkAction("travel", "approve"));

els.approvalSelectAll?.addEventListener("change", () => {
  const checkboxes = [...document.querySelectorAll("[data-approval-select]:not(:disabled)")];
  checkboxes.forEach((checkbox) => {
    checkbox.checked = els.approvalSelectAll.checked;
  });
});

els.approvalBulkSubmit?.addEventListener("click", () => runApprovalBulkAction("submit"));
els.approvalBulkApprove?.addEventListener("click", () => runApprovalBulkAction("approve"));
els.approvalBulkReject?.addEventListener("click", () => runApprovalBulkAction("reject"));

els.agreementsTable.addEventListener("click", (event) => {
  const detailButton = event.target.closest("[data-agreement-detail]");
  const sendButton = event.target.closest("[data-send-agreement]");
  const editButton = event.target.closest("[data-edit-agreement]");
  const previewButton = event.target.closest("[data-preview-agreement]");
  const downloadButton = event.target.closest("[data-download-agreement]");
  const esignButton = event.target.closest("[data-esign-from-agreement]");
  const signButton = event.target.closest("[data-sign-agreement]");
  const archiveButton = event.target.closest("[data-archive-agreement]");

  if (detailButton) {
    openAgreementDetail(detailButton.dataset.agreementDetail);
    return;
  }

  if (editButton) {
    openEntityEditor("agreement", editButton.dataset.editAgreement);
    return;
  }

  if (sendButton) {
    const agreement = state.agreements.find((item) => item.id === sendButton.dataset.sendAgreement);
    if (agreement) {
      agreement.status = "sent";
      agreement.sentAt = isoToday;
      prepareAgreementEmail(agreement);
      showToast("Mejlutkast för avtalet öppnades och avtalet markerades som skickat.");
    }
  }

  if (previewButton) {
    const agreement = state.agreements.find((item) => item.id === previewButton.dataset.previewAgreement);
    if (agreement) {
      previewAgreementDocument(agreement);
      showToast("Avtalet öppnades i förhandsgranskning.");
    }
  }

  if (downloadButton) {
    const agreement = state.agreements.find((item) => item.id === downloadButton.dataset.downloadAgreement);
    if (agreement) {
      downloadAgreementDocument(agreement);
      showToast("Avtalsdokumentet laddades ner.");
    }
  }

  if (esignButton) {
    const agreement = state.agreements.find((item) => item.id === esignButton.dataset.esignFromAgreement);
    if (agreement) {
      createEsignatureFromAgreement(agreement);
      showToast("E-signering skapades från avtalet.");
    }
  }

  if (signButton) {
    const agreement = state.agreements.find((item) => item.id === signButton.dataset.signAgreement);
    if (agreement) {
      agreement.status = "signed";
      agreement.signedAt = isoToday;
      state.esignatures
        .filter((item) => item.agreementId === agreement.id)
        .forEach((item) => {
          item.status = "signed";
          item.signedAt = isoToday;
        });
      showToast("Avtalet markerades som signerat.");
    }
  }

  if (archiveButton) {
    const agreement = state.agreements.find((item) => item.id === archiveButton.dataset.archiveAgreement);
    if (agreement) {
      agreement.status = "archived";
      agreement.archivedAt = isoToday;
      showToast("Avtalet arkiverades.");
    }
  }

  saveState();
  renderAll();
});

els.esignTable.addEventListener("click", (event) => {
  const detailButton = event.target.closest("[data-esign-detail]");
  const editButton = event.target.closest("[data-edit-esign]");
  const sendButton = event.target.closest("[data-send-esign]");
  const remindButton = event.target.closest("[data-remind-esign]");
  const signButton = event.target.closest("[data-sign-esign]");

  if (detailButton) {
    openEsignDetail(detailButton.dataset.esignDetail);
    return;
  }

  if (editButton) {
    openEntityEditor("esign", editButton.dataset.editEsign);
    return;
  }

  if (sendButton) {
    const item = state.esignatures.find((signature) => signature.id === sendButton.dataset.sendEsign);
    if (item && prepareEsignEmail(item)) {
      showToast("Mejlutkast för signeringen öppnades och ärendet markerades som skickat.");
    }
  }

  if (remindButton) {
    const item = state.esignatures.find((signature) => signature.id === remindButton.dataset.remindEsign);
    if (item && prepareEsignEmail(item, true)) {
      item.reminderDate = isoToday;
      showToast("Påminnelseutkast öppnades och påminnelsedatum sattes till idag.");
    }
  }

  if (signButton) {
    const item = state.esignatures.find((signature) => signature.id === signButton.dataset.signEsign);
    if (item) {
      item.status = "signed";
      item.signedAt = isoToday;
      const agreement = getAgreement(item.agreementId);
      if (agreement) {
        agreement.status = "signed";
        agreement.signedAt = isoToday;
      }
      showToast("E-signeringen markerades som signerad.");
    }
  }

  saveState();
  renderAll();
});

els.quickCards.forEach((button) => {
  button.addEventListener("click", () => {
    els.quickCards.forEach((item) => item.classList.remove("active"));
    button.classList.add("active");
    applyQuickType(button.dataset.quickType);
    showToast(`${button.querySelector("strong")?.textContent || "Snabbval"} valdes.`);
  });
});

els.periodModes.forEach((button) => {
  button.addEventListener("click", () => {
    setTimePeriodMode(button.dataset.periodMode, els.entryDate.value || selectedTimeAnchorDate);
    showToast(`Visningsläge: ${button.textContent.trim()} (${getTimePeriodLabel()}).`);
  });
});

els.filterClient.addEventListener("change", renderEntriesTable);
els.filterStatus.addEventListener("change", renderEntriesTable);
els.timeStatusSummary?.addEventListener("click", (event) => {
  const flowButton = event.target.closest("[data-time-flow-action]");
  if (flowButton) {
    handleTimeFlowAction(flowButton.dataset.timeFlowAction);
    return;
  }

  const button = event.target.closest("[data-time-status-filter]");
  if (!button || !els.filterStatus) return;
  els.filterStatus.value = button.dataset.timeStatusFilter;
  renderEntriesTable();
  els.entriesTable?.scrollIntoView({ behavior: "smooth", block: "start" });
  showToast(`Tidsrader filtreras: ${button.textContent.trim().toLowerCase()}.`);
});
els.agreementSearch.addEventListener("input", renderAgreements);
els.agreementStatusFilter.addEventListener("change", renderAgreements);
els.agreementClient.addEventListener("change", () => {
  const client = getClient(els.agreementClient.value);
  els.agreementEmail.value = client?.billingEmail || client?.email || "";
  const firstProject = state.projects.find((project) => project.clientId === client?.id);
  els.agreementProject.value = firstProject?.id || "";
});
els.userList?.addEventListener("change", (event) => {
  const roleSelect = event.target.closest("[data-user-role]");
  const clientSelect = event.target.closest("[data-user-client]");
  if (!isAdminUser()) return;
  if (roleSelect) {
    const user = state.users.find((item) => item.id === roleSelect.dataset.userRole);
    if (!user) return;
    user.role = roleSelect.value;
    user.title = roleLabels[user.role] || user.title;
    if (user.role !== "customer") {
      user.clientId = "";
    } else if (!user.clientId) {
      user.clientId = state.clients.find((client) => client.name !== "Intern byrå")?.id || "";
    }
    saveState();
    renderAll();
    showToast(`Rollen för ${user.name} uppdaterades.`);
    return;
  }
  if (clientSelect) {
    const user = state.users.find((item) => item.id === clientSelect.dataset.userClient);
    if (!user) return;
    user.clientId = clientSelect.value;
    saveState();
    renderAll();
    showToast(`Kundkopplingen för ${user.name} uppdaterades.`);
  }
});
els.userList?.addEventListener("click", (event) => {
  const deleteButton = event.target.closest("[data-delete-user]");
  if (!deleteButton || !isAdminUser()) return;
  const user = state.users.find((item) => item.id === deleteButton.dataset.deleteUser);
  if (!user || user.id === state.currentUserId) return;
  if (!window.confirm(`Vill du ta bort användaren ${user.name}?`)) return;
  state.users = state.users.filter((item) => item.id !== user.id);
  saveState();
  renderAll();
  showToast("Användaren togs bort.");
});
els.accountRequestList?.addEventListener("click", (event) => {
  if (!isAdminUser()) return;
  const approveButton = event.target.closest("[data-approve-account]");
  const rejectButton = event.target.closest("[data-reject-account]");
  if (approveButton) {
    const approveId = approveButton.dataset.approveAccount;
    if (approveId?.startsWith("cloud-")) {
      cloudApproveAccountRequest(approveId.replace("cloud-", ""));
      return;
    }
    const request = state.accountRequests.find((item) => item.id === approveButton.dataset.approveAccount);
    if (!request) return;
    const user = {
      id: makeUserId(request.name),
      name: request.name,
      email: request.email,
      role: request.requestedRole || "employee",
      title: roleLabels[request.requestedRole] || "Medarbetare",
      clientId: ""
    };
    if (user.role === "customer") {
      user.clientId = state.clients.find((client) => client.name.toLowerCase() === String(request.company || "").toLowerCase())?.id
        || state.clients.find((client) => client.name !== "Intern byrå")?.id
        || "";
    }
    state.users.push(user);
    request.status = "approved";
    request.approvedAt = isoToday;
    saveState();
    renderAll();
    showToast(`${user.name} godkändes och lades till som ${roleLabels[user.role].toLowerCase()}.`);
    return;
  }
  if (rejectButton) {
    const rejectId = rejectButton.dataset.rejectAccount;
    if (rejectId?.startsWith("cloud-")) {
      cloudRejectAccountRequest(rejectId.replace("cloud-", ""));
      return;
    }
    const request = state.accountRequests.find((item) => item.id === rejectButton.dataset.rejectAccount);
    if (!request) return;
    request.status = "rejected";
    request.rejectedAt = isoToday;
    saveState();
    renderAll();
    showToast("Kontoansökan avvisades.");
  }
});
els.addAccountRequest?.addEventListener("click", () => {
  if (!isAdminUser()) return;
  const index = state.accountRequests.length + 1;
  state.accountRequests.unshift({
    id: makeId(),
    name: `Ny användare ${index}`,
    email: `ny.anvandare${index}@example.se`,
    requestedRole: "employee",
    company: "Ny kund",
    status: "pending",
    createdAt: isoToday,
    note: "Testansökan skapad lokalt."
  });
  saveState();
  renderAll();
  showToast("Testansökan skapades.");
});
els.adminOpenSettings?.addEventListener("click", () => openDrawer("settings"));
els.adminCreateUser?.addEventListener("click", createManualUser);
els.esignSearch.addEventListener("input", renderEsignatures);
els.esignStatusFilter.addEventListener("change", renderEsignatures);
els.esignAgreement.addEventListener("change", () => {
  const agreement = getAgreement(els.esignAgreement.value);
  if (!agreement) return;
  els.esignClient.value = agreement.clientId;
  els.esignTitle.value = els.esignTitle.value || `Signering av ${agreement.title}`;
  els.esignOwner.value = agreement.owner || els.esignOwner.value;
  els.esignMessage.value = els.esignMessage.value || agreement.message || "";
});
els.portalClient?.addEventListener("change", renderPortal);
els.portalNewTask?.addEventListener("click", createPortalTaskForCurrentClient);
els.portalSummary?.addEventListener("click", (event) => {
  const focusButton = event.target.closest("[data-portal-focus]");
  if (focusButton) {
    handlePortalFocus(focusButton.dataset.portalFocus);
    return;
  }
});
els.portalTaskList?.addEventListener("click", (event) => {
  const button = event.target.closest("[data-portal-task-action]");
  if (!button) return;
  handlePortalTaskAction(button.dataset.portalTaskAction, button.dataset.portalTaskId);
});
els.portalInvoices?.addEventListener("click", (event) => {
  const documentButton = event.target.closest("[data-open-document]");
  if (documentButton) {
    openStoredDocument(documentButton.dataset.openDocument, documentButton.dataset.documentId);
    return;
  }
  const detailButton = event.target.closest("[data-invoice-detail]");
  if (detailButton) {
    openInvoiceRecordDetail(detailButton.dataset.invoiceDetail);
    return;
  }
  const shareButton = event.target.closest("[data-invoice-share-portal]");
  if (shareButton) {
    shareInvoiceToPortal(shareButton.dataset.invoiceSharePortal);
    return;
  }
  const button = event.target.closest("[data-portal-invoice-action]");
  if (!button) return;
  handlePortalInvoiceAction(button.dataset.portalInvoiceAction, button.dataset.portalInvoiceId);
});
els.portalTemplates?.addEventListener("click", (event) => {
  const button = event.target.closest("[data-portal-template]");
  if (!button) return;
  createPortalTaskFromTemplate(button.dataset.portalTemplate);
});
els.collaborationCopyLink?.addEventListener("click", async () => {
  const url = `${location.origin}${location.pathname}#collaboration`;
  try {
    await navigator.clipboard.writeText(url);
    showToast("LÃ¤nk till samarbetsytan kopierades.");
  } catch {
    showToast(`SamarbetslÃ¤nk: ${url}`);
  }
});
els.collaborationNewThread?.addEventListener("click", () => {
  if (!els.portalClient?.value && state.clients[0]) els.portalClient.value = state.clients[0].id;
  createPortalTaskForCurrentClient();
  renderCollaboration();
});
els.collaborationFeed?.addEventListener("click", (event) => {
  const portalButton = event.target.closest("[data-collab-portal]");
  if (portalButton) {
    if (els.portalClient) els.portalClient.value = portalButton.dataset.collabPortal;
    setView("portal");
    renderPortal();
    showToast("Ã–ppnade kundens portalflÃ¶de.");
    return;
  }
  const clientButton = event.target.closest("[data-collab-client]");
  if (clientButton) {
    selectedClientId = clientButton.dataset.collabClient;
    setView("clients");
    renderClients();
    showToast("Ã–ppnade kundkort frÃ¥n Samarbete.");
  }
});
els.collaborationPermissions?.addEventListener("click", (event) => {
  const portalButton = event.target.closest("[data-collab-portal]");
  if (!portalButton) return;
  if (els.portalClient) els.portalClient.value = portalButton.dataset.collabPortal;
  setView("portal");
  renderPortal();
  showToast("Ã–ppnade portal och behÃ¶righeter fÃ¶r kunden.");
});
els.versionsApplyRecommended?.addEventListener("click", () => {
  setView("invoice");
  showToast("Rekommenderad nÃ¤sta version Ã¤r fakturaflÃ¶det.");
});
els.versionGrid?.addEventListener("click", (event) => {
  const button = event.target.closest("[data-version-activate]");
  if (!button) return;
  setView(button.dataset.versionActivate);
  showToast("Versionen visas i prototypen.");
});
els.invoiceSearch.addEventListener("input", renderInvoiceWorkbench);
els.invoiceReadinessFilter?.addEventListener("change", () => {
  renderInvoiceWorkbench();
  showToast(`Visar ${els.invoiceReadinessFilter.selectedOptions[0]?.textContent.toLowerCase() || "valda underlag"}.`);
});
els.invoiceFrom.addEventListener("change", renderInvoiceWorkbench);
els.invoiceTo.addEventListener("change", renderInvoiceWorkbench);
els.invoiceFilterButton?.addEventListener("click", () => {
  renderInvoiceWorkbench();
  showToast("Fakturaunderlaget filtrerades.");
});
els.invoiceResetFilter?.addEventListener("click", () => {
  if (els.invoiceSearch) els.invoiceSearch.value = "";
  if (els.invoiceReadinessFilter) els.invoiceReadinessFilter.value = "all";
  if (els.invoiceFrom) els.invoiceFrom.value = getMonthStart(isoToday);
  if (els.invoiceTo) els.invoiceTo.value = isoToday;
  renderInvoiceWorkbench();
  showToast("Fakturafiltren rensades.");
});
els.invoiceStatusSummary?.addEventListener("click", (event) => {
  const button = event.target.closest("[data-invoice-summary-filter]");
  if (!button || !els.invoiceReadinessFilter) return;
  els.invoiceReadinessFilter.value = button.dataset.invoiceSummaryFilter;
  renderInvoiceWorkbench();
  showToast(`Visar ${button.textContent.trim().toLowerCase()}.`);
});
els.invoiceHistorySearch?.addEventListener("input", renderInvoiceHistory);
els.invoiceHistoryStatus?.addEventListener("change", renderInvoiceHistory);
els.invoiceHistoryClient?.addEventListener("change", renderInvoiceHistory);
els.invoiceHistoryReset?.addEventListener("click", () => {
  if (els.invoiceHistorySearch) els.invoiceHistorySearch.value = "";
  if (els.invoiceHistoryStatus) els.invoiceHistoryStatus.value = "all";
  if (els.invoiceHistoryClient) els.invoiceHistoryClient.value = "all";
  renderInvoiceHistory();
  showToast("Fakturahistorikens filter rensades.");
});
els.invoiceHistorySummary?.addEventListener("click", (event) => {
  const button = event.target.closest("[data-invoice-history-status]");
  if (!button || !els.invoiceHistoryStatus) return;
  els.invoiceHistoryStatus.value = button.dataset.invoiceHistoryStatus;
  renderInvoiceHistory();
  showToast(`Visar ${button.textContent.trim().toLowerCase()} i fakturahistoriken.`);
});
els.invoiceTabs.forEach((button) => {
  button.addEventListener("click", () => {
    els.invoiceTabs.forEach((item) => item.classList.remove("active"));
    button.classList.add("active");
    renderInvoiceWorkbench();
    showToast(`Visar ${button.textContent.trim().toLowerCase()}.`);
  });
});
els.invoiceViewModes.forEach((button) => {
  button.addEventListener("click", () => {
    els.invoiceViewModes.forEach((item) => item.classList.remove("active"));
    button.classList.add("active");
    renderInvoiceWorkbench();
    showToast(`Fakturarader visas nu ${button.title.toLowerCase()}.`);
  });
});
els.invoiceTable.addEventListener("click", (event) => {
  const openLink = event.target.closest("[data-invoice-open]");
  const previewButton = event.target.closest("[data-invoice-preview]");
  const downloadButton = event.target.closest("[data-invoice-download]");
  const draftButton = event.target.closest("[data-invoice-draft]");
  const createButton = event.target.closest("[data-invoice-create]");
  const approvalButton = event.target.closest("[data-invoice-row-approval]");

  if (approvalButton) {
    if (els.approvalProjectFilter) els.approvalProjectFilter.value = approvalButton.dataset.invoiceRowApproval;
    if (els.approvalStatusFilter) els.approvalStatusFilter.value = "open";
    if (els.approvalKindFilter) els.approvalKindFilter.value = "all";
    if (els.approvalSearch) els.approvalSearch.value = "";
    setView("reports");
    renderApprovalFlow();
    showToast("Öppnade attestflödet för fakturaraden.");
    return;
  }

  if (openLink) {
    event.preventDefault();
    const invoiceOpenId = openLink.dataset.invoiceOpen;
    const project = state.projects.find((item) => item.id === invoiceOpenId);
    const row = getInvoiceRows().find((item) => item.id === invoiceOpenId);
    const groupedProjectId = row?.sourceProjectIds?.[0];
    if (project || groupedProjectId) {
      openInvoiceDetail(project?.id || groupedProjectId);
    } else {
      showToast("Den grupperade raden kan inte öppnas som ett enskilt projekt.", "warning");
    }
    return;
  }

  if (previewButton) {
    previewInvoiceDocument(previewButton.dataset.invoicePreview);
    return;
  }

  if (downloadButton) {
    downloadInvoiceDocument(downloadButton.dataset.invoiceDownload);
    return;
  }

  if (draftButton) {
    if (saveInvoiceDraft(draftButton.dataset.invoiceDraft)) {
      showToast("Projektet sparades som fakturautkast.");
    }
  }

  if (createButton) {
    const record = createInvoiceFromProject(createButton.dataset.invoiceCreate);
    if (record) {
      saveState();
      renderAll();
      openInvoiceRecordDetail(record.id);
      showToast("Fakturaunderlag skapades och fakturakortet öppnades.");
      return;
    } else {
      showToast("Det finns inget att fakturera på underlaget.", "warning");
    }
  }

  if (draftButton || createButton) {
    saveState();
    renderAll();
  }
});

els.invoiceHistoryTable?.addEventListener("click", (event) => {
  const emptyActionButton = event.target.closest("[data-invoice-empty-action]");
  if (emptyActionButton) {
    event.preventDefault();
    if (emptyActionButton.dataset.invoiceEmptyAction === "show-all") {
      if (els.invoiceHistoryStatus) els.invoiceHistoryStatus.value = "all";
      if (els.invoiceHistorySearch) els.invoiceHistorySearch.value = "";
      if (els.invoiceHistoryClient) els.invoiceHistoryClient.value = "all";
      renderInvoiceHistory();
      showToast("Visar alla fakturor i historiken.");
      return;
    }
    const records = createInvoicesFromRows(getInvoiceRows().filter(isInvoiceRowReady));
    if (!records.length) {
      showToast("Det finns inga klara underlag att skapa faktura från.", "warning");
      return;
    }
    saveState();
    renderAll();
    openInvoiceRecordDetail(records[0].id);
    showToast(`${records.length} faktura${records.length === 1 ? "" : "or"} skapades.`);
    return;
  }

  const documentButton = event.target.closest("[data-open-document]");
  const statusButton = event.target.closest("[data-invoice-status]");
  const reopenButton = event.target.closest("[data-invoice-reopen]");
  const detailButton = event.target.closest("[data-invoice-detail]");
  const emailButton = event.target.closest("[data-invoice-email]");
  const sharePortalButton = event.target.closest("[data-invoice-share-portal]");
  const storedDownloadButton = event.target.closest("[data-invoice-stored-download]");

  if (detailButton) {
    event.preventDefault();
    openInvoiceRecordDetail(detailButton.dataset.invoiceDetail);
    return;
  }

  if (documentButton) {
    event.preventDefault();
    openStoredDocument(documentButton.dataset.openDocument, documentButton.dataset.documentId);
    return;
  }

  if (storedDownloadButton) {
    event.preventDefault();
    downloadStoredInvoiceDocument(storedDownloadButton.dataset.invoiceStoredDownload);
    return;
  }

  if (emailButton) {
    event.preventDefault();
    if (sendInvoiceEmail(emailButton.dataset.invoiceEmail)) {
      saveState();
      renderAll();
      showToast("E-postutkast öppnades och fakturan markerades som skickad.");
    }
    return;
  }

  if (sharePortalButton) {
    event.preventDefault();
    shareInvoiceToPortal(sharePortalButton.dataset.invoiceSharePortal);
    return;
  }

  if (statusButton) {
    if (statusButton.dataset.invoiceStatus === "credited" && !window.confirm("Vill du markera fakturan som krediterad?")) return;
    if (setInvoiceStatus(statusButton.dataset.invoiceId, statusButton.dataset.invoiceStatus)) {
      saveState();
      renderAll();
      showToast(`Fakturan markerades som ${getInvoiceStatusLabel(statusButton.dataset.invoiceStatus).toLowerCase()}.`);
    }
    return;
  }

  if (reopenButton) {
    if (!window.confirm("Vill du återöppna fakturan och släppa tillbaka underlaget till fakturering?")) return;
    if (reopenInvoice(reopenButton.dataset.invoiceReopen)) {
      saveState();
      renderAll();
      showToast("Fakturan återöppnades och underlaget kan faktureras igen.");
    }
  }
});
els.entryType.addEventListener("change", syncEntryTypeControls);
els.timerType.addEventListener("change", syncTimerTypeControls);
els.timerProject?.addEventListener("change", () => {
  syncClientFromProject(els.timerProject, els.timerClient);
  renderTimerLiveMeta();
});
els.entryProject?.addEventListener("change", () => syncClientFromProject(els.entryProject, els.entryClient));
els.receiptProject?.addEventListener("change", () => syncClientFromProject(els.receiptProject, els.receiptClient));
["change", "input"].forEach((eventName) => {
  [els.timerType, els.timerClient, els.timerProject, els.timerWorkOrder, els.timerTask, els.timerDescription].forEach((field) => {
    field?.addEventListener(eventName, () => {
      if (!timer.running && !timer.elapsedSeconds) renderTimerLiveMeta();
    });
  });
});
els.startTimer.addEventListener("click", startTimer);
els.pauseTimer?.addEventListener("click", pauseTimer);
els.stopTimer.addEventListener("click", stopTimer);
els.copyLastEntry?.addEventListener("click", copyPreviousEntryToForm);
els.exportCsv.addEventListener("click", exportCsv);
window.addEventListener("hashchange", () => {
  const hashView = getViewFromHash();
  if (hashView) setView(hashView);
});
document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && els.drawer?.classList.contains("open")) {
    closeDrawer();
    return;
  }
  const isSearchShortcut = (event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k";
  if (isSearchShortcut) {
    event.preventDefault();
    focusElement(els.globalSearch);
    showToast("Snabbsök är aktivt.");
  }
});

syncEntryTypeControls();
syncTimerTypeControls();
renderAll();
updateTimerDisplay();
setView(getViewFromHash() || getDefaultViewForCurrentUser());
refreshCloudSession();
