(function () {
  "use strict";

  const SeatMaster = (window.SeatMaster = window.SeatMaster || {});

  SeatMaster.constants = Object.freeze({
    STORAGE_KEY: "classroom-seat-master:v5",
    VERSION: 5,
    SEAT_TYPES: ["general", "male", "female", "aisle"],
    TYPE_LABELS: Object.freeze({
      general: "不限性別",
      male: "限男生",
      female: "限女生",
      aisle: "走道／無桌"
    }),
    DEFAULT_CONFIG: Object.freeze({
      className: "601 班",
      rows: 8,
      cols: 4,
      maxNumber: 34,
      emptyNumbers: "16-20",
      seatExcludedNumbers: "",
      femaleStart: 21,
      displayMode: "number",
      studentData: "",
      boardPosition: "top-center",
      boardLength: 3,
      boardOffset: 0,
      boardSize: 3,
      doorPosition: "right-end",
      doorOffset: 0,
      doorSize: 3,
      teacherPosition: "top-end",
      teacherOffset: 0,
      teacherSize: 3
    })
  });

  SeatMaster.createDefaultState = function () {
    return {
      version: SeatMaster.constants.VERSION,
      config: { ...SeatMaster.constants.DEFAULT_CONFIG },
      seats: [],
      assignment: {},
      hasDrawn: false,
      activities: [],
      roomLayout: null
    };
  };
})();
