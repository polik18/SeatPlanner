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
      roomAspect: "landscape",
      maxNumber: 34,
      emptyNumbers: "16-20",
      seatExcludedNumbers: "",
      femaleStart: 21,
      displayMode: "number",
      studentData: "1\t張三\n2\t李四\n3\t王○明\n4\t陳○宇\n5\t林○恩\n6\t黃○軒\n7\t吳○睿\n8\t劉○廷\n9\t蔡○翔\n10\t楊○鈞\n11\t許○維\n12\t鄭○文\n13\t謝○翰\n14\t洪○辰\n15\t郭○豪\n21\t林○君\n22\t陳○婷\n23\t黃○涵\n24\t吳○穎\n25\t劉○晴\n26\t蔡○妤\n27\t楊○涵\n28\t許○瑄\n29\t鄭○彤\n30\t謝○蓁\n31\t洪○晴\n32\t郭○妍\n33\t邱○潔\n34\t曾○妤",
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
