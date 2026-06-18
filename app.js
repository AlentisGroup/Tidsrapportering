const STORAGE_KEY = "novadex-tid-loner-state-v1";
const supabaseConfig = globalThis.NOVADEX_SUPABASE || {};
const supabaseClient = globalThis.supabase?.createClient && supabaseConfig.url && supabaseConfig.anonKey
  ? globalThis.supabase.createClient(supabaseConfig.url, supabaseConfig.anonKey)
  : null;
let cloudSession = null;
let cloudProfile = null;

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
  interval: null
};
let calendarCursor = new Date();
let newsLikes = 0;
let newsComments = 0;
let selectedClientId = state.clients[0]?.id || "";
let selectedProjectId = state.projects[0]?.id || "";

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
  reports: "Rapporter"
};

const roleLabels = {
  admin: "Admin",
  owner: "Kundansvarig",
  employee: "Medarbetare",
  customer: "Kund"
};

const roleAccess = {
  admin: ["dashboard", "tasks", "time", "clients", "sales", "projects", "agreements", "esign", "invoice", "planning", "analysis", "portal", "reports"],
  owner: ["dashboard", "tasks", "time", "clients", "sales", "projects", "agreements", "esign", "invoice", "planning", "analysis", "portal", "reports"],
  employee: ["dashboard", "tasks", "time", "planning", "analysis", "reports"],
  customer: ["portal"]
};

const portalTaskTemplates = [
  { type: "Underlag", title: "Ladda upp kontoutdrag", message: "Ladda upp kontoutdrag och eventuella verifikat för perioden.", dueDays: 7 },
  { type: "Godkännande", title: "Godkänn löneunderlag", message: "Kontrollera frånvaro, tillägg och timmar innan lönekörning.", dueDays: 3 },
  { type: "Kvitton", title: "Skicka kvitton", message: "Ladda upp saknade kvitton eller leverantörsunderlag.", dueDays: 5 },
  { type: "Signering", title: "Signera avtal", message: "Läs igenom avtalet och signera eller skriv en kommentar om något ska ändras.", dueDays: 10 }
];

const reportDefinitions = [
  { id: "worked-time", title: "Uppföljning av arbetad och debiterbar tid", tag: "Tidrapportering", description: "Fördelar rapporterade och debiterbara timmar per kund, projekt, aktivitet och medarbetare.", view: "reports", favorite: true },
  { id: "invoice-basis", title: "Fakturaunderlag", tag: "Fakturering", description: "Visar attesterade poster som kan bli fakturor samt redan skapade fakturaunderlag.", view: "invoice", favorite: true },
  { id: "payroll", title: "Löneunderlag", tag: "Lön", description: "Samlar arbetad tid, frånvaro, kvitton, resor och traktamenten per medarbetare.", view: "reports", favorite: true },
  { id: "receipts", title: "Kvitton och utlägg", tag: "Kvitton", description: "Följer upp privata utlägg och inköp med status för attest och eventuell fakturering.", view: "time", favorite: false },
  { id: "absence", title: "Frånvaro", tag: "Frånvaro", description: "Visar frånvaroorsaker, timmar och lönepåverkan för vald period.", view: "analysis", favorite: false },
  { id: "internal", title: "Interntid", tag: "Interntid", description: "Analyserar ej debiterbar tid och interna aktiviteter.", view: "analysis", favorite: false },
  { id: "customers", title: "Kundstatus", tag: "Kund", description: "Kombinerar kundansvarig, projekt, avtal, öppna ärenden och fakturavärde.", view: "clients", favorite: false },
  { id: "approvals", title: "Attestflöde", tag: "Attest", description: "Lista över tid, kvitton, resor, avtal och fakturor som kräver beslut.", view: "reports", favorite: true }
];

