import { db, initDb } from "./db";
import { randomUUID } from "crypto";

const SEED_TICKETS = [
  {
    customer_name: "Sarah Chen",
    email: "sarah.chen@example.com",
    subject: "Double charge on my account",
    message: "I was charged twice for my monthly subscription on June 1st. Both charges of $49 appeared on my credit card. Please refund one of them immediately.",
  },
  {
    customer_name: "Marcus Johnson",
    email: "m.johnson@example.com",
    subject: "App crashes on every login attempt",
    message: "Since the latest update, the app crashes immediately after I enter my credentials. I've tried reinstalling but the bug persists. This is a critical error blocking my work.",
  },
  {
    customer_name: "Priya Patel",
    email: "priya.p@example.com",
    subject: "Feature request: dark mode for mobile",
    message: "Would be great if you could add dark mode to the mobile app. It would be much easier on the eyes in low-light conditions. I know a lot of users have requested this too!",
  },
  {
    customer_name: "Tom Williams",
    email: "tom.w@enterprise.com",
    subject: "Locked out of my account — urgent",
    message: "I've been locked out and cannot login. The password reset link expired before I could use it and now I can't access any of my account. This is urgent, I have a client presentation in 2 hours.",
  },
  {
    customer_name: "Elena Rodriguez",
    email: "elena.r@example.com",
    subject: "How do I export my data?",
    message: "Hi, I'm looking for a way to export all my data to a CSV file. I checked the help docs but couldn't find a clear answer. Can you point me in the right direction?",
  },
  {
    customer_name: "David Kim",
    email: "d.kim@startup.io",
    subject: "Lost 3 days of project data after update",
    message: "After installing the update yesterday, 3 days of my project data has disappeared. I have not deleted anything and this is causing a data loss situation for my entire team. We need this resolved immediately.",
  },
  {
    customer_name: "Rachel Green",
    email: "rachel.g@example.com",
    subject: "Invoice shows wrong plan (Basic instead of Pro)",
    message: "My latest invoice says I'm on the Basic plan but I upgraded to Pro last month. I'm being charged $19 instead of $49 which doesn't seem right. Can you check my billing history?",
  },
  {
    customer_name: "James Park",
    email: "j.park@example.com",
    subject: "Calendar integration suggestion",
    message: "I think a Google Calendar integration would be amazing. Being able to sync tasks to my calendar would save so much time. Could you add this to the product roadmap?",
  },
];

function seed() {
  initDb();

  const existing = (db.prepare("SELECT COUNT(*) as count FROM tickets").get() as { count: number }).count;
  if (existing > 0) {
    console.log(`ℹ️  Database already has ${existing} tickets — skipping seed.`);
    process.exit(0);
  }

  const insertTicket = db.prepare(
    `INSERT INTO tickets (id, customer_name, email, subject, message, status, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, 'new', ?, ?)`
  );

  // Spread creation times over the past 48 hours for realistic SLA testing
  const seedMany = db.transaction(() => {
    SEED_TICKETS.forEach((t, i) => {
      const hoursAgo = i * 6; // 0, 6, 12, 18, 24, 30, 36, 42 hours ago
      const createdAt = new Date(Date.now() - hoursAgo * 3600 * 1000).toISOString();
      insertTicket.run(randomUUID(), t.customer_name, t.email, t.subject, t.message, createdAt, createdAt);
    });
  });

  seedMany();
  console.log(`✅  Seeded ${SEED_TICKETS.length} tickets.`);
  process.exit(0);
}

seed();
