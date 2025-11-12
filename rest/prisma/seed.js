import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();
async function main() {
  await prisma.store.create({
    data: {
      id: "1990",
      name: "ac",
      userId: "user_2RuSEc4axJNQ0xd3LOCxuL0XwKN",
    },
  });
}
main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
