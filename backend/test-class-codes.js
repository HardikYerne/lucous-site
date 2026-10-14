process.env.ALLOW_EPHEMERAL_DEV_STORAGE = "true";
delete process.env.MONGODB_URI;
const express = require("express");
const http = require("http");
const { inMemoryDrafts } = require("./routes/teacher-lessons");
const { createTeacherClassCodesRouter, createStudentClassAccessRouter } = require("./routes/class-codes");
const { createStudentAccessRouter } = require("./routes/student-access");
const { memoryCodes } = require("./services/class-code-service");

const app = express();
app.use(express.json());
const requireTeacher = (req, res, next) => { req.userId = req.headers["x-teacher"] || "t1"; next(); };
app.use("/api/teacher", createTeacherClassCodesRouter(null, requireTeacher));
app.use("/api/student/access/class", createStudentClassAccessRouter(null));
app.use("/api/student/access", createStudentAccessRouter(null));

// Seed one published lesson for teacher t1 and one for t2
function lesson(id, teacherId, code, title) {
  inMemoryDrafts.set(id, {
    id, teacherId, title, subject: "Science", status: "PUBLISHED", accessCode: code,
    publishedAt: new Date().toISOString(),
    content: JSON.stringify({ title, summary: "s", learningObjectives: [], explanationSteps: [], sourceGroundedExamples: [], keyTerms: [], reviewQuestions: [{ question: "Q?", answer: "A" }] }),
  });
}
lesson("L1", "t1", "LU-AAAAAA", "T1 lesson");
lesson("L2", "t2", "LU-BBBBBB", "T2 lesson");

const server = http.createServer(app).listen(0, async () => {
  const port = server.address().port;
  const call = (method, path, body, headers = {}) => new Promise((resolve) => {
    const req = http.request({ port, path, method, headers: { "Content-Type": "application/json", ...headers } }, (res) => {
      let d = ""; res.on("data", (c) => d += c); res.on("end", () => resolve({ status: res.statusCode, json: JSON.parse(d || "{}") }));
    });
    if (body) req.write(JSON.stringify(body)); req.end();
  });
  let fail = 0;
  const ok = (name, cond, extra) => { console.log((cond ? "PASS " : "FAIL ") + name + (cond ? "" : " -> " + JSON.stringify(extra))); if (!cond) fail++; };

  let r = await call("POST", "/api/teacher/class-codes", { title: "Class 10 A", durationMinutes: 60 });
  ok("create code 201", r.status === 201 && /^LC-[2-9A-HJ-NP-Z]{8}$/.test(r.json.item.code), r);
  const code = r.json.item.code, id = r.json.item.id;
  ok("shows 1 published item for teacher", r.json.item.publishedCount === 1, r.json);

  r = await call("POST", "/api/teacher/class-codes", { durationMinutes: 5 });
  ok("rejects duration < 15 min", r.status === 400, r);
  r = await call("POST", "/api/teacher/class-codes", { durationMinutes: 99999999 });
  ok("rejects duration > 30 days", r.status === 400, r);

  r = await call("POST", "/api/student/access/class/verify", { code: code.toLowerCase().replace("-", " ") });
  ok("student opens with sloppy-typed code", r.status === 200 && r.json.bundle.items.length === 1, r);
  const item = r.json.bundle.items[0];
  ok("only that teacher's materials (not t2)", item.title === "T1 lesson" && r.json.bundle.items.every((i) => i.title !== "T2 lesson"), r.json);
  ok("item token is composite, no raw LU code leaked", item.accessCode === `${code}::LU-AAAAAA` && !JSON.stringify(r.json).includes('"accessCode":"LU-'), item.accessCode);

  r = await call("POST", "/api/student/access/class/verify", { code: "LC-ZZZZZZZZ" });
  ok("wrong code -> 404", r.status === 404, r);
  r = await call("POST", "/api/student/access/class/verify", { code: "LU-AAAAAA" });
  ok("plain item code is not a class code -> 404", r.status === 404, r);

  r = await call("POST", "/api/student/access/check-answer", { code: item.accessCode, questionId: "rq_1", studentAnswer: "A" });
  ok("composite token works for check-answer", r.status === 200 && r.json.success === true, r);

  r = await call("POST", "/api/student/access/check-answer", { code: `${code}::LU-BBBBBB`, questionId: "rq_1", studentAnswer: "A" });
  ok("cannot reach another teacher's item with my class code", r.status === 404, r);

  // other teacher cannot revoke mine
  r = await call("POST", `/api/teacher/class-codes/${id}/revoke`, {}, { "x-teacher": "t2" });
  ok("other teacher cannot revoke -> 404", r.status === 404, r);

  // expire it
  memoryCodes.get(id).expiresAt = new Date(Date.now() - 1000);
  r = await call("POST", "/api/student/access/class/verify", { code });
  ok("expired code -> 410", r.status === 410, r);
  r = await call("POST", "/api/student/access/check-answer", { code: item.accessCode, questionId: "rq_1", studentAnswer: "A" });
  ok("expired code also cuts off the item token -> 410", r.status === 410, r);
  r = await call("GET", "/api/teacher/class-codes");
  ok("teacher list shows EXPIRED", r.json.items.find((i) => i.id === id).status === "EXPIRED", r.json);

  // revoke works
  r = await call("POST", "/api/teacher/class-codes", { durationMinutes: 60 });
  const id2 = r.json.item.id, code2 = r.json.item.code;
  r = await call("POST", `/api/teacher/class-codes/${id2}/revoke`, {});
  ok("revoke ok", r.status === 200 && r.json.item.status === "REVOKED", r);
  r = await call("POST", "/api/student/access/class/verify", { code: code2 });
  ok("revoked code -> 410", r.status === 410, r);

  // normal single-item flow still untouched
  r = await call("POST", "/api/student/access/verify", { code: "LU-AAAAAA" });
  ok("existing single item code flow still works", r.status === 200 && r.json.item.title === "T1 lesson", r);

  console.log(fail ? `\n${fail} FAILED` : "\nALL PASSED");
  server.close(); process.exit(fail ? 1 : 0);
});
