(function () {
  "use strict";

  const SeatMaster = (window.SeatMaster = window.SeatMaster || {});
  const { SEAT_TYPES } = SeatMaster.constants;

  function translated(key, values, fallback) {
    if (SeatMaster.i18n) return SeatMaster.i18n.t(key, values);
    let text = fallback;
    Object.entries(values || {}).forEach(([name, value]) => { text = text.replaceAll(`{${name}}`, String(value)); });
    return text;
  }

  function clampInteger(value, min, max, fallback) {
    const number = Number.parseInt(value, 10);
    return Number.isFinite(number) ? Math.min(max, Math.max(min, number)) : fallback;
  }

  function parseEmptyNumbers(input, maxNumber) {
    const result = new Set();
    const normalized = String(input || "")
      .replace(/[，、；;]/g, ",")
      .replace(/[～~—–]/g, "-")
      .replace(/\s+/g, ",");

    normalized.split(",").filter(Boolean).forEach((token) => {
      const range = token.match(/^(\d+)\s*-\s*(\d+)$/);
      if (range) {
        const start = Math.min(Number(range[1]), Number(range[2]));
        const end = Math.max(Number(range[1]), Number(range[2]));
        for (let number = start; number <= end; number += 1) {
          if (number >= 1 && number <= maxNumber) result.add(number);
        }
        return;
      }
      if (/^\d+$/.test(token)) {
        const number = Number(token);
        if (number >= 1 && number <= maxNumber) result.add(number);
      }
    });
    return result;
  }

  function buildStudents(config) {
    const maxNumber = clampInteger(config.maxNumber, 1, 999, 34);
    const femaleStart = clampInteger(config.femaleStart, 1, maxNumber + 1, 21);
    const empty = parseEmptyNumbers(config.emptyNumbers, maxNumber);
    const students = [];
    for (let number = 1; number <= maxNumber; number += 1) {
      if (!empty.has(number)) {
        students.push({ number, gender: number >= femaleStart ? "female" : "male" });
      }
    }
    return students;
  }

  function splitStudentDataCells(rawLine) {
    if (rawLine.includes("\t")) return rawLine.split("\t").map((cell) => cell.trim());
    if (/[，,]/.test(rawLine)) return rawLine.split(/[，,]/).map((cell) => cell.trim());
    const colon = rawLine.trim().match(/^(\d+)\s*[:：]\s*(.+)$/);
    if (colon) return [colon[1], colon[2].trim()];
    const spaced = rawLine.trim().match(/^(\d+)\s{2,}(.+)$/);
    if (spaced) return [spaced[1], spaced[2].trim()];
    return [rawLine.trim()];
  }

  function isStudentDataHeader(cells) {
    return /^(?:座號|學號|號碼|number|no\.?)$/i.test(cells[0] || "") && /^(?:姓名|name)$/i.test(cells[1] || "");
  }

  function inferStudentNumbers(input) {
    const numbers = new Set();
    let hasHeader = false;

    String(input || "").split(/\r?\n/).forEach((rawLine) => {
      if (!rawLine.trim()) return;
      const cells = splitStudentDataCells(rawLine);
      if (isStudentDataHeader(cells)) {
        hasHeader = true;
        return;
      }
      if (!hasHeader || !/^\d+$/.test(cells[0] || "")) return;
      const number = Number(cells[0]);
      if (number >= 1 && number <= 999) numbers.add(number);
    });

    return hasHeader ? Array.from(numbers).sort((left, right) => left - right) : [];
  }

  function formatNumberRanges(numbers) {
    const ordered = Array.from(new Set((numbers || []).filter((number) => Number.isInteger(number) && number >= 1 && number <= 999)))
      .sort((left, right) => left - right);
    const ranges = [];
    let start = null;
    let end = null;

    ordered.forEach((number) => {
      if (start === null) {
        start = number;
        end = number;
      } else if (number === end + 1) {
        end = number;
      } else {
        ranges.push(start === end ? String(start) : `${start}-${end}`);
        start = number;
        end = number;
      }
    });
    if (start !== null) ranges.push(start === end ? String(start) : `${start}-${end}`);
    return ranges.join(", ");
  }

  function parseStudentRecords(input, students) {
    const records = new Map();
    const roster = students || [];
    const validNumbers = new Set(roster.map((student) => student.number));
    let sequentialIndex = 0;
    let fieldHeaders = [];
    let hasStructuredHeader = false;

    String(input || "").split(/\r?\n/).forEach((rawLine) => {
      const line = rawLine.trim();
      if (!line) return;
      const cells = splitStudentDataCells(rawLine);
      if (isStudentDataHeader(cells)) {
        hasStructuredHeader = true;
        fieldHeaders = cells.slice(2).map((label, index) => label || `${translated("studentData.field", { number: index + 1 }, "欄位 {number}")}`);
        return;
      }
      if (/^\d+$/.test(cells[0] || "")) {
        const number = Number(cells[0]);
        if (!validNumbers.has(number)) return;
        const name = String(cells[1] || "").trim().slice(0, 50);
        const fields = cells.slice(2).map((value, index) => ({
          label: String(fieldHeaders[index] || translated("studentData.field", { number: index + 1 }, "欄位 {number}")).trim().slice(0, 30),
          value: String(value || "").trim().slice(0, 300)
        })).filter((field) => field.value);
        records.set(number, { number, name, fields });
        return;
      }

      // A spreadsheet row with an empty student number is not a name-only
      // roster entry. Ignore stray values in later columns instead of assigning
      // them sequentially to the next available student number.
      if (hasStructuredHeader || rawLine.includes("\t") || /[，,]/.test(rawLine)) return;

      while (sequentialIndex < roster.length && records.has(roster[sequentialIndex].number)) sequentialIndex += 1;
      if (sequentialIndex < roster.length) {
        const number = roster[sequentialIndex].number;
        records.set(number, { number, name: line.slice(0, 50), fields: [] });
        sequentialIndex += 1;
      }
    });
    records.fieldHeaders = fieldHeaders.slice();
    return records;
  }

  function parseStudentNames(input, students) {
    const directory = new Map();
    parseStudentRecords(input, students).forEach((record, number) => {
      if (record.name) directory.set(number, record.name);
    });
    return directory;
  }

  function normalizeStudentData(input, students) {
    const roster = students || [];
    const records = parseStudentRecords(input, roster);
    const fieldLabels = Array.isArray(records.fieldHeaders) ? records.fieldHeaders.slice() : [];
    records.forEach((record) => record.fields.forEach((field) => {
      if (!fieldLabels.includes(field.label)) fieldLabels.push(field.label);
    }));
    const orderedRecords = roster.map((student) => records.get(student.number)).filter(Boolean);
    if (!fieldLabels.length) return orderedRecords.map((record) => `${record.number}, ${record.name}`).join("\n");
    const numberHeader = translated("studentData.number", {}, "座號");
    const nameHeader = translated("studentData.name", {}, "姓名");
    const lines = [[numberHeader, nameHeader, ...fieldLabels].join("\t")];
    orderedRecords.forEach((record) => {
      const values = new Map(record.fields.map((field) => [field.label, field.value]));
      lines.push([record.number, record.name, ...fieldLabels.map((label) => values.get(label) || "")].join("\t"));
    });
    return lines.join("\n");
  }

  function normalizeStudentNames(input, students) {
    return normalizeStudentData(input, students);
  }

  function secureRandomInt(maxExclusive) {
    if (maxExclusive <= 1) return 0;
    if (window.crypto && window.crypto.getRandomValues) {
      const limit = Math.floor(0x100000000 / maxExclusive) * maxExclusive;
      const data = new Uint32Array(1);
      do window.crypto.getRandomValues(data); while (data[0] >= limit);
      return data[0] % maxExclusive;
    }
    return Math.floor(Math.random() * maxExclusive);
  }

  function secureShuffle(items) {
    const copy = items.slice();
    for (let index = copy.length - 1; index > 0; index -= 1) {
      const swapIndex = secureRandomInt(index + 1);
      [copy[index], copy[swapIndex]] = [copy[swapIndex], copy[index]];
    }
    return copy;
  }

  function isCompatible(seat, student) {
    return seat.type === "general" || seat.type === student.gender;
  }

  function nextSeatType(type) {
    const index = SEAT_TYPES.indexOf(type);
    return SEAT_TYPES[(index + 1 + SEAT_TYPES.length) % SEAT_TYPES.length];
  }

  function normalizeConfig(config) {
    const rows = clampInteger(config.rows, 1, 12, 8);
    const cols = clampInteger(config.cols, 1, 10, 4);
    const maxNumber = clampInteger(config.maxNumber, 1, 999, 34);
    const displayMode = ["number", "name", "both"].includes(config.displayMode) ? config.displayMode : "number";
    return {
      className: String(config.className || (SeatMaster.i18n ? SeatMaster.i18n.t("common.untitled") : "未命名班級")).trim().slice(0, 30) || (SeatMaster.i18n ? SeatMaster.i18n.t("common.untitled") : "未命名班級"),
      rows,
      cols,
      maxNumber,
      emptyNumbers: String(config.emptyNumbers || "").trim(),
      femaleStart: clampInteger(config.femaleStart, 1, maxNumber + 1, Math.min(21, maxNumber + 1)),
      displayMode,
      studentData: String(config.studentData !== undefined ? config.studentData : config.studentNames || "").slice(0, 50000)
    };
  }

  function buildSeatGrid(config, previousSeats) {
    const byId = new Map((previousSeats || []).map((seat) => [seat.id, seat]));
    const seats = [];
    for (let row = 0; row < config.rows; row += 1) {
      for (let col = 0; col < config.cols; col += 1) {
        const id = `${row}-${col}`;
        const previous = byId.get(id);
        seats.push({
          id,
          row,
          col,
          type: previous && SEAT_TYPES.includes(previous.type) ? previous.type : "general",
          pin: previous && Number.isInteger(previous.pin) ? previous.pin : null
        });
      }
    }
    return seats;
  }

  function validate(state) {
    const students = buildStudents(state.config);
    const studentByNumber = new Map(students.map((student) => [student.number, student]));
    const usableSeats = state.seats.filter((seat) => seat.type !== "aisle");
    const errors = [];
    const pinned = new Set();

    state.seats.forEach((seat) => {
      if (!seat.pin) return;
      const student = studentByNumber.get(seat.pin);
      if (seat.type === "aisle") errors.push(translated("validation.aislePin", { number: seat.pin }, "走道位置不能固定 {number} 號。"));
      else if (!student) errors.push(translated("validation.notInRoster", { number: seat.pin }, "{number} 號不在目前有效名單中。"));
      else if (!isCompatible(seat, student)) errors.push(translated("validation.genderMismatch", { number: seat.pin }, "{number} 號與固定座位的性別條件不符。"));
      if (pinned.has(seat.pin)) errors.push(translated("validation.duplicatePin", { number: seat.pin }, "{number} 號被固定在兩個以上的位置。"));
      pinned.add(seat.pin);
    });

    if (usableSeats.length < students.length) {
      errors.push(translated("validation.capacity", { seats: usableSeats.length, students: students.length }, "可用座位只有 {seats} 席，少於 {students} 位學生。"));
    }

    const unpinnedMale = students.filter((student) => student.gender === "male" && !pinned.has(student.number)).length;
    const unpinnedFemale = students.filter((student) => student.gender === "female" && !pinned.has(student.number)).length;
    const openGeneral = usableSeats.filter((seat) => seat.type === "general" && !seat.pin).length;
    const openMale = usableSeats.filter((seat) => seat.type === "male" && !seat.pin).length;
    const openFemale = usableSeats.filter((seat) => seat.type === "female" && !seat.pin).length;

    if (Math.max(0, unpinnedMale - openMale) + Math.max(0, unpinnedFemale - openFemale) > openGeneral) {
      errors.push(translated("validation.generalCapacity", {}, "不限性別座位不足，無法容納限制座位分配後的學生。"));
    }

    return { valid: errors.length === 0, errors, students, usableSeats };
  }

  function arrange(state) {
    const report = validate(state);
    if (!report.valid) {
      const error = new Error(report.errors.join("\n"));
      error.details = report.errors;
      throw error;
    }

    const assignment = {};
    const assignedNumbers = new Set();
    state.seats.forEach((seat) => {
      if (seat.pin) {
        assignment[seat.id] = seat.pin;
        assignedNumbers.add(seat.pin);
      }
    });

    const available = report.students.filter((student) => !assignedNumbers.has(student.number));
    const maleStudents = secureShuffle(available.filter((student) => student.gender === "male"));
    const femaleStudents = secureShuffle(available.filter((student) => student.gender === "female"));
    const maleSeats = secureShuffle(state.seats.filter((seat) => seat.type === "male" && !seat.pin));
    const femaleSeats = secureShuffle(state.seats.filter((seat) => seat.type === "female" && !seat.pin));
    const generalSeats = secureShuffle(state.seats.filter((seat) => seat.type === "general" && !seat.pin));

    while (maleStudents.length && maleSeats.length) assignment[maleSeats.pop().id] = maleStudents.pop().number;
    while (femaleStudents.length && femaleSeats.length) assignment[femaleSeats.pop().id] = femaleStudents.pop().number;

    const remainingStudents = secureShuffle([...maleStudents, ...femaleStudents]);
    while (remainingStudents.length && generalSeats.length) assignment[generalSeats.pop().id] = remainingStudents.pop().number;

    state.seats.forEach((seat) => {
      if (seat.type !== "aisle" && assignment[seat.id] === undefined) assignment[seat.id] = null;
    });
    return assignment;
  }

  SeatMaster.engine = {
    clampInteger,
    parseEmptyNumbers,
    inferStudentNumbers,
    formatNumberRanges,
    buildStudents,
    parseStudentRecords,
    parseStudentNames,
    normalizeStudentData,
    normalizeStudentNames,
    secureShuffle,
    isCompatible,
    nextSeatType,
    normalizeConfig,
    buildSeatGrid,
    validate,
    arrange
  };
})();
