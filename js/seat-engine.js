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

  function parseStudentNames(input, students) {
    const directory = new Map();
    const roster = students || [];
    const validNumbers = new Set(roster.map((student) => student.number));
    let sequentialIndex = 0;

    String(input || "").split(/\r?\n/).forEach((rawLine) => {
      const line = rawLine.trim();
      if (!line) return;
      const explicit = line.match(/^(\d+)\s*(?:[,，:：\t]|\s{2,})\s*(.+)$/);
      if (explicit) {
        const number = Number(explicit[1]);
        const name = explicit[2].trim().slice(0, 30);
        if (validNumbers.has(number) && name) directory.set(number, name);
        return;
      }

      while (sequentialIndex < roster.length && directory.has(roster[sequentialIndex].number)) sequentialIndex += 1;
      if (sequentialIndex < roster.length) {
        directory.set(roster[sequentialIndex].number, line.slice(0, 30));
        sequentialIndex += 1;
      }
    });
    return directory;
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
      studentNames: String(config.studentNames || "").slice(0, 20000)
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
    buildStudents,
    parseStudentNames,
    secureShuffle,
    isCompatible,
    nextSeatType,
    normalizeConfig,
    buildSeatGrid,
    validate,
    arrange
  };
})();
