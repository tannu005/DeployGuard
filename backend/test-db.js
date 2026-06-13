const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function main() {
  console.log("Connecting...");
  const count = await prisma.pipelineAnalysis.count();
  console.log("Count:", count);
}
main().catch(console.error).finally(() => prisma.$disconnect());
