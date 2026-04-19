import prisma from '../prisma/client.js'

async function main() {
  const invite = await prisma.interviewInvite.findFirst({
    orderBy: { createdAt: 'desc' },
    select: {
      candidateId: true,
      email: true,
      status: true,
      tokenExpiry: true,
    },
  })

  const users = await prisma.user.findMany({
    select: { id: true, email: true },
    orderBy: { id: 'asc' },
  })

  console.log(JSON.stringify({ latestInvite: invite, users }, null, 2))
}

main()
  .catch((error) => {
    console.error(error)
    process.exitCode = 1
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
