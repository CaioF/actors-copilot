import { getFirestore, collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { getApp } from '@/lib/firebase';

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
        console.error('Error saving message to Firestore:', error);
        throw error;
    }
}