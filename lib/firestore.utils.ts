import { getFirestore, collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { getApp } from '@/lib/firebase';
import { logger } from '@/lib/logger';

/**
 * Saves a chat message pair (user message and AI response) to Firestore.
 * Stores the message under the user's chatLogs subcollection with a server timestamp.
 *
 * @param userId - The Firebase user ID to associate the message with
 * @param messageData - The message data including userMessage, aiResponse, timestamp, and section
 * @throws {Error} Throws if the Firestore write operation fails
 */
export async function saveRawMessageToFirestore(
    userId: string,
    messageData: {
        userMessage: string;
        aiResponse: string;
        timestamp: string;
        section: string;
    }
): Promise<void> {
    try {
        const db = getFirestore(getApp());
        const chatLogsRef = collection(db, 'users', userId, 'chatLogs');
        
        await addDoc(chatLogsRef, {
            ...messageData,
            createdAt: serverTimestamp()
        });
    } catch (error) {
        logger.error({ err: error, msg: 'Error saving message to Firestore' });
        throw error;
    }
}