const els = {
  navItems: document.querySelectorAll("[data-view]"),
  moduleItems: document.querySelectorAll("[data-module]"),
  shortcuts: document.querySelectorAll("[data-view-shortcut]"),
  views: document.querySelectorAll(".view"),
  pageTitle: document.querySelector("#page-title"),
  globalSearch: document.querySelector(".global-search input"),
  topActions: document.querySelectorAll("[data-top-action]"),
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
  timePeriodSummary: document.querySelector("#time-period-summary"),
  timePeriodBoard: document.querySelector("#time-period-board"),
  timeExpandBlocks: document.querySelector("#time-expand-blocks"),
  timeAttestMonth: document.querySelector("#time-attest-month"),
  timerType: document.querySelector("#timer-type"),
  timerClient: document.querySelector("#timer-client"),
  timerProject: document.querySelector("#timer-project"),
  timerWorkOrder: document.querySelector("#timer-workorder"),
  timerTask: document.querySelector("#timer-task"),
  timerDescription: document.querySelector("#timer-description"),
  startTimer: document.querySelector("#start-timer"),
  stopTimer: document.querySelector("#stop-timer"),
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
  invoiceFrom: document.querySelector("#invoice-from"),
  invoiceTo: document.querySelector("#invoice-to"),
  invoiceTable: document.querySelector("#invoice-table"),
  invoiceHistoryTable: document.querySelector("#invoice-history-table"),
  invoiceTabs: document.querySelectorAll("[data-invoice-tab]"),
  invoiceViewModes: document.querySelectorAll("[data-invoice-viewmode]"),
  invoiceFilterButton: document.querySelector("#invoice-filter-button"),
  invoiceCommandStrip: document.querySelector("#invoice-command-strip"),
  portalClient: document.querySelector("#portal-client"),
  portalNewTask: document.querySelector("#portal-new-task"),
  portalSummary: document.querySelector("#portal-summary"),
  portalTaskList: document.querySelector("#portal-task-list"),
  portalAgreements: document.querySelector("#portal-agreements"),
  portalInvoices: document.querySelector("#portal-invoices"),
  portalDocuments: document.querySelector("#portal-documents"),
  portalTemplates: document.querySelector("#portal-templates"),
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
  travelList: document.querySelector("#travel-list"),
  quickCards: document.querySelectorAll("[data-quick-type]"),
  periodModes: document.querySelectorAll("[data-period-mode]"),
  invoiceSummary: document.querySelector("#invoice-summary"),
  payrollSummary: document.querySelector("#payroll-summary"),
  reportSearch: document.querySelector("#report-search"),
  reportShowFavorites: document.querySelector("#report-show-favorites"),
  reportTags: document.querySelector("#report-tags"),
  reportCatalog: document.querySelector("#report-catalog"),
  employeeList: document.querySelector("#employee-list"),
  userList: document.querySelector("#user-list"),
  accountRequestList: document.querySelector("#account-request-list"),
  addAccountRequest: document.querySelector("#add-account-request"),
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

function getCloudStatusLabel() {
  if (!isSupabaseReady()) return "Moln: lokal";
  if (cloudSession?.user) return `Moln: ${cloudSession.user.email || "inloggad"}`;
  return "Moln: redo";
}

function renderCloudStatus() {
  if (!els.cloudStatus) return;
  els.cloudStatus.textContent = getCloudStatusLabel();
  els.cloudStatus.classList.toggle("ready", Boolean(cloudSession?.user));
  els.cloudStatus.classList.toggle("warning", isSupabaseReady() && !cloudSession?.user);
}

async function refreshCloudSession() {
  if (!isSupabaseReady()) {
    renderCloudStatus();
    return null;
  }
  const { data, error } = await supabaseClient.auth.getSession();
  if (error) {
    showToast(`Supabase kunde inte läsa sessionen: ${error.message}`, "warning");
    renderCloudStatus();
    return null;
  }
  cloudSession = data.session;
  await loadCloudProfile();
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
  renderCloudStatus();
  showToast("Du är inloggad mot Supabase.");
  return true;
}

async function cloudSignOut() {
  if (!isSupabaseReady()) return;
  await supabaseClient.auth.signOut();
  cloudSession = null;
  cloudProfile = null;
  renderCloudStatus();
  showToast("Du är utloggad från Supabase.");
}

function toISODate(date) {
  return date.toISOString().slice(0, 10);
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
  return [
    { label: "Skapad", date: invoice.createdAt, active: true },
    { label: "Skickad", date: invoice.sentAt, active: Boolean(invoice.sentAt) },
    { label: "Kundgodkänd", date: invoice.customerApprovedAt, active: Boolean(invoice.customerApprovedAt) },
    { label: "Ändring begärd", date: invoice.changeRequestedAt, active: Boolean(invoice.changeRequestedAt) },
    { label: "Betald", date: invoice.paidAt, active: Boolean(invoice.paidAt) },
    { label: "Krediterad", date: invoice.creditedAt, active: Boolean(invoice.creditedAt) },
    { label: "Återöppnad", date: invoice.reopenedAt, active: Boolean(invoice.reopenedAt) }
  ].filter((item) => item.active);
}

function getClientSnapshot(clientId) {
  const client = getClient(clientId);
  const entries = state.entries.filter((entry) => entry.clientId === clientId);
  const projects = state.projects.filter((project) => project.clientId === clientId);
  const receipts = state.receipts.filter((receipt) => receipt.clientId === clientId);
  const travels = state.travels.filter((travel) => travel.clientId === clientId);
  const agreements = state.agreements.filter((agreement) => agreement.clientId === clientId);
  const invoices = (state.invoices || []).filter((invoice) => invoice.clientId === clientId);
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
    invoices,
    billableHours,
    draftHours,
    draftItems,
    receiptValue,
    travelValue,
    fixedPrice,
    invoiceValue
  };
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
    const canSubmit = entry.status === "draft" || entry.status === "rejected";
    const canReview = entry.status === "submitted" && (isAdminUser() || isOwnerUser());
    const isLocked = isLockedStatus(entry.status);
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
              <svg viewBox="0 0 24 24"><path d="M22 2 11 13M22 2l-7 20-4-9-9-4 20-7Z"></path></svg>
            </button>
            ` : ""}
            ${canReview ? `
            <button class="mini-button" type="button" title="Attestera" aria-label="Attestera" data-approve="${entry.id}">
              <svg viewBox="0 0 24 24"><path d="m5 12 4 4L19 6"></path></svg>
            </button>
            <button class="mini-button" type="button" title="Avvisa" aria-label="Avvisa" data-reject-entry="${entry.id}">
              <svg viewBox="0 0 24 24"><path d="M18 6 6 18M6 6l12 12"></path></svg>
            </button>
            ` : ""}
            <button class="mini-button" type="button" title="Redigera" aria-label="Redigera" data-edit-entry="${entry.id}">
              <svg viewBox="0 0 24 24"><path d="M4 20h4l11-11-4-4L4 16v4Z"></path></svg>
            </button>
            <button class="mini-button" type="button" title="Ta bort" aria-label="Ta bort" data-delete="${entry.id}" ${isLocked ? "disabled" : ""}>
              <svg viewBox="0 0 24 24"><path d="M4 7h16M10 11v6M14 11v6M6 7l1 14h10l1-14M9 7V4h6v3"></path></svg>
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
            <svg viewBox="0 0 24 24"><path d="M12 5v14M5 12h14"></path></svg>
          </button>
          <button class="mini-button" type="button" title="Fakturaunderlag" aria-label="Fakturaunderlag" data-client-invoice="${client.id}">
            <svg viewBox="0 0 24 24"><path d="M7 3h10v18l-2-1-2 1-2-1-2 1-2-1V3ZM10 8h4M10 12h4M10 16h2"></path></svg>
          </button>
          <button class="mini-button" type="button" title="Redigera kund" aria-label="Redigera kund" data-edit-client="${client.id}">
            <svg viewBox="0 0 24 24"><path d="M4 20h4l11-11-4-4L4 16v4Z"></path></svg>
          </button>
          <button class="mini-button" type="button" title="Ta bort kund" aria-label="Ta bort kund" data-delete-client="${client.id}">
            <svg viewBox="0 0 24 24"><path d="M4 7h16M10 11v6M14 11v6M6 7l1 14h10l1-14M9 7V4h6v3"></path></svg>
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
    const hours = sumHours(entries);
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
            <span>${escapeHtml(getClient(project.clientId)?.name || "Okänd kund")} · ${escapeHtml(project.manager || "Ingen projektledare")}</span>
          </div>
          <span class="badge ${project.status === "active" ? "approved" : "draft"}">${escapeHtml(getProjectStatusLabel(project.status))}</span>
        </div>
        <p>${escapeHtml(project.description || "Ingen beskrivning")}</p>
        <div class="project-progress">
          <div><span style="width:${progress}%"></span></div>
          <strong>${formatHours(hours)} / ${formatHours(Number(project.budget || 0))}</strong>
        </div>
        <div class="checklist">${checklist}</div>
        <div class="client-card-actions">
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

  els.projectDetail.innerHTML = `
    <div class="section-heading">
      <div>
        <p class="eyebrow">Projektkort</p>
        <h2>${escapeHtml(project.name)}</h2>
        <span class="muted-line">${escapeHtml(client?.name || "Okänd kund")} · ${escapeHtml(project.manager || "Ingen ansvarig")}</span>
      </div>
      <div class="row-actions">
        <button class="ghost-button small-button" type="button" data-client-time="${project.clientId}">Registrera tid</button>
        <button class="ghost-button small-button" type="button" data-client-invoice="${project.clientId}">Fakturera</button>
        <button class="primary-button small-button" type="button" data-edit-project="${project.id}">Redigera</button>
      </div>
    </div>
    <div class="client-detail-metrics">
      <div><span>Rapporterat</span><strong>${formatHours(hours)}</strong></div>
      <div><span>Attesterat</span><strong>${formatHours(approvedHours)}</strong></div>
      <div><span>Budget</span><strong>${formatHours(budget)}</strong></div>
      <div><span>Att fakturera</span><strong>${formatCurrency(invoiceValue)}</strong></div>
      <div><span>Öppna underlag</span><strong>${openEntries.length + receipts.filter((receipt) => isApprovalOpen(receipt.status)).length}</strong></div>
      <div><span>Status</span><strong>${escapeHtml(getProjectStatusLabel(project.status))}</strong></div>
    </div>
    <div class="project-progress detail-progress">
      <div><span style="width:${progress}%"></span></div>
      <strong>${progress}% av budget</strong>
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

function renderReceipts() {
  if (!state.receipts.length) {
    renderEmpty(els.receiptList);
    return;
  }

  els.receiptList.innerHTML = state.receipts.slice(0, 5).map((receipt) => {
    const canSubmit = receipt.status === "draft" || receipt.status === "rejected";
    const canReview = receipt.status === "submitted";
    return `
      <div class="mini-list-item">
        <div>
          <strong>${escapeHtml(receipt.supplier)}</strong>
          <span>${receipt.date} · ${escapeHtml(getClient(receipt.clientId)?.name || "Intern")} · ${escapeHtml(getProject(receipt.projectId)?.name || "Inget projekt")}</span>
          ${receipt.fileName ? `<button class="text-link inline-link" type="button" data-open-document="receipt" data-document-id="${receipt.id}">${escapeHtml(receipt.fileName)}</button>` : `<span class="muted-line">Ingen fil uppladdad</span>`}
          <span class="badge ${getApprovalBadgeClass(receipt.status)}">${getApprovalStatusLabel(receipt.status)}</span>
        </div>
        <div class="mini-list-actions">
          <b>${formatCurrency(Number(receipt.amount || 0))}</b>
          ${canSubmit ? `
          <button class="mini-button" type="button" title="Skicka in kvitto" aria-label="Skicka in kvitto" data-submit-receipt="${receipt.id}">
            <svg viewBox="0 0 24 24"><path d="M22 2 11 13M22 2l-7 20-4-9-9-4 20-7Z"></path></svg>
          </button>
          ` : ""}
          ${canReview ? `
          <button class="mini-button" type="button" title="Attestera kvitto" aria-label="Attestera kvitto" data-approve-receipt="${receipt.id}">
            <svg viewBox="0 0 24 24"><path d="m5 12 4 4L19 6"></path></svg>
          </button>
          <button class="mini-button" type="button" title="Avvisa kvitto" aria-label="Avvisa kvitto" data-reject-receipt="${receipt.id}">
            <svg viewBox="0 0 24 24"><path d="M18 6 6 18M6 6l12 12"></path></svg>
          </button>
          ` : ""}
          <button class="mini-button" type="button" title="Redigera kvitto" aria-label="Redigera kvitto" data-edit-receipt="${receipt.id}">
            <svg viewBox="0 0 24 24"><path d="M4 20h4l11-11-4-4L4 16v4Z"></path></svg>
          </button>
          <button class="mini-button" type="button" title="Ta bort kvitto" aria-label="Ta bort kvitto" data-delete-receipt="${receipt.id}" ${isLockedStatus(receipt.status) ? "disabled" : ""}>
            <svg viewBox="0 0 24 24"><path d="M4 7h16M10 11v6M14 11v6M6 7l1 14h10l1-14M9 7V4h6v3"></path></svg>
          </button>
        </div>
      </div>
    `;
  }).join("");
}

function renderTravels() {
  if (!state.travels.length) {
    renderEmpty(els.travelList);
    return;
  }

  els.travelList.innerHTML = state.travels.slice(0, 5).map((travel) => {
    const canSubmit = travel.status === "draft" || travel.status === "rejected";
    const canReview = travel.status === "submitted";
    return `
      <div class="mini-list-item">
        <div>
          <strong>${travel.type === "allowance" ? "Traktamente" : "Milersättning"}</strong>
          <span>${travel.date} · ${escapeHtml(travel.from || "-")} till ${escapeHtml(travel.to || "-")} · ${escapeHtml(getClient(travel.clientId)?.name || "Intern")}</span>
          <span class="badge ${getApprovalBadgeClass(travel.status)}">${getApprovalStatusLabel(travel.status)}</span>
        </div>
        <div class="mini-list-actions">
          <b>${Number(travel.quantity || 0).toFixed(1).replace(".", ",")}</b>
          ${canSubmit ? `
          <button class="mini-button" type="button" title="Skicka in resa" aria-label="Skicka in resa" data-submit-travel="${travel.id}">
            <svg viewBox="0 0 24 24"><path d="M22 2 11 13M22 2l-7 20-4-9-9-4 20-7Z"></path></svg>
          </button>
          ` : ""}
          ${canReview ? `
          <button class="mini-button" type="button" title="Attestera resa" aria-label="Attestera resa" data-approve-travel="${travel.id}">
            <svg viewBox="0 0 24 24"><path d="m5 12 4 4L19 6"></path></svg>
          </button>
          <button class="mini-button" type="button" title="Avvisa resa" aria-label="Avvisa resa" data-reject-travel="${travel.id}">
            <svg viewBox="0 0 24 24"><path d="M18 6 6 18M6 6l12 12"></path></svg>
          </button>
          ` : ""}
          <button class="mini-button" type="button" title="Redigera resa" aria-label="Redigera resa" data-edit-travel="${travel.id}">
            <svg viewBox="0 0 24 24"><path d="M4 20h4l11-11-4-4L4 16v4Z"></path></svg>
          </button>
          <button class="mini-button" type="button" title="Ta bort resa" aria-label="Ta bort resa" data-delete-travel="${travel.id}" ${isLockedStatus(travel.status) ? "disabled" : ""}>
            <svg viewBox="0 0 24 24"><path d="M4 7h16M10 11v6M14 11v6M6 7l1 14h10l1-14M9 7V4h6v3"></path></svg>
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
  const entryItems = state.entries.filter(isEntryVisible).map((entry) => ({
    kind: "entry",
    id: entry.id,
    date: entry.date,
    status: entry.status || "draft",
    title: `${entry.employee} · ${getTypeLabel(entry.type)}`,
    subtitle: `${getClient(entry.clientId)?.name || "Okänd kund"} · ${entry.task}`,
    value: formatHours(Number(entry.hours || 0)),
    note: entry.reviewNote || "",
    actions: getBasisApprovalActions(entry.status || "draft")
  }));
  const receiptItems = state.receipts.filter((receipt) => isClientVisible(getClient(receipt.clientId) || {})).map((receipt) => ({
    kind: "receipt",
    id: receipt.id,
    date: receipt.date,
    status: receipt.status || "draft",
    title: `Kvitto · ${receipt.supplier}`,
    subtitle: `${getClient(receipt.clientId)?.name || "Intern"} · ${getProject(receipt.projectId)?.name || "Inget projekt"}`,
    value: formatCurrency(Number(receipt.amount || 0)),
    note: receipt.reviewNote || "",
    actions: getBasisApprovalActions(receipt.status || "draft")
  }));
  const travelItems = state.travels.filter((travel) => isClientVisible(getClient(travel.clientId) || {})).map((travel) => ({
    kind: "travel",
    id: travel.id,
    date: travel.date,
    status: travel.status || "draft",
    title: travel.type === "allowance" ? "Traktamente" : "Milersättning",
    subtitle: `${travel.from || "-"} till ${travel.to || "-"} · ${getClient(travel.clientId)?.name || "Intern"}`,
    value: travel.type === "allowance" ? `${String(travel.quantity || 0).replace(".", ",")} dagar` : `${String(travel.quantity || 0).replace(".", ",")} km`,
    note: travel.reviewNote || "",
    actions: getBasisApprovalActions(travel.status || "draft")
  }));
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

  els.portalSummary.innerHTML = `
    <div><span>Kund</span><strong>${escapeHtml(client.name)}</strong></div>
    <div><span>Öppna ärenden</span><strong>${openTasks.length}</strong></div>
    <div><span>Avtal</span><strong>${portalAgreements.length}</strong></div>
    <div><span>Obetalda fakturor</span><strong>${unpaid.length}</strong></div>
    <div><span>Underlag</span><strong>${portalDocuments.length}</strong></div>
    <div><span>${getCurrentUser().role === "customer" ? "Fakturavärde" : "Att fakturera"}</span><strong>${getCurrentUser().role === "customer" ? formatSEK(portalInvoices.reduce((sum, invoice) => sum + Number(invoice.totalInclVat || invoice.total || 0), 0)) : formatSEK(snapshot.invoiceValue)}</strong></div>
  `;

  if (!portalTasks.length) {
    renderEmpty(els.portalTaskList);
  } else {
    els.portalTaskList.innerHTML = portalTasks.map((task) => {
      const isDone = task.status === "done";
      const canManage = isAdminUser() || isOwnerUser();
      return `
        <div class="approval-card portal-task-card ${getPortalStatusBadgeClass(task.status)}">
          <div>
            <div class="approval-title">
              <strong>${escapeHtml(task.title)}</strong>
              <span class="badge ${getPortalStatusBadgeClass(task.status)}">${getPortalStatusLabel(task.status)}</span>
            </div>
            <span>${escapeHtml(task.type || "Ärende")} · ansvarig ${escapeHtml(task.owner || "-")} · förfaller ${task.dueDate || "-"}</span>
            ${task.message ? `<small class="review-note">${escapeHtml(task.message)}</small>` : ""}
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
      return `
        <div class="employee-item">
          <div>
            <strong>${escapeHtml(invoice.number)}</strong>
            <span>${getInvoiceStatusLabel(status)} · förfaller ${invoice.dueDate || "-"} · ${formatSEK(Number(invoice.totalInclVat || invoice.total || 0))}</span>
          </div>
          <div class="row-actions">
            <button class="ghost-button small-button" type="button" data-invoice-detail="${invoice.id}">Öppna</button>
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

function handlePortalTaskAction(action, taskId) {
  const task = (state.portalTasks || []).find((item) => item.id === taskId);
  if (!task) return;

  if (action === "complete") {
    task.status = "done";
    task.completedAt = isoToday;
    task.completedBy = getCurrentUser().name;
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
    showToast("Ärendet markerades för komplettering.");
  }

  if (action === "reopen" && (isAdminUser() || isOwnerUser())) {
    task.status = "open";
    task.completedAt = "";
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
  task.comments = [
    ...(task.comments || []),
    {
      id: makeId(),
      author: getCurrentUser().name,
      role: getPortalCommentRole(),
      body: `Skickade in underlag: ${receipt.fileName || receipt.supplier}.`,
      createdAt: isoToday
    }
  ];
  saveState();
  renderAll();
  showToast("Underlaget skickades in och hamnade i kvitto-/dokumentflödet.");
}

function handlePortalCommentSubmit(form) {
  const task = (state.portalTasks || []).find((item) => item.id === form.dataset.portalCommentForm);
  if (!task) return;
  const body = form.elements.body.value.trim();
  if (!body) return;
  task.comments = [
    ...(task.comments || []),
    {
      id: makeId(),
      author: getCurrentUser().name,
      role: getPortalCommentRole(),
      body,
      createdAt: isoToday
    }
  ];
  if (task.status === "done") {
    task.status = "open";
    task.completedAt = "";
  }
  saveState();
  renderAll();
  showToast("Kommentaren sparades på ärendet.");
}

function createInvoicePortalTask(invoice, message) {
  const client = getClient(invoice.clientId);
  const project = getProject(invoice.projectId);
  state.portalTasks.unshift({
    id: makeId(),
    clientId: invoice.clientId,
    title: `Fråga om faktura ${invoice.number}`,
    type: "Faktura",
    status: "open",
    owner: client?.owner || getCurrentUser().name,
    dueDate: offsetDate(3),
    createdAt: isoToday,
    message,
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
  });
}

function handlePortalInvoiceAction(action, invoiceId) {
  const invoice = (state.invoices || []).find((item) => item.id === invoiceId);
  if (!invoice || getCurrentUser().role !== "customer") return;

  if (action === "approve") {
    invoice.status = "customerApproved";
    invoice.customerApprovedAt = isoToday;
    invoice.customerApprovedBy = getCurrentUser().name;
    showToast("Fakturan markerades som godkänd av kund.");
  }

  if (action === "change") {
    const message = window.prompt("Vad vill du ändra eller fråga om?", "Jag har en fråga om fakturaunderlaget.");
    if (!message) return;
    invoice.status = "changeRequested";
    invoice.changeRequestedAt = isoToday;
    invoice.changeRequestedBy = getCurrentUser().name;
    invoice.changeRequestMessage = message.trim();
    createInvoicePortalTask(invoice, message.trim());
    showToast("Ändringsfrågan skickades till byrån och blev ett portalärende.");
  }

  saveState();
  renderAll();
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

  if (!tasks.length) {
    renderEmpty(els.tasksBoard);
  } else {
    els.tasksBoard.innerHTML = tasks.map((task) => `
      <div class="workflow-card">
        <div>
          <div class="approval-title">
            <strong>${escapeHtml(task.title)}</strong>
            <span class="badge ${getWorkflowBadgeClass(task.kind === "portal" ? "portal" : task.kind, task.status)}">${escapeHtml(getWorkflowStatusLabel(task.kind === "portal" ? "portal" : task.kind, task.status))}</span>
          </div>
          <span>${escapeHtml(task.subtitle)} · ansvarig ${escapeHtml(task.owner)} · ${task.dueDate || "inget datum"}</span>
          ${task.message ? `<small class="review-note">${escapeHtml(task.message)}</small>` : ""}
        </div>
        <button class="ghost-button small-button" type="button" data-task-open="${task.view}" data-task-kind="${task.kind}" data-task-id="${task.id}">${escapeHtml(task.actionLabel)}</button>
      </div>
    `).join("");
  }

  const pipeline = [
    ["open", "Öppen"],
    ["waiting", "Väntar"],
    ["submitted", "Skickad"],
    ["done", "Klar"]
  ];
  els.tasksPipeline.innerHTML = pipeline.map(([status, label]) => {
    const count = tasks.filter((task) => task.status === status).length;
    return `
      <div class="pipeline-row">
        <span>${label}</span>
        <strong>${count}</strong>
      </div>
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

function renderTimePeriodOverview() {
  if (!els.timePeriodSummary || !els.timePeriodBoard) return;
  const entries = state.entries.filter(isEntryVisible);
  const receipts = state.receipts.filter((receipt) => isClientVisible(getClient(receipt.clientId) || {}));
  const travels = state.travels.filter((travel) => isClientVisible(getClient(travel.clientId) || {}));
  const employees = [...new Set([
    ...entries.map((entry) => entry.employee || getCurrentUser().name),
    ...state.users.filter((user) => user.role !== "customer").map((user) => user.name)
  ])].filter(Boolean);

  const rows = employees.map((employee) => {
    const employeeEntries = entries.filter((entry) => (entry.employee || getCurrentUser().name) === employee);
    const submittedReceipts = receipts.filter((receipt) => (receipt.employee || getCurrentUser().name) === employee && receipt.status === "submitted").length;
    const submittedTravels = travels.filter((travel) => (travel.employee || getCurrentUser().name) === employee && travel.status === "submitted").length;
    const reported = sumHours(employeeEntries);
    const absence = sumHours(employeeEntries.filter((entry) => entry.type === "absence"));
    const scheduled = employeeEntries.length ? employeeEntries.reduce((total, entry) => total + Number(entry.scheduledHours || 8), 0) : 40;
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

  els.timePeriodSummary.innerHTML = `
    <div><span>Rapporterat</span><strong>${formatHours(totalReported)}</strong></div>
    <div><span>Schemalagt</span><strong>${formatHours(totalScheduled)}</strong></div>
    <div><span>Avvikelse</span><strong>${formatHours(totalReported - totalScheduled)}</strong></div>
    <div><span>Debiterbart</span><strong>${formatHours(totalBillable)}</strong></div>
    <div><span>Väntar attest</span><strong>${waitingCount}</strong></div>
  `;

  if (!rows.length) {
    els.timePeriodBoard.innerHTML = `<tr><td colspan="7">${els.emptyTemplate.innerHTML}</td></tr>`;
    return;
  }

  els.timePeriodBoard.innerHTML = rows.map((row) => `
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
    </tr>
  `).join("");
}

function renderInvoiceCommandStrip() {
  if (!els.invoiceCommandStrip) return;
  const rows = getInvoiceRows();
  const readyRows = rows.filter((row) => row.total > 0 && !row.warning && state.projects.some((project) => project.id === row.id));
  const warningRows = rows.filter((row) => row.warning > 0);
  const draftRows = state.projects.filter((project) => project.invoiceStatus === "draft");
  const invoiceTotal = rows.reduce((sum, row) => sum + row.total, 0);

  els.invoiceCommandStrip.innerHTML = `
    <button class="invoice-command-card" type="button" data-invoice-command="create-ready">
      <span>Skapa klara underlag</span>
      <strong>${readyRows.length}</strong>
      <small>${formatCurrency(readyRows.reduce((sum, row) => sum + row.total, 0))}</small>
    </button>
    <button class="invoice-command-card" type="button" data-invoice-command="drafts">
      <span>Utkast</span>
      <strong>${draftRows.length}</strong>
      <small>Kan granskas före utskick</small>
    </button>
    <button class="invoice-command-card warning" type="button" data-invoice-command="warnings">
      <span>Behöver åtgärd</span>
      <strong>${warningRows.length}</strong>
      <small>Ej attesterad tid/kvitton</small>
    </button>
    <button class="invoice-command-card" type="button" data-invoice-command="history">
      <span>Fakturaunderlag</span>
      <strong>${formatCurrency(invoiceTotal)}</strong>
      <small>Öppna arkiv och status</small>
    </button>
  `;
}

function renderReportCatalog() {
  if (!els.reportTags || !els.reportCatalog) return;
  const query = (els.reportSearch?.value || "").trim().toLowerCase();
  const favoritesOnly = els.reportShowFavorites?.classList.contains("active");
  const tags = [...new Set(reportDefinitions.map((report) => report.tag))];
  const reports = reportDefinitions.filter((report) => {
    const haystack = `${report.title} ${report.tag} ${report.description}`.toLowerCase();
    return (!query || haystack.includes(query)) && (!favoritesOnly || report.favorite);
  });

  els.reportTags.innerHTML = tags.map((tag) => `
    <button class="tag-button" type="button" data-report-tag="${escapeHtml(tag)}">${escapeHtml(tag)}</button>
  `).join("");

  if (!reports.length) {
    renderEmpty(els.reportCatalog);
    return;
  }

  els.reportCatalog.innerHTML = reports.map((report) => `
    <button class="analysis-card report-card" type="button" data-report-open="${escapeHtml(report.view)}" data-report-id="${escapeHtml(report.id)}">
      <span class="analysis-icon">${escapeHtml(report.tag.slice(0, 2).toUpperCase())}</span>
      <div>
        <strong>${escapeHtml(report.title)}</strong>
        <p>${escapeHtml(report.description)}</p>
      </div>
      <b>${report.favorite ? "Favorit" : escapeHtml(report.tag)}</b>
    </button>
  `).join("");
}

function renderReports() {
  renderReportCatalog();
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
  const payrollByEmployee = Object.entries(groupBy(payrollEntries, (entry) => entry.employee))
    .map(([employee, entries]) => ({
      employee,
      hours: sumHours(entries),
      absence: sumHours(entries.filter((entry) => entry.type === "absence"))
    }))
    .sort((a, b) => b.hours - a.hours);

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
          <span>${formatHours(row.absence)} frånvaro i underlaget</span>
        </div>
        <strong>${formatHours(row.hours)}</strong>
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

  const pendingItems = getApprovalItems({ includeApproved: true });

  if (!pendingItems.length) {
    renderEmpty(els.approvalList);
  } else {
    els.approvalList.innerHTML = pendingItems.map((item) => `
      <div class="approval-card ${getWorkflowBadgeClass(item.kind, item.status)}">
        <div>
          <div class="approval-title">
            <strong>${escapeHtml(item.title)}</strong>
            <span class="badge ${getWorkflowBadgeClass(item.kind, item.status)}">${getWorkflowStatusLabel(item.kind, item.status)}</span>
          </div>
          <span>${escapeHtml(item.subtitle)} · ${item.date}</span>
          ${item.note ? `<small class="review-note">${escapeHtml(item.note)}</small>` : ""}
        </div>
        <div class="approval-actions">
          <strong>${escapeHtml(item.value)}</strong>
          ${(item.actions || []).map((action) => `
            <button class="${action.style === "primary" ? "primary-button" : "ghost-button"} small-button" type="button" data-approval-action="${action.action}" data-approval-kind="${item.kind}" data-approval-id="${item.id}">${escapeHtml(action.label)}</button>
          `).join("")}
          ${["approved", "signed", "paid"].includes(item.status) ? `<span class="muted-line">Klart</span>` : ""}
        </div>
      </div>
    `).join("");
  }
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
    <div class="employee-item">
      <div>
        <strong>${escapeHtml(user.name)}</strong>
        <span>${escapeHtml(user.email)} · ${escapeHtml(user.title || roleLabels[user.role] || user.role)}</span>
      </div>
      <div class="row-actions">
        <select class="compact-select" data-user-role="${user.id}" aria-label="Roll för ${escapeHtml(user.name)}">
          ${Object.entries(roleLabels).map(([role, label]) => `<option value="${role}" ${role === user.role ? "selected" : ""}>${label}</option>`).join("")}
        </select>
        <button class="mini-button" type="button" title="Ta bort användare" aria-label="Ta bort användare" data-delete-user="${user.id}" ${user.id === state.currentUserId ? "disabled" : ""}>
          <svg viewBox="0 0 24 24"><path d="M4 7h16M10 11v6M14 11v6M6 7l1 14h10l1-14M9 7V4h6v3"></path></svg>
        </button>
      </div>
    </div>
  `).join("");

  const requests = state.accountRequests.filter((request) => request.status === "pending");
  if (!requests.length) {
    renderEmpty(els.accountRequestList);
    return;
  }

  els.accountRequestList.innerHTML = requests.map((request) => `
    <div class="employee-item">
      <div>
        <strong>${escapeHtml(request.name)}</strong>
        <span>${escapeHtml(request.email)} · ${escapeHtml(request.company || "Okänt företag")} · önskar ${escapeHtml(roleLabels[request.requestedRole] || request.requestedRole)}</span>
        ${request.note ? `<small class="review-note">${escapeHtml(request.note)}</small>` : ""}
      </div>
      <div class="row-actions">
        <button class="primary-button small-button" type="button" data-approve-account="${request.id}">Godkänn</button>
        <button class="ghost-button small-button" type="button" data-reject-account="${request.id}">Avvisa</button>
      </div>
    </div>
  `).join("");
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
      warning: draftEntries.length + receipts.filter((receipt) => !isInvoiceReady(receipt.status)).length + travels.filter((travel) => !isInvoiceReady(travel.status)).length
    };
  }).filter((row) => row.total > 0 || row.draftHours > 0);

  const filteredRows = rows
    .filter((row) => activeTab === "draft" ? row.status === "draft" : row.status === "preliminary")
    .filter((row) => {
      const haystack = `${row.project.name} ${row.client?.name || ""}`.toLowerCase();
      return !search || haystack.includes(search);
    });

  return groupInvoiceRows(filteredRows);
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
        project: { name: mode === "client" ? `Alla projekt för ${row.client?.name || "okänd kund"}` : "Samlingsprojekt" },
        fixedPrice: 0,
        hours: 0,
        draftHours: 0,
        hourlyValue: 0,
        articleValue: 0,
        supplierInvoices: 0,
        otherValue: 0,
        total: 0,
        warning: 0
      };
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
    return acc;
  }, {}));

  return grouped;
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

function openInvoiceDetail(projectId) {
  const detail = getInvoiceDetail(projectId);
  if (!detail) {
    showToast("Fakturaunderlaget kunde inte öppnas.", "warning");
    return;
  }

  setDrawerContent({
    eyebrow: "Fakturaunderlag",
    title: detail.project.name,
    body: `
      <div class="drawer-list">
        <article class="drawer-list-item">
          <div>
            <strong>${escapeHtml(detail.client?.name || "Okänd kund")}</strong>
            <span>${escapeHtml(detail.client?.org || "Org.nr saknas")} · ${escapeHtml(detail.client?.email || "Ingen e-post")}</span>
          </div>
          <span class="badge ${detail.project.invoiceStatus === "draft" ? "draft" : "approved"}">${detail.project.invoiceStatus === "draft" ? "Utkast" : "Preliminärt"}</span>
        </article>
      </div>
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
      <div class="invoice-detail-list">
        <h3>Tidsrader</h3>
        ${detail.approvedEntries.length ? detail.approvedEntries.map((entry) => `
          <div class="compact-row invoice-line-row">
            <button class="clickable-row" type="button" data-edit-entry="${entry.id}">
              <strong>${escapeHtml(entry.task)}</strong>
              <span>${entry.date} · ${escapeHtml(entry.employee)} · ${formatHours(Number(entry.hours || 0))} · ${formatSEK(Number(entry.hours || 0) * Number(detail.client?.rate || 0))}</span>
            </button>
            <button class="ghost-button small-button" type="button" data-invoice-line-exclude="entry" data-invoice-line-id="${entry.id}" data-invoice-project-id="${detail.project.id}">Ta bort från faktura</button>
          </div>
        `).join("") : els.emptyTemplate.innerHTML}
        <h3>Kvitton</h3>
        ${detail.approvedReceipts.length ? detail.approvedReceipts.map((receipt) => `
          <div class="compact-row invoice-line-row">
            <button class="clickable-row" type="button" data-edit-receipt="${receipt.id}">
              <strong>${escapeHtml(receipt.supplier)}</strong>
              <span>${receipt.date} · ${formatSEK(Number(receipt.amount || 0))}</span>
            </button>
            <button class="ghost-button small-button" type="button" data-invoice-line-exclude="receipt" data-invoice-line-id="${receipt.id}" data-invoice-project-id="${detail.project.id}">Ta bort från faktura</button>
          </div>
        `).join("") : els.emptyTemplate.innerHTML}
        <h3>Resor</h3>
        ${detail.approvedTravels.length ? detail.approvedTravels.map((travel) => `
          <div class="compact-row invoice-line-row">
            <button class="clickable-row" type="button" data-edit-travel="${travel.id}">
              <strong>${travel.type === "allowance" ? "Traktamente" : "Milersättning"}</strong>
              <span>${travel.date} · ${escapeHtml(travel.from || "-")} till ${escapeHtml(travel.to || "-")} · ${formatSEK(getTravelValue(travel))}</span>
            </button>
            <button class="ghost-button small-button" type="button" data-invoice-line-exclude="travel" data-invoice-line-id="${travel.id}" data-invoice-project-id="${detail.project.id}">Ta bort från faktura</button>
          </div>
        `).join("") : els.emptyTemplate.innerHTML}
      </div>
      <div class="drawer-actions">
        <button class="ghost-button" type="button" data-invoice-preview="${detail.project.id}">Förhandsgranska</button>
        <button class="ghost-button" type="button" data-invoice-download="${detail.project.id}">Ladda ner</button>
        <button class="primary-button" type="button" data-invoice-create="${detail.project.id}">Skapa fakturaunderlag</button>
      </div>
    `
  });
}

function getInvoiceMeta(detail, override = {}) {
  const settings = state.settings || defaultState.settings;
  const client = detail.client || {};
  const paymentTermsCandidate = override.paymentTerms ?? client.paymentTerms;
  const vatRateCandidate = override.vatRate ?? client.vatRate;
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
    invoiceFooter: override.invoiceFooter || settings.invoiceFooter || ""
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
    total: meta.netTotal,
    vat: meta.vat,
    totalInclVat: meta.totalInclVat,
    billingEmail: meta.billingEmail,
    invoiceReference: meta.invoiceReference,
    invoiceAddress: meta.invoiceAddress,
    bankgiro: meta.bankgiro,
    status: existing?.status || "created",
    entryIds: detail.approvedEntries.map((entry) => entry.id),
    receiptIds: detail.approvedReceipts.map((receipt) => receipt.id),
    travelIds: detail.approvedTravels.map((travel) => travel.id),
    documentHtml: buildInvoiceDocument(project.id, meta)
  };
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
  return true;
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
      <div class="invoice-timeline">
        ${timeline.map((item) => `
          <div>
            <span></span>
            <strong>${escapeHtml(item.label)}</strong>
            <em>${escapeHtml(item.date || "-")}</em>
          </div>
        `).join("")}
      </div>
      <div class="drawer-actions">
        <button class="ghost-button" type="button" data-open-document="invoice" data-document-id="${invoice.id}">Öppna faktura</button>
        <button class="ghost-button" type="button" data-invoice-email="${invoice.id}" ${["paid", "credited", "reopened"].includes(invoice.status) ? "disabled" : ""}>Skicka e-post</button>
        <button class="ghost-button" type="button" data-invoice-status="paid" data-invoice-id="${invoice.id}" ${["paid", "credited", "reopened"].includes(invoice.status) ? "disabled" : ""}>Markera betald</button>
        <button class="ghost-button" type="button" data-invoice-status="credited" data-invoice-id="${invoice.id}" ${["credited", "reopened"].includes(invoice.status) ? "disabled" : ""}>Kreditera</button>
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

function renderInvoiceWorkbench() {
  const rowsAll = getInvoiceRows();
  const activeTab = document.querySelector("[data-invoice-tab].active")?.dataset.invoiceTab || "preliminary";
  const activeInvoices = (state.invoices || []).filter((invoice) => !["credited", "reopened"].includes(invoice.status));
  const currentMonthCreated = activeInvoices
    .filter((invoice) => invoice.createdAt?.slice(0, 7) === isoToday.slice(0, 7))
    .reduce((sum, invoice) => sum + Number(invoice.totalInclVat || invoice.total || 0), 0);
  const openTotal = rowsAll.reduce((total, row) => total + row.total, 0);
  els.invoicePrevMonth.textContent = formatSEK(0);
  els.invoiceCurrentMonth.textContent = formatSEK(currentMonthCreated);
  els.invoiceTotalOpen.textContent = formatSEK(openTotal);
  renderInvoiceHistory();

  if (!rowsAll.length) {
    els.invoiceTable.innerHTML = `<tr><td colspan="9">${els.emptyTemplate.innerHTML}</td></tr>`;
    if (activeTab === "draft") {
      showToast("Det finns inga sparade fakturautkast just nu.");
    }
    return;
  }

  els.invoiceTable.innerHTML = rowsAll.map((row) => {
    const canRunInvoiceAction = state.projects.some((project) => project.id === row.id);
    return `
    <tr>
      <td>
        <a href="#" class="table-link" data-invoice-open="${row.id}">${row.number} - ${escapeHtml(row.project.name)}</a>
        <span class="invoice-icons">${row.warning ? "!" : ""} ↗</span>
      </td>
      <td>${escapeHtml(row.client?.name || "Okänd kund")}</td>
      <td>${formatSEK(row.fixedPrice)}</td>
      <td>
        <strong>${formatHours(row.hours)}</strong>
        <span class="table-subtext">${formatSEK(row.hourlyValue)}${row.draftHours ? ` · (${formatHours(row.draftHours)} ej attesterat)` : ""}</span>
      </td>
      <td>${formatSEK(row.articleValue)}</td>
      <td>${formatSEK(row.supplierInvoices)}</td>
      <td>${formatSEK(row.otherValue)}</td>
      <td><strong>${formatSEK(row.total)}</strong></td>
      <td>
        <div class="row-actions">
          <button class="mini-button" type="button" title="Förhandsgranska" aria-label="Förhandsgranska" data-invoice-preview="${row.id}" ${canRunInvoiceAction ? "" : "disabled"}>
            <svg viewBox="0 0 24 24"><path d="M4 5h16v14H4zM8 9h8M8 13h8M8 17h4"></path></svg>
          </button>
          <button class="mini-button" type="button" title="Ladda ner faktura" aria-label="Ladda ner faktura" data-invoice-download="${row.id}" ${canRunInvoiceAction ? "" : "disabled"}>
            <svg viewBox="0 0 24 24"><path d="M12 3v12m0 0 4-4m-4 4-4-4M4 21h16"></path></svg>
          </button>
          <button class="mini-button" type="button" title="Spara som utkast" aria-label="Spara som utkast" data-invoice-draft="${row.id}" ${canRunInvoiceAction ? "" : "disabled"}>
            <svg viewBox="0 0 24 24"><path d="M5 4h14v16H5zM8 8h8M8 12h8M8 16h5"></path></svg>
          </button>
          <button class="mini-button" type="button" title="Skapa fakturaunderlag" aria-label="Skapa fakturaunderlag" data-invoice-create="${row.id}" ${canRunInvoiceAction ? "" : "disabled"}>
            <svg viewBox="0 0 24 24"><path d="m5 12 4 4L19 6"></path></svg>
          </button>
        </div>
      </td>
    </tr>
  `;
  }).join("");

}

function renderInvoiceHistory() {
  if (!els.invoiceHistoryTable) return;
  const invoices = [...(state.invoices || [])]
    .sort((a, b) => (b.createdAt || "").localeCompare(a.createdAt || "") || String(b.number).localeCompare(String(a.number)));

  if (!invoices.length) {
    els.invoiceHistoryTable.innerHTML = `<tr><td colspan="8">${els.emptyTemplate.innerHTML}</td></tr>`;
    return;
  }

  els.invoiceHistoryTable.innerHTML = invoices.map((invoice) => {
    const project = getProject(invoice.projectId);
    const client = getClient(invoice.clientId);
    const status = getEffectiveInvoiceStatus(invoice);
    const isClosed = ["paid", "credited", "reopened"].includes(invoice.status);
    return `
      <tr>
        <td><a href="#" class="table-link" data-invoice-detail="${invoice.id}">${escapeHtml(invoice.number)}</a></td>
        <td>${escapeHtml(client?.name || "Okänd kund")}</td>
        <td>${escapeHtml(project?.name || "Okänt projekt")}</td>
        <td>${invoice.createdAt || "-"}</td>
        <td>${invoice.dueDate || "-"}</td>
        <td><span class="badge ${getInvoiceStatusBadge(status)}">${getInvoiceStatusLabel(status)}</span></td>
        <td><strong>${formatSEK(Number(invoice.totalInclVat || invoice.total || 0))}</strong></td>
        <td>
          <div class="row-actions">
            <button class="mini-button" type="button" title="Fakturakort" aria-label="Fakturakort" data-invoice-detail="${invoice.id}">
              <svg viewBox="0 0 24 24"><path d="M4 4h16v16H4zM8 8h8M8 12h8M8 16h4"></path></svg>
            </button>
            <button class="mini-button" type="button" title="Öppna faktura" aria-label="Öppna faktura" data-open-document="invoice" data-document-id="${invoice.id}">
              <svg viewBox="0 0 24 24"><path d="M4 5h16v14H4zM8 9h8M8 13h8M8 17h4"></path></svg>
            </button>
            <button class="mini-button" type="button" title="Skicka e-post" aria-label="Skicka e-post" data-invoice-email="${invoice.id}" ${isClosed ? "disabled" : ""}>
              <svg viewBox="0 0 24 24"><path d="M4 4h16v16H4zM4 7l8 6 8-6"></path></svg>
            </button>
            <button class="mini-button" type="button" title="Markera skickad" aria-label="Markera skickad" data-invoice-status="sent" data-invoice-id="${invoice.id}" ${isClosed ? "disabled" : ""}>
              <svg viewBox="0 0 24 24"><path d="M22 2 11 13M22 2l-7 20-4-9-9-4 20-7Z"></path></svg>
            </button>
            <button class="mini-button" type="button" title="Markera betald" aria-label="Markera betald" data-invoice-status="paid" data-invoice-id="${invoice.id}" ${["credited", "reopened"].includes(invoice.status) ? "disabled" : ""}>
              <svg viewBox="0 0 24 24"><path d="m5 12 4 4L19 6"></path></svg>
            </button>
            <button class="mini-button" type="button" title="Kreditera" aria-label="Kreditera" data-invoice-status="credited" data-invoice-id="${invoice.id}" ${["credited", "reopened"].includes(invoice.status) ? "disabled" : ""}>
              <svg viewBox="0 0 24 24"><path d="M5 5h14M7 9h10M9 13h6M8 19l8-8"></path></svg>
            </button>
            <button class="mini-button" type="button" title="Återöppna" aria-label="Återöppna" data-invoice-reopen="${invoice.id}" ${isClosed ? "disabled" : ""}>
              <svg viewBox="0 0 24 24"><path d="M3 12a9 9 0 0 1 15.5-6.2M21 5v6h-6M21 12a9 9 0 0 1-15.5 6.2M3 19v-6h6"></path></svg>
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
      actionLabel: "Öppna portal"
    })),
    ...changedInvoices.map((invoice) => ({
      title: `Faktura ${getInvoiceStatusLabel(getEffectiveInvoiceStatus(invoice)).toLowerCase()}`,
      text: `${invoice.number} · ${getClient(invoice.clientId)?.name || "Okänd kund"} · ${formatSEK(Number(invoice.totalInclVat || invoice.total || 0))}`,
      action: "invoice",
      actionLabel: "Öppna fakturering"
    })),
    ...openApprovals.slice(0, 6).map((item) => ({
      title: getApprovalStatusLabel(item.status),
      text: `${item.title} · ${item.subtitle}`,
      action: "reports",
      actionLabel: "Öppna attest"
    })),
    ...draftInvoices.slice(0, 4).map((project) => ({
      title: "Fakturautkast",
      text: `${project.name} ligger som utkast.`,
      action: "invoice",
      actionLabel: "Öppna fakturering"
    })),
    ...unsignedAgreements.slice(0, 4).map((agreement) => ({
      title: "Avtal skickat",
      text: `${agreement.title} väntar på kundens signering.`,
      action: "agreements",
      actionLabel: "Öppna avtal"
    }))
  ];
}

function getDrawerContent(kind) {
  const settings = state.settings || defaultState.settings;
  if (kind === "cloud") {
    const configured = isSupabaseReady();
    return {
      eyebrow: "Supabase",
      title: configured ? "Molnanslutning redo" : "Molnanslutning saknas",
      body: `
        <div class="drawer-list">
          <article class="drawer-list-item">
            <strong>Status</strong>
            <span>${configured ? "Supabase-klienten är laddad med Project URL och anon public key." : "Supabase SDK eller konfiguration saknas. Appen kör lokalt tills detta är löst."}</span>
          </article>
          <article class="drawer-list-item">
            <strong>Session</strong>
            <span>${cloudSession?.user ? `Inloggad som ${escapeHtml(cloudSession.user.email || "användare")}` : "Ingen molnanvändare är inloggad ännu."}</span>
          </article>
          <article class="drawer-list-item">
            <strong>Profil</strong>
            <span>${cloudProfile ? `${escapeHtml(cloudProfile.full_name || cloudProfile.email || "Profil")} · ${escapeHtml(cloudProfile.role || "roll saknas")} · ${cloudProfile.is_active ? "aktiv" : "väntar på godkännande"}` : "Ingen profilrad hittad. Första admin behöver läggas in i Supabase-tabellen profiles."}</span>
          </article>
        </div>
        ${cloudSession?.user ? `
          <div class="drawer-actions">
            <button class="ghost-button" type="button" data-cloud-action="refresh">Uppdatera status</button>
            <button class="primary-button" type="button" data-cloud-action="signout">Logga ut</button>
          </div>
        ` : `
          <form class="drawer-form" id="cloud-login-form">
            <label>E-post<input name="email" type="email" placeholder="din e-post" required></label>
            <label>Lösenord<input name="password" type="password" placeholder="lösenord" required></label>
            <button class="primary-button" type="submit" ${configured ? "" : "disabled"}>Logga in mot Supabase</button>
          </form>
        `}
        <div class="info-banner warning-banner">
          Lokal data flyttas inte automatiskt än. Nästa steg är en kontrollerad migrering från localStorage till Supabase-tabellerna.
        </div>
      `
    };
  }

  if (kind === "notifications") {
    const items = getNotificationItems();
    return {
      eyebrow: "Aviseringar",
      title: items.length ? `${items.length} saker att följa upp` : "Allt är i fas",
      body: items.length ? `
        <div class="drawer-list">
          ${items.map((item) => `
            <article class="drawer-list-item">
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
    return {
      eyebrow: "Hjälp",
      title: `Hjälp för ${els.pageTitle.textContent}`,
      body: `
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
        <div class="drawer-actions">
          <button class="primary-button" type="button" data-drawer-view="time">Ny registrering</button>
          <button class="ghost-button" type="button" data-drawer-view="reports">Öppna attestflöde</button>
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
          <label>Företagsnamn<input id="settings-company" type="text" value="${escapeHtml(settings.companyName)}"></label>
          <label>Admin e-post<input id="settings-email" type="email" value="${escapeHtml(settings.adminEmail)}"></label>
          <label>Standard timpris<input id="settings-rate" type="number" min="0" step="50" value="${Number(settings.defaultRate || 0)}"></label>
          <label>Attestregel
            <select id="settings-approval">
              <option value="admin" ${settings.approvalMode === "admin" ? "selected" : ""}>Admin attesterar allt</option>
              <option value="owner" ${settings.approvalMode === "owner" ? "selected" : ""}>Kundansvarig attesterar</option>
              <option value="self" ${settings.approvalMode === "self" ? "selected" : ""}>Egen attest tillåten</option>
            </select>
          </label>
          <label>Vecka låses<input id="settings-lock-day" type="text" value="${escapeHtml(settings.weekLockDay)}"></label>
          <label>Fakturaprefix<input id="settings-invoice-prefix" type="text" value="${escapeHtml(settings.invoicePrefix || "F")}"></label>
          <label>Nästa fakturanummer<input id="settings-next-invoice" type="number" min="1" step="1" value="${Number(settings.nextInvoiceNumber || 1)}"></label>
          <label>Standard betalvillkor<input id="settings-payment-terms" type="number" min="0" step="1" value="${Number(settings.paymentTerms || 10)}"></label>
          <label>Standard moms %<input id="settings-vat-rate" type="number" min="0" step="1" value="${Number(settings.vatRate ?? 25)}"></label>
          <label>Bankgiro<input id="settings-bankgiro" type="text" value="${escapeHtml(settings.bankgiro || "")}"></label>
          <label>Fakturatext<input id="settings-invoice-footer" type="text" value="${escapeHtml(settings.invoiceFooter || "")}"></label>
          <button class="primary-button" type="submit">Spara inställningar</button>
        </form>
      `
    };
  }

  return {
    eyebrow: "Information",
    title: settings.companyName,
    body: `
      <div class="drawer-list">
        <article class="drawer-list-item">
          <strong>Lokal prototyp</strong>
          <span>All data sparas i din webbläsare just nu. Nästa produktionssteg är databas, inloggning och roller.</span>
        </article>
        <article class="drawer-list-item">
          <strong>Aktiva moduler</strong>
          <span>Tid, kvitton, resor, kunder, avtal, e-signering, attest, rapporter och fakturaunderlag.</span>
        </article>
      </div>
      <div class="drawer-actions">
        <button class="ghost-button" type="button" data-drawer-view="reports">Se rapporter</button>
        <button class="primary-button" type="button" data-drawer-view="clients">Öppna kunder</button>
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
      extra: latestPost ? `Sparat ${latestPost.date} av ${latestPost.author}.` : "Skapa ett inlägg via knappen Nytt inlägg."
    }
  }[tab];

  if (!content) return;
  els.newsTitle.textContent = content.title;
  els.newsBody.innerHTML = content.body;
  els.newsBodyExtra.textContent = content.extra;
}

function updateNewsReactions() {
  if (els.newsReactions) {
    els.newsReactions.textContent = `${newsLikes} gillar · ${newsComments} kommentarer`;
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
    { keys: ["kund", "kunder", "kontakt", "kontakter"], view: "clients" },
    { keys: ["projekt", "arbetsorder"], view: "projects" },
    { keys: ["avtal", "kundavtal"], view: "agreements" },
    { keys: ["sign", "signering", "e-signering"], view: "esign" },
    { keys: ["faktura", "fakturering", "fakturera", "underlag"], view: "invoice" },
    { keys: ["rapport", "rapporter", "analys", "lön", "löner"], view: "reports" },
    { keys: ["portal", "ärende", "kundportal", "underlag"], view: "portal" }
  ].find((item) => item.keys.some((key) => normalized.includes(key)));

  if (target) {
    setView(target.view);
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
  const target = event.target.closest("[data-open-client], [data-client-time], [data-client-project], [data-client-docs], [data-client-invoice], [data-delete-client]");
  if (!target) return false;

  const clientId = target.dataset.openClient || target.dataset.clientTime || target.dataset.clientProject || target.dataset.clientDocs || target.dataset.clientInvoice || target.dataset.deleteClient;
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
  target.status = status;
  target.reviewNote = note;
  return true;
}

function handleApprovalAction(action, kind, id) {
  if (!action || !kind || !id) return false;
  if (kind === "agreement") return handleAgreementWorkflowAction(action, id);
  if (kind === "esign") return handleEsignWorkflowAction(action, id);
  if (kind === "invoice") return handleInvoiceWorkflowAction(action, id);

  const messages = {
    submit: "Underlaget skickades in för attest.",
    approve: "Underlaget attesterades.",
    reject: "Underlaget avvisades."
  };

  if (action === "reject") {
    const note = window.prompt("Skriv gärna varför underlaget avvisas:", "Komplettera underlaget.");
    if (note === null) return false;
    if (!setApprovalStatus(kind, id, "rejected", note.trim() || "Komplettera underlaget.")) return false;
  } else if (action === "approve") {
    if (!setApprovalStatus(kind, id, "approved")) return false;
  } else if (action === "submit") {
    if (!setApprovalStatus(kind, id, "submitted")) return false;
  } else {
    return false;
  }

  saveState();
  renderAll();
  showToast(messages[action]);
  return true;
}

function handleAgreementWorkflowAction(action, id) {
  const agreement = getAgreement(id);
  if (!agreement) return false;

  if (action === "submit") {
    agreement.status = "sent";
    agreement.sentAt = isoToday;
    prepareAgreementEmail(agreement);
    showToast("Mejlutkast för avtalet öppnades och avtalet markerades som skickat.");
  } else if (action === "approve") {
    agreement.status = "signed";
    agreement.signedAt = isoToday;
    state.esignatures
      .filter((item) => item.agreementId === agreement.id)
      .forEach((item) => {
        item.status = "signed";
        item.signedAt = isoToday;
      });
    showToast("Avtalet markerades som signerat.");
  } else if (action === "reject") {
    agreement.status = "draft";
    agreement.reviewNote = window.prompt("Anteckning till avtalet:", "Behöver justeras innan utskick.") || "";
    showToast("Avtalet flyttades tillbaka till utkast.");
  } else {
    return false;
  }

  saveState();
  renderAll();
  return true;
}

function handleEsignWorkflowAction(action, id) {
  const item = state.esignatures.find((signature) => signature.id === id);
  if (!item) return false;

  if (action === "submit") {
    if (!prepareEsignEmail(item)) return false;
    showToast("Mejlutkast för signeringen öppnades.");
  } else if (action === "approve") {
    item.status = "signed";
    item.signedAt = isoToday;
    const agreement = getAgreement(item.agreementId);
    if (agreement) {
      agreement.status = "signed";
      agreement.signedAt = isoToday;
    }
    showToast("Signeringen markerades som signerad.");
  } else if (action === "remind") {
    if (!prepareEsignEmail(item, true)) return false;
    item.reminderDate = isoToday;
    showToast("Påminnelseutkast öppnades.");
  } else {
    return false;
  }

  saveState();
  renderAll();
  return true;
}

function handleInvoiceWorkflowAction(action, id) {
  const invoice = (state.invoices || []).find((item) => item.id === id);
  if (!invoice) return false;

  if (action === "submit") {
    if (!sendInvoiceEmail(invoice.id)) return false;
    showToast("E-postutkast öppnades och fakturan markerades som skickad.");
  } else if (action === "approve") {
    if (!setInvoiceStatus(invoice.id, "paid")) return false;
    showToast("Fakturan markerades som betald.");
  } else if (action === "reject") {
    if (!window.confirm("Vill du markera fakturan som krediterad?")) return false;
    if (!setInvoiceStatus(invoice.id, "credited")) return false;
    showToast("Fakturan markerades som krediterad.");
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
  renderReports();
}

function setView(viewName) {
  if (!canAccessView(viewName)) {
    showToast("Den här rollen har inte åtkomst till den vyn i prototypen.", "warning");
    viewName = getDefaultViewForCurrentUser();
  }
  els.navItems.forEach((button) => button.classList.toggle("active", button.dataset.view === viewName));
  els.moduleItems.forEach((button) => button.classList.remove("active"));
  els.views.forEach((view) => view.classList.toggle("active", view.id === `${viewName}-view`));
  els.pageTitle.textContent = viewTitles[viewName] || "Start";
}

function openModule(moduleName, button) {
  const moduleTargets = {
    tasks: "time",
    sales: "clients",
    projects: "clients",
    planning: "reports",
    analysis: "reports",
    partner: "portal"
  };
  setView(moduleTargets[moduleName] || "dashboard");
  els.navItems.forEach((item) => item.classList.remove("active"));
  button.classList.add("active");
  els.pageTitle.textContent = button.textContent.trim();
  showToast(`${button.textContent.trim()} är kopplad till närmaste färdiga vy i prototypen.`);
}

function addEntry(entry) {
  state.entries.unshift({
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
  });
  saveState();
  renderAll();
}

function startTimer() {
  if (!els.timerClient.value) {
    showToast("Välj kund innan du startar timern.", "warning");
    return;
  }
  timer.running = true;
  timer.startedAt = Date.now();
  timer.elapsedSeconds = 0;
  timer.interval = window.setInterval(updateTimerDisplay, 1000);
  els.startTimer.disabled = true;
  els.stopTimer.disabled = false;
  els.timerStatus.textContent = "Aktiv";
  updateTimerDisplay();
  showToast("Timern startade.");
}

function stopTimer() {
  if (!timer.running) return;

  window.clearInterval(timer.interval);
  timer.elapsedSeconds = Math.max(60, Math.round((Date.now() - timer.startedAt) / 1000));
  const hours = Math.max(0.1, Math.round((timer.elapsedSeconds / 3600) * 10) / 10);

  addEntry({
    date: isoToday,
    employee: "Anna Berg",
    type: els.timerType.value,
    clientId: els.timerClient.value,
    projectId: els.timerProject.value,
    workOrder: els.timerWorkOrder.value.trim(),
    task: els.timerTask.value,
    hours,
    billable: els.timerType.value === "project",
    payroll: true,
    status: "draft",
    description: els.timerDescription.value.trim()
  });

  timer.running = false;
  timer.startedAt = null;
  timer.elapsedSeconds = 0;
  els.startTimer.disabled = false;
  els.stopTimer.disabled = true;
  els.timerStatus.textContent = "Pausad";
  els.timerWorkOrder.value = "";
  els.timerDescription.value = "";
  updateTimerDisplay();
  showToast(`Timern sparade ${formatHours(hours)} som utkast.`);
}

function updateTimerDisplay() {
  const seconds = timer.running ? Math.round((Date.now() - timer.startedAt) / 1000) : timer.elapsedSeconds;
  const h = String(Math.floor(seconds / 3600)).padStart(2, "0");
  const m = String(Math.floor((seconds % 3600) / 60)).padStart(2, "0");
  const s = String(seconds % 60).padStart(2, "0");
  els.timerDisplay.textContent = `${h}:${m}:${s}`;
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

function approveSubmittedForEmployee(employee) {
  let count = 0;
  state.entries.forEach((entry) => {
    if ((entry.employee || getCurrentUser().name) === employee && entry.status === "submitted") {
      entry.status = "approved";
      entry.reviewNote = "";
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
  return count;
}

els.timePeriodBoard?.addEventListener("click", (event) => {
  const employeeButton = event.target.closest("[data-time-employee]");
  const approveButton = event.target.closest("[data-time-approve-employee]");

  if (approveButton) {
    const count = approveSubmittedForEmployee(approveButton.dataset.timeApproveEmployee);
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
    els.entryEmployee.value = employeeButton.dataset.timeEmployee;
    els.entriesTable?.scrollIntoView({ behavior: "smooth", block: "start" });
    showToast(`Tidtabellen filtreras visuellt via medarbetaren ${employeeButton.dataset.timeEmployee} i nästa byggsteg.`);
  }
});

els.timeExpandBlocks?.addEventListener("click", () => {
  els.timePeriodBoard?.classList.toggle("expanded");
  showToast(els.timePeriodBoard?.classList.contains("expanded") ? "Alla tidsblock expanderades." : "Tidsblocken komprimerades.");
});

els.timeAttestMonth?.addEventListener("click", () => {
  const employees = [...new Set(state.entries.filter(isEntryVisible).map((entry) => entry.employee || getCurrentUser().name))];
  const count = employees.reduce((sum, employee) => sum + approveSubmittedForEmployee(employee), 0);
  if (!count) {
    showToast("Det finns inga inskickade poster att attestera i perioden.", "warning");
    return;
  }
  saveState();
  renderAll();
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

  if (command === "warnings") {
    setView("reports");
    showToast("Öppnade attestflödet så att spärrade fakturarader kan åtgärdas.");
    return;
  }

  if (command === "drafts") {
    els.invoiceTabs.forEach((item) => item.classList.toggle("active", item.dataset.invoiceTab === "draft"));
    renderInvoiceWorkbench();
    renderInvoiceCommandStrip();
    showToast("Visar fakturautkast.");
    return;
  }

  if (command === "create-ready") {
    const rows = getInvoiceRows().filter((row) => row.total > 0 && !row.warning);
    const created = rows.reduce((count, row) => {
      const project = state.projects.find((item) => item.id === row.id);
      if (!project) return count;
      const record = createInvoiceRecord(project);
      if (!record) return count;
      project.invoiceStatus = "created";
      markProjectItemsInvoiced(project);
      return count + 1;
    }, 0);
    if (!created) {
      showToast("Det finns inga helt klara underlag att skapa just nu.", "warning");
      return;
    }
    saveState();
    renderAll();
    showToast(`${created} fakturaunderlag skapades.`);
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
  const button = event.target.closest("[data-report-open]");
  if (!button) return;
  setView(button.dataset.reportOpen);
  showToast("Rapportens arbetsvy öppnades.");
});

els.shortcuts.forEach((button) => {
  button.addEventListener("click", () => {
    setView(button.dataset.viewShortcut);
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
  showToast("Testläget är aktivt lokalt. Nästa steg är riktig inloggning och roller.");
});

els.topActions.forEach((button) => {
  button.addEventListener("click", () => {
    const action = button.dataset.topAction;
    openDrawer(action);
  });
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

  const drawerInvoiceCreate = event.target.closest("[data-invoice-create]");
  if (drawerInvoiceCreate && els.drawer.contains(drawerInvoiceCreate)) {
    const project = getProject(drawerInvoiceCreate.dataset.invoiceCreate);
    if (project) {
      createInvoiceRecord(project);
      project.invoiceStatus = "created";
      markProjectItemsInvoiced(project);
      saveState();
      closeDrawer();
      renderAll();
      showToast("Fakturaunderlag skapades och poster markerades som fakturerade.");
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

  const drawerInvoiceStatus = event.target.closest("[data-invoice-status]");
  if (drawerInvoiceStatus && els.drawer.contains(drawerInvoiceStatus)) {
    const status = drawerInvoiceStatus.dataset.invoiceStatus;
    if (status === "credited" && !window.confirm("Vill du markera fakturan som krediterad?")) return;
    if (setInvoiceStatus(drawerInvoiceStatus.dataset.invoiceId, status)) {
      saveState();
      renderAll();
      openInvoiceRecordDetail(drawerInvoiceStatus.dataset.invoiceId);
      showToast(`Fakturan markerades som ${getInvoiceStatusLabel(status).toLowerCase()}.`);
    }
    return;
  }

  const cloudActionButton = event.target.closest("[data-cloud-action]");
  if (cloudActionButton && els.drawer.contains(cloudActionButton)) {
    const action = cloudActionButton.dataset.cloudAction;
    if (action === "refresh") {
      refreshCloudSession().then(() => openDrawer("cloud"));
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
    newsComments += 1;
    updateNewsReactions();
    showToast("Kommentar räknad. Riktig kommentarsruta kräver användarinloggning.");
  }
});

document.addEventListener("submit", async (event) => {
  const cloudLoginForm = event.target.closest("#cloud-login-form");
  if (cloudLoginForm) {
    event.preventDefault();
    const data = new FormData(cloudLoginForm);
    if (await cloudSignIn(data.get("email").trim(), data.get("password"))) {
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
    approvalMode: document.querySelector("#settings-approval").value,
    weekLockDay: document.querySelector("#settings-lock-day").value.trim() || "Fredag",
    invoicePrefix: document.querySelector("#settings-invoice-prefix").value.trim() || "F",
    nextInvoiceNumber: Math.max(1, Number(document.querySelector("#settings-next-invoice").value || 1)),
    paymentTerms: Math.max(0, Number(document.querySelector("#settings-payment-terms").value || 10)),
    vatRate: Math.max(0, normalizeNumber(document.querySelector("#settings-vat-rate").value, 25)),
    bankgiro: document.querySelector("#settings-bankgiro").value.trim(),
    invoiceFooter: document.querySelector("#settings-invoice-footer").value.trim()
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

els.entryForm.addEventListener("submit", (event) => {
  event.preventDefault();
  addEntry({
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
  els.entryWorkOrder.value = "";
  els.entryDescription.value = "";
  els.entryHours.value = "1.0";
  showToast("Tidsraden sparades.");
});

els.clientForm.addEventListener("submit", (event) => {
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
  state.clients.push(client);
  selectedClientId = client.id;
  saveState();
  els.clientForm.reset();
  els.clientRate.value = "950";
  renderAll();
  showToast("Kunden skapades.");
});

els.projectForm.addEventListener("submit", (event) => {
  event.preventDefault();
  state.projects.push({
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
  });
  saveState();
  els.projectForm.reset();
  els.projectStart.value = isoToday;
  els.projectBudget.value = "20";
  renderAll();
  showToast("Projektet skapades.");
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

els.entriesTable.addEventListener("click", (event) => {
  const submitButton = event.target.closest("[data-submit-entry]");
  const approveButton = event.target.closest("[data-approve]");
  const rejectButton = event.target.closest("[data-reject-entry]");
  const editButton = event.target.closest("[data-edit-entry]");
  const deleteButton = event.target.closest("[data-delete]");

  if (submitButton) {
    handleApprovalAction("submit", "entry", submitButton.dataset.submitEntry);
    return;
  }

  if (approveButton) {
    handleApprovalAction("approve", "entry", approveButton.dataset.approve);
    return;
  }

  if (rejectButton) {
    handleApprovalAction("reject", "entry", rejectButton.dataset.rejectEntry);
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
    state.entries = state.entries.filter((item) => item.id !== deleteButton.dataset.delete);
    showToast("Tidsraden togs bort.");
    saveState();
    renderAll();
  }
});

els.clientGrid.addEventListener("click", (event) => {
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

els.projectGrid.addEventListener("click", (event) => {
  const openButton = event.target.closest("[data-open-project]");
  const editButton = event.target.closest("[data-edit-project]");
  const deleteButton = event.target.closest("[data-delete-project]");
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
    state.projects = state.projects.filter((project) => project.id !== projectId);
    saveState();
    renderAll();
    showToast("Projektet togs bort.");
  }
});

els.projectDetail?.addEventListener("click", (event) => {
  const editProject = event.target.closest("[data-edit-project]");
  const editEntry = event.target.closest("[data-edit-entry]");
  const editReceipt = event.target.closest("[data-edit-receipt]");
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
  const submitButton = event.target.closest("[data-submit-receipt]");
  const approveButton = event.target.closest("[data-approve-receipt]");
  const rejectButton = event.target.closest("[data-reject-receipt]");
  const editButton = event.target.closest("[data-edit-receipt]");
  const deleteButton = event.target.closest("[data-delete-receipt]");
  if (submitButton) handleApprovalAction("submit", "receipt", submitButton.dataset.submitReceipt);
  if (approveButton) handleApprovalAction("approve", "receipt", approveButton.dataset.approveReceipt);
  if (rejectButton) handleApprovalAction("reject", "receipt", rejectButton.dataset.rejectReceipt);
  if (editButton) openEntityEditor("receipt", editButton.dataset.editReceipt);
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
  const submitButton = event.target.closest("[data-submit-travel]");
  const approveButton = event.target.closest("[data-approve-travel]");
  const rejectButton = event.target.closest("[data-reject-travel]");
  const editButton = event.target.closest("[data-edit-travel]");
  const deleteButton = event.target.closest("[data-delete-travel]");
  if (submitButton) handleApprovalAction("submit", "travel", submitButton.dataset.submitTravel);
  if (approveButton) handleApprovalAction("approve", "travel", approveButton.dataset.approveTravel);
  if (rejectButton) handleApprovalAction("reject", "travel", rejectButton.dataset.rejectTravel);
  if (editButton) openEntityEditor("travel", editButton.dataset.editTravel);
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

els.approvalList.addEventListener("click", (event) => {
  const button = event.target.closest("[data-approval-action]");
  if (!button) return;
  handleApprovalAction(button.dataset.approvalAction, button.dataset.approvalKind, button.dataset.approvalId);
});

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
    els.periodModes.forEach((item) => item.classList.remove("active"));
    button.classList.add("active");
    showToast(`Visningsläge: ${button.textContent.trim()}.`);
  });
});

els.filterClient.addEventListener("change", renderEntriesTable);
els.filterStatus.addEventListener("change", renderEntriesTable);
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
  if (!roleSelect || !isAdminUser()) return;
  const user = state.users.find((item) => item.id === roleSelect.dataset.userRole);
  if (!user) return;
  user.role = roleSelect.value;
  user.title = roleLabels[user.role] || user.title;
  saveState();
  renderAll();
  showToast(`Rollen för ${user.name} uppdaterades.`);
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
els.portalTaskList?.addEventListener("click", (event) => {
  const button = event.target.closest("[data-portal-task-action]");
  if (!button) return;
  handlePortalTaskAction(button.dataset.portalTaskAction, button.dataset.portalTaskId);
});
els.portalInvoices?.addEventListener("click", (event) => {
  const button = event.target.closest("[data-portal-invoice-action]");
  if (!button) return;
  handlePortalInvoiceAction(button.dataset.portalInvoiceAction, button.dataset.portalInvoiceId);
});
els.portalTemplates?.addEventListener("click", (event) => {
  const button = event.target.closest("[data-portal-template]");
  if (!button) return;
  createPortalTaskFromTemplate(button.dataset.portalTemplate);
});
els.invoiceSearch.addEventListener("input", renderInvoiceWorkbench);
els.invoiceFrom.addEventListener("change", renderInvoiceWorkbench);
els.invoiceTo.addEventListener("change", renderInvoiceWorkbench);
els.invoiceFilterButton?.addEventListener("click", () => {
  renderInvoiceWorkbench();
  showToast("Fakturaunderlaget filtrerades.");
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

  if (openLink) {
    event.preventDefault();
    const project = state.projects.find((item) => item.id === openLink.dataset.invoiceOpen);
    if (project) {
      openInvoiceDetail(project.id);
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
    const project = state.projects.find((item) => item.id === draftButton.dataset.invoiceDraft);
    if (project) {
      project.invoiceStatus = "draft";
      showToast("Projektet sparades som fakturautkast.");
    }
  }

  if (createButton) {
    const project = state.projects.find((item) => item.id === createButton.dataset.invoiceCreate);
    if (project) {
      createInvoiceRecord(project);
      project.invoiceStatus = "created";
      markProjectItemsInvoiced(project);
      showToast("Fakturaunderlag skapades och attesterade poster markerades som fakturerade.");
    }
  }

  if (draftButton || createButton) {
    saveState();
    renderAll();
  }
});

els.invoiceHistoryTable?.addEventListener("click", (event) => {
  const documentButton = event.target.closest("[data-open-document]");
  const statusButton = event.target.closest("[data-invoice-status]");
  const reopenButton = event.target.closest("[data-invoice-reopen]");
  const detailButton = event.target.closest("[data-invoice-detail]");
  const emailButton = event.target.closest("[data-invoice-email]");

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

  if (emailButton) {
    event.preventDefault();
    if (sendInvoiceEmail(emailButton.dataset.invoiceEmail)) {
      saveState();
      renderAll();
      showToast("E-postutkast öppnades och fakturan markerades som skickad.");
    }
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
els.startTimer.addEventListener("click", startTimer);
els.stopTimer.addEventListener("click", stopTimer);
els.exportCsv.addEventListener("click", exportCsv);

syncEntryTypeControls();
syncTimerTypeControls();
renderAll();
updateTimerDisplay();
refreshCloudSession();
