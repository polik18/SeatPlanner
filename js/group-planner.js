(function () {
  "use strict";

  const SM = (window.SeatMaster = window.SeatMaster || {});
  const message = (zh, en) => SM.i18n?.getLanguage?.() === "en" ? en : zh;
  const groupName = index => message(`第 ${index + 1} 組`, `Group ${index + 1}`);

  function numberOfGroups(count, targetSize) {
    if (!count) return 0;
    if (count === 1) return 1;
    const minimum = Math.ceil(count / 6);
    const maximum = Math.floor(count / 2);
    return Math.max(minimum, Math.min(maximum, Math.round(count / targetSize)));
  }

  function draw(students, targetSize, strategy, preassignments) {
    if (!Number.isInteger(targetSize) || targetSize < 2 || targetSize > 6) throw new RangeError(message("每組人數需介於 2–6 人。", "Group size must be between 2 and 6."));
    const pool = Array.from(students || []);
    if (new Set(pool.map((student) => student.number)).size !== pool.length) throw new Error(message("學生座號重複，請先檢查名單。", "Duplicate student numbers. Check the roster."));
    if (strategy === "same") return drawSame(pool, targetSize, preassignments || {});
    const groupsCount = numberOfGroups(pool.length, targetSize);
    if (groupsCount > pool.length) throw new Error(message("學生人數不足以建立任務小組。", "Not enough students to create groups."));
    const groups = Array.from({ length: groupsCount }, (_, index) => ({ id: `group-${index + 1}`, name: groupName(index), members: [], locked: false, gender: "" }));
    const byNumber = new Map(pool.map((student) => [student.number, student]));
    const assignments = preassignments || {};
    Object.entries(assignments).forEach(([rawNumber, rawIndex]) => {
      const number = Number(rawNumber);
      if (!byNumber.has(number)) return;
      const index = Number(rawIndex);
      if (!Number.isInteger(index) || index < 0 || index >= groups.length) throw new RangeError(message("預先安排的小組編號無效。", "Invalid preassigned group number."));
      const group = groups[index];
      const student = byNumber.get(number);
      if (group.members.length >= 6) throw new Error(message(`${group.name} 已達 6 人上限。`, `${group.name} has reached the six-person limit.`));
      group.members.push(number);
    });

    const assigned = new Set(groups.flatMap((group) => group.members));
    const pending = SM.engine.secureShuffle(pool.filter((student) => !assigned.has(student.number)));
      pending.forEach((student) => {
        const available = groups.filter((group) => group.members.length < 6);
        if (!available.length) throw new Error(message("預排人數過多，請減少預排或增加組別。", "Too many preassignments. Reduce them or add groups."));
        let target;
        if (strategy === "balanced" && student.gender) {
          target = available.sort((left, right) => {
            const score = (group) => Math.abs(group.members.filter((number) => byNumber.get(number)?.gender === student.gender).length + 1 - group.members.filter((number) => byNumber.get(number)?.gender !== student.gender).length);
            return score(left) - score(right) || left.members.length - right.members.length;
          })[0];
        } else {
          target = SM.engine.secureShuffle(available).sort((left, right) => left.members.length - right.members.length)[0];
        }
        target.members.push(student.number);
      });
    return groups;
  }

  function drawSame(pool, targetSize, assignments) {
    if (!pool.length) return [];
    if (pool.length === 1) throw new Error(message("同性別分組每組至少需要 2 人。", "Same-gender groups need at least two students each."));
    const byNumber = new Map(pool.map((student) => [student.number, student]));
    const genders = [...new Set(pool.map((student) => student.gender))];
    const pinned = new Map();
    Object.entries(assignments).forEach(([rawNumber, rawIndex]) => {
      const student = byNumber.get(Number(rawNumber));
      if (!student) return;
      const index = Number(rawIndex);
      if (!Number.isInteger(index) || index < 0 || index >= Math.floor(pool.length / 2)) throw new RangeError(message("預先安排的小組編號無效。", "Invalid preassigned group number."));
      const group = pinned.get(index) || { gender: student.gender, members: [] };
      if (group.gender !== student.gender) throw new Error(message("同組預排成員性別不同，請調整優先安排。", "Preassigned members have different genders. Adjust the preassignments."));
      group.members.push(student.number);
      if (group.members.length > 6) throw new Error(message("預排小組已達 6 人上限。", "A preassigned group exceeds six students."));
      pinned.set(index, group);
    });
    const preferred = numberOfGroups(pool.length, targetSize);
    const candidates = Array.from({ length: Math.floor(pool.length / 2) }, (_, i) => i + 1).sort((a, b) => Math.abs(a - preferred) - Math.abs(b - preferred) || a - b);
    let chosen;
    for (const count of candidates) {
      if ([...pinned.keys()].some((index) => index >= count)) continue;
      const allocation = new Map();
      const search = (position, remaining) => {
        if (position === genders.length) return remaining === 0;
        const gender = genders[position];
        const students = pool.filter((student) => student.gender === gender);
        const fixed = [...pinned.values()].filter((group) => group.gender === gender);
        const fixedMembers = fixed.reduce((sum, group) => sum + group.members.length, 0);
        for (let groups = Math.max(fixed.length, Math.ceil(students.length / 6)); groups <= Math.min(remaining, Math.floor(students.length / 2)); groups += 1) {
          const minimumNeeded = fixed.reduce((sum, group) => sum + Math.max(0, 2 - group.members.length), 0) + 2 * (groups - fixed.length);
          if (minimumNeeded > students.length - fixedMembers) continue;
          allocation.set(gender, groups);
          if (search(position + 1, remaining - groups)) return true;
        }
        return false;
      };
      if (!search(0, count)) continue;
      chosen = Array.from({ length: count }, (_, index) => ({ id: `group-${index + 1}`, name: groupName(index), members: [...(pinned.get(index)?.members || [])], locked: false, gender: pinned.get(index)?.gender || "" }));
      for (const gender of genders) {
        let needed = allocation.get(gender) - chosen.filter((group) => group.gender === gender).length;
        for (const group of chosen) if (!group.gender && needed > 0) { group.gender = gender; needed -= 1; }
        const groups = chosen.filter((group) => group.gender === gender);
        const assigned = new Set(groups.flatMap((group) => group.members));
        const pending = SM.engine.secureShuffle(pool.filter((student) => student.gender === gender && !assigned.has(student.number)));
        for (const student of pending) {
          const target = groups.filter((group) => group.members.length < 6).sort((a, b) => a.members.length - b.members.length)[0];
          target.members.push(student.number);
        }
      }
      if (validate(chosen, pool.map((student) => student.number)).valid) return chosen;
    }
    throw new Error(message("同性別分組需讓每組有 2–6 人；請檢查單一性別人數及預排，或改用混合分組。", "Same-gender groups need 2–6 students each. Check gender counts and preassignments, or use mixed groups."));
  }

  function validate(groups, numbers) {
    const wanted = new Set(numbers || []);
    const seen = new Set();
    const errors = [];
    (groups || []).forEach((group) => {
      if (group.members.length < 2 || group.members.length > 6) errors.push(message(`${group.name} 人數需為 2–6 人，目前 ${group.members.length} 人。`, `${group.name} needs 2–6 students; currently ${group.members.length}.`));
      group.members.forEach((number) => {
        if (!wanted.has(number)) errors.push(message(`不在本次名單中的 ${number} 號被排入分組。`, `Student ${number} is not in this roster.`));
        if (seen.has(number)) errors.push(message(`${number} 號重複出現在多個組別。`, `Student ${number} appears in multiple groups.`));
        seen.add(number);
      });
    });
    wanted.forEach((number) => { if (!seen.has(number)) errors.push(message(`${number} 號尚未分組。`, `Student ${number} is not assigned.`)); });
    return { valid: errors.length === 0, errors };
  }

  SM.groupPlanner = { numberOfGroups, draw, validate };
})();
