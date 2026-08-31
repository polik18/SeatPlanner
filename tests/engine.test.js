const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const assert = require("node:assert/strict");

const root = path.resolve(__dirname, "..");
const context = { window: { crypto: require("node:crypto").webcrypto }, console };
vm.createContext(context);
["js/constants.js", "js/seat-engine.js"].forEach((file) => {
  vm.runInContext(fs.readFileSync(path.join(root, file), "utf8"), context, { filename: file });
});

const { engine, createDefaultState } = context.window.SeatMaster;

const empty = engine.parseEmptyNumbers("16-20, 25、27～28", 34);
assert.deepEqual(Array.from(empty), [16, 17, 18, 19, 20, 25, 27, 28]);

const state = createDefaultState();
state.config = engine.normalizeConfig(state.config);
state.seats = engine.buildSeatGrid(state.config, []);
const students = engine.buildStudents(state.config);
assert.equal(students.length, 29);
assert.equal(students.filter((student) => student.gender === "male").length, 15);
assert.equal(students.filter((student) => student.gender === "female").length, 14);

const names = engine.parseStudentNames("1, 王小明\n2：李小華\n陳小美", students);
assert.equal(names.get(1), "王小明");
assert.equal(names.get(2), "李小華");
assert.equal(names.get(3), "陳小美");

const excelRoster = "座號\t姓名\n1\t吳于睿\t男\n2\t李嘉瑜\n3\t戴靖\n\t\n4\t柯益維\n21\t鄭瑀\n\n34\t劉知樂";
const excelNames = engine.parseStudentNames(excelRoster, students);
assert.equal(excelNames.size, 6);
assert.equal(excelNames.get(21), "鄭瑀");
assert.equal(engine.normalizeStudentNames(excelRoster, students).split("\n")[0], "座號\t姓名\t欄位 1");

const richData = "座號\t姓名\t外號\t帳號\t密碼\t居住地點\n1\t吳于睿\t小睿\tstudent01\tpass-001\t臺北市\n\n21\t鄭瑀\t小瑀\tstudent21\tpass-021\t新北市";
const records = engine.parseStudentRecords(richData, students);
assert.equal(records.size, 2);
assert.equal(records.get(1).name, "吳于睿");
assert.equal(records.get(1).fields.length, 4);
assert.equal(records.get(1).fields.find((field) => field.label === "密碼").value, "pass-001");
assert.equal(engine.normalizeStudentData(richData, students).split("\n")[0], "座號\t姓名\t外號\t帳號\t密碼\t居住地點");
assert.equal(engine.normalizeStudentData("座號\t姓名\t備註\n1\t吳于睿\t", students).split("\n")[0], "座號\t姓名\t備註");
assert.equal(engine.normalizeConfig({ studentNames: "1, 舊姓名" }).studentData, "1, 舊姓名");

const pastedClassRoster = `1\t吳于睿
2\t李嘉瑜
3\t戴靖
4\t柯益維
5\t蘇莛量
6\t張晨赫
\t
7\t陳宣豫
8\t蔡尚勳
9\t廖晟安
10\t柯奕丞
11\t楊昕宸
12\t楊牧群
13\t黃之恆
21\t鄭瑀
22\t楊孟筑
23\t陳宣妤
24\t陳欣岳
25\t陳若平
26\t黃馨菲
27\t黃芊語
28\t朱懷善
\t
29\t黃若瑄
30\t王苡安
31\t鄭亦媗
32\t顏思恬
33\t劉亮妤
34\t劉知樂`;
const pastedRecords = engine.parseStudentRecords(pastedClassRoster, students);
assert.equal(pastedRecords.size, 27);
assert.equal(pastedRecords.get(34).name, "劉知樂");

state.seats[0].type = "male";
state.seats[1].type = "female";
state.seats[2].pin = 1;
const assignment = engine.arrange(state);
assert.equal(assignment[state.seats[2].id], 1);
assert.equal(Object.values(assignment).filter(Number.isInteger).length, 29);
assert.equal(new Set(Object.values(assignment).filter(Number.isInteger)).size, 29);
state.seats.forEach((seat) => {
  const number = assignment[seat.id];
  if (!number) return;
  const student = students.find((item) => item.number === number);
  assert.equal(engine.isCompatible(seat, student), true);
});

state.seats.slice(0, 4).forEach((seat) => { seat.type = "aisle"; seat.pin = null; });
assert.equal(engine.validate(state).valid, false);

const dynamicConfig = engine.normalizeConfig({
  className: "302 自訂班",
  rows: 3,
  cols: 3,
  maxNumber: 7,
  emptyNumbers: "",
  femaleStart: 5,
  displayMode: "both",
  studentData: "1, 學生一"
});
const dynamicSeats = engine.buildSeatGrid(dynamicConfig, []);
assert.equal(dynamicConfig.className, "302 自訂班");
assert.equal(dynamicSeats.length, 9);
assert.equal(engine.buildStudents(dynamicConfig).length, 7);
dynamicSeats[0].type = "male";
const expandedSeats = engine.buildSeatGrid({ ...dynamicConfig, rows: 5, cols: 6 }, dynamicSeats);
assert.equal(expandedSeats.length, 30);
assert.equal(expandedSeats.find((seat) => seat.id === "0-0").type, "male");

console.log("engine tests: 32 assertions passed");
