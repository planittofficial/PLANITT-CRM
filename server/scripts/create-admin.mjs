import "dotenv/config";
import bcrypt from "bcrypt";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const email = process.argv[2] || "admin@planitt.com";
  const password = process.argv[3] || "Admin@123";
  const name = process.argv[4] || "System Admin";

  console.log(`Checking/Creating Superadmin user: ${email}...`);

  try {
    const existing = await prisma.user.findUnique({
      where: { email },
    });

    const hashedPassword = await bcrypt.hash(password, 10);

    if (existing) {
      await prisma.user.update({
        where: { email },
        data: {
          role: "SUPERADMIN",
          password: hashedPassword,
        },
      });
      console.log(`Updated existing user ${email} to SUPERADMIN role with new password.`);
    } else {
      await prisma.user.create({
        data: {
          name,
          email,
          password: hashedPassword,
          role: "SUPERADMIN",
          authProvider: "password",
        },
      });
      console.log(`Created new SUPERADMIN user ${email}.`);
    }

    console.log(`Credentials:`);
    console.log(`Email:    ${email}`);
    console.log(`Password: ${password}`);
  } catch (error) {
    console.error("Error creating superadmin:", error.message);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
