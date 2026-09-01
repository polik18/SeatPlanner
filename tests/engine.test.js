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

const spreadsheetNumbers = [...Array.from({ length: 13 }, (_, index) => index + 1), ...Array.from({ length: 14 }, (_, index) => index + 21)];
const spreadsheetRows = spreadsheetNumbers.map((number) => `${number}\t測試學生${number}\t****${String(number).padStart(6, "0")}\taccount${number}`);
spreadsheetRows.splice(6, 0, "\t\t\torphan-account-a");
spreadsheetRows.splice(22, 0, "\t\t\torphan-account-b");
spreadsheetRows.splice(23, 0, "orphan-account-c");
const pastedSpreadsheetWithStrayAccounts = `座號\t姓名\t密碼\t帳號\n${spreadsheetRows.join("\n")}`;
const inferredNumbers = engine.inferStudentNumbers(pastedSpreadsheetWithStrayAccounts);
assert.equal(inferredNumbers.length, 27);
assert.equal(engine.formatNumberRanges(Array.from({ length: 34 }, (_, index) => index + 1).filter((number) => !inferredNumbers.includes(number))), "14-20");
const spreadsheetStudents = engine.buildStudents(engine.normalizeConfig({ maxNumber: 34, emptyNumbers: "14-20", femaleStart: 21 }));
const spreadsheetRecords = engine.parseStudentRecords(pastedSpreadsheetWithStrayAccounts, spreadsheetStudents);
assert.equal(spreadsheetRecords.size, 27);
assert.equal(spreadsheetRecords.has(14), false);
assert.equal(spreadsheetRecords.get(28).fields.find((field) => field.label === "帳號").value, "account28");

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

const legacyRoomConfig = engine.normalizeConfig({ rows: 2, cols: 3, maxNumber: 4 });
assert.equal(legacyRoomConfig.boardPosition, "top-center");
assert.equal(legacyRoomConfig.boardLength, 3);
assert.equal(legacyRoomConfig.doorPosition, "right-end");
assert.equal(legacyRoomConfig.doorOffset, 0);
assert.equal(legacyRoomConfig.teacherPosition, "top-end");
assert.equal(legacyRoomConfig.teacherOffset, 0);
const sanitizedRoomConfig = engine.normalizeConfig({ rows: 2, cols: 3, maxNumber: 4, boardPosition: "invalid", boardLength: 99, doorPosition: "hidden", doorOffset: -99, teacherPosition: "left-center", teacherOffset: 99 });
assert.equal(sanitizedRoomConfig.boardPosition, "top-center");
assert.equal(sanitizedRoomConfig.boardLength, 5);
assert.equal(sanitizedRoomConfig.doorPosition, "hidden");
assert.equal(sanitizedRoomConfig.doorOffset, -60);
assert.equal(sanitizedRoomConfig.teacherPosition, "left-center");
assert.equal(sanitizedRoomConfig.teacherOffset, 60);

const rotationConfig = engine.normalizeConfig({ rows: 2, cols: 3, maxNumber: 4, boardPosition: "bottom-center", boardLength: 5, doorPosition: "right-start", doorOffset: 18, teacherPosition: "left-end", teacherOffset: -12 });
const rotationSeats = engine.buildSeatGrid(rotationConfig, []);
rotationSeats.find((seat) => seat.id === "0-0").type = "male";
rotationSeats.find((seat) => seat.id === "0-0").pin = 1;
rotationSeats.find((seat) => seat.id === "1-2").type = "aisle";
const rotationAssignment = { "0-0": 1, "0-1": 2, "0-2": null, "1-0": 3, "1-1": 4 };
const clockwiseRotation = engine.rotateSeatLayout(rotationConfig, rotationSeats, rotationAssignment, "clockwise");
assert.equal(clockwiseRotation.config.rows, 3);
assert.equal(clockwiseRotation.config.cols, 2);
assert.equal(clockwiseRotation.config.boardPosition, "left-center");
assert.equal(clockwiseRotation.config.boardLength, 5);
assert.equal(clockwiseRotation.config.doorPosition, "bottom-end");
assert.equal(clockwiseRotation.config.doorOffset, -18);
assert.equal(clockwiseRotation.config.teacherPosition, "top-start");
assert.equal(clockwiseRotation.config.teacherOffset, 12);
assert.equal(clockwiseRotation.seats.find((seat) => seat.id === "0-1").type, "male");
assert.equal(clockwiseRotation.seats.find((seat) => seat.id === "0-1").pin, 1);
assert.equal(clockwiseRotation.seats.find((seat) => seat.id === "2-0").type, "aisle");
assert.equal(clockwiseRotation.assignment["0-1"], 1);
assert.equal(clockwiseRotation.assignment["1-0"], 4);

