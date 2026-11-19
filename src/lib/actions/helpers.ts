
'use server';
import { db } from '../db';

// Centralized error handler for database operations
export async function handleDbError(
    error: any,
    context: string = 'database operation'
): Promise<{ success: false, error: string }> {
    console.error(`[DB Error] in ${context}:`, error);

    let errorMessage = 'An internal error occurred. Please try again later.';

    if (error.code) {
        switch (error.code) {
            case '23505':
                errorMessage = 'A record with this value already exists.';
                break;
            case '23503':
                errorMessage = 'A reference to another entity is invalid.';
                break;
            case '22001':
                errorMessage = 'One of the provided values is too long.';
                break;
            default:
                errorMessage = error.message || 'A database error occurred.';
                break;
        }
    } else if (error.message) {
        errorMessage = error.message;
    }

    return { success: false, error: errorMessage };
}

export { db };
