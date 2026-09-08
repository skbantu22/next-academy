import { getDownloadURL, ref as storageRef, uploadBytes } from "firebase/storage";
import { storage } from "./firebase";

export async function uploadCourseThumbnail(courseId, file) {
  if (!storage) throw new Error("Firebase is not configured.");
  const path = `courses/${courseId}/thumbnail/${file.name}`;
  const objectRef = storageRef(storage, path);
  await uploadBytes(objectRef, file);
  const thumbnailUrl = await getDownloadURL(objectRef);
  return { thumbnailUrl, thumbnailPath: path };
}
