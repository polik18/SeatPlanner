(function () {
  "use strict";

  const SM = (window.SeatMaster = window.SeatMaster || {});

  function numberOfGroups(count, targetSize) {
    if (!count) return 0;
    if (count === 1) return 1;
    const minimum = Math.ceil(count / 6);
    const maximum = Math.floor(count / 2);
    return Math.max(minimum, Math.min(maximum, Math.round(count / targetSize)));
  }

  function draw(students, targetSize, strategy, preassignments) {
    if (!Number.isInteger(targetSize) || targetSize < 2 || targetSize > 6) throw new RangeError("每組人數需介於 2–6 人。");
    const pool = Array.from(students || []);
    if (new Set(pool.map((student) => student.number)).size !== pool.length) throw new Error("學生座號重複，請先檢查名單。");
    if (strategy === "same") return drawSame(pool, targetSize, preassignments || {});
    let groupsCount = numberOfGroups(pool.length, targetSize);
    if (strategy === "same" && pool.length > 1) {
      const males = pool.filter((student) => student.gender === "male").length;
      const females = pool.filter((student) => student.gender === "female").length;
      groupsCount = Math.max(groupsCount, Math.ceil(males / 6) + Math.ceil(females / 6));
      groupsCount = Math.min(groupsCount, Math.floor(pool.length / 2));
    }
    if (groupsCount > pool.length) throw new Error("學生人數不足以建立任務小組。");
    const groups = Array.from({ length: groupsCount }, (_, index) => ({ id: `group-${index + 1}`, name: `第 ${index + 1} 組`, members: [], locked: false, gender: "" }));
    const byNumber = new Map(pool.map((student) => [student.number, student]));
    const assignments = preassignments || {};
    Object.entries(assignments).forEach(([rawNumber, rawIndex]) => {
      const number = Number(rawNumber);
      if (!byNumber.has(number)) return;
      const index = Number(rawIndex);
      if (!Number.isInteger(index) || index < 0 || index >= groups.length) throw new RangeError("預先安排的小組編號無效。");
      const group = groups[index];
      const student = byNumber.get(number);
      if (group.members.length >= 6) throw new Error(`${group.name} 已達 6 人上限。`);
      if (strategy === "same" && group.gender && group.gender !== student.gender) throw new Error(`${group.name} 的預排成員性別不同，無法套用男女分組。`);
      if (strategy === "same") group.gender = student.gender;
      group.members.push(number);
    });

    const assigned = new Set(groups.flatMap((group) => group.members));
    const pending = SM.engine.secureShuffle(pool.filter((student) => !assigned.has(student.number)));
    const room = (group) => Math.max(0, Math.ceil(pool.length / groups.length) - group.members.length);
    if (strategy === "same") {
      const genders = ["male", "female"];
      const openGroups = groups.filter((group) => !group.gender);
      openGroups.forEach((group) => {
        const counts = Object.fromEntries(genders.map((gender) => [gender, pending.filter((student) => student.gender === gender).length]));
        const assignedCapacity = Object.fromEntries(genders.map((gender) => [gender, groups.filter((item) => item.gender === gender).reduce((sum, item) => sum + room(item), 0)]));
        group.gender = counts.male - assignedCapacity.male >= counts.female - assignedCapacity.female ? "male" : "female";
      });
      pending.forEach((student) => {
        const choices = SM.engine.secureShuffle(groups.filter((group) => group.gender === student.gender && group.members.length < 6));
        const target = choices.sort((left, right) => left.members.length - right.members.length)[0];
        if (target) target.members.push(student.number);
        else throw new Error("依性別分組後，組別人數無法符合 2–6 人限制；請改用混合或均衡分組。");
      });
    } else {
      pending.forEach((student) => {
        const available = groups.filter((group) => group.members.length < 6);
        if (!available.length) throw new Error("預排人數過多，請減少預排或增加組別。");
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
    }
    return groups;
  }

  // Search group counts before allocating students. Average capacity is not a
  // constraint: a six-person group and a two-person group are both legal.
  function drawSame(pool, targetSize, assignments) {
    if (!pool.length) return [];
    if (pool.length === 1) throw new Error("同性別分組每組至少需要 2 人。");
    const byNumber = new Map(pool.map((student) => [student.number, student]));
    const genders = [...new Set(pool.map((student) => student.gender))];
    const pinned = new Map();
    Object.entries(assignments).forEach(([rawNumber, rawIndex]) => {
      const student = byNumber.get(Number(rawNumber));
      if (!student) return;
      const index = Number(rawIndex);
      if (!Number.isInteger(index) || index < 0 || index >= Math.floor(pool.length / 2)) throw new RangeError("預先安排的小組編號無效。");
      const group = pinned.get(index) || { gender: student.gender, members: [] };
      if (group.gender !== student.gender) throw new Error("同組預排成員性別不同，請調整優先安排。");
      group.members.push(student.number);
      if (group.members.length > 6) throw new Error("預排小組已達 6 人上限。");
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
      chosen = Array.from({ length: count }, (_, index) => ({ id: `group-${index + 1}`, name: `第 ${index + 1} 組`, members: [...(pinned.get(index)?.members || [])], locked: false, gender: pinned.get(index)?.gender || "" }));
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
    throw new Error("同性別分組需讓每組有 2–6 人；請檢查單一性別人數及預排，或改用混合分組。");
  }

  function validate(groups, numbers) {
    const wanted = new Set(numbers || []);
    const seen = new Set();
    const errors = [];
    (groups || []).forEach((group) => {
      if (group.members.length < 2 || group.members.length > 6) errors.push(`${group.name} 人數需為 2–6 人，目前 ${group.members.length} 人。`);
      group.members.forEach((number) => {
        if (!wanted.has(number)) errors.push(`不在本次名單中的 ${number} 號被排入分組。`);
        if (seen.has(number)) errors.push(`${number} 號重複出現在多個組別。`);
        seen.add(number);
      });
    });
    wanted.forEach((number) => { if (!seen.has(number)) errors.push(`${number} 號尚未分組。`); });
    return { valid: errors.length === 0, errors };
  }

  SM.groupPlanner = { numberOfGroups, draw, validate };
})();
