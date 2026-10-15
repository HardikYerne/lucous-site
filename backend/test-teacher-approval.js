/**
 * Approval is one-time and survives restarts / new logins.
 * Run: node test-teacher-approval-persistence.js
 */
const fs = require("fs");
const svc = require("./services/teacher-application-service");
const src = fs.readFileSync(__dirname + "/server.js", "utf8");

const ensureStart = src.indexOf("async function ensureTeacherApplication");
const ensureEnd = src.indexOf("function requireTeacher");
const decStart = src.indexOf('app.post("/api/admin/teacher-applications/:id/decision"');
const decEnd = src.indexOf("// ------------------------------- Parent");
const code = src.slice(ensureStart, ensureEnd) + "\n" + src.slice(decStart, decEnd) + "\nreturn { ensureTeacherApplication, ensureAllTeacherApplications };";

// ---- fake database (what Prisma would hold) ----
const db = new Map();
let failWrites = false;
const prisma = {
  user: {
    findUnique: async ({ where }) => db.get(where.id) || null,
    findMany: async ({ where }) => [...db.values()].filter((u) => u.role === where.role),
    update: async ({ where, data }) => {
      if (failWrites) throw new Error("Unknown argument `teacherStatus`");
      const u = db.get(where.id);
      if (!u) { const e = new Error("not found"); e.code = "P2025"; throw e; }
      Object.assign(u, data);
      return u;
    },
  },
};
process.env.MONGODB_URI = "mongodb://fake";
let decisionHandler;
const app = { post: (p, mw, h) => { decisionHandler = h; } };
const api = new Function(
  "app", "requireRole", "prisma", "inMemoryUsers", "isEnvAdminId", "getEnvAdminPublicUser",
  "getApplicationByUserId", "listTeacherApplications", "createPendingTeacherApplication",
  "syncApplicationFromUser", "reviewTeacherApplication", "console", code
)(app, () => null, prisma, new Map(), () => false, () => null,
  svc.getApplicationByUserId, svc.listTeacherApplications, svc.createPendingTeacherApplication,
  svc.syncApplicationFromUser, svc.reviewTeacherApplication, console);

const admin = { id: "admin1", role: "ADMIN" };
db.set("admin1", admin);
const decide = async (id, body) => {
  let out; await decisionHandler({ params: { id }, body, userId: "admin1" },
    { status(c) { this.c = c; return this; }, json(b) { out = { status: this.c || 200, ...b }; return this; } });
  return out;
};
const restart = () => { svc._teacherApplicationsMap.clear(); }; // backend restarts: memory wiped
let fail = 0;
const ok = (n, c, x) => { console.log((c ? "PASS " : "FAIL ") + n + (c ? "" : " -> " + JSON.stringify(x))); if (!c) fail++; };

(async () => {
  // teacher signs up (role TEACHER, no decision yet)
  db.set("t1", { id: "t1", name: "Hardik", email: "h@x.com", role: "TEACHER", isVerified: false, teacherStatus: "PENDING" });
  svc.createPendingTeacherApplication(db.get("t1"));
  ok("new teacher starts PENDING", svc.isTeacherApproved("t1") === false);

  // admin approves ONCE
  let r = await decide("t1", { status: "APPROVED" });
  ok("admin approves -> 200", r.status === 200 && r.success, r);
  ok("decision saved in the database", db.get("t1").teacherStatus === "APPROVED");
  ok("teacher can now use teaching tools", svc.isTeacherApproved("t1") === true);

  // backend restarts, teacher logs in again -> still approved, no new approval
  restart();
  await api.ensureTeacherApplication("t1");
  ok("after RESTART the teacher is still approved", svc.isTeacherApproved("t1") === true, svc.getApplicationByUserId("t1"));

  // teacher edits own application -> stays approved
  svc.saveTeacherApplication("t1", { qualifications: "M.Sc" }, db.get("t1"));
  ok("editing the application does NOT reset approval", svc.isTeacherApproved("t1") === true);

  // stale PENDING in memory (another server instance) but DB says APPROVED
  svc._teacherApplicationsMap.get("t1").status = "PENDING";
  await api.ensureTeacherApplication("t1");
  ok("stale PENDING in memory is corrected from the database", svc.isTeacherApproved("t1") === true);

  // admin list after restart still shows every teacher
  db.set("t2", { id: "t2", name: "Second", email: "s@x.com", role: "TEACHER", isVerified: false, teacherStatus: "PENDING" });
  restart();
  await api.ensureAllTeacherApplications();
  const list = svc.listTeacherApplications({ status: "ALL" }).map((a) => a.userId).sort();
  ok("admin list is rebuilt from the database after restart", list.includes("t1") && list.includes("t2"), list);
  ok("t1 shows APPROVED, t2 shows PENDING in that list", svc.getApplicationByUserId("t1").status === "APPROVED" && svc.getApplicationByUserId("t2").status === "PENDING");

  // pending teacher who never logged in after restart can still be approved
  r = await decide("t2", { status: "APPROVED" });
  ok("admin can approve a teacher right after a restart", r.status === 200 && db.get("t2").teacherStatus === "APPROVED", r);

  // DB write fails -> decision is NOT applied (never memory-only)
  db.set("t3", { id: "t3", name: "Third", email: "t@x.com", role: "TEACHER", isVerified: false, teacherStatus: "PENDING" });
  svc.createPendingTeacherApplication(db.get("t3"));
  failWrites = true;
  r = await decide("t3", { status: "APPROVED" });
  ok("failed database save -> 500 with a clear message", r.status === 500 && /prisma db push/.test(r.message), r);
  ok("and the approval is NOT applied in memory", svc.isTeacherApproved("t3") === false);
  failWrites = false;

  // rejection still needs a reason and is saved
  r = await decide("t3", { status: "REJECTED" });
  ok("rejection without reason -> 400", r.status === 400, r);
  r = await decide("t3", { status: "REJECTED", reason: "Documents unclear" });
  ok("rejection with reason saved", r.status === 200 && db.get("t3").teacherStatus === "REJECTED", r);

  console.log(fail ? `\n${fail} FAILED` : "\nALL PASSED");
  process.exit(fail ? 1 : 0);
})();