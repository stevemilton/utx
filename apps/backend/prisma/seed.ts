import { PrismaClient, WorkoutType, Gender, PbCategory, ClubRole, SquadRole } from '@prisma/client';

const prisma = new PrismaClient();

// Helper to generate random workout times based on distance
function generateWorkoutTime(distanceMetres: number, skill: 'fast' | 'medium' | 'slow'): number {
  // Base split per 500m in seconds
  const baseSplits = {
    fast: 95,    // 1:35 /500m
    medium: 110, // 1:50 /500m
    slow: 125,   // 2:05 /500m
  };

  const baseSplit = baseSplits[skill];
  const variance = (Math.random() - 0.5) * 10; // +/- 5 seconds variance
  const splitSeconds = baseSplit + variance;

  return (distanceMetres / 500) * splitSeconds;
}

// Helper to generate random date within last N days
function randomDate(daysAgo: number): Date {
  const now = new Date();
  const randomDays = Math.floor(Math.random() * daysAgo);
  return new Date(now.getTime() - randomDays * 24 * 60 * 60 * 1000);
}

// Generate random invite code
function generateInviteCode(): string {
  return Math.random().toString(36).substring(2, 8).toUpperCase();
}

async function main() {
  console.log('🌱 Starting seed...');

  // Clean existing data (in reverse order of dependencies)
  await prisma.workoutComment.deleteMany();
  await prisma.workoutReaction.deleteMany();
  await prisma.personalBest.deleteMany();
  await prisma.workout.deleteMany();
  await prisma.follow.deleteMany();
  await prisma.squadMembership.deleteMany();
  await prisma.clubMembership.deleteMany();
  await prisma.squad.deleteMany();
  await prisma.club.deleteMany();
  await prisma.user.deleteMany();

  console.log('✅ Cleaned existing data');

  // Create Clubs
  const sydneyRowingClub = await prisma.club.create({
    data: {
      name: 'Sydney Rowing Club',
      location: 'Sydney, NSW',
      verified: true,
      inviteCode: generateInviteCode(),
    },
  });

  const melbourneRC = await prisma.club.create({
    data: {
      name: 'Melbourne Rowing Club',
      location: 'Melbourne, VIC',
      verified: true,
      inviteCode: generateInviteCode(),
    },
  });

  const uniClub = await prisma.club.create({
    data: {
      name: 'University Boat Club',
      location: 'Brisbane, QLD',
      verified: false,
      inviteCode: generateInviteCode(),
    },
  });

  console.log('✅ Created clubs');

  // Create Squads
  const sydneyMensA = await prisma.squad.create({
    data: {
      clubId: sydneyRowingClub.id,
      name: "Men's A Squad",
      inviteCode: generateInviteCode(),
    },
  });

  const sydneyWomensA = await prisma.squad.create({
    data: {
      clubId: sydneyRowingClub.id,
      name: "Women's A Squad",
      inviteCode: generateInviteCode(),
    },
  });

  const melbourneMasters = await prisma.squad.create({
    data: {
      clubId: melbourneRC.id,
      name: 'Masters Squad',
      inviteCode: generateInviteCode(),
    },
  });

  console.log('✅ Created squads');

  // Create Demo Users
  const demoUser = await prisma.user.create({
    data: {
      firebaseUid: 'demo-user-001',
      email: 'demo@utx.app',
      name: 'Demo Rower',
      heightCm: 185,
      weightKg: 82,
      birthDate: new Date('1995-03-15'),
      gender: Gender.male,
      maxHr: 190,
      hasCompletedOnboarding: true,
    },
  });

  const alexWilson = await prisma.user.create({
    data: {
      firebaseUid: 'seed-alex-wilson',
      email: 'alex@example.com',
      name: 'Alex Wilson',
      heightCm: 190,
      weightKg: 88,
      birthDate: new Date('1992-07-22'),
      gender: Gender.male,
      maxHr: 188,
      hasCompletedOnboarding: true,
    },
  });

  const sarahChen = await prisma.user.create({
    data: {
      firebaseUid: 'seed-sarah-chen',
      email: 'sarah@example.com',
      name: 'Sarah Chen',
      heightCm: 175,
      weightKg: 68,
      birthDate: new Date('1998-11-08'),
      gender: Gender.female,
      maxHr: 195,
      hasCompletedOnboarding: true,
    },
  });

  const mikeJohnson = await prisma.user.create({
    data: {
      firebaseUid: 'seed-mike-johnson',
      email: 'mike@example.com',
      name: 'Mike Johnson',
      heightCm: 182,
      weightKg: 78,
      birthDate: new Date('1988-04-30'),
      gender: Gender.male,
      maxHr: 182,
      hasCompletedOnboarding: true,
    },
  });

  const emmaThompson = await prisma.user.create({
    data: {
      firebaseUid: 'seed-emma-thompson',
      email: 'emma@example.com',
      name: 'Emma Thompson',
      heightCm: 172,
      weightKg: 65,
      birthDate: new Date('2000-09-12'),
      gender: Gender.female,
      maxHr: 198,
      hasCompletedOnboarding: true,
    },
  });

  const users = [demoUser, alexWilson, sarahChen, mikeJohnson, emmaThompson];
  console.log('✅ Created users');

  // Create Club Memberships
  await prisma.clubMembership.createMany({
    data: [
      { clubId: sydneyRowingClub.id, userId: demoUser.id, role: ClubRole.member },
      { clubId: sydneyRowingClub.id, userId: alexWilson.id, role: ClubRole.admin },
      { clubId: sydneyRowingClub.id, userId: sarahChen.id, role: ClubRole.member },
      { clubId: melbourneRC.id, userId: mikeJohnson.id, role: ClubRole.admin },
      { clubId: uniClub.id, userId: emmaThompson.id, role: ClubRole.member },
    ],
  });

  // Create Squad Memberships
  await prisma.squadMembership.createMany({
    data: [
      { squadId: sydneyMensA.id, userId: demoUser.id, role: SquadRole.member },
      { squadId: sydneyMensA.id, userId: alexWilson.id, role: SquadRole.captain },
      { squadId: sydneyWomensA.id, userId: sarahChen.id, role: SquadRole.member },
      { squadId: melbourneMasters.id, userId: mikeJohnson.id, role: SquadRole.captain },
    ],
  });

  console.log('✅ Created memberships');

  // Create Follows
  await prisma.follow.createMany({
    data: [
      { followerId: demoUser.id, followingId: alexWilson.id },
      { followerId: demoUser.id, followingId: sarahChen.id },
      { followerId: alexWilson.id, followingId: demoUser.id },
      { followerId: sarahChen.id, followingId: demoUser.id },
      { followerId: sarahChen.id, followingId: emmaThompson.id },
      { followerId: mikeJohnson.id, followingId: alexWilson.id },
    ],
  });

  console.log('✅ Created follows');

  // Create Workouts for each user
  const workoutTypes = [
    { type: WorkoutType.two_thousand, distance: 2000, skill: 'fast' as const },
    { type: WorkoutType.five_thousand, distance: 5000, skill: 'medium' as const },
    { type: WorkoutType.ten_thousand, distance: 10000, skill: 'slow' as const },
    { type: WorkoutType.five_hundred, distance: 500, skill: 'fast' as const },
    { type: WorkoutType.steady_state, distance: 8000, skill: 'slow' as const },
  ];

  const allWorkouts: any[] = [];

  for (const user of users) {
    const skill = user.name === 'Alex Wilson' ? 'fast' : user.name === 'Sarah Chen' ? 'fast' : 'medium';

    // Create 5-8 workouts per user over the last 30 days
    const numWorkouts = 5 + Math.floor(Math.random() * 4);

    for (let i = 0; i < numWorkouts; i++) {
      const workoutTemplate = workoutTypes[Math.floor(Math.random() * workoutTypes.length)];
      const timeSeconds = generateWorkoutTime(workoutTemplate.distance, skill as any);
      const splitSeconds = (timeSeconds / workoutTemplate.distance) * 500;
      const strokeRate = 22 + Math.floor(Math.random() * 10); // 22-32 spm
      const watts = Math.floor(200 + (500 - splitSeconds) * 3); // Higher watts for faster splits

      const workout = await prisma.workout.create({
        data: {
          userId: user.id,
          workoutType: workoutTemplate.type,
          totalTimeSeconds: timeSeconds,
          totalDistanceMetres: workoutTemplate.distance,
          averageSplitSeconds: splitSeconds,
          averageRate: strokeRate,
          averageWatts: watts,
          calories: Math.floor(timeSeconds * 0.15),
          avgHeartRate: 150 + Math.floor(Math.random() * 30),
          maxHeartRate: 170 + Math.floor(Math.random() * 20),
          dragFactor: 110 + Math.floor(Math.random() * 20),
          effortScore: 6 + Math.random() * 4,
          workoutDate: randomDate(30),
          squadId: user.id === demoUser.id || user.id === alexWilson.id ? sydneyMensA.id : null,
          aiInsight: getRandomInsight(),
        },
      });

      allWorkouts.push(workout);
    }
  }

  console.log(`✅ Created ${allWorkouts.length} workouts`);

  // Create Personal Bests (find best workout for each category per user)
  for (const user of users) {
    const userWorkouts = allWorkouts.filter(w => w.userId === user.id);

    // Group by distance and find best time
    const pbsByDistance = new Map<number, typeof userWorkouts[0]>();

    for (const workout of userWorkouts) {
      const existing = pbsByDistance.get(workout.totalDistanceMetres);
      if (!existing || workout.totalTimeSeconds < existing.totalTimeSeconds) {
        pbsByDistance.set(workout.totalDistanceMetres, workout);
      }
    }

    // Create PB records
    for (const [distance, workout] of pbsByDistance) {
      const category = distanceToPbCategory(distance);
      if (category) {
        await prisma.personalBest.create({
          data: {
            userId: user.id,
            category,
            timeSeconds: workout.totalTimeSeconds,
            achievedAt: workout.workoutDate,
            workoutId: workout.id,
          },
        });

        // Mark workout as PB
        await prisma.workout.update({
          where: { id: workout.id },
          data: { isPb: true, pbCategory: category },
        });
      }
    }
  }

  console.log('✅ Created personal bests');

  // Create some reactions and comments
  for (const workout of allWorkouts.slice(0, 15)) {
    // Add 1-3 reactions per workout
    const reactors = users.filter(u => u.id !== workout.userId).slice(0, Math.floor(Math.random() * 3) + 1);
    for (const reactor of reactors) {
      await prisma.workoutReaction.create({
        data: {
          workoutId: workout.id,
          userId: reactor.id,
        },
      });
    }

    // Add 0-2 comments per workout
    const numComments = Math.floor(Math.random() * 3);
    const commenters = users.filter(u => u.id !== workout.userId).slice(0, numComments);
    for (const commenter of commenters) {
      await prisma.workoutComment.create({
        data: {
          workoutId: workout.id,
          userId: commenter.id,
          content: getRandomComment(),
        },
      });
    }
  }

  console.log('✅ Created reactions and comments');

  console.log('');
  console.log('🎉 Seed completed successfully!');
  console.log('');
  console.log('Created:');
  console.log(`  - ${users.length} users`);
  console.log(`  - 3 clubs`);
  console.log(`  - 3 squads`);
  console.log(`  - ${allWorkouts.length} workouts`);
  console.log('');
  console.log('Demo user: demo@utx.app (firebaseUid: demo-user-001)');
}

