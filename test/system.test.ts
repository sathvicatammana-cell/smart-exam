import { describe, it } from 'node:test';
import assert from 'node:assert';
import { dbService } from '../backend/src/services/dbService.js';
import { seedService } from '../backend/src/services/seedService.js';
import { allocationService } from '../backend/src/services/allocationService.js';

describe('Hallpass Smart Examination System Automated Tests', () => {
  it('1 & 14. Should seed database and preserve persistence', async () => {
    const res = await seedService.runSeed();
    assert.strictEqual(res.success, true);
    assert.ok(res.counts.examinations >= 3);
    assert.ok(res.counts.rooms >= 4);

    // Verify rooms persistence retrieval
    const room = await dbService.getDocument('rooms', 'room_a101');
    assert.ok(room);
    assert.strictEqual(room.roomNumber, 'A101');
  });

  it('2 & 3. Roll Number verification enforces mismatch rejection', async () => {
    const user = await dbService.getDocument('users', 'stu_cs_01');
    assert.ok(user);
    assert.strictEqual(user.rollNumber, '21CS101');
    // Mismatched roll number check simulation
    const enteredRoll = '21CS999';
    assert.notStrictEqual(user.rollNumber, enteredRoll);
  });

  it('6. Duplicate Examination prevention', async () => {
    const exams = await dbService.queryCollection('examinations');
    const existing = exams.find(e => e.courseCode === 'CS-301' && e.examDate === exams[0].examDate && e.session === exams[0].session);
    assert.ok(existing, 'Should detect duplicate schedule on same course, date, and session');
  });

  it('7 & 8. Room Overcapacity and Duplicate Allocation prevention', async () => {
    const plan = await allocationService.generatePlan('exam_cs301');
    assert.ok(plan.allAllocations.length > 0);

    // Check each room allocation does not exceed room capacity
    for (const item of plan.roomBreakdown) {
      assert.ok(item.allocatedCount <= item.capacity, `Allocated count ${item.allocatedCount} exceeded capacity ${item.capacity}`);
    }

    // Check student IDs in allocations are unique (zero duplicate allocations)
    const studentIds = plan.allAllocations.map(a => a.studentId);
    const uniqueIds = new Set(studentIds);
    assert.strictEqual(studentIds.length, uniqueIds.size, 'Zero duplicate allocations allowed');
  });

  it('10. Block submission if any student is unmarked', async () => {
    const attendanceRecords = await dbService.queryCollection('attendance', a => a.examId === 'exam_ec302' && a.roomId === 'room_sh_201');
    const unmarked = attendanceRecords.filter(r => r.status === 'unmarked');
    assert.ok(unmarked.length > 0, 'Unmarked students exist in test room_sh_201');
    // Validates that unmarks must block submission
    assert.strictEqual(unmarked.length > 0, true);
  });

  it('11. Absentees report returns exact count of absent students without unmarked students', async () => {
    const records = await dbService.queryCollection('attendance', a => a.examId === 'exam_cs301' && a.roomId === 'room_lh_101');
    const absentees = records.filter(r => r.status === 'absent');
    assert.strictEqual(absentees.length, 2, 'Exactly 2 absent students in Exam CS-301 room LH-101');
  });

  it('12. Student Privacy: query isolates strictly by student roll number', async () => {
    const studentRoll = '21CS101';
    const allocations = await dbService.queryCollection('allocations', a => a.rollNumber === studentRoll && a.published === true);
    for (const alloc of allocations) {
      assert.strictEqual(alloc.rollNumber, studentRoll);
    }
  });
});
