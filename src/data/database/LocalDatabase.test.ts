import { describe, it, expect, beforeEach } from 'vitest';
import {
  db,
  UserProfileRepository,
  MeasurementRepository,
  FoodLogRepository,
  WorkoutLogRepository,
  MessageRepository,
  WorkoutSetRepository,
  FavoriteExerciseRepository,
  WellnessLogRepository,
} from './LocalDatabase';

describe('Dexie Database Repositories', () => {
  const profileRepo = new UserProfileRepository();
  const measurementRepo = new MeasurementRepository();
  const foodRepo = new FoodLogRepository();
  const workoutRepo = new WorkoutLogRepository();
  const messageRepo = new MessageRepository();
  const workoutSetRepo = new WorkoutSetRepository();
  const favRepo = new FavoriteExerciseRepository();

  beforeEach(async () => {
    // Clear database before each test
    await db.userProfiles.clear();
    await db.measurements.clear();
    await db.foodLogs.clear();
    await db.workoutLogs.clear();
    await db.messages.clear();
    await db.workoutSets.clear();
    await db.favoriteExercises.clear();
  });

  it('should create and retrieve a user profile', async () => {
    const profileId = await profileRepo.create({
      name: 'John Doe',
      gender: 'male',
      birthDate: new Date('1996-05-24'),
      height: 180,
      createdAt: new Date(),
    });

    expect(profileId).toBeDefined();

    const profile = await profileRepo.get(profileId);
    expect(profile).toBeDefined();
    expect(profile?.name).toBe('John Doe');
    expect(profile?.gender).toBe('male');
    expect(profile?.birthDate.toISOString().split('T')[0]).toBe('1996-05-24');
    expect(profile?.height).toBe(180);
  });

  it('should update user profiles', async () => {
    const profileId = await profileRepo.create({
      name: 'Jane Doe',
      gender: 'female',
      birthDate: new Date('1998-05-24'),
      height: 165,
      createdAt: new Date(),
    });

    const profile = await profileRepo.get(profileId);
    expect(profile).toBeDefined();

    profile!.name = 'Jane Smith';
    profile!.birthDate = new Date('1997-05-24');
    await profileRepo.update(profile!);

    const updatedProfile = await profileRepo.get(profileId);
    expect(updatedProfile?.name).toBe('Jane Smith');
    expect(updatedProfile?.birthDate.toISOString().split('T')[0]).toBe('1997-05-24');
  });

  it('should list all profiles', async () => {
    await profileRepo.create({ name: 'A', gender: 'male', birthDate: new Date('2006-05-24'), height: 170, createdAt: new Date() });
    await profileRepo.create({ name: 'B', gender: 'female', birthDate: new Date('1996-05-24'), height: 160, createdAt: new Date() });

    const all = await profileRepo.getAll();
    expect(all.length).toBe(2);
    expect(all.map(p => p.name)).toContain('A');
    expect(all.map(p => p.name)).toContain('B');
  });

  it('should save and query body composition measurements', async () => {
    const pId = '1';
    
    const mId1 = await measurementRepo.save({
      profileId: pId,
      timestamp: new Date(2026, 4, 1),
      weight: 70,
      impedance: 500,
      bmi: 22.8,
      bmr: 1600,
      bodyFat: 15,
      bodyWater: 58,
      boneMass: 3.2,
      muscleMass: 55,
      });

    const mId2 = await measurementRepo.save({
      profileId: pId,
      timestamp: new Date(2026, 4, 2),
      weight: 69.5,
      impedance: 498,
      bmi: 22.6,
      bmr: 1595,
      bodyFat: 14.8,
      bodyWater: 58.2,
      boneMass: 3.2,
      muscleMass: 55.1,
      });

    expect(mId1).toBeDefined();
    expect(mId2).toBeDefined();

    const all = await measurementRepo.getAll(pId);
    expect(all.length).toBe(2);
    expect(all[0].weight).toBe(70);
    expect(all[1].weight).toBe(69.5);

    const latest = await measurementRepo.getLatest(pId);
    expect(latest?.weight).toBe(69.5);
  });

  it('should add, list, and filter food logs by date', async () => {
    const pId = '1';
    const date = new Date(2026, 4, 24);

    await foodRepo.add({
      profileId: pId,
      timestamp: date,
      mealType: 'breakfast',
      description: 'Oatmeal',
      calories: 350,
      protein: 15,
      carbs: 60,
      fat: 5,
    });

    await foodRepo.add({
      profileId: pId,
      timestamp: new Date(2026, 4, 25), // different date
      mealType: 'lunch',
      description: 'Chicken Salad',
      calories: 450,
      protein: 35,
      carbs: 10,
      fat: 15,
    });

    const all = await foodRepo.getAll(pId);
    expect(all.length).toBe(2);

    const filtered = await foodRepo.getAll(pId, date);
    expect(filtered.length).toBe(1);
    expect(filtered[0].description).toBe('Oatmeal');
  });

  it('should add and list workout logs', async () => {
    const pId = '1';
    const date = new Date(2026, 4, 24);

    await workoutRepo.add({
      profileId: pId,
      timestamp: date,
      type: 'Strength',
      duration: 45,
      description: 'Push Day',
      caloriesBurned: 300,
    });

    const all = await workoutRepo.getAll(pId);
    expect(all.length).toBe(1);
    expect(all[0].type).toBe('Strength');
  });

  it('should add, get, and clear messages logs', async () => {
    const pId = '1';

    await messageRepo.add({
      profileId: pId,
      timestamp: new Date(),
      sender: 'user',
      content: 'hello coach',
    });

    await messageRepo.add({
      profileId: pId,
      timestamp: new Date(),
      sender: 'assistant',
      content: 'hello, how can I help you today?',
    });

    const chat = await messageRepo.getAll(pId);
    expect(chat.length).toBe(2);
    expect(chat[0].sender).toBe('user');
    expect(chat[1].sender).toBe('assistant');

    await messageRepo.clear(pId);
    const emptyChat = await messageRepo.getAll(pId);
    expect(emptyChat.length).toBe(0);
  });

  it('should perform cascade deletion when deleting a profile', async () => {
    const pId = await profileRepo.create({
      name: 'Cascaded User',
      gender: 'male',
      birthDate: new Date('2006-05-24'),
      height: 180,
      createdAt: new Date(),
    });

    await measurementRepo.save({
      profileId: pId,
      timestamp: new Date(),
      weight: 80,
      impedance: 500,
      bmi: 24.7,
      bmr: 1800,
      bodyFat: 18,
      bodyWater: 56,
      boneMass: 3.4,
      muscleMass: 62,
      });

    await foodRepo.add({
      profileId: pId,
      timestamp: new Date(),
      mealType: 'breakfast',
      description: 'Egg',
      calories: 80,
      protein: 6,
      carbs: 0,
      fat: 5,
    });

    await workoutRepo.add({
      profileId: pId,
      timestamp: new Date(),
      type: 'Gym',
      duration: 30,
      description: 'Run',
    });

    await messageRepo.add({
      profileId: pId,
      timestamp: new Date(),
      sender: 'user',
      content: 'ping',
    });

    // Verify all records exist
    expect((await measurementRepo.getAll(pId)).length).toBe(1);
    expect((await foodRepo.getAll(pId)).length).toBe(1);
    expect((await workoutRepo.getAll(pId)).length).toBe(1);
    expect((await messageRepo.getAll(pId)).length).toBe(1);

    await workoutSetRepo.add({
      workoutLogId: 'w1',
      profileId: pId,
      exerciseName: 'Bench Press',
      setNumber: 1,
      weight: 60,
      reps: 10,
      timestamp: new Date(),
    });

    // Verify all records exist
    expect((await measurementRepo.getAll(pId)).length).toBe(1);
    expect((await foodRepo.getAll(pId)).length).toBe(1);
    expect((await workoutRepo.getAll(pId)).length).toBe(1);
    expect((await messageRepo.getAll(pId)).length).toBe(1);
    expect((await workoutSetRepo.getForWorkout('w1')).length).toBe(1);

    await favRepo.add({ profileId: pId, exerciseId: '0025', addedAt: new Date() });

    // Delete the profile
    await profileRepo.delete(pId);

    // Verify all related records are deleted
    expect(await profileRepo.get(pId)).toBeUndefined();
    expect((await measurementRepo.getAll(pId)).length).toBe(0);
    expect((await foodRepo.getAll(pId)).length).toBe(0);
    expect((await workoutRepo.getAll(pId)).length).toBe(0);
    expect((await messageRepo.getAll(pId)).length).toBe(0);
    expect((await workoutSetRepo.getForWorkout('w1')).length).toBe(0);
    expect((await favRepo.getAll(pId)).length).toBe(0);
  });

  it('should add, retrieve, and delete workout sets with stats', async () => {
    const pId = '1';
    const wId = '100';

    const sId1 = await workoutSetRepo.add({
      workoutLogId: wId,
      profileId: pId,
      exerciseName: 'Squat',
      setNumber: 1,
      weight: 100,
      reps: 5,
      timestamp: new Date(),
    });

    const sId2 = await workoutSetRepo.add({
      workoutLogId: wId,
      profileId: pId,
      exerciseName: 'Squat',
      setNumber: 2,
      weight: 110,
      reps: 5,
      timestamp: new Date(),
    });

    expect(sId1).toBeDefined();
    expect(sId2).toBeDefined();

    const sets = await workoutSetRepo.getForWorkout(wId);
    expect(sets.length).toBe(2);
    expect(sets[0].weight).toBe(100);
    expect(sets[1].weight).toBe(110);

    const squatSets = await workoutSetRepo.getForExercise(pId, 'Squat');
    expect(squatSets.length).toBe(2);

    await workoutSetRepo.delete(sId1);
    const afterDelete = await workoutSetRepo.getForWorkout(wId);
    expect(afterDelete.length).toBe(1);
    expect(afterDelete[0].weight).toBe(110);
  });

  it('should cascade delete workout sets when deleting a workout log', async () => {
    const pId = '1';
    const wId = await workoutRepo.add({
      profileId: pId,
      timestamp: new Date(),
      type: 'Gym',
      duration: 60,
      description: 'Leg day',
    });

    await workoutSetRepo.add({
      workoutLogId: wId,
      profileId: pId,
      exerciseName: 'Deadlift',
      setNumber: 1,
      weight: 140,
      reps: 5,
      timestamp: new Date(),
    });

    expect((await workoutSetRepo.getForWorkout(wId)).length).toBe(1);

    await workoutRepo.delete(wId);

    expect((await workoutRepo.getAll(pId)).length).toBe(0);
    expect((await workoutSetRepo.getForWorkout(wId)).length).toBe(0);
  });
  describe('wellness logs', () => {
    const wellnessRepo = new WellnessLogRepository();

    it('treats the day as the identity, so answering twice corrects', async () => {
      await wellnessRepo.save({ profileId: 'p1', day: '2026-06-27', timestamp: new Date(), energy: 2 });
      await wellnessRepo.save({ profileId: 'p1', day: '2026-06-27', timestamp: new Date(), energy: 5 });

      const rows = await db.wellnessLogs.toArray();
      expect(rows).toHaveLength(1);
      expect(rows[0].energy).toBe(5);
    });

    it('merges rather than replaces, so two writers do not blank each other', async () => {
      // The sheet knows the four answers; the health import knows sleep. A
      // replace would mean whichever ran second wiped the other's fields.
      await wellnessRepo.save({ profileId: 'p1', day: '2026-06-27', timestamp: new Date(), energy: 4 });
      await wellnessRepo.save({ profileId: 'p1', day: '2026-06-27', timestamp: new Date(), sleepMinutes: 450 });

      const stored = await wellnessRepo.getForDay('p1', '2026-06-27');
      expect(stored?.energy).toBe(4);
      expect(stored?.sleepMinutes).toBe(450);
    });

    it('keeps one row per profile per day, not one per day', async () => {
      await wellnessRepo.save({ profileId: 'p1', day: '2026-06-27', timestamp: new Date(), energy: 1 });
      await wellnessRepo.save({ profileId: 'p2', day: '2026-06-27', timestamp: new Date(), energy: 5 });

      expect((await wellnessRepo.getForDay('p1', '2026-06-27'))?.energy).toBe(1);
      expect((await wellnessRepo.getForDay('p2', '2026-06-27'))?.energy).toBe(5);
    });

    it('reads a range as a string comparison, oldest first', async () => {
      // `day` is zero-padded precisely so this works without parsing dates.
      for (const day of ['2026-06-09', '2026-06-27', '2026-07-03']) {
        await wellnessRepo.save({ profileId: 'p1', day, timestamp: new Date(), energy: 3 });
      }

      const range = await wellnessRepo.getRange('p1', '2026-06-27');
      expect(range.map(r => r.day)).toEqual(['2026-06-27', '2026-07-03']);
    });
  });
});