const restoredRotation = engine.rotateSeatLayout(clockwiseRotation.config, clockwiseRotation.seats, clockwiseRotation.assignment, "counterclockwise");
assert.equal(restoredRotation.config.rows, 2);
assert.equal(restoredRotation.config.cols, 3);
assert.equal(restoredRotation.config.boardPosition, rotationConfig.boardPosition);
assert.equal(restoredRotation.config.doorPosition, rotationConfig.doorPosition);
assert.equal(restoredRotation.config.teacherPosition, rotationConfig.teacherPosition);
assert.equal(restoredRotation.config.boardLength, rotationConfig.boardLength);
assert.equal(restoredRotation.config.doorOffset, rotationConfig.doorOffset);
assert.equal(restoredRotation.config.teacherOffset, rotationConfig.teacherOffset);
rotationSeats.forEach((seat) => {
  const restored = restoredRotation.seats.find((item) => item.id === seat.id);
  assert.equal(restored.type, seat.type);
  assert.equal(restored.pin, seat.pin);
});
Object.entries(rotationAssignment).forEach(([id, value]) => assert.equal(restoredRotation.assignment[id], value));

let fourTurns = { config: rotationConfig, seats: rotationSeats, assignment: rotationAssignment };
for (let turn = 0; turn < 4; turn += 1) {
  fourTurns = engine.rotateSeatLayout(fourTurns.config, fourTurns.seats, fourTurns.assignment, "clockwise");
}
assert.equal(fourTurns.config.rows, rotationConfig.rows);
assert.equal(fourTurns.config.cols, rotationConfig.cols);
assert.equal(fourTurns.config.boardPosition, rotationConfig.boardPosition);
assert.equal(fourTurns.config.doorPosition, rotationConfig.doorPosition);
assert.equal(fourTurns.config.teacherPosition, rotationConfig.teacherPosition);
assert.equal(fourTurns.config.boardLength, rotationConfig.boardLength);
assert.equal(fourTurns.config.doorOffset, rotationConfig.doorOffset);
assert.equal(fourTurns.config.teacherOffset, rotationConfig.teacherOffset);
rotationSeats.forEach((seat) => assert.equal(fourTurns.seats.find((item) => item.id === seat.id).type, seat.type));
engine.ROOM_POSITIONS.forEach((position) => {
  let rotatedPosition = position;
  for (let turn = 0; turn < 4; turn += 1) rotatedPosition = engine.rotateRoomPosition(rotatedPosition, "clockwise", "hidden");
  assert.equal(rotatedPosition, position);
  assert.equal(engine.rotateRoomPosition(engine.rotateRoomPosition(position, "clockwise", "hidden"), "counterclockwise", "hidden"), position);
});
assert.equal(engine.rotateRoomOffset(20, "top-center", "clockwise"), 20);
assert.equal(engine.rotateRoomOffset(20, "right-center", "clockwise"), -20);
assert.equal(engine.rotateRoomOffset(20, "top-center", "counterclockwise"), -20);
assert.equal(engine.rotateRoomOffset(20, "right-center", "counterclockwise"), 20);
assert.throws(() => engine.rotateRoomOffset(0, "hidden", "upside-down"), /Unsupported rotation direction/);
const maximumRotation = engine.rotateSeatLayout({ rows: 12, cols: 10 }, engine.buildSeatGrid({ rows: 12, cols: 10 }, []), {}, "clockwise");
assert.equal(engine.normalizeConfig(maximumRotation.config).rows, 10);
assert.equal(engine.normalizeConfig(maximumRotation.config).cols, 12);
assert.throws(() => engine.rotateSeatLayout(rotationConfig, rotationSeats, {}, "upside-down"), /Unsupported rotation direction/);

console.log("engine tests passed");
