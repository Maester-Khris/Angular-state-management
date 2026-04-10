export type InteractionType = 'preview' | 'view' | 'impression' | 'share' | 'favorite';

export interface PostEvent {
    postId: string;
    userId?: string;
    guestId?: string;
    type: InteractionType;
    timestamp: number;
    source?: string;
    metadata?: any;
}

export interface EventBatch {
    events: PostEvent[];
    batchId: string;
    sentAt: number;
}