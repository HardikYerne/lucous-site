const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();
const { CURRICULUM_DATA } = require("../curriculum-data");

async function main() {
  let boards = 0, grades = 0, subjects = 0, chapters = 0, topics = 0, contents = 0, questions = 0;

  for (const entry of CURRICULUM_DATA) {
    const board = await prisma.board.upsert({
      where: { name: entry.board },
      update: {},
      create: { name: entry.board },
    });
    const grade = await prisma.grade.upsert({
      where: { name: entry.grade },
      update: {},
      create: { name: entry.grade },
    });
    const subject = await prisma.subject.upsert({
      where: { boardId_gradeId_name: { boardId: board.id, gradeId: grade.id, name: entry.subject } },
      update: {},
      create: { name: entry.subject, boardId: board.id, gradeId: grade.id },
    });

    for (const chapter of entry.chapters) {
      const chapterRow = await prisma.chapter.upsert({
        where: { subjectId_name: { subjectId: subject.id, name: chapter.name } },
        update: {},
        create: { subjectId: subject.id, name: chapter.name },
      });

      for (const topic of chapter.topics) {
        const topicRow = await prisma.topic.upsert({
          where: { chapterId_name: { chapterId: chapterRow.id, name: topic.name } },
          update: {},
          create: { chapterId: chapterRow.id, name: topic.name },
        });

        await prisma.question.deleteMany({ where: { topicId: topicRow.id } });
        await prisma.learningContent.deleteMany({ where: { topicId: topicRow.id } });

        await prisma.learningContent.createMany({
          data: topic.contents.map((c) => ({
            topicId: topicRow.id,
            title: c.title,
            body: c.body,
            order: c.order,
            source: "TEACHER",
            status: "PUBLISHED",
          })),
        });
        await prisma.question.createMany({
          data: topic.questions.map((q) => ({
            topicId: topicRow.id,
            text: q.text,
            optionA: q.optionA,
            optionB: q.optionB,
            optionC: q.optionC,
            optionD: q.optionD,
            correct: q.correct,
            explanation: q.explanation ?? null,
            difficulty: q.difficulty ?? "MEDIUM",
            source: "TEACHER",
            status: "PUBLISHED",
          })),
        });

        topics += 1;
        contents += topic.contents.length;
        questions += topic.questions.length;
      }
      chapters += 1;
    }
    subjects += 1;
  }

  boards = await prisma.board.count();
  grades = await prisma.grade.count();
  const realSubjects = await prisma.subject.count();
  const realChapters = await prisma.chapter.count();
  const realTopics = await prisma.topic.count();
  const realContents = await prisma.learningContent.count();
  const realQuestions = await prisma.question.count();

  console.log("Seed complete:", {
    boards,
    grades,
    subjects: realSubjects,
    chapters: realChapters,
    topics: realTopics,
    contents: realContents,
    questions: realQuestions,
  });
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