function distanceToPbCategory(distance: number): PbCategory | null {
  const mapping: Record<number, PbCategory> = {
    500: PbCategory.five_hundred,
    1000: PbCategory.one_thousand,
    2000: PbCategory.two_thousand,
    5000: PbCategory.five_thousand,
    6000: PbCategory.six_thousand,
    10000: PbCategory.ten_thousand,
  };
  return mapping[distance] || null;
}

function getRandomInsight(): string {
  const insights = [
    "Strong consistent pace throughout. Your stroke efficiency has improved 3% this month.",
    "Great negative split! You're building excellent race fitness.",
    "Power output is solid. Consider working on your catch timing for even better efficiency.",
    "Impressive effort! Your heart rate recovery is faster than last week.",
    "Good steady state session. This is building your aerobic base nicely.",
    "Your rate was a bit high for this distance. Try dropping 2spm and maintaining power.",
    "Excellent pacing strategy - you're learning to manage your energy well.",
    "Strong finish! Your last 500m was your fastest split.",
  ];
  return insights[Math.floor(Math.random() * insights.length)];
}

function getRandomComment(): string {
  const comments = [
    "Nice work! 💪",
    "Strong session!",
    "That's a solid time!",
    "Keep pushing! You're getting faster.",
    "Great effort today",
    "Looking good! See you at training tomorrow.",
    "Beast mode 🔥",
    "Impressive pace!",
    "Way to grind it out",
    "That negative split though 👏",
  ];
  return comments[Math.floor(Math.random() * comments.length)];
}

main()
  .catch((e) => {
    console.error('Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
