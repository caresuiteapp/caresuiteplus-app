import {
  isAudioMimeType,
  isImageMimeType,
  isPdfMimeType,
  isVideoMimeType,
} from '@/lib/office/messageattachmentvalidation';

export function employeeMessageAttachmentIcon(mimeType: string | null) {
  if (isImageMimeType(mimeType)) return 'image-outline';
  if (isVideoMimeType(mimeType)) return 'videocam-outline';
  if (isAudioMimeType(mimeType)) return 'mic-outline';
  if (isPdfMimeType(mimeType)) return 'document-text-outline';
  return 'attach-outline';
}
