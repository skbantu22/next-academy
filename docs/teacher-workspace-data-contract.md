# Next Academy Teacher Workspace Data Contract

## Architecture

The application uses Firebase Authentication and the Firebase Web SDK for Firestore. There is no MongoDB, Mongoose, Firebase Admin SDK, API route layer, Redux store, or existing realtime transport. Teacher pages use scoped Firestore listeners; Firestore Security Rules enforce authorization independently of the UI.

## Collections

- `users/{uid}`: `uid`, `email`, `displayName`, `photoURL`, `role`, optional `teacherIds[]` for student access and optional `active`.
- `classes/{classId}`: `name`, `description`, `teacherIds[]`, `courseId`, `status`, `room`, `startsAt`, `endsAt`, `createdAt`, `updatedAt`.
- `enrollments/{enrollmentId}`: `classId`, `studentId`, `courseId`, `status`, `enrolledAt`, `completedAt`.
- `courses/{courseId}`: `title`, `description`, `teacherIds[]`, `status`, `createdAt`, `updatedAt`.
- `courses/{courseId}/modules/{moduleId}`: `title`, `order`, `published`.
- `courses/{courseId}/modules/{moduleId}/lessons/{lessonId}`: `title`, `content`, `order`, `published`.
- `assignments/{assignmentId}`: `title`, `description`, `classId`, `courseId`, `teacherId`, `dueAt`, `status`, `createdAt`, `updatedAt`.
- `submissions/{submissionId}`: `assignmentId`, `classId`, `courseId`, `teacherId`, `studentId`, `status` (`submitted`, `reviewed`, `returned`), `score`, `submittedAt`, `reviewedAt`.
- `attendance/{attendanceId}`: `classId`, `teacherId`, `studentId`, `date` (`YYYY-MM-DD`), `status` (`present`, `absent`, `late`), `markedAt`, `markedBy`.
- `events/{eventId}`: `title`, `description`, `date`, `startTime`, `endTime`, `location`, `classId`, `teacherId`, `createdAt`, `updatedAt`, `status`.
- `achievements/{achievementId}`: `title`, `description`, `studentId`, `classId`, `courseId`, `teacherId`, `awardedAt`, `status`.
- `certificates/{certificateId}`: `certificateId`, `studentId`, `courseId`, `classId`, `teacherId`, `title`, `issueDate`, `status`.
- `conversations/{conversationId}`: `participantIds[]`, `teacherId`, `studentId`, `lastMessage`, `lastMessageAt`, `updatedAt`.
- `conversations/{conversationId}/messages/{messageId}`: `senderId`, `receiverId`, `body`, `createdAt`, `readAt`.
- `notifications/{notificationId}`: `userId`, `type`, `title`, `body`, `readAt`, `createdAt`, optional `entityId`.
- `activities/{activityId}`: `actorId`, `teacherId`, `type`, `title`, `description`, `entityId`, `createdAt`.

## Relationships

Teacher ownership is explicit through `teacherIds[]` on classes/courses and `teacherId` on assignments, submissions, attendance, events, achievements, certificates, conversations, and activities. Student access is denormalized through `users/{studentId}.teacherIds[]`, maintained when enrollments are created or removed. This makes Firestore rules enforceable without collection-wide reads.

## Teacher authorization

A signed-in user is a teacher when their `users/{uid}.role == 'Teacher'`. Teacher reads and writes are allowed only when the document's `teacherId` matches the authenticated UID, the class/course `teacherIds` contains the UID, or the student profile `teacherIds` contains the UID. Admins may manage all records. Students may read their own records and write only their own submissions/messages where applicable.

## Service contract

Teacher pages use `lib/teacher-data.js` for scoped realtime subscriptions and writes. No page queries an unscoped collection. Dashboard aggregation combines the teacher's class, student, submission, attendance, event, achievement, certificate, conversation, notification, and activity listeners without fabricated fallback values.

## Realtime strategy

`onSnapshot` is used for teacher dashboard collections, students, attendance, events, achievements, certificates, conversations/messages, notifications, and activities. Writes use Firestore `addDoc`, `setDoc`, and `updateDoc`; related activity and notification documents are written in the same client operation batch where appropriate. Firestore Rules remain the authorization boundary.

## Required indexes

Create composite indexes in Firebase Console when Firestore reports them for production queries, especially `teacherId + createdAt`, `teacherId + date`, `classId + date`, and `participantIds + updatedAt`.
