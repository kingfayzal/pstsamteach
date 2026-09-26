-- AlterTable
ALTER TABLE "User" ADD COLUMN "timeZone" TEXT;

-- CreateTable
CREATE TABLE "TeacherProfile" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "headline" TEXT NOT NULL DEFAULT '',
    "about" TEXT NOT NULL DEFAULT '',
    "teachingStyle" TEXT,
    "experienceYears" INTEGER,
    "qualifications" TEXT,
    "videoUrl" TEXT,
    "meetingUrl" TEXT,
    "timeZone" TEXT NOT NULL DEFAULT 'UTC',
    "sessionMinutes" INTEGER NOT NULL DEFAULT 60,
    "acceptingStudents" BOOLEAN NOT NULL DEFAULT true,
    "isHidden" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "TeacherProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ProfilePhoto" (
    "profileId" TEXT NOT NULL PRIMARY KEY,
    "data" BLOB NOT NULL,
    "contentType" TEXT NOT NULL,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ProfilePhoto_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "TeacherProfile" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Topic" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "subjectId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "position" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Topic_subjectId_fkey" FOREIGN KEY ("subjectId") REFERENCES "Subject" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "TeacherTopic" (
    "profileId" TEXT NOT NULL,
    "topicId" TEXT NOT NULL,

    PRIMARY KEY ("profileId", "topicId"),
    CONSTRAINT "TeacherTopic_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "TeacherProfile" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "TeacherTopic_topicId_fkey" FOREIGN KEY ("topicId") REFERENCES "Topic" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "TeacherLanguage" (
    "profileId" TEXT NOT NULL,
    "language" TEXT NOT NULL,

    PRIMARY KEY ("profileId", "language"),
    CONSTRAINT "TeacherLanguage_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "TeacherProfile" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "AvailabilityWindow" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "profileId" TEXT NOT NULL,
    "weekday" INTEGER NOT NULL,
    "startMinute" INTEGER NOT NULL,
    "endMinute" INTEGER NOT NULL,
    CONSTRAINT "AvailabilityWindow_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "TeacherProfile" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "TeacherConnection" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "studentId" TEXT NOT NULL,
    "teacherId" TEXT NOT NULL,
    "topicId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "goals" TEXT NOT NULL,
    "responseNote" TEXT,
    "endedById" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "respondedAt" DATETIME,
    "endedAt" DATETIME,
    CONSTRAINT "TeacherConnection_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "TeacherConnection_teacherId_fkey" FOREIGN KEY ("teacherId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "TeacherConnection_topicId_fkey" FOREIGN KEY ("topicId") REFERENCES "Topic" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "TutoringSession" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "connectionId" TEXT NOT NULL,
    "teacherId" TEXT NOT NULL,
    "startsAt" DATETIME NOT NULL,
    "endsAt" DATETIME NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'CONFIRMED',
    "agenda" TEXT,
    "cancelledById" TEXT,
    "cancelReason" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "TutoringSession_connectionId_fkey" FOREIGN KEY ("connectionId") REFERENCES "TeacherConnection" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "TutoringSession_teacherId_fkey" FOREIGN KEY ("teacherId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Message" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "connectionId" TEXT NOT NULL,
    "senderId" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "readAt" DATETIME,
    CONSTRAINT "Message_connectionId_fkey" FOREIGN KEY ("connectionId") REFERENCES "TeacherConnection" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Message_senderId_fkey" FOREIGN KEY ("senderId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "TeacherReview" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "teacherId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "rating" INTEGER NOT NULL,
    "body" TEXT NOT NULL,
    "isHidden" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "TeacherReview_teacherId_fkey" FOREIGN KEY ("teacherId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "TeacherReview_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "SavedTeacher" (
    "studentId" TEXT NOT NULL,
    "teacherId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,

    PRIMARY KEY ("studentId", "teacherId"),
    CONSTRAINT "SavedTeacher_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "SavedTeacher_teacherId_fkey" FOREIGN KEY ("teacherId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "TeacherProfile_userId_key" ON "TeacherProfile"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "TeacherProfile_slug_key" ON "TeacherProfile"("slug");

-- CreateIndex
CREATE INDEX "TeacherProfile_isHidden_acceptingStudents_idx" ON "TeacherProfile"("isHidden", "acceptingStudents");

-- CreateIndex
CREATE UNIQUE INDEX "Topic_subjectId_slug_key" ON "Topic"("subjectId", "slug");

-- CreateIndex
CREATE UNIQUE INDEX "Topic_subjectId_name_key" ON "Topic"("subjectId", "name");

-- CreateIndex
CREATE INDEX "TeacherTopic_topicId_idx" ON "TeacherTopic"("topicId");

-- CreateIndex
CREATE INDEX "TeacherLanguage_language_idx" ON "TeacherLanguage"("language");

-- CreateIndex
CREATE INDEX "AvailabilityWindow_profileId_idx" ON "AvailabilityWindow"("profileId");

-- CreateIndex
CREATE INDEX "TeacherConnection_teacherId_status_idx" ON "TeacherConnection"("teacherId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "TeacherConnection_studentId_teacherId_key" ON "TeacherConnection"("studentId", "teacherId");

-- CreateIndex
CREATE INDEX "TutoringSession_teacherId_startsAt_idx" ON "TutoringSession"("teacherId", "startsAt");

-- CreateIndex
CREATE INDEX "TutoringSession_connectionId_startsAt_idx" ON "TutoringSession"("connectionId", "startsAt");

-- CreateIndex
CREATE INDEX "Message_connectionId_createdAt_idx" ON "Message"("connectionId", "createdAt");

-- CreateIndex
CREATE INDEX "TeacherReview_teacherId_isHidden_idx" ON "TeacherReview"("teacherId", "isHidden");

-- CreateIndex
CREATE UNIQUE INDEX "TeacherReview_teacherId_studentId_key" ON "TeacherReview"("teacherId", "studentId");

-- CreateIndex
CREATE INDEX "SavedTeacher_teacherId_idx" ON "SavedTeacher"("teacherId");